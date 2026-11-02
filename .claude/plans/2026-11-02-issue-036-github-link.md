# Issue #36: Add a link to the GitHub repo

https://github.com/Nimble-Tools/ShowTimer/issues/36

Link to https://github.com/nimble-tools/showtimer from the app. #26 asked for this, but its merge (PR #29, commit 0abde1e on `feature/github-link`) went into `feature/sounds` and never reached `main`.

## Assumptions

- **"Stays hidden while the timer runs" is stricter than 0abde1e.** That commit hid the icon only with the other controls, so it stayed visible for the first seconds of a run and came back on any mouse move. Here the icon is hidden for the whole of the `running` state, and also whenever the controls are hidden. It shows again when paused, stopped, or idle.
- **The configuration note's link text stays the URL**, as #26 asked. Its `title` carries the ShowTimer name, so the label criterion holds without hiding the URL behind other text.
- **A mouse click on the icon doesn't leave it focused.** This matches the rule for the other controls: a presentation remote's Enter would otherwise reopen GitHub.
- **The existing "Scheduled Timer" names are out of scope** (page title, theme file errors, storage keys, the Cloudflare project). The issue only covers what this change adds.
- **The 0abde1e changes are reapplied by hand** on current `main`, as the branch is well behind it.
- **The verify command is `npm test`.** The workflow's default is a `dotnet` command, and this repo has no .NET project or formatter. `npm test` is what CI runs.

## Phase 1: Links

- [ ] Add the icon and the configuration note to `public/index.html`
- [ ] Style both in `public/styles.css`, hiding the icon while running or when the controls hide
- [ ] Blur the icon after a mouse click in `public/app.js`
- [ ] Mention the links in the README's feature list and test summary

## Phase 2: Automated tests

No logic moves into a core module, so there are no new unit tests. E2E tests go in `tests/e2e/links.spec.js`:

- [ ] Icon: top left, ShowTimer label, repo href, `target` and `rel`
- [ ] Icon: a real click opens the repo in a new tab and doesn't leave the icon focused
- [ ] Icon: hidden from the moment the timer starts, through mouse moves and over time, unreachable by keyboard, and back when paused
- [ ] Note: the text, the issues href, new tab, and the ShowTimer label
- [ ] Nothing rendered refers to `ardalis/scheduled-timer`

## Phase 3: Independent review

- [ ] Review the full diff with a separate agent, including security, performance, and accessibility
- [ ] Address all significant findings, or record why not

## Phase 4: Final verification

- [ ] `npm test` passes after the last code change
- [ ] Check the page at desktop and phone widths
- [ ] Open a PR with `Fixes #36`
