import { test, expect } from '@playwright/test';
import { setOnboardedState } from './helpers';

test.describe('Wellness page', () => {
  test.beforeEach(async ({ page }) => {
    await setOnboardedState(page);
    await page.goto('/wellness');
  });

  test('marks 10k steps done and updates daily alerts/history area', async ({ page }) => {
    await expect(page.getByTestId('wellness-alerts')).toContainText('steps left');
    await page.getByTestId('steps-goal-toggle').click();

    await expect(page.getByTestId('steps-section')).toContainText('10,000');
    await expect(page.getByTestId('wellness-alerts')).not.toContainText('steps left');
  });

  test('filters wellness history by search text', async ({ page }) => {
    const today = await page.evaluate(() => new Date().toISOString().split('T')[0]);
    await page.getByTestId('wellness-history-search').fill(today);
    await expect(page.getByTestId('wellness-history-chart').first()).toBeVisible();
  });

  test('logs water with quick add and logs workout progress', async ({ page }) => {
    await expect(page.getByTestId('water-save')).toContainText('Log water drinking');
    await page.getByTestId('water-add-500').click();
    await expect(page.getByTestId('water-section')).toContainText('500 ml');
    await expect(page.getByTestId('water-consistency-summary')).toContainText('0 of 7 days');

    await page.getByTestId('water-input').fill('2500');
    await page.getByTestId('water-save').click();
    await expect(page.getByTestId('water-consistency-summary')).toContainText('1 of 7 days');
    await expect(page.getByTestId('water-consistency-summary')).toContainText('14%');

    await page.getByTestId('workout-goal-edit').click();
    await page.getByTestId('workout-goal-input').fill('2');
    await page.getByTestId('workout-goal-save').click();
    await page.getByTestId('workout-toggle').click();
    await expect(page.getByTestId('workouts-section')).toContainText('1/2');
  });

  test('configures browser notification reminders', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await page.reload();

    await expect(page.getByTestId('notification-settings')).toBeVisible();
    await page.getByTestId('notification-permission').click();
    await expect(page.getByTestId('notification-toggle')).toContainText('Notifications on');

    await page.getByTestId('notification-weight-time').fill('07:45');
    await page.getByTestId('notification-water-time-1').fill('15:15');

    const stored = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('balance-storage') ?? '{}');
      return data.state.profiles[0].habitSettings.notifications;
    });
    expect(stored.enabled).toBe(true);
    expect(stored.weightTime).toBe('07:45');
    expect(stored.waterTimes[1]).toBe('15:15');
  });
});
