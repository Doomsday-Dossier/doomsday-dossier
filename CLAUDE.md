# Doomsday Dossier: project memory

An unofficial, animated fan site that prepares people for **Avengers: Doomsday**
(in theaters **18 December 2026**). It covers every officially confirmed character
in full: origin, comics history and on-screen history. Read this file at the start
of every session, then continue from the tracker at the bottom.

## Non-negotiable rules

1. **Official facts only.** Every fact about the film traces to a Marvel or Disney
   announcement listed in `research/official.json`. No rumours, leaks, set reports,
   trade-press scoops or plot guesses. Re-verify the cast list on
   marvel.com/movies/avengers-doomsday at the start of each wave.
2. **Role-attribution rule.** A page says an actor plays a named character in
   Doomsday only where Marvel names that role (teasers, D23 and SDCC articles).
   Otherwise the page says "Marvel lists [actor] in the cast" and gives the actor's
   most recent released role as context, clearly labelled as past.
3. **History is sourced.** Comics history cites the Marvel Fandom wiki
   (marvel.fandom.com) or a named comic issue. Screen history cites the Marvel
   Cinematic Universe Wiki or the named film. Every section ends with numbered sources.
4. **All prose is our own words.** Never paste wiki sentences. Keep quotes from any
   source under 15 words and at most one per page.
5. **No faces, likenesses, logos, posters, stills or Marvel artwork.** No shield,
   hammer, helmet, A-logo, X-logo, FF-logo or character silhouettes. Identity comes
   from colour, type and effects only.
6. **Clearly unofficial.** A persistent "Unofficial fan site" marker on every page,
   plus a footer disclaimer: not affiliated with or endorsed by Marvel or Disney,
   all names and characters belong to their owners.
7. **Unconfirmed names stay out.** Ryan Reynolds and Hugh Jackman asked to join on
   stage; Marvel did not confirm them, so they are excluded. Kathryn Newton and
   Mabel Cadena are on Marvel's cast list with no named role: they appear on the
   roster as "Role not yet named by Marvel" and get no character page until Marvel
   names the role.

## Locked decisions (from the interview, 25 October 2026)

| Topic | Decision |
|---|---|
| Name | **Doomsday Dossier**, repo `doomsday-dossier` |
| Mood | **Cosmic dread.** Void `#050607`, bone ink `#E8E6E1`, doom-green glow `#3DFF8A`, iron greys. Slow, heavy, film-title pacing. |
| Site type | Instrument Serif (display, condensed feel) + JetBrains Mono (labels) + Inter Tight (body). Each character page also gets its own display face. |
| Structure | **Hub plus routed pages.** `/` home, `/teams/<team>/` team pages, `/c/<slug>/` character pages. Fullscreen menu plus roster grid. Shader-wipe transitions between routes. |
| Home story | **The road to Doomsday.** 01 Void with live countdown, 02 The reveal (SDCC 2024), 03 Roll call (March 2025 livestream), 04 The signals (teasers, trailer, SDCC 2026, D23), 05 Assemble (roster by team). Every milestone sourced. |
| Character page | **Five-act dossier.** 1 Hero (name, alias, actor, team, signature motion), 2 Origin (first appearance, creators, how they began), 3 Comics (pinned timeline of eras), 4 On screen (film by film, scroll-scrubbed), 5 Doomsday (only what Marvel confirmed). Numbered sources per act. Next-character link with transition. |
| Film scope | **All live-action, labelled.** Every live-action Marvel film or series the character appeared in, tagged MCU, FOX, SONY or OTHER. |
| Motion rules | **Signature hero, shared grammar.** Each character has a unique WebGL hero (own shader, particles, cursor reaction, display face). Acts 2 to 5 share one motion vocabulary (pinned timeline, split-text reveals, scrubbed film strip) tinted and paced per character. |
| Leads (wave 1) | **Doom plus the Avengers core:** Victor von Doom, Steve Rogers, Sam Wilson, Bucky Barnes, Thor, Scott Lang, Shang-Chi, Joaquin Torres. |
| Team groups | **Six groups, Doom apart.** The Adversary (Doom), Avengers, Fantastic Four, X-Men, Thunderbolts*, Wakanda and Talokan, plus "More confirmed" (Loki, Peggy Carter, future names). Bucky lives in Avengers and is cross-linked from Thunderbolts*. |
| Hosting | **GitHub Pages.** Repo https://github.com/prejith77/doomsday-dossier (public). Live at **https://prejith77.github.io/doomsday-dossier/**. `.github/workflows/deploy.yml` builds and deploys on every push to `main`; Astro `base` comes from the repo name. |
| References | User will send motionsites.ai links later. Treat them as the minimum motion bar, never copy. A tuning pass follows when they arrive. |

## Stack and why

| Tool | Version | Why |
|---|---|---|
| Astro | 5.18.x (pinned to 5, not 7) | Static HTML per route, so GitHub Pages serves real pages with no SPA 404 hack. Content lives in JSON collections. Ships zero JS by default, so each page loads only its own scene. Pinned to 5 for a stable, well-known API. |
| Astro ClientRouter | built in | Client-side navigation that keeps one persistent WebGL canvas alive across routes, which makes shader page transitions possible. |
| Three.js | 0.186 | Raw Three with hand-written GLSL. No React runtime, so less JS on phones than React Three Fiber, and full control over the render loop and quality tiers. |
| GSAP + ScrollTrigger + SplitText | 3.15 | Industry standard for pinned, scrubbed scroll storytelling and split-text reveals. All plugins are free under the GSAP standard licence. |
| Lenis | 1.3 | Smooth scrolling that stays in sync with ScrollTrigger. Disabled for reduced motion. |
| Fontsource | 5.x | Self-hosted fonts, no third-party font requests. |
| Playwright | 1.64 | Screenshots at desktop and phone width after every wave. |

## Performance and accessibility contract

- 60 fps on a mid-range phone. One shared renderer and canvas. DPR capped at 1.5 desktop and 1.25 phone.
- Adaptive quality: sample frame time for the first two seconds, then step down render scale and particle count if below 55 fps.
- Render the hero only while it is on screen. Pause when the tab is hidden.
- Particle budgets: 24k desktop, 8k phone. Shaders avoid loops over 32 iterations on phones.
- Touch replaces the cursor on phones (touch position, then a slow idle drift). No gyro permission prompts.
- `prefers-reduced-motion`: no Lenis, no pinning, no scrubbing, no split-text motion. Each hero renders one still frame. Page transitions become a plain fade.
- All text is real HTML, readable with WebGL off. Colour contrast at least 4.5:1 for body text.

## Content model

- `research/official.json`: film facts, milestones, cast, and the Marvel source list. Single source of truth for anything about Doomsday.
- `research/<slug>.json`: wiki-sourced origin, comics eras, screen appearances and trivia per character, written by research agents in our own words.
- `src/data/characters/<slug>.json`: the published page data, built from research plus per-character design (palette, display face, hero scene id).

## Per-character motion ideas (each must feel like a different site)

| Character | Hero scene | Technique | Palette | Display face |
|---|---|---|---|---|
| Victor von Doom | The Forge | Domain-warped molten iron, cursor heat cools to iron, rising embers | void, iron, doom green | Cormorant Garamond caps |
| Steve Rogers | The Ice | Voronoi frost sheet, cursor thaws to warm 1940s grain, scroll shatters shards | ice blue, faded navy, cream | Big Shoulders Stencil |
| Thor | The Storm | Raymarched storm clouds, procedural lightning chases the cursor | slate, electric white-blue | Grenze Gotisch |
| Sam Wilson | Slipstream | Curl-noise airflow particles streaming past, cursor deflects the air | sky, steel, signal red | Syne ExtraBold |
| Bucky Barnes | Cold Storage | Cryo frost plus CRT scanline glitch, title assembles like sliding metal plates | gunmetal, frost, faint red | Tektur |
| Scott Lang | Quantum Scale | Infinite zoom through nested fractal layers, cursor lens shrinks or enlarges, variable-font optical size scales | quantum violet, magenta | Fraunces (opsz axis) |
| Shang-Chi | Ink and Rings | Low-res ink-in-water fluid stirred by the cursor, ten light rings orbit | ink black, jade, gold | Bodoni Moda |
| Joaquin Torres | Drone Sweep | Radar sweep over a point-cloud terrain, cursor is a targeting reticle | dusk orange, teal | Chakra Petch |
| Reed Richards | Elastic Lattice | CPU spring-mesh blueprint grid dragged by cursor velocity; title width axis follows the pointer | blueprint navy, blue | Anybody (wdth 50-150) |
| Sue Storm | Force Field | Real-time 2D wave equation refracting a halftone field; letters near the pointer turn invisible | night violet, periwinkle | Italiana |
| Johnny Storm | Flame On | Vertex-shader particle fire from a flame bed plus the cursor's recent path; title weight flickers | ember black, orange | Bricolage Grotesque |
| Ben Grimm | Clobber | Lit 3D instanced rock wall; cursor pushes, click or tap sends a shockwave, scroll crumbles it; title shakes on impact | stone brown, orange | Alfa Slab One |
| Professor X | Cerebro | Rotating 3D sphere of minds; points near the cursor link into a live network recomputed each frame; scan pulse; title letters lit by a sweeping scan | deep blue, ice white | Gloock |
| Magneto | Lines of Force | Point-sprite needles drawn in the fragment shader along a two-pole magnetic field; cursor is a pole; scroll flips polarity; title letters pulled toward the pointer | violet black, magenta | Unbounded |
| Cyclops | Optic Blast | Ruby-filtered square-tunnel shader; beam SDF fires at the cursor on tap and on a timer with shockwave and heat shimmer; title flares | red monochrome | Teko |
| Nightcrawler | Bamf | Billboard smoke puffs shaded with fbm; an unseen jumper teleports after the cursor; circus spotlights; title letters vanish and reappear | indigo, sulphur | Rye |
| Mystique | Shapeshift | Gray-Scott reaction-diffusion whose feed and kill rates drift so the pattern keeps changing; title cycles typefaces | night blue, amber | DM Serif Display (cycles) |
| Beast | Blue Fur | Shell-textured 3D fur brushed by the cursor and a breeze; title halo leans away from the pointer | navy, blue | EB Garamond |
| Gambit | Charged Deck | Instanced 3D cards with procedural faces swirl; cards near the cursor charge pink and burst into sparks; tap charges one | maroon, pink | Abril Fatface |

## How to run

```
npm install
npm run dev        # local dev server
npm run build      # static build to dist/
npm run shots      # Playwright screenshots, desktop and phone, to screenshots/
npx astro preview --port 4322            # serve the production build for QA
node scripts/shots.mjs http://localhost:4322 screenshots/wave-N   # contact sheets per page
node scripts/overflow.mjs http://localhost:4322                   # phone-width overflow check
node scripts/fps.mjs http://localhost:4322 4                      # hero frame rates, CPU throttled 4x
node scripts/behaviour.mjs http://localhost:4322                  # reduced motion + navigation chain
```

QA is run against the production preview, not the dev server; the dev server stalls under automated browsing.

## Character tracker

Status key: `done` = researched, built, deployed and screenshotted. `built` = built locally, not deployed. `research` = research in progress. `todo` = not started.

| Wave | Team | Character | Actor | Role named by Marvel? | Status |
|---|---|---|---|---|---|
| 1 | The Adversary | Victor von Doom | Robert Downey Jr. | Yes (SDCC 2024) | done |
| 1 | Avengers | Steve Rogers | Chris Evans | Yes (teaser, D23) | done |
| 1 | Avengers | Thor | Chris Hemsworth | Yes (teaser) | done |
| 1 | Avengers | Sam Wilson | Anthony Mackie | No | done |
| 1 | Avengers | Bucky Barnes | Sebastian Stan | No | done |
| 1 | Avengers | Scott Lang | Paul Rudd | No | done |
| 1 | Avengers | Shang-Chi | Simu Liu | No | done |
| 1 | Avengers | Joaquin Torres | Danny Ramirez | No | done |
| 2 | Fantastic Four | Reed Richards | Pedro Pascal | No | done |
| 2 | Fantastic Four | Sue Storm | Vanessa Kirby | No | done |
| 2 | Fantastic Four | Johnny Storm | Joseph Quinn | No | done |
| 2 | Fantastic Four | Ben Grimm | Ebon Moss-Bachrach | Yes (teaser) | done |
| 3 | X-Men | Professor X | Patrick Stewart | Yes (teaser) | done |
| 3 | X-Men | Magneto | Ian McKellen | Yes (teaser) | done |
| 3 | X-Men | Cyclops | James Marsden | Yes (teaser) | done |
| 3 | X-Men | Nightcrawler | Alan Cumming | No | done |
| 3 | X-Men | Mystique | Rebecca Romijn | No | done |
| 3 | X-Men | Beast | Kelsey Grammer | No | done |
| 3 | X-Men | Gambit | Channing Tatum | No | done |
| 4 | Thunderbolts* | Yelena Belova | Florence Pugh | No | todo |
| 4 | Thunderbolts* | Red Guardian | David Harbour | No | todo |
| 4 | Thunderbolts* | John Walker | Wyatt Russell | No | todo |
| 4 | Thunderbolts* | Ghost | Hannah John-Kamen | No | todo |
| 4 | Thunderbolts* | Bob / Sentry | Lewis Pullman | No | todo |
| 5 | Wakanda and Talokan | Shuri | Letitia Wright | Yes (teaser) | todo |
| 5 | Wakanda and Talokan | M'Baku | Winston Duke | Yes (teaser) | todo |
| 5 | Wakanda and Talokan | Namor | Tenoch Huerta Mejia | Yes (teaser) | todo |
| 6 | More confirmed | Loki | Tom Hiddleston | No | todo |
| 6 | More confirmed | Peggy Carter | Hayley Atwell | Yes (D23 2026) | todo |
| roster only | Unnamed | (role not named) | Kathryn Newton | No | roster only |
| roster only | Unnamed | (role not named) | Mabel Cadena | No | roster only |

Home page: built. Team pages: built (all seven, with unbuilt members marked by wave). About page: built.

## How to add a character (repeat for every wave)

1. Re-check marvel.com/movies/avengers-doomsday and update `research/official.json` (cast, any newly named roles, new milestones with dates and Marvel URLs).
2. Research: one agent per two characters writes `research/<slug>.json` in the shape the wave-1 files use. Fandom serves rendered pages behind a bot check, so read pages through the wiki's own MediaWiki API (`api.php?action=parse&prop=wikitext` or `?action=raw`) and cite the normal `/wiki/` URL. Do not bypass bot checks.
3. Consistency rules for screen lists: archive footage, photos, mentions and animation do not count. Mark short or post-credits scenes as cameos. Leave out anything unreleased.
3b. To test scenes before research lands, drop placeholder JSON in `research-preview/` (git-ignored, read by `getResearch` only as a fallback). Delete it before the real build.
4. Add a `DESIGN` entry in `src/data/site.ts` (new hero scene id, palette, display face, ease, pace, kicker, heroScale) and a short name in `HERO_NAMES`. The page publishes automatically once design and research both exist.
5. Write the hero scene in `src/scripts/gl/scenes/<id>.ts` and register it in `registry.ts`. Pair it with a title effect in `motion/characters.ts`. It must be a different technique from every existing scene.
6. Install the display face with Fontsource and import it in `src/pages/c/[slug].astro` and `src/pages/teams/[team].astro`.
7. Run `npm run build`, then `node scripts/shots.mjs <url> screenshots/wave-N` and `node scripts/overflow.mjs <url>`; fix anything clipped or overflowing before deploying.

## Build notes

- Never name a GLSL variable `half` (reserved word). Three.js records shader compile errors in `renderer.info.programs[].diagnostics` without logging them. `shots.mjs` and `fps.mjs` now read those diagnostics on localhost (the engine is exposed as `window.__ddEngine` there only) and print SHADER errors; treat any as a blocker.
- Hero names are capped by their longest word (`--hero-longest`) so wide faces can never break a word. Use `heroScale` for further tuning.
- Letters that move after the intro (magnet, bamf) unclip their SplitText line masks after 2 s.
- Screen entries with no named performer use actor "Uncredited"; the page prints "Performer uncredited". Never blanket-replace actor strings; check each one.
- `node scripts/heroes.mjs <url> <out.jpg> <slug,slug> [phone]` makes one grid of hero views for fast review.

- `src/scripts/app.ts` runs DOM motion first, then lazy-loads Three.js (`gl/engine`) and the page's scene chunk. Critical JS is about 60 KB gzipped; Three.js is about 130 KB and loads in parallel.
- One persistent WebGL canvas (`#gl`) for heroes, and a second tiny canvas (`#wipe`) used only for page transitions. Both survive navigation via `transition:persist`.
- Scenes communicate to the DOM through `ctx.signal` (the storm uses it to flash Thor's name).
- Never put a paraphrase in quotation marks. The logline on the home page is our paraphrase and is labelled as such.
- Endgame Encore (re-release, 25 September 2026): Marvel's article confirms the re-release and the extended Steve and Peggy ending. Its Doom post-credits scenes are cited to the MCU Wiki only.

## Open items

- motionsites.ai reference links from the user (triggers a motion tuning pass).
- Git has no global identity on this machine. The repo uses a local identity (Prejith, account email); the user may change the name.
- GitHub CLI is installed per-user via winget at `%LOCALAPPDATA%MicrosoftWinGetPackagesGitHub.cli_*ingh.exe` (not on PATH in old shells) and signed in as prejith77. Use it to watch deploy runs.
- If a push does not start a deploy run (seen once on 2026-10-25), start one by hand: `gh workflow run deploy.yml -R prejith77/doomsday-dossier --ref main`.
- Deploy runs show GitHub's Node 20 deprecation warnings for the checkout, setup-node and pages actions. Harmless for now; bump the action versions when newer majors ship.

## Session log

- 2026-10-25: Wave 3 (X-Men) built and checked: seven new heroes, no shader errors, 58 to 60 fps with CPU throttled 4x, no phone overflow on any page, reduced motion and navigation pass. Marvel cast unchanged; Marvel names Professor X, Magneto and Cyclops only. Found and fixed a silent shader compile failure (Magneto) and added shader-error detection to QA.
- 2026-10-25: Wave 2 (Fantastic Four) deployed and verified live (21 pages, no phone overflow, new heroes 60 fps). Built and checked: four new heroes at 60 fps with CPU throttled 4x, no phone overflow, reduced motion and navigation pass. Marvel cast list re-checked, unchanged at 30 names; only the Thing has a Marvel-named role among the four. Engine now has a depth buffer for 3D scenes.
- 2026-10-25: Wave 1 deployed to https://prejith77.github.io/doomsday-dossier/ (first run succeeded). Live QA passed: all 17 pages return 200, no phone overflow, reduced motion and navigation checks pass, WebGL scenes load from the sub-path.
- 2026-10-25: Wave 1 built: home, 8 character dossiers, 7 team pages, sources page. QA passed: no phone overflow on any page; all heroes 60 fps at phone size on an Intel UHD 730 with 4x CPU throttle (not yet measured on a real phone); reduced motion leaves all text visible with no pinning or smooth scroll; four-hop navigation clears the wipe each time. Not deployed yet: waiting on the GitHub repo URL.
- 2026-10-25: Interview complete, all decisions above locked. Official cast verified on marvel.com (30 names on the film page plus Peggy Carter confirmed at D23). Wave 1 research started.
