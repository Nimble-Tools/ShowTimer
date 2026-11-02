# Issue #35: How styles behave when the talk is no longer than the style's start

https://github.com/Nimble-Tools/ShowTimer/issues/35

The decisions come from [the comment on the issue](https://github.com/Nimble-Tools/ShowTimer/issues/35#issuecomment-6587225729).

## Decisions

1. **Before the start:** a style meant for the end of a talk never shows before the talk begins.
2. **During the talk:** a style whose start is at or past the duration takes over from the first second only if it's the closest to zero. Otherwise it doesn't show.
3. **Ties:** list order decides.
4. **Scope:** the rule covers all styles, built-in and custom, with no new per-style setting.
5. **Configuration:** warn when a style can't apply as expected at the current duration.

Making Wrap it up! `$duration / 10` belongs to #41, so it isn't part of this change.

## Results with the default styles

| Duration | Before the start | While the talk runs |
| --- | --- | --- |
| 5 min | Starting Soon | Active, then Wrap it up! from 2:00 |
| 2 min (equal) | Starting Soon | Active only, as it's first in the list |
| 1.5 min (shorter) | Starting Soon | Active only, as it's closer to zero |
| 1 min (shorter) | Starting Soon | Active only, as it's closer to zero |

With Active disabled, Wrap it up! covers the whole of a 1-minute talk.

## Assumptions

- **Which styles can show before the start:** those whose start is the duration plus or minus a fixed number of minutes, either with "plus the presentation duration" or an expression like `$duration + 5`. Those are measured from the start of the talk, like Starting Soon. Everything else is measured from the end of the talk.
- **The issue's "doors open" constraint gives way to decision 4.** A fixed 30-minute start on a 5-minute talk can't be told apart from Wrap it up! at 2 minutes on a 1-minute talk, and the decision was no setting and the same rule for all. That use keeps working as `duration + 25`, and a style still set the old way gets a warning. This changes behavior for anyone with such a style saved.
- **Other expressions, such as `$duration * 2`, count as measured from the end,** so they don't show before the start and get a warning.
- **A style that takes over runs from the talk's start for its effects,** so a fade or strobe times from when it really begins, not from its stored start.
- **Warnings appear in the style's row and in its editor,** as text. There are four: no value at this duration, won't show because other styles cover its time, starts with the talk rather than at its stored start, and applies over time because a start relative to the duration went past zero.

## Phase 1: Style rule

- [x] In `resolveStyle`, treat a start past the duration as starting with the talk, unless it's measured from the start of the talk
- [x] Between such styles, and against a style really starting there, the closer stored start wins, then list order
- [x] Unit tests in `tests/unit/styles-core.test.js`, replacing the old fixed-start "doors open" test with `duration + 25`: the 1, 1.5, 2, and 5-minute cases before and during the talk, take-over with Active disabled, closest of two past the duration, ties in both list orders, custom styles, relative and expression starts, and spans for effects
- [x] Unit test that the timeline agrees (`tests/unit/style-timeline.test.js`)
- [x] E2E tests in `tests/e2e/styles.spec.js`: a scheduled 1-minute talk and a 2-minute talk on the real page

## Phase 2: Configuration warning

- [x] Add `styleWarnings` to `public/styles-core.js`, with unit tests for each warning and for no warnings on the defaults
- [x] Show warnings in the style list and editor, as text available to screen readers
- [x] E2E tests: warnings follow the typed duration, enabled state, and edits, and are absent at the default duration

## Phase 3: Docs

- [x] Describe the rule in the README's description of styles, and in the hint in configuration
- [x] Record the decision on the issue

## Phase 4: Independent review

- [x] Review the full diff with a separate agent, including security, performance, and accessibility
- [x] Address all significant findings, or record why not

## Phase 5: Final verification

- [x] `npm test` passes after the last code change (the workflow's default `dotnet` command doesn't apply here)
- [x] Check the warning at desktop and phone widths
- [ ] Open a PR with `Fixes #35`

## Review findings not addressed

- **Warnings use the configuration's duration, not a scheduled talk's own.** With the configuration at 5 minutes and a scheduled 1-minute talk, nothing warns that Wrap it up! won't show. The comment says "the current duration", and the style list and timeline both use the configuration's, so all three stay consistent. Warning per talk would be a larger change, best made to all three together.
- **A saved fixed-start "doors open" style changes behavior with no migration.** It follows from decisions 1 and 4, since a stored style doesn't say what it's for. It gets a warning, but only when configuration is opened. The PR and the issue call this out for confirmation.
- **Editing the duration during a run changes styles at once,** though the dialog says the new duration applies on reset. `main` already does this. This branch adds one more case: shortening a run below the time left shows Starting Soon rather than Wrap it up!. The cause is `state.durationMs` changing mid-run, which is a separate bug.
- **The editor can say "Starts at 2 min" directly above "Won't show".** The first line still reports what the start evaluates to, which matters for expressions, and the warning right below it explains the rest.
- **Warnings in the style list aren't announced as the duration is typed.** A live region would speak on every keystroke. They're read as each row's description, and the editor's warning is announced.
- **No test covers the warning's color or layout.** A review measured its contrast at 9.08:1 and 11.35:1, and checked the layout at 1280px and 360px.
