---
name: tv-qa-video
description: Video step of /tv-qa. Records and narrates the QA run video for a pull request from a finished QA run - by default only the scenarios that failed or that the agent was not sure about, or every scenario when the user asks for the full video ("/tv-qa all", "full video"). Returns the narrated mp4, or says there is nothing to record. Also use on its own when the user asks for "a video of the QA failures" or "re-record the QA video" for a run that already has a run report.
---

# Record the QA run video

The QA run video shows a person the things they must look at. By default that is
only what went wrong or what needs a decision. A scenario that clearly passed is a
line in the run report, not footage.

This skill does not record or narrate by itself. It calls `tv-record-video`, then
`tv-narrate-video`, and says which scenarios they film and how to talk about them.

## Input

- The run folder (`$RUN_DIR`) and the run report (`${RUN_DIR}__report.md`, from
  `tv-qa-run-report`) with a status for every scenario.
- The QA doc, for the numbers, titles and steps.
- The mode, from the user's words.

## The mode

| The user said | Mode | Films |
|---|---|---|
| nothing about the video (the default) | `failures` | every `FAIL`, `PARTIAL` and `UNSURE` scenario |
| "all", "full video", "full", "video of everything", "record all scenarios" | `all` | every scenario that ran, `PASS` too |
| "no video" | `none` | nothing |

`NOT RUN` scenarios are never filmed: there is nothing to show.

**Mode `failures` with no `FAIL`, `PARTIAL` or `UNSURE`: record nothing.** Do not
make a video that says "everything passed". Return "no video: nothing to show",
and the caller posts the result without one.

**Mode `all` always records**, also when scenarios fail. Failures are then filmed
in their place in the doc's order and named as failures in the narration.

## 1. Pick the scenarios

Read the statuses from the run report, not from memory. Write the list of
scenarios to film, in the QA doc's order, with each one's variant. In mode
`failures` that is a short list; that is the point.

## 2. Record them

Run `tv-record-video` with that list. Its rules all hold (dark mode, 1920x1080,
film only what is tested, prove every segment), with these additions:

- **Keep the doc's numbers.** A filmed scenario keeps its number and title on its
  card (`2.3`, not `1`). Gaps in the numbering are expected in mode `failures`.
- **An opening card** says what the video holds: in mode `failures`, "Only the
  scenarios that failed or need a decision: 2 fail, 1 unsure. 14 others passed;
  the run report lists them." In mode `all`, the tally.
- **Each scenario card** carries its status and, for `UNSURE`, the question:
  "2.3 Due date in the past, FAIL" or "4.1 Blank due date, UNSURE: is '—' meant?".
- **Film the failure itself.** Start at the closest page, do the steps, and hold
  on the wrong result long enough to read it. Highlight the wrong value or the
  missing message when the recorder can.
- **The QA is already done.** The run report holds the results, from the
  off-camera run. The camera pass only shows them again. When a `FAIL` does not
  happen again on camera, keep the clip, do not change the status on your own,
  and add "did not happen again on camera" to that scenario's `note` in the run
  report. Say it in the narration too.

## 3. Narrate

Run `tv-narrate-video` on the run folder. In mode `failures` each scenario says,
in plain words: what the doc expects, what the app did, and the verdict. "The
doc says the button is greyed out. Here it can still be clicked. This is a fail."
For `UNSURE`, say what looked odd and the question a person must answer. Every
verdict must match the run report.

The one-voice check still holds: `tv-narrate-solo --run "$RUN_DIR"` must report
zero overlaps, and the narrated file has exactly one audio track:

```bash
ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${RUN_DIR}__narrated.mp4" | wc -l   # 1
```

## 4. Size

GitHub refuses videos over its limit (10 MB on free plans, 100 MB on paid ones).
Over the limit, encode a smaller copy and hand that one over:

```bash
ffmpeg -nostdin -y -i "${RUN_DIR}__narrated.mp4" -vf scale=1280:-2 -c:v libx264 -crf 32 -preset slow -c:a aac -b:a 64k "${RUN_DIR}__narrated_pr.mp4"
```

## Output

Return one of:

- the path of the narrated mp4 (or its smaller copy), the mode, and the filmed
  scenario numbers;
- "no video: nothing to show" (mode `failures`, nothing failed or unsure);
- "no video: the user said no video".

When run on its own (not from `/tv-qa`), post the result with
`tv-qa-run-comment`, as `/tv-qa` step 6 says.
