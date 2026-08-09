# ADR-0010: Codec, container, subtitle and HDR support targets

- **Status:** Accepted
- **Date:** 2026-08-09

## Context

The requirement is parity with Jellyfin's format support, plus meaningful
improvement. Parity is table stakes: a user migrating whose library plays today
and does not play on ours will simply migrate back. Improvement needs to be
targeted at Jellyfin's actual documented gaps rather than at whatever is easiest.

Research into Jellyfin's current capabilities and limitations produced a clear
picture of both. Sources are listed at the end of this ADR.

## Decision

### Part 1 — Parity baseline

**Hardware acceleration.** Support all six of Jellyfin's backends, plus V4L2M2M
for ARM single-board computers as a best-effort tier:

| Vendor   | Windows     | macOS        | Linux                            |
| -------- | ----------- | ------------ | -------------------------------- |
| Intel    | QSV         | VideoToolbox | QSV, VAAPI                       |
| AMD      | AMF         | VideoToolbox | VAAPI (AMF where driver permits) |
| NVIDIA   | NVENC/NVDEC | —            | NVENC/NVDEC                      |
| Apple    | —           | VideoToolbox | —                                |
| Rockchip | —           | —            | RKMPP                            |

Known constraints to encode into the capability model rather than rediscover:
NVIDIA does not support H.264 10-bit; AMD's Linux AMF path lacks a hardware
decoder and scaler in FFmpeg, so decode performance is poor and VAAPI is
generally preferred there; AMF on Linux requires the closed-source
`amdgpu-pro` driver.

**Video decode.** H.264, HEVC (8/10-bit), VP8, VP9, AV1, MPEG-2, MPEG-4 Part 2,
VC-1, Theora, plus the long tail FFmpeg provides. AV1 software decode uses
`dav1d`, which is substantially faster than software HEVC or VP9 decode.

**Video encode.** H.264, HEVC, AV1, VP9. AV1 hardware encode where available
(Intel Arc via oneVPL, AMD RDNA 3 / Radeon RX 7000 and Ryzen 7000+, NVIDIA Ada
and later); `SVT-AV1` for software, with the caveat that software AV1 is 5–10x
slower than HEVC and is therefore not a real-time transcode target on typical
homelab hardware.

**Audio.** AAC, MP3, FLAC, ALAC, Opus, Vorbis, AC3, E-AC3, TrueHD, DTS,
DTS-HD MA, PCM, and Atmos as carried in E-AC3 JOC / TrueHD.

**Containers.** MP4, MKV, WebM, MPEG-TS, M2TS, MOV, AVI, FLV, OGV, 3GP,
ASF/WMV, plus HLS (fMP4 and TS) and DASH as output.

**Subtitles.** Text: SRT, WebVTT, ASS/SSA, TTML/DFXP, MOV_TEXT, SAMI.
Image: VobSub (SUB/IDX), PGS, DVBSUB. Burn-in required where the container or
client cannot carry the format — the most expensive path, and one the negotiator
must avoid whenever a sidecar or remux will do.

**HDR formats.** HDR10, HDR10+, HLG, Dolby Vision profiles 5, 7 and 8.

### Part 2 — Where we go beyond Jellyfin

These four targets come directly from documented Jellyfin limitations.

**1. HDR-to-HDR transcoding and HDR metadata passthrough.**
This is the headline gap. Jellyfin cannot preserve HDR metadata or transcode
HDR to HDR; every HDR transcode is tone-mapped to SDR. A user with an HDR TV
that needs only a bitrate reduction loses HDR entirely. We support preserving
static HDR10 metadata (MaxCLL/MaxFALL, mastering display) and HLG through a
transcode, and preserving HDR10+ and Dolby Vision RPU where the codec path
allows it. Tone-mapping to SDR remains the fallback for genuinely SDR-only
clients, not the only behaviour.

**2. Never strip audio to fix a video problem.**
Jellyfin's Android TV client has a documented issue where HDR10+ and other HDR
formats trigger a transcode or remux via `VideoRangeTypeNotSupported`, and Atmos
and lossless audio metadata are stripped as a side effect. Our negotiator treats
video, audio, subtitle, and container decisions as **independent axes**. A video
range mismatch must never cause an audio re-encode. This is enforced by the plan
structure in ADR-0011, not by care.

**3. Tone-mapping quality and cost as an explicit, tunable decision.**
Jellyfin's tone-mapping performance varies enormously by hardware — on older
Intel iGPUs such as UHD 630, enabling tone-mapping can drop capacity from three
concurrent streams to one, because those chips do it on general-purpose
execution units. We expose the tone-mapping algorithm and its cost tier as
explicit configuration, measure actual throughput during capability probing
(ADR-0009), and factor the measured cost into the concurrent-session limit
rather than using a fixed count.

**4. AV1 as a first-class encode target, honestly presented.**
Supported where hardware allows, with the UI clearly stating when AV1 encode
would be software and therefore not real-time. Users should not be able to
select a setting that silently makes playback fail.

### Part 3 — Explicitly out of scope

**DRM (Widevine, PlayReady, FairPlay).** Widevine L1/L3 certification is not
practically obtainable for an open-source self-hosted project. We do not design
around it. Any encrypted-content feature would be a plugin against a licence the
operator holds themselves.

**Writing to the user's library.** Per ADR-0006, `/media` is read-only. No
transcode output, sidecar, or metadata file is ever written there.

## Consequences

### What this gets us

Migration parity, so a Jellyfin user's library plays on day one. Four concrete,
demonstrable improvements over the incumbent that address complaints its users
actually file, rather than features nobody asked for.

### What this costs us

HDR passthrough is genuinely difficult. Dolby Vision RPU handling in particular
is poorly served by tooling, is profile-dependent, and carries real risk of
producing output that plays but looks wrong — which is worse than refusing.
Expect this to be the single largest engineering effort in the media pipeline,
and plan for a staged delivery: HDR10 static metadata first, HLG second,
HDR10+ third, Dolby Vision last and possibly per-profile.

The support matrix is large and combinatorial. It requires a real test corpus of
sample files covering every codec, HDR format, subtitle type, and container we
claim, run in CI. Without that corpus, "supported" is an assertion rather than a
fact, and regressions will ship.

### What this forecloses

Any commercial streaming integration, and any feature that requires frame-level
processing beyond what FFmpeg filter graphs provide (ADR-0009).

## Alternatives considered

**Match Jellyfin exactly and go no further.** Rejected — parity alone gives a
user no reason to switch.

**Lead with AV1 everywhere as the differentiator.** Rejected as the headline.
Hardware AV1 encode is still uncommon in homelab hardware, and software AV1 is
too slow for real-time. HDR passthrough affects far more users today.

**Skip HDR passthrough as too hard.** Tempting, and it is the hardest item here.
Rejected because it is the most-cited limitation of the incumbent and therefore
the clearest reason for a user to switch.

## Revisit when

- Hardware AV1 encode becomes common in typical homelab hardware.
- Dolby Vision RPU tooling matures, or proves genuinely impractical.
- The FFmpeg build we ship gains or loses a capability this ADR assumes.

## Sources

- [Hardware Acceleration | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/)
- [Codec Support | Jellyfin](https://jellyfin.org/docs/general/clients/codec-support/)
- [Transcoding | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/)
- [NVIDIA GPU | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/nvidia/)
- [Intel GPU | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/intel/)
- [AMD GPU | Jellyfin](https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/amd/)
- [HDR10+ and other HDR formats trigger transcode/remux due to `VideoRangeTypeNotSupported` — jellyfin-androidtv #5517](https://github.com/jellyfin/jellyfin-androidtv/issues/5517)
- [HDR Tone Mapping is very slow in Jellyfin compared to Plex — jellyfin #5067](https://github.com/jellyfin/jellyfin/issues/5067)
- [Intel VPP tone mapping is not being applied to plain HDR10 — jellyfin #16714](https://github.com/jellyfin/jellyfin/issues/16714)
- [AV1 on Jellyfin 2026: hardware support and encode tests — JellyWatch](https://jellywatch.app/blog/av1-codec-jellyfin-future-streaming-encode-decode-2026)
- [Jellyfin 4K HDR and Dolby Vision Setup Guide (2026) — JellyWatch](https://jellywatch.app/blog/jellyfin-4k-hdr-dolby-vision-setup-guide-2026)
