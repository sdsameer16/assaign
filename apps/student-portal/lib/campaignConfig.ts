export interface CampaignConfig {
  id: string;
  name: string;
  enabled: boolean;
  startDate: string; // ISO date format: "YYYY-MM-DD"
  endDate: string;   // ISO date format: "YYYY-MM-DD"
}

/**
 * Centralized configuration for the Raksha Bandhan festive animation layer.
 * 
 * TO DISABLE IMMEDIATELY: Set `enabled: false`.
 * TO CHANGE CAMPAIGN DATES: Update `startDate` and/or `endDate`.
 */
export const rakhiCampaignConfig: CampaignConfig = {
  id: "raksha-bandhan-2026",
  name: "Raksha Bandhan Festival",
  enabled: false,
  startDate: "2026-08-22",
  endDate: "2026-08-31",
};

/**
 * Helper function that determines if a given campaign is active based on:
 * 1. The campaign's `enabled` toggle flag.
 * 2. Current system date falling between `startDate` and `endDate` inclusive.
 */
export function isCampaignActive(config: CampaignConfig = rakhiCampaignConfig): boolean {
  if (!config.enabled) return false;

  const now = new Date();
  const start = new Date(config.startDate + "T00:00:00");
  const end = new Date(config.endDate + "T23:59:59");

  return now >= start && now <= end;
}
