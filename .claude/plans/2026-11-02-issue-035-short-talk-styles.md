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
- **Warnings appear in the style's row and in its editor,** as text. There are three: no value at this duration, won't show because other styles cover its time, and starts with the talk rather than at its stored start.

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
- [ ] Record the decision on the issue

## Phase 4: Independent review

- [ ] Review the full diff with a separate agent, including security, performance, and accessibility
- [ ] Address all significant findings, or record why not

## Phase 5: Final verification

- [ ] `npm test` passes after the last code change (the workflow's default `dotnet` command doesn't apply here)
- [ ] Check the warning at desktop and phone widths
- [ ] Open a PR with `Fixes #35`
