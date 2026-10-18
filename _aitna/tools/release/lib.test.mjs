// Unit tests for the release tool's pure helpers: npm run test:tools
// The real store key is never used here (it is never committed); keys are generated in-test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  extensionIdFromKey, isKeyOnlyDiff, manifestReferencedFiles, parseCsv, parseResultsFileName, parseUpdateCheckVersion,
  topChangelogVersion, verifyConsoleLog, verifyResultsCsv,
} from './lib.mjs';

// --- extension ID ---

test('extensionIdFromKey yields 32 letters a-p, deterministically, for a generated RSA key', () => {
  const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'der' } });
  const key = publicKey.toString('base64');
  const id = extensionIdFromKey(key);
  assert.match(id, /^[a-p]{32}$/);
  assert.equal(extensionIdFromKey(key), id);
});

test('extensionIdFromKey matches a hand-mapped SHA-256 of the decoded bytes', () => {
  const key = Buffer.from('abc').toString('base64'); // 'YWJj'
  // sha256('abc') = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
  assert.equal(createHash('sha256').update('abc').digest('hex').slice(0, 32), 'ba7816bf8f01cfea414140de5dae2223');
  // b→l a→k 7→h 8→i 1→b 6→g b→l f→p 8→i f→p 0→a 1→b c→m f→p e→o a→k
  // 4→e 1→b 4→e 1→b 4→e 0→a d→n e→o 5→f d→n a→k e→o 2→c 2→c 2→c 3→d
  assert.equal(extensionIdFromKey(key), 'lkhibglpipabmpokebebeanofnkocccd');
});

// --- update server ---

const updateXml = ({ appid = 'X', appStatus = 'ok', checkStatus = 'ok', version = '2.13.2' } = {}) => '<?xml version="1.0" '
  + 'encoding="UTF-8"?><gupdate xmlns="http://www.google.com/update2/response" protocol="2.0" server="prod">'
  + `<daystart elapsed_days="7226"/><app appid="${appid}" cohort="1::" status="${appStatus}">`
  + `<updatecheck codebase="https://example.invalid/x.crx" size="1" status="${checkStatus}"`
  + `${version ? ` version="${version}"` : ''}/></app></gupdate>`;

test('parseUpdateCheckVersion reads the version of the asked app', () => {
  assert.equal(parseUpdateCheckVersion(updateXml(), 'X'), '2.13.2');
});

test('parseUpdateCheckVersion rejects a different appid', () => {
  assert.throws(() => parseUpdateCheckVersion(updateXml({ appid: 'Y' }), 'X'), /no <app appid="X">/);
});

test('parseUpdateCheckVersion rejects a noupdate or error status', () => {
  assert.throws(() => parseUpdateCheckVersion(updateXml({ checkStatus: 'noupdate', version: '' }), 'X'), /"noupdate"/);
  assert.throws(() => parseUpdateCheckVersion(updateXml({ appStatus: 'error-unknownApplication' }), 'X'),
    /error-unknownApplication/);
});

test('parseUpdateCheckVersion rejects an ok updatecheck without a version', () => {
  assert.throws(() => parseUpdateCheckVersion(updateXml({ version: '' }), 'X'), /no version/);
});

// --- changelog ---

test('topChangelogVersion takes the first version heading', () => {
  const text = '# Changelog\n\nIntro.\n\n## 2.14.0\n- a\n\n### Details\n- b\n\n## 2.13.2\n- c\n';
  assert.equal(topChangelogVersion(text), '2.14.0');
});

test('topChangelogVersion fails without a version heading', () => {
  assert.throws(() => topChangelogVersion('# Changelog\n\n### Details\n'), /no "## <version>" heading/);
});

// --- manifest ---

const manifest = {
  manifest_version: 3,
  version: '2.14.0',
  key: 'K',
  icons: { 16: 'images/a.png', 32: 'images/b.png' },
  action: { default_icon: { 16: 'images/a.png' }, default_popup: 'popup/p.html' },
  content_scripts: [{ js: ['cs/one.js', 'cs/two.js'], css: ['cs/s.css'] }, { js: ['cs/one.js'] }],
  web_accessible_resources: [{ resources: ['page.js', 'fonts/*.woff2'], matches: ['<all_urls>'] }],
};

test('manifestReferencedFiles collects unique files and sets globs aside', () => {
  assert.deepEqual(manifestReferencedFiles(manifest), {
    files: ['cs/one.js', 'cs/s.css', 'cs/two.js', 'images/a.png', 'images/b.png', 'page.js', 'popup/p.html'],
    globs: ['fonts/*.woff2'],
  });
});

test('manifestReferencedFiles accepts a string action icon and an empty manifest', () => {
  assert.deepEqual(manifestReferencedFiles({ action: { default_icon: '/i.png' } }), { files: ['i.png'], globs: [] });
  assert.deepEqual(manifestReferencedFiles({}), { files: [], globs: [] });
});

// --- git diff ---

test('isKeyOnlyDiff accepts a diff that only adds the key over a blank line', () => {
  const diff = 'diff --git a/m b/m\n--- a/m\n+++ b/m\n@@ -4,7 +4,7 @@\n "version": "1",\n-    \n+    "key": "K",\n';
  assert.equal(isKeyOnlyDiff(diff), true);
});

test('isKeyOnlyDiff rejects other changes and an empty diff', () => {
  assert.equal(isKeyOnlyDiff('--- a/m\n+++ b/m\n@@\n-  "version": "1",\n+  "version": "2",\n+  "key": "K",\n'), false);
  assert.equal(isKeyOnlyDiff(''), false);
});

// --- verify: CSV ---

test('parseCsv reads quoted fields, escaped quotes, commas and newlines inside quotes', () => {
  const text = 'a,"b,c","say ""hi"""\r\n1,"two\nlines",\n';
  assert.deepEqual(parseCsv(text), [['a', 'b,c', 'say "hi"'], ['1', 'two\nlines', '']]);
});

test('parseCsv keeps empty fields and a last line without a newline', () => {
  assert.deepEqual(parseCsv(',,x\n"",y'), [['', '', 'x'], ['', 'y']]);
});

test('parseCsv rejects an unterminated quote', () => {
  assert.throws(() => parseCsv('a,"b\n'), /inside a quoted field/);
});

// --- verify: results file name ---

test('parseResultsFileName reads the extension file names, with or without a repeat suffix', () => {
  assert.deepEqual(parseResultsFileName('SPX_1D MACD Strategy - 5_max_Total PnL_random (6).csv'),
    { cycles: 5, direction: 'max', optParamName: 'Total PnL', method: 'random', deep: false });
  assert.deepEqual(parseResultsFileName('SPX_1D MACD Strategy - 5_max_Max drawdown_random.csv'),
    { cycles: 5, direction: 'max', optParamName: 'Max drawdown', method: 'random', deep: false });
  assert.deepEqual(parseResultsFileName('BTCUSD_1h deep backtesting X - 20_min_Max drawdown %_sequential.csv'),
    { cycles: 20, direction: 'min', optParamName: 'Max drawdown %', method: 'sequential', deep: true });
});

test('parseResultsFileName throws on a name the extension does not write', () => {
  assert.throws(() => parseResultsFileName('report.csv'), /"report.csv" is not a results file name/);
});

// --- verify: results CSV ---

const REQUIRED = ['comment', '_setTime_', '_parseTime_', 'Total PnL', 'Total PnL %', 'Max drawdown', 'Max drawdown %',
  'Profit factor', 'Profitable trades', 'Sharpe ratio', 'Sortino ratio'];
const HEADER = [...REQUIRED, '__Fast', '__Slow'];
const quote = (cell) => `"${String(cell).replaceAll('"', '""')}"`;
const csv = (header, rows) => `${[header, ...rows].map((r) => r.map(quote).join(',')).join('\n')}\n`;
const row = (comment, { pnl = 100, fast = 2, slow = 6 } = {}) => [comment, 0.1, 0.2, pnl, 1.5, -50, -0.5, 1.2, 40, 0.3, 0.4,
  fast, slow];
const separator = () => HEADER.map((name) => (name === 'comment' ? 'Bellow filtered results of tests' : ''));
const OPTS = { cycles: 2, optParamName: 'Total PnL' };
const goodRows = () => [row('Current parameters.'), row('All parameters are changed randomly'), row('All parameters are changed randomly')];
const byName = (checks) => Object.fromEntries(checks.map((c) => [c.name, c]));
const failed = (checks) => checks.filter((c) => c.ok === false).map((c) => c.name);

test('verifyResultsCsv passes a good file', () => {
  const checks = verifyResultsCsv(csv(HEADER, goodRows()), OPTS);
  assert.deepEqual(failed(checks), []);
  assert.deepEqual(checks.map((c) => c.name), ['results.data', 'results.columns', 'results.row-shape', 'results.row-count',
    'results.first-row', 'results.values', 'results.row-errors', 'results.no-trades']);
  assert.equal(checks.some((c) => c.warn), false);
});

test('verifyResultsCsv fails "There is no data for conversion" and a header-only file', () => {
  assert.deepEqual(failed(verifyResultsCsv('There is no data for conversion', OPTS)), ['results.data']);
  assert.deepEqual(failed(verifyResultsCsv(csv(HEADER, []), OPTS)), ['results.data']);
});

test('verifyResultsCsv names a missing column', () => {
  const header = HEADER.filter((name) => name !== 'Sharpe ratio');
  const rows = goodRows().map((r) => r.filter((_, i) => HEADER[i] !== 'Sharpe ratio'));
  const checks = byName(verifyResultsCsv(csv(header, rows), OPTS));
  assert.equal(checks['results.columns'].ok, false);
  assert.match(checks['results.columns'].detail, /missing: Sharpe ratio$/);
});

test('verifyResultsCsv requires an optimized parameter column and a __ parameter', () => {
  const header = HEADER.map((name) => name.replace(/^__/, ''));
  const checks = byName(verifyResultsCsv(csv(header, goodRows()), { cycles: 2, optParamName: 'Net profit' }));
  assert.match(checks['results.columns'].detail, /Net profit, __<strategy parameter>/);
  assert.equal(checks['results.values'].ok, false);
});

test('verifyResultsCsv fails a wrong row count and a misshapen row', () => {
  const checks = byName(verifyResultsCsv(csv(HEADER, goodRows()), { ...OPTS, cycles: 5 }));
  assert.equal(checks['results.row-count'].ok, false);
  assert.match(checks['results.row-count'].detail, /expected 6 .*found 3 tested sets/);
  const short = csv(HEADER, goodRows()).replace(/\n$/, ',"extra"\n');
  assert.match(byName(verifyResultsCsv(short, OPTS))['results.row-shape'].detail, /^rows not of 13 columns: 3 \(14\)$/);
});

test('verifyResultsCsv counts filtered rows below the separator, but not the separator', () => {
  const rows = [row('Current parameters.'), separator(), row('All parameters are changed randomly', { pnl: '' }),
    row('All parameters are changed randomly', { slow: '' })];
  const checks = byName(verifyResultsCsv(csv(HEADER, rows), OPTS));
  assert.deepEqual(failed(Object.values(checks)), []);
  assert.match(checks['results.row-count'].detail, /found 3 tested sets \(2 of them filtered\)/);
  assert.match(checks['results.values'].detail, /^1 tested rows/);
});

test('verifyResultsCsv fails when no tested row above the separator has values', () => {
  const rows = [row('Current parameters.', { pnl: '—' }), separator(), row('x'), row('y')];
  assert.deepEqual(failed(verifyResultsCsv(csv(HEADER, rows), OPTS)), ['results.values']);
});

test('verifyResultsCsv fails a first row without the current parameters', () => {
  const rows = goodRows();
  rows[0][0] = 'All parameters are changed randomly';
  assert.deepEqual(failed(verifyResultsCsv(csv(HEADER, rows), OPTS)), ['results.first-row']);
});

test('verifyResultsCsv fails a row with an error comment', () => {
  const rows = goodRows();
  rows[2][0] = 'The tradingview error occurred when calculating strategy: something';
  const checks = byName(verifyResultsCsv(csv(HEADER, rows), OPTS));
  assert.deepEqual(failed(Object.values(checks)), ['results.row-errors']);
  assert.match(checks['results.row-errors'].detail, /^rows with an error comment: 3: The tradingview error occurred/);
});

test('verifyResultsCsv only warns about rows without trades', () => {
  const rows = goodRows();
  rows[1][0] = 'No trades for these parameters (TradingView: "Not enough data to show")All parameters are changed randomly';
  const checks = verifyResultsCsv(csv(HEADER, rows), OPTS);
  assert.deepEqual(failed(checks), []);
  const noTrades = byName(checks)['results.no-trades'];
  assert.equal(noTrades.warn, true);
  assert.match(noTrades.detail, /^1 rows without trades/);
});

// --- verify: console log ---

const LOG_OK = ['listening to https://www.tradingview.com/chart/x/', '[page] error: TradingView own failure',
  '[extension] log: [tv-assistant] start', '[other] log: noise', '[extension] log: [tv-assistant] All done: 6 tests'].join('\n');

test('verifyConsoleLog passes a clean log that reached All done', () => {
  const checks = verifyConsoleLog(LOG_OK);
  assert.deepEqual(failed(checks), []);
  assert.deepEqual(checks.map((c) => c.name), ['log.captured', 'log.finished', 'log.no-errors', 'log.warnings', 'log.page-errors']);
  assert.match(byName(checks)['log.page-errors'].detail, /^1 errors/);
});

test('verifyConsoleLog fails an extension error and an uncaught exception, and warns about a warning', () => {
  const checks = byName(verifyConsoleLog(`${LOG_OK}\n[extension] error: [tv-assistant] boom\n`
    + '[extension] uncaught: TypeError: x is undefined\n[extension] warning: slow'));
  assert.deepEqual(failed(Object.values(checks)), ['log.no-errors']);
  assert.match(checks['log.no-errors'].detail, /^2 extension errors: .*boom; .*TypeError/);
  assert.equal(checks['log.warnings'].warn, true);
});

test('verifyConsoleLog passes page errors only, and fails a log of another tab or an unfinished run', () => {
  assert.deepEqual(failed(verifyConsoleLog(`${LOG_OK}\n[page] uncaught: Error: tv\n[page] error: tv2`)), []);
  assert.deepEqual(failed(verifyConsoleLog('[page] error: tv\n[other] log: x')), ['log.captured', 'log.finished']);
  assert.deepEqual(failed(verifyConsoleLog('[extension] log: started')), ['log.finished']);
  assert.deepEqual(failed(verifyConsoleLog('')), ['log.captured', 'log.finished']);
});
