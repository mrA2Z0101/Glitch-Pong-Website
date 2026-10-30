#!/bin/bash
# Encode one vertical short (1080x1920, 30fps, -14 LUFS) from its frames and mix.
# Usage: ./render_short.sh <name>   (run mix_short.py first; name = v_tired, v_real_teaser, ...)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAME="$1"; OUT="$ROOT/out/shorts"
SEQ="$ROOT/seq_$NAME"; rm -rf "$SEQ"; mkdir -p "$SEQ"
python3 - "$ROOT" "$NAME" "$SEQ" <<'PY'
import json, os, sys
root, name, seq = sys.argv[1:4]
spec = json.load(open(f'{root}/out/shorts/{name}.json'))
n = 0
for a, b in spec['segments']:
    for f in range(a, b):
        os.symlink(f"{root}/fx/{spec['scene']}/{f:05d}.jpg", f'{seq}/{n:05d}.jpg'); n += 1
PY
I=$(ffmpeg -v info -i "$OUT/$NAME.wav" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}')
GAIN=$(python3 -c "print(round(-14.0 - ($I), 2))")
ffmpeg -v error -y -framerate 30 -i "$SEQ/%05d.jpg" -i "$OUT/$NAME.wav" \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 18 -profile:v high -movflags +faststart \
  -af "volume=${GAIN}dB,alimiter=limit=0.89:attack=2:release=60:level=disabled" -c:a aac -b:a 192k -ar 48000 -shortest "$OUT/$NAME.mp4"
rm -rf "$SEQ"
echo "$NAME: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/$NAME.mp4")s  $(du -h "$OUT/$NAME.mp4" | cut -f1)  gain ${GAIN}dB"
