import { test, expect, SECOND } from "./fixtures.js";

const REPO = "https://github.com/nimble-tools/showtimer";
const ISSUES = `${REPO}/issues`;

test.describe("links to the project", () => {
  test("shows a GitHub icon in the top left corner that links to the repo", async ({ page, timer }) => {
    await timer.open();
    const link = page.getByRole("link", { name: "ShowTimer on GitHub" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", REPO);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    const box = await link.boundingBox();
    expect(box.x).toBeLessThan(40);
    expect(box.y).toBeLessThan(40);
  });

  test("opens the repo in a new tab, without leaving the icon focused for a remote", async ({ page, context, timer }) => {
    await context.route(`${REPO}**`, (route) => route.fulfill({ contentType: "text/html", body: "" }));
    await timer.open();
    const link = page.locator("#github-link");

    const [tab] = await Promise.all([context.waitForEvent("page"), link.click()]);

    await expect(tab).toHaveURL(REPO);
    await expect(page).toHaveURL(/127\.0\.0\.1/);
    await expect(link).not.toBeFocused();
  });

  test("keeps the icon hidden while the timer runs, even when the mouse moves", async ({ page, timer }) => {
    await timer.open();
    const link = page.locator("#github-link");

    await timer.click(timer.startPause);
    await timer.expectState("running");
    await expect(link).toBeHidden();

    await timer.advance(4 * SECOND);
    await expect(page.locator("body")).toHaveClass(/controls-hidden/);
    await expect(link).toBeHidden();

    await page.mouse.move(100, 100);
    await page.mouse.move(24, 24);
    await expect(page.locator("body")).not.toHaveClass(/controls-hidden/);
    await expect(timer.configButton).toBeVisible();
    await expect(link).toBeHidden();

    await timer.click(timer.startPause);
    await timer.expectState("paused");
    await expect(link).toBeVisible();
  });

  test("keeps the icon out of the tab order while the timer runs", async ({ page, timer }) => {
    await timer.open();
    const link = page.locator("#github-link");
    await timer.click(timer.startPause);
    await timer.expectState("running");

    await page.evaluate(() => document.getElementById("github-link").focus());
    await expect(link).not.toBeFocused();
  });

  test("asks for bugs and suggestions at the bottom of configuration", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    const note = timer.configDialog.locator(".feedback");
    await expect(note).toContainText("Find a bug? Have a suggestion?");
    const link = note.getByRole("link", { name: ISSUES });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", ISSUES);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("title", "ShowTimer issues on GitHub");
  });

  test("nothing links to the old repo or uses the old name", async ({ page, timer }) => {
    await timer.open();
    const links = await page.locator("a").evaluateAll((anchors) =>
      anchors.map((a) => [a.href, a.textContent, a.title, a.getAttribute("aria-label")].join(" "))
    );
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toContain("showtimer");
      expect(link).not.toMatch(/ardalis|scheduled.timer/i);
    }
  });
});
