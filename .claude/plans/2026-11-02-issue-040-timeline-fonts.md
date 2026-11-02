# Issue #40: Timeline fonts

https://github.com/Nimble-Tools/ShowTimer/issues/40

Where there's room, put each style's name on the timeline arrow, in the font and color the style uses when active.

## Assumptions

- "The text" is the style's name. The times stay above the arrow, at their markers.
- "Same font and color" covers the family, weight, color, and text shadow. Not the size, which is a share of the window on the timer and has to fit a 1.5rem shaft here.
- There's room if the name fits on one line in the shaft, clear of the break mark and arrowhead. Otherwise it stays under the arrow as before.
- "No style" has no font or color of its own, so it stays under the arrow.
- Contrast follows the style, as asked, which replaces the earlier decision in the #37 plan to keep names off the arrow for readability. Screen readers still get the description, and the name keeps its title.

## Tasks

- [x] Place names in `public/style-editor.js`, measuring after each render, on window resize, and when fonts load
- [x] Render the configuration dialog's list after it shows, since a hidden dialog has nothing to measure
- [x] Style them in `public/styles.css`, moving the break mark to the start of a section to leave room
- [x] E2E tests in `tests/e2e/timeline.spec.js`: font and color, live edits, clear of the break and arrowhead, too long, no style, window resizing
- [x] Mention it in the README
- [x] Run `npm test`
