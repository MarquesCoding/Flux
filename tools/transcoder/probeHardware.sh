#!/usr/bin/env bash

# Reports what a machine's video hardware can actually do, using the same
# ffmpeg, the same render node and the same probe arguments as the media
# service. Run it inside the Flux image, on a host with a GPU passed through.
#
# set -u is the point of this file existing. The first attempt at checking an
# RX 580 was an ad hoc compose file that used an unset $FF, so every probe ran
# as `-hide_banner ...` and reported FAILS. Three sections produced no result
# and the machine was returned before anyone noticed. A missing variable has to
# stop this script, not decorate it.
set -euo pipefail

FFMPEG="${FLUX_FFMPEG:-/usr/lib/flux-ffmpeg/ffmpeg}"
DEVICE="${FLUX_VAAPI_DEVICE:-/dev/dri/renderD128}"

# Matches PROBE_SIZE in apps/transcoder/src/capability.rs. Kept in step by hand,
# because a probe that passes here and fails in the service is worse than no
# probe at all. See FLUX-85 for what a too-small picture costs.
PROBE_SIZE=640x480

VAAPI_ENCODERS=(h264_vaapi hevc_vaapi av1_vaapi)

heading() {
  printf '\n=== %s ===\n' "$1"
}

# Aborts rather than letting a missing binary read as a hardware fault.
require_executable() {
  local path="$1" variable="$2"

  if [ ! -x "$path" ]; then
    printf 'cannot run: %s is not executable\n' "$path" >&2
    printf 'set %s to the ffmpeg this image ships, or run inside the Flux image\n' "$variable" >&2
    exit 1
  fi
}

# The last non-empty line of a complaint, which is usually the useful one.
# Mirrors summarise_failure in apps/transcoder/src/capability.rs.
last_line() {
  printf '%s\n' "$1" | grep -v '^[[:space:]]*$' | tail -n 1 || true
}

# Reproduces probe_arguments from apps/transcoder/src/capability.rs.
#
# `vaapi` names a device and uploads the frame to it, which is what the service
# does for a backend whose needs_device_to_probe is true. `bare` is the same
# probe without either, kept so the difference stays visible on any machine
# rather than being something one AMD box demonstrated once.
probe_encoder() {
  local encoder="$1" mode="$2"
  local -a arguments=(-hide_banner -loglevel error)

  if [ "$mode" = vaapi ]; then
    arguments+=(-init_hw_device "vaapi=va:$DEVICE" -filter_hw_device va)
  fi

  arguments+=(-f lavfi -i "testsrc2=size=$PROBE_SIZE:rate=1" -frames:v 1)

  if [ "$mode" = vaapi ]; then
    arguments+=(-vf format=nv12,hwupload)
  fi

  arguments+=(-c:v "$encoder" -f null -)

  local complaint status=0
  complaint="$("$FFMPEG" "${arguments[@]}" 2>&1 >/dev/null)" || status=$?

  if [ "$status" -eq 0 ]; then
    printf '  %-14s VERIFIES\n' "$encoder"
    return 0
  fi

  printf '  %-14s FAILS — %s\n' "$encoder" "$(last_line "$complaint")"
}

require_executable "$FFMPEG" FLUX_FFMPEG

heading 'the card, and the render node the transcoder will open'
ls -l /dev/dri || printf 'no /dev/dri — pass the device through\n'
printf '\nFLUX_VAAPI_DEVICE=%s\n' "$DEVICE"

if [ ! -e "$DEVICE" ]; then
  printf 'that node does not exist, so every VAAPI result below is meaningless\n' >&2
fi

if command -v lspci >/dev/null; then
  lspci -nn | grep -Ei 'vga|display|3d' || true
else
  printf 'lspci not installed, skipping the card name\n'
fi

heading 'which ffmpeg this is'
"$FFMPEG" -hide_banner -version | head -n 2

# Only where drivers actually live. Scanning from / walks every mounted media
# volume on a NAS, which is where this script is most likely to be run.
heading 'VA drivers this image can reach'
driver_directories=(
  "$(dirname "$FFMPEG")/lib/dri"
  /usr/lib/x86_64-linux-gnu/dri
  /usr/lib/aarch64-linux-gnu/dri
  /usr/local/lib/x86_64-linux-gnu/dri
)

if [ -n "${LIBVA_DRIVERS_PATH:-}" ]; then
  driver_directories+=("$LIBVA_DRIVERS_PATH")
fi

searched=0

for directory in "${driver_directories[@]}"; do
  if [ -d "$directory" ]; then
    searched=1
    found="$(find "$directory" -maxdepth 1 -name '*_drv_video.so' -exec basename {} \; | sort || true)"
    printf '%s:\n' "$directory"
    printf '%s\n' "${found:-  none}" | sed 's/^\([^ ]\)/  \1/'
  fi
done

if [ "$searched" -eq 0 ]; then
  printf 'none of the usual driver directories exist on this machine\n'
fi

heading 'what the card reports'
VAINFO="$(dirname "$FFMPEG")/vainfo"

if [ -x "$VAINFO" ]; then
  "$VAINFO" --display drm --device "$DEVICE" || true
elif command -v vainfo >/dev/null; then
  vainfo --display drm --device "$DEVICE" || true
else
  printf 'no vainfo alongside %s and none on PATH, skipping\n' "$FFMPEG"
fi

heading 'hardware encoders compiled into this build'
"$FFMPEG" -hide_banner -encoders |
  grep -E '(vaapi|amf|qsv|nvenc|videotoolbox|rkmpp)' || printf 'none\n'

# An encoder absent from the list above cannot verify below, and its failure
# says nothing about the hardware. Read the two sections together.

heading 'encoders WITHOUT a device — what a deviceless probe reports'
for encoder in "${VAAPI_ENCODERS[@]}"; do
  probe_encoder "$encoder" bare
done

heading 'encoders WITH a device — what the transcoder actually does'
for encoder in "${VAAPI_ENCODERS[@]}"; do
  probe_encoder "$encoder" vaapi
done

# FLUX-79. The probes above prove an encoder opens; this proves decode, scale
# and encode can pass frames without a round trip through system memory, which
# is the difference the pipeline was built for. It needs a real encoded input,
# so lavfi output is written to a file first — decoding a software-generated
# frame would test nothing.
heading 'the zero-copy chain'
WORKSPACE="$(mktemp -d)"
trap 'rm -rf "$WORKSPACE"' EXIT

SAMPLE="$WORKSPACE/sample.mp4"

if "$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i testsrc2=size=1280x720:rate=25 -frames:v 50 \
  -c:v libx264 -preset ultrafast "$SAMPLE" 2>/dev/null; then
  chain_complaint=''
  chain_status=0
  chain_complaint="$("$FFMPEG" -hide_banner -loglevel error \
    -init_hw_device "vaapi=va:$DEVICE" -filter_hw_device va \
    -hwaccel vaapi -hwaccel_output_format vaapi \
    -i "$SAMPLE" \
    -vf 'scale_vaapi=w=640:h=360:format=nv12' \
    -c:v h264_vaapi -frames:v 25 -f null - 2>&1 >/dev/null)" || chain_status=$?

  if [ "$chain_status" -eq 0 ]; then
    printf '  decode → scale_vaapi → encode: WORKS, frames stayed on the device\n'
  else
    printf '  decode → scale_vaapi → encode: FAILS — %s\n' "$(last_line "$chain_complaint")"
  fi
else
  printf '  could not build a sample to decode, so the chain was not tested\n'
fi

heading 'done'
