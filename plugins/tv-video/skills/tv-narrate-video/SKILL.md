---
name: tv-narrate-video
description: Use when the user says "narrate the video", "add narration", "add a voiceover", "add commentary to the video", "/tv-narrate-video", or asks for a QA recording to have a spoken audio track. Writes a spoken narration for a QA screen recording (normally one produced by tv-record-video), synthesises it with a neural TTS voice, and muxes it onto the video with the audio locked to the picture — holding frames where the speech needs longer. Then has Codex (gpt-5.6-sol) watch the result frame-by-frame and confirm the words match what is on screen, and iterates on that feedback. Goal: a human understands exactly what was tested without ever opening the QA document.
---

# Narrate a QA video

Take a silent QA screen recording and give it a spoken track that explains, as it
happens, **what is being tested, what is being done, and what the expected result
is** — so someone who has never seen the QA document can watch it once and
understand the whole test pass.

The audio is not decoration. **Every sentence must be true of the picture at the
moment it is heard.** That constraint drives the whole design: narration is
anchored to individual video segments, and where a sentence needs more time than
the footage gives it, the pipeline *holds the frame* rather than letting the
voice run ahead into the next scene.

## What you get

For run folder `~/qaRun/<stamp>__<desc>/`:

| File | What it is |
|---|---|
| `<run>/narration.json` | the narration script you write — cues keyed to segments |
| `<run>/narration/` | synthesised cue mp3s, padded segments, working files |
| `<run>/narration/timeline.json` | every cue and sentence with its absolute time in the final video |
| `<run>__narrated.mp4` | **the deliverable** |
| `<run>/narration/verify/` | frames + Codex verdicts from the check pass |

The silent `<run>.mp4` from `tv-record-video` is left untouched.

## Tooling

Three scripts ship with the `tv-video` plugin. Its `bin/` is on the Bash PATH,
so call them by bare name. The short names below are used in this skill:

```bash
NARR=tv-narrate
NARRV=tv-narrate-verify
NARRS=tv-narrate-solo
```

`tv-narrate bootstrap` creates a private venv at `~/.local/share/tv-narrate/venv`
with **edge-tts** (Microsoft neural voices, free, no API key, needs network).
It is created automatically on first use; run it explicitly if you want the
one-off ~20 s install to happen off-camera. There is no offline fallback — if
the network is down, say so rather than shipping a robotic espeak track.

## Where narration comes from

Narration is built **from the recording's segments**, not from the finished mp4.
`tv-record-video` writes one `segNNN.webm` per URL jump and lists them in
`segs.txt`; each segment is a natural narration anchor with a known duration.
That is why timing can be guaranteed: each segment is padded to fit its own
speech, so nothing downstream can drift.

- **Normal path:** `--run ~/qaRun/<stamp>__<desc>` (reads `segs.txt`).
- **Fallback:** `--video some.mp4` treats the whole file as one segment and cue
  offsets become absolute times. Use for an Android capture or any video not
  produced by `tv-record-video`. Padding still works, but only at the very end
  of the file, so get the offsets right the first time.

## The narration script (`narration.json`)

```json
{
  "voice": "en-GB-RyanNeural",
  "rate": "+30%",
  "music": "auto",
  "music_gain": 0.18,
  "cues": [
    {"seg": 1, "at": 0.3,  "text": "Section one. Sign in. ..."},
    {"seg": 2, "at": null, "text": "This is the sign-in form. ..."},
    {"seg": 2, "at": 6.5,  "text": "The password goes in, and submit."},
    {"seg": 3, "at": -1.5, "text": "The dashboard loads, which is the pass condition."}
  ]
}
```

- **`seg`** — 1-based index into `segs.txt` (segment 1 is the first title card).
- **`at`** — seconds from the start of that segment's *original* footage.
  - a number — speak at that offset.
  - `null` — speak right after the previous cue in the same segment (0.35 s beat).
  - **negative** — start speaking *before* the segment's action begins; the
    segment's first frame is frozen for that long. Use it when the line should
    land as the screen appears rather than after it.
- **`rate`** — speed relative to the voice's normal pace. The default is `+30%`
  (1.3x), because 1x sounds too slow over a QA video. Leave it there unless
  asked; `+0%` is normal speed.
- **`voice`/`rate`** may also be set per cue, to change speaker mid-video.
- **`music`** — `"auto"` uses `~/music.mp3` if present, `"off"` disables, or give
  a path. Music is mixed under the voice through a sidechain compressor, so it
  ducks automatically whenever the narrator speaks.

The script does the timing arithmetic; you only supply offsets and words.

## One voice at a time (REQUIRED — check after EVERY build)

`build` places each cue exactly where you put it and **mixes whatever collides**.
It never pushes a cue later to make room. So two cues whose speech overlaps come
out as two voices talking over each other — the single worst defect a narrated
video can have, and invisible in `narration.json`. It has shipped that way once;
the user heard it immediately.

```bash
$NARRS --run "$RUN"            # report; exit 1 if anything overlaps
$NARRS --run "$RUN" --fix      # chain the offenders, then build again
```

Run it after every `build` and rebuild until it prints **zero**. Treat a non-zero
result exactly like a failing test.

**What causes it.** Mostly the centring rule below: shifting a cue earlier so its
midpoint lands on the action also shifts it back into the previous line. Centring
and this check are a pair — never do one without the other.

**How the fix works.** The offending cue becomes `"at": null`, which starts it
0.35 s after the previous line ends. Chaining is **transitive**: once any cue in a
segment is chained, every later cue in that same segment must be chained too.
Otherwise a later cue keeps its own early offset and simply collides with the end
of the chain instead — that mistake turned 22 overlaps into 6 rather than 0.

**Cross-segment bleed is different.** If the last line of segment N is still
talking when segment N+1's line starts, chaining cannot help — `at: null` only
chains inside one segment. Shorten the overrunning line, drop it if the title card
already says the same thing, or give the next segment's first cue a later positive
`at`. One such bleed of about 1.1 s survived two rounds of chaining and needed
both: the redundant line removed, and the next cue moved from 0.2 s to 1.7 s.

**The cost is length, and it is worth paying.** Letting every line finish added
about 90 seconds to a 12-minute video. Nothing was cut.

## Writing the words (this is the part that matters)

The listener is a colleague who has **not** read the QA document and is watching
over your shoulder. Give them the same running commentary you would give in
person.

**Cover, across the video as a whole:**

1. **An opening line** — what feature or change is under test, and on what.
   ("This is a QA pass over the new order summary boxes on the order list.")
2. **Per section** — what this numbered scenario checks and why it matters.
3. **Per action** — what is being done, in the moment. ("Filling in a customer
   email that is already registered.")
4. **Per outcome** — what happened, and whether that is the expected result.
   Say the verdict out loud: "that is the expected error", "this is the bug".
5. **A closing line** — what passed, what failed, what still needs a human.

**Speak the expectation before the result.** "If this works, the row should
disappear without a page reload" — then the click, then "and it does". That is
what makes a viewer able to judge the test rather than just watch a cursor move.

**Style rules** (same family as `/tts`, and they matter more here because there
is no way to rewind a video comfortably):

- No code, no file paths, no identifiers read literally, no URLs, no symbols
  that don't read aloud. Say "the order list page", not a slash-separated path.
- Short sentences. Plain prose, no lists, no headings.
- Numbers spoken naturally: "section one point two", not "1.2".
- Present tense for what is happening, and say the *user-visible* thing, not the
  DOM thing: "the total updates to four thousand two hundred", not "the span
  re-renders".
- Never narrate something the frame does not show. If you are unsure what is on
  screen at that instant, extract the frame and look before writing the line.
- Don't read the title card aloud word for word — the viewer can read it. Use the
  card's airtime to say *why* the scenario exists.

**The shape that works, per scenario.** Three beats, in this order:

1. *The rule* — over the title card, while nothing is happening yet. "An
   individual cannot hold a company registration number."
2. *The action* — as it happens. "Switching to Individual. The registration box
   disappears, and the VAT box stays, still holding its value."
3. *The verdict* — say it out loud. "The box is empty, which proves the number
   was never stored. That is the pass."

Skipping beat 3 is the most common failure. A viewer watching a screen change
cannot tell whether that was the expected outcome unless you say so.

**Give a reason, once, for anything counter-intuitive.** "A sole
trader registers for VAT in their own name, so that is correct" turns a
suspicious-looking asymmetry into an understood one. One clause is enough.

**Expand an acronym the first time and then use it freely.** "An
international bank account number, called an I B A N" up front; plain "I B A N" after.

**Spell status codes out as digits** — "four two two", "two zero one", "four zero
one". A TTS voice reads "422" as "four hundred and twenty-two", which is not how
anyone says it.

**Name a caveat in the moment you hit it, not only at the end.** If one check
came out differently from what the plan expected, say so over that exact frame
and say what you did about it: "Checked against the main branch, that text is
unchanged, so it is pre-existing and not something this branch broke." That is
the sentence a reviewer actually needs.

**Open and close deliberately.** The first line names the feature, the branch and
the setup ("two apps running side by side: the tenant under test, and a second
one as the regression check"). The last line says what passed and what is left for a human.
Neither is decoration — without them the viewer has no frame for anything in
between.

**Centre each sentence on its action, do not start it there.** The verifier
samples the frame at the **midpoint** of every spoken sentence, and so does a
human's sense of sync. A line that starts exactly when the action happens has its
middle several seconds later, by which point the screen has moved on — which is
why a first pass comes back full of `LATE`. Start it roughly half its own length
early:

```python
at = beat_offset - (len(text.split()) / 2.6) / 2     # 2.6 words/sec at rate +30%
```

Then run the one-voice check above, because this is exactly what creates overlaps.

**One action per sentence.** A compound sentence covering three interactions can
only ever match one frame; the verifier calls it `MISMATCH` and it is right. Split
it into separate cues with their own offsets.

**Length budget.** The default voice at `+30%` speaks about **2.6 words per
second**. So a cue that must fit inside a 5 s window gets ~13 words. Going over
is allowed — the pipeline holds the frame — but every second of held frame is a
second the viewer stares at a still image, so keep holds short. `plan` warns when
a segment needs more than 6 s of freeze; that is the signal to cut words, not to
accept it.

## Voices

Default `en-GB-RyanNeural`. Other good ones:
`en-GB-SoniaNeural` (female, UK), `en-GB-ThomasNeural` (male, UK),
`en-US-AndrewMultilingualNeural`, `en-US-AvaMultilingualNeural`,
`en-US-BrianNeural`, `en-AU-NatashaNeural`.
Full list: `~/.local/share/tv-narrate/venv/bin/edge-tts --list-voices`.

## Workflow

1. **Get the footage.** Either you have just run `tv-record-video` (you know what
   is in every segment), or you were handed a run folder / mp4.

2. **Learn what each segment actually contains** — never narrate from memory:

   ```bash
   RUN=~/qaRun/2026-09-10_11-20__order_filters
   $NARR segments --run "$RUN"
   ```

   That prints every segment with its duration, its native size, its position in
   the run, and — if `tv-record-video` logged them — the `beat` labels inside it
   with their offsets. Those offsets are your cue `at` values, near enough:

   ```
     2    9.00s   1920x1080  seg002.webm   [7.0s -> 16.0s in the run]
             @  0.34s  open http://localhost:3000/users/sign_in
             @  2.60s  filled email
             @  6.90s  clicked submit
   ```

   **If the run was de-frozen, the beats must have been re-mapped.** Trimming
   removes exactly the frozen spans a beat sits next to, so raw beat offsets come
   out seconds wrong and nearly every line lands early or late. `tv-defreeze`
   (in this plugin's `bin/`) rewrites `beats.tsv` through the same kept-interval
   map it used to trim; if the run was trimmed some other way, re-map them the
   same way rather than guessing by eye. A whole round of Codex notes — 17 `EARLY`
   and 9 `LATE` — was this one cause.

   Beats are wall-clock, so trust them to about a third of a second. For anything
   tighter — and for every segment with no beats — sample the frame and **read
   it** before writing a line about it:

   ```bash
   ffmpeg -nostdin -v error -y -ss 2 -i "$RUN/seg004.webm" -frames:v 1 \
     -vf scale=960:-2 /tmp/seg004.png
   ```

3. **Write `$RUN/narration.json`** following the rules above.

4. **Check the timing before rendering:**

   ```bash
   $NARR plan --script "$RUN/narration.json" --run "$RUN"
   ```

   This synthesises the speech (cached) and prints, per segment, the footage
   length, the frame-hold it needs, and where each cue lands. Fix anything that
   needs a long hold, then re-run.

5. **Build:**

   ```bash
   $NARR build --script "$RUN/narration.json" --run "$RUN"
   ```

   Produces `<run>__narrated.mp4` and `narration/timeline.json`. Segments are
   normalised exactly the way `tv-record-video` does it — aspect-preserving scale
   onto a black 1920×1080 canvas — so mobile-viewport segments stay pillarboxed
   and are never stretched.

6. **Check that only one voice speaks** — `$NARRS --run "$RUN"`. Non-zero means
   two lines collide; `--fix` and rebuild until it prints zero. This is not
   optional and it is not the same thing as step 4: `plan` shows you the holds a
   segment needs, it does not tell you that two cues will be mixed on top of each
   other.

7. **Verify with Codex** if the CLI exists on this machine (`command -v codex`)
   — see next section — **once**. One review run, no second, no exceptions.
   Each run costs about fifteen minutes and a lot of tokens. Apply its fixes,
   build again, and ship. No Codex CLI means no review: skip it, ship, and say
   so in the report.

8. **Report.** Give the user the narrated path, the duration, the
   voice used, and the Codex verdict summary — or, if the CLI was not present,
   say plainly that the narration was not independently verified on this machine.

## Verification with Codex (REQUIRED WHERE AVAILABLE — MAXIMUM 1 REVIEW RUN)

**First, check the Codex CLI is actually on this machine:**

```bash
command -v codex || echo "no codex CLI — skip the review"
```

It is not installed everywhere. If it is missing, **skip the review entirely and
ship**. Do not try to install it, do not look for another reviewer, and do not
stall waiting for one. Say so in the report — "no Codex CLI on this machine, so
the narration was not independently verified" — and let the user decide whether
that matters. The rest of the pipeline stands on its own: the one-voice check,
the frame sampling you do yourself while writing, and the run report are all
still there.

Where it is available, use it. Watching your own narration is not verification —
you wrote it, so you already believe it. `tv-narrate-verify` shells out to
`codex exec` in read-only sandbox mode, on `gpt-5.6-sol` at medium reasoning,
feeding it frames from the finished mp4 and a strict output schema.

**Run the one-voice check first.** Codex *looks*, it does not *listen* — it is
sent still frames, never the audio. It will happily pass a video in which two
voices are talking over each other. So `$NARRS --run "$RUN"` has to be clean
before you spend a review cycle here, or you will ship a defect the reviewer was
structurally incapable of seeing.

```bash
$NARR  frames --timeline "$RUN/narration/timeline.json"
$NARRV --frames "$RUN/narration/verify/frames.json" \
       --context "Feature under test: order list summary boxes and filters."
```

`frames` extracts **one frame per spoken sentence, at the midpoint of that
sentence** — literally what the viewer is looking at while hearing those words.
`tv-narrate-verify` sends them to `gpt-5.6-sol` at **medium** reasoning, ten
frames per request, with a strict output schema, and returns per-frame verdicts:

| Verdict | Meaning | What you do |
|---|---|---|
| `MATCH` | the words fit the picture | nothing |
| `EARLY` | speech is ahead of the screen | raise that cue's `at`, or hold the previous segment longer |
| `LATE` | speech is behind the screen | lower that cue's `at`, or use a negative `at` to start it before the segment |
| `MISMATCH` | describes something not shown | rewrite the line to describe what is actually there |
| `UNCLEAR` | frame too ambiguous | usually means the moment itself is unclear — pick a different offset |

It also answers **"understandable without the QA doc?"** (`yes` / `partly` /
`no`) with the specific gaps. That question is the whole point of the skill —
treat anything other than `yes` as work to do, not as a nitpick. Common gaps:
the video promises a scenario it never shows, an outcome is never called a pass
or a fail, or a screen changes with nobody saying why.

**One review run is a hard ceiling, and the reason is cost.** Each run sends
every frame of the video to Codex in batches and takes about fifteen minutes and
a large number of tokens. A second run buys a handful of extra `MATCH` verdicts on
a video that is already good, and chasing the last few is how a QA pass quietly
turns into an afternoon. One run, then ship.

**One cycle, then ship.** A cycle is one `build` → `frames` →
`tv-narrate-verify` pass. Apply whatever fixes from that verdict are clearly
correct to `narration.json`, `build` once more if you changed anything, run the
one-voice check again, and ship. Do not run a second `tv-narrate-verify` pass,
no matter how many `MISMATCH`/`EARLY`/`LATE` verdicts remain — one round is the
budget, not a suggestion. Report to the user which notes you did not act on and
why, instead of asking Codex again.

Codex is a reviewer, not an oracle. If it flags a title-card line as `EARLY`
because the line introduces what is about to happen, that is correct by design —
push back rather than mangling the narration to satisfy it. You are the arbiter.
Tell it so in `--context`: *"title cards deliberately introduce what is about to
be shown, so a card frame describing upcoming action is correct by design"* takes
a whole class of false positives off the table before it starts.

**Three misreads it makes repeatedly.** Check the frame yourself before acting:

- **A grey placeholder read as a value.** An empty input showing placeholder text
  gets reported as populated, so "the box is empty, which proves it was never
  stored" comes back `MISMATCH`. Don't re-time it — say *"the grey text in it is
  only a placeholder"* so a human viewer doesn't make the same mistake either.
- **The sender block read as the recipient block.** A document with the sender's
  details at the bottom and the recipient's at the top gets conflated. Name the
  region in the line: *"in the Ship to block there is one line"*.
- **A tax column read as a tax-number line.** "No VAT line" on a receipt that
  plainly shows a VAT charge column is genuinely ambiguous. Say which thing you
  mean.

Both times these came up, the narration was right and the wording was still worth
changing — if the reviewer can misread the frame, so can the viewer.

**Fixing drift — pick the right tool:**

- speech runs into the next scene → hold that segment longer (add a later cue or
  raise `at`; padding follows automatically), or cut words;
- speech lands after the thing it describes → negative `at` so it starts during
  the frozen lead-in;
- a segment covers several actions and one line covers them all vaguely → split
  it into several cues with real offsets. This is usually the right fix.

## Interaction with `tv-record-video`

- **Record normally.** Do not stretch pauses hoping to fit narration — the
  narration pass adds exactly the holds it needs. Do keep the usual pauses at
  meaningful states; they give narration somewhere to sit.
- **`check_dead_air` belongs to the silent mp4.** The narrated cut deliberately
  has long static spans (frames held under speech); running the dead-air audit on
  it will flag them as false positives.
- **Music:** narration rebuilds audio from the segments, so whatever
  `render_video` mixed into the silent mp4 is irrelevant. Music policy for the
  narrated cut is `narration.json`'s `music` field alone.
- **Plan roughly before you record.** Knowing the narration beats in advance
  makes you pause in the right places, which means less frozen frame later.
- **Pairs with `tv-qa-run-report`.** The report is the written record; the
  narrated video is the spoken one. They should agree — if the narration calls a
  scenario a pass, the report must too.

- **Segments the narrator can rescue, and segments it cannot.** A short static
  segment is fine — the builder holds the frame for as long as the line takes, so
  a 1.8 s evidence page happily carries a 13 s sentence. What it cannot rescue is
  a segment that shows the *wrong screen*. Check the footage before writing words
  about it.

## Gotchas (each of these was hit and fixed here)

- `codex exec`'s `-i/--image` is variadic and **swallows a trailing positional
  prompt**. The prompt must go over **stdin**. `tv-narrate-verify` does this.
- Never mux with `-shortest` when a looping music bed is present — it truncates
  the tail of the video. The scripts pass an explicit `-t`.
- Concatenating mixed-resolution segments directly stretches the smaller ones;
  each segment must be normalised individually first. `build` does this.
- Segment durations must be re-measured **after** padding — the audio bed for a
  segment is generated to the padded video's exact length, which is what keeps
  audio and picture locked together across a whole run.
- Cue audio is cached by a hash of voice, rate and text, so re-running `build`
  after editing one line only re-synthesises that line.
- **`at: null` chaining is transitive or it is useless.** Chaining only the cue
  that collided leaves the next one in that segment on its own early offset,
  where it collides with the end of the chain. Chain every later cue in the
  segment. `tv-narrate-solo --fix` does this.
- **A cue placed past its segment's duration is silently clamped**, so a beat
  that mapped beyond the end quietly lands on the last frame. Clamp deliberately
  (`min(at, dur - 0.3)`) rather than discovering it in a verdict.
