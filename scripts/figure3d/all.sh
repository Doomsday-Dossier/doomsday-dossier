#!/usr/bin/env bash
# Runs the three steps (prepare, generate, pack) for every character, with the photo chosen for each
# (CLAUDE.md, "3D action figures"). Skips a character whose packed figure already exists; logs failures and moves on.
cd "$(dirname "$0")/../.."
PICKS="steve-rogers:1 thor:1 sam-wilson:2 bucky-barnes:1 scott-lang:2 shang-chi:2 joaquin-torres:3 reed-richards:2 sue-storm:2 johnny-storm:1 ben-grimm:2 professor-x:3 magneto:1 cyclops:1 nightcrawler:1 mystique:2 beast:2 gambit:1 yelena-belova:1 red-guardian:1 john-walker:1 ghost:2 bob-reynolds:3 shuri:3 mbaku:1 namor:3 loki:1 peggy-carter:3"
for pick in $PICKS; do
  slug=${pick%%:*}; num=${pick##*:}
  if [ -f "public/figures3d/$slug.d3f" ]; then echo "$slug done already"; continue; fi
  node scripts/figure3d/prepare.mjs "$slug" "$num" && node scripts/figure3d/generate.mjs "$slug" && node scripts/figure3d/pack.mjs "$slug" || echo "FAILED $slug"
done
echo ALL FINISHED
