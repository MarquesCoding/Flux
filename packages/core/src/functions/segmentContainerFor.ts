import type { DeviceProfile } from '@FluxContracts/schemas/DeviceProfile';

type SegmentContainer = 'fmp4' | 'mpegts';

/**
 * Decides what to wrap a client's segments in.
 *
 * Fragmented MP4 unless the client asks for transport streams, because it is the container that
 * carries the most: AV1 has no practical mapping into MPEG-TS at all, nor do Opus and FLAC, and
 * Apple's HLS authoring rules require fMP4 for HEVC, which is the whole native path on iOS and
 * tvOS. A transport stream also costs a few percent of packet overhead and has to be transmuxed in
 * the browser before anything can decode it.
 *
 * Flux delivered every segment as MPEG-TS for a while because a copied open-GOP HEVC film stopped
 * twenty-three seconds in as fragmented MP4. The container was not the fault: the segments were
 * opening on cuts a decoder cannot start at, and the media service refuses those before it agrees
 * to copy a source. See FLUX-124.
 *
 * @param profile - What the device says it can play.
 * @returns The container to ask the media service for.
 */
const segmentContainerFor = (profile: DeviceProfile): SegmentContainer => {
  const streamed = profile.transcodingProfiles.find((candidate) => candidate.protocol === 'hls');

  return streamed?.container === 'ts' ? 'mpegts' : 'fmp4';
};

export type { SegmentContainer };

export { segmentContainerFor };
