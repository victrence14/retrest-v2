import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTimestampedHmac(raw: Buffer, timestamp: string, signature: string, secret: string, now = Date.now()) {
  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
/** Resend uses Svix: HMAC(id.timestamp.rawBytes), base64, with versioned signatures. */
export function verifyResendSignature(raw: Buffer, eventId: string, timestamp: string, signatures: string, secret: string, now = Date.now()) {
  if (!eventId || eventId.length > 200 || !/^\d{1,12}$/.test(timestamp)
    || Math.abs(now / 1000 - Number(timestamp)) > 300 || signatures.length > 2048) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(eventId + "." + timestamp + ".").update(raw).digest();
  return signatures.split(/\s+/).some(value => {
    const [version, signature] = value.split(",");
    if (version !== "v1" || !signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
    const actual = Buffer.from(signature, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
