import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../constants/test-users";

test.describe("Permissions", () => {
  test("regular user can access basic functionality", async ({ browser }) => {
    // Create context with regular user auth
    const context = await browser.newContext({
      storageState: TEST_USERS.regular.authFile,
    });
    const page = await context.newPage();

    // Regular users might access through profile/settings
    // Test basic navigation works
    await page.goto("/");

    // Check if user has access to basic functionality
    await page.waitForLoadState("networkidle");
    const url = page.url();
    expect(url).not.toContain("/sign-in");

    await context.close();
  });

  test("editor user can access application but not admin panel", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.editor.authFile,
    });
    const page = await context.newPage();

    // Editor should have access to main app
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const homeUrl = page.url();
    expect(homeUrl).not.toContain("/sign-in");

    // But should not have access to admin panel
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("You are unauthorized", { exact: false }),
    ).toBeVisible();
  });

  test("regular user cannot access admin panel", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.regular.authFile,
    });
    const page = await context.newPage();

    // But should not have access to admin panel
    await page.goto("/admin/users");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByText("You are unauthorized", { exact: false }),
    ).toBeVisible();

    await context.close();
  });
  test("ensure admin toolbar links are visible to admin", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.admin.authFile,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check both admin links in toolbar
    await expect(page.getByTestId("toolbar-link-providers")).toBeVisible();
    await expect(page.getByTestId("toolbar-link-users")).toBeVisible();
    await context.close();
  });
  test("ensure admin toolbar links are not visible to editor", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.editor.authFile,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that admin links are not visible in toolbar
    await expect(page.getByTestId("toolbar-link-providers")).not.toBeVisible();
    await expect(page.getByTestId("toolbar-link-users")).not.toBeVisible();
    await context.close();
  });
  test("ensure admin toolbar links are not visible to regular user", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.regular.authFile,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that admin links are not visible in toolbar
    await expect(page.getByTestId("toolbar-link-providers")).not.toBeVisible();
    await expect(page.getByTestId("toolbar-link-users")).not.toBeVisible();
    await context.close();
  });
  test("ensure admin toolbar links navigate correctly", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: TEST_USERS.admin.authFile,
    });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test users link
    await page.getByTestId("toolbar-link-users").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/admin/users");

    // Test providers link
    await page.getByTestId("toolbar-link-providers").click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/admin/providers");

    await context.close();
  });
});
