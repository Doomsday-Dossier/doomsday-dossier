#!/usr/bin/env bash
# Waits out the free demo's daily limit: runs all.sh with one try per character, and while figures are still
# missing, waits 40 minutes and goes again (at most 18 rounds, about 12 hours). Stops once all 29 exist.
cd "$(dirname "$0")/../.."
for round in $(seq 1 18); do
  TRIES=1 bash scripts/figure3d/all.sh
  n=$(ls public/figures3d/*.d3f 2>/dev/null | wc -l)
  echo "round $round: $n of 29 figures"
  [ "$n" -ge 29 ] && { echo "ALL 29 DONE"; exit 0; }
  powershell -NoProfile -Command "Start-Sleep -Seconds 2400"
done
echo "STOPPED with figures still missing"
