#!/bin/bash
# Espera a que aparezca un reproductor de video en la página (max 9 min)
for i in $(seq 1 54); do
  N=$(agent-browser eval "document.querySelectorAll('video').length" 2>/dev/null | tr -d '"')
  if [ "$N" != "0" ] && [ -n "$N" ]; then echo "VIDEO LISTO (intentos: $i)"; exit 0; fi
  sleep 10
done
echo "TIMEOUT esperando video"
exit 1
