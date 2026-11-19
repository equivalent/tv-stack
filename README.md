# tv-stack

Claude Code plugins by Tomas Valent.

| Plugin | Skills | What it does |
|---|---|---|
| `tv-video` | `tv-record-video`, `tv-narrate-video` | Records browser QA flows as a real screen video with section cards and a corner badge, then adds a spoken narration that stays in step with the picture. |
| `tv-qa` | `tv-qa-docs`, `tv-qa`, `tv-qa-run-report`, `tv-qa-video` | Writes a Gherkin QA doc for a pull request and keeps it in one PR comment, runs it in the browser, writes a run report for agents, records a narrated video of the failed and unsure scenarios (all of them on request), and posts each run as a new PR comment, hiding the older ones as outdated. Needs `tv-video`. |

## Install

```
/plugin marketplace add equivalent/tv-stack
/plugin install tv-qa@tv-stack
```

`tv-qa` installs `tv-video` with it.

## What the machine needs

`agent-browser`, `ffmpeg`, `magick`, `gh` (signed in), and Python 3 for the
edge-tts voice (`tv-narrate bootstrap` sets it up on first use). The narration check
runs Claude Sonnet through the `claude` CLI; without it the check is skipped and
the report says so.

## Project notes

The QA skills are generic. A project tells them its own details (how to start
the app, ports, markets or tenants, seed accounts, feature flags) with a skill
named `tv-qa-notes` in a project plugin, or with a `docs/qa-notes.md` file in the
repo. Without notes they assume one app on one port and ask for what they cannot
find.
