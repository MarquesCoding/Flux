import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { planTranscoderDev } from './planTranscoderDev';

const ROOT = join(import.meta.dirname, '..', '..');

/**
 * Loads the same file the server reads.
 *
 * Cargo has no notion of `.env`, so without this the media service would start
 * with none of the configuration the rest of the stack has and bind the
 * packaged socket path, which is the mismatch this whole script exists to
 * prevent.
 */
const loadEnvFile = (): void => {
  const path = join(ROOT, '.env');

  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
};

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
