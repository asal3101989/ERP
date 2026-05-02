
// ─────────────────────────────────────────────────────────────
//  BCIM Enterprise — Single Terminal Launcher
//  Runs all 3 servers in one window with coloured output
//  Press Ctrl+C to stop everything
// ─────────────────────────────────────────────────────────────
const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;

// ANSI colour codes
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
};

const SERVERS = [
  {
    label : 'HUB   ',
    port  : 3003,
    color : C.cyan,
    cmd   : 'node',
    args  : ['portal_server.js'],
    cwd   : ROOT,
  },
  {
    label : 'TQS   ',
    port  : 3000,
    color : C.green,
    cmd   : 'node',
    args  : ['server.js'],
    cwd   : path.join(ROOT, 'final01042026'),
  },
  {
    label : 'PROC  ',
    port  : 3001,
    color : C.yellow,
    cmd   : 'node',
    args  : ['server.js'],
    cwd   : path.join(ROOT, 'proc'),
  },
];

// ── Banner ────────────────────────────────────────────────────
const os = require('os');
const localIP = Object.values(os.networkInterfaces()).flat()
  .find(function(i){ return i.family === 'IPv4' && !i.internal; })?.address || 'localhost';

console.log(C.bold + C.white);
console.log('  ╔══════════════════════════════════════════════════════╗');
console.log('  ║          BCIM ENTERPRISE  —  ALL SERVERS             ║');
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log('  ║  ' + C.cyan   + 'HUB PORTAL ' + C.white + '  localhost  →  http://localhost:3003     ║');
console.log('  ║  ' + C.cyan   + '           ' + C.white + '  network   →  http://' + localIP + ':3003  ║');
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log('  ║  ' + C.green  + 'TQS TRACKER' + C.white + '  localhost  →  http://localhost:3000     ║');
console.log('  ║  ' + C.yellow + 'BUILDPRO   ' + C.white + '  localhost  →  http://localhost:3001     ║');
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log('  ║  Admin login:  admin@buildpro.local  /  Admin@1234   ║');
console.log('  ╠══════════════════════════════════════════════════════╣');
console.log('  ║  Press  Ctrl + C  to stop all servers                ║');
console.log('  ╚══════════════════════════════════════════════════════╝');
console.log(C.reset + '');

// ── Helpers ───────────────────────────────────────────────────
function tag(server) {
  return server.color + C.bold + '[' + server.label + ':' + server.port + ']' + C.reset + ' ';
}

function printLines(server, data, isErr) {
  const colour = isErr ? C.red : '';
  data.toString()
    .split('\n')
    .forEach(function(line) {
      const t = line.trim();
      if (t) process.stdout.write(tag(server) + colour + line + C.reset + '\n');
    });
}

// ── Launch each server ────────────────────────────────────────
const procs = [];

SERVERS.forEach(function(srv) {
  console.log(tag(srv) + C.dim + 'Starting...' + C.reset);

  const child = spawn(srv.cmd, srv.args, { cwd: srv.cwd, shell: true });
  procs.push(child);

  child.stdout.on('data', function(d) { printLines(srv, d, false); });
  child.stderr.on('data', function(d) { printLines(srv, d, true);  });

  child.on('close', function(code) {
    const msg = code === 0 ? 'stopped.' : 'exited with code ' + code;
    console.log(tag(srv) + C.red + msg + C.reset);
  });

  child.on('error', function(err) {
    console.error(tag(srv) + C.red + 'Error: ' + err.message + C.reset);
  });
});

// ── Ctrl+C — kill all gracefully ──────────────────────────────
process.on('SIGINT', function() {
  console.log('\n');
  console.log(C.red + C.bold + '  Stopping all servers...' + C.reset);
  procs.forEach(function(p) { try { p.kill('SIGTERM'); } catch (_) {} });
  setTimeout(function() { process.exit(0); }, 800);
});
