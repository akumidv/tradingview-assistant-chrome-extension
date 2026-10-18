#!/usr/bin/env node
// GitHub triage for this extension's repository, for an agent that answers issues on the
// owner's behalf. It only reads: issues, comments and pull requests through the `gh` CLI (the
// owner's own sign-in, so no token lives here), and the published version from the Chrome Web
// Store page. Every command prints JSON to stdout; the agent decides what to post, and the owner
// posts it — nothing here comments, closes or labels.
//
// What was already seen is remembered in the [github] table of the local state file
// _aitna/.akmon.local.toml (TV_GITHUB_STATE overrides the path, e.g. for a test copy):
// `last_sync` is where the next `delta` starts, `last_notified_version` the store version the
// issues were last told about, `repo` an optional owner/name override. Only `mark` writes it.
//
// The decisions (what is in the window, what counts as stale, which version is newer) are pure
// functions in lib.mjs, tested in lib.test.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  hasAnyLabel, issueNumberFromUrl, monthsBefore, parsePaginated, parseStoreVersion, readGithubState, shapeDelta,
  staleCandidates, storeStatus, upsertGithubState,
} from './lib.mjs';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TOOL_DIR, '..', '..', '..');
const STATE_FILE = process.env.TV_GITHUB_STATE || join(PROJECT_ROOT, '_aitna', '.akmon.local.toml');
const MANIFEST = join(PROJECT_ROOT, 'extension', 'manifest.json');
const DEFAULT_MONTHS = 3; // owner decision: only issues of the last three months are triaged for now
const DEFAULT_DAYS = 14;
const DEFAULT_LABELS = ['review', 'insufficient description', 'Done'];
const DEFAULT_STORE_ID = 'pfbdfjaonemppanfnlmliafffahlohfg';
// The store serves a stripped page without the version to clients it does not take for a browser.
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

class UsageError extends Error {}

const print = (value) => console.log(JSON.stringify(value, null, 2));

/** Run gh and return its stdout; a failure keeps gh's own message. */
function gh(args) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('gh CLI not found on PATH; install it and run `gh auth login`');
    throw new Error(`gh ${args.join(' ')} failed: ${(error.stderr || error.message).trim()}`, { cause: error });
  }
}

/** Every item of a paginated REST list (gh 2.46 has no --slurp; lib splits the pages). */
const ghList = (path) => parsePaginated(gh(['api', '--paginate', path]));
const ghGet = (path) => JSON.parse(gh(['api', path]));

const readStateText = () => (existsSync(STATE_FILE) ? readFileSync(STATE_FILE, 'utf8') : '');
const readState = () => readGithubState(readStateText());

const resolveRepo = (state) => state.repo
  || gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
const ownerLogin = () => gh(['api', 'user', '--jq', '.login']).trim();

/** An ISO-8601 option value, normalised to UTC; `now` is accepted where the flag says so. */
function isoOption(value, name, { allowNow = false } = {}) {
  if (allowNow && value === 'now') return new Date().toISOString();
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new UsageError(`--${name} is not an ISO-8601 date: ${value}`);
  return new Date(ms).toISOString();
}

function positiveNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new UsageError(`--${name} must be a positive number: ${value}`);
  return n;
}

/** The issues a comment refers to but the issue listing missed (guard: a comment updates the issue). */
function missingIssues(rawIssues, rawComments, repo) {
  const known = new Set(rawIssues.map((i) => i.number));
  const wanted = new Set(rawComments.map((c) => issueNumberFromUrl(c.issue_url)));
  return [...wanted].filter((n) => !known.has(n)).map((n) => ghGet(`repos/${repo}/issues/${n}`));
}

const commands = {
  delta: {
    help: '[--since ISO] [--months 3]  issues, comments and PRs updated since the last sync',
    options: { since: { type: 'string' }, months: { type: 'string' } },
    run(v) {
      const state = readState();
      const now = new Date().toISOString();
      const months = v.months ? positiveNumber(v.months, 'months') : DEFAULT_MONTHS;
      const horizon = monthsBefore(now, months);
      const since = v.since ? isoOption(v.since, 'since') : (state.last_sync || horizon);
      const repo = resolveRepo(state);
      const owner = ownerLogin();
      const rawIssues = ghList(`repos/${repo}/issues?state=all&since=${since}&per_page=100`);
      const rawComments = ghList(`repos/${repo}/issues/comments?since=${since}&per_page=100`);
      const allIssues = [...rawIssues, ...missingIssues(rawIssues, rawComments, repo)];
      print({ repo, owner, since, now, horizon, ...shapeDelta(allIssues, rawComments, { since, horizon, owner }) });
    },
  },
  stale: {
    help: '[--days 14] [--label L ...] [--all]  labelled open issues whose reporter went quiet',
    options: { days: { type: 'string' }, label: { type: 'string', multiple: true }, all: { type: 'boolean' } },
    run(v) {
      const state = readState();
      const now = new Date().toISOString();
      const days = v.days ? positiveNumber(v.days, 'days') : DEFAULT_DAYS;
      const labels = v.label?.length ? v.label : DEFAULT_LABELS;
      const horizonMs = Date.parse(monthsBefore(now, DEFAULT_MONTHS));
      const repo = resolveRepo(state);
      const owner = ownerLogin();
      const open = ghList(`repos/${repo}/issues?state=open&per_page=100`)
        .filter((i) => !i.pull_request && hasAnyLabel(i, labels))
        .filter((i) => v.all || Date.parse(i.created_at) >= horizonMs);
      const withComments = open.map((issue) => ({ issue, comments: ghList(`repos/${repo}/issues/${issue.number}/comments?per_page=100`) }));
      print({ repo, days, ...staleCandidates(withComments, { owner, days, now }) });
    },
  },
  store: {
    help: '[--id ID]  published Chrome Web Store version vs extension/manifest.json',
    options: { id: { type: 'string' } },
    async run(v) {
      const url = `https://chromewebstore.google.com/detail/tradingview-assistant/${v.id || DEFAULT_STORE_ID}`;
      const response = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en' } });
      if (!response.ok) throw new Error(`Chrome Web Store answered ${response.status} for ${url}`);
      const storeVersion = parseStoreVersion(await response.text());
      const manifestVersion = JSON.parse(readFileSync(MANIFEST, 'utf8')).version;
      print(storeStatus(storeVersion, manifestVersion, readState().last_notified_version));
    },
  },
  mark: {
    help: '[--sync ISO|now] [--notified VERSION]  record the sync point / notified version',
    options: { sync: { type: 'string' }, notified: { type: 'string' } },
    run(v) {
      if (!v.sync && !v.notified) throw new UsageError('mark needs --sync and/or --notified');
      const updates = {
        last_sync: v.sync ? isoOption(v.sync, 'sync', { allowNow: true }) : undefined,
        last_notified_version: v.notified,
      };
      const text = upsertGithubState(readStateText(), updates);
      writeFileSync(STATE_FILE, text);
      print(readGithubState(text));
    },
  },
  state: {
    help: 'the repository and the [github] state',
    options: {},
    run() {
      const state = readState();
      print({ repo: resolveRepo(state), ...state });
    },
  },
};

function usage() {
  console.error('usage: node _aitna/tools/github/cli.mjs <command> [options]');
  for (const [n, c] of Object.entries(commands)) console.error(`  ${n.padEnd(6)} ${c.help}`);
}

async function main(argv) {
  const [name, ...rest] = argv;
  const command = commands[name];
  if (!command) throw new UsageError(name ? `unknown command: ${name}` : 'no command given');
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: command.options });
  } catch (error) {
    throw new UsageError(error.message, { cause: error });
  }
  await command.run(parsed.values);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // exitCode, not process.exit(): exiting at once would cut off a large JSON still flushing to a pipe.
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    if (error instanceof UsageError) usage();
    process.exitCode = 1;
  });
}
