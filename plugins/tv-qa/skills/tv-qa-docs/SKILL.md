---
name: tv-qa-docs
description: Use when the user runs /tv-qa-docs or asks to generate a QA test plan / QA document / test plan for a feature, branch, PR, or ticket. Writes a Gherkin-style (Given / When / Then) Markdown QA doc that an agent can run end to end, covering every surface (and every market or variant, when the project has them) the change touches. The doc lives in one collapsed comment on the PR: it reads that comment first, and edits the same comment on every revision.
---

# Generate a QA test plan (Gherkin Markdown)

## Overview

Write a **Markdown doc of Gherkin scenarios** that says what to test and exactly how. Its home
is one comment on the PR (step 9). The local file is only a working copy in a new temporary
folder, made fresh from the comment on every run.

**Who reads it:** mainly agents that run the QA pass (browser, API, native). A human who reads
Gherkin can follow it too. So write for a precise reader, not a casual one: exact field labels,
exact messages, exact status codes, exact values. No styling, no HTML, no screenshots in the doc.

**Core rule:** an agent must be able to run every scenario without asking a follow-up question.
More detail is better than less, as long as every detail is checked against the code.

`template.md` (next to this file) shows the shape. Read it before writing.

## Project notes come first

This skill is generic. What it does not know about one project (its markets or tenants, how to
start it, its ports, its sign-in pages, where the seed accounts are, its feature flags, its
native and API surfaces) comes from that project's **QA notes**.

1. If a skill named `tv-qa-notes` is available (a project plugin ships it, for example
   `myapp-qa:tv-qa-notes`), **invoke it before step 1** and follow it. Where the notes and this
   skill differ, the notes win.
2. Else, if the repo has a QA notes file (`docs/qa-notes.md`, `QA.md` or a "QA" section in
   `AGENTS.md` / `CLAUDE.md`), read it and follow it the same way.
3. Else, use plain defaults: one app, one base address written as `{APP_URL}`, no markets, and
   the sign-in and seed details you find in the repo. Ask the user (`AskUserQuestion`, once) only
   for what you cannot find, typically which account to use and which surfaces to cover.

Below, "the project notes" means whichever of these you have.

## Workflow

### 1. Look for a QA comment on the PR first

Before you write anything, find the PR (the one the user names, else
`gh pr list --head "$(git branch --show-current)"`) and look for its QA comment.
`tv-qa-doc-comment` comes with this plugin and is on the Bash PATH:

```bash
QAC=tv-qa-doc-comment
$QAC find <pr>                       # prints the comment URL, exit 1 when there is none
QA_DOC="$(mktemp -d)/pr-<pr>.md"
$QAC get <pr> "$QA_DOC" && echo "$QA_DOC"  # a fresh copy; note the printed path, later commands need it
```

When there is one, it is the current version of the doc. Get it, and revise it rather
than start again: keep **everything** it has, the same as any existing test plan. Never
look in another folder for a copy; the comment is the only source.

No PR yet: skip this step, and say in step 9 that nothing was posted.

### 2. Work out what changed

Sources, in this order:

1. An explicit spec the user points at (a plan, a ticket, a PR). If they give an existing test
   plan, the new doc must keep **everything** it has.
2. The current branch or PR diff: what changed is what to test.
3. The user's description.

**Check every fact in the code before you write it:** routes, field labels (from the locale
files), validation messages, limits, enum values, which fields each variant shows or refuses,
and the **real HTTP status code** each surface returns. Use an `Explore` subagent for bigger
digs. Never guess. A QA doc with a wrong status code or field name is worse than no doc.

Also pin down **how to reach the feature**: which market, tenant or setting it needs, and which
feature flags gate it (the project notes say where flags live). Without this, the tester sees a
missing menu item and reports a false bug.

### 3. Cover every variant

When the project notes name variants that can behave differently (markets, tenants, plans,
locales), test **each one** whenever the change can behave differently per variant, or touches
shared code all of them run (models, validations, shared components, the API, docs pages). Give
each variant its own `Feature`, so a tester can run one at a time. Only leave a variant out when
the change truly can't reach it, and say so in one line in the doc.

No variants in the notes: one `Feature` per surface.

### 4. Never hard-code a host or port

Don't write `localhost`, `127.0.0.1` or any port number in the doc. Ports differ per checkout and
per machine. Write each base address as a placeholder: `{APP_URL}` by default, or the names the
project notes give (one per variant). Say in "Before you start" that the agent running the plan
must work out the real addresses itself, and how (the project notes say how).

### 5. Accounts, data and safety rules

- **No passwords in the doc, ever**, not even the local dev one. Write "the standard password".
  Agents read the value from the place the project notes name (usually the seed file), or ask
  the user. Name that place in the doc, never the value.
- A one-time code that is a documented, non-secret dev bypass may be written; the project notes
  say whether there is one.
- **When different kinds of accounts sign in on different pages** (members and staff, for
  example), every account line says which page it belongs to.
- **No reset or restart steps.** No database resets or drops, truncating or bulk deletes, and no
  "restart the server". Dev data is a shared, long-lived fixture: set up what you need **by
  adding records** on top of it. If a scenario can't be set up that way, stop and ask the user.
  If an instance is down, ask the user to start it.
- No staging or production credentials, API keys, or customer data. Use made-up names and values
  (prefix them `QA …` so they're easy to find and clean up).
- Check the conversation and project memory for logins before asking. Ask the user once
  (`AskUserQuestion`) only for what's really missing, typically which surfaces to cover.

### 6. Decide the structure

One `Feature` per **variant × surface** that the change touches. Only include surfaces the
feature really has:

- **Web (user)**: the screens a signed-in user clicks through. Split by role when access
  differs per role.
- **Admin back office**: only if there is a back-office screen. Its own `Feature` (different
  sign-in page and permissions).
- **Native**: only if a native view exists near the touched code. Say how to reach it (the
  project notes say how, for example a user agent string).
- **API**: only if there's an API surface. State the auth header once (for example
  `Authorization: Bearer <key>`, and the scopes it needs). Put request bodies in doc strings
  (`"""`). Assert status, error fields and the message where they matter.
- **MCP**: only if the feature exposes MCP tools. JSON-RPC 2.0, and the token it needs.
- **Docs pages**: when the change edits user-facing docs (for example the API docs).
- **Unchanged behaviour**: when a nearby rule deliberately did NOT change, add scenarios proving
  it still holds (regressions are what QA misses most).

### 7. Write it

Follow `template.md`. The file has, in order:

1. `# QA test plan: <feature>` and a link to the PR or issue.
2. **In short** (`## In short`): two or three very short paragraphs a person can listen to
   through text-to-speech. Say what gets tested and where, in plain prose: "This tests the
   open invoice count in the customer drawer, and the new status checkboxes in the invoice
   filters." No bullets, no code, no backticks, no paths, no URLs, no symbols such as arrows or
   slashes, no numbers a voice reads badly. The rest of the doc holds the details. This section
   is what shows on the PR without a click.
3. **What changed**: a few plain bullets, plus a small table when per-variant behaviour differs.
   Also list what did **not** change.
4. **Before you start**: placeholders and how to find the addresses, accounts, flags, API key
   and scopes, any screen that can't be opened directly, and any note the project notes ask for.
5. One `## Feature: …` section per variant × surface, each holding one ` ```gherkin ` block.
6. **Known and accepted behaviour (not bugs)**: things a tester would otherwise report.
7. **Clean up**: what to delete or revoke afterwards.

Gherkin rules:

- One `Feature:` per fenced ` ```gherkin ` block. Use `Background:` for the shared setup
  (variant, sign-in, starting page).
- Use `Scenario Outline:` + `Examples:` tables when the same steps run with several values
  (accepted values, refused values, per-locale labels).
- Steps name what the user **sees**: the field's real label in quotes, the button text, the exact
  message. Not CSS classes or element IDs. "The field is outlined in red" is fine.
- `Then` steps check **the end result** (saved record, message shown, status code, printed
  invoice), not a click.
- Each scenario stands alone: it sets up its own data (`Given … exists`) and doesn't depend on
  an earlier scenario.
- Plain words. Keep the exact values, limits and messages in the steps.

### 8. Save and check

- Save the working copy as `$QA_DOC` from step 1. With no QA comment yet, make it the same
  way: `QA_DOC="$(mktemp -d)/pr-<pr>.md"`. Only when there is no PR at all, save it as
  `~/qa/<kebab-slug>.md`, because nothing else holds it then.
- Check before you call it done:

  ```bash
  f="$QA_DOC"
  grep -c '{{' "$f"                                  # 0: no template placeholders left
  grep -nE 'localhost|127\.0\.0\.1|:[0-9]{4}\b' "$f" # nothing: no hard-coded host or port
  grep -c '^```' "$f"                                # even: every fence is closed
  grep -niE 'password[^s]*[:=]' "$f"                 # nothing: no password written down
  grep -c '^## In short' "$f"                        # 1: the listenable summary is there
  ```

  Address placeholders such as `{APP_URL}` are meant to stay. A `{{` is a template leftover.

### 9. Post it on the PR

When the work has a PR, post the doc on it. Asking for a QA doc is the permission; don't
ask again.

```bash
cd <repo> && tv-qa-doc-comment post <pr> "$QA_DOC"
```

The script finds the QA comment from step 1 and **edits it**, so the PR keeps one QA
comment with the newest doc. It posts a new comment only when there is none. Pass `--new`
only when the user asks for a second comment. The comment shows the `## In short` section,
then the whole doc folded in `<details>`. It starts with the hidden marker
`<!-- tv-qa-doc -->`, which is how the next run finds it.

After a `/tv-qa` run the same comment also holds the QA run video, in a `## QA video`
block below the folded doc. `post` keeps that block when it edits the comment.

The script refuses a doc that looks like it holds a password, and a comment over about
65,000 characters. For a doc that big, make it shorter (merge repeated steps into
`Scenario Outline`s, move shared setup into `Background`) and post again. If it still does not
fit, tell the user and give them the local file's path. A PR comment is readable by everyone
with access to the repo.

Give the user the comment URL it prints. No PR: post nothing, and say so.

## Common mistakes

| Mistake | Fix |
|---|---|
| Skipping the project notes | Invoke `tv-qa-notes` (or read the repo's QA notes) before step 1. |
| Writing HTML or styled output | The doc is Markdown with Gherkin blocks. Nothing else. |
| Testing only one variant | Cover every market or tenant the change can reach. |
| Hard-coding `localhost:3000` or any port | Use `{APP_URL}` or the notes' placeholders; the running agent finds the real addresses. |
| Guessing labels, messages, status codes or limits | Check each one in the code or locale files. |
| Inventing an API, admin or native section | Only include surfaces the change really has. |
| Scenarios that depend on each other | Each scenario sets up its own data. |
| Only testing what changed | Add scenarios for nearby rules that deliberately stayed the same. |
| Writing a new doc while the PR already has a QA comment | Step 1: `get` it and revise it. |
| A second QA comment on the PR | `post` edits the old one; `--new` only when asked. |
| A summary with bullets, code or paths | `## In short` is plain prose for text-to-speech. |
| A password in the doc | Never. "The standard password", and name where agents read it. |
| Reset, reseed or restart steps | Add data on top of what exists; ask if that's impossible. |
| Steps that name CSS classes or IDs | Name what the user sees: labels, buttons, messages. |
