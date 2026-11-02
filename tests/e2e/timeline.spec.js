import { test, expect, MINUTE } from "./fixtures.js";

const GREY = "rgb(43, 47, 54)";
const BLUE = "rgb(58, 123, 213)";
const GREEN = "rgb(18, 184, 41)";
const RED = "rgb(229, 20, 27)";
const AMBER = "rgb(255, 176, 0)";

const DEFAULT_TIMES = ["10:00", "05:00", "02:00", "00:00"];

const section = (timer, id) => timer.timeline.locator(`[data-style-id="${id}"]`);
const band = (timer, id) => section(timer, id).locator(".timeline-band");
const sectionIds = (timer) => timer.timeline.locator("li").evaluateAll((items) => items.map((item) => item.dataset.styleId));
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

  test("matches what the timer shows either side of each marker", async ({ timer }) => {
    await timer.scheduleAt("10:30"); // 35 minutes from zero, with the default 5 minute talk.
    await timer.jump(25 * MINUTE - 1000);
    await timer.expectStyle("inactive");
    await timer.advance(1000); // 10:00
    await timer.expectStyle("starting-soon");
    await timer.jump(5 * MINUTE - 1000);
    await timer.expectStyle("starting-soon");
    await timer.advance(1000); // 05:00
    await timer.expectStyle("active");
    await timer.jump(3 * MINUTE - 1000);
    await timer.expectStyle("active");
    await timer.advance(1000); // 02:00
    await timer.expectStyle("wrap-it-up");
    await timer.jump(2 * MINUTE - 1000);
    await timer.expectStyle("wrap-it-up");
    await timer.advance(1000); // 00:00
    await timer.expectStyle("overtime");
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
    expect(await times(timer)).toEqual(DEFAULT_TIMES);
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
