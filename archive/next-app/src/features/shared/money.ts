/** Parse decimal major units without floating-point arithmetic or rounding. */
export function parseMinorAmount(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const value = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

export function majorAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid minor-unit amount.");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

export function sumMinorAmounts(values: number[]): number | null {
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) return null;
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
