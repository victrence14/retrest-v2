"use client";

import { useEffect, useState } from "react";

export interface PreviewProfile {
  name: string;
  email: string;
  phone: string;
}

export interface PreviewDevice {
  id?: string;
  name: string;
  kind: "desktop" | "mobile";
  addedAt: string;
}

export interface PreviewAccount {
  profile: PreviewProfile;
  device: PreviewDevice | null;
}

export const DEMO_PROFILE: PreviewProfile = { name: "Ada Okafor", email: "ada@retrest.app", phone: "" };
const STORAGE_KEY = "retrest.frontend-preview.account";
const CHANGE_EVENT = "retrest:preview-account";

// Presentation data only. Passwords, session tokens, and device credentials are never stored here.
export function readPreviewAccount(): PreviewAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value.profile?.name !== "string" || typeof value.profile?.email !== "string"
      || typeof value.profile?.phone !== "string") return null;
    const device = value.device;
    return {
      profile: { name: value.profile.name, email: value.profile.email, phone: value.profile.phone },
      device: device && typeof device.name === "string" && typeof device.addedAt === "string"
        && !Number.isNaN(Date.parse(device.addedAt)) && (device.kind === "desktop" || device.kind === "mobile")
        ? { name: device.name, kind: device.kind, addedAt: device.addedAt, id: typeof device.id === "string" ? device.id : undefined } : null,
    };
  } catch { return null; }
}

export function savePreviewAccount(account: PreviewAccount) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(account)); } catch { /* Storage may be unavailable in private mode. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearPreviewAccount() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Preview can continue without browser storage. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function usePreviewAccount() {
  const [account, setAccount] = useState<PreviewAccount | null>(null);
  useEffect(() => {
    const refresh = () => setAccount(readPreviewAccount());
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return account;
}

export function currentPreviewDevice(): Pick<PreviewDevice, "name" | "kind"> & { id: string } {
  const agent = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(agent);
  const platform = /iPhone|iPad/i.test(agent) ? "iPhone / iPad" : /Android/i.test(agent) ? "Android"
    : /Macintosh|Mac OS/i.test(agent) ? "Mac" : /Windows/i.test(agent) ? "Windows PC" : "This device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome"
    : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  // A presentation-only fingerprint; it does not authorize server requests.
  const source = agent + "|" + navigator.language + "|" + Intl.DateTimeFormat().resolvedOptions().timeZone;
  let fingerprint = 2166136261;
  for (let index = 0; index < source.length; index++) fingerprint = Math.imul(fingerprint ^ source.charCodeAt(index), 16777619);
  return { name: platform + " · " + browser, kind: mobile ? "mobile" : "desktop", id: "preview-" + (fingerprint >>> 0).toString(16) };
}
