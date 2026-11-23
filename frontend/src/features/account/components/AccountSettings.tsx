"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";
import { Check, Mail, Monitor, RefreshCw, ShieldCheck, SunMoon, UserRound } from "lucide-react";
import type { DeviceRecord } from "@retrest/shared";
import { EmptyState, Toggle } from "@/components/ui";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useTheme } from "@/features/theme/ThemeProvider";
import type { ThemePreference } from "@/features/theme/theme";
import { changeEmail } from "@/features/auth/api";
import { registerAccountDevice, removeAccountDevice, updateAccountProfile, updateAccountSettings } from "../api";
import { useAccount } from "../AccountContext";
import { useAccountPage } from "../useAccountPage";
import { AccountListStatus } from "./AccountListStatus";

export function AccountSettings() {
  const { user, profile, setProfile, settings, setSettings, busy, run, onError, notify } = useAccount();
  const { preference, setPreference } = useTheme();
  const [emailRequested, setEmailRequested] = useState(false);
  const devices = useAccountPage<DeviceRecord>("devices", {}, onError);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("display_name")).trim();
    const result = await run(() => updateAccountProfile(name), "Your name is saved.");
    if (result) setProfile(result.profile);
  }
  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await run(async () => {
      const phone = String(form.get("phone")).trim();
      if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Use a phone number with country code, for example +2348000000000.");
      const time_zone = String(form.get("time_zone")).trim();
      try { new Intl.DateTimeFormat("en", { timeZone: time_zone }); } catch { throw new Error("Use a valid time zone, for example Africa/Lagos."); }
      return updateAccountSettings({ phone: phone || null, time_zone });
    }, "Your contact details are saved.");
    if (result) setSettings(result.settings);
  }
  async function requestEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim().toLowerCase();
    const result = await run(() => changeEmail(email), "Email change requested. Check both inboxes to confirm.");
    if (result) setEmailRequested(true);
  }
  const toggle = useCallback(async (key: "auto_fx_enabled" | "email_notifications" | "monthly_summary_email") => {
    const result = await run(() => updateAccountSettings({ [key]: !settings[key] }), "Preference saved.");
    if (result) setSettings(result.settings);
  }, [settings, run]);
  async function trustBrowser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("device_name")).trim();
    const result = await run(() => registerAccountDevice(name), "This browser is trusted for 30 days.");
    if (result) await devices.refresh();
  }
  async function removeDevice(id: string) {
    const result = await run(() => removeAccountDevice(id), "Device removed and its session revoked.");
    if (result) {
      // A current-device revocation is detected by the next guarded read and returns to login.
      await devices.refresh();
    }
  }
  async function saveAppearance(theme: ThemePreference) {
    const result = await run(() => updateAccountSettings({ theme }));
    if (!result) return false;
    setSettings(result.settings);
    return true;
  }
  async function followDevice() {
    if (preference === "system") return;
    if (await saveAppearance("system")) { setPreference("system"); notify("Appearance now follows your device settings."); }
  }
  return <div className="account-settings-grid">
    <div className="account-column">
      <section className="panel"><div className="section-header"><div><h2><UserRound size={18} />Your profile</h2><p>Details saved to your verified account.</p></div></div>
        <form className="account-form account-panel-body" onSubmit={saveName}><label>Full name<input name="display_name" autoComplete="name" defaultValue={profile.display_name} maxLength={80} required /></label>
          <button className="button primary" disabled={busy}><Check size={15} />Save name</button></form>
      </section>
      <section className="panel appearance-panel"><h2><SunMoon size={18} />Appearance</h2>
        <p>Choose light or dark mode for every page, or follow your device settings.</p>
        <ThemeToggle disabled={busy} onChange={saveAppearance} />
        <button type="button" className="text-button appearance-system" aria-pressed={preference === "system"} disabled={busy} onClick={() => void followDevice()}><Monitor size={16} />Follow device settings{preference === "system" && <Check size={15} />}</button>
      </section>
      <section className="panel"><div className="section-header"><div><h2>Your preferences</h2><p>Contact details and notifications.</p></div></div>
        <>
          <form className="account-form account-panel-body" onSubmit={saveDetails} key={settings.user_id}>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={settings.phone ?? ""} maxLength={16} placeholder="+2348000000000" /></label>
            <label>Time zone<input name="time_zone" defaultValue={settings.time_zone} maxLength={64} required /></label>
            <button className="button primary" disabled={busy}>Save preferences</button>
          </form>
          <div className="account-preferences">
            {([
              ["auto_fx_enabled", "Automatic NGN to USD conversion", "Save your conversion preference for when the payment service is available."],
              ["email_notifications", "Email notifications", "Receive account notifications by email when delivery is available."],
              ["monthly_summary_email", "Monthly summary emails", "Automatically email your previous month's UTC summary when email delivery is enabled."],
            ] as const).map(([key, title, description]) => <div className="account-preference-row" key={key}><div><b>{title}</b><p>{description}</p></div>
              <Toggle label={title} on={settings[key]} disabled={busy} onClick={() => void toggle(key)} /></div>)}
          </div>
        </>
      </section>
    </div>
    <div className="account-column">
      <section className="panel"><div className="section-header"><div><h2><Mail size={18} />Email address</h2><p>{user.email} · Confirmed</p></div></div>
        <form className="account-form account-panel-body" onSubmit={requestEmail}><label>New email address<input name="email" type="email" autoComplete="email" maxLength={254} required onChange={() => setEmailRequested(false)} /></label>
          <p className="account-note">Confirm the change using the links sent to your current and new addresses.</p>
          {emailRequested && <p role="status">Check both inboxes to confirm your new email. Your address updates after confirmation.</p>}
          <button className="button secondary" disabled={busy}>Request email change</button>
        </form>
      </section>
      <section className="panel"><div className="section-header"><div><h2><ShieldCheck size={18} />Trusted browsers</h2><p>Removing a browser also revokes its account session.</p></div><button className="icon-button" aria-label="Refresh devices" disabled={devices.loading} onClick={() => void devices.refresh()}><RefreshCw size={16} /></button></div>
        <div className="account-panel-body">{devices.rows.map(device => <div className="account-device" key={device.id}><Monitor size={22} /><div><b>{device.name}</b><small>{device.revoked_at ? "Revoked" : Date.parse(device.expires_at) <= Date.now() ? "Expired" : `Trusted until ${new Date(device.expires_at).toLocaleDateString()}`}</small>
          <small>Last used {new Date(device.last_used_at).toLocaleString()}</small></div><button className="text-button" disabled={busy || !!device.revoked_at} onClick={() => void removeDevice(device.id)}>Remove</button></div>)}
          {!devices.rows.length && !devices.loading && !devices.error && <EmptyState text="No trusted browsers yet." />}
          <AccountListStatus {...devices} count={devices.rows.length} more={devices.cursor ? devices.more : undefined} />
          <form className="account-form" onSubmit={trustBrowser}><label>Browser name<input name="device_name" maxLength={80} defaultValue="This browser" required /></label>
            <label className="checkbox-label"><input type="checkbox" required />I recognise this browser and want to trust it.</label><button className="button secondary" disabled={busy}>Trust this browser</button></form>
        </div>
      </section>
      <Link className="button secondary" href="/reset-password?next=%2Fsettings">Change password</Link>
    </div>
  </div>;
}
