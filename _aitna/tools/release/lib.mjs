// Pure helpers for the release tool (cli.mjs): the extension ID a manifest key yields, the
// published version in a Chrome update-server answer, the top CHANGELOG.md version, the files a
// manifest references, the reading of a git diff, and the `verify` gate of a browser test run —
// the results CSV the extension saved and the console log captured meanwhile. Nothing here
// touches the network or the file system, so every decision is unit-tested in lib.test.mjs.
import { createHash } from 'node:crypto';

const A_CODE = 'a'.charCodeAt(0);

/** A passed check: `{ name, ok: true, detail }`, the shape every release command prints. */
export const pass = (name, detail) => ({ name, ok: true, detail });
/** A failed check: it fails the command (exit 1). */
export const fail = (name, detail) => ({ name, ok: false, detail });
/** A warning: reported with `warn: true` but never fails the command. */
export const warn = (name, detail) => ({ name, ok: true, warn: true, detail });

/**
 * The Chrome extension ID of a base64 public key (the manifest `key`): the SHA-256 of the
 * DER bytes, its first 32 hex digits, each digit d written as the letter 'a' + d.
 */
export function extensionIdFromKey(base64) {
  const hex = createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 32);
  return [...hex].map((digit) => String.fromCharCode(A_CODE + parseInt(digit, 16))).join('');
}

const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * The published version of extension `id` in a Chrome update-server `updatecheck` answer (XML).
 * Throws when the app is absent, its status or the updatecheck status is not ok, or no version.
 */
export function parseUpdateCheckVersion(xml, id) {
  const app = new RegExp(`<app\\s[^>]*appid="${id}"[^>]*>([\\s\\S]*?)</app>`).exec(xml);
  if (!app) throw new Error(`update server answer has no <app appid="${id}">`);
  const appStatus = attribute(app[0].slice(0, app[0].indexOf('>') + 1), 'status');
  if (appStatus && appStatus !== 'ok') throw new Error(`update server: app ${id} status is "${appStatus}"`);
  const check = /<updatecheck\s[^>]*>/.exec(app[1]);
  if (!check) throw new Error(`update server answer has no <updatecheck> for app ${id}`);
  const status = attribute(check[0], 'status');
  if (status !== 'ok') throw new Error(`update server: updatecheck status for app ${id} is "${status}"`);
  const version = attribute(check[0], 'version');
  if (!version) throw new Error(`update server: updatecheck for app ${id} has no version`);
  return version;
}

/** The version of the first `## <version>` heading of a CHANGELOG.md text. */
export function topChangelogVersion(text) {
  const m = /^##\s+v?([0-9][0-9A-Za-z.\-]*)\s*$/m.exec(text);
  if (!m) throw new Error('CHANGELOG.md has no "## <version>" heading');
  return m[1];
}

const GLOB = /[*?[\]]/;

/**
 * The extension-relative files a manifest references (icons, action icons and popup, content
 * scripts' js/css, web-accessible resources), sorted and unique; `globs` are patterns not checked.
 */
export function manifestReferencedFiles(manifest) {
  const paths = [
    ...Object.values(manifest.icons || {}),
    ...(typeof manifest.action?.default_icon === 'string'
      ? [manifest.action.default_icon] : Object.values(manifest.action?.default_icon || {})),
    ...(manifest.action?.default_popup ? [manifest.action.default_popup] : []),
    ...(manifest.content_scripts || []).flatMap((cs) => [...(cs.js || []), ...(cs.css || [])]),
    ...(manifest.web_accessible_resources || []).flatMap((war) => war.resources || []),
  ].map((p) => p.replace(/^\/+/, ''));
  const unique = [...new Set(paths)].sort();
  return { files: unique.filter((p) => !GLOB.test(p)), globs: unique.filter((p) => GLOB.test(p)) };
}

/** Whether a unified diff of manifest.json changes only the `key` line (and blank lines). */
export function isKeyOnlyDiff(diffText) {
  const changed = diffText.split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)( |$)/.test(line))
    .map((line) => line.slice(1));
  return changed.length > 0 && changed.every((line) => line.trim() === '' || /^\s*"key"\s*:/.test(line));
}

// --- verify: the results CSV of a backtest run ---

/**
 * The rows of a CSV text (RFC 4180), each an array of strings: a field may be double-quoted, a
 * quoted field may hold commas and newlines, and `""` inside quotes is a literal quote. `\r\n`
 * line ends, a leading BOM and a trailing newline are tolerated.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('CSV text ends inside a quoted field');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const RESULTS_NAME = / - (\d+)_(max|min)_(.+)_([A-Za-z]+)(?: \(\d+\))?\.csv$/;

/**
 * The test settings a results file name of the extension carries, e.g.
 * `SPX_1D MACD Strategy - 5_max_Total PnL_random (6).csv` → cycles 5, direction 'max', optParamName
 * 'Total PnL', method 'random', deep false (Chrome writes `:` as `_` and adds ` (n)` for a repeat).
 */
export function parseResultsFileName(name) {
  const m = RESULTS_NAME.exec(name);
  if (!m) throw new Error(`"${name}" is not a results file name (<chart> - <cycles>_<max|min>_<param>_<method>.csv)`);
  return { cycles: Number(m[1]), direction: m[2], optParamName: m[3], method: m[4], deep: name.includes(' deep backtesting ') };
}

/** The columns every results file has, besides the optimized parameter and the `__` strategy parameters. */
export const RESULTS_COLUMNS = Object.freeze(['comment', '_setTime_', '_parseTime_', 'Total PnL', 'Total PnL %',
  'Max drawdown', 'Max drawdown %', 'Profit factor', 'Profitable trades', 'Sharpe ratio', 'Sortino ratio']);
/** The comment of the row that separates the tested sets from the filtered ones below it. */
export const FILTERED_SEPARATOR = 'Bellow filtered results of tests';
const ROW_ERRORS = Object.freeze(['The tradingview error occurred', 'calculation process has not started',
  'Testing of this combination is skipped', 'No report data']);
const NO_TRADES = 'No trades for these parameters';
const NO_DATA = 'There is no data for conversion';

const listed = (items, limit = 10) => items.slice(0, limit).join('; ') + (items.length > limit ? `; … ${items.length - limit} more` : '');

/** Where a results table keeps its comment, optimized and `__` parameter columns, and its separator row. */
function resultsLayout(header, data, optParamName) {
  const commentAt = header.indexOf('comment');
  const comment = (row) => (commentAt >= 0 ? row[commentAt] ?? '' : '');
  const isSeparator = (row) => comment(row) === FILTERED_SEPARATOR && row.every((cell, i) => i === commentAt || cell === '');
  return {
    comment,
    isSeparator,
    separatorAt: data.findIndex(isSeparator),
    optAt: header.indexOf(optParamName),
    paramColumns: header.map((name, i) => [name, i]).filter(([name]) => name.startsWith('__')).map(([, i]) => i),
  };
}

function columnsCheck(header, optParamName, { paramColumns }) {
  const missing = [...RESULTS_COLUMNS, optParamName].filter((name) => !header.includes(name));
  if (!paramColumns.length) missing.push('__<strategy parameter>');
  return missing.length ? fail('results.columns', `missing: ${missing.join(', ')}`)
    : pass('results.columns', `all required columns, ${paramColumns.length} strategy parameters`);
}

function rowShapeCheck(header, data) {
  const misshapen = data.map((row, i) => [row, i + 1]).filter(([row]) => row.length !== header.length)
    .map(([row, n]) => `${n} (${row.length})`);
  return misshapen.length ? fail('results.row-shape', `rows not of ${header.length} columns: ${listed(misshapen)}`)
    : pass('results.row-shape', `every row has ${header.length} columns`);
}

function rowCountCheck(data, cycles, { isSeparator, separatorAt }) {
  const tested = data.filter((row) => !isSeparator(row)).length;
  const filtered = separatorAt < 0 ? 0 : data.slice(separatorAt + 1).filter((row) => !isSeparator(row)).length;
  const expected = cycles + 1;
  const counted = `${tested} tested sets${filtered ? ` (${filtered} of them filtered)` : ''}`;
  return tested === expected ? pass('results.row-count', `expected ${expected}, found ${counted}`)
    : fail('results.row-count', `expected ${expected} (cycles ${cycles} + current parameters), found ${counted}`);
}

function valuesCheck(data, optParamName, { separatorAt, optAt, paramColumns }) {
  if (optAt < 0) return fail('results.values', `no "${optParamName}" column`);
  const above = separatorAt < 0 ? data : data.slice(0, separatorAt);
  const real = above.filter((row) => (row[optAt] ?? '').trim() !== '' && Number.isFinite(Number(row[optAt]))
    && paramColumns.every((i) => (row[i] ?? '') !== ''));
  return real.length ? pass('results.values', `${real.length} tested rows with a numeric "${optParamName}" and every parameter set`)
    : fail('results.values', `no tested row above the filtered rows has a numeric "${optParamName}" and every __ parameter set`);
}

function commentChecks(data, { comment }) {
  const erred = data.map((row, i) => [comment(row), i + 1]).filter(([text]) => ROW_ERRORS.some((e) => text.includes(e)))
    .map(([text, n]) => `${n}: ${text.slice(0, 80)}`);
  const noTrades = data.filter((row) => comment(row).includes(NO_TRADES)).length;
  const first = comment(data[0]);
  return [
    first.startsWith('Current parameters') ? pass('results.first-row', 'first row holds the current parameters')
      : fail('results.first-row', `first row comment is "${first.slice(0, 80)}", expected "Current parameters…"`),
    erred.length ? fail('results.row-errors', `rows with an error comment: ${listed(erred)}`)
      : pass('results.row-errors', 'no row with an error comment'),
    noTrades ? warn('results.no-trades', `${noTrades} rows without trades ("${NO_TRADES}")`)
      : pass('results.no-trades', 'every tested set has trades'),
  ];
}

/**
 * The checks of a results CSV text against the run's `cycles` and `optParamName`: data present,
 * required columns, a uniform row shape, `cycles + 1` tested sets (the first is the current
 * parameters; the filtered separator is not a set, the filtered rows below it are), real values,
 * no error comments, and a warning for sets without trades. Row numbers count data rows from 1.
 */
export function verifyResultsCsv(text, { cycles, optParamName }) {
  const noData = text.trim() === NO_DATA;
  const rows = noData ? [] : parseCsv(text);
  const [header = [], ...data] = rows;
  if (!data.length) {
    return [fail('results.data', noData ? `the extension saved "${NO_DATA}"` : `${rows.length ? 'only a header' : 'empty file'}, no tested rows`)];
  }
  const layout = resultsLayout(header, data, optParamName);
  const [firstRow, ...commentRest] = commentChecks(data, layout);
  return [
    pass('results.data', `header of ${header.length} columns and ${data.length} rows`),
    columnsCheck(header, optParamName, layout),
    rowShapeCheck(header, data),
    rowCountCheck(data, cycles, layout),
    firstRow,
    valuesCheck(data, optParamName, layout),
    ...commentRest,
  ];
}

// --- verify: the console log of a backtest run ---

// One line of `node _aitna/tools/browser/cli.mjs logs`: `[world] type: text`, where type is a
// Runtime.consoleAPICalled type (log, debug, info, error, warning, …) or `uncaught` for an exception.
const LOG_LINE = /^\[(extension|page|other)\] ([A-Za-z]+): /;

/**
 * The checks of a console log captured by the browser tool's `logs` command: lines of the
 * extension's world are present, the run reached "All done", the extension logged no error and
 * threw nothing uncaught; its warnings and the page's own errors are reported, never failed.
 */
export function verifyConsoleLog(text) {
  const lines = text.split(/\r?\n/).map((line) => [line, LOG_LINE.exec(line)]).filter(([, m]) => m)
    .map(([line, m]) => ({ line, world: m[1], type: m[2] }));
  const ours = lines.filter((l) => l.world === 'extension');
  const checks = [ours.length ? pass('log.captured', `${ours.length} extension lines of ${lines.length}`)
    : fail('log.captured', 'no [extension] line: the log was not captured from the tab that ran the test')];
  checks.push(ours.some((l) => l.line.includes('All done')) ? pass('log.finished', 'the extension logged "All done"')
    : fail('log.finished', 'no [extension] line with "All done": the run did not finish while the log was captured'));
  const errors = ours.filter((l) => l.type === 'error' || l.type === 'uncaught').map((l) => l.line);
  checks.push(errors.length ? fail('log.no-errors', `${errors.length} extension errors: ${listed(errors)}`)
    : pass('log.no-errors', 'no extension error or uncaught exception'));
  const warnings = ours.filter((l) => l.type === 'warning').map((l) => l.line);
  checks.push(warnings.length ? warn('log.warnings', `${warnings.length} extension warnings: ${listed(warnings)}`)
    : pass('log.warnings', 'no extension warning'));
  const pageErrors = lines.filter((l) => l.world === 'page' && (l.type === 'error' || l.type === 'uncaught')).length;
  checks.push(pass('log.page-errors', `${pageErrors} errors of the page itself (TradingView's, informational)`));
  return checks;
}
