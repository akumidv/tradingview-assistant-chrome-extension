// Pure helpers for the GitHub triage tool (cli.mjs): the [github] table of the local state file,
// the shaping of an issue/comment delta, the stale-issue decision and the Chrome Web Store
// version check. Nothing here touches the network, the file system or the clock — the caller
// passes `now` — so every decision is unit-tested in lib.test.mjs.

const DAY_MS = 24 * 60 * 60 * 1000;
const TABLE = 'github';

// --- state file: a minimal TOML subset -------------------------------------------------------
// Only `[table]` headers and `key = "string"` lines inside [github] are understood; everything
// else in the file belongs to someone else and is passed through untouched.

const HEADER = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:#.*)?$/;
const STRING_KEY = /^\s*([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/;

const unescape = (s) => s.replace(/\\(["\\])/g, '$1');
const escape = (s) => String(s).replace(/(["\\])/g, '\\$1');

/** The line ranges of [github]: header index and the index after its last line. */
function githubTableRange(lines) {
  const start = lines.findIndex((line) => HEADER.exec(line)?.[1] === TABLE);
  if (start < 0) return null;
  const next = lines.findIndex((line, i) => i > start && HEADER.test(line));
  return { start, end: next < 0 ? lines.length : next };
}

/** The string keys of the [github] table, as a plain object; {} when the table is absent. */
export function readGithubState(text) {
  const lines = (text || '').split('\n');
  const range = githubTableRange(lines);
  if (!range) return {};
  const state = {};
  for (const line of lines.slice(range.start + 1, range.end)) {
    const m = STRING_KEY.exec(line);
    if (m) state[m[1]] = unescape(m[2]);
  }
  return state;
}

/**
 * `text` with each key of `updates` set inside [github]; the table is appended when missing.
 * Lines outside the edited keys keep their bytes, so other tools' tables and comments survive.
 */
export function upsertGithubState(text, updates) {
  const source = text || '';
  const lines = source.split('\n');
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  let range = githubTableRange(lines);
  if (!range) {
    // A trailing newline splits into a final '' — insert before it so the file still ends in one.
    const tail = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    const block = [...(tail > 0 && lines[tail - 1].trim() !== '' ? [''] : []), `[${TABLE}]`];
    lines.splice(tail, 0, ...block);
    range = { start: tail + block.length - 1, end: tail + block.length };
  }
  for (const [key, value] of entries) {
    const line = `${key} = "${escape(value)}"`;
    const at = lines.findIndex((l, i) => i > range.start && i < range.end && STRING_KEY.exec(l)?.[1] === key);
    if (at >= 0) { lines[at] = line; continue; }
    // A new key goes after the table's last non-blank line, so blank separators stay below it.
    let insert = range.end;
    while (insert > range.start + 1 && lines[insert - 1].trim() === '') insert -= 1;
    lines.splice(insert, 0, line);
    range = { start: range.start, end: range.end + 1 };
  }
  return lines.join('\n');
}

// --- gh output ------------------------------------------------------------------------------

/**
 * The items of `gh api --paginate` output. gh before 2.48 has no --slurp and prints one JSON
 * array per page back to back (`[...][...]`), so the pages are split by bracket depth, with
 * string contents skipped, and concatenated.
 */
export function parsePaginated(text) {
  const items = [];
  let depth = 0;
  let inString = false;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') { if (depth === 0) start = i; depth += 1; }
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const page = JSON.parse(text.slice(start, i + 1));
        if (Array.isArray(page)) items.push(...page); else items.push(page);
      }
    }
  }
  if (depth !== 0 || inString) throw new Error(`gh output is truncated JSON (depth ${depth} at end)`);
  return items;
}

/** The issue number at the end of a comment's `issue_url`. */
export function issueNumberFromUrl(url) {
  const m = /\/issues\/(\d+)$/.exec(url || '');
  if (!m) throw new Error(`comment issue_url has no issue number: ${url}`);
  return Number(m[1]);
}

/** `months` calendar months before `now`, as an ISO-8601 UTC string. */
export function monthsBefore(now, months) {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

// --- delta ----------------------------------------------------------------------------------

const labelNames = (issue) => (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
const login = (user) => user?.login ?? null;

const shapeIssue = (issue, since) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  state_reason: issue.state_reason ?? null,
  labels: labelNames(issue),
  author: login(issue.user),
  created_at: issue.created_at,
  updated_at: issue.updated_at,
  closed_at: issue.closed_at ?? null,
  url: issue.html_url,
  body: issue.body ?? '',
  is_new: Date.parse(issue.created_at) >= Date.parse(since),
});

const shapeComment = (comment, owner) => ({
  id: comment.id,
  issue: issueNumberFromUrl(comment.issue_url),
  author: login(comment.user),
  own: login(comment.user) === owner,
  created_at: comment.created_at,
  updated_at: comment.updated_at,
  edited: comment.updated_at !== comment.created_at,
  url: comment.html_url,
  body: comment.body ?? '',
});

const byNumber = (a, b) => a.number - b.number;

/**
 * The triage delta: issues created within the horizon (enhancements set aside as `skipped`),
 * their comments, and the pull requests, from raw GitHub REST items.
 */
export function shapeDelta(rawIssues, rawComments, { since, horizon, owner }) {
  const horizonMs = Date.parse(horizon);
  const unique = [...new Map(rawIssues.map((i) => [i.number, i])).values()];
  const prs = unique.filter((i) => i.pull_request).sort(byNumber).map((i) => ({
    number: i.number, title: i.title, state: i.state, author: login(i.user), url: i.html_url, updated_at: i.updated_at,
  }));
  const recent = unique.filter((i) => !i.pull_request && Date.parse(i.created_at) >= horizonMs);
  const isEnhancement = (i) => labelNames(i).includes('enhancement');
  const skipped = recent.filter(isEnhancement).sort(byNumber).map((i) => ({
    number: i.number, title: i.title, labels: labelNames(i), reason: 'enhancement', url: i.html_url,
  }));
  const issues = recent.filter((i) => !isEnhancement(i)).sort(byNumber).map((i) => shapeIssue(i, since));
  const kept = new Set(issues.map((i) => i.number));
  const comments = rawComments.map((c) => shapeComment(c, owner)).filter((c) => kept.has(c.issue))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return { issues, comments, prs, skipped };
}

// --- stale ----------------------------------------------------------------------------------

const latest = (dates) => dates.reduce((max, d) => (max === null || Date.parse(d) > Date.parse(max) ? d : max), null);

/** One issue's quiet-time record: when the reporter side last spoke, and the owner's last word. */
function quietRecord(issue, comments, { owner, now }) {
  const others = comments.filter((c) => login(c.user) !== owner).map((c) => c.created_at);
  const last = latest([issue.created_at, ...others]);
  return {
    number: issue.number,
    title: issue.title,
    labels: labelNames(issue),
    url: issue.html_url,
    last_reporter_activity: last,
    last_owner_comment: latest(comments.filter((c) => login(c.user) === owner).map((c) => c.created_at)),
    days_quiet: Math.floor((Date.parse(now) - Date.parse(last)) / DAY_MS),
  };
}

/**
 * Split labelled open issues into `candidates` (no one but the owner spoke for more than `days`)
 * and `fresh`. Input: [{ issue, comments }] with raw GitHub REST items.
 */
export function staleCandidates(issuesWithComments, { owner, days, now }) {
  const records = issuesWithComments.map(({ issue, comments }) => quietRecord(issue, comments, { owner, now }))
    .sort(byNumber);
  return {
    candidates: records.filter((r) => r.days_quiet > days),
    fresh: records.filter((r) => r.days_quiet <= days),
  };
}

/** Whether a raw issue carries any of `labels`. */
export const hasAnyLabel = (issue, labels) => labelNames(issue).some((name) => labels.includes(name));

// --- Chrome Web Store -----------------------------------------------------------------------

/** The published version on a Chrome Web Store detail page. */
export function parseStoreVersion(html) {
  const visible = />Version<\/div><div[^>]*>([^<]+)</.exec(html);
  if (visible) return visible[1].trim();
  // The page also embeds the manifest as an escaped JSON string inside a script.
  const embedded = /\\"version\\":\s*\\"([0-9][0-9.]*)\\"/.exec(html);
  if (embedded) return embedded[1];
  throw new Error('Chrome Web Store page has neither a "Version" field nor an embedded manifest version');
}

/** Numeric dotted comparison: negative, 0 or positive, as for Array.prototype.sort. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** The store/manifest comparison the `store` command reports. */
export function storeStatus(storeVersion, manifestVersion, lastNotified) {
  return {
    store_version: storeVersion,
    manifest_version: manifestVersion,
    last_notified_version: lastNotified ?? null,
    published: storeVersion === manifestVersion,
    notify_pending: !lastNotified || compareVersions(storeVersion, lastNotified) > 0,
  };
}
