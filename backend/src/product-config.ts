export const PRODUCT_CONFIG = {
  deviceChallengeTtlMs: 10 * 60 * 1000,
  deviceChallengeMaxAttempts: 5,
  inviteTtlDays: 14,
  exportMaxRows: 5000,
  supportThreadStatuses: ['OPEN', 'PENDING', 'RESOLVED'] as const,
} as const;
