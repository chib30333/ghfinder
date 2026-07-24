import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { config } from '@ghfinder/core';

const ROOT = config.root;
const MAX_LINES = 500;

class Job extends EventEmitter {
  constructor(kind) {
    super();
    this.setMaxListeners(0);
    this.kind = kind;
    this.reset();
  }

  reset() {
    this.status = 'idle';
    this.child = null;
    this.lines = [];
    this.startedAt = null;
    this.endedAt = null;
    this.exitCode = null;
    this.argv = null;
  }

  get running() {
    return this.status === 'running';
  }

  push(stream, text) {
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const entry = { t: Date.now(), stream, line };
      this.lines.push(entry);
      if (this.lines.length > MAX_LINES) this.lines.shift();
      this.emit('line', entry);
    }
  }

  start(argv) {
    if (this.running) throw new Error(`a ${this.kind} job is already running`);
    this.reset();
    this.status = 'running';
    this.startedAt = Date.now();
    this.argv = argv;

    const child = spawn(process.execPath, argv, { cwd: ROOT, env: process.env });
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => this.push('stdout', d));
    child.stderr.on('data', (d) => this.push('stderr', d));
    child.on('error', (err) => this.push('stderr', `spawn error: ${err.message}`));
    child.on('exit', (code, signal) => {
      this.status = signal ? 'stopped' : code === 0 ? 'done' : 'failed';
      this.exitCode = code;
      this.endedAt = Date.now();
      this.child = null;
      this.emit('end', { status: this.status, code, signal });
    });

    return this.state();
  }

  stop() {
    if (!this.running || !this.child) return false;
    const child = this.child;
    try { child.kill('SIGINT'); } catch { }
    setTimeout(() => {
      if (child && !child.killed) {
        try { child.kill(); } catch { }
      }
    }, 8000);
    return true;
  }

  state() {
    return {
      kind: this.kind,
      status: this.status,
      running: this.running,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exitCode: this.exitCode,
      argv: this.argv,
      lineCount: this.lines.length,
    };
  }
}

class Registry {
  constructor() {
    this.map = new Map();
  }

  job(kind) {
    if (!this.map.has(kind)) this.map.set(kind, new Job(kind));
    return this.map.get(kind);
  }

  stopAll() {
    for (const j of this.map.values()) j.stop();
  }
}

export const jobs = new Registry();
