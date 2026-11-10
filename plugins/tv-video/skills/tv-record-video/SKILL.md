---
name: tv-record-video
description: Use when the user says "record a video", "record video", "make a video of", "/record-video", or asks to capture one or more QA flows as a video. Drives each flow with agent-browser and captures it as a REAL continuous screen recording (agent-browser's native `record start`/`record stop`, WebM), then concatenates the segments into a single mp4 via ffmpeg. Mirrors a QA document's hierarchy — shows full-screen HTML section title cards (main points 1, 2, 3) and subsection title cards (subpoints 1.1, 1.2) live in the recording, and keeps a persistent corner badge on screen so the viewer always knows which numbered (sub)point is being tested.
---

# Record a QA Video (native screen recording)

Capture one or more QA flows in the browser and produce a single mp4 the user
can watch to judge how the feature works.

This skill records the **actual session in real time** using `agent-browser`'s
native video recording (`record start` / `record stop`), not a slideshow of
screenshots. Every click, transition, animation, and form interaction is in the
footage as it happened. Title cards are shown as real pages inside the recording
and the corner badge is a live DOM overlay, so the whole thing is genuine video.

**The video must clearly label every section and subsection of the QA being
performed**, mirroring the structure of the QA document/checklist being followed
(main points `1`, `2`, `3`; subpoints `1.1`, `1.2`, …). The viewer must always
be able to tell, at a glance, which numbered point is on screen and when a new
one starts. Three nesting levels:

- **Run** — the whole recording, one timestamped folder, one mp4.
- **Section** (QA doc main point, e.g. `1 Login`) — preceded by a large
  full-screen **section title card** held for **3 seconds**.
- **Subsection** (QA doc subpoint, e.g. `1.2 Invalid password`) — preceded by a
  visually distinct **subsection title card** held for **2 seconds**, *and*
  every app page inside it carries a **persistent corner badge** (e.g.
  `1.2  Invalid password`) so the viewer is never lost mid-footage.

A run with no subpoints is just a run whose sections have no subsections — use
section cards only and skip the badges.

## Film only what is being tested (REQUIRED)

The video is about the feature under test, nothing else. Every second must
show that feature in action. The viewer does not want to watch the steps that only
get the browser to the right place.

- **Do not film sign-in** unless the QA is about sign-in. Sign in off camera
  (`keep_login`), before the first `goto`.
- **Do not film the landing page after sign-in** (the dashboard, the home page)
  unless the QA point needs it, for example "the new order shows on the
  dashboard".
- **Do not film the clicks through the menus** that lead to the feature. Open
  the nearest page to the feature directly with `goto`.
- **Start each recording at the closest natural starting point** of the thing
  under test. Testing order creation? `goto` the order list, then click
  "New order" on camera. Do not start at the dashboard and click through the
  sidebar, and do not start already on the filled form either: the viewer
  should see the one click that starts the flow.
- **Stop as soon as the result is clear.** Once the success message, the error,
  or the new row is on screen and held for its pause, the subsection is done.
  Do not wander on to unrelated pages.
- **Setup is off camera.** Fixtures, test users, settings changes and any other
  preparation happen before recording (see "Setup data" below).
- **A subsection that repeats a flow** (the same form with different input)
  starts again at the same starting point, not from the top of the app.

Ask for each step you plan to record: "is this what the QA point checks?" If
not, do it off camera or skip it. A short video that shows only the feature
beats a long one that shows every step of every scenario.

## How native recording works here (READ THIS — the design depends on it)

`agent-browser record start <file.webm>` records the **current page** and keeps
recording continuously **across click- and submit-driven navigations** — link
clicks, button clicks, and form submits that redirect all stay in one unbroken
video. That is the normal QA path and it Just Works.

The one exception: an explicit **`open <url>` jump resets the recording** — the
footage before the `open` is lost, and the saved file only contains the page you
landed on. So **every explicit URL jump must be a segment boundary**: stop the
current recording (which saves it), `open` the new URL, then start a fresh
recording. The `goto` helper below does exactly this. At the end, all segments
are concatenated into one mp4.

Consequences you must respect:

- **Navigate with `goto <url>`** (the helper), never a bare `agent-browser open`,
  once recording has started. `goto` closes the current segment and opens a new
  one so nothing is lost.
- **Clicks, fills, and submits need no special handling** — they record
  continuously inside the current segment, including any redirect they trigger.
- **Title cards are their own segments** — they are real HTML pages you `goto`.
- This was all verified on this machine: a static 3 s hold records as exactly
  3.0 s; click/submit navigation records continuously; `open` jumps split cleanly
  via stop/start; segments concatenate to the exact summed duration.

## Chrome launch flag (REQUIRED in containers/VMs)

On this environment Chrome will not launch without `--no-sandbox`. Export this
once at the top of the run (it is harmless where it isn't needed):

```bash
export AGENT_BROWSER_ARGS="--no-sandbox,--disable-dev-shm-usage"
export AGENT_BROWSER_COLOR_SCHEME=dark   # record in dark mode (see Dark mode)
```

Without it every `agent-browser` command fails with "No usable sandbox".

## Request log overlay (on by default)

Every app page in the recording shows a small see-through box in the
bottom-right corner with the last 5 requests the page made, newest at the
bottom, so the viewer sees which request each click or debounced input caused:

```
GET    /orders/new  200 85ms
POST   /reactive/actions  recalculate  amount, currency  200 83ms
POST   /orders  order[customer_name, amount, currency, +2]  302 83ms
PATCH  /orders/42/send_email  422 82ms
```

- It is `bin/qa_request_log.js`. Outside a recording it is an agent-browser
  init script (`AGENT_BROWSER_INIT_SCRIPTS`, set by the helpers). `record
  start` makes a fresh context that drops init scripts, so inside a recording
  `sync_badge` injects it with `eval` — after every `goto` and after every full
  page reload, the same calls that keep the badge. Turbo visits keep it.
  Requests made before the injection (the first page's own GET) still show,
  read from the page's navigation timing.
- It watches `fetch` and XHR (Turbo Drive visits, Turbo form submits, frames,
  phlex-reactive actions, Stimulus fetches) and full page loads. Same-origin
  only; assets, Ahoy, Action Cable, pgbus streams and `/up` are left out.
  A path part longer than 24 characters (a token, a signed id) keeps its
  first 8 characters.
- **Field names only, never values** — no customer data in the video. Rails
  nesting is grouped (`order[a, b, +2]`), the CSRF token and `_method` are
  hidden (a `_method=patch` row shows `PATCH`), a phlex-reactive row shows the
  action name instead of the signed token, a query string shows its keys only.
- Status is green for 2xx, amber for 3xx, red for 4xx/5xx. Rows dim after 4 s,
  the box hides after 9 s with no new request, and it never takes clicks.
  Title cards (`file://`) never show it, and rows older than 15 s are not
  carried onto the next page, so a section starts clean.
- When narrating, a red row is worth a sentence ("the server answers 422").
- Turn it off for one run with `QA_REQUEST_LOG=0` in the line that sources the
  helpers, e.g. when the bottom-right corner holds what the QA is about.

## Screen size — full screen, 1920×1080, NO zoom (REQUIRED)

**Desktop recording must be full screen at 1920×1080 with no zoom.** A previous
run captured the browser at roughly half the screen and the video looked
horrible. Don't let that happen again. (Mobile-viewport segments are the one
exception — they record at their true phone size and are pillarboxed on black
at render time; see the mixed desktop + mobile section below.)

1. **Set the viewport to 1920×1080 once, before recording starts:**

   ```bash
   agent-browser --session qa set viewport 1920 1080
   ```

   Recording then captures native 1920×1080 (verified). This is baked into the
   setup below — do not skip it.

2. **No browser zoom.** Leave zoom at 100%. Never apply CSS/page zoom or a device
   pixel ratio that shrinks the captured content.

3. The HTML title cards and the ffmpeg render canvas are all 1920×1080, so
   desktop footage fills the frame edge-to-edge with nothing scaled or
   letterboxed.

## Dark mode — record in dark mode when you can (PREFERRED)

White screens are hard on the eyes of the people who watch these videos. Record
the app in **dark mode** by default. Use light mode only when the thing under
test is the light theme itself, or when the user asks for light.

1. The helper file exports `AGENT_BROWSER_COLOR_SCHEME=dark`, so the browser
   starts with `prefers-color-scheme: dark`. The setup block also runs
   `ab set media dark`.
2. In an app with its own theme setting, this works only when the signed-in
   user's theme setting is "system". A user saved as "light" still gets the light theme. If the first
   screen after sign-in is light, set that test user's theme to dark (or
   system) in the app's settings during the rehearsal, before you record. On
   staging or production, do not change a real user's settings; record in
   light and say so in the report.
3. The title cards and the corner badge are already dark, so they match.
4. Native, on an Android emulator: put the emulator in dark mode before recording
   (`adb shell cmd uimode night yes`).

## Mixed desktop + mobile in one video (NO stretching — REQUIRED)

When part of the run is recorded at a **mobile viewport** (e.g. 390×844), that
footage must appear in the final 1920×1080 video **centred at its true aspect
ratio with black bars filling the sides** — a phone-shaped picture in the
middle of the frame. It must **never be stretched to desktop size**. A past run
smeared a portrait mobile recording across the full 1920×1080 frame; that is
exactly the failure to prevent.

How the pipeline guarantees it:

- `render_video` normalises **each segment individually** — aspect-preserving
  scale, then centred padding onto a black 1920×1080 canvas — **before**
  concatenating. Concatenating mixed-resolution webm files directly is what
  causes the stretching (the concat demuxer forces every segment to the first
  one's dimensions before any filter runs), so never bypass `render_video` with
  a hand-rolled single-pass concat on a mixed run.
- **Change viewport only at a segment boundary**, via the `viewport` helper
  (`viewport 390 844` for mobile, `viewport 1920 1080` back to desktop). It
  closes the current segment first; the next `goto` starts a fresh segment at
  the new size. Never call `ab set viewport` bare while a segment is recording
  — the frame size would change mid-file.
- After rendering, run `check_geometry` and, on any mixed run, extract a frame
  from inside a mobile span (`ffmpeg -ss <sec> -i "$RUN_DIR.mp4" -frames:v 1
  /tmp/mobile_check.png`) and **read the image** to visually confirm the phone
  view is centred with black side bars and its proportions look natural — not
  stretched, not squashed.

## Mirror the QA document's numbering (REQUIRED)

When the user supplies (or points at) a QA document, checklist, or test plan,
**use its exact point numbers and titles** on the cards and badges — section `1`
→ `section "1" "<its heading>"`, subpoint `1.2` → `subsection "1.2" "<its
subheading>"`. Do not renumber or paraphrase the headings; the video should be
traceable back to the doc point-for-point.

**Every card also carries a one-line description of what is about to be
tested** (the optional third argument to `section`/`subsection`). Pull it from
the QA doc's own wording when available; otherwise write one short sentence
yourself (e.g. `"Submitting the wrong password must show an error and keep the
user on the sign-in page"`). Cards with a description hold longer so the viewer
can actually read it.

Only auto-number (`1`, `1.1`, `1.2`, `2`, …) when no document structure is given
and you are inventing the breakdown yourself. If you auto-number, tell the user
what breakdown you used when reporting back.

## Trigger

- User says "record a video …", "record video of …", "make a video of …".
- User invokes the `/record-video` slash command.

## Folder convention

One fresh run folder per invocation:

```bash
RUN_DESC="login_and_password_reset"   # snake_case summary of the whole run
RUN_DIR="$HOME/qaRun/$(date +%Y-%m-%d_%H-%M)__${RUN_DESC}"
mkdir -p "$RUN_DIR/cards"
```

Example: `~/qaRun/2026-06-15_14-07__login_and_password_reset/`. The generated
title-card HTML lives in `$RUN_DIR/cards/` and the recorded segments
(`seg001.webm`, …) live in `$RUN_DIR`. The final mp4 is written **beside** the
folder, named after the run — `$RUN_DIR.mp4` (e.g.
`~/qaRun/2026-06-15_14-07__login_and_password_reset.mp4`) — so the deliverable
has a descriptive filename and sits next to its working directory. Keeping cards
in the run folder (rather than `/tmp`) makes each run self-contained and
reproducible.

If the run covers multiple sections, pick a `RUN_DESC` that summarises the whole
run (e.g. `auth_flows`, `enquiry_lifecycle`), not just the first section.

**Compute `RUN_DIR` fresh, every invocation. Never read it back from a cache.**
Helper state has to live in a file (each Bash tool call is a new shell, so
`SEG_N`, `RECORDING` and `BADGE` do not survive as shell variables), and it is
tempting to cache the folder path the same way. Do not: a stale path from a
previous session silently writes the first segments into an old run folder and
mixes them into that run's `segs.txt`. Cache the *state* inside `$RUN_DIR`
(`$RUN_DIR/.state`), and derive `$RUN_DIR` itself from `date` each time.

## Timing conventions

| Frame type                        | On-screen duration                  |
|-----------------------------------|-------------------------------------|
| Section title card                | **3 s** (4 s with description)      |
| Subsection title card             | **2 s** (3 s with description)      |
| Each meaningful state             | **~1.2 s pause**                    |
| After each `fill`                 | **~0.8–1.2 s pause** (mandatory)    |
| Unintentional static screen       | **≤ ~3 s** — anything longer is dead air |

Because this is real video, "duration" is controlled by how long you hold the
page on screen with `pause`, not by a frame manifest. The subsection card is
shorter than the section card on purpose — it reads as a "step down" rather than
a brand-new chapter. Title cards never hold for less than 2 s — the viewer must
have time to read what is being tested.

## Density rule — pause at every meaningful state

The video must make each step obvious. Since the footage is continuous, the
equivalent of "take a screenshot" is **`pause`** — hold the current state long
enough for a viewer to register it. Pause generously:

- after each navigation settles,
- after each field is filled (so progressive form state is visible),
- before and after each click that changes the page,
- on error / success banners, modals opening / closing, tab switches,
- during long loads, a short pause keeps continuity.

Type with `fill` (it shows the text appearing). Avoid instant machine-gun
actions with no pauses — the viewer can't follow them.

## Pacing — no dead air, no rushing (REQUIRED)

The recording rolls in **real time**: every second you spend reading output,
parsing a snapshot, or composing the next command is frozen footage the viewer
sits through. Past runs landed on a form, showed it static for ~7 s while the
agent thought, then filled it in half a second and jumped away. Both halves are
wrong — the wait was dead air, and the fill was too fast to follow.

1. **One bash block per subsection.** Drive each subsection's whole flow
   (`goto` → snapshot → fills → click → wait → `sync_badge` → `pause`) as a
   **single Bash invocation**. Splitting a flow across separate tool calls
   inserts multi-second frozen gaps between them. The gaps between *commands
   inside one block* are milliseconds; the gaps between *tool calls* are
   seconds.
2. **Rehearse before recording.** Do an unrecorded pass first (same pages, a
   throwaway session or before `record start`) to learn the URLs, element refs,
   and any surprises. The recorded pass is then a clean scripted replay — no
   exploration on camera.
3. **Never stop to think mid-segment.** If something unexpected appears while
   recording (unknown ref, error page), `finish` the segment, sort it out
   off-camera, and start fresh; a segment that captured confusion can simply be
   removed from `$SEGS` before rendering.
4. **Deliberate pauses only — but always pause.** The rhythm the viewer needs:
   ~1.2 s after each state change, ~0.8–1.2 s after **every** `fill` so the
   value visibly lands before the next action. A pause after a fill is
   mandatory, not decorative.
5. **Cut the dead air properly, with `tv-defreeze`.** Gaps between tool calls
   freeze onto camera no matter how carefully you batch; a long pass routinely
   carries several 10–20 s frozen frames. Do not speed whole segments up — that
   makes the action unwatchable too. Run:

   ```bash
   tv-defreeze --run "$RUN_DIR"
   ```

   It trims each frozen stretch to a short hold, **leaves title-card segments at
   full length** (they are static by design — a blanket trim cuts a 4 s card to
   1.6 s and nobody can read it), rewrites `segs.txt`, and — the part that
   matters downstream — **re-maps every beat offset** through the same
   kept-interval map. Skip that and `tv-narrate-video` lands nearly every line
   early or late, because beats were logged against the untrimmed footage.
   One run went 13:12 → 6:53 with nothing lost.

   Then re-run the concat, and use `check_dead_air` to confirm only the cards
   show up as static.

## Prove every segment before you move on (REQUIRED)

A segment that captured the wrong screen is worse than a missing one: the
narration will confidently describe something that is not there, and you will
only find out at the verification pass, hours later. End every subsection's bash
block with an assertion that echoes the state back to you:

```bash
ab eval "(()=>{const o=[];document.querySelectorAll('*').forEach(e=>{
  if(!e.children.length && e.offsetParent && /REGISTRATION NUMBER|VAT NUMBER/i.test(e.textContent))
    o.push(e.textContent.trim())});return JSON.stringify([...new Set(o)])})()"
```

Two seconds of output, and it doubles as the observed-value record for the
companion QA report. If it comes back empty or wrong, re-record that segment
immediately — drop the bad file from `$SEGS`, reset `SEG_N`, and repeat.

**The failure this exists to catch:** a customer detail page opened by URL
rendered only the list, with the detail panel absent. Five
segments of one section showed the wrong screen. The panel only appears when you
**click the row** — and the click needs the list to have settled (~2.5 s) plus a
retry:

```bash
R=$(ref "button \"[A-Z]{2} $NAME[^\"]*\" \[ref=\\K[^\]]+")
ab click @$R; ab wait 1500
case "$(ab get url)" in *"/customers/"*) ;; *) ab click @$R; ab wait 2000;; esac
```

Assume nothing about a URL rendering the same thing a click does. Overlays,
drawers and side panels frequently do not.

## Filming things that are not a web page

**API calls.** Do not narrate an API section over a terminal, and never fake it.
Run the requests for real with `curl`, capture each one's method, URL, body,
status and response into JSON, then render **one self-contained HTML evidence
page per subsection** and `goto` it like any other page. Green and red status
pills, request on the left, response on the right, one card per call. The result
reads like a report, holds still for the narrator, and every number on screen was
genuinely returned by the app. This is the part of a QA video reviewers say is
the most convincing, and it is the cheapest section to film.

Keep the evidence page under about six cards, or scroll it deliberately with a
pause on each screenful — a card that scrolls past while its line is being spoken
reads as a mismatch.

**PDFs.** `agent-browser download` is unreliable inside a recording context.
Fetch the file out of band with `curl` and the session cookie, then `goto
"file://$RUN_DIR/pdf/<name>.pdf"` — Chrome's built-in viewer renders it full
screen and it records like any other page. Showing the real PDF next to the
on-screen preview is what makes a "preview and PDF must agree" check believable.

**Setup data.** Create the fixtures you need through the API *off camera*, before
recording. The on-camera pass should create only what the scenario is actually
about. A run that spends four minutes filling in setup forms is four minutes
nobody watches.

## Workflow

1. **Map the QA structure first.** If the user gave a QA doc/checklist, list its
   sections and subsections and reuse their numbers + headings verbatim. Write a
   one-line description for every card (from the doc's wording if it has one).
   If no doc, decide the breakdown yourself and auto-number it. Pick a
   snake_case `RUN_DESC` summarising the *whole* run. If the scenarios are
   unclear, ask one clarifying question before starting. For every subsection,
   pick its **starting page**: the closest page to the feature, where the first
   recorded click starts the flow (see "Film only what is being tested").
2. **Rehearse off-camera, and keep the results.** Walk every flow once without
   recording to collect URLs, element refs and expected outcomes, so the
   recorded pass is a scripted replay (see the pacing rules). This is also when
   you actually *do* the QA — the rehearsal is where you find out whether the
   feature works. Write down each observed value as you go; the recorded pass and
   the companion report are then both just reporting a result you already have.
   Create fixtures through the API here, not on camera.
3. Write the helpers (below) to a file and `source` it at the top of **every**
   Bash call, passing `RUN_DIR`. They set up the folder, the `--no-sandbox` flag,
   the file-backed counters, and all the recording/card/badge functions.
4. `ab set viewport 1920 1080` — full screen, and `ab set media dark` — dark
   mode (both in the setup block).
5. For each **section** (QA main point):
   1. `section "<num>" "<heading>" "<one-line description>"` — shows a
      full-screen section card (3 s, 4 s with description) and clears the badge.
      (This opens the first segment automatically.)
   2. If the section has **subsections**, for each one **in a single Bash
      invocation**:
      1. `subsection "<num>" "<subheading>" "<one-line description>"` — shows a
         subsection card (2 s, 3 s with description), then arms the persistent
         badge `<num>  <subheading>`.
      2. `goto <url>` to the app page, then drive the flow with `fill`, `click`,
         `pause` — all in the same block. Call `sync_badge` again after any
         **full page reload** (Turbo frame/stream updates keep the badge; a hard
         reload wipes it).
      3. End the block with an `ab eval` assertion that echoes the state you just
         demonstrated (see **Prove every segment before you move on**). If it
         comes back wrong, re-record that segment now, not later.
   3. If the section has **no subsections**, `goto` the app directly and drive it
      with `fill`/`click`/`pause` (no badge — `section` cleared it).
6. `finish` — saves the final segment.
6b. `tv-defreeze --run "$RUN_DIR"` — cuts the frozen gaps between tool calls,
   leaves the title cards alone, and re-maps `beats.tsv` so the narration pass
   can trust the offsets.
7. `render_video` — concatenates all segments into `$RUN_DIR.mp4` (named after
   the run, beside the folder).
8. **Audit the mp4.** `check_dead_air` — fix any static span outside title
   cards (pacing rule 5) and re-render. `check_geometry` — confirm the final is
   1920×1080; on a mixed desktop + mobile run, also extract a frame from a
   mobile span and read it to confirm the phone view is centred on black bars,
   not stretched.
9. `ab close`. Report folder, the section/subsection breakdown, total duration,
   and the video path.
10. **Write the QA run report (REQUIRED for QA runs).** If this recording was a QA
   pass — i.e. it followed a QA document/checklist or exercised numbered
   scenarios — you **must** then invoke the `tv-qa-run-report` skill to write a
   companion HTML report. Reuse this run's exact base name so the report sits
   beside the video: `$RUN_DIR.mp4` → `${RUN_DIR}__report.html`. Pass it the
   scenarios you ran, the data used, and the observed outcome for each, so the
   report records what was tested and how it turned out. (Skip only for a
   freeform, non-QA "just record this flow" video.)
11. **Narrate it, if the user asked for narration.** Invoke the
   `tv-narrate-video` skill with this run folder. It builds a spoken track from
   the segments and writes `${RUN_DIR}__narrated.mp4` beside the silent one. Do
   not try to add audio by hand here — that skill owns the timing.

## Companion skill — QA run report

Recording the video is half the deliverable; the other half is the written
record. For any QA run, pair the video with a **`tv-qa-run-report`** document
(`~/qaRun/<same-base-name>__report.html`) summarising what was tested, how, with
what data, and the outcome. Invoke that skill as the final step (see step 10).

## Companion skill — spoken narration

A silent video makes the viewer guess what they are looking at. When the user
wants the recording to explain itself — "narrate it", "add a voiceover", "add
commentary" — hand the finished run folder to the **`tv-narrate-video`** skill.
It writes the script, synthesises a neural voice, locks each line to the segment
it describes (holding frames where the speech needs longer), and then has Codex
watch the result and confirm the words match the picture.

Two things this recording pass owes it:

- **`beat "<what just happened>"`** — call it after any step worth talking over
  (a field filled, a modal opened, an error banner appearing). It appends
  `segment, elapsed_ms, label` to `$RUN_DIR/beats.tsv`, which is what lets the
  narrator aim a sentence at the right instant instead of guessing. Cheap to
  call, so call it liberally; a run with no beats still narrates, just with more
  frame-reading to work out the timing.
- **The segments themselves.** Narration is rebuilt from `segNNN.webm` +
  `segs.txt`, never from the finished mp4 — so never delete the run folder after
  rendering if narration might follow.

- **`tv-defreeze` before you hand over.** It re-maps the beats to the trimmed
  footage. If you trim some other way and leave `beats.tsv` alone, every
  narration offset is wrong and the verification pass comes back full of `EARLY`
  and `LATE` — that cost a whole review cycle once.

Record at normal pacing regardless. Do not stretch pauses hoping to fit
narration; the narration pass adds exactly the holds it needs.

## Canonical helpers (copy into the run bash session)

**Write this to a file and `source` it at the top of every Bash call** — do not
paste it once and expect the variables to survive. Each Bash tool call runs in a
fresh shell, so `SEG_N`, `RECORDING`, `CURSEG` and `BADGE` are gone by the next
call and the run silently restarts segment numbering. The block below therefore
keeps its counters in `$RUN_DIR/.state` rather than in shell variables.

```bash
cat > /tmp/qa_rec.sh <<'SH'
# ---- agent-browser native-recording QA video helpers ----
# source this at the top of EVERY bash call in the run
RUN_DESC="login_and_password_reset"   # snake_case summary of the whole run
# Derive RUN_DIR once per run and export it into the environment of the run,
# or write it beside the run — never cache it in a shared /tmp path that an
# earlier session might already own.
: "${RUN_DIR:?set RUN_DIR before sourcing, e.g. RUN_DIR=$HOME/qaRun/$(date +%Y-%m-%d_%H-%M)__$RUN_DESC}"
mkdir -p "$RUN_DIR/cards"
SEGS="$RUN_DIR/segs.txt"; [ -f "$SEGS" ] || : > "$SEGS"
ST="$RUN_DIR/.state"

# REQUIRED in containers/VMs so Chrome can launch; harmless elsewhere.
export AGENT_BROWSER_ARGS="--no-sandbox,--disable-dev-shm-usage"
export AGENT_BROWSER_COLOR_SCHEME=dark   # record in dark mode (see Dark mode)

# Request log overlay (see "Request log overlay" above). The init script covers
# pages outside a recording; sync_badge injects it again inside one.
# QA_REQUEST_LOG=0 turns it off for one run.
REQLOG_JS="${CLAUDE_PLUGIN_ROOT}/skills/tv-record-video/scripts/qa_request_log.js"
[ "${QA_REQUEST_LOG:-1}" = 0 ] || export AGENT_BROWSER_INIT_SCRIPTS="$REQLOG_JS"

SESSION=qa            # one session for the whole run (state persists)

ab() { agent-browser --session "$SESSION" "$@"; }

# file-backed state, so the helpers survive separate Bash tool calls
_get() { grep -m1 "^$1=" "$ST" 2>/dev/null | cut -d= -f2- ; }
_set() { local k="$1" v="$2"; touch "$ST"; grep -v "^$k=" "$ST" > "$ST.tmp" 2>/dev/null; mv "$ST.tmp" "$ST"; printf '%s=%s\n' "$k" "$v" >> "$ST"; }

# grab the first ref matching a snapshot pattern, e.g.
#   ref 'link "New Customer" \[ref=\K[^\]]+'
ref() { ab snapshot -i 2>&1 | grep -oP "$1" | head -1; }

# Build a self-contained full-screen HTML title card; echoes its file:// URL.
# Usage: card_html section|sub <num> <title> [description]
card_html() {
  local kind="$1" num="$2" title="$3" desc="${4:-}"
  local f bg kc nc tc kw ns ts
  if [ "$kind" = section ]; then bg=0b1020; kc=60a5fa; nc=3b82f6; tc=ffffff; kw=SECTION;    ns=300; ts=110
  else                           bg=13203b; kc=fbbf24; nc=f59e0b; tc=e5e7eb; kw=SUBSECTION; ns=190; ts=90;  fi
  # Named by kind+number (not a counter — command substitution would lose it),
  # so every card survives in cards/ and the run folder stays reproducible.
  f="$RUN_DIR/cards/card_${kind}_${num}.html"
  cat > "$f" <<HTML
<!doctype html><meta charset=utf-8><style>
html,body{margin:0;height:100%;background:#${bg};font-family:'Liberation Sans',Arial,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.k{color:#${kc};font-weight:700;font-size:46px;letter-spacing:.1em}
.n{color:#${nc};font-weight:700;font-size:${ns}px;line-height:1}
.t{color:#${tc};font-weight:700;font-size:${ts}px;padding:0 60px}
.d{color:#94a3b8;font-weight:400;font-size:42px;line-height:1.45;padding:36px 180px 0;max-width:1560px}
</style><div class=k>${kw} ${num}</div><div class=n>${num}</div><div class=t>${title}</div>
${desc:+<div class=d>${desc}</div>}
HTML
  echo "file://$f"
}

# (Re)inject or clear the top-left corner badge on the CURRENT page from $BADGE.
sync_badge() {
  local BADGE; BADGE="$(_get BADGE)"
  if [ -n "$BADGE" ]; then
    local t; t=$(printf '%s' "$BADGE" | sed "s/\\\\/\\\\\\\\/g; s/'/\\\\'/g")
    ab eval "(()=>{const id='qa-badge-overlay';const o=document.getElementById(id);if(o)o.remove();const d=document.createElement('div');d.id=id;d.textContent='$t';Object.assign(d.style,{position:'fixed',top:'28px',left:'28px',zIndex:2147483647,background:'#0b1020',color:'#fff',font:\"700 28px 'Liberation Sans',Arial,sans-serif\",padding:'14px 20px',borderRadius:'8px',pointerEvents:'none',boxShadow:'0 2px 10px rgba(0,0,0,.5)'});document.documentElement.appendChild(d);})()" >/dev/null 2>&1
  else
    ab eval "(()=>{const o=document.getElementById('qa-badge-overlay');if(o)o.remove();})()" >/dev/null 2>&1
  fi
  # The recording context drops init scripts: inject the request log here too
  # (it skips itself when already loaded, and on title cards).
  [ "${QA_REQUEST_LOG:-1}" = 0 ] || ab eval "$(cat "$REQLOG_JS")" >/dev/null 2>&1
}

# Keep the login across segments. `record start` and `record stop` each switch
# to a fresh browser context that copies only the cookies of the page it starts
# on. On a title card (a file:// page) that is none, so the next app page lands
# on the sign-in page. Call `keep_login` once after signing in (off camera,
# before the first `goto`): it remembers the app's origin, saves that site's
# cookies to $RUN_DIR/.cookies, and the segment helpers put them back after
# every record start and stop. Session cookies get an expiry one day out.
# Rails sends a fresh login cookie on every response, so the saved copy is
# refreshed whenever the current page is on the app.
keep_login() {
  local origin; origin="$(_get APP_ORIGIN)"
  [ -n "$origin" ] || { origin="$(ab get url | grep -oE '^https?://[^/]+')"; _set APP_ORIGIN "$origin"; }
  local host="${origin#*://}"; host="${host%%:*}" saved="$RUN_DIR/.cookies"
  if ab get url | grep -q "^$origin"; then
    ab cookies get --json 2>/dev/null | jq -c --arg h "$host" '[.data.cookies[] | select((.domain | ltrimstr(".")) == $h)]' > "$saved.tmp" \
      && [ "$(jq length "$saved.tmp")" -gt 0 ] && mv "$saved.tmp" "$saved"
  fi
  [ -s "$saved" ] || return 0
  jq -c '.[]' "$saved" | while IFS= read -r c; do
    local flags=(--url "$origin" --path "$(jq -r .path <<<"$c")" --sameSite "$(jq -r '.sameSite // "Lax"' <<<"$c")" --expires $(( $(date +%s) + 86400 )))
    [ "$(jq -r .httpOnly <<<"$c")" = true ] && flags+=(--httpOnly)
    [ "$(jq -r .secure <<<"$c")" = true ] && flags+=(--secure)
    ab cookies set "$(jq -r .name <<<"$c")" "$(jq -r .value <<<"$c")" "${flags[@]}" >/dev/null
  done
}
_keep_login_if_set() { [ -z "$(_get APP_ORIGIN)" ] || keep_login; }

# Segment plumbing. A segment = one continuous recording between `open` jumps.
_seg_stop()  { if [ "$(_get RECORDING)" = 1 ]; then _keep_login_if_set; ab record stop >/dev/null 2>&1; _keep_login_if_set; _set RECORDING 0; local c; c="$(_get CURSEG)"; [ -s "$c" ] && printf "file '%s'\n" "$c" >> "$SEGS"; fi; }
_seg_start() { local n; n=$(( $(_get SEG_N 2>/dev/null || echo 0) + 1 )); _set SEG_N "$n"; local c; c="$(printf '%s/seg%03d.webm' "$RUN_DIR" "$n")"; _set CURSEG "$c"; _keep_login_if_set; ab record start "$c" >/dev/null 2>&1; _keep_login_if_set; _set RECORDING 1; _set SEG_T0 "$(date +%s%3N)"; }

# Log a narration anchor: which segment, how many ms into it, what just happened.
# Written to beats.tsv and read later by `tv-narrate-video` to place spoken cues.
# Call it after any step you would want a narrator to talk over. Wall-clock, so
# accurate to roughly a third of a second - good enough to aim a sentence at.
beat() { [ "$(_get RECORDING)" = 1 ] || return 0; printf '%d\t%d\t%s\n' "$(_get SEG_N)" "$(( $(date +%s%3N) - $(_get SEG_T0) ))" "$1" >> "$RUN_DIR/beats.tsv"; }

# Navigate to a URL as a NEW segment (closes the previous one), then re-apply the
# badge. Use this for EVERY explicit URL jump once recording has started.
# Clicks / links / form submits do NOT need this — they record continuously.
goto() { _seg_stop; ab open "$1" >/dev/null 2>&1; ab wait --load networkidle >/dev/null 2>&1; _seg_start; sync_badge; beat "open $1"; }

# Hold the current state on screen so the viewer can see it. Usage: pause [ms]
pause() { ab wait "${1:-1200}" >/dev/null 2>&1; }

# SECTION title card (QA main point): 3 s hold (4 s with a description),
# clears the badge. Usage: section "1" "Login" ["What this section verifies"]
section() { _set BADGE ""; goto "$(card_html section "$1" "$2" "${3:-}")"; beat "card section $1 $2"; if [ -n "${3:-}" ]; then pause 4000; else pause 3000; fi; }

# SUBSECTION title card (QA subpoint): 2 s hold (3 s with a description), then
# arms the persistent badge for the app pages that follow.
# Usage: subsection "1.2" "Invalid password" ["What this subpoint verifies"]
subsection() { _set BADGE ""; goto "$(card_html sub "$1" "$2" "${3:-}")"; beat "card subsection $1 $2"; if [ -n "${3:-}" ]; then pause 3000; else pause 2000; fi; _set BADGE "$1  $2"; }

# Save the final segment once the run is done.
finish() { _seg_stop; }

# Audit the rendered mp4 for dead air: prints static spans >= 3.5 s.
# Title cards legitimately show up here (3-4 s holds); any longer span on an
# app page is dead air — speed that segment up and re-run render_video.
check_dead_air() {
  ffmpeg -hide_banner -i "$RUN_DIR.mp4" -vf "freezedetect=n=-60dB:d=3.5" -an -f null - 2>&1 \
    | grep -E 'freeze_(start|duration)' || echo "no static spans >= 3.5s"
}

# Change the browser viewport at a segment boundary (e.g. desktop → mobile).
# Closes the current segment first; the next `goto` starts a fresh one at the
# new size. NEVER call `ab set viewport` bare while a segment is recording.
# Usage: viewport 390 844   (mobile)  /  viewport 1920 1080  (desktop)
viewport() { _seg_stop; ab set viewport "$1" "$2"; }

# Strip one "file '<path>'" concat line down to the bare path.
_seg_path() { local p="${1#file \'}"; printf '%s' "${p%\'}"; }

# Concatenate all segments into the final mp4. Each segment is normalised
# INDIVIDUALLY first — aspect-preserving scale, centred on a black 1920x1080
# canvas — so mobile-viewport segments come out pillarboxed, never stretched.
# (Concatenating mixed-resolution webm directly stretches the smaller ones:
# the concat demuxer forces every file to the first one's dimensions BEFORE
# any filter runs. The per-segment pass is what prevents that.)
# If ~/music.mp3 exists it is mixed in as a looping background track trimmed
# to the video length; else silent.
render_video() {
  local out="$RUN_DIR.mp4" music="$HOME/music.mp3"   # named after the run, beside the folder
  local norm="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p"
  local nlist="$RUN_DIR/segs_norm.txt" line f n; : > "$nlist"
  while IFS= read -r line; do
    f="$(_seg_path "$line")"; n="${f%.webm}_norm.mp4"
    # -nostdin is REQUIRED: without it ffmpeg eats the rest of the list.
    ffmpeg -nostdin -y -i "$f" -vf "$norm" -c:v libx264 -r 30 -an "$n" || return 1
    printf "file '%s'\n" "$n" >> "$nlist"
  done < "$SEGS"
  if [ -f "$music" ]; then
    ffmpeg -y -f concat -safe 0 -i "$nlist" -stream_loop -1 -i "$music" \
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "$out"
  else
    ffmpeg -y -f concat -safe 0 -i "$nlist" -c copy "$out"
  fi
}

# Validate proportions: list each raw segment's native size, then the final
# mp4's. Mobile segments should show their true portrait size (e.g. 390x844)
# and the final must be 1920x1080. In the mp4, mobile footage must appear
# centred with black side bars — on mixed runs, also extract a frame from a
# mobile span and READ it to confirm it is not stretched.
check_geometry() {
  local line f
  while IFS= read -r line; do
    f="$(_seg_path "$line")"
    printf '%s  %s\n' "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$f")" "${f##*/}"
  done < "$SEGS"
  printf 'final: %s  %s\n' "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$RUN_DIR.mp4")" "$RUN_DIR.mp4"
}

SH

# then, in every bash call of the run:
#   RUN_DIR=$HOME/qaRun/2026-06-15_14-07__login_and_password_reset . /tmp/qa_rec.sh

# Start the run: clear any old session, launch a browser, set full-screen viewport
# and dark mode (set viewport silently fails when no browser is running yet).
ab close 2>/dev/null
ab open about:blank
ab set viewport 1920 1080
ab set media dark

# Logged-in app: sign in here, off camera, then keep the login for every segment.
#   ab open http://localhost:3000/sign_in  ... fill, submit, 2FA ...
#   keep_login
```

## Example: QA doc with sections and subsections

Mirrors a QA doc like:

```
1. Login
   1.1 Valid credentials
   1.2 Invalid password
2. Password reset
```

Here the QA is about sign-in itself, so filming the sign-in form is correct.
For any other feature, sign-in happens off camera (see "Film only what is being
tested").

Each `# ===` / `# ---` group below is **one Bash invocation** — card, `goto`,
fills, clicks and pauses together, so no thinking-time freezes onto camera
(pacing rule 1). Element refs (`@e5`, …) were learned in the rehearsal pass.

```bash
# every bash call starts with this line
RUN_DIR=$HOME/qaRun/2026-06-15_14-07__login_and_password_reset . /tmp/qa_rec.sh

# === Section 1: Login === (one Bash call)
section "1" "Login" "Sign-in with valid and invalid credentials"

# --- 1.1 Valid credentials --- (one Bash call; badge "1.1  Valid credentials")
subsection "1.1" "Valid credentials" "A correct email and password must land on the dashboard"
goto "http://localhost:3000/users/sign_in"
ab snapshot -i
ab fill @e5 "qa@example.com"; pause
ab fill @e6 "$QA_PASSWORD"; pause   # read from the seed file, never typed in here
ab click @e7                 # submit → redirects; recorded continuously
ab wait --load networkidle
sync_badge                   # re-show badge after the full page load
pause 1500                   # let the dashboard sit on screen

# --- 1.2 Invalid password --- (one Bash call; badge flips to "1.2  Invalid password")
subsection "1.2" "Invalid password" "A wrong password must show an error and stay on the sign-in page"
goto "http://localhost:3000/users/sign_in"
ab snapshot -i
ab fill @e5 "qa@example.com"; pause
ab fill @e6 "wrong-password"; pause
ab click @e7
ab wait --load networkidle
sync_badge
pause 1500                   # error banner visible

# === Section 2: Password reset === (one Bash call; no subsections → card only, no badge)
section "2" "Password reset" "Requesting a reset link for a known email shows the confirmation notice"
goto "http://localhost:3000/users/password/new"
ab fill @e3 "qa@example.com"; pause
ab click @e4; ab wait --load networkidle; pause 1500

finish
render_video
check_dead_air               # static spans beyond the title cards? fix + re-render
ab close
```

If a run has no subpoints at all, just call `section` per flow and drive with
`goto`/`fill`/`click`/`pause` — no `subsection`, no badges.

## Title card & badge styling notes

- **Section vs subsection must read as different levels.** `section` cards are
  navy (`#0b1020`) with a huge blue number and a 3–4 s hold; `subsection` cards
  are lighter slate (`#13203b`) with an amber number, smaller text and a 2–3 s
  hold. Keep that contrast so the viewer instantly registers "new chapter" vs
  "new sub-step". Both are driven by `card_html`; change the colour/size
  variables there if needed.
- **The description line is muted, not shouty.** It renders below the title in
  slate grey (`.d`, 42 px) — one short sentence saying what the (sub)section
  verifies. Keep it to ~120 characters; longer text wraps into a paragraph the
  hold time doesn't cover.
- **The badge is the always-on cue.** Every app page inside a subsection carries
  the `<num>  <title>` badge top-left, so even someone scrubbing knows which
  subpoint they're in. `section` clears it; `subsection` arms it; `goto`
  re-applies it on each jump. After a **full page reload** triggered by a click,
  call `sync_badge` again (Turbo frame/stream updates preserve the badge because
  it lives on `<html>`, outside `<body>`; a hard reload wipes it). Keep badge
  text short (number + a few words).
- The cards use the `'Liberation Sans'` font with `Arial`/`sans-serif` fallback,
  so they render on any machine.
- Keep section/subsection **titles** short (≤ 24 chars) — at large sizes they
  fill the card. Put any caveat in the subheading text.
- For a freeform intro/outro card, call `card_html` style inline or just write a
  small HTML file and `goto` it with a `pause`.

## Background music

If `~/music.mp3` exists when `render_video` runs, it is added as a looping
background track (`-stream_loop -1`) and trimmed to the video's length
(`-shortest`). No music file → silent video. To opt out for a single run,
temporarily rename the file.

## Reporting back

When finished, tell the user:

- the run folder path,
- the **section/subsection breakdown**, mirroring the QA doc numbering (e.g.
  `1 Login → 1.1 Valid credentials, 1.2 Invalid password; 2 Password reset`),
- if you auto-numbered (no QA doc was given), say so and show the breakdown you
  chose,
- the total video duration (`ffprobe -v error -show_entries format=duration
  "$RUN_DIR.mp4"`),
- the video path (`$RUN_DIR.mp4`),
- the QA run report path (`${RUN_DIR}__report.html`) — for a QA run you must have
  generated it via `tv-qa-run-report` (workflow step 10); report both paths.

## Tips

- Use one named session (`--session qa`, via the `ab` helper) across the whole
  run so cookies/state persist.
- **Navigate with `goto`, not bare `agent-browser open`,** once recording has
  started — a bare `open` resets the recording and loses footage. `goto` makes
  every URL jump a clean segment boundary.
- Clicks, links and form submits (including redirects) record continuously — no
  segment boundary needed for those.
- If a section logs the user in and the next needs a logged-out state, `goto` the
  sign-in page (or `ab close` and start fresh) rather than assuming.
- **Login / setup is plumbing — keep it out of the video.** Unless the QA is
  about sign-in, it is not recorded at all (see "Film only what is being
  tested"). Sign in off camera and call `keep_login`, or log in once in a
  throwaway session, `ab state save auth.json`, and `ab state load auth.json`
  before the recorded run. On a slow or cold app (e.g. a freshly-restarted local
  server), warm it with one throwaway request first, so the first recorded page
  does not sit on a spinner.
- Never reuse a run folder — each invocation gets its own timestamped directory
  so past runs stay intact.
- To sanity-check a finished run, extract a frame:
  `ffmpeg -ss <sec> -i "$RUN_DIR.mp4" -frames:v 1 /tmp/check.png` and read
  it.
