import type { AudioSpec, Fixture, VideoSpec } from './fixtureMatrix';

const VIDEO_ENCODERS: Record<VideoSpec['codec'], string> = {
  h264: 'libx264',
  hevc: 'libx265',
  av1: 'libsvtav1',
  vp9: 'libvpx-vp9',
  mpeg4: 'mpeg4',
  mpeg1video: 'mpeg1video',
};

const AUDIO_ENCODERS: Record<AudioSpec['codec'], string> = {
  aac: 'aac',
  ac3: 'ac3',
  eac3: 'eac3',
  truehd: 'truehd',
  dts: 'dca',
  opus: 'libopus',
  flac: 'flac',
  mp2: 'mp2',
};

const RANGE_TAGS: Record<VideoSpec['range'], readonly string[]> = {
  SDR: [],
  HDR10: ['-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc'],
  HLG: ['-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc'],
};

const MASTERING_DISPLAY =
  'master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,1)';

const COLOUR_PARAMS: Record<VideoSpec['range'], readonly string[]> = {
  SDR: [],
  HDR10: [
    'colorprim=bt2020',
    'transfer=smpte2084',
    'colormatrix=bt2020nc',
    MASTERING_DISPLAY,
    'max-cll=1000,400',
    'hdr10=1',
  ],
  HLG: ['colorprim=bt2020', 'transfer=arib-std-b67', 'colormatrix=bt2020nc'],
};

/**
 * The pixel format a video specification needs.
 *
 * VP9 and AV1 are asked for the same eight bit format as the others so that bit depth stays an axis
 * of its own rather than something a codec choice drags along with it.
 *
 * @param video - What the video should be.
 * @returns The `-pix_fmt` value.
 */
const pixelFormat = (video: VideoSpec): string =>
  video.bitDepth === 10 ? 'yuv420p10le' : 'yuv420p';

/**
 * How many frames apart this fixture's keyframes should be.
 *
 * @param video - What the video should be.
 * @returns The interval, in frames.
 */
const keyframeInterval = (video: VideoSpec): number =>
  Math.max(1, Math.round(video.keyframeSeconds * video.frameRate));

/**
 * The encoder settings that put the keyframes where they were asked for, and open or close the GOP.
 *
 * This is the axis VAL-124 turned on and the corpus exists to vary. x264 closes its GOPs unless
 * told otherwise and x265 opens them, so neither default can be relied on — both are stated.
 *
 * SVT-AV1 and VP9 have no open GOP to ask for, so they take the interval alone and the matrix does
 * not claim to vary their GOP structure.
 *
 * The colour parameters ride along here because both encoders write their range into the bitstream
 * rather than taking it from the container: setting only the container tags produced files that
 * ffprobe read back as SDR.
 *
 * @param video - What the video should be.
 * @returns The codec-specific arguments.
 */
const gopArguments = (video: VideoSpec): string[] => {
  const interval = keyframeInterval(video);
  const open = video.gop === 'open' ? 1 : 0;

  const shared = [
    `keyint=${interval.toString()}`,
    `min-keyint=${interval.toString()}`,
    'scenecut=0',
    `open-gop=${open.toString()}`,
  ];

  if (video.codec === 'h264') {
    const params = [
      ...shared,
      'threads=1',
      ...(video.refFrames > 0 ? [`ref=${video.refFrames.toString()}`] : []),
      ...COLOUR_PARAMS[video.range],
    ];

    return ['-x264-params', params.join(':')];
  }

  if (video.codec === 'hevc') {
    const params = [
      ...shared,
      'log-level=error',
      'pools=1',
      'frame-threads=1',
      ...COLOUR_PARAMS[video.range],
    ];

    return ['-x265-params', params.join(':')];
  }

  if (video.codec === 'av1') {
    return ['-g', interval.toString(), '-svtav1-params', 'lp=1'];
  }

  return ['-g', interval.toString(), '-keyint_min', interval.toString(), '-threads', '1'];
};

/**
 * The filter chain a fixture's picture needs, if any.
 *
 * Scan and frame timing are properties of the frames rather than of the encoder, so they are
 * produced by filtering the synthetic source rather than by asking the codec for them. Telecine is
 * the 3:2 pulldown that puts 24fps film onto 30fps broadcast, and it produces a file whose frames
 * are neither wholly progressive nor wholly interlaced — the case a deinterlacer has to detect
 * rather than assume.
 *
 * The uneven presentation times of the variable timing fixture are deliberate: a file whose frames
 * arrive at irregular intervals is what breaks a segmenter that assumes otherwise.
 *
 * @param video - What the video should be.
 * @returns The filter and flag arguments, or nothing where the picture needs neither.
 */
const filterArguments = (video: VideoSpec): string[] => {
  const filters: string[] = [];

  if (video.scan === 'interlaced') {
    filters.push('interlace=scan=tff');
  }

  if (video.scan === 'telecined') {
    filters.push('telecine=pattern=23');
  }

  if (video.timing === 'variable') {
    filters.push('setpts=PTS*(1+0.15*sin(N/8))');
  }

  if (video.pixelAspect !== '1/1') {
    filters.push(`setsar=${video.pixelAspect}`);
  }

  const flags = video.scan === 'interlaced' ? ['-top', '1', '-flags', '+ilme+ildct'] : [];
  const timing = video.timing === 'variable' ? ['-fps_mode', 'passthrough'] : [];

  return [...(filters.length > 0 ? ['-vf', filters.join(',')] : []), ...flags, ...timing];
};

const SIDE_SURROUND_ONLY: readonly AudioSpec['codec'][] = ['truehd', 'dts'];

/**
 * The channel layout an audio specification wants.
 *
 * TrueHD and DTS accept `5.1(side)` and refuse plain `5.1`, which is the same six channels with the
 * surrounds behind rather than beside. Asking either for the layout it does not know fails with a
 * bare "Invalid argument" that mentions neither channels nor layout, so the distinction is made
 * here rather than left to be rediscovered.
 *
 * @param audio - What the audio should be.
 * @returns The layout name FFmpeg knows it by.
 */
const channelLayout = (audio: AudioSpec): string => {
  if (audio.channels !== 6) {
    return 'stereo';
  }

  return SIDE_SURROUND_ONLY.includes(audio.codec) ? '5.1(side)' : '5.1';
};

/**
 * The inputs a fixture is built from, and the maps that select them.
 *
 * A second audio track is a second synthetic source rather than a copy of the first, so the two are
 * distinguishable by ear and by checksum. Both are labelled with a language, because a track with
 * none is a different case from a track with the wrong one.
 *
 * @param fixture - The fixture being built.
 * @returns The input and mapping arguments.
 */
const inputArguments = (fixture: Fixture): string[] => {
  const { video, audio } = fixture;

  const inputs = [
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=${video.width.toString()}x${video.height.toString()}:rate=${video.frameRate.toString()}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=${audio.sampleRate.toString()}`,
  ];

  if (audio.tracks < 2) {
    return inputs;
  }

  return [
    ...inputs,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=880:sample_rate=${audio.sampleRate.toString()}`,
    '-map',
    '0:v',
    '-map',
    '1:a',
    '-map',
    '2:a',
    '-metadata:s:a:0',
    'language=eng',
    '-metadata:s:a:1',
    'language=deu',
  ];
};

/**
 * Builds the whole FFmpeg invocation that produces one fixture.
 *
 * Both sources are synthetic and deterministic, and every encoder is pinned to a single thread, so
 * the same FFmpeg build produces the same bytes every time. That is what lets the manifest's
 * checksums mean something for generated fixtures: a mismatch says the encoder changed underneath
 * us rather than that somebody tampered with a download.
 *
 * @param fixture - The fixture to build.
 * @param outputPath - Where to write it.
 * @returns The arguments to pass to FFmpeg, without the binary itself.
 */
const fixtureArguments = (fixture: Fixture, outputPath: string): string[] => {
  const { video, audio } = fixture;

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputArguments(fixture),
    '-t',
    fixture.durationSeconds.toString(),
    '-c:v',
    VIDEO_ENCODERS[video.codec],
    '-pix_fmt',
    pixelFormat(video),
    ...gopArguments(video),
    ...filterArguments(video),
    ...RANGE_TAGS[video.range],
    ...(video.level === '' ? [] : ['-level', video.level]),
    ...(video.rotationDegrees === 0
      ? []
      : ['-metadata:s:v:0', `rotate=${video.rotationDegrees.toString()}`]),
    ...(fixture.startOffsetSeconds === 0
      ? []
      : ['-output_ts_offset', fixture.startOffsetSeconds.toString()]),
    ...(fixture.negativeCtsOffsets ? ['-movflags', '+negative_cts_offsets'] : []),
    '-c:a',
    AUDIO_ENCODERS[audio.codec],
    '-ac',
    audio.channels.toString(),
    '-ar',
    audio.sampleRate.toString(),
    '-channel_layout',
    channelLayout(audio),
    '-strict',
    '-2',
    outputPath,
  ];
};

export { fixtureArguments, keyframeInterval, pixelFormat };
