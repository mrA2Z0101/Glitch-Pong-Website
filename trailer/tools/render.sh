#!/bin/bash
# Concatenate scene frames in order and encode the final 1080p trailer with the mix.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEQ="$ROOT/seq"; rm -rf "$SEQ"; mkdir -p "$SEQ"
n=0
for s in $(python3 -c "import json;print(' '.join(json.load(open('$ROOT/out/timeline.json'))['scenes']))"); do
  for f in $(ls "$ROOT/fx/$s"/*.jpg | sort); do ln -s "$f" "$SEQ/$(printf %05d $n).jpg"; n=$((n+1)); done
done
echo "frames: $n"
ffmpeg -v error -y -framerate 30 -i "$SEQ/%05d.jpg" -i "$ROOT/out/trailer_mix.wav" \
  -vf "scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 17 -profile:v high -movflags +faststart \
  -af "volume=3.90dB,alimiter=limit=0.89:attack=2:release=60:level=disabled" -c:a aac -b:a 256k -ar 48000 -shortest "$ROOT/out/glitch-pong-trailer.mp4"
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of compact "$ROOT/out/glitch-pong-trailer.mp4"
