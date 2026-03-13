import { test, expect } from "@playwright/test";
import {
  clickAndWaitForNavigation,
  openDropdown,
  selectDropdownOption,
} from "../utils/test-helpers";
import { TEST_USERS } from "../constants/test-users";

// Test names to ensure uniqueness across test runs
const testSuffix =
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const publicAgentName = `Public Agent ${testSuffix}`;
const privateAgentName = `Private Agent ${testSuffix}`;

test.describe.configure({ mode: "serial" });

test.describe("Agent Visibility and Sharing Between Users", () => {
  test.beforeAll(
    "editor creates agents with different visibility levels",
    async ({ browser }) => {
      // Use admin to set up test agents with different visibility levels
      const editorContext = await browser.newContext({
        storageState: TEST_USERS.editor.authFile,
      });
      const editorPage = await editorContext.newPage();

      try {
        // Create public agent
        await editorPage.goto("/agent/new");
        await editorPage.waitForLoadState("networkidle");

        await editorPage.getByTestId("agent-name-input").fill(publicAgentName);
        await editorPage
          .getByTestId("agent-description-input")
          .fill("This is a public agent that anyone can see and edit");
        await clickAndWaitForNavigation(
          editorPage,
          "agent-save-button",
          "**/agents",
        );

        // Edit to set visibility to public
        await editorPage
          .locator(`main a:has-text("${publicAgentName}")`)
          .first()
          .click();
        await editorPage.waitForURL("**/agent/**", { timeout: 10000 });

        // Open visibility dropdown and select public
        await openDropdown(editorPage, "visibility-button");
        await selectDropdownOption(editorPage, "visibility-public");

        await clickAndWaitForNavigation(
          editorPage,
          "agent-save-button",
          "**/agents",
        );
        await editorPage.waitForLoadState("networkidle");

        // Create private agent (default is private)
        await editorPage.goto("/agent/new");
        await editorPage.waitForLoadState("networkidle");
        await editorPage.getByTestId("agent-name-input").fill(privateAgentName);
        await editorPage
          .getByTestId("agent-description-input")
          .fill("This is a private agent that only owner can see");
        await clickAndWaitForNavigation(
          editorPage,
          "agent-save-button",
          "**/agents",
        );
      } finally {
        await editorContext.close();
      }
    },
  );

  test("different user can see public agents but not private", async ({
    browser,
  }) => {
    // Create second user context (using editor auth, but role doesn't matter for sharing)
    const secondUserContext = await browser.newContext({
      storageState: TEST_USERS.editor2.authFile,
    });
    const secondUserPage = await secondUserContext.newPage();

    try {
      await secondUserPage.goto("/agents");
      await secondUserPage.waitForLoadState("networkidle");

      // Should see the public agent
      const publicAgent = secondUserPage.locator(
        `[data-testid="agent-card-name"]:has-text("${publicAgentName}")`,
      );
      await expect(publicAgent).toBeVisible({ timeout: 10000 });

      // Should NOT see the private agent
      const privateAgent = secondUserPage.locator(
        `[data-testid="agent-card-name"]:has-text("${privateAgentName}")`,
      );
      await expect(privateAgent).not.toBeVisible();
    } finally {
      await secondUserContext.close();
    }
  });

  test("different user can edit public agent", async ({ browser }) => {
    // Create second user context (using editor auth, but role doesn't matter for sharing)
    const secondUserContext = await browser.newContext({
      storageState: TEST_USERS.editor2.authFile,
    });
    const secondUserPage = await secondUserContext.newPage();

    try {
      await secondUserPage.goto("/agents");
      await secondUserPage.waitForLoadState("networkidle");

      // Click on the public agent
      await secondUserPage
        .locator(`main a:has-text("${publicAgentName}")`)
        .first()
        .click();
      await secondUserPage.waitForURL("**/agent/**", { timeout: 10000 });

      // Should be able to see and modify the form fields
      const nameInput = secondUserPage.getByTestId("agent-name-input");
      const descriptionInput = secondUserPage.getByTestId(
        "agent-description-input",
      );
      const saveButton = secondUserPage.getByTestId("agent-save-button");

      await expect(nameInput).toBeVisible();
      await expect(nameInput).toBeEnabled();
      await expect(descriptionInput).toBeVisible();
      await expect(descriptionInput).toBeEnabled();
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();

      // Verify current values and make a small edit
      await expect(nameInput).toHaveValue(publicAgentName);
      await nameInput.clear();
      await nameInput.fill(`${publicAgentName} (edited by user2)`);

      // Should be able to save
      await Promise.all([
        secondUserPage.waitForURL("**/agents", { timeout: 10000 }),
        saveButton.click(),
      ]);

      // Verify the edit was successful
      const editedAgent = secondUserPage.locator(
        `[data-testid="agent-card-name"]:has-text("${publicAgentName} (edited by user2)")`,
      );
      await expect(editedAgent).toBeVisible();
    } finally {
      await secondUserContext.close();
    }
  });

  test("different user can bookmark public agents", async ({ browser }) => {
    // Create second user context (using editor auth, but role doesn't matter for sharing)
    const secondUserContext = await browser.newContext({
      storageState: TEST_USERS.editor2.authFile,
    });
    const secondUserPage = await secondUserContext.newPage();

    try {
      await secondUserPage.goto("/agents");
      await secondUserPage.waitForURL("**/agents", { timeout: 10000 });
      await secondUserPage.waitForLoadState("networkidle");

      // Wait a bit for agents to load
      await secondUserPage.waitForTimeout(1000);

      // Find and bookmark the public agent
      // Note: Look for both original and potentially edited names since tests run in serial mode
      const publicAgentCard = secondUserPage
        .locator(`[data-testid*="agent-card"]`)
        .filter({
          has: secondUserPage.locator(`[data-testid="agent-card-name"]`, {
            hasText: new RegExp(publicAgentName),
          }),
        })
        .first();

      // Scroll the card into view and click bookmark
      await publicAgentCard.scrollIntoViewIfNeeded();
      await publicAgentCard.getByTestId("bookmark-button").click();

      // Wait for bookmark to process and refresh to sync
      await secondUserPage.waitForTimeout(1000);
      await secondUserPage.reload();
      await secondUserPage.waitForLoadState("networkidle");

      // Open sidebar to check bookmarks
      await secondUserPage.getByTestId("sidebar-toggle").click();
      await secondUserPage.waitForTimeout(500);

      await expect(
        secondUserPage.getByTestId("agents-sidebar-menu"),
      ).toContainText(publicAgentName, { timeout: 10000 });

      // Remove bookmark from Agents and verify it is removed from sidebar
      await publicAgentCard.getByTestId("bookmark-button").click();
      await secondUserPage.waitForTimeout(1000);
      await expect(
        secondUserPage.getByTestId("agents-sidebar-menu"),
      ).not.toContainText(publicAgentName);
    } finally {
      await secondUserContext.close();
    }
  });
});
