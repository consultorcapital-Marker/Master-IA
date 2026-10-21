#!/bin/bash
for i in $(seq 1 60); do
  R=$(curl -s "http://localhost:3000/api/videos/long?id=pl-1792544271241-qg0jr4" | head -c 300)
  echo "[$(date +%T)] $R"
  if echo "$R" | grep -q '"status":"done"\|"status":"failed"'; then break; fi
  sleep 30
done
