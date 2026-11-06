import type { Locator, Page } from '@playwright/test';

export function launchCard(page: Page, mission: string): Locator {
  return page.getByRole('article', { name: mission, exact: true });
}
