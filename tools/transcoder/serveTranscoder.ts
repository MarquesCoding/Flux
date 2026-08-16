import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { planTranscoderDev } from './planTranscoderDev';

const ROOT = join(import.meta.dirname, '..', '..');

/**
 * Loads the same environment file the server reads, so that the transcoder started for development
 * agrees with it about ports and paths rather than being configured twice.
 */
const loadEnvFile = (): void => {
  const path = join(ROOT, '.env');

  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
};

/**
 * Whether Rust is on this machine, asked by running cargo rather than by looking for a file, since
 * that is the same question the build itself will ask.
 *
 * @returns Whether cargo answers.
 */
const isRustInstalled = (): boolean =>
  spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;

loadEnvFile();

const plan = planTranscoderDev({
  transcoderUrl: process.env['TRANSCODER_URL'],
  isRustInstalled: isRustInstalled(),
});

if (plan.kind === 'stop') {
  process.stderr.write(`${plan.message}\n`);
  process.exit(1);
}

if (plan.kind === 'skip') {
  process.stdout.write(`${plan.message}\n`);
  process.exit(0);
}

const child = spawn('cargo', ['run', '--quiet', '--bin', 'flux-transcoder', '--', 'serve'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  process.exit(signal === null ? (code ?? 0) : 1);
});
