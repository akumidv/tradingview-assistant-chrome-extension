#!/usr/bin/env node
// Launcher for the chrome-devtools MCP server (.mcp.json), attached to the test Chrome that
// `node _aitna/tools/browser/cli.mjs start` opened. The server is the chrome-devtools-mcp dev
// dependency, so its version is pinned in package.json. It connects to Chrome on the first tool
// call, so Chrome may be started after the session.
// With a Windows Chrome under WSL only a Windows process reaches its loopback DevTools port, so
// the server is then started through cmd.exe and npx, at the same pinned version.
// stdio passes straight through.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT, chromePath, windowsSide } from './cli.mjs';

const port = process.env.TV_CHROME_PORT || '9223';
const flags = [`--browser-url=http://127.0.0.1:${port}`, '--no-usage-statistics'];

let windowsChrome = false;
try {
  windowsChrome = windowsSide(chromePath());
} catch { /* no Chrome found: start the server here and let it report */ }

let cmd;
let args;
if (windowsChrome) {
  const version = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')).devDependencies['chrome-devtools-mcp'];
  [cmd, args] = ['cmd.exe', ['/c', 'npx', '-y', `chrome-devtools-mcp@${version}`, ...flags]];
} else {
  [cmd, args] = [join(PROJECT_ROOT, 'node_modules', '.bin', 'chrome-devtools-mcp'), flags];
}
const child = spawn(cmd, args, { stdio: 'inherit', cwd: windowsChrome ? '/mnt/c' : undefined });
child.on('exit', (code) => process.exit(code ?? 1));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
