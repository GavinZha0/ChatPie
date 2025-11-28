import { test, expect, Page } from "@playwright/test";
import { uniqueTestName } from "../utils/test-helpers";
import { TEST_USERS } from "../constants/test-users";

async function createAgent(
  page: Page,
  name: string,
  description: string,
  options?: { skipModelSelection?: boolean },
): Promise<void> {
  // Navigate to agents page
  await page.goto("/agents");
  await page.waitForLoadState("networkidle");

  // Click create agent button to open dialog
  await page.getByTestId("create-agent-button").click();

  // Wait for dialog to open
  await expect(page.getByRole("dialog")).toBeVisible();

  // Fill in agent details in the dialog
  await page.getByTestId("agent-name-input").fill(name);
  await page.getByTestId("agent-description-input").fill(description);

  // Verify model is selected (the dialog should have a default model from appStore)
  if (!options?.skipModelSelection) {
    // Wait for the model selector to be ready and have a selected model
    const modelSelectorButton = page.getByTestId("model-selector-button");
    await expect(modelSelectorButton).toBeVisible({ timeout: 3000 });

    // Verify that a model name is displayed (not just placeholder text)
    const selectedModelName = page.getByTestId("selected-model-name");
    const modelText = await selectedModelName.textContent();

    // If no model is selected (shows "model" placeholder), select the first available model
    if (!modelText || modelText.trim() === "model") {
      // Open model selector
      await modelSelectorButton.click();

      // Wait for popover to open
      await expect(page.getByTestId("model-selector-popover")).toBeVisible();

      // Select the first available model
      const firstModel = page.locator('[data-testid^="model-option-"]').first();
      await firstModel.click();

      // Wait for popover to close
      await expect(
        page.getByTestId("model-selector-popover"),
      ).not.toBeVisible();
    }
  }

  // Save the agent
  await page.getByTestId("agent-save-button").click();

  // Wait for dialog to close (success) or check for error toast
  await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
}

test.describe("Agent Creation and Sharing Workflow", () => {
  test.use({ storageState: TEST_USERS.editor.authFile });

  test("should create a new agent successfully", async ({ page }) => {
    const agentName = "Test Agent for Sharing";
    await createAgent(page, agentName, "This agent tests the sharing workflow");

    // Verify we're on agents page
    expect(page.url()).toContain("/agents");

    // Verify agent appears in the list
    await expect(
      page.locator(`[data-testid*="agent-card-name"]:has-text("${agentName}")`),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show created agent on agents page", async ({ page }) => {
    // Create an agent
    const agentName = uniqueTestName("Test Agent");
    await createAgent(page, agentName, "Should appear in agent list");

    // We should already be on agents page after creation
    expect(page.url()).toContain("/agents");

    // Check if agent appears in the page - more specific selector
    await expect(
      page.locator(`[data-testid*="agent-card-name"]:has-text("${agentName}")`),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should show agent in sidebar after creation", async ({ page }) => {
    const agentName = uniqueTestName("Sidebar Agent");
    await createAgent(page, agentName, "Should appear in sidebar");

    // Navigate to home to see sidebar
    await page.goto("/");

    // Agent should be visible in the sidebar - use specific selector
    await expect(
      page.locator(
        `[data-testid*="sidebar-agent-name"]:has-text("${agentName}")`,
      ),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should open agent editor from agents list", async ({ page }) => {
    const agentName = uniqueTestName("Clickable Agent");
    await createAgent(page, agentName, "Click to open");

    // Click on the agent card to open the edit dialog
    await page
      .locator(`[data-testid*="agent-card"]:has-text("${agentName}")`)
      .first()
      .click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible();

    // Verify agent name is displayed in the dialog
    await expect(page.getByTestId("agent-name-input")).toHaveValue(agentName);
  });

  test("should edit an existing agent", async ({ page }) => {
    // Create an agent first
    const originalName = uniqueTestName("Original Agent");
    const updatedName = uniqueTestName("Updated Agent");
    await createAgent(page, originalName, "Will be edited");

    // Click on the agent card to open edit dialog
    await page
      .locator(`[data-testid*="agent-card"]:has-text("${originalName}")`)
      .first()
      .click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible();

    // Edit the name with a unique name
    await page.getByTestId("agent-name-input").fill(updatedName);

    // Edit the description
    await page
      .getByTestId("agent-description-input")
      .fill("Updated description after editing");

    // Save changes
    await page.getByTestId("agent-save-button").click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Check the updated agent appears using the unique name
    await expect(
      page.locator(
        `[data-testid*="agent-card-name"]:has-text("${updatedName}")`,
      ),
    ).toBeVisible({ timeout: 5000 });
  });

  test("should add instructions to agent", async ({ page }) => {
    const agentName = uniqueTestName("Agent with Instructions");

    await page.goto("/agents");
    await page.waitForLoadState("networkidle");

    // Click create agent button to open dialog
    await page.getByTestId("create-agent-button").click();

    // Wait for dialog to open
    await expect(page.getByRole("dialog")).toBeVisible();

    // Fill basic info
    await page.getByTestId("agent-name-input").fill(agentName);
    await page
      .getByTestId("agent-description-input")
      .fill("Has custom instructions");

    // Add instructions
    await page
      .getByTestId("agent-prompt-textarea")
      .fill(
        "You are a helpful assistant that specializes in testing and quality assurance.",
      );

    // Verify and select model if needed
    const modelSelectorButton = page.getByTestId("model-selector-button");
    await expect(modelSelectorButton).toBeVisible({ timeout: 3000 });

    const selectedModelName = page.getByTestId("selected-model-name");
    const modelText = await selectedModelName.textContent();

    // If no model is selected, select the first available model
    if (!modelText || modelText.trim() === "model") {
      await modelSelectorButton.click();
      await expect(page.getByTestId("model-selector-popover")).toBeVisible();

      const firstModel = page.locator('[data-testid^="model-option-"]').first();
      await firstModel.click();

      await expect(
        page.getByTestId("model-selector-popover"),
      ).not.toBeVisible();
    }

    // Save the agent
    await page.getByTestId("agent-save-button").click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify we're still on agents page
    expect(page.url()).toContain("/agents");

    // Verify agent appears in the list
    await expect(
      page.locator(`[data-testid*="agent-card-name"]:has-text("${agentName}")`),
    ).toBeVisible({ timeout: 5000 });
  });
});
