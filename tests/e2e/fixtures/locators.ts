import type { Locator, Page } from '@playwright/test';

// Launch and booking cards are both articles labelled by their mission.
function cardByMission(page: Page, mission: string): Locator {
  return page.getByRole('article', { name: mission, exact: true });
}

export const launchCard = cardByMission;

export const bookingCard = cardByMission;
