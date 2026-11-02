# Issue #37: Show styles on a horizontal timeline

https://github.com/Nimble-Tools/ShowTimer/issues/37

Show the styles as a thick horizontal arrow in the Styles section of Configuration, so it's easy to see what the timer will look like at each point in a talk.

## Open questions: decisions

The issue asks for these to be answered on the issue, so they're posted there too.

1. **Scale:** not to scale. Widths grow with the square root of a section's length, with a minimum width so names fit. Sections over 10 minutes stop growing and get a break mark, as does the open-ended lead-in. A hint under the arrow says it isn't to scale.
2. **Ends of the arrow:** the lead-in is a fixed width with a break mark, because it has no real length. The arrow ends where the timer stops, an hour over. With the defaults Overtime still applies there, so the arrowhead stays in the Overtime color. A trailing Inactive section appears only if the timer would really show it, such as when the last over-time style starts at -5.
3. **Placement:** only in the Styles section of Configuration, above `#style-list`.
4. **Interaction:** display-only. The list directly below already opens each style, and clickable sections would add a second tab stop for every style.
5. **Fade effects:** a section with an enabled fade shows a gradient, starting at the point the fade begins, because that's what the timer does.

## Assumptions

- Names sit under the arrow rather than on it. A style's own text color isn't always readable at small sizes (white on the default green is about 2.6:1), and a style's colors can be anything.
- The timeline uses the presentation duration in Configuration. A talk with its own duration can move relative starts, as it already does for the times in the style list.
- If no style applies to part of the arrow (Inactive disabled), that part is shown hatched and labelled "No style".
- A style's changes appear in the timeline when its editor's Done is pressed, like the style list.

## Phase 1: Core logic and tests

- [x] Add `styleTimeline(styles, durationMinutes)` to `public/styles-core.js`, walking `resolveStyle` so it can't disagree with the timer
- [x] Unit tests (`tests/unit/styles-core.test.js`): section order and marker times for the defaults, disabled styles, expression starts, undefined expressions, a style at zero, tied starts, no fallback, trailing fallback, starts past the stop, widths and break marks, fades

## Phase 2: UI

- [x] Add the list and hint to `public/index.html`
- [x] Render from `renderList` in `public/style-editor.js`, so every draft change updates it
- [x] Style it in `public/styles.css`, including phone width and a text alternative
- [x] E2E tests (`tests/e2e/styles.spec.js`): defaults, live updates from duration, start, color, enabled, and themes, unsaved edits, expressions, fade gradient, phone width, text alternative
- [x] Mention it in the README's feature list

## Phase 3: Independent review

- [x] Review the full diff with a separate agent, including security, performance, and accessibility
- [x] Address all significant findings, or record why not

## Phase 4: Verification

- [x] Run `npm test` (unit, e2e, coverage). The configured default verify command is for .NET and doesn't apply to this repo.
