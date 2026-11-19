---
name: tv-qa
description: Use when the user runs /tv-qa or says "QA this PR", "QA run the PR", "run QA and record it". Runs a full QA pass of a pull request in the browser from the QA doc held in the PR's QA comment (never from a local folder), writes a run report for agents, records a narrated video of only the failed and unsure scenarios (every scenario with "/tv-qa all" or "full video", none when nothing failed), and posts it all as a new PR comment, hiding the older QA run comments as outdated. Reports what it finds; it never fixes code.
---

# QA a pull request

One command for the whole QA pass. This skill does not run the browser, record,
narrate or write reports itself. It calls the skills that do, in order, and owns
the hand-offs between them:

| Step | Skill |
|---|---|
| QA doc (only when the PR has no QA comment) | `tv-qa-docs` |
| Run report, for agents | `tv-qa-run-report` |
| Video of the failed and unsure scenarios | `tv-qa-video` (it calls `tv-record-video` and `tv-narrate-video`) |

Call each one with the Skill tool, as its own invocation, and follow its rules.
This file only adds what none of them say.

**Project notes first.** If a skill named `tv-qa-notes` is available (a project
plugin ships it, for example `myapp-qa:tv-qa-notes`), invoke it before step 1 and
follow it: it says how to start the app, which ports and variants (markets,
tenants) it has, where the seed accounts are, and how to free ports or memory.
Where the notes and this skill differ, the notes win. No notes skill: read the
repo's QA notes file if it has one (`docs/qa-notes.md`, `QA.md`, or a QA section
in `AGENTS.md` / `CLAUDE.md`), else use plain defaults: one app, one port.

## What the run delivers

Every run tests **every scenario** of the QA doc and ends with a **new QA run
comment** on the PR: a short summary, the video when there is one, and the run
report folded for agents. The PR description is not touched.

The video depends on the mode (full rules in `tv-qa-video`):

- **Default:** a video of only the scenarios that failed (`FAIL`, `PARTIAL`) or
  that you were not sure about (`UNSURE`). Nothing failed and nothing unsure: no
  video at all, and the comment says so.
- **"/tv-qa all", "full video", "video of everything":** a video of every scenario
  that ran, also when some fail.
- **"no video":** no video, whatever the results.

Extra instructions in the /tv-qa message (upload somewhere, seed extra data,
delegate the run to a subagent, do something "after that") **add** steps. They do
not replace the run report or the comment. When you delegate the browser run, the
subagent's brief names `tv-qa-run-report`, its statuses and the run folder.

## The run is read-only

**This is a test run, not a fix run.** The only things you write are the QA doc,
the run folder in `~/qaRun/` and comments on the PR. The repository stays exactly
as you found it: no file edits, no commits, no pushes, no "quick fix, then run it
again".

When something is wrong, that is a finding: mark the scenario `FAIL` with one
factual line. When the app does something the doc does not decide, or you cannot
tell whether it is intended, mark it `UNSURE` and write the question. When a
scenario cannot be set up by adding data on top of what exists, mark it `NOT RUN`
and give the reason. Keep going to the next scenario either way.

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
<comment URL>". 
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

## 3. Run every scenario, off camera

Set up the run folder the `tv-record-video` way, so a later recording can use it:

```bash
RUN_DESC="<snake_case_summary>"
RUN_DIR="$HOME/qaRun/$(date +%Y-%m-%d_%H-%M)__${RUN_DESC}"
mkdir -p "$RUN_DIR"
```

Drive the app with `agent-browser` and work through every scenario in the doc, for
every variant and surface it lists. No recording in this pass. For each scenario,
write down as you go: the data used, the steps, what you expected, what you saw
(messages and values verbatim), and the status. For anything that is not a
`PASS`, also keep the URL and the steps that show it again, and a screenshot in
`$RUN_DIR/evidence/`. The video step replays exactly those steps.

Write down the commit you tested: `git rev-parse HEAD` in the folder the server
runs from.

## 4. Write the run report

Run `tv-qa-run-report` with the run's base name, so it sits beside the run folder
as `${RUN_DIR}__report.md`. Every scenario from the QA doc appears in it, the
ones that need attention first. Set its `video` line to the mode.

## 5. Record the video

Run `tv-qa-video` with the run folder, the report and the mode. It returns the
narrated mp4, or "no video" with the reason. When a failure does not happen again
on camera, it adds that to the report; read the report again before step 6.

## 6. Post the QA run comment

Write `$RUN_DIR/comment-summary.md`, for people: one sentence on what was tested
and on which variants, the tally, then one line per scenario that needs attention,
and one line about the video.

```markdown
QA of the order checkout on MA and ZA, recorded 2026-11-19: 14 of 17 pass, 2 fail, 1 unsure.

- **2.3 Due date in the past** (ZA) fails: the invoice is saved with no warning.
- **3.1 Discount over 100%** fails: the total goes negative.
- **4.1 Blank due date** is unsure: the list shows "—"; is that intended?

The video shows only these 3 scenarios.
```

With no video, the last line says why: "Every scenario passed, so there is no
video." In mode `all`: "The video shows all 17 scenarios."

Then post it:

```bash
RUN_COMMENT="$(tv-qa-run-comment <pr> "$RUN_DIR/comment-summary.md" "${RUN_DIR}__report.md" ["<narrated mp4>"])"
echo "$RUN_COMMENT"
```

Leave out the mp4 argument when there is no video. The script (on the Bash PATH,
from this plugin's bin/):

- posts a **new** comment every run: the summary, the video player, then the run
  report folded in `<details>`;
- reads it back, then hides each older QA run comment as **Outdated** (GitHub's
  Hide), and each older video-only comment;
- removes the old `## QA video` block from the QA doc comment and the old QA video
  section from the PR description, both left there by runs before this change.

It prints the URL of the new comment. It refuses a comment over about 65,000
characters; then shorten the report's `Passed` and `Run details` and post again.
A PR comment is readable by everyone with access to the repo.

Write the summary as the user, with no AI attribution of any kind.

## 7. Report back

A failed scenario is a fix item, not a line in a comment. A FAIL that only sits in
the comment waits there until a reviewer finds it again, so the report ends with
every FAIL, PARTIAL and UNSURE as a numbered item in the same shape as a review
finding: a bold short name, the problem in plain words (what the scenario
expected, what happened, or the open question), the scenario number, and the file
and line where the fix would go when you can see it. The user answers with
numbers ("1 fix, 2 skip"), and an item they do not answer stays open in the next
report.

Tell the user, in this order:

- the tally per variant, then the numbered items (above)
- the URL of the new QA run comment, whether it has a video (and which mode), and
  how many older comments it hid as outdated
- the QA doc comment URL, and whether it was posted, edited or already there
- the paths of the run report and the narrated video on disk
- anything not checked: NOT RUN scenarios, and whether the narration review ran,
  or why it could not run
