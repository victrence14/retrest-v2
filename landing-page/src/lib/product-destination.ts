/** Production CTAs default to the selected product route on the deployment origin. */
export function productDestination(configured: string | undefined, production: boolean): string {
  const fallback = '/shield';
  const value = configured?.trim();
  if (!value || /[\\\r\n]/.test(value)) return fallback;
  if (/^\/shield(?:\?[^#]*)?$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) return fallback;
    const host = url.hostname.toLowerCase();
    const local = host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '[::1]' || /^127\./.test(host) || host === '0.0.0.0' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (production && (url.protocol !== 'https:' || local)) return fallback;
    return url.href;
  } catch { return fallback; }
}
