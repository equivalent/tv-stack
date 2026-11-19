---
name: tv-qa-run-report
description: Use after running (or while running) any browser-based QA pass to write a QA RUN REPORT, a record of what was tested, with what data, and the outcome of each scenario. Triggers when the user says "write a QA run report", "document what was QA'd", "record what was tested", or after a browser QA run. Writes a Markdown file for agents, failures first, in ~/qaRun/ named YYYY-MM-DD_HH-MM__<task>__report.md (the run's base name). /tv-qa posts it folded in the PR's QA run comment. This is the record after the run, not a test plan (that is tv-qa-docs).
---

# Write a QA run report

After a browser QA pass, write one Markdown file that says what was tested and
how each scenario ended. **The reader is an agent**, not a person: a later agent
reads it to know what failed, what to fix, and what to test again. People read the
short summary and watch the video in the PR comment; they do not read this file.
So it is plain, dense and regular. No HTML, no styling, no prose for effect.

> This is a run report, written after testing. A plan of what should be tested
> is the `tv-qa-docs` skill.

## Statuses

Every scenario of the QA doc gets exactly one:

| Status | Meaning |
|---|---|
| `FAIL` | The app did not do what the scenario expects. |
| `PARTIAL` | Some `Then` steps held and some did not. |
| `UNSURE` | The app did something the doc does not decide, or you cannot tell whether what you saw is intended. Say what looked odd. |
| `NOT RUN` | The scenario could not be set up or was out of scope. Say why. |
| `PASS` | Every `Then` step held, and nothing looked odd. |

Use `UNSURE` honestly. When you hesitate between `PASS` and something else, it is
`UNSURE`: a person checks those, and a wrong `PASS` is never checked again.

## Filename and location

`~/qaRun/<YYYY-MM-DD_HH-MM>__<task_snake_case>__report.md`. When it pairs with a
run folder, reuse the run's exact base name: run folder
`~/qaRun/2026-06-15_11-38__duplicate_upload_toast/` gives
`~/qaRun/2026-06-15_11-38__duplicate_upload_toast__report.md`.

## Shape (in this order)

Failures go first, so an agent that reads only the top still gets them.

```markdown
# QA run report: <feature> (PR #<n>)

- result: <pass>/<total> PASS, <n> FAIL, <n> PARTIAL, <n> UNSURE, <n> NOT RUN
- date: 2026-11-19 14:05 UTC
- pr: https://github.com/<owner>/<repo>/pull/<n>
- commit: <full sha of the code under test>
- qa doc: <QA doc comment URL, or "none: scenarios built from the PR">
- variants: <markets, tenants, devices covered, or "one">
- video: <"failures only" | "all scenarios" | "none: nothing to show">

## Needs attention

### 2.3 <scenario title, verbatim from the QA doc> [FAIL]
- variant: ZA
- given: <the setup actually used: account, records, flags>
- did: <the steps, short>
- expected: <the doc's Then, verbatim>
- observed: <what the app did; messages and values verbatim, in quotes>
- where: <URL path or screen; file:line only when you saw it plainly>
- evidence: video at 01:42 | screenshot <path> | request log line
- note: <one factual line; "did not happen again on camera" when a FAIL did not repeat>

### 4.1 <title> [UNSURE]
- ...
- question: <what a person must decide: "is a blank due date meant to show '—'?">

## Not run

- 5.2 <title>: <reason>

## Passed

- 1.1 <title> [MA, ZA]
- 1.2 <title> [MA]

## Run details

- app: <host and port per variant>
- accounts: <seed users used, no passwords>
- data: <fixtures and records created for the run>
- method: <browser run with agent-browser; which scenarios were filmed>
- not covered: <doc items out of scope, or "none">
```

Rules:

- Order `Needs attention` by status (`FAIL`, `PARTIAL`, `UNSURE`), then by the
  doc's numbering. Keep the doc's numbers and titles verbatim.
- One scenario per variant when the outcome differs by variant; one entry with
  `variant: MA, ZA` when it is the same.
- `Passed` is one line per scenario. No details: a pass needs none.
- Facts only: what you did, what you expected, what you saw. No root-cause
  theory and no fix advice, unless you saw the cause plainly (then one line in
  `where`).
- Leave out empty sections, except `Needs attention`: write `- none` under it.
- Never write a password, key, one-time code, token or customer data. The file
  goes into a PR comment.
- Keep it under about 50,000 characters, so it fits in one comment. When it
  does not, shorten `Passed` and `Run details`, never `Needs attention`.

## After writing

Give the path of the report. When `/tv-qa` called this skill, it posts the report
itself; do not post it.
