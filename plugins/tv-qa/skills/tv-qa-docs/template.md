# QA test plan: {{feature in plain words}}

Pull request: {{PR or issue URL}}

## In short

{{Two or three very short paragraphs for text-to-speech: what gets tested, where, and on which
variants (markets, tenants) if the project has them. Plain prose only: no bullets, code,
backticks, paths, URLs or symbols.}}

## What changed

- {{One plain bullet per behaviour change, with the exact rule: limits, formats, messages.}}
- If a check fails, the message is: *"{{exact message}}"*.

{{Only when behaviour differs per variant (market, tenant, plan); else remove the table.}}

| Variant | Where | Field / endpoint | Who sees it |
|---|---|---|---|
| {{variant A}} | {{screen}} | {{field label}} / `{{api_field}}` | {{roles or customer types}} |
| {{variant B}} | {{screen}} | {{field label}} / `{{api_field}}` | {{roles or customer types}} |

What did **not** change:

- {{A nearby rule that deliberately stayed the same.}}

## Before you start

- **Find the address yourself.** Don't assume a fixed host or port. {{How to find the real
  address in this checkout, from the project notes.}} Below it is written as `{APP_URL}` (or one
  placeholder per variant, as the project notes name them).
- The app must run from a checkout of the branch `{{branch}}`.
- Sign in at `{{sign-in page}}` with a seeded account that is {{role}}, using the standard
  password (agents: read it from {{the seed file the project notes name}}).
- Flags or settings that must be on: {{flag names}}.
- API only: an API key with the scopes {{`customers:read`, `customers:write`}}, created under
  {{Settings → Developer → API keys}}. Send it as `Authorization: Bearer <key>`.
- {{Any screen that can't be opened directly, and how to reach it.}}
- Use made-up names and numbers only, starting with `QA`.

---

## Feature: {{variant A}}: {{surface}}

```gherkin
Feature: {{what this variant and surface must do}}

  Background:
    Given the app is running at {APP_URL}
    And I am signed in as {{role}}
    And I am on the {{starting page}}

  Scenario: {{the main happy path, ideally the original bug report}}
    When I {{action}}
    And I enter "{{value}}" in "{{exact field label}}"
    And I save {{the record}}
    Then {{the record}} is created
    And {{where the saved value shows}} shows "{{value}}"

  Scenario Outline: {{accepted values}}
    When I enter "<value>" in "{{exact field label}}"
    And I save {{the record}}
    Then {{the record}} is created with {{field}} "<value>"

    Examples:
      | value |
      | {{v1}} |

  Scenario Outline: {{refused values, with the exact message}}
    When I enter "<value>" in "{{exact field label}}"
    And I save {{the record}}
    Then {{the record}} is not created
    And I see "{{exact full message}}"

    Examples:
      | value |
      | {{v1}} |
```

## Feature: {{variant A}}: API

```gherkin
Feature: {{what the API must do}}

  Background:
    Given the app is running at {APP_URL}
    And I have an API key with {{scopes}}

  Scenario: {{accepted request}}
    When I POST {APP_URL}/api/{{resource}} with JSON
      """
      { "{{field}}": "{{value}}" }
      """
    Then the response status is {{201}}
    And the response "{{field}}" is "{{value}}"

  Scenario: {{refused request}}
    When I POST {APP_URL}/api/{{resource}} with JSON
      """
      { "{{field}}": "{{bad value}}" }
      """
    Then the response status is {{422}}
    And "error.type" is "validation_error"
    And "error.param" is "{{field}}"
    And "error.message" contains "{{message part}}"
```

---

## Feature: {{variant B}}: {{surface}}

{{Only when the project has variants. Same shape as above, with this variant's own fields,
labels, messages and address placeholder.}}

```gherkin
Feature: {{what this variant and surface must do}}

  Background:
    Given the {{variant B}} app is running at {{its address placeholder}}
    And I am signed in to {{variant B}} as {{role}}
```

---

## Known and accepted behaviour (not bugs)

- {{Something a tester would report, and why it's intended.}}

## Clean up

- Delete or archive the `QA …` records you created (in every variant you tested).
- Revoke any QA API keys you created.
