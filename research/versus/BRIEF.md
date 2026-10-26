# Versus research brief (wave 7)

For each assigned character, write `research/versus/<slug>.json`. The comics identity to
research is the one in `research/<slug>.json` (read its `origin.sources[0].url`, the Marvel
Fandom wiki page, for example `Ghost_(Earth-616)` for ghost). Do not invent anything.

## Rules

- Facts only from these sources, each cited with a URL:
  - Power grid: Marvel's own old Marvel Universe wiki (marvel.com/universe), read through
    the Wayback Machine. Use `node scripts/power-grid.mjs "<Page_Name>"` from the project
    root (`C:\Users\DELL\Desktop\DIAMOND FORECAST\doomsday-dossier`). It prints the archived
    URL and the six 1 to 7 ratings. Find the page name with the Wayback CDX index, e.g.
    `curl -s "http://web.archive.org/cdx/search/cdx?url=marvel.com/universe/Gambit&matchType=prefix&collapse=urlkey&fl=original&limit=20&filter=statuscode:200"`.
    Pick the page for the right person (the Earth-616 comics character, never an Ultimate,
    animated, android or disambiguation page). If no archived page has a complete grid,
    set `values` to null and say so in `note`. **Never estimate a grid.**
  - Abilities, comics feats and power origin: the Marvel Fandom wiki, read through its
    MediaWiki API (`https://marvel.fandom.com/api.php?action=parse&page=<Title>&prop=wikitext&format=json&formatversion=2`),
    cited as the normal `https://marvel.fandom.com/wiki/<Title>` URL. Cite the comic issue
    that shows a feat (the wiki gives issues in `{{r|...}}` refs), with its own wiki page URL.
  - Screen feats: the Marvel Cinematic Universe Wiki API
    (`https://marvelcinematicuniverse.fandom.com/api.php?...`) for MCU titles, or the Marvel
    Fandom wiki for Fox titles, citing the film's wiki page. Only released live-action titles
    in which this actor played the character (see `research/<slug>.json` `screen`).
  - Fandom may show a bot check on rendered pages: use only the API. Never bypass a bot check.
- All prose in our own words. No quotes. Keep each `detail` and `text` to 30 words or fewer.
- Comics stats and film depictions differ: never mix them in one feat.

## Schema

```json
{
  "slug": "gambit",
  "powerGrid": {
    "values": { "intelligence": 3, "strength": 2, "speed": 2, "durability": 2, "energyProjection": 4, "fightingSkills": 4 },
    "source": { "label": "Marvel.com Marvel Universe wiki: Gambit (archived 12 May 2018)", "url": "https://web.archive.org/web/2018.../http://marvel.com/universe/Gambit" },
    "note": null
  },
  "powerOrigins": [
    { "key": "mutant-gene", "detail": "Born a mutant; can charge objects with kinetic energy.", "sources": [{ "label": "Marvel Fandom wiki: Remy LeBeau (Earth-616)", "url": "https://marvel.fandom.com/wiki/Remy_LeBeau_(Earth-616)" }] }
  ],
  "powerType": "mutant",
  "abilities": [
    { "name": "Kinetic charging", "detail": "...", "sources": [{ "label": "...", "url": "..." }] }
  ],
  "feats": [
    { "medium": "comics", "text": "...", "where": "Gambit Vol 1 #1 (December 1993)", "sources": [{ "label": "Marvel Fandom wiki: Gambit Vol 1 1", "url": "https://marvel.fandom.com/wiki/Gambit_Vol_1_1" }] },
    { "medium": "screen", "text": "...", "where": "Deadpool & Wolverine (2024)", "sources": [{ "label": "...", "url": "..." }] }
  ]
}
```

- `powerOrigins[].key`, one or more of: `serum` (any super-soldier or enhancement serum),
  `cosmic-rays`, `pym-particles`, `mutant-gene`, `asgardian` (born to an Asgardian or Frost
  Giant race), `mystic` (sorcery, enchantment), `tech` (armour, suits, gadgets, weapons),
  `training` (no powers: skill and training), `atlantean` (Atlantean or Talokanil biology),
  `heart-shaped-herb`, `quantum` (quantum or phasing technology or energy), `other` (explain
  in detail).
- `powerType`, exactly one, the main source of their power: `tech`, `mystic`, `mutant`,
  `cosmic`, `serum` or `none` (no powers). Use `cosmic` for cosmic-ray, god-like or
  cosmic-energy power (the Thing, Thor, Sentry); `none` for trained humans without
  powers whose edge is skill (gear-users whose power is their suit are `tech`).
- `abilities`: 4 to 8 comics abilities.
- `feats`: 3 comics feats and up to 3 screen feats (fewer if fewer are documented). Pick
  the clearest, best-known demonstrations of power or skill.

When done, validate your files parse as JSON and reply with a one-line summary per
character: grid found or not (and the page used), number of abilities and feats, powerType.
