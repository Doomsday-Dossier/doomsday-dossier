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
5. **Photos: the user's supplied set (changed 25 October 2026, user decision).** The site
   uses exactly the 87 photos the user supplied in `DIAMOND DOCS/MARVEL PHOTOS`, three
   per character, as supplied (no upscaling: the user declined the 2.5-hour Real-ESRGAN
   run). Many are fan-made or AI images (Gemini and TikTok marks, artist signatures); the
   user was told and chose **one generic credit**: "Images belong to their respective
   owners." with the removal-on-request route, on every gallery, the footer and
   `/credits/`. Do not add or swap photos without the user. Originals live in
   `photo-originals/user/` (git-ignored); the set and crop centres are in
   `research/photos/user-set.json`. The earlier marvel.com download (`picks.json`,
   `manifest.*`) is superseded and unused. Still no Marvel logos as design elements.
6. **Clearly unofficial and non-commercial.** A persistent "Unofficial fan site"
   marker on every page, plus a footer disclaimer: unofficial, non-commercial, not
   affiliated with or endorsed by Marvel or Disney, all names, characters and images
   belong to their owners, and any image will be removed on request (with a contact
   route). Takedown process: delete the image, push, redeploy.
7. **Unconfirmed names stay out.** Ryan Reynolds and Hugh Jackman asked to join on
   stage; Marvel did not confirm them, so they are excluded. Kathryn Newton and
   Mabel Cadena are on Marvel's cast list with no named role: they appear on the
   roster as "Role not yet named by Marvel" and get no character page until Marvel
   names the role.

## Design system v2: the Latverian dossier (fourth interview, 26 October 2026)

Every page uses this system; nothing is styled one page at a time. Tokens live in
`src/styles/system.css` (CSS) and `src/scripts/dossier/tokens.ts` (JS, the same values for
GSAP and WebGL). A page that needs a value the system lacks adds it here first.

**Concept.** A leaked Latverian intelligence dossier. Every character is a classified file
being opened. Doom's emerald is the glow of the whole archive; when a file opens, that
character's own accent takes over the page.

**Showcase status (26 October 2026): built and live at /preview/ (archive) and /preview/c/victor-von-doom/ (Doom's file), awaiting the user's approval.** Code: `src/layouts/Dossier.astro`, `src/styles/system.css`, `src/scripts/dossier/` (`main.ts` entry, `archive.ts` intro and fly-through, `file.ts` file opening and subject, `figure.ts` particle figure, `filecover.ts` cover textures, `tokens.ts`). The v1 Engine and the Forge scene are reused. Lessons: sample a portrait window of a wide photo for a particle figure (a 16:9 scene makes the face a thin third), stretch brightness to the photo's own range, and fade distant WebGL cards by opacity, not toward the fog colour, when the backdrop glows.

**Rollout (approved 26 October 2026, "it's brilliant").** Every page is rebuilt on v2 under `/preview/`
and the whole site switches in one deploy after the user reviews it (swap all at once; at the swap,
`/preview/` pages move to the root and their `/preview/` links are rewritten). Six more motionsites
references were approved and mapped:

| Page | Reference | What it does |
|---|---|---|
| Character files (29, `/preview/c/[slug]/`) | Obsidian, Lena Varga, Oyla, Space Voyage | hero: the cut-out subject in front of their giant name as their colour floods in, camera pushes in on scroll; then the approved file opening and subject; exhibits zoom toward you; the next file is a window into the next world with every file listed like planets |
| Team pages (7) | Lena Varga, Space Voyage | pinned carousel: members burst in one by one over their name, the page takes each one's colour, a side list marks who is on stage |
| Timeline | Space Voyage | pinned decade hero: a window on a character who debuted that decade, over the giant decade, with its numbers; the side list jumps the film strip |
| Arena | Peculiar Atelier | the fighters are verlet-cloth posters (`dossier/cloth.ts`); grab and drag, fling one at the other to tear it from its clips and hit, which fires the arena's slam (`dd:fling`) |
| Predictions | Anchor AI | particle tree (`dossier/tree.ts`): a branch per question grows when answered (`dd:picks`), lock-in sends a pulse up the tree and rings across the ground (`dd:locked`) |
| Quiz | Lena Varga | the result is the cut-out match over their giant name on a flood of their colour |
| Planner, sources, credits | Oyla | editorial band of three prints that grow toward the reader (`components/OylaBand.astro`) |

**Motion v3 (user report, 26 October 2026: "the animations have ruined it", names crossed by photos, countdown
unreadable on the green, phone first).** The references were re-studied frame by frame from their preview videos
(see the session log). What they share, now rules for every page: one subject and one idea per screen; text in clear
space, in front, never covered by a photo; transitions are camera moves; one persistent thing transforms with scroll;
order rather than scatter; few things move at once. Applied so far:

| Page | Now |
|---|---|
| Home (`dossier/archive.ts`, `ring.ts`) | **The Assembled ring** (user choice, 26 October 2026, replacing the point cloud the user did not like): the 28 heroes stand in a circle facing outward, each a lit relief from their photo and subject depth (`<n>-ring-400.webp` and `<n>-ring-depth-256.webp`, about 45 MB of texture for all 29); Doom looms on a dais at the centre behind them. Intro: close on Doom while the ring rises; scroll cranes up over the ring and down to the first hero, then orbits hero to hero: the one in front steps forward in full light, the rest fall into shadow tinted their colour; name bottom-left in front. The countdown sits on its own dark panel in bone white. |
| Team pages | Lena Varga slides: a full-screen field in the member's colour wipes up, the subject (sized by its measured outline, head never cropped) arrives from close to the camera and floats, the name types in bottom-left in front in their own face. |
| Character files | The hero name moved in front, bottom-left; the 3D subject stands right of centre on wide screens; the lens is mouse-only; on phones the record shows one card at a time. |
| Timeline (`dossier/timeline.ts`) | Space Voyage worlds: each decade is a full-screen world (its lead's full photo); the next waits in a rounded window that grows to fill the screen as you scroll, the photo inside counter-scaled so it holds still; decade numerals and facts bottom-left; decade buttons along the top jump the strip. |
| Quiz (`dossier/quizpage.ts`) | The swarm (`dossier/swarm.ts`, shared with the home) anchored to page elements: a turning orb beside the title while you answer, then it moves into the result frame and gathers into your match in 3D; the name beside it, never behind. Photo kept for reduced motion and no WebGL. |
| Arena | The cloth posters are the hero's whole stage and leave with the page (the camera follows the scroll; before, they stayed fixed and the text below ran over them); "Grab them. Fling them." bottom-left in front. |
| Predictions (`dossier/wartable.ts`) | **Doom's war table** (user choice, replacing the tree): a holographic table cut into ten sectors with a radar sweep and Doom's citadel at the centre; each answer drops a token with a light beam into its sector (the option sets how far out); locking in launches them in arcs to the citadel and a shockwave rolls over the table. Phones: the table has the top of the page and scrolls away with it. |
| Catch-up, about, credits | Unchanged Oyla editorial bands (they already follow the rules). |

Checks for this: `scripts/names-check.mjs` (every team name at three sizes), `scripts/walk.mjs` (a frame every half
screen, for overlaps the clip audit cannot see), `scripts/record.mjs` + `scripts/video-sheet.mjs` (scroll recordings).

v1 logic is reused, not rewritten: the arena, timeline strip, planner, predictions and quiz scripts
run unchanged inside the v2 pages (v1 token names are aliased to v2 tokens in `system.css`; the v1
scripts announce `dd:pair`, `dd:picks`, `dd:locked` and listen for `dd:fling` for the v2 effects).

**HD photos and cut-outs (user decision, 26 October 2026).** The user's 87 photos are upscaled 4x
locally with Real-ESRGAN (`scripts/upscale-photos.mjs`, only photos with a short side under 1200 px,
about 2.5 min each on the UHD 730) and every subject is cut out locally with briaai/RMBG-1.4 through
transformers.js (`scripts/cutout-photos.mjs`; non-commercial licence, which this site is; model files
in `photo-originals/models`, fetched once with Windows curl because this PC's network re-signs TLS for
Node). `scripts/photos2-build.mjs` writes `public/photos2/` (sizes up to 2560 px plus alpha cut-outs)
and `src/data/photos2.json` with each subject's measured bounding box and head point, which frame the
particle figures, centre the heroes and anchor the callouts (`src/data/v2.ts`). Approved accents come
from `research/accents.json`.

**3D heroes from the user's photos (user decision, 26 October 2026: "use the images in the marvel photos
folder, but make them 3d").** The user dropped both the self-generated renders (the brief and the 29 empty
folders in `DIAMOND DOCS/MARVEL PHOTOS/3D/` are no longer needed) and official images. Instead every photo
gets a depth map from Depth Anything V2 Small (`scripts/depth-photos.mjs`, transformers.js, model in
`photo-originals/models/onnx-community/depth-anything-v2-small`, fetched with curl). `photos2-build.mjs`
writes `<n>-depth-{512,1024}.webp` and, for cut-out photos, `<n>-cdepth-1024.webp`: subject depth filled
past the outline by a normalised blur so the relief has no cliff (jagged edges otherwise). Each file's hero
is a `Diorama` (`dossier/depth.ts`): the cut-out as a displaced mesh lit with normals from the depth map, the
name in its own face on a plane behind it, the second photo as a dimmed relief backdrop, dust between, a
pointer orbit, scroll push-in, time drift and a light in the accent colour circling the subject. The
subject is sized by its measured outline (head at a set height, width capped; phones may crop wide
subjects), and two-line names are capped at 62% of the screen height. Flat DOM layers stay for reduced
motion and no WebGL (`html.dio-on` hides them once the diorama draws). 55 to 60 fps at 4x throttle.

**Lessons from the rollout.** String.replace treats `$$` in the replacement as a single `$`: write code
edits with split/join or the Edit tool. A wide photo in a narrow box must be centred with flex (or the
measured head), not `margin: auto`, or it pins to the left. A WebGL page's frame rate cannot be judged
while the upscaler is using the same GPU. **Check generated images, not just exit codes:** 19 of 81
Real-ESRGAN outputs were pure black (the GPU was starved while browser tests ran; the upscaler reported
success), and sharp's `joinChannel` on encoded buffers wrote every cut-out with black colour. Both went
unnoticed for a day because the pages only used the cut-outs as shapes. The upscaler now checks each output
and retries with smaller tiles; `scripts/check-upscales.mjs` moves black upscales aside; cut-outs are joined
as raw pixels. Other rollout lessons: a section class `.open` collided with the drawer's open state (use
`is-open`); GSAP reads a CSS `translateY` as pixel `y`, so set `{ y: 0, yPercent }` explicitly; the 2560 px
photo size was dropped (100 MB per push for very large monitors only). The clip audit treats the record
track (`.rec-track`) as a sideways rail. **Motion v3 lessons:** check upscales band by band against the original,
not just for all-black (Sam's went black halfway; `check-upscales.mjs`); load a page's character faces before fitting
names (a hidden slide's face can arrive after `document.fonts.ready`, and a name measured in the fallback font
overflows); a grid column must be `minmax(0, 1fr)` or a wide word widens it and the name is never fitted; names split
into letters lose kerning, so leave 5% headroom and split into words and letters, never letters alone (they wrap
mid-word); Astro's scoped attributes make `.a + .a` outrank `html.flag .a`, so set such states from script; the
engine's idle pointer drift must not drive effects meant for a real pointer (it left a wandering hole in the cloud).
Check a name against the screen edge, not only its own box: every grid level between the name and the page must be
`minmax(0, 1fr)`, or one level grows to the widest word and the name's box is wider than the screen (the quiz showed
SAM WILSO with two nested grids; `scripts/quiz-names.mjs` checks all 29 results at three sizes). Measure text after
it is shown: a hidden element measures 0, and a cached face resolves its load before the element appears. A WebGL
layer drawn on the fixed canvas does not scroll with the page: move the camera with the scroll (arena posters,
phone prediction tree) or the text below runs over it.

**Showcase first.** The intro, the home fly-through and Doom's file are built at `/preview/`
and approved by the user before any other page is rebuilt. Then every page is rebuilt to the
same standard ("every page with amazing animations"). Until approval the live site is untouched.

### Colour tokens

| Token | Value | Use |
|---|---|---|
| `--gunmetal` | `#0d1012` | page base (gunmetal black) |
| `--gunmetal-2` | `#14181b` | raised panels, file interiors |
| `--iron` | `#23292d` | rules, borders, file covers |
| `--iron-2` | `#3a4247` | hover borders, inactive marks |
| `--iron-aged` | `#5c5f58` | aged iron: rivets, worn edges, cover texture tint (2.94:1, never for text) |
| `--ash` | `#8d918c` | secondary text (contrast 5.97:1 on gunmetal) |
| `--bone` | `#e7e4dc` | primary text (contrast 15.03:1) |
| `--emerald` | `#1fd47a` | Doom's emerald: the archive glow, links, stamps (9.78:1) |
| `--emerald-hot` | `#5dffa8` | the glow's hot core in WebGL and on focus |
| `--emerald-deep` | `#0b5e37` | emerald in shadow: cloak folds, glow falloff |
| `--redact` | `#050607` | redaction bars |
| `--stamp-ink` | accent at 85% with a 6% paper grain | stamps |
| `--accent` | per file, from the table below | takes over a page when its file opens |

Accents must reach 4.5:1 on `--gunmetal` (they colour labels and small text) and stay at
least ΔE 12 apart from each other. Each comes from the character's established look,
preferring the film costume Marvel cast for Doomsday, and cites where that look is described.

| Character | Accent | From | Source | Status |
|---|---|---|---|---|
| VICTOR VON DOOM | `--emerald` `#1fd47a` on forged iron `#5c5f58` | cloak green over iron armour | Comic-Con 2024 reveal (research/official.json), Fantastic Four #5 (1962) on the Marvel Fandom wiki | approved (iron and emerald: the page goes from gunmetal to forged iron and the glow deepens, rather than changing hue) |
| The other 28 | see `research/accents.md` | costume element per character | cited per row | awaiting the user's approval |

### Type

| Role | Face | Notes |
|---|---|---|
| Titles | **Big Shoulders Display** (variable 100 to 900) | tall, sharp, condensed; uppercase; tracking -0.01em; line height 0.86 |
| Labels, file numbers, dates, clearance, stamps | **Courier Prime** (400, 700) | typewriter mono; uppercase for labels with tracking 0.14em; never below 11px |
| Body | **Inter Tight** (variable) | 16 to 19px, line height 1.55, max 66ch |
| A character's name on its own file | that character's signature face (`DESIGN[slug].font`) | the only place the 29 faces appear; everywhere else names use Big Shoulders |

Fluid type scale (rem at a 16px root; `clamp(min, preferred, max)`):

| Step | Size | Use |
|---|---|---|
| `--t-mega` | `clamp(4.5rem, 16vw, 15rem)` | intro title, file name on the cover |
| `--t-1` | `clamp(3rem, 8vw, 7.5rem)` | page titles |
| `--t-2` | `clamp(2.25rem, 5vw, 4.5rem)` | chapter titles |
| `--t-3` | `clamp(1.5rem, 2.6vw, 2.5rem)` | section heads, card names |
| `--t-body` | `clamp(1rem, 0.95rem + 0.25vw, 1.1875rem)` | body |
| `--t-label` | `0.75rem` (12px) | labels; `--t-micro` 0.6875rem (11px) is the floor |

Every display element is measured by `fitText` so no word ever runs past its box.

### Spacing, grid, shape

- Spacing steps (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192 (`--s-1` to `--s-11`). Sections
  are separated by `--s-10` on desktop and `--s-8` on phones.
- Grid: 12 columns, gutter `clamp(16px, 2vw, 28px)`, page margin `clamp(16px, 4vw, 64px)`,
  max content width 1440px. Phones: 4 columns.
- Shape: files and panels are sharp (radius 2px). Only stamps and pills are round. Borders are
  1px `--iron`; an opened file's border is 1px of its accent at 40%.
- Texture: a fine film grain over everything (static on phones), paper fibre on file interiors,
  rivet and scratch detail on iron covers. Textures never animate per frame on phones.

### Easing and duration

| Name | GSAP | CSS | Use |
|---|---|---|---|
| `file` | `power4.inOut` | `cubic-bezier(0.77, 0, 0.18, 1)` | heavy things: covers lifting, folders sliding, camera moves between files |
| `reveal` | `expo.out` | `cubic-bezier(0.16, 1, 0.3, 1)` | text and redaction reveals, photos settling |
| `stamp` | `power4.in` then `back.out(3)` settle | `cubic-bezier(0.5, 0, 0.75, 0)` | stamps slamming down (short in, tiny overshoot) |
| `glow` | `sine.inOut` | `cubic-bezier(0.37, 0, 0.63, 1)` | emerald glow building and breathing |
| `scrub` | `none` | `linear` | anything tied to scroll position |

Durations: `xs` 0.15s (hover), `s` 0.3s, `m` 0.6s, `l` 1.0s, `xl` 1.6s (covers, camera). Stagger
0.04s for letters, 0.08s for lines and cards. A file's whole opening sequence takes 2.4s or less.

### Motion rules

1. **Every animation reveals something.** Movement uncovers content, explains a relationship or
   answers an input. Nothing loops just to fill the screen (ambient WebGL may breathe, never
   distract from text).
2. **60 fps on a mid-range phone.** Animate only `transform` and `opacity` in the DOM (plus
   WebGL). Never animate `filter`, blur, `box-shadow`, `text-shadow`, `clip-path` on large areas
   every frame, `mix-blend-mode` or layout. One WebGL renderer for the session; DPR capped 1.5
   desktop, 1.25 phone; particle budgets 60k desktop, 18k phone; the quality governor steps down
   when frames slip.
3. **Reduced motion.** No intro (straight to the title and countdown, still), no camera moves
   (the fly-through becomes a still grid of files), files open already open, no pins, no smooth
   scroll, no split text. All content readable with WebGL off.
4. **The intro** lasts at most five seconds, can be skipped (any key, click, tap or scroll), and
   plays in full only on a first visit (`localStorage` `dd-intro-seen`); later visits get a
   0.8s glow-in of the title and countdown.
5. **Scroll.** Lenis smooth scroll; pinned chapters only for the timeline, the interactive
   features and the file opening; never ScrollTrigger `snap` (glide through Lenis instead).
6. **Hover** effects only on fine pointers; touch gets the same information without hover.
7. **Sound** (if added later): off by default, original, never autoplay.

### Components

- **File cover**: an aged-iron folder face with tab, file number (`FILE 01 / 29`), clearance
  (`CLEARANCE: OMEGA`), team, a redacted subject line and the character's name; lifts open on a
  top hinge (rotateX in perspective) with `file` easing.
- **Redaction bar**: `--redact` bars over text that peel away left to right (scaleX from the
  right edge) in `reveal` easing, staggered 0.08s.
- **Print**: a photo with a thin border and typed caption; slides out of the folder edge.
- **Stamp**: round or boxed, Courier Prime 700, accent ink with grain; slams from scale 1.6 and
  settles with a 2px shake.
- **Callout**: Feathers Atlas style annotation: a thin leader line from a point on the subject to
  a typed note; draws on as the subject settles.
- **Key traits panel**: label and value rows (first appearance, creators, powers, status in
  Doomsday), each with its source number.
- **Detail lens**: a round magnified view of part of the subject, following the pointer on fine
  pointers, fixed on phones.
- **Countdown**: Courier Prime digits with an emerald glow, days/hours/minutes/seconds to
  18 December 2026, same maths everywhere (whole days rounded down).

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

## Revised brief (second interview, 25 October 2026)

| Topic | Decision |
|---|---|
| Approach | **Extend what's built.** Keep all dossiers, hero scenes and research; add photos, four interactive features, credits page and six original animation ideas. |
| Photo look (superseded 25 Oct: photos show near full colour, lightly graded at rest on hover devices, full colour on hover) | **Graded to each palette.** Photos rest as a live shader duotone in the character's palette with crushed blacks, grain and vignette, and bloom to full colour on hover or at the scroll reveal. |
| Depth layers (dropped 25 Oct: user wants speed, no model downloads) | **Processed locally on this PC.** rembg for the cut-out and Depth Anything V2 (small) for a depth map, via Python, downloaded once (about 400 MB). Output per photo: graded base, cut-out and depth map as WebP. Images never leave the machine. |
| Photo sources (superseded 25 Oct: the user's supplied set, see rule 5) | **marvel.com plus Disney press.** marvel.com, cdn.marvel.com, d23.com and Disney's official press and media pages. If a character has no usable official photo, the page keeps its abstract hero and says so. |
| Photo coverage | **Every character gets their photo**, not just the leads (user: "I want all the character's faces"). |
| Character page | **I Hero** (graded photo with depth layers over the existing signature scene, plus the character's own photo shader: ripples, particle dissolve, liquid, fire, static and so on), **II Trailer** (pinned: zoom, colour shift, text beats), **III Origin**, **IV Two lives** (drag a divider between comics eras and on-screen history), **V Doomsday** (confirmed facts only), then photo credits. |
| Navigation | **Team picker on home**, replacing the roster; the whole grid rearranges with animation. **/timeline/** and **/versus/** are new pages, linked from the header, menu and every character page. Versus is shareable (`/versus/?a=thor&b=magneto`). |
| Versus data | **Official Handbook power grid** (intelligence, strength, speed, durability, energy projection, fighting skills, 1 to 7) as recorded on the Marvel Fandom wiki, with the edition cited. No grid means "Not rated in the Handbook". Abilities lists and connections (shared films, teams, wiki relationships) side by side. No "who would win" verdict. |
| Timeline | **Every relevant title.** All released live-action films and series with a confirmed character (MCU, FOX, OTHER tagged), plus each character's comics debut and key eras, built from the research files. Characters appear at their first entry; Marvel's 2024 to 2026 milestones close the line at Doomsday. |
| Original ideas chosen | **Halftone Lens** (cursor lens shows photos as comic halftone; long press on phones), **Photo Hand-off** (card photo flies into the next page's hero with depth layers intact), **Panel Flythrough** (comics eras as a 3D corridor of panels), **Magnetic Team Chain** (drag a card and its team follows on springs into formation), **Film-Burn Scrubber** (35 mm scrubber on the trailer, burns when scrolled fast), **Developing Credits** (credit prints develop like darkroom photos). Not chosen: Multiverse Tear, Name Constellation. |
| Hosting | **Stays on GitHub Pages**, same URL. Accepted risk: a takedown notice can disable the whole Pages site; the fix is to remove the image and redeploy. |

## Wave plan (revised)

| Wave | Scope | Status |
|---|---|---|
| 1 | Home, Doom, Avengers core | done |
| 2 | Fantastic Four | done |
| 3 | X-Men | done |
| 4 | Thunderbolts* (abstract heroes, no photos yet) | done |
| 5 | Wakanda and Talokan (Shuri, M'Baku, Namor) plus Loki and Peggy Carter, full depth | done |
| 6 | Photos for every character from the user's set: photo hero, In frame gallery (three prints), Halftone Lens, developing prints, home and team photo cards, next-dossier photo, credits page (done). Still open: Trailer act, Two lives slider, Photo Hand-off | in progress |
| 7 | Interactive features: team picker with Magnetic Team Chain, timeline with Film-Burn Scrubber, versus with power grid and radar, Panel Flythrough | done |
| 8+ | The twelve fan features, in the ranked backlog below | todo |

## Feature tracker

| Feature | Wave | Status |
|---|---|---|
| Character photos (hero portrait, gallery, cards, team rows, next link) | 6 | done |
| Trailer act (pinned zoom, colour shift, text beats) | 6 | todo |
| Two lives slider (comics vs on screen) | 6 | todo |
| Credits page (every image by character, generic credit, removal route) | 6 | done |
| Halftone Lens (gallery prints; long press on touch) | 6 | done |
| Photo Hand-off | 6 | todo |
| Developing prints (gallery prints develop like darkroom prints on reveal) | 6 | done |
| Team picker on home (chips filter with Flip, #team= in URL, unnamed roles included) | 7 | done |
| Magnetic Team Chain (drag a card, its team fans behind it on springs; fine pointers only) | 7 | done |
| Timeline page (/timeline/: 55 titles, 29 debuts, 10 Marvel news frames; follow mode adds comics eras) | 7 | done |
| Versus page (/versus/?a=&b=: split screen, radar, mirrored bars, abilities, sourced feats, connections) | 7 | done |
| Panel Flythrough (comics act corridor on wide screens when the front panel fits; stacked otherwise) | 7 | done |
| Film-Burn Scrubber (timeline strip: drag with momentum, decade scrubber, fling burns the edges) | 7 | done |

## Fan features: ranked backlog (third interview, 26 October 2026)

Built in this order, except that date-tied features jump the queue: the catch-up planner and
prediction board go live well before 18 December, the spoiler shield is ready on release day.
Every feat, stat, power origin, runtime and film link shows its source. Power grids only from an
official grid; none means "Not rated in the Handbook". Fan votes and predictions are labelled
"Fan vote" / "Fan prediction", never facts.

| Rank | Feature | Data it needs | Where the data comes from | Backend | Status |
|---|---|---|---|---|---|
| 1 | Fight arena: two cards slam together in a split screen with documented feats (source tagged), fans vote, live split shown | feats, grids, photos; votes per matchup | research/versus/*.json (Marvel Fandom wiki issue pages, MCU Wiki film pages); votes in D1 | Cloudflare Worker + D1 + Turnstile | done: live on /versus/, first real votes recorded 26 Oct 2026 |
| 2 | Power radar in the arena, labelled comics stats | official power grids | Marvel.com Marvel Universe wiki via Wayback (research/versus) | none (static) | done (radar overlay in the arena) |
| 3 | Most-wanted fights leaderboard, updating as people vote | vote totals per matchup | D1 aggregate | Worker + D1 | done: /versus/#most-wanted, top 10 by total votes (ties: most recently voted), refreshes after a vote (`dd:voted` event) and every 30 s while on screen; rows slide to new ranks (Flip with data-flip-id) and open the fight on click |
| 4 | Catch-up planner: tick characters, get the smallest watch list (first and latest appearance with the Doomsday actor per character, shared titles once, series by episode), total hours and hours per day to 18 December | screen lists, runtimes, episode lists | research/<slug>.json screen; runtimes and episodes from each title's MCU Wiki / Marvel Fandom wiki page (to research, cited) | none (client) | done 26 Oct 2026: /catch-up/. Data in research/catchup.json, built by scripts/catchup-data.mjs (runs scripts/runtimes.mjs and scripts/episodes.mjs; 24 film runtimes from the MCU Wiki or Marvel Fandom wiki, series episodes from MCU Wiki episode pages, Power Broker from Wikipedia). 26 titles, 61.3 hours for everyone. Picks in ?c=, watched ticks in localStorage |
| 5 | Prediction board: about 10 multiple-choice questions (drafted by Claude from confirmed facts only, approved by the user), sealing at the first midnight of 18 December anywhere (10:00 UTC, 17 December; moved earlier if Marvel confirms earlier openings), results settled by Claude from the MCU Wiki film page with citations and published only after the user says yes, shown behind the spoiler shield | questions, picks, outcomes | user-approved question file; picks in D1; outcomes cited | Worker + D1 + Turnstile | done 26 Oct 2026: /predictions/, first real set locked in from the user's browser the same day. 10 questions approved by the user, in research/predictions.json (seal 2026-12-17T10:00Z, `results: null` until settled). Worker: `GET /predict/split`, `POST /predict {pid?, picks, token}` (all ten required, Turnstile, 403 after the seal, max 5 new sets per browser per day, an update replaces the set). Tables `pred_people`, `pred_picks`, `pred_new`. Picks and random id in localStorage `dd-predictions`; split shown after locking in. Turnstile shared in `motion/turnstile.ts` |
| 6 | Which Doomsday hero are you quiz: 10 questions drafted by Claude, all 29 characters as results, user approves the draft; shareable result card | trait scores per character | traits drawn from the dossiers (opinion questions need no source; results link the sourced dossier) | none (client) | done 26 Oct 2026: /quiz/. Questions approved by the user, in research/quiz.json (each answer gives a point to 2 to 5 characters; ties go to the later question, then roster order). Every character can win; on random answers each comes up 2.1% to 5.0% (check balance before editing). One question at a time, number keys, Back; answers in ?a= so a shared link shows the same result. Result: photo, name in its own face (measured and shrunk to fit wide faces), three most telling answers, two runners-up, dossier link. Share cards from `motion/card.ts` (`drawCard`, reusable for the squad builder): 1080x1350 and 1200x630 PNG |
| 7 | Squad builder: pick five to face Doom, see coverage (power types, best Handbook stat per axis, origins) and gaps; download a squad card | grids, powerType, origins | research/versus | none (client) | todo |
| 8 | Power-type filter (tech, mystic, mutant, cosmic, serums and experiments, no powers) rearranging the home roster | powerType per character | research/versus (Shuri retyped mystic to match M'Baku; Joaquin, Walker serum = closest fit, explained in powerOrigins) | none | todo (data ready) |
| 9 | Power origin web: characters linked by how they got their powers; click a link to light up everyone who shares it | powerOrigins keys | research/versus | none | todo (data ready) |
| 10 | Six degrees of Doomsday: shortest chain of shared titles between two characters, through the 29 Doomsday characters only; pairs that cannot connect say so | screen lists | research/<slug>.json screen (sourced) | none (client BFS) | todo |
| 11 | Doombot trivia: questions generated from the site's sourced facts, answer shows the source; right answers shatter a Doombot; 10 in a row unlocks the hidden Latverian archive (Doom scene, deep-cut sourced Doom facts, downloadable "Latverian clearance" card) | facts with sources | research files | none (client; streak in localStorage) | todo |
| 12 | Spoiler shield: after release every new fact sits under its own redaction bar, tap to reveal; a "Show all spoilers" switch remembered on this device only; shielded by default, no end date | post-release facts | MCU Wiki film page, Marvel | none | todo, ready on release day |

**Backend decisions.** Cloudflare Workers + D1 on the free tier (100k requests a day, 5 GB, never
sleeps). The user creates the free Cloudflare account; Claude writes and deploys the worker. Vote
spam: Turnstile (free, invisible) on every write, plus one vote per matchup per visitor per day,
deduplicated with a salted hash of IP and user agent whose salt rotates daily; no raw IPs, accounts,
names or tracking cookies are stored. Predictions use the same protection; one set of picks per
visitor (the daily hash plus a random id kept in the browser).

**Shareable cards.** "Dossier file" style for every card: void black, character photos, each
character's display face, mono labels, doom-green accent, "Unofficial fan site" marker, the generic
image credit and the site URL; drawn client-side to PNG (1080x1350 and 1200x630).

**Arena worker** (`workers/arena/`, its own package; never part of the site build). Endpoints: `POST /vote`, `GET /result?a=&b=`, `GET /top`. Tables in `schema.sql`: `tallies` (one row per unordered pair, slugs alphabetical) and `seen` (daily HMAC markers, older than a day deleted on each vote). Secrets via `wrangler secret put`: `TURNSTILE_SECRET`, `HASH_SECRET`; never in files or chat. Local test: `npm run db:local` then `npm run dev` in `workers/arena` (`.dev.vars` holds Cloudflare's published always-pass test secret), and build the site with `PUBLIC_ARENA_API=http://127.0.0.1:8787 PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA`. Production: the GitHub repository variables `ARENA_API` and `TURNSTILE_SITEKEY` feed the build (`.github/workflows/deploy.yml`); while they are empty the arena shows "Fan voting opens soon". Known cost: a matchup switch is one 30 to 60 ms frame on click (cards and radar rebuild), and the comparison below rebuilds once idle after the slam.

**Live arena setup (26 October 2026).** Worker `https://doomsday-arena.prejith77.workers.dev` (account subdomain `prejith77`, registered through the API with the wrangler login), D1 `doomsday-arena` (`f645a0eb-1ae7-4421-ba60-47ab0f150150`), Turnstile widget "Doomsday Dossier arena" (Managed, hostname prejith77.github.io, site key `0x4AAAAAAFmK0zcRuJEqMKGy`, public). Secrets `HASH_SECRET` (random, set by Claude, never shown) and `TURNSTILE_SECRET` (pasted by the user in the dashboard; Claude never handles it). GitHub repository variables `ARENA_API` and `TURNSTILE_SITEKEY` are set. Lessons: wrangler's OAuth login cannot manage Turnstile (Authentication error), so widgets are made in the dashboard; on this PC PowerShell blocks `npx` scripts (use `npx.cmd`), and wrangler in the user's own terminal does not see the login made from Claude's shell; Turnstile always fails in the automated in-app browser, so test live votes from the user's own browser; secret names cannot be renamed in the dashboard (re-add and delete instead), and verify typed field values by reading them back, not from screenshots.

- **Writing files from the shell:** never put backticks inside a double-quoted `node -e` script; bash runs them as commands (it garbled this paragraph once). Write the script to a file with the Write tool, or use Edit.

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
| Yelena Belova | Red Room | Single-pass volumetric light shafts through slatted blinds toward a light at the cursor; dust in the beams | red, black | Bebas Neue |
| Red Guardian | Rack Focus | 3D snowfall with per-flake circle of confusion drawn as bokeh discs; pointer Y pulls focus, X sets wind; title blurs with focus | blue-black, sodium orange | Russo One |
| John Walker | Dog Tags | PBR metal tags (RoomEnvironment PMREM) on an instanced ball chain, damped pendulums toward the cursor, canvas bump-mapped stamp | olive black, brass | Graduate |
| Ghost | Phase Echo | Frame-feedback ping-pong buffer with zoom, drift and torn rows; phasing ring at the cursor; letters slip | grey-blue, cyan | Major Mono Display |
| Bob Reynolds | Sun and Void | Radiant core with noise rays versus SDF metaballs of void (smooth union) that the cursor repels; scroll grows the void and masks the name | gold, black, violet rim | Cinzel |
| Shuri | Sand Table | Instanced 3D pin-art table; vertex-shader heights morph between shapes; cursor raises pins; letters rise | violet, gold | Sora |
| M'Baku | Jabari Ridge | Stacked ridgelines with painter's hidden-line removal (double-sided fill strips in the opaque pass); drumbeat rolls front to back; title thumps | snow, earth | Bowlby One |
| Namor | Talokan | Iterated caustics, surface light shafts, depth gradient; bubbles rise from the cursor; letters swell | teal, deep blue, gold | Yeseva One |
| Loki | Branching Timelines | CPU-grown branching strands in a ring buffer; branching far likelier near the cursor; scroll prunes young branches; letters skew | green, gold | Playfair Display |
| Peggy Carter | The Dance | Mirror-ball facet spots computed per pixel in polar space with screen-scaled cells; cursor spins the ball; spotlight sweeps the name | warm sepia, gold, red | Limelight |

## How to run

```
npm install
npm run dev        # local dev server
npm run build      # static build to dist/
npm run shots      # Playwright screenshots, desktop and phone, to screenshots/
node scripts/photos-build.mjs            # photos: user-set.json + photo-originals/user -> public/photos + src/data/photos.json
npx astro preview --port 4322            # serve the production build for QA
node scripts/shots.mjs http://localhost:4322 screenshots/wave-N   # contact sheets per page
node scripts/overflow.mjs http://localhost:4322                   # phone-width overflow check
node scripts/fps.mjs http://localhost:4322 4                      # hero frame rates, CPU throttled 4x
node scripts/behaviour.mjs http://localhost:4322                  # reduced motion + navigation chain
node scripts/clip-audit.mjs http://localhost:4322 ["c/shuri,teams"] [desktop,laptop,phone]   # clipped or cut-off text, broken words
node scripts/interaction-fps.mjs http://localhost:4322 4               # frame rates during wave 7 interactions
node scripts/quiz-test.mjs http://localhost:4322 screenshots/quiz       # quiz playthrough, shared link, both cards, header fit
node scripts/showcase-shots.mjs http://localhost:4322 <dir> [desktop,phone] [archive,file]   # v2 showcase: timed intro, fly depths, file opening, fps
node scripts/showcase-record.mjs http://localhost:4322 <dir> [desktop|phone]   # one-take screen recording of the showcase (localhost only: needs __ddLenis)
node scripts/sheet.mjs <dir> <prefix> <out.jpg> [cols] [cell]                  # contact sheet of frames for reviewing motion
node scripts/power-grid.mjs "Thor_(Thor_Odinson)"                      # official grid from the archived Marvel Universe wiki
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
| 4 | Thunderbolts* | Yelena Belova | Florence Pugh | No | done |
| 4 | Thunderbolts* | Red Guardian | David Harbour | No | done |
| 4 | Thunderbolts* | John Walker | Wyatt Russell | No | done |
| 4 | Thunderbolts* | Ghost | Hannah John-Kamen | No | done |
| 4 | Thunderbolts* | Bob / Sentry | Lewis Pullman | No | done |
| 5 | Wakanda and Talokan | Shuri | Letitia Wright | Yes (teaser) | done |
| 5 | Wakanda and Talokan | M'Baku | Winston Duke | Yes (teaser) | done |
| 5 | Wakanda and Talokan | Namor | Tenoch Huerta Mejia | Yes (teaser) | done |
| 5 | More confirmed | Loki | Tom Hiddleston | No | done |
| 5 | More confirmed | Peggy Carter | Hayley Atwell | Yes (D23 2026) | done |
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

- Strip and fill meshes built by hand may wind clockwise; give them `side: THREE.DoubleSide` or they are culled silently (M'Baku's ridges).
- Lines that must interleave with opaque fills by `renderOrder` must also be opaque materials; transparent ones are drawn after all opaque objects.
- If a session ends while research agents run, resume them with SendMessage to their agent IDs; their transcripts survive.

- Title effects must not animate `text-shadow`, `filter` or `font-variation-settings` every frame: each one repaints large text and cost Bob 25 fps and Yelena 11 fps at 4x CPU throttle. Animate `opacity` and `transform` only, and write styles only when the value changes. Tech debt: storm, optic, cards, fur, flame and cerebro still animate shadows or weight per frame; they measure 60 fps here, but audit them on a real phone.

- Never name a GLSL variable `half` (reserved word). Three.js records shader compile errors in `renderer.info.programs[].diagnostics` without logging them. `shots.mjs` and `fps.mjs` now read those diagnostics on localhost (the engine is exposed as `window.__ddEngine` there only) and print SHADER errors; treat any as a blocker.
- Hero names are capped by their longest word (`--hero-longest`) so wide faces can never break a word. Use `heroScale` for further tuning.
- Letters that move after the intro (magnet, bamf) unclip their SplitText line masks after 2 s.
- Screen entries with no named performer use actor "Uncredited"; the page prints "Performer uncredited". Never blanket-replace actor strings; check each one.
- `node scripts/heroes.mjs <url> <out.jpg> <slug,slug> [phone]` makes one grid of hero views for fast review.
- **No cut-off text, ever.** Run `scripts/clip-audit.mjs` before every deploy (desktop and phone; add laptop 1280x720 when touching pinned sections). It opens every source list, walks the page, and flags text past the viewport, clipped by an overflow ancestor, or overflowing its own box, plus pinned timeline cards taller than the screen. In Git Bash, pass page filters without a leading slash (MSYS rewrites `/c/...` into a Windows path).
- All character names are uppercase everywhere (cards, team pages, heroes, next links). `fontCase` in `DESIGN` stays 'uppercase'.
- Every display heading carries `--lw` (its longest word) and is capped by the space it sits in (`100vw` or `100cqi` in a container), so long words in wide faces never break or clip.
- The comics timeline pins sideways only when every card fits the viewport height (JS adds `.tl-row` after measuring); otherwise it stacks. A pinned section must never use `overflow: hidden` on the vertical axis: opened source lists were cut off. Use `overflow-x: clip` only; `app.ts` refreshes ScrollTrigger on every `details` toggle.
- A header scrim fades in once the page scrolls (`html.scrolled .hdr-scrim`), so text never collides with the logo and menu. The header itself keeps `mix-blend-mode: difference`.
- Shuri's pin table sizes itself to the camera's visible ground (corner raycasts) and rebuilds on resize. Small hero text has a static shadow; the pins scene also deepens the shade under the text on tall screens.

- **Photos.** `scripts/photos-build.mjs` writes 400 px and native-width WebP (plus 800/1280/1920 for the 4K files), a halftone PNG (white dots, 4-colour palette, about 15 KB) and a 16 px placeholder per photo, about 11.7 MB in all; each page loads only its own. `src/components/Photo.astro` renders srcset, real width and height, lazy loading (eager plus fetchpriority high for the hero) and the crop centre. Two crop centres: `focus` for the wide desktop hero panel, `focusM` for every portrait-shaped frame. Landscape photos (wider than 1.2:1) get the `wide` hero panel (78vw) and a `sizes` hint that accounts for cover cropping, or the browser picks too small a file.
- **Astro scoped CSS does not reach into child components.** Style the Photo component's `<img>` from a page with `:global(.photo)` under a scoped parent; a plain `.photo` selector silently does nothing (the hero photos stretched to natural height until this was fixed).
- `clip-audit.mjs` also flags words broken across lines in headings and names (it caught nothing new, but a forced fault proved it catches 7 broken team names).
- **Wave 7 performance lessons.** Measure interactions, not just heroes: `scripts/interaction-fps.mjs` (team filter, team chain drag, timeline fling, versus switching, flythrough scroll, CPU 4x). Never put `filter`, large blurred `box-shadow`, SVG blur filters or `mix-blend-mode` on elements that move or scale: each repaints every frame (team filter photos, radar glow, timeline glow and the flythrough shadows all cost 10 to 20 fps until replaced by overlays, wide translucent strokes and plain borders). Cache measurements that only change on filter or resize (timeline frame centres).
- **Never use ScrollTrigger `snap` with Lenis.** It froze the page for 1.1 to 1.3 s when scrolling stopped. Snap by gliding through Lenis instead (`src/scripts/motion/scroller.ts`: `glideTo`). Lenis is exposed as `window.__ddLenis` on localhost only, so QA scripts scroll the way visitors do; `window.scrollTo` alone gets undone by Lenis.
- **Astro `<template>` elements break the compiler** when they contain JSX expressions ("Expected ) but found }"). Use a hidden `<div>` instead.
- In a 3D context (`preserve-3d` or perspective with 3D transforms) `z-index` does nothing between siblings; two rules with equal specificity also resolve by order (`.pk-team` beat `.pk-lead`). Set stacking inline when it matters.
- Flip with `absolute: true` takes cards out of the layout: hold the grid's height while they fly, pin rows with `align-content: start` (or rows stretch), and set `overflow-anchor: none` so the browser does not use a flying card as its scroll anchor. Known cost: a team filter click is one ~55 ms frame (unthrottled) while Flip measures the grid; the flight itself is smooth.
- **Power grids.** Source is Marvel.com's old Marvel Universe wiki through the Wayback Machine (the Marvel Fandom wiki no longer carries grids). `scripts/power-grid.mjs` reads bar widths (21 px per point). An all-1 grid is Marvel's blank placeholder: reported as not rated. That wiki was partly fan-edited, so some grids differ from the printed Handbooks (Nightcrawler 5/4/7/5/7/7): the site labels them "as published on Marvel.com's Marvel Universe wiki" and links the archived page. Not rated: Joaquin Torres, Red Guardian, Ghost, Shuri, M'Baku, Peggy Carter.
- **Character fonts on multi-character pages** load from `src/styles/faces.ts`; the home roster section uses `content-visibility: auto` so its faces download only as the roster nears the screen.
- `src/scripts/app.ts` runs DOM motion first, then lazy-loads Three.js (`gl/engine`) and the page's scene chunk. Critical JS is about 60 KB gzipped; Three.js is about 130 KB and loads in parallel.
- One persistent WebGL canvas (`#gl`) for heroes, and a second tiny canvas (`#wipe`) used only for page transitions. Both survive navigation via `transition:persist`.
- Scenes communicate to the DOM through `ctx.signal` (the storm uses it to flash Thor's name).
- Never put a paraphrase in quotation marks. The logline on the home page is our paraphrase and is labelled as such.
- Endgame Encore (re-release, 25 September 2026): Marvel's article confirms the re-release and the extended Steve and Peggy ending. Its Doom post-credits scenes are cited to the MCU Wiki only.

- **Display text is measured, not guessed.** `fitText` (motion/grammar.ts) runs before splitting, after fonts land and on resize: every `.display` and `[data-fit]` element shrinks just enough for its widest word in its real face (wide faces like Syne beat the letter-count CSS: Sam's "APPEARANCES" and "2018" ran under the next column, which the clip audit cannot see because nothing clips them). Flex-row items (the screen act's year) fit beside their siblings.
- **Never write regexes through a shell heredoc or `node -e`.** `/\s+/` lost its backslash twice and became `/s+/` (split on the letter s), which sized hero and team names by the wrong word for weeks. Use the Edit tool or String.raw in a script file.
- **SplitText masks are `.split-line-mask` wrappers**, not `.split-line`. Effects that move letters after the intro must unclip both (Magneto and Nightcrawler were clipped until this was fixed). Line masks carry 0.22em of room below for descenders.
- **Stale pages after a deploy.** Each deploy renames CSS and JS; GitHub Pages lets browsers keep HTML for 10 minutes, so a cached page can ask for deleted files and render unstyled ("Skip to content" over a bare canvas). Base.astro has an inline guard: a failed /_astro/ stylesheet or script, or a failed dynamic import, reloads the page once (at most once a minute).
- **Astro links the CSS of anything a page script might import, even dynamically**, so lazy-importing CSS does not defer it. The home roster defers its 29 faces instead by using the plain serif until app.ts adds `.asm.faces` (roster within 1500 px): 4 fonts on the first screen instead of 33.
- Page wipe 480 ms cover and 620 ms reveal (was 750 and 900); hero text fades in after 0.25 s (was 0.6 s) over 0.9 x pace.

## Open items

- motionsites.ai reference links from the user (triggers a motion tuning pass).
- Real-ESRGAN (realesrgan-ncnn-vulkan v0.2.5.0) was downloaded to the session scratchpad and tested, then dropped at the user's request: about 1 min 43 s per photo on the UHD 730. One upscaled test file sits in `photo-originals/upscaled/` (unused).
- Git has no global identity on this machine. The repo uses a local identity (Prejith, account email); the user may change the name.
- GitHub CLI is installed per-user via winget at `%LOCALAPPDATA%MicrosoftWinGetPackagesGitHub.cli_*ingh.exe` (not on PATH in old shells) and signed in as prejith77. Use it to watch deploy runs.
- If a push does not start a deploy run (seen once on 2026-10-25), start one by hand: `gh workflow run deploy.yml -R prejith77/doomsday-dossier --ref main`.
- Deploy runs show GitHub's Node 20 deprecation warnings for the checkout, setup-node and pages actions. Harmless for now; bump the action versions when newer majors ship.

## Session log

- 2026-10-26: v2 preview: horizontal "record" with a chapter drawer replaces the text-heavy file sections; custom cursor and page transitions; 3D depth heroes (Diorama) for all 29 files from the user's photos. Found and fixed black cut-outs (all 87) and 19 black HD upscales (rebuilt from originals, re-upscale running). 55 to 60 fps at 4x throttle. Not committed or deployed yet; /preview/ swap still waits for the user's approval.

- 2026-10-26: Fix pass from user report before posting on Reddit: unstyled pages after deploys (reload guard), cut descender in "Ready by Doomsday." (deeper masks, room under titles), planner said 53 days against the countdown's 52 (both floor now; pace uses exact time), Sam's screen act year and heading ran under the next column (fitText), hero/team name sizing regex bug, Magneto/Nightcrawler letters clipped, home loaded 33 fonts up front (now 4), faster page wipe and intro. Security check: no secrets in the repo, worker queries bound, but every commit shows the user's Gmail address.
- 2026-10-26: Quiz live at /quiz/ ("Which Doomsday hero are you?"), questions approved by the user. Header now has five links (Quiz added) and hides them below 860 px (the menu has them all). Lessons: scoped Astro CSS does not style elements a script creates (use `:global`); estimating a name size from character count fails for wide faces like Syne, so measure after the font loads.
- 2026-10-26: Prediction board live at /predictions/: user approved the 10 questions; seal countdown, lock-in with Turnstile, fan split bars, copy-my-picks, read-only after the seal; compact sticky bar on phones (95 px). Remote D1 tables applied (first `d1 execute --remote` printed only the permissions list; rerun succeeded, so check for "success": true). Next: the quiz (rank 6), questions drafted for the user to approve.
- 2026-10-26: Fight arena built on /versus/ (renamed Arena in the nav): card slam with shockwave, flash and shake; one documented feat per card cycling with its source (wide screens; the full list sits below); fan vote panel with Turnstile, results after voting or on request, remembered for the day. Arena worker written and tested locally (votes, daily dedupe, shared tallies for both orders, bad slugs and missing tokens rejected, CORS locked to the site). Waiting on the user to create the free Cloudflare account, then: wrangler login, D1 create, schema, secrets, deploy, repository variables.
- 2026-10-26: Wave 7 built and checked: team picker with Magnetic Team Chain (home now also lists Kathryn Newton and Mabel Cadena, and loads the character fonts it was missing), /timeline/ with the Film-Burn Scrubber, /versus/ with official power grids for 23 of 29 characters (6 not rated), radar, feats and connections, Panel Flythrough on character pages. Research: six parallel agents wrote research/versus/*.json. Performance pass on interactions; Lenis-based snap. Third interview done: twelve fan features ranked in the backlog above, Cloudflare Workers + D1 + Turnstile chosen, Dossier-file share cards, Claude drafts quiz and predictions for approval.
- 2026-10-25: Photos from the user's own set (87 files, three per character) replace the marvel.com picks. User chose a generic credit after being told many look fan-made or AI-made, and declined upscaling (2.5 hours). Built: photo hero (wide panel for landscape photos), In frame gallery with developing prints, tilt and Halftone Lens, photo cards on home and team pages, next-dossier photo, /credits/ page, footer link, about-page rule rewritten. Team names on phones were breaking mid-word after the photo column was added: now sized by longest word, and the audit checks for broken words.
- 2026-10-25: Fix pass before photos (user report): names all caps (Shang-Chi, Scott Lang, Mystique, Beast, Thor were mixed case), act and timeline headings sized by longest word, comics cards no longer cut (rail pins only when cards fit, else stacks), opened source lists no longer clipped in the pinned act, Shuri's pin table edge to edge, header scrim on scroll, Shuri hero text legible on phones. New clip audit: 0 issues on all 38 pages at desktop, laptop and phone. 60 fps at 4x throttle, no phone overflow, reduced motion and navigation pass. Deployed. Still waiting on the user's photo swaps (their message listed none).
- 2026-10-25: Wave 6 step 2: user approved all 62 files; downloaded into photo-originals/ (git-ignored; sizes all matched the list; SHA-256 in downloads.json). Viewed every image. Recommended one pick per character in research/photos/picks.json (with crops). Findings: Sam's listed first choice was a merchandise photo (rejected); the Days of Future Past banner has Patrick Stewart and Ian McKellen, giving Professor X and Magneto; X-Men (2000) gives Romijn's Mystique; X2 gives Cumming's Nightcrawler. No official photo of Marsden (Cyclops), Grammer (Beast) or Tatum (Gambit): those keep abstract heroes. Waiting on the user to confirm the picks.
- 2026-10-25: Wave 6 step 1: photo download list built from marvel.com, cdn.marvel.com and d23.com only (no downloads; sizes via HEAD). 71 candidates, 62 distinct files, 11.92 MB; first choices 25 files, 7.49 MB. No official photo found for Beast or Gambit; the five other X-Men only have Fox-era group key art; Doom only an article header image. Files: research/photos/manifest.{json,md,html}; rebuild with node scripts/photo-manifest.mjs. Waiting on the user to approve.
- 2026-10-25: Wave 5 deployed and verified live (38 pages, no phone overflow, five new heroes 60 fps at 4x throttle). All 29 confirmed characters with a named role or a known last role now have dossiers. Next: wave 6 (photos), which starts with a download manifest for the user to approve.
- 2026-10-25: Wave 5 (Shuri, M'Baku, Namor, Loki, Peggy Carter) built and checked: five new heroes, no shader errors, 60 fps at 4x CPU throttle, no phone overflow, reduced motion and navigation pass. Marvel cast unchanged; Shuri's role recorded as 'Shuri / Black Panther' per Marvel's teaser article. Research agents were resumed after a session restart.
- 2026-10-25: Wave 4 deployed and verified live (33 pages, no phone overflow, all five new heroes 60 fps at 4x throttle).
- 2026-10-25: Wave 4 perf fixed (title effects made repaint-free): all five Thunderbolts* heroes 60 fps at 4x CPU throttle. Footer now carries the non-commercial and removal-on-request lines.
- 2026-10-25: Second interview on the revised brief (photos, interactive features, original ideas). Decisions in "Revised brief" above. Wave order changed to: finish the roster (4, 5), then photos (6), then features (7). Wave 4 committed locally, not deployed: Sun and Void 35 fps and Red Room 49 fps at 4x CPU throttle.
- 2026-10-25: Wave 3 (X-Men) deployed and verified live (28 pages, no phone overflow, new heroes 59 to 60 fps). Built and checked: seven new heroes, no shader errors, 58 to 60 fps with CPU throttled 4x, no phone overflow on any page, reduced motion and navigation pass. Marvel cast unchanged; Marvel names Professor X, Magneto and Cyclops only. Found and fixed a silent shader compile failure (Magneto) and added shader-error detection to QA.
- 2026-10-25: Wave 2 (Fantastic Four) deployed and verified live (21 pages, no phone overflow, new heroes 60 fps). Built and checked: four new heroes at 60 fps with CPU throttled 4x, no phone overflow, reduced motion and navigation pass. Marvel cast list re-checked, unchanged at 30 names; only the Thing has a Marvel-named role among the four. Engine now has a depth buffer for 3D scenes.
- 2026-10-25: Wave 1 deployed to https://prejith77.github.io/doomsday-dossier/ (first run succeeded). Live QA passed: all 17 pages return 200, no phone overflow, reduced motion and navigation checks pass, WebGL scenes load from the sub-path.
- 2026-10-25: Wave 1 built: home, 8 character dossiers, 7 team pages, sources page. QA passed: no phone overflow on any page; all heroes 60 fps at phone size on an Intel UHD 730 with 4x CPU throttle (not yet measured on a real phone); reduced motion leaves all text visible with no pinning or smooth scroll; four-hop navigation clears the wipe each time. Not deployed yet: waiting on the GitHub repo URL.
- 2026-10-25: Interview complete, all decisions above locked. Official cast verified on marvel.com (30 names on the film page plus Peggy Carter confirmed at D23). Wave 1 research started.
