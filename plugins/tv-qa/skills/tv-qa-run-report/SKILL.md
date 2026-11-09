---
name: tv-qa-run-report
description: Use after running (or while running) any browser-based QA pass to write a QA RUN REPORT — a record of what was actually tested, how, with what data, and the outcome. Triggers when the user says "write a QA run report", "document what was QA'd", "record what was tested", or after a browser QA / recorded video run. Produces a polished self-contained HTML file in ~/qaRun/ named YYYY-MM-DD_HH-MM__<task>__report.html (mirroring the run/video name). This is the AFTER-the-run record of outcomes — not a test plan of what to test (that's tv-qa-docs).
---

# Write a QA Run Report

After a browser QA pass — especially one captured with the `tv-record-video`
skill — produce a single HTML document that records **what was tested, how it
was tested, with what data, and the outcome**. This is the human-readable
counterpart to the recorded video: a reviewer reads it to know exactly which
scenarios were exercised and whether they passed.

> **This is a RUN REPORT, written after testing — not a test plan.** It says
> "here is what I ran and what happened." If you instead need a plan of what
> *should* be tested before a run, that's the `tv-qa-docs` skill.

## When to use

- The user asks to "write a QA run report", "document what was QA'd", "record
  what was tested", "summarise the QA run".
- Immediately after a `tv-record-video` run — pair the report with the video.
- After any manual or automated browser QA pass you want a record of.

## Tone — summarise outcomes, don't dump failure detail (IMPORTANT)

The report's job is to **summarise what was tested and the outcome**, not to be a
bug tracker. Keep it factual and high-level:

- State each scenario's result as a short status (PASS / FAIL / PARTIAL / NOT
  RUN) plus **one line** of outcome.
- For anything that didn't pass, note it briefly and factually — "did not show
  the expected message" — **without** root-cause analysis, stack traces, repro
  theories, or fix suggestions. Deep debugging belongs elsewhere.
- Do not editorialise, do not suggest improvements, do not speculate. Describe
  what was tested and what happened.

## Filename & location (REQUIRED)

Save to `~/qaRun/` using the same pattern as the run/video, with a `__report.html`
suffix:

```
~/qaRun/<YYYY-MM-DD_HH-MM>__<task_snake_case>__report.html
```

- **If this pairs with a `tv-record-video` run**, reuse that run's exact base
  name so the report sits beside the video:
  - video: `~/qaRun/2026-06-15_11-38__duplicate_upload_toast.mp4`
  - report: `~/qaRun/2026-06-15_11-38__duplicate_upload_toast__report.html`
- **If standalone** (no video), use the current date/time and a snake_case
  summary of the task: `$(date +%Y-%m-%d_%H-%M)__<task_snake>__report.html`.

## What to include (sections, in order)

1. **Header** — feature name, ticket id, one-line subtitle, and summary pills
   (`N scenarios executed`, `X / N PASS`, failure count).
2. **Run details** — date/time, feature under test, environment (local app at
   `http://localhost:3000`), account(s) used, case/fixture, method (e.g. "automated browser run,
   captured as a screen recording"), and a path to the video evidence if any.
3. **Test data** — the concrete inputs used (files + checksums, accounts,
   records, seeded fixtures). Be specific: a reader should be able to tell what
   was fed in. If files were generated, note how they relate (e.g. byte-identical
   copies).
4. **Scenario sections** — mirror the QA doc's numbering (`1`, `1.1`, …). One
   card per scenario with: *what was tested · data used · expected · observed ·
   result*. Render observed messages/states verbatim (in a pill if it's a
   toast/banner) so the wording is on the record.
5. **Not covered in this run** — list test-plan items that were out of scope,
   factually. This keeps the report honest about coverage.
6. **Outcome** — a short paragraph summarising the run, then the headline tally
   (e.g. "6 of 6 scenarios PASS — 0 failures").

Mirror the source QA document's exact numbering and headings where one exists.
Only invent a breakdown if no QA doc was followed, and say so.

## How to produce it

Fill in the canonical template below and write it with the Write tool to the
target path. It is fully self-contained (inline CSS, no external assets), so it
renders anywhere. After writing, optionally render it to verify layout:

```bash
agent-browser --session rpt set viewport 1100 1400
agent-browser --session rpt open "file://$HOME/qaRun/<file>.html"
agent-browser --session rpt screenshot --full /tmp/report_check.png
agent-browser --session rpt close
```

(`export AGENT_BROWSER_ARGS="--no-sandbox,--disable-dev-shm-usage"` first if Chrome
won't launch.)

### Status pill classes
- PASS → `<span class="status pass">PASS</span>`
- FAIL → `<span class="status fail">FAIL</span>`
- PARTIAL → `<span class="status partial">PARTIAL</span>`
- NOT RUN → `<span class="status notrun">NOT RUN</span>`

### Observed-message pills (for toasts / banners)
- success / green state → `<span class="toast green">…verbatim text…</span>`
- error / red state → `<span class="toast red">…verbatim text…</span>`

## Canonical template

Replace every `{{…}}` placeholder. Duplicate the `<!-- SCENARIO -->` block per
scenario and the `<!-- SECTION -->` block per QA section. Delete the
"Not covered" section if everything was tested.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{FEATURE}} — QA Run Report ({{TICKET}})</title>
<style>
  :root{
    --bg:#f4f6fb; --card:#ffffff; --ink:#1f2933; --muted:#5b6776; --line:#e3e8f0;
    --brand:#2563eb; --brand-soft:#eff4ff; --ok:#15803d; --ok-soft:#e7f6ec;
    --bad:#b91c1c; --bad-soft:#fdecec; --warn:#92600a; --warn-soft:#fdf3da; --mono:#0b1020;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.55;padding:40px 20px}
  .wrap{max-width:980px;margin:0 auto}
  header.page{background:linear-gradient(135deg,#0b1020,#1e3a8a);color:#fff;border-radius:16px;
    padding:34px 38px;box-shadow:0 10px 30px rgba(15,23,42,.18)}
  header.page .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:13px;color:#9dc1ff;font-weight:700}
  header.page h1{margin:8px 0 6px;font-size:30px;line-height:1.2}
  header.page p{margin:0;color:#c7d6f5;font-size:15px}
  .summary-pills{margin-top:18px;display:flex;gap:10px;flex-wrap:wrap}
  .pill{display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:13px;
    padding:6px 13px;border-radius:999px}
  .pill.ok{background:var(--ok-soft);color:var(--ok)}
  .pill.info{background:var(--brand-soft);color:var(--brand)}
  .pill.count{background:rgba(255,255,255,.14);color:#fff}
  section.block{background:var(--card);border:1px solid var(--line);border-radius:14px;
    padding:24px 26px;margin-top:22px;box-shadow:0 2px 8px rgba(15,23,42,.04)}
  h2{font-size:20px;margin:0 0 14px;padding-bottom:10px;border-bottom:2px solid var(--line)}
  h3{font-size:16px;margin:0}
  table{width:100%;border-collapse:collapse;font-size:14px}
  table th,table td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  table th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  table tr:last-child td{border-bottom:none}
  code,.mono{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:13px}
  .filehash{color:var(--muted);font-size:12px}
  .scenario{border:1px solid var(--line);border-radius:12px;padding:0;margin-top:16px;overflow:hidden}
  .scenario .head{display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:14px 18px;background:#fafbfe;border-bottom:1px solid var(--line)}
  .scenario .head .id{font-weight:700;color:var(--brand);font-size:13px;letter-spacing:.03em}
  .scenario .head .title{font-weight:700;font-size:15px;flex:1;margin-left:10px}
  .scenario .body{padding:16px 18px;display:grid;grid-template-columns:120px 1fr;gap:8px 16px}
  .scenario .body dt{color:var(--muted);font-size:13px;font-weight:600}
  .scenario .body dd{margin:0;font-size:14px}
  .toast{display:inline-block;border-radius:8px;padding:7px 12px;font-size:13.5px;font-weight:600;
    border:1px solid transparent}
  .toast.green{background:var(--ok-soft);color:var(--ok);border-color:#bfe6cb}
  .toast.red{background:var(--bad-soft);color:var(--bad);border-color:#f3c4c4}
  .status{font-weight:700;font-size:12px;padding:5px 11px;border-radius:999px;white-space:nowrap}
  .status.pass{background:var(--ok-soft);color:var(--ok)}
  .status.fail{background:var(--bad-soft);color:var(--bad)}
  .status.partial{background:var(--warn-soft);color:var(--warn)}
  .status.notrun{background:#eef1f6;color:var(--muted)}
  .note{font-size:13.5px;color:var(--muted)}
  .kv{display:grid;grid-template-columns:200px 1fr;gap:6px 18px;font-size:14px}
  .kv dt{color:var(--muted);font-weight:600}
  .kv dd{margin:0}
  footer{margin-top:26px;text-align:center;color:var(--muted);font-size:12.5px}
  .unchanged{color:var(--ok);font-weight:600}
  ul.tight{margin:6px 0 0;padding-left:20px;font-size:14px}
  ul.tight li{margin:3px 0}
</style>
</head>
<body>
<div class="wrap">

  <header class="page">
    <div class="eyebrow">QA Run Report · {{TICKET}}</div>
    <h1>{{FEATURE}}</h1>
    <p>{{SUBTITLE}}</p>
    <div class="summary-pills">
      <span class="pill count">{{N}} scenarios executed</span>
      <span class="pill ok">{{PASS}} / {{N}} PASS</span>
      <span class="pill info">{{FAILURES}} failures</span>
    </div>
  </header>

  <section class="block">
    <h2>Run details</h2>
    <dl class="kv">
      <dt>Date / time</dt><dd>{{DATETIME}}</dd>
      <dt>Feature under test</dt><dd>{{FEATURE_DESC}}</dd>
      <dt>Environment</dt><dd><code>{{APP_HOST}}</code></dd>
      <dt>Account(s)</dt><dd><code>{{ACCOUNT}}</code></dd>
      <dt>Case / fixture</dt><dd><code>{{CASE}}</code></dd>
      <dt>Method</dt><dd>{{METHOD}}</dd>
      <dt>Evidence (video)</dt><dd><code>{{VIDEO_PATH}}</code></dd>
    </dl>
  </section>

  <section class="block">
    <h2>Test data</h2>
    <p class="note">{{DATA_NOTE}}</p>
    <table>
      <thead><tr><th>Input</th><th>Detail</th><th>Identifier</th><th>Role in the run</th></tr></thead>
      <tbody>
        <!-- DATA ROW --><tr><td><code>{{INPUT}}</code></td><td>{{DETAIL}}</td><td class="filehash">{{IDENT}}</td><td>{{ROLE}}</td></tr>
      </tbody>
    </table>
  </section>

  <!-- SECTION -->
  <section class="block">
    <h2>{{SEC_NUM}} &nbsp;{{SEC_TITLE}}</h2>

    <!-- SCENARIO -->
    <div class="scenario">
      <div class="head">
        <span><span class="id">{{ID}}</span><span class="title">{{SC_TITLE}}</span></span>
        <span class="status pass">PASS</span>
      </div>
      <dl class="body">
        <dt>What was tested</dt><dd>{{WHAT}}</dd>
        <dt>Data used</dt><dd>{{DATA}}</dd>
        <dt>Expected</dt><dd>{{EXPECTED}}</dd>
        <dt>Observed</dt><dd><span class="toast green">{{OBSERVED}}</span></dd>
        <dt>Result</dt><dd><strong class="unchanged">Matched expected.</strong> {{RESULT_LINE}}</dd>
      </dl>
    </div>
    <!-- /SCENARIO -->

  </section>
  <!-- /SECTION -->

  <section class="block">
    <h2>Not covered in this run</h2>
    <p class="note">The following items from the test plan were out of scope for this run and were not exercised:</p>
    <ul class="tight">
      <!-- NOT-COVERED --><li><strong>{{ITEM_ID}}</strong> — {{ITEM_DESC}}.</li>
    </ul>
  </section>

  <section class="block">
    <h2>Outcome</h2>
    <p>{{OUTCOME_PARAGRAPH}}</p>
    <p style="margin-bottom:0"><strong class="unchanged">{{TALLY}}</strong></p>
  </section>

  <footer>{{FOOTER}}</footer>

</div>
</body>
</html>
```

## After writing

Tell the user the full path to the report (`~/qaRun/<file>.html`) and, if it pairs
with one, the video path. Keep the message short — the report itself is the
deliverable.
