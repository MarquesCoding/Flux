const RELEASES = 'https://github.com/ValenceOSS/valence-ffmpeg/releases/download';

const SUITE = 'bookworm';

const DEBIAN_ARCHITECTURES: Record<string, string> = {
  x64: 'amd64',
  arm64: 'arm64',
};

type FfmpegDownload =
  | { kind: 'tarball'; url: string; fileName: string }
  | { kind: 'deb'; url: string; fileName: string }
  | { kind: 'unsupported'; message: string };

type PlanFfmpegDownloadOptions = {
  platform: string;
  arch: string;
  version: string;
};

/**
 * Chooses which release artefact this machine needs, or says why there is not one.
 *
 * macOS takes the portable tarball and Linux the deb, because those are the two the fork builds.
 * The asymmetry is not an oversight: a Mac cannot use a deb at all, and it is the platform that
 * most needs its own build, since VideoToolbox cannot be reached from inside a container.
 *
 * @param options - What this machine is, and which version is pinned.
 * @returns Where to fetch the artefact, or the reason there is none to fetch.
 */
const planFfmpegDownload = ({
  platform,
  arch,
  version,
}: PlanFfmpegDownloadOptions): FfmpegDownload => {
  if (platform === 'darwin') {
    if (arch !== 'arm64') {
      return {
        kind: 'unsupported',
        message: [
          `This is an Intel Mac, and valence-ffmpeg builds Apple silicon only.`,
          'Every VideoToolbox measurement so far is on Apple silicon and there is no Intel Mac to',
          'verify against, so no Intel artefact is published rather than one nobody has run.',
        ].join('\n'),
      };
    }

    const fileName = `valence-ffmpeg_${version}_portable_macarm64-gpl.tar.xz`;

    return { kind: 'tarball', url: `${RELEASES}/v${version}/${fileName}`, fileName };
  }

  if (platform === 'linux') {
    const debianArch = DEBIAN_ARCHITECTURES[arch];

    if (debianArch === undefined) {
      return {
        kind: 'unsupported',
        message: `valence-ffmpeg publishes amd64 and arm64 for Linux, and this machine is ${arch}.`,
      };
    }

    const fileName = `valence-ffmpeg_${version}-${SUITE}_${debianArch}.deb`;

    return { kind: 'deb', url: `${RELEASES}/v${version}/${fileName}`, fileName };
  }

  return {
    kind: 'unsupported',
    message: [
      `valence-ffmpeg publishes Linux and macOS builds, and this machine is ${platform}.`,
      'Run Valence in the container, which carries the build already.',
    ].join('\n'),
  };
};

export type { FfmpegDownload, PlanFfmpegDownloadOptions };

export { planFfmpegDownload, SUITE };
