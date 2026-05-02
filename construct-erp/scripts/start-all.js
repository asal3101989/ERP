// scripts/start-all.js — Launches Backend + Frontend together
// Run via: node scripts/start-all.js  OR  double-click START.bat at project root
'use strict';
const { spawn } = require('child_process');
const path      = require('path');

// Project root is one level above this script (scripts/ folder)
const ROOT = path.join(__dirname, '..');

// ── Server definitions ────────────────────────────────────────────────────────
const SERVERS = [
  {
    name:  'BACKEND ',
    color: '\x1b[96m',            // bright cyan
    cwd:   path.join(ROOT, 'backend'),
    cmd:   'npm',
    args:  ['run', 'dev'],
    port:  5000,
    ready: /PostgreSQL connected|listening on|Server running/i,
  },
  {
    name:  'FRONTEND',
    color: '\x1b[92m',            // bright green
    cwd:   path.join(ROOT, 'frontend'),
    cmd:   'npm',
    args:  ['start'],
    port:  3000,
    ready: /Local.*localhost|ready in|VITE.*ready/i,
    env:   { BROWSER: 'none' },   // suppress auto-open (we do it ourselves)
  },
];

// ── ANSI colours ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[91m',
  yellow: '\x1b[93m',
  white:  '\x1b[97m',
  grey:   '\x1b[90m',
};

// ── Status tracking ───────────────────────────────────────────────────────────
const status = {};
SERVERS.forEach(s => { status[s.name.trim()] = 'starting'; });

// ── Banner ────────────────────────────────────────────────────────────────────
function banner() {
  console.clear();
  const line = '═'.repeat(52);
  console.log(`\n${C.bold}${C.yellow}  ╔${line}╗`);
  console.log(`  ║       BCIM Engineering — ConstructERP             ║`);
  console.log(`  ╠${line}╣`);
  console.log(`  ║  ${C.white}Frontend${C.yellow}   →  http://localhost:3000              ║`);
  console.log(`  ║  ${C.white}Backend ${C.yellow}   →  http://localhost:5000/api/v1       ║`);
  console.log(`  ╠${line}╣`);
  console.log(`  ║  Press  Ctrl + C  to stop all servers             ║`);
  console.log(`  ╚${line}╝${C.reset}\n`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ts() {
  return `${C.grey}[${new Date().toLocaleTimeString('en-IN', { hour12: false })}]${C.reset}`;
}

// Noisy lines to suppress
const NOISE = [
  'DeprecationWarning', 'ExperimentalWarning',
  'webpack.cache', 'node_modules/.cache',
  'BREAKING CHANGE', 'One CLI flag changed',
];

function log(server, line) {
  if (NOISE.some(n => line.includes(n))) return;
  process.stdout.write(`${ts()} ${server.color}[${server.name}]${C.reset}  ${line}\n`);

  if (server.ready && server.ready.test(line)) {
    status[server.name.trim()] = 'ready';
    process.stdout.write(
      `${ts()} ${server.color}[${server.name}]${C.reset}  ${C.bold}✅  Ready → http://localhost:${server.port}${C.reset}\n`
    );
    checkAllReady();
  }
}

// ── Open browser once both servers are ready ──────────────────────────────────
let browserOpened = false;
function checkAllReady() {
  if (browserOpened) return;
  if (Object.values(status).every(s => s === 'ready')) {
    browserOpened = true;
    setTimeout(() => {
      console.log(`\n${C.bold}${C.yellow}  🚀  All servers ready — opening browser…${C.reset}\n`);
      spawn('cmd', ['/c', 'start', 'http://localhost:3000'], { shell: false }).unref();
    }, 1000);
  }
}

// ── Spawn ─────────────────────────────────────────────────────────────────────
function startServer(server) {
  log(server, `Starting on port ${server.port}…`);

  const proc = spawn(server.cmd, server.args, {
    cwd:   server.cwd,
    shell: true,
    env:   { ...process.env, FORCE_COLOR: '1', ...(server.env || {}) },
  });

  const pipe = (data) =>
    data.toString().split('\n').filter(l => l.trim()).forEach(l => log(server, l));

  proc.stdout.on('data', pipe);
  proc.stderr.on('data', pipe);

  proc.on('error', err =>
    process.stdout.write(`${ts()} ${C.red}[${server.name}] ERROR: ${err.message}${C.reset}\n`)
  );
  proc.on('exit', code => {
    status[server.name.trim()] = 'stopped';
    if (code && code !== 0)
      process.stdout.write(`${ts()} ${C.red}[${server.name}] Exited (code ${code})${C.reset}\n`);
  });

  return proc;
}

// ── Main ──────────────────────────────────────────────────────────────────────
banner();
const procs = SERVERS.map(startServer);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown() {
  console.log(`\n${C.yellow}  Stopping all servers…${C.reset}`);
  procs.forEach(p => { try { p.kill('SIGTERM'); } catch (_) {} });
  setTimeout(() => {
    console.log(`${C.yellow}  Done. Goodbye!${C.reset}\n`);
    process.exit(0);
  }, 1500);
}
process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
