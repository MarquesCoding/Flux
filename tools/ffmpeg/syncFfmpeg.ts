import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { envFileWithFfmpeg } from './envFileWithFfmpeg';
import { pinnedFfmpegVersion } from './pinnedFfmpegVersion';
import { planFfmpegDownload } from './planFfmpegDownload';

const ROOT = join(import.meta.dirname, '..', '..');

const INSTALL_DIR = join(ROOT, '.ffmpeg');

const PAYLOAD = 'data.tar.xz';

const say = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * Runs a command, failing the sync with its own output rather than a stack trace.
 *
 * @param command - The command to run.
 * @param args - Its arguments.
 * @param cwd - Where to run it.
 * @throws If the command is missing or exits non-zero.
 */
const run = (command: string, args: string[], cwd: string): void => {
  const outcome = spawnSync(command, args, { cwd, stdio: 'inherit' });

  if (outcome.error !== undefined) {
    throw new Error(`${command} is not on this machine, and the sync needs it to unpack a build.`);
  }

  if (outcome.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed.`);
  }
};

/**
 * Whether a command answers on this machine.
 *
 * @param command - The command to look for.
 * @returns Whether it ran.
 */
const isAvailable = (command: string): boolean =>
  spawnSync(command, ['--version'], { stdio: 'ignore' }).error === undefined;

/**
 * Unpacks a deb into the install directory, keeping the package's own layout.
 *
 * The whole `usr/lib/valence-ffmpeg` tree rather than the two binaries, because they carry an rpath
 * into the `lib` directory beside them and are not runnable without it.
 *
 * @param archive - The downloaded deb.
 * @throws If neither dpkg-deb nor ar is installed.
 */
const unpackDeb = (archive: string): void => {
  if (isAvailable('dpkg-deb')) {
    run('dpkg-deb', ['-x', archive, INSTALL_DIR], ROOT);
  } else if (isAvailable('ar')) {
    run('ar', ['x', archive, PAYLOAD], INSTALL_DIR);
    run('tar', ['-xf', PAYLOAD], INSTALL_DIR);
    rmSync(join(INSTALL_DIR, PAYLOAD));
  } else {
    throw new Error(
      [
        'Unpacking a deb needs dpkg-deb or ar, and this machine has neither.',
        'Install binutils, or install the deb itself with apt.',
      ].join('\n'),
    );
  }
};

const version = pinnedFfmpegVersion(readFileSync(join(ROOT, 'Dockerfile'), 'utf8'));

const plan = planFfmpegDownload({
  platform: process.platform,
  arch: process.arch,
  version,
});

if (plan.kind === 'unsupported') {
  process.stderr.write(`${plan.message}\n`);
  process.exit(1);
}

say(`valence-ffmpeg ${version} for ${process.platform} ${process.arch}`);

rmSync(INSTALL_DIR, { recursive: true, force: true });
mkdirSync(INSTALL_DIR, { recursive: true });

const archive = join(INSTALL_DIR, plan.fileName);

say(`fetching ${plan.url}`);

const response = await fetch(plan.url);

if (!response.ok) {
  process.stderr.write(
    [
      `The release has no ${plan.fileName} (HTTP ${response.status}).`,
      'Either the version pinned in the Dockerfile was never released, or that build did not',
      'publish this platform.',
    ].join('\n') + '\n',
  );
  process.exit(1);
}

writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

if (plan.kind === 'tarball') {
  run('tar', ['-xf', plan.fileName], INSTALL_DIR);
} else {
  unpackDeb(archive);
}

rmSync(archive, { force: true });

const packaged = join(INSTALL_DIR, 'usr', 'lib', 'valence-ffmpeg');

const prefix = existsSync(packaged) ? packaged : INSTALL_DIR;

const ffmpeg = join(prefix, 'ffmpeg');

const ffprobe = join(prefix, 'ffprobe');

if (!existsSync(ffmpeg) || !existsSync(ffprobe)) {
  process.stderr.write(`The archive unpacked without an ffmpeg and ffprobe in ${prefix}.\n`);
  process.exit(1);
}

run(ffmpeg, ['-hide_banner', '-version'], ROOT);

const envPath = join(ROOT, '.env');

if (existsSync(envPath)) {
  const updated = envFileWithFfmpeg({
    existing: readFileSync(envPath, 'utf8'),
    ffmpeg,
    ffprobe,
  });

  if (updated === undefined) {
    say('.env already sets VALENCE_FFMPEG or VALENCE_FFPROBE, so it was left alone.');
    say(`Point them at ${prefix} if that was not deliberate.`);
  } else {
    writeFileSync(envPath, updated);
    say('.env now points at this build.');
  }
} else {
  say('There is no .env yet. Copy .env.example to .env, then add:');
  say(`  VALENCE_FFMPEG=${ffmpeg}`);
  say(`  VALENCE_FFPROBE=${ffprobe}`);
}
