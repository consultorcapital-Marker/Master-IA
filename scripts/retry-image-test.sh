#!/bin/bash
# Reintenta la prueba de imagen->video respetando el límite de peticiones (429)
cd /home/z/my-project
for i in 1 2 3 4 5 6; do
  echo "=== INTENTO $i $(date +%T) ==="
  OUT=$(timeout 500 bun scripts/test-video-capabilities.mjs image 2>&1)
  echo "$OUT" | tail -3
  if echo "$OUT" | grep -q "PROBE"; then
    echo "PRUEBA IMAGEN->VIDEO OK"
    exit 0
  fi
  if echo "$OUT" | grep -q "429\|Too many"; then
    echo "429: esperando 150 s..."
    sleep 150
  else
    echo "Error no recuperable"
    exit 1
  fi
done
echo "AGOTADO"
