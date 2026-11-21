/** Frontend capability inventory, not a fabricated server availability response. */
export const supportContract = {
  connected: false,
  reason: "Live support is not connected. Messages cannot be sent or stored in this build.",
} as const;

// Add transport functions only after BE2 publishes the selected service and exact schemas.
// No requests to guessed support endpoints, client-only message store or keyword bot.
