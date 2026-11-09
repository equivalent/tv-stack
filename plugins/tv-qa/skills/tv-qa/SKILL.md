---
name: tv-qa
description: Use when the user runs /tv-qa or says "QA this PR", "QA run the PR", "run QA and record it". Runs a full QA pass of a pull request in the browser from the QA doc held in the PR's QA comment (never from a local folder), records it as a narrated video, writes a QA run report, attaches the video to the PR's QA doc comment (a new comment when there is none), links that comment from the bottom of the PR description. Reports what it finds; it never fixes code.
---

# QA a pull request, on video

One command for the whole QA pass. This skill does not record, narrate or write
reports itself. It calls the skills that do, in order, and owns the hand-offs
between them:

| Step | Skill |
|---|---|
| QA doc (only when the PR has no QA comment) | `tv-qa-docs` |
| Browser run + screen recording | `tv-record-video` |
| Spoken narration | `tv-narrate-video` |
| Run report | `tv-qa-run-report` |

Call each one with the Skill tool, as its own invocation, and follow its rules.
This file only adds what none of them say.

**Project notes first.** If a skill named `tv-qa-notes` is available (a project
plugin ships it, for example `myapp-qa:tv-qa-notes`), invoke it before step 1 and
follow it: it says how to start the app, which ports and variants (markets,
tenants) it has, where the seed accounts are, and how to free ports or memory.
Where the notes and this skill differ, the notes win. No notes skill: read the
repo's QA notes file if it has one (`docs/qa-notes.md`, `QA.md`, or a QA section
in `AGENTS.md` / `CLAUDE.md`), else use plain defaults: one app, one port.

## The recording is the deliverable — never skip it

Extra instructions in the /tv-qa message (upload the doc somewhere, seed extra
data, delegate the run to a subagent, do something "after that") **add** steps. They do
not replace the pipeline above. Whoever executes the browser pass — this session
or a subagent it spawns — runs it inside a `tv-record-video` screen recording.
When you delegate the run, the subagent's brief must name `tv-record-video` and
the run folder; screenshots are evidence for the report, never a substitute for
the recording.

A /tv-qa pass is finished only when the narrated mp4 exists. If the user's extra
instructions genuinely conflict with recording (for example "no video this time"),
they must say so in those words; otherwise record. When in doubt, ask one short
question before the run, not after.

## The run is read-only

**This is a test run, not a fix run.** The only things you write are the QA doc,
the run folder in `~/qaRun/`, the QA comment on the PR and the PR description. The
repository stays exactly as you found it: no file edits, no commits, no pushes,
no "quick fix, then run it again".

When something is wrong, that is a finding. Mark the scenario **FAIL** in the run
report with one factual line, and say "this is the bug" in the narration over that
frame. When a scenario cannot be set up by adding data on top of what exists, mark
it **NOT RUN** and give the reason. Keep going to the next scenario either way.

## 1. Find the pull request

In this order:

1. A PR number or URL named in the conversation.
2. The PR for the current branch: `gh pr list --head "$(git branch --show-current)" --json number,url,title`.
3. Neither: stop and ask the user which PR.

Write down the number and URL; every later step needs them. If the t3-code
`link_pull_request` tool exists, call it with the PR URL.

The local app must run the PR's code. Check that the branch is checked out in the
folder the dev server runs from, and that the server answers.

**If no server is up, start it yourself — this is expected, not an exception.**
From the folder with the PR's branch, start it the way the project notes say
(which command, which variants, how to find each port). Without notes, use the
project's usual dev command (`bin/dev`, `npm run dev`, …) and read the port from
its output or config. Run it in the background and log to a file in the run
folder. Then wait for readiness with a curl loop against the port, not a fixed
sleep; cold dev servers are slow. Leave the server running after the run, and
say in the report-back that you started it and on which ports.

No free port, or the machine too loaded to boot it (503s, timeouts)? When the
project notes say how to free ports or memory, do that yourself with no question
first, and name what you stopped in the report-back. Without notes, ask the user.

A server that is already up is different: **restarting or resetting a running
server is still not your call.** If one answers but serves the wrong branch or
folder, ask the user.

## 2. Get the QA doc

**The QA doc lives in a comment on the PR.** That comment is the only place to look.
Do not search `~/qa/` or any other folder for it: a local file may be old, or from another
machine's run, and a fresh machine has none.

```bash
QAC=tv-qa-doc-comment   # from this plugin's bin/, on the Bash PATH
$QAC find <pr>                                 # prints the comment URL, exit 1 when there is none
QA_DOC="$(mktemp -d)/pr-<pr>.md"
$QAC get <pr> "$QA_DOC" && echo "$QA_DOC"     # a fresh copy for this run; note the printed path
```

Get it fresh on every run, into a new temporary folder, never into `~/qa/`. Then no old
copy is left for a later run to pick up by mistake.

Tell the user where the doc came from in these words: "QA doc: from the PR comment
<comment URL>". Step 6 puts the video into that same comment.

The one exception: the user points at a doc in this conversation (a path, or pasted
Gherkin). Use that, and post it on the PR with `$QAC post <pr> <doc.md>`, which edits the
existing QA comment or adds one. The doc needs its `## In short` section first; write one
per `tv-qa-docs` step 7.

No QA comment and no doc from the user: ask with `AskUserQuestion`:

- **Generate one with /tv-qa-docs (Recommended)**: run `tv-qa-docs` for this PR. It posts
  the QA comment; then continue from that comment.
- **No doc, work from the PR**: build the scenarios from the PR description and diff,
  and say in the run report that no QA doc was followed.

`tv-qa-docs` posts the doc on the PR itself.

## 3. Record the run

Run `tv-record-video`. Mirror the QA doc's numbering (sections `1`, `2`; subsections
`1.1`, `1.2`) in the title cards and the corner badge. Work through every scenario
in the doc, for every variant and surface it lists.

Record in **dark mode** (white screens are hard on the viewer's eyes). `tv-record-video` sets
it up; its Dark mode section says what to do when the test user is saved as light.
Use light mode only when the QA doc tests the light theme.

Done when: every segment holds real motion. Build a 1 fps contact sheet of the
silent mp4 and look at it:

```bash
ffmpeg -nostdin -v error -y -i "$RUN_DIR.mp4" -vf "fps=1,scale=320:-2,tile=8x8" "$RUN_DIR/contact_%02d.png"
```

Every scenario in the doc must show up on the sheet. A step that is missing was
dropped by the recorder, not skipped by you: record that part again. If your
memory has notes on the known ways the recorder loses footage, read them first.

## 4. Narrate the video

Run `tv-narrate-video` on the run folder. Its verdict line per scenario must agree
with the run report: a FAIL is said out loud as a fail.

**One voice at a time is a hard gate.** After the last `build`, run:

```bash
tv-narrate-solo --run "$RUN_DIR"
```

It must report zero overlaps. Non-zero: `--fix`, `build` again, check again. Then
confirm the finished file has exactly one audio track:

```bash
ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${RUN_DIR}__narrated.mp4" | wc -l   # 1
```

## 5. Write the run report

Run `tv-qa-run-report` with the same base name as the run, so it sits beside the
video as `${RUN_DIR}__report.html`. Its video-evidence line points at the narrated
mp4. Every scenario from the QA doc appears in it as PASS, FAIL, PARTIAL or NOT RUN.

## 6. Put the video in the QA comment, and link it from the PR description

The video goes into the QA doc comment from step 2, below the folded doc. The PR
description gets only a short line that points to that comment. When the PR has no
QA comment (you worked from the PR, not a doc), the script posts a new comment
that holds only the video.

**a. The text above the video.** Write `$RUN_DIR/comment-section.md`: one sentence
saying what was tested and on which variants, and the tally ("7 of 8 scenarios
pass, 1 fails"). No video line: the script adds the player. The run report stays
on disk; step 7 gives the user its path.

```markdown
QA pass of the invoice setup, recorded 2026-10-13: 7 of 8 scenarios pass, 1 fails.
```

**b. Put the video into the comment.**

```bash
QAC=tv-qa-doc-comment
VIDEO_COMMENT="$($QAC video <pr> "${RUN_DIR}__narrated.mp4" "$RUN_DIR/comment-section.md")"
echo "$VIDEO_COMMENT"
```

It adds a `## QA video` block at the end of the QA comment, after the folded doc,
and replaces the block from an earlier run instead of adding a second one. It
prints the URL of the comment that holds the video. `gh` can attach a file only
to a new comment, so the script uploads through a short temporary comment, copies
the video link into the QA comment, and deletes the temporary comment. A later
`/tv-qa-docs` revision keeps the video block.

GitHub refuses videos over its size limit (10 MB on free plans, 100 MB on paid
ones). When the upload fails on size, encode a smaller copy and run step b with it:

```bash
ffmpeg -nostdin -y -i "${RUN_DIR}__narrated.mp4" -vf scale=1280:-2 -c:v libx264 -crf 32 -preset slow -c:a aac -b:a 64k "${RUN_DIR}__narrated_pr.mp4"
```

When even that is too big, leave the video out of the comment, and give the
user the path of the narrated mp4.

**c. Point to it from the PR description.** Write `$RUN_DIR/pr-section.md`: the
same sentence and tally, then one line that says the video is in the comment below,
with the link from step b.

```markdown
QA pass of the invoice setup, recorded 2026-10-13: 7 of 8 scenarios pass, 1 fails.

The QA run video is in the QA comment below: [watch it here](https://github.com/…#issuecomment-…).
```

```bash
tv-qa-pr-link <pr> "$RUN_DIR/pr-section.md"
```

The script puts a `## QA video` section at the end of the description, above
cubic's generated block when there is one. It replaces the section from an earlier
run, which also removes a video player an older run put there. It exits non-zero
when the link did not land.

A review bot (cubic, for example) may rewrite the description within about a
minute of a change. If the repo has one, wait 60 seconds, read the body again, and
run `tv-qa-pr-link` again if the section is gone.

Write both texts as the user, with no AI attribution of any kind.

## 7. Report back

A failed scenario is a fix item, not a line in a comment. A FAIL that only
sits in the QA comment waits there until a reviewer finds it again, so the
report ends with every FAIL as a numbered item in the same shape as a review
finding: a bold short name, the problem in plain words (what the scenario
expected, what happened), the scenario number, and the file and line where
the fix would go when you can see it. The user answers with numbers ("1 fix,
2 skip"), and a FAIL they do not answer stays open in the next report.

Tell the user, in this order:

- the tally per variant, then every FAIL as a numbered item (above)
- the PR URL, and that its description links to the video
- the URL of the comment that holds the video, and whether it is the QA doc comment or a new
  video-only comment
- the QA doc comment URL, and whether it was posted, edited or already there
- the paths of the narrated video and the run report on disk
- anything not checked: NOT RUN scenarios, and whether the Codex narration review
  ran or was skipped because there is no Codex CLI on this machine
