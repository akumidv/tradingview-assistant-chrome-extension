#!/usr/bin/env node
// A shared Chrome window for testing this extension on TradingView. The user signs in to
// TradingView by hand once; the agent drives the same window through the Chrome DevTools
// protocol, via the `chrome-devtools` MCP server in .mcp.json (tools/browser/mcp.mjs). This tool
// starts that Chrome with the unpacked extension loaded, reports on it, and gives the agent
// DevTools helpers (eval in the extension's world, logs, reload).
//
// Everything the browser keeps lives in the git-ignored _aitna/.browser/: the profile
// (chrome-profile, so the TradingView sign-in and the extension's storage survive launches),
// Chrome for Testing downloaded by `install` (the puppeteer dev dependency, .puppeteerrc.cjs), and
// launch.json. The extension is loaded straight from extension/, so `reload` picks up the working
// tree as it is.
//
// Branded Google Chrome 137+ ignores --load-extension, so Chrome for Testing (or Chromium) is
// preferred: the extension is then loaded on every start. A branded Chrome
// still works if the user loads the extension once by hand (chrome://extensions → Load unpacked);
// the persistent profile keeps it. TV_CHROME_PATH, TV_CHROME_PORT and TV_CHROME_PROFILE override.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { platform } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(TOOL_DIR, '..', '..', '..');
const STATE = join(PROJECT_ROOT, '_aitna', '.browser');
const CHROME_DIR = join(STATE, 'chrome'); // puppeteer cache layout: <cacheDirectory>/chrome/<platform>-<build>/
const LAUNCH = join(STATE, 'launch.json');
const EXTENSION = join(PROJECT_ROOT, 'extension'); // the unpacked extension: manifest.json and what it ships
const DEFAULT_PORT = 9223; // not 9222, so it does not collide with another shared Chrome
const DEFAULT_URL = 'https://www.tradingview.com/chart/';

class UsageError extends Error {}

const port = (v) => Number(v.port || process.env.TV_CHROME_PORT || DEFAULT_PORT);
const isWsl = () => platform() === 'linux' && /microsoft/i.test(readFileSync('/proc/version', 'utf8'));
const hasDisplay = () => platform() !== 'linux' || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

/** A Windows program started from WSL: its paths must be Windows paths. */
export const windowsSide = (path) => isWsl() && /\.exe$/i.test(path || '');

const installed = (dir) => (existsSync(dir)
  ? readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => join(dir, d.name)).sort()
  : []);

/** Where Windows says chrome.exe is installed (App Paths), as a WSL path. */
function windowsChrome() {
  if (!isWsl()) return null;
  for (const hive of ['HKLM', 'HKCU']) {
    const r = spawnSync('reg.exe', ['query', `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`, '/ve'],
      { encoding: 'utf8', cwd: '/mnt/c' });
    const win = (r.stdout || '').match(/REG_(?:EXPAND_)?SZ\s+"?([^"\r\n]+?)"?\s*$/m)?.[1];
    if (!win) continue;
    const path = spawnSync('wslpath', ['-u', win], { encoding: 'utf8' }).stdout?.trim();
    if (path && existsSync(path)) return path;
  }
  return null;
}

/**
 * { path, source: 'TV_CHROME_PATH' | 'project' | 'chromium' | 'branded' } or null. Chrome for
 * Testing and Chromium come before a branded Chrome because only they load the extension from
 * the command line.
 */
export function findChrome() {
  const explicit = process.env.TV_CHROME_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new UsageError(`TV_CHROME_PATH=${explicit} does not exist`);
    return { path: explicit, source: 'TV_CHROME_PATH' };
  }
  const own = installed(CHROME_DIR).reverse().flatMap((d) => ['chrome-linux64/chrome', 'chrome-win64/chrome.exe',
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']
    .map((p) => join(d, p))).find((p) => existsSync(p));
  if (own) return { path: own, source: 'project' };
  const dirs = (process.env.PATH || '').split(delimiter).filter((d) => d && !(isWsl() && d.startsWith('/mnt/')));
  const onPath = (names) => dirs.flatMap((d) => names.map((n) => join(d, n))).find((p) => existsSync(p));
  const chromium = onPath(['chromium', 'chromium-browser']);
  if (chromium) return { path: chromium, source: 'chromium' };
  const branded = onPath(['google-chrome', 'google-chrome-stable'])
    || ['/opt/google/chrome/chrome'].find((p) => existsSync(p)) || windowsChrome();
  return branded ? { path: branded, source: 'branded' } : null;
}

export function chromePath() {
  const found = findChrome();
  if (found) return found.path;
  throw new UsageError('no Chrome found.\nACTION FOR THE USER: npm install && npm run browser install  (Chrome for Testing, ~200 MB, into _aitna/.browser/chrome)');
}

/** A path as the Chrome process sees it (a Windows path for a Windows Chrome under WSL). */
function forChrome(exe, path) {
  return windowsSide(exe) && path.startsWith('/') ? execFileSync('wslpath', ['-w', path], { encoding: 'utf8' }).trim() : path;
}

// Cookies are encrypted per Chrome build: a branded Chrome and Chrome for Testing keep separate
// profiles, so switching between them does not leave a profile neither can read.
function profileDir(found) {
  if (process.env.TV_CHROME_PROFILE) return process.env.TV_CHROME_PROFILE;
  const dir = join(STATE, found.source === 'branded' ? 'chrome-profile-branded' : 'chrome-profile');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * The id Chrome gives an unpacked extension: SHA-256 of its absolute path, the first 32 hex
 * digits mapped 0-f → a-p. Linux and macOS hash the UTF-8 path; a Windows Chrome hashes the
 * UTF-16LE path it sees, so the id is computed only off Windows.
 */
export function extensionId(path) {
  const hex = createHash('sha256').update(Buffer.from(path, 'utf8')).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16))).join('');
}

/** Under WSL a Windows Chrome's loopback port is probed from the Windows side. */
function probeViaWindows(url) {
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Invoke-WebRequest '${url}' -UseBasicParsing -TimeoutSec 2).Content`], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000,
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

async function devtools(p, path = '/json/version') {
  const url = `http://127.0.0.1:${p}${path}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (r.ok) return await r.json();
  } catch { /* not on this side */ }
  return isWsl() && windowsSide(readLaunch()?.exe) ? probeViaWindows(url) : null;
}

function readLaunch() {
  try { return JSON.parse(readFileSync(LAUNCH, 'utf8')); } catch { return null; }
}

/** Stop the Chrome started with this profile, wherever it runs. */
async function stopChrome(p) {
  const launch = readLaunch();
  if (windowsSide(launch?.exe)) {
    const needle = launch.profile.replace(/'/g, "''");
    const ps = `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${needle}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', timeout: 30000 });
    return;
  }
  const version = await devtools(p);
  if (!version?.webSocketDebuggerUrl) return;
  await new Promise((done) => {
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    ws.onclose = done;
    ws.onerror = done;
    setTimeout(done, 5000);
  });
}

/**
 * A browser-level DevTools connection: `send(method, params, sessionId)` resolves with the
 * result, `on(method, handler)` receives events of every attached session (flatten mode).
 */
async function connect(p) {
  const version = await devtools(p);
  if (!version?.webSocketDebuggerUrl) throw new UsageError(`no Chrome DevTools on 127.0.0.1:${p}; start it first`);
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((done, fail) => { ws.onopen = done; ws.onerror = () => fail(new UsageError('DevTools WebSocket refused the connection')); });
  let next = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined) {
      const { resolve: ok, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new UsageError(`${msg.error.message} (${msg.error.code})`));
      else ok(msg.result);
    } else for (const h of handlers.get(msg.method) || []) h(msg.params, msg.sessionId);
  };
  return {
    send: (method, params = {}, sessionId, timeout = 10000) => new Promise((ok, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new UsageError(`${method}: no answer in ${timeout / 1000} s`)); }, timeout);
      pending.set(id, { resolve: (r) => { clearTimeout(timer); ok(r); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    }),
    on: (method, handler) => handlers.set(method, [...(handlers.get(method) || []), handler]),
    close: () => ws.close(),
  };
}

/** Page targets whose URL contains `tab`. */
async function pages(cdp, tab) {
  const { targetInfos } = await cdp.send('Target.getTargets');
  return targetInfos.filter((t) => t.type === 'page' && t.url.includes(tab));
}

const EXTENSION_NAME = JSON.parse(readFileSync(join(EXTENSION, 'manifest.json'), 'utf8')).name;

/** The world an execution context belongs to: 'extension' (our content scripts), 'page', or 'other'. */
function worldOf(context) {
  if (context.auxData?.type === 'isolated') {
    const id = readLaunch()?.id;
    const ours = context.name === EXTENSION_NAME || (id && context.origin === `chrome-extension://${id}`);
    return ours ? 'extension' : 'other';
  }
  return context.auxData?.isDefault ? 'page' : 'other';
}

/** Attach to the first page target matching `tab`; resolves { session, contexts } after Runtime.enable. */
async function attach(cdp, tab) {
  const [target] = await pages(cdp, tab);
  if (!target) throw new UsageError(`no open tab whose URL contains "${tab}"`);
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const contexts = new Map();
  cdp.on('Runtime.executionContextCreated', ({ context }, s) => { if (s === sessionId) contexts.set(context.id, context); });
  cdp.on('Runtime.executionContextDestroyed', ({ executionContextId }, s) => { if (s === sessionId) contexts.delete(executionContextId); });
  await cdp.send('Runtime.enable', {}, sessionId); // replays a Created event for every live context
  return { target, sessionId, contexts };
}

/**
 * Chrome keeps an unpacked extension only in developer mode: without it the extension is
 * disabled as `unsupportedDeveloperExtension`, and a reload never finishes. Before a launch the
 * mode is written into the profile's Preferences (Chrome is not running, so the file is ours),
 * and a previous crash or kill is marked a normal exit, so no "Restore pages?" prompt appears.
 */
function seedPreferences(profile) {
  const file = join(profile, 'Default', 'Preferences');
  let prefs = {};
  try { prefs = JSON.parse(readFileSync(file, 'utf8')); } catch { /* a fresh profile */ }
  prefs.extensions = { ...prefs.extensions, ui: { ...prefs.extensions?.ui, developer_mode: true } };
  prefs.profile = { ...prefs.profile, exit_type: 'Normal', exited_cleanly: true };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(prefs));
}

/**
 * Through chrome://extensions (its developerPrivate API, as its own buttons do): turn developer
 * mode on, enable the extension and, with `reload`, reload it from disk; resolves once it is
 * ENABLED. chrome.runtime.reload() from the extension itself leaves it DISABLED instead.
 */
async function ensureExtension(cdp, id, { reload = false } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'chrome://extensions', background: true });
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await new Promise((r) => setTimeout(r, 1000));
    const r = await cdp.send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const id = ${JSON.stringify(id)};
      const dev = chrome.developerPrivate;
      await dev.updateProfileConfiguration({ inDeveloperMode: true });
      await chrome.management.setEnabled(id, true);
      if (${reload}) {
        const error = await dev.reload(id, { failQuietly: true, populateErrorForUnpacked: true });
        if (error) return 'load error: ' + (error.error || JSON.stringify(error));
      }
      let info;
      for (let i = 0; i < 20; i++) {
        info = await dev.getExtensionInfo(id);
        if (info.state === 'ENABLED') return 'ENABLED';
        await new Promise((ok) => setTimeout(ok, 250));
      }
      const why = Object.entries(info.disableReasons || {}).filter(([, on]) => on).map(([k]) => k).join(', ');
      return info.state + (why ? ' (' + why + ')' : '');
    })()` }, sessionId, 20000);
    const outcome = r.exceptionDetails ? r.exceptionDetails.exception?.description : r.result.value;
    if (outcome !== 'ENABLED') throw new UsageError(`extension ${id} is not running: ${outcome}`);
  } finally { await cdp.send('Target.closeTarget', { targetId }).catch(() => {}); }
}

/** Whether the profile holds a TradingView session (its `sessionid` cookie). */
async function signedIn(cdp) {
  const { cookies } = await cdp.send('Storage.getCookies');
  return cookies.some((c) => c.name === 'sessionid' && c.domain.endsWith('tradingview.com'));
}

const SIGN_IN_STEP = 'ACTION FOR THE USER: sign in to TradingView in the opened Chrome window (once; the profile keeps it).';

const TAB_OPTION = { type: 'string', default: 'tradingview.com/chart' };

const commands = {
  status: {
    help: 'is the test Chrome running and reachable; the extension id and popup URL; open tabs (--port)',
    options: { port: { type: 'string' } },
    async run(v) {
      const p = port(v);
      const version = await devtools(p);
      if (!version) {
        console.log(`no Chrome DevTools on 127.0.0.1:${p}. Start it: node _aitna/tools/browser/cli.mjs start`);
        return 1;
      }
      const tabs = ((await devtools(p, '/json/list')) || []).filter((t) => t.type === 'page');
      const launch = readLaunch();
      console.log(`Chrome ${version.Browser} on 127.0.0.1:${p} — ${tabs.length} tab(s)`);
      if (launch) {
        console.log(`  started ${launch.started.slice(0, 16).replace('T', ' ')} from ${launch.source} Chrome; extension: ${launch.extension}`);
        if (launch.id) console.log(`  extension id: ${launch.id}\n  popup: chrome-extension://${launch.id}/popup/assistant.html`);
      } else console.log('  this Chrome was not started by this tool; `restart` to launch it with the extension');
      for (const t of tabs) console.log(`  ${t.title.slice(0, 60).padEnd(60)} ${t.url}`);
      const cdp = await connect(p);
      try { if (!(await signedIn(cdp))) console.log(SIGN_IN_STEP); } finally { cdp.close(); }
      console.log('The agent drives it through the chrome-devtools MCP server (/mcp shows it).');
      return 0;
    },
  },

  stop: {
    help: 'close the test Chrome (the sign-in and extension storage stay in the profile)',
    options: { port: { type: 'string' } },
    async run(v) {
      const p = port(v);
      if (!(await devtools(p))) { console.log('no test Chrome is running'); return 0; }
      await stopChrome(p);
      for (let i = 0; i < 10 && (await devtools(p)); i++) await new Promise((r) => setTimeout(r, 500));
      console.log((await devtools(p)) ? 'Chrome still answers — close it by hand' : 'stopped');
      return 0;
    },
  },

  restart: {
    help: 'stop and start again — reloads the extension from the working tree (--url to open)',
    options: { port: { type: 'string' }, url: { type: 'string' } },
    async run(v) {
      await commands.stop.run(v);
      return commands.start.run(v);
    },
  },

  start: {
    help: `start Chrome with the test profile, the unpacked extension and a DevTools port (--port, --url, default ${DEFAULT_URL})`,
    options: { port: { type: 'string' }, url: { type: 'string' } },
    async run(v) {
      const p = port(v);
      if (await devtools(p)) {
        console.log(`Chrome is already listening on 127.0.0.1:${p}. Use \`restart\` to reload the extension.`);
        return 0;
      }
      const found = findChrome();
      if (!found) chromePath();
      const exe = found.path;
      const ownProfile = profileDir(found);
      if (!windowsSide(exe)) seedPreferences(ownProfile);
      const profile = forChrome(exe, ownProfile);
      const extension = forChrome(exe, EXTENSION);
      const args = [`--remote-debugging-port=${p}`, `--user-data-dir=${profile}`, '--no-first-run',
        '--no-default-browser-check', '--hide-crash-restore-bubble', `--load-extension=${extension}`, `--disable-extensions-except=${extension}`];
      // Linux without a graphical session: nobody could see the window, so Chrome runs headless.
      const headless = !hasDisplay() && !windowsSide(exe);
      if (headless) args.push('--headless=new');
      args.push(v.url || DEFAULT_URL);
      spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
      const id = windowsSide(exe) ? null : extensionId(EXTENSION);
      writeFileSync(LAUNCH, `${JSON.stringify({ started: new Date().toISOString(), exe, source: found.source, profile, port: p,
        extension, id, args }, null, 2)}\n`);
      console.log(`Started ${exe} (${found.source})\n  profile: ${profile}\n  extension: ${extension}\n  DevTools port: ${p}`);
      if (id) console.log(`  extension id: ${id}`);
      if (found.source === 'branded') {
        console.log('  ACTION FOR THE USER: npm run browser install — Chrome for Testing; this branded Chrome cannot load the extension.\n'
          + '  NOTE: branded Chrome 137+ ignores --load-extension. If the extension is not in chrome://extensions,\n'
          + `  load it once by hand there (Developer mode → Load unpacked → ${extension}); the profile keeps it,\n`
          + '  but code changes then need the reload button there. `install` gets Chrome for Testing instead.');
      }
      if (headless) console.log('  headless: no graphical session — the user does not see this Chrome and cannot sign in here');
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await devtools(p)) {
          if (!id) {
            console.log('Reachable. The extension cannot be checked from here (Windows Chrome).');
            return 0;
          }
          const cdp = await connect(p);
          try {
            await ensureExtension(cdp, id);
            console.log('Reachable; developer mode on, extension enabled.');
            if (!(await signedIn(cdp))) console.log(SIGN_IN_STEP);
          } finally { cdp.close(); }
          return 0;
        }
      }
      console.log(`Chrome started but 127.0.0.1:${p} does not answer.`);
      return 1;
    },
  },

  eval: {
    help: 'evaluate an expression in a TradingView tab: --world extension (content scripts, default) | page; --tab URL part',
    options: { port: { type: 'string' }, tab: TAB_OPTION, world: { type: 'string', default: 'extension' } },
    positionals: true,
    async run(v, expression) {
      if (!expression) throw new UsageError('usage: eval [--world extension|page] [--tab URL-part] "<expression>"');
      const cdp = await connect(port(v));
      try {
        const { target, sessionId, contexts } = await attach(cdp, v.tab);
        const context = [...contexts.values()].find((c) => worldOf(c) === v.world && c.auxData?.frameId === target.targetId);
        if (!context) {
          throw new UsageError(`no ${v.world} world in ${target.url}` + (v.world === 'extension'
            ? ' — is the extension loaded (chrome://extensions) and is this a /chart/ page?' : ''));
        }
        const r = await cdp.send('Runtime.evaluate', { expression, contextId: context.id, returnByValue: true, awaitPromise: true,
          replMode: true }, sessionId);
        if (r.exceptionDetails) {
          console.log(`exception: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
          return 1;
        }
        const { value, description, type } = r.result;
        console.log(value !== undefined ? JSON.stringify(value, null, 2) : (description ?? type));
        return 0;
      } finally { cdp.close(); }
    },
  },

  logs: {
    help: 'stream console messages and uncaught exceptions of a TradingView tab, marked by world (--tab, --seconds, default 30; 0 = until Ctrl-C)',
    options: { port: { type: 'string' }, tab: TAB_OPTION, seconds: { type: 'string', default: '30' } },
    async run(v) {
      const cdp = await connect(port(v));
      const { target, sessionId, contexts } = await attach(cdp, v.tab);
      const world = (id) => (contexts.has(id) ? worldOf(contexts.get(id)) : 'other');
      const show = (o) => (o.value !== undefined ? (typeof o.value === 'string' ? o.value : JSON.stringify(o.value)) : (o.description ?? o.type));
      cdp.on('Runtime.consoleAPICalled', (e, s) => {
        if (s === sessionId) console.log(`[${world(e.executionContextId)}] ${e.type}: ${e.args.map(show).join(' ')}`);
      });
      cdp.on('Runtime.exceptionThrown', ({ exceptionDetails: d }, s) => {
        if (s === sessionId) console.log(`[${world(d.executionContextId)}] uncaught: ${d.exception?.description || d.text}`);
      });
      console.log(`listening to ${target.url}`);
      const seconds = Number(v.seconds);
      await new Promise((done) => { if (seconds > 0) setTimeout(done, seconds * 1000); process.on('SIGINT', done); });
      cdp.close();
      return 0;
    },
  },

  reload: {
    help: 'reload the extension from extension/ and then the TradingView chart tabs, without restarting Chrome',
    options: { port: { type: 'string' }, tab: TAB_OPTION },
    async run(v) {
      const id = readLaunch()?.id;
      if (!id) throw new UsageError('extension id unknown (Chrome not started by `start`, or a Windows Chrome): reload it in chrome://extensions');
      const cdp = await connect(port(v));
      try {
        await ensureExtension(cdp, id, { reload: true });
        const tabs = await pages(cdp, v.tab);
        // A chart with unsaved changes answers a reload with a "changes may be lost" beforeunload
        // dialog that blocks the tab until answered; the reload is the intent, so accept it.
        const reloading = new Set();
        cdp.on('Page.javascriptDialogOpening', ({ type }, s) => {
          if (type === 'beforeunload' && reloading.has(s))
            cdp.send('Page.handleJavaScriptDialog', { accept: true }, s).catch(() => {});
        });
        for (const t of tabs) {
          const s = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
          reloading.add(s.sessionId);
          await cdp.send('Page.enable', {}, s.sessionId);
          await cdp.send('Page.reload', {}, s.sessionId);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500)); // let a beforeunload dialog arrive and be answered
        console.log(`extension ${id} reloaded; ${tabs.length} tab(s) matching "${v.tab}" reloaded`);
        return 0;
      } finally { cdp.close(); }
    },
  },

  install: {
    help: 'Chrome for Testing into _aitna/.browser/chrome via the puppeteer dev dependency (.puppeteerrc.cjs)',
    options: {},
    async run() {
      const found = findChrome();
      if (found && found.source !== 'branded') {
        console.log(`a Chrome that loads the extension is available (${found.source}): ${found.path}`);
        return 0;
      }
      const puppeteer = join(PROJECT_ROOT, 'node_modules', '.bin', 'puppeteer');
      if (!existsSync(puppeteer)) throw new UsageError('the puppeteer dev dependency is missing: npm install');
      // An explicit download: puppeteer's own postinstall may be blocked by the npm allowScripts policy.
      const r = spawnSync(puppeteer, ['browsers', 'install', 'chrome@stable'], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      if (r.status !== 0) throw new UsageError(`puppeteer browsers install failed (exit ${r.status ?? r.error?.message})`);
      const own = findChrome();
      if (own?.source !== 'project') throw new UsageError(`Chrome for Testing did not land in ${CHROME_DIR}; check .puppeteerrc.cjs`);
      const ldd = platform() === 'linux' ? spawnSync('ldd', [own.path], { encoding: 'utf8' }).stdout || '' : '';
      const missing = [...ldd.matchAll(/^\s*(\S+) => not found/gm)].map((m) => m[1]);
      if (missing.length) {
        console.log(`installed ${own.path}, but these system libraries are missing: ${missing.join(', ')}\n`
          + `the user installs them (the agent does not use sudo): sudo apt-get satisfy -y --no-install-recommends "$(paste -sd, '${join(dirname(own.path), 'deb.deps')}')"`);
        return 1;
      }
      console.log(`installed: ${own.path}\nstart it: node _aitna/tools/browser/cli.mjs start`);
      return 0;
    },
  },
};

async function main(argv) {
  const [name, ...rest] = argv;
  const command = commands[name];
  if (!command) {
    console.log('usage: node _aitna/tools/browser/cli.mjs <command> [options]');
    for (const [n, c] of Object.entries(commands)) console.log(`  ${n.padEnd(8)} ${c.help}`);
    return name ? 2 : 0;
  }
  const { values, positionals } = parseArgs({ args: rest, options: command.options, allowPositionals: Boolean(command.positionals) });
  return command.run(values, positionals.join(' '));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((code) => process.exit(code ?? 0), (error) => {
    console.error(error instanceof UsageError ? error.message : error);
    process.exit(error instanceof UsageError ? 2 : 1);
  });
}
