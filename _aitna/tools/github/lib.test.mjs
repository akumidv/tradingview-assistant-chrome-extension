// Unit tests for the GitHub triage tool's pure helpers: node --test _aitna/tools/github/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareVersions, hasAnyLabel, issueNumberFromUrl, monthsBefore, parsePaginated, parseStoreVersion,
  readGithubState, shapeDelta, staleCandidates, storeStatus, upsertGithubState,
} from './lib.mjs';

const REPO_URL = 'https://api.github.com/repos/o/r/issues';

const issue = (number, extra = {}) => ({
  number, title: `t${number}`, state: 'open', state_reason: null, labels: [], user: { login: 'reporter' },
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', closed_at: null,
  html_url: `https://github.com/o/r/issues/${number}`, body: 'b', ...extra,
});
const comment = (id, number, login, created, updated = created) => ({
  id, issue_url: `${REPO_URL}/${number}`, user: { login }, created_at: created, updated_at: updated,
  html_url: `https://github.com/o/r/issues/${number}#issuecomment-${id}`, body: 'c',
});

// --- state file ---

test('readGithubState reads only string keys of [github]', () => {
  const text = '# top\n[other]\nlast_sync = "x"\n[github]\nrepo = "o/r"\nlast_sync = "2026-10-01T00:00:00.000Z" # c\nn = 3\n';
  assert.deepEqual(readGithubState(text), { repo: 'o/r', last_sync: '2026-10-01T00:00:00.000Z' });
});

test('readGithubState is empty without the table or the file', () => {
  assert.deepEqual(readGithubState(''), {});
  assert.deepEqual(readGithubState('[a]\nk = "v"\n'), {});
});

test('upsertGithubState creates the table in an empty file', () => {
  assert.equal(upsertGithubState('', { last_sync: 's' }), '[github]\nlast_sync = "s"\n');
});

test('upsertGithubState appends the table and keeps other content byte-for-byte', () => {
  const text = '# keep me\n[akmon]\nmode = "x"  # comment\n';
  const out = upsertGithubState(text, { last_notified_version: '2.14.0' });
  assert.equal(out, `${text}\n[github]\nlast_notified_version = "2.14.0"\n`);
});

test('upsertGithubState appends after a file without a trailing newline', () => {
  assert.equal(upsertGithubState('a = "1"', { repo: 'o/r' }), 'a = "1"\n\n[github]\nrepo = "o/r"');
});

test('upsertGithubState replaces existing keys in place and adds new ones inside the table', () => {
  const text = '[github]\nrepo = "o/r"\nlast_sync = "old"\n\n[next]\nlast_sync = "untouched"\n';
  const out = upsertGithubState(text, { last_sync: 'new', last_notified_version: '1.0' });
  assert.equal(out, '[github]\nrepo = "o/r"\nlast_sync = "new"\nlast_notified_version = "1.0"\n\n[next]\nlast_sync = "untouched"\n');
  assert.deepEqual(readGithubState(out), { repo: 'o/r', last_sync: 'new', last_notified_version: '1.0' });
});

test('upsertGithubState skips undefined updates and escapes quotes', () => {
  const out = upsertGithubState('[github]\n', { last_sync: undefined, repo: 'a"b' });
  assert.equal(out, '[github]\nrepo = "a\\"b"\n');
  assert.deepEqual(readGithubState(out), { repo: 'a"b' });
});

// --- gh output ---

test('parsePaginated joins back-to-back page arrays, ignoring brackets in strings', () => {
  const text = '[{"a":"x]["},{"b":1}][{"c":"\\"]"}]\n[]';
  assert.deepEqual(parsePaginated(text), [{ a: 'x][' }, { b: 1 }, { c: '"]' }]);
  assert.deepEqual(parsePaginated(''), []);
});

test('parsePaginated throws on truncated output', () => {
  assert.throws(() => parsePaginated('[{"a":1}'), /truncated/);
});

test('issueNumberFromUrl reads the trailing number and throws otherwise', () => {
  assert.equal(issueNumberFromUrl(`${REPO_URL}/42`), 42);
  assert.throws(() => issueNumberFromUrl('https://x/pulls'), /no issue number/);
});

test('monthsBefore subtracts calendar months in UTC', () => {
  assert.equal(monthsBefore('2026-10-14T12:00:00.000Z', 3), '2026-07-14T12:00:00.000Z');
});

// --- delta ---

test('shapeDelta filters by horizon, splits PRs and enhancements, keeps comments of kept issues', () => {
  const since = '2026-10-01T00:00:00.000Z';
  const horizon = '2026-07-14T00:00:00.000Z';
  const raw = [
    issue(5, { created_at: '2026-10-05T00:00:00Z', labels: [{ name: 'bug' }] }),
    issue(2),
    issue(1, { created_at: '2025-01-01T00:00:00Z' }), // before horizon: ignored entirely
    issue(3, { labels: [{ name: 'enhancement' }] }),
    issue(4, { pull_request: {} }),
    issue(2), // a duplicate from a page boundary
  ];
  const comments = [
    comment(11, 5, 'owner', '2026-10-06T00:00:00Z'),
    comment(10, 2, 'reporter', '2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'),
    comment(12, 1, 'reporter', '2026-10-02T00:00:00Z'),
    comment(13, 3, 'reporter', '2026-10-02T00:00:00Z'),
  ];
  const delta = shapeDelta(raw, comments, { since, horizon, owner: 'owner' });
  assert.deepEqual(delta.issues.map((i) => [i.number, i.is_new]), [[2, false], [5, true]]);
  assert.deepEqual(delta.issues[1].labels, ['bug']);
  assert.equal(delta.issues[0].author, 'reporter');
  assert.deepEqual(delta.prs.map((p) => p.number), [4]);
  assert.deepEqual(delta.skipped, [{ number: 3, title: 't3', labels: ['enhancement'], reason: 'enhancement', url: 'https://github.com/o/r/issues/3' }]);
  assert.deepEqual(delta.comments.map((c) => [c.id, c.issue, c.own, c.edited]), [[10, 2, false, true], [11, 5, true, false]]);
});

// --- stale ---

test('staleCandidates measures quiet time from the reporter side only', () => {
  const now = '2026-10-14T00:00:00.000Z';
  const input = [
    { issue: issue(7, { created_at: '2026-09-01T00:00:00Z' }), comments: [
      comment(1, 7, 'reporter', '2026-09-20T00:00:00Z'),
      comment(2, 7, 'owner', '2026-10-10T00:00:00Z'), // the owner's own ping does not reset the clock
    ] },
    { issue: issue(6, { created_at: '2026-10-05T00:00:00Z' }), comments: [] },
  ];
  const { candidates, fresh } = staleCandidates(input, { owner: 'owner', days: 14, now });
  assert.deepEqual(candidates, [{
    number: 7, title: 't7', labels: [], url: 'https://github.com/o/r/issues/7',
    last_reporter_activity: '2026-09-20T00:00:00Z', last_owner_comment: '2026-10-10T00:00:00Z', days_quiet: 24,
  }]);
  assert.deepEqual(fresh.map((r) => [r.number, r.days_quiet, r.last_owner_comment]), [[6, 9, null]]);
});

test('hasAnyLabel matches label names', () => {
  assert.equal(hasAnyLabel(issue(1, { labels: [{ name: 'Done' }] }), ['review', 'Done']), true);
  assert.equal(hasAnyLabel(issue(1), ['review']), false);
});

// --- store ---

test('parseStoreVersion reads the visible Version field', () => {
  assert.equal(parseStoreVersion('<div class="a">Version</div><div class="b">2.14.0</div>'), '2.14.0');
});

test('parseStoreVersion falls back to the embedded manifest', () => {
  assert.equal(parseStoreVersion('x = "{\\"name\\": \\"n\\", \\"version\\": \\"2.13.2\\"}"'), '2.13.2');
});

test('parseStoreVersion throws when neither pattern matches', () => {
  assert.throws(() => parseStoreVersion('<html></html>'), /neither/);
});

test('compareVersions compares numerically, padding missing parts', () => {
  assert.equal(compareVersions('2.10.0', '2.9.9'), 1);
  assert.equal(compareVersions('2.14', '2.14.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
});

test('storeStatus flags publication and a pending notification', () => {
  assert.deepEqual(storeStatus('2.14.0', '2.14.0', '2.13.2'), {
    store_version: '2.14.0', manifest_version: '2.14.0', last_notified_version: '2.13.2', published: true, notify_pending: true,
  });
  assert.equal(storeStatus('2.14.0', '2.15.0', '2.14.0').notify_pending, false);
  assert.equal(storeStatus('2.14.0', '2.15.0', undefined).notify_pending, true);
  assert.equal(storeStatus('2.14.0', '2.15.0', undefined).last_notified_version, null);
});
