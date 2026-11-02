# Issue #33: Fade effect should run for the full duration of its style

https://github.com/Nimble-Tools/ShowTimer/issues/33

> I tested the fade effect and it seemed to only do the fade at the end of the duration. The idea was that this effect would gradually occur for the full duration of the scene it's attached to. So if the Active scene is at 5 min and the Wrap it up scene is at 1 minute then for 4 minutes the Active scene would be slowly transitioning.

## Findings

The reported scenario does **not** reproduce on current `main`. Production serves files identical to `main`, and the fade logic has not changed since before the issue was filed.

Measured with Active at 5 minutes, Wrap it up at 1 minute, and a fade on Active:

- Fake clock, set up through the real editor: the background moves evenly (`#12b829`, `#4db61f`, `#89b414`, `#c4b20a`, `#ffb000` at each minute).
- Scheduled talk with its own duration, and Active at a fixed 5 minutes: same values.
- Real clock, compressed to a 45 second fade: computed background and text color are proportional throughout, confirmed in a screenshot.

Two real defects do break "gradually for the full duration":

1. **Pausing mid-fade snaps back to the unfaded style**, then jumps forward again on resume.
2. **A fade on a style over time never fades.** The next-style lookup at the end of the span finds the same style, because a style over time still applies at its own start.

## Assumptions

- The issue's symptom can't be confirmed, so the PR uses `Relates to #33`, leaving the reporter to close it once they've retested.
- A fade is a position in the style's span, not an animation, so it holds while paused. A strobe still stops while paused.
- The style after the last over-time style is the fallback (Inactive), matching what `resolveStyle` shows past that point.

## Phase 1: Tests first

- [x] Unit: next-style lookup before zero, at zero, over time, and with no fallback (`tests/unit/styles-core.test.js`)
- [x] E2E: characterization test for the issue's scenario, proportional across the full span (it also passes on `main`, so it guards against an end-only fade rather than proving a fix) (`tests/e2e/effects.spec.js`)
- [x] E2E: a fade holds while paused (before zero and over time) and continues on resume, while a strobe on the same style stops; a finished fade holds when the timer stops
- [x] E2E: a fade on Overtime blends toward Inactive

## Phase 2: Fixes

- [x] Add `styleAfter` to `public/styles-core.js` and use it in `renderStyle`
- [x] Hold the fade while paused in `currentEffects` (`public/app.js`)
- [x] Update the comments and the README

## Phase 3: Independent review

- [x] Review the full diff with a separate agent, including security, performance, and accessibility
- [x] Address all significant findings, or record why not

## Phase 4: Verification

- [x] Run `npm test` (unit, e2e, coverage). The configured default verify command is for .NET and doesn't apply to this repo.

## Review findings

Addressed:

- A fade on the default Overtime reached Inactive, then snapped back to full red when the timer stopped. A stopped timer now holds its fade like a paused one, with an e2e test.
- Test gaps: added a strobe and fade on one style, a pause over time, reaching `stopped`, chains of over-time styles, a disabled next style, and a style starting at zero. The issue-scenario test is now described as characterization.

Deliberately not addressed:

- **Readout contrast mid-fade (significant, pre-existing).** Text and background blend independently, so with the default Active and Wrap it up! colors the contrast falls to about 1.0:1 midway, with about 65 seconds of a 4 minute fade under 1.5:1. Holding the fade while paused can keep that frame on screen for as long as the pause lasts. A contrast floor changes how every fade looks and the default colors already sit near common thresholds (white on Active is about 2.6:1), so it's a design decision for its owner rather than part of this fix.
- **A style whose start is longer than the duration begins partly faded (minor, pre-existing).** With Active fixed at 5 minutes, Wrap it up! at 2, and a 3 minute talk, the first frame is 67% faded. Fixing it means recording where each run first showed the style, which also has to survive reloads. Left until the reporter confirms this is what they hit.
