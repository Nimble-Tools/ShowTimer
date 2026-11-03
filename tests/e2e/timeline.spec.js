import { test, expect, HOUR, MINUTE, SECOND } from "./fixtures.js";

const GREY = "rgb(43, 47, 54)";
const BLUE = "rgb(58, 123, 213)";
const GREEN = "rgb(18, 184, 41)";
const RED = "rgb(229, 20, 27)";
const AMBER = "rgb(255, 176, 0)";

const DEFAULT_TIMES = ["10:00", "05:00", "02:00", "00:00"];

const section = (timer, id) => timer.timeline.locator(`[data-style-id="${id}"]`);
const band = (timer, id) => section(timer, id).locator(".timeline-band");
const sectionIds = (timer) => timer.timeline.locator("li").evaluateAll((items) => items.map((item) => item.dataset.styleId));
const isOnArrow = async (timer, id) => {
  const [name, shaft] = await Promise.all([
    section(timer, id).locator(".timeline-name").boundingBox(),
    band(timer, id).boundingBox(),
  ]);
  return name.y >= shaft.y && name.y + name.height <= shaft.y + shaft.height;
};
const times = async (timer) => (await timer.timeline.locator(".timeline-time").allTextContents()).filter(Boolean);

test.describe("style timeline", () => {
  test.beforeEach(async ({ timer }) => {
    await timer.open();
  });

  test("shows the default styles at the default duration, including Overtime past zero", async ({ timer }) => {
    await timer.openConfig();

    expect(await sectionIds(timer)).toEqual(["inactive", "starting-soon", "active", "wrap-it-up", "overtime"]);
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
    await expect(timer.timeline.locator(".timeline-name")).toHaveText([
      "Inactive",
      "Starting Soon",
      "Active",
      "Wrap it up!",
      "Overtime",
    ]);
    await expect(band(timer, "inactive")).toHaveCSS("background-color", GREY);
    await expect(band(timer, "starting-soon")).toHaveCSS("background-color", BLUE);
    await expect(band(timer, "active")).toHaveCSS("background-color", GREEN);
    await expect(band(timer, "wrap-it-up")).toHaveCSS("background-color", AMBER);
    await expect(band(timer, "overtime")).toHaveCSS("background-color", RED);
  });

  test("matches what the timer shows either side of each marker, until it stops", async ({ timer }) => {
    await timer.openConfig();
    await timer.editStyle("Overtime");
    await timer.styleStart.fill("-5"); // So Inactive returns before the timer stops.
    await timer.styleDone.click();

    const ids = await sectionIds(timer);
    const markers = await times(timer);
    expect(ids).toEqual(["inactive", "starting-soon", "active", "wrap-it-up", "overtime", "inactive"]);
    expect(markers).toEqual([...DEFAULT_TIMES, "-05:00"]);
    await timer.saveConfig();

    const clockMs = (text) => {
      const [minutes, seconds] = text.replace("-", "").split(":").map(Number);
      return (text.startsWith("-") ? -1 : 1) * (minutes * MINUTE + seconds * SECOND);
    };
    await timer.scheduleAt("10:30"); // 35 minutes from zero, with the default 5 minute talk.
    let remaining = 35 * MINUTE;
    const goTo = async (ms) => {
      await timer.jump(remaining - ms);
      remaining = ms;
    };
    for (const [i, marker] of markers.entries()) {
      const at = clockMs(marker);
      // Down to zero a style takes over at its marker; over time, just after it.
      const lastOfPrevious = at >= 0 ? at + SECOND : at;
      await goTo(lastOfPrevious);
      await timer.expectStyle(ids[i]);
      await goTo(lastOfPrevious - SECOND);
      await timer.expectStyle(ids[i + 1]);
    }
    await goTo(-HOUR);
    await timer.expectState("stopped");
    await timer.expectStyle(ids.at(-1));
  });

  test("draws an arrow with markers, break marks, and widths that aren't to scale", async ({ timer }) => {
    await timer.openConfig();
    const sections = timer.timeline.locator("li");

    // A marker at each change, but not before the lead-in.
    await expect(sections.first()).toHaveCSS("border-left-style", "none");
    await expect(section(timer, "starting-soon")).toHaveCSS("border-left-style", "solid");
    await expect(section(timer, "overtime")).toHaveCSS("border-left-style", "solid");

    // Only the last section has the arrowhead, which comes to a point at the end of its box.
    const clip = (id) => band(timer, id).evaluate((element) => getComputedStyle(element).clipPath);
    expect(await clip("overtime")).toContain("100% 50%");
    expect(await clip("active")).not.toContain("100% 50%");

    // Sections cut short have a break mark, and others don't.
    const breakMark = (id) =>
      band(timer, id).evaluate((element) => getComputedStyle(element, "::after").content);
    expect(await breakMark("inactive")).not.toBe("none");
    expect(await breakMark("overtime")).not.toBe("none");
    expect(await breakMark("active")).toBe("none");

    // Longer sections are wider, though an hour isn't 30 times 2 minutes.
    const width = async (id) => (await section(timer, id).boundingBox()).width;
    const [wrap, soon, over] = [await width("wrap-it-up"), await width("starting-soon"), await width("overtime")];
    expect(soon).toBeGreaterThan(wrap);
    expect(over).toBeGreaterThan(soon);
    expect(over).toBeLessThan(wrap * 4);
  });

  test("puts names on the arrow in the font and color of their style", async ({ page, timer }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await timer.openConfig();
    const name = (id) => section(timer, id).locator(".timeline-name");

    // Whether "Wrap it up!" fits depends on how wide the system's sans serif is.
    for (const id of ["inactive", "starting-soon", "active", "overtime"]) {
      expect(await isOnArrow(timer, id)).toBe(true);
    }
    await expect(name("starting-soon")).toHaveCSS("font-family", /Caveat/);
    await expect(name("starting-soon")).toHaveCSS("font-weight", "700");
    await expect(name("overtime")).toHaveCSS("font-family", /Bangers/);
    await expect(name("inactive")).toHaveCSS("color", "rgb(154, 163, 173)");
    await expect(name("active")).toHaveCSS("color", "rgb(255, 255, 255)");

    await timer.editStyle("Active");
    await timer.styleColor.fill("#112233");
    await timer.styleFont.selectOption("serif");
    await timer.styleDone.click();
    await expect(name("active")).toHaveCSS("color", "rgb(17, 34, 51)");
    await expect(name("active")).toHaveCSS("font-family", /Georgia/);
  });

  test("keeps names clear of the break mark and arrowhead", async ({ page, timer }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await timer.openConfig();
    const textBounds = (id) =>
      section(timer, id).evaluate((item) => {
        const range = document.createRange();
        range.selectNodeContents(item.querySelector(".timeline-name"));
        const { left, right } = range.getBoundingClientRect();
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const band = item.querySelector(".timeline-band").getBoundingClientRect();
        return { fromStart: (left - band.left) / rem, fromEnd: (band.right - right) / rem };
      });

    expect((await textBounds("inactive")).fromStart).toBeGreaterThanOrEqual(1.29);
    const overtime = await textBounds("overtime");
    expect(overtime.fromStart).toBeGreaterThanOrEqual(1.29);
    expect(overtime.fromEnd).toBeGreaterThanOrEqual(1.24);
  });

  test("keeps a name under the arrow when it wouldn't fit, or has no style", async ({ page, timer }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await timer.openConfig();
    await timer.editStyle("Active");
    await timer.styleName.fill("A much longer name than this section has room for");
    await timer.styleDone.click();
    expect(await isOnArrow(timer, "active")).toBe(false);
    await expect(section(timer, "active").locator(".timeline-name")).toHaveCSS("color", await timer.configDialog.evaluate((dialog) => getComputedStyle(dialog).color));
    expect(await isOnArrow(timer, "overtime")).toBe(true);

    await timer.styleToggle("Inactive").uncheck();
    expect(await isOnArrow(timer, "")).toBe(false);
  });

  test("measures names again when a font loads, as it can change their width", async ({ page, timer }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await timer.openConfig();
    expect(await isOnArrow(timer, "overtime")).toBe(true);

    await page.addStyleTag({ content: ".timeline-name { font-size: 5rem !important; }" });
    await page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone")));
    expect(await isOnArrow(timer, "overtime")).toBe(false);
  });

  test("gives screen readers the whole timeline as text", async ({ timer }) => {
    await timer.openConfig();
    const list = timer.configDialog.getByRole("list", { name: "Style timeline" });
    await expect(list).toHaveAccessibleDescription(/not to scale/);
    await expect(list.getByRole("listitem")).toHaveText([
      /Inactive: before 10:00\./,
      /Starting Soon: from 10:00 to 05:00\./,
      /Active: from 05:00 to 02:00\./,
      /Wrap it up!: from 02:00 to 00:00\./,
      /Overtime: from 00:00 until the timer stops at -01:00:00\./,
    ]);
    // The visible labels would only repeat the descriptions.
    const labels = timer.timeline.locator(".timeline-time, .timeline-name");
    expect(await labels.evaluateAll((all) => all.every((label) => label.getAttribute("aria-hidden") === "true"))).toBe(true);
  });

  test("follows the duration as it's typed, and ignores invalid values", async ({ timer }) => {
    await timer.openConfig();
    await timer.configDuration.fill("20");
    expect(await times(timer)).toEqual(["25:00", "20:00", "02:00", "00:00"]);
    await timer.configDuration.fill("0");
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
  });

  test("follows a style being disabled and enabled", async ({ timer }) => {
    await timer.openConfig();
    await timer.styleToggle("Wrap it up!").uncheck();
    expect(await sectionIds(timer)).toEqual(["inactive", "starting-soon", "active", "overtime"]);
    expect(await times(timer)).toEqual(["10:00", "05:00", "00:00"]);
    await timer.styleToggle("Wrap it up!").check();
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
  });

  test("follows edits that aren't saved, and drops them on cancel", async ({ timer }) => {
    await timer.openConfig();
    await timer.editStyle("Wrap it up!");
    await timer.styleStart.fill("3");
    await timer.styleBackground.fill("#112233");
    await timer.styleName.fill("Hurry");
    await timer.styleDone.click();

    expect(await times(timer)).toEqual(["10:00", "05:00", "03:00", "00:00"]);
    await expect(band(timer, "wrap-it-up")).toHaveCSS("background-color", "rgb(17, 34, 51)");
    await expect(section(timer, "wrap-it-up").locator(".timeline-name")).toHaveText("Hurry");

    await timer.configCancel.click();
    await timer.openConfig();
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
    await expect(band(timer, "wrap-it-up")).toHaveCSS("background-color", AMBER);
  });

  test("follows a custom style with an expression start being added and deleted", async ({ timer }) => {
    await timer.openConfig();
    await timer.addStyle.click();
    await timer.styleName.fill("Tenth");
    await timer.styleStart.fill("$duration / 10");
    await timer.styleDone.click();
    expect(await times(timer)).toEqual(["10:00", "05:00", "02:00", "00:30", "00:00"]);
    await expect(timer.timeline.locator(".timeline-name").nth(4)).toHaveText("Tenth");

    await timer.editStyle("Tenth");
    await timer.styleDelete.click();
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
  });

  test("ignores an expression with no value at the duration being typed", async ({ timer }) => {
    await timer.openConfig();
    await timer.configDuration.fill("6");
    await timer.addStyle.click();
    await timer.styleName.fill("Odd");
    await timer.styleStart.fill("1 / ($duration - 5)");
    await timer.styleDone.click();
    expect(await times(timer)).toEqual(["11:00", "06:00", "02:00", "01:00", "00:00"]);

    await timer.configDuration.fill("5");
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
    await expect(timer.timeline.locator(".timeline-name", { hasText: "Odd" })).toHaveCount(0);
  });

  test("follows the theme being chosen", async ({ timer }) => {
    await timer.openConfig();
    await timer.styleToggle("Wrap it up!").uncheck();
    await timer.themeName.fill("Short");
    await timer.themeSave.click();
    await timer.themeSelect.selectOption({ label: "Default" });
    expect(await times(timer)).toEqual(["10:00", "05:00", "00:30", "00:00"]);
    await timer.themeSelect.selectOption({ label: "Short" });
    expect(await times(timer)).toEqual(["10:00", "05:00", "00:00"]);
  });

  test("shows a fade as a gradient from where it begins", async ({ page, timer }) => {
    await timer.openConfig();
    await timer.editStyle("Active");
    await page.locator("#effect-type").selectOption("fade");
    await page.locator("#add-effect").click();
    await timer.effectList.locator(".effect-start").fill("90");
    await timer.styleDone.click();

    await expect(band(timer, "active")).toHaveCSS("background-image", `linear-gradient(to right, ${GREEN} 50%, ${AMBER})`);
    await expect(section(timer, "active")).toContainText("Active: from 05:00 to 02:00, fading toward Wrap it up!.");
    await expect(band(timer, "wrap-it-up")).toHaveCSS("background-image", "none");
  });

  test("marks sections cut short, and shows where no style applies", async ({ timer }) => {
    await timer.openConfig();
    await expect(band(timer, "inactive")).toHaveClass(/is-cut/);
    await expect(band(timer, "overtime")).toHaveClass(/is-cut/);
    await expect(band(timer, "active")).not.toHaveClass(/is-cut/);

    await timer.styleToggle("Inactive").uncheck();
    await expect(band(timer, "")).toHaveClass(/is-unstyled/);
    await expect(section(timer, "").locator(".timeline-name")).toHaveText("No style");
    await expect(section(timer, "")).toContainText("No style: before 10:00.");
  });
});

test.describe("style timeline at phone width", () => {
  const overflow = (locator) => locator.evaluate((element) => element.scrollWidth - element.clientWidth);

  test("fits the defaults, with the times and names inside their sections", async ({ page, timer }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await timer.open();
    await timer.openConfig();

    expect(await overflow(timer.timeline)).toBeLessThanOrEqual(0);
    const fits = await timer.timeline.locator("li").evaluateAll((items) =>
      items.every((item) => {
        const inside = (label) => label.getBoundingClientRect().right <= item.getBoundingClientRect().right + 0.5;
        const name = item.querySelector(".timeline-name");
        const range = document.createRange();
        range.selectNodeContents(item.querySelector(".timeline-time"));
        return inside(name) && name.scrollWidth <= name.clientWidth && inside(range);
      })
    );
    expect(fits).toBe(true);
  });

  test("moves names under the arrow when the window narrows, and back when it widens", async ({ page, timer }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await timer.open();
    await timer.openConfig();
    expect(await isOnArrow(timer, "overtime")).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => isOnArrow(timer, "overtime")).toBe(false);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => isOnArrow(timer, "overtime")).toBe(true);
  });

  test("scrolls sideways rather than widening the dialog when there are too many", async ({ page, timer }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await timer.open();
    await timer.openConfig();
    for (const minutes of [1.5, 1, 0.5, -1, -2, -3]) {
      await timer.addStyle.click();
      await timer.styleName.fill(`Style at ${minutes}`);
      await timer.styleStart.fill(String(minutes));
      await timer.styleDone.click();
    }
    expect(await overflow(timer.timeline)).toBeGreaterThan(0);
    expect(await overflow(timer.configDialog)).toBeLessThanOrEqual(0);

    // It can be scrolled from the keyboard.
    await timer.timeline.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => timer.timeline.evaluate((list) => list.scrollLeft)).toBeGreaterThan(0);
  });
});
