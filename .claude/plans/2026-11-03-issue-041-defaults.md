# Issue #41: Defaults

https://github.com/Nimble-Tools/ShowTimer/issues/41

> Update the default time to 1 hour.
> Change the Wrap It Up time to (duration)/10. Give it a fade transition by default leading to the red over time style.

## Decisions

- **Saved settings aren't migrated.** Only new defaults change. Anyone with saved settings keeps their duration and Wrap it up!, and sees "Default (modified)" until they choose Default again.
- **Text doesn't blend during a fade.** Dark text fading to white on amber fading to red drops to about 1.0:1 contrast midway, and below 3:1 for 57% of the fade, which is about 3.4 minutes of the last 6 in an hour talk. The text now uses whichever style's color reads better, with a minimum of about 4.2:1 on this fade. This is the contrast problem the #33 plan left to its owner, and it applies to every fade.
- **Wrap it up! now shows in every talk,** since a tenth of the duration is always within it. The rules for a fixed start past the duration still apply to custom styles and saved settings, so their tests now use a fixed Wrap it up!.

## Tasks

- [x] Set `DEFAULT_MINUTES` to 60 in `public/timer-core.js`
- [x] Start Wrap it up! at `$duration / 10` in `public/styles-core.js`
- [x] Fade Wrap it up! by default, and pick readable text during a fade, in `public/effects-core.js`
- [x] Unit tests: new defaults, contrast through the default fade, and a fixed Wrap it up! for start rules
- [x] E2E: start from stored settings unless a test is about a first visit, and test the default fade
- [x] Update the README
- [x] Run `npm test`
