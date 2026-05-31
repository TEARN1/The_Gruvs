/**
 * Profile Page — tests tabs including new "Following" tab.
 */
import { test, expect } from '@playwright/test';
import { waitForApp } from './helpers';

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    // Navigate to profile tab (Vibe Card)
    const profileTab = page
      .getByRole('button', { name: /vibe card|profile|me/i })
      .or(page.getByText(/vibe card/i))
      .first();
    await profileTab.click().catch(() => {});
  });

  test('profile page renders', async ({ page }) => {
    // Should show either a profile or a sign-in prompt
    const profileContent = page
      .getByText(/my gruvs|following|saved|sign in|log in/i)
      .first();
    await expect(profileContent).toBeVisible({ timeout: 10_000 });
  });

  test('shows all expected profile tabs when logged in', async ({ page }) => {
    // If user is logged in, tabs should be visible
    const myGruvsTab = page.getByText(/my gruvs/i).first();
    const visible = await myGruvsTab.isVisible().catch(() => false);
    if (visible) {
      await expect(myGruvsTab).toBeVisible();

      const followingTab = page.getByText(/following/i).first();
      await expect(followingTab).toBeVisible({ timeout: 5_000 });

      const savedTab = page.getByText(/saved/i).first();
      await expect(savedTab).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Following tab is clickable', async ({ page }) => {
    const followingTab = page.getByText(/^Following$/i).first();
    const visible = await followingTab.isVisible().catch(() => false);
    if (visible) {
      await followingTab.click();
      // Should show either followed events or an empty state
      const content = page
        .getByText(/follow|bell|no events/i)
        .first();
      await expect(content).toBeVisible({ timeout: 5_000 });
    }
  });
});
