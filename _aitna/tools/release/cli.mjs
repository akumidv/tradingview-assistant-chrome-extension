#!/usr/bin/env node
// Release checks and packing of this extension for the Chrome Web Store upload. `check` only
// reads: it confirms the manifest, its local store key, the version literals (manifest,
// package.json, CHANGELOG.md), that the version is newer than the published one (Chrome update
// server), that every file the manifest names exists, and lists uncommitted changes that would
// ride along. `pack` runs the same checks and, when none failed, zips a staged copy of extension/
// and prints the dashboard link to upload it. `verify` is the success gate of a browser test run of
// a backtest: the results CSV the extension saved (newest in ~/Downloads, or TV_DOWNLOADS) has the
// expected structure and test data, and the console log captured meanwhile by
// `node _aitna/tools/browser/cli.mjs logs` shows no extension error. Every command prints JSON to
// stdout and exits 1 when a check fails; uploading stays with the owner.
//
// The store key goes into the upload — the store requires it for an already published item — but
// never into the code repository: it lives only in the owner's working copy (`.githooks/pre-commit`
// rejects a staged manifest with it) and in the gitignored zip.
//
// The decisions (key → ID, update-server answer, changelog heading, referenced files, results CSV
// and console log checks) are pure functions in lib.mjs, tested in lib.test.mjs.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { compareVersions } from '../github/lib.mjs';
import {
  extensionIdFromKey, fail, isKeyOnlyDiff, manifestReferencedFiles, parseResultsFileName, parseUpdateCheckVersion,
  pass, topChangelogVersion, verifyConsoleLog, verifyResultsCsv,
} from './lib.mjs';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TOOL_DIR, '..', '..', '..');
const EXTENSION_DIR = join(PROJECT_ROOT, 'extension');
const MANIFEST = join(EXTENSION_DIR, 'manifest.json');
const PACKAGE_JSON = join(PROJECT_ROOT, 'package.json');
const CHANGELOG = join(EXTENSION_DIR, 'CHANGELOG.md');
const DEFAULT_OUT = join(PROJECT_ROOT, 'assistant-ext.zip');
const DEFAULT_STORE_ID = 'pfbdfjaonemppanfnlmliafffahlohfg';
// The developer dashboard; the item's Package tab there takes the zip ("Upload new package").
const UPLOAD_URL = 'https://chrome.google.com/webstore/devconsole';
const UPDATE_URL = (id) => 'https://clients2.google.com/service/update2/crx?response=updatecheck'
  + `&acceptformat=crx3&prodversion=140.0.0.0&x=id%3D${id}%26uc`;
const EXCLUDED = (name) => name.startsWith('.') || name.endsWith('.map') || name === 'Thumbs.db';

class UsageError extends Error {}

const print = (value) => console.log(JSON.stringify(value, null, 2));

/** Run one check; an exception becomes a failed check, so one failure never hides the others. */
async function attempt(name, body) {
  try {
    return await body();
  } catch (error) {
    return fail(name, error instanceof Error ? error.message : String(error));
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function git(args) {
  return execFileSync('git', args, { cwd: PROJECT_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

async function publishedVersion(id) {
  const url = UPDATE_URL(id);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Chrome update server answered ${response.status} for ${url}`);
  return parseUpdateCheckVersion(await response.text(), id);
}

function gitChanges() {
  const lines = git(['status', '--porcelain', '--', 'extension', 'package.json']).split('\n').filter(Boolean);
  const keyOnly = lines.some((l) => l.slice(3) === 'extension/manifest.json')
    && isKeyOnlyDiff(git(['diff', 'HEAD', '--', 'extension/manifest.json']));
  const changes = lines.filter((l) => !(keyOnly && l.slice(3) === 'extension/manifest.json'));
  const check = pass('git.clean-extension', changes.length
    ? `uncommitted changes go into the zip: ${changes.join('; ')}`
    : `no uncommitted changes${keyOnly ? ' (manifest.json differs only by the local key)' : ''}`);
  return changes.length ? { ...check, warn: true } : check;
}

/** Every release check, in order, and the facts they found. */
async function runChecks({ id, offline }) {
  const checks = [];
  let manifest = null;
  checks.push(await attempt('manifest.json', () => {
    manifest = readJson(MANIFEST);
    return pass('manifest.json', `parsed ${MANIFEST}`);
  }));
  const version = manifest?.version ?? null;
  const needManifest = (name, body) => attempt(name, () => {
    if (!manifest) return fail(name, 'skipped: manifest.json did not parse');
    return body();
  });
  checks.push(await needManifest('key.present', () => (typeof manifest.key === 'string' && manifest.key
    ? pass('key.present', 'manifest has a "key"')
    : fail('key.present', 'extension/manifest.json has no "key": add the store public key locally (it is never '
      + 'committed — .githooks/pre-commit rejects it)'))));
  checks.push(await needManifest('key.matches-store', () => {
    if (typeof manifest.key !== 'string' || !manifest.key) return fail('key.matches-store', 'no key to derive an ID from');
    const derived = extensionIdFromKey(manifest.key);
    return derived === id
      ? pass('key.matches-store', `key yields ${derived}`)
      : fail('key.matches-store', `key yields ${derived}, the store ID is ${id}`);
  }));
  checks.push(await needManifest('version.package-json', () => {
    const pkg = readJson(PACKAGE_JSON).version;
    return pkg === version
      ? pass('version.package-json', `package.json ${pkg}`)
      : fail('version.package-json', `package.json has ${pkg}, manifest has ${version}`);
  }));
  checks.push(await needManifest('version.changelog', () => {
    const top = topChangelogVersion(readFileSync(CHANGELOG, 'utf8'));
    return top === version
      ? pass('version.changelog', `CHANGELOG.md tops with ${top}`)
      : fail('version.changelog', `CHANGELOG.md tops with ${top}, manifest has ${version}`);
  }));
  let published = null;
  if (offline) {
    checks.push({ name: 'version.newer-than-store', ok: null, skipped: true, detail: 'skipped: --offline' });
  } else {
    checks.push(await needManifest('version.newer-than-store', async () => {
      published = await publishedVersion(id);
      return compareVersions(version, published) > 0
        ? pass('version.newer-than-store', `${version} > published ${published}`)
        : fail('version.newer-than-store', `${version} is not newer than published ${published}`);
    }));
  }
  checks.push(await needManifest('manifest.files', () => {
    const { files, globs } = manifestReferencedFiles(manifest);
    const missing = files.filter((f) => !existsSync(join(EXTENSION_DIR, f)));
    const unchecked = globs.length ? `; globs not checked: ${globs.join(', ')}` : '';
    return missing.length
      ? fail('manifest.files', `missing under extension/: ${missing.join(', ')}${unchecked}`)
      : pass('manifest.files', `${files.length} referenced files exist${unchecked}`);
  }));
  checks.push(await attempt('git.clean-extension', gitChanges));
  const ok = checks.every((c) => c.ok !== false);
  return { ok, version, published_version: published, extension_id: id, checks };
}

/** Copy extension/ into a fresh temp dir without dotfiles, source maps and OS junk; return it. */
function stageExtension() {
  const staged = mkdtempSync(join(tmpdir(), 'tv-assistant-release-'));
  cpSync(EXTENSION_DIR, staged, { recursive: true, filter: (src) => src === EXTENSION_DIR || !EXCLUDED(basename(src)) });
  return staged;
}

/** Re-read the zip: manifest.json at its root, parsed, with the expected version and a key of the store item. */
function verifyZip(zip, version, id) {
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (!entries.includes('manifest.json')) throw new Error(`${zip} has no manifest.json at its root`);
  const manifest = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' }));
  if (typeof manifest.key !== 'string' || extensionIdFromKey(manifest.key) !== id) {
    throw new Error(`${zip}: manifest.json has no "key" of the store item ${id}`);
  }
  if (manifest.version !== version) throw new Error(`${zip}: manifest version ${manifest.version}, expected ${version}`);
  return entries.filter((e) => !e.endsWith('/')).length;
}

/** The newest `*.csv` in `dir`, or null when there is none. */
function newestCsv(dir) {
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return found[0]?.path ?? null;
}

/** The `results.file` check: the file exists and, with `since`, was written after it. */
function resultsFileCheck(path, since) {
  if (!path || !existsSync(path)) return fail('results.file', `no results CSV${path ? ` at ${path}` : ''}`);
  const mtime = statSync(path).mtime;
  if (since && mtime <= since) {
    return fail('results.file', `${path} was written ${mtime.toISOString()}, not after --since ${since.toISOString()}: `
      + 'a file of an earlier run');
  }
  return pass('results.file', `${path} (written ${mtime.toISOString()})`);
}

/** Every check of the `verify` gate: the results CSV, then the console log, and the facts they used. */
function runVerify({ results, since, log, cycles, optParam }) {
  const checks = [resultsFileCheck(results, since)];
  let test = { cycles, optParamName: optParam };
  if (cycles === undefined || optParam === undefined) {
    try {
      const named = parseResultsFileName(basename(results || ''));
      test = { cycles: cycles ?? named.cycles, optParamName: optParam ?? named.optParamName };
    } catch (error) {
      checks.push(fail('results.file-name', `${error.message}; pass --cycles and --opt-param`));
    }
  }
  if (checks.every((c) => c.ok)) checks.push(...verifyResultsCsv(readFileSync(results, 'utf8'), test));
  if (!log) {
    checks.push(fail('log.captured', 'no --log given: the gate needs the console log of the run '
      + '(node _aitna/tools/browser/cli.mjs logs > PATH)'));
  } else if (!existsSync(log)) {
    checks.push(fail('log.captured', `no console log at ${log}`));
  } else {
    checks.push(...verifyConsoleLog(readFileSync(log, 'utf8')));
  }
  return { ok: checks.every((c) => c.ok !== false), results: results ?? null, log: log ?? null, ...test, checks };
}

const commands = {
  check: {
    help: '[--id ID] [--offline]  release readiness report (exit 1 when a check fails)',
    options: { id: { type: 'string' }, offline: { type: 'boolean' } },
    async run(v) {
      const report = await runChecks({ id: v.id || DEFAULT_STORE_ID, offline: Boolean(v.offline) });
      print(report);
      if (!report.ok) process.exitCode = 1;
    },
  },
  pack: {
    help: '[--id ID] [--offline] [--out PATH]  run the checks, then zip extension/ for upload',
    options: { id: { type: 'string' }, offline: { type: 'boolean' }, out: { type: 'string' } },
    async run(v) {
      const id = v.id || DEFAULT_STORE_ID;
      const report = await runChecks({ id, offline: Boolean(v.offline) });
      if (!report.ok) {
        print(report);
        process.exitCode = 1;
        return;
      }
      const out = resolve(v.out || DEFAULT_OUT);
      rmSync(out, { force: true });
      const staged = stageExtension();
      try {
        execFileSync('zip', ['-r', '-X', '-q', out, '.'], { cwd: staged, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (error) {
        if (error.code === 'ENOENT') throw new Error('zip CLI not found on PATH; install zip/unzip', { cause: error });
        throw error;
      } finally {
        rmSync(staged, { recursive: true, force: true });
      }
      const files = verifyZip(out, report.version, id);
      print({
        ok: true, zip: out, bytes: statSync(out).size, files, version: report.version, upload_url: UPLOAD_URL,
        checks: report.checks,
      });
    },
  },
  verify: {
    help: '[--results PATH] [--since ISO] [--log PATH] [--cycles N] [--opt-param NAME]  success gate of a browser '
      + 'backtest run: results CSV (default: newest in ~/Downloads or TV_DOWNLOADS) and console log',
    options: {
      results: { type: 'string' }, since: { type: 'string' }, log: { type: 'string' },
      cycles: { type: 'string' }, 'opt-param': { type: 'string' },
    },
    async run(v) {
      const since = v.since === undefined ? null : new Date(v.since);
      if (since && Number.isNaN(since.getTime())) throw new UsageError(`--since "${v.since}" is not an ISO date`);
      const cycles = v.cycles === undefined ? undefined : Number(v.cycles);
      if (cycles !== undefined && !(Number.isInteger(cycles) && cycles >= 0)) {
        throw new UsageError(`--cycles "${v.cycles}" is not a non-negative integer`);
      }
      const downloads = process.env.TV_DOWNLOADS || join(homedir(), 'Downloads');
      const results = v.results ? resolve(v.results) : newestCsv(downloads);
      const report = runVerify({ results, since, log: v.log && resolve(v.log), cycles, optParam: v['opt-param'] });
      print(report);
      if (!report.ok) process.exitCode = 1;
    },
  },
};

function usage() {
  console.error('usage: node _aitna/tools/release/cli.mjs <command> [options]');
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
