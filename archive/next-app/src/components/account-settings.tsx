"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, CreditCard, KeyRound, LogOut, Mail, Monitor, ShieldCheck, Smartphone, UserRound, Zap } from "lucide-react";
import { clearPreviewAccount, savePreviewAccount, usePreviewAccount } from "@/lib/preview-account";
import { money, shortDate } from "@/lib/format";
import type { User } from "@/lib/types";

export default function AccountSettings({ user, busy, onAutoFx, notify }: {
  user: User; busy: boolean; onAutoFx: () => void; notify: (message: string, error?: boolean) => void;
}) {
  const router = useRouter();
  const account = usePreviewAccount();
  const profile = account?.profile;
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(profile?.name ?? user.name);
    setEmail(profile?.email ?? user.email);
    setPhone(profile?.phone ?? "");
  }, [profile?.name, profile?.email, profile?.phone, user.name, user.email]);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter your name and a valid email address."); return;
    }
    if (phone.trim() && !/^\+?[\d ()-]{7,22}$/.test(phone.trim())) {
      setError("Enter a valid phone number, including your country code."); return;
    }
    const address = email.trim().toLowerCase();
    savePreviewAccount({
      profile: { name: name.trim(), email: address, phone: phone.trim() },
      device: account?.profile.email === address ? account.device : null,
    });
    setError(""); notify("Your profile is saved for this preview.");
  }

  function removeDevice() {
    savePreviewAccount({ profile: profile ?? { name: user.name, email: user.email, phone: "" }, device: null });
    notify("Device removed from the preview.");
  }

  return <div className="account-grid">
    <div className="account-main-column">
      <section className="panel account-panel">
        <div className="section-header"><div><h2><UserRound size={18} /> A little about you</h2><p>Your account details, all in one place.</p></div><span className="badge neutral">Profile preview</span></div>
        <div className="account-profile-intro">
          <span className="account-avatar">{name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "YOU"}</span>
          <div><strong>{profile?.name ?? user.name}</strong><span>Personal account · NGN & USD</span></div>
          <ShieldCheck size={23} />
        </div>
        <form className="account-form" onSubmit={saveProfile} noValidate>
          <label htmlFor="profile-name">Full name<input id="profile-name" name="name" autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} required /></label>
          <label htmlFor="profile-email">Email address<input id="profile-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label htmlFor="profile-phone">Phone number <span className="optional-label">Optional</span><input id="profile-phone" name="phone" type="tel" autoComplete="tel" maxLength={22} placeholder="+234 800 000 0000" value={phone} onChange={event => setPhone(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="account-form-footer"><span>Saved in this tab for the frontend preview.</span><button type="submit" className="button primary"><Check size={15} /> Save details</button></div>
        </form>
      </section>
      <section className="panel account-panel">
        <div className="section-header"><div><h2><Zap size={18} /> Your money preferences</h2><p>Small settings. A little less admin.</p></div></div>
        <div className="account-preference"><span className="icon-well"><Zap size={17} /></span><div><b>Just-in-time dollar conversion</b><p>Convert the exact USD shortfall from your NGN wallet when a subscription charges.</p></div>
          <button type="button" role="switch" aria-checked={!!user.auto_fx_enabled} aria-label="Automatic NGN to USD conversion"
            className={"toggle " + (user.auto_fx_enabled ? "on" : "")} onClick={onAutoFx} disabled={busy}><span /></button>
        </div>
        <div className="account-balance-pair"><div><span><CreditCard size={14} /> NGN wallet</span><strong>{money(user.ngn_balance)}</strong></div><div><span><CreditCard size={14} /> USD wallet</span><strong>{money(user.usd_balance, "USD", true)}</strong></div></div>
      </section>
    </div>

    <div className="account-side-column">
      <section className="panel account-panel">
        <div className="section-header"><div><h2><ShieldCheck size={18} /> Your space, protected</h2><p>Keep the right devices close.</p></div></div>
        <div className="account-security-body">
          <div className="security-link"><span className="icon-well"><KeyRound size={16} /></span><div><b>Password</b><p>A fresh password, whenever you need it.</p></div><Link href="/reset-password?next=%2Fsettings" className="icon-button" aria-label="Change password"><ArrowUpRight size={17} /></Link></div>
          <div className="device-section-heading"><b>Trusted device preview</b><span className="badge neutral">{account?.device ? "1 device" : "No devices"}</span></div>
          {account?.device ? <div className="trusted-device">
            <span className="device-small-icon">{account.device.kind === "mobile" ? <Smartphone size={22} /> : <Monitor size={23} />}</span>
            <div><b>{account.device.name}</b><small>Added {shortDate(account.device.addedAt)} · Preview</small></div>
            <button type="button" className="text-button remove-device" onClick={removeDevice}>Remove</button>
          </div> : <div className="no-device"><Monitor size={28} /><p>Add a device you recognise to preview your account’s device settings.</p></div>}
          <Link href="/device-binding?next=%2Fsettings" className="button secondary full-width"><ShieldCheck size={15} /> {account?.device ? "Review this device" : "Add this device"}<ArrowUpRight size={14} /></Link>
          <small className="security-preview-note">Verified device binding connects in the authentication phase.</small>
        </div>
      </section>
      <section className="panel account-access-panel">
        <span className="icon-well"><Mail size={18} /></span><h2>Your account starts here.</h2><p>Walk through sign up or login before we connect account authentication.</p>
        <div><Link href="/signup" className="button primary">Create account <ArrowUpRight size={14} /></Link><Link href="/login" className="button secondary">Log in</Link></div>
      </section>
      <button type="button" className="account-signout" onClick={() => { clearPreviewAccount(); router.push("/login"); }}>
        <LogOut size={16} /><span>Sign out of preview</span><ArrowUpRight size={14} />
      </button>
    </div>
  </div>;
}
