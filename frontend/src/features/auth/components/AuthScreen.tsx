"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Eye, EyeOff, LoaderCircle, Mail, Monitor, ShieldCheck } from "lucide-react";
import type { AuthMode } from "@/lib/navigation";
import { errorMessage } from "@/lib/api/client";
import { useToast } from "@/hooks/useToast";
import { registerAccountDevice } from "@/features/account/api";
import { useAuthVerification, type VerificationIntent } from "../AuthVerificationContext";
import { cleanCallbackUrl, finishAuthCallback, forgotPassword, login, readAuthCallback, resendConfirmation, resetPassword, signup, verifyEmailCode, type AuthResult } from "../api";

const content = {
  login: { kicker: "GOOD TO HAVE YOU BACK", heading: "A little more peace", description: "Log in to manage your subscriptions and account.", action: "Log in" },
  signup: { kicker: "YOUR NEXT MONEY MOVE", heading: "Less worry. More living", description: "Create your account and keep your subscriptions organised.", action: "Create account" },
  "forgot-password": { kicker: "LET’S GET YOU BACK IN", heading: "Forgot happens", description: "Enter your email and we’ll help you find your way back.", action: "Send reset link" },
  "reset-password": { kicker: "A FRESH START", heading: "Make it a good one", description: "Choose a new password after opening your recovery link.", action: "Reset password" },
  "device-binding": { kicker: "YOUR TRUSTED DEVICES", heading: "Trust this browser", description: "Add a browser you recognise to your signed-in account.", action: "Trust this browser" },
  otp: { kicker: "ONE MORE STEP", heading: "Confirm your email", description: "Enter the verification code from your email, or open the verification link in that message.", action: "Verify code" },
} as const;

function PasswordField({ id, label, value, onChange, error, isNew = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void; error?: string; isNew?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-password-wrap">
      <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={isNew ? "new-password" : "current-password"}
        value={value} onChange={event => onChange(event.target.value)} placeholder={isNew ? "At least 12 characters" : "Your password"}
        maxLength={128} required aria-invalid={!!error} aria-describedby={error ? id + "-error" : undefined} />
      <button type="button" aria-label={(visible ? "Hide " : "Show ") + label.toLowerCase()} onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
    {error && <span className="field-error" id={id + "-error"}>{error}</span>}
  </div>;
}

export default function AuthScreen({ mode, destination = "/shield", verificationIntent = "signup" }: {
  mode: AuthMode; destination?: string; verificationIntent?: VerificationIntent;
}) {
  const router = useRouter();
  const { notify } = useToast();
  const { verification, rememberVerification, clearVerification } = useAuthVerification();
  const [submitting, startTransition] = useTransition();
  const [callbackPending, setCallbackPending] = useState(false);
  const callbackTask = useRef<Promise<{ result: AuthResult; recovery: boolean }> | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(mode === "otp" ? verification?.email ?? "" : "");
  const [code, setCode] = useState("");
  const [resendWait, setResendWait] = useState(0);
  const resendDeadline = useRef(0);
  const [confirmationNotice, setConfirmationNotice] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [deviceName, setDeviceName] = useState("This browser");
  const [trustDevice, setTrustDevice] = useState(false);
  const submitLock = useRef(false);
  const nextQuery = "?next=" + encodeURIComponent(destination);
  const newPassword = mode === "signup" || mode === "reset-password";
  const hasEmail = ["login", "signup", "forgot-password", "otp"].includes(mode);
  const hasPassword = mode === "login" || newPassword;
  const pending = submitting || callbackPending;
  const resendActive = resendWait > 0;
  const copy = mode === "otp" && verificationIntent === "recovery"
    ? { ...content.otp, heading: "Verify your reset code", description: "Enter the recovery code from your email to choose a new password." }
    : content[mode];

  useEffect(() => {
    if (mode !== "otp" || !verification || verification.intent !== verificationIntent) return;
    setEmail(verification.email);
    resendDeadline.current = verification.requestedAt + 60000;
    setResendWait(Math.max(0, Math.ceil((verification.requestedAt + 60000 - Date.now()) / 1000)));
  }, [mode, verification, verificationIntent]);
  useEffect(() => {
    if (!resendActive) return;
    const timer = setInterval(() => setResendWait(Math.max(0, Math.ceil((resendDeadline.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [resendActive]);

  function startResendCooldown() {
    resendDeadline.current = Date.now() + 60000;
    setResendWait(60);
  }

  useEffect(() => {
    let active = true;
    if (!callbackTask.current) {
      const url = new URL(window.location.href);
      try {
        let verifier: string | null = null;
        try { verifier = sessionStorage.getItem("retrest.auth.pkce_verifier"); } catch { /* Optional PKCE client state. */ }
        const callback = readAuthCallback(url, verifier);
        if (!callback) return;
        window.history.replaceState(null, "", cleanCallbackUrl(url));
        // Reuse a one-time verification in React Strict Mode instead of consuming the link twice.
        callbackTask.current = finishAuthCallback(callback).then(result => ({ result, recovery: callback.recovery }));
      } catch (error) {
        window.history.replaceState(null, "", cleanCallbackUrl(url));
        setErrors({ form: errorMessage(error) });
        notify(errorMessage(error), true);
        return;
      }
    }
    setCallbackPending(true);
    callbackTask.current.then(({ result, recovery }) => {
      if (!active) return;
      if (result.confirmation_required) {
        setConfirmationNotice("This email confirmation is recorded. Confirm the other address to finish your email change.");
        notify("Email confirmation recorded. Check the other inbox to finish.");
      } else if (recovery) {
        notify("Recovery link verified. Choose your new password.");
        if (window.location.pathname !== "/reset-password") router.replace("/reset-password" + nextQuery);
      } else {
        notify("Email verification successful. You are signed in.");
        router.replace(destination); router.refresh();
      }
      try { sessionStorage.removeItem("retrest.auth.pkce_verifier"); } catch { /* Storage can be unavailable. */ }
    }).catch(error => { if (active) { const message = errorMessage(error); setErrors({ form: message }); notify(message, true); } })
      .finally(() => { if (active) setCallbackPending(false); });
    return () => { active = false; };
  }, [router, destination, nextQuery, notify]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitLock.current) return;
    const invalid: Record<string, string> = {};
    const address = email.trim().toLowerCase();
    if (mode === "signup" && !name.trim()) invalid.name = "Please enter your name.";
    if (hasEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254)) invalid.email = "Enter a valid email address.";
    if (hasPassword && !password) invalid.password = "Enter your password.";
    if (newPassword && password.length < 12) invalid.password = "Use at least 12 characters.";
    if (newPassword && password !== confirmation) invalid.confirmation = "Your passwords don’t match.";
    if (mode === "device-binding" && !deviceName.trim()) invalid.device = "Give this browser a name.";
    if (mode === "device-binding" && !trustDevice) invalid.device = "Confirm you recognise this browser.";
    if (mode === "otp" && !/^[0-9]{6,10}$/.test(code)) invalid.code = "Enter the complete verification code from your email.";
    setErrors(invalid);
    if (Object.keys(invalid).length) { notify("Check the highlighted fields and try again.", true); return; }
    submitLock.current = true;
    startTransition(async () => {
      try {
        if (mode === "signup") {
          await signup(address, password, name.trim());
          rememberVerification(address, "signup"); startResendCooldown(); setComplete(true);
          notify("Signup received. Check your email to confirm your account.");
        } else if (mode === "forgot-password") {
          await forgotPassword(address);
          rememberVerification(address, "recovery"); startResendCooldown(); setComplete(true);
          notify("Password reset requested. Check your email.");
        } else if (mode === "reset-password") {
          await resetPassword(password); setComplete(true); notify("Your password has been updated successfully.");
        } else if (mode === "device-binding") {
          await registerAccountDevice(deviceName.trim()); notify("This browser has been added to your trusted devices.");
          router.replace(destination); router.refresh();
        } else if (mode === "otp") {
          await verifyEmailCode(address, code, verificationIntent);
          setCode(""); clearVerification();
          notify(verificationIntent === "recovery" ? "Code verified. Choose your new password." : "Email verified. You are signed in.");
          router.replace(verificationIntent === "recovery" ? "/reset-password" + nextQuery : destination); router.refresh();
        } else {
          await login(address, password); notify("You have logged in successfully.");
          router.replace(destination); router.refresh();
        }
        setPassword(""); setConfirmation("");
      } catch (error) { const message = errorMessage(error); setErrors({ form: message }); notify(message, true); }
      finally { submitLock.current = false; }
    });
  }

  function resend(intent: VerificationIntent) {
    if (pending || resendWait || submitLock.current) return;
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254) {
      setErrors({ email: "Enter a valid email address." }); notify("Enter your email address before requesting another code.", true); return;
    }
    submitLock.current = true;
    startTransition(async () => {
      try {
        await (intent === "recovery" ? forgotPassword(address) : resendConfirmation(address));
        rememberVerification(address, intent); setCode(""); startResendCooldown(); setErrors({});
        notify("A new verification email has been requested. Check your inbox.");
      } catch (error) { const message = errorMessage(error); setErrors({ form: message }); notify(message, true); }
      finally { submitLock.current = false; }
    });
  }

  if (complete) {
    const recovery = mode === "forgot-password";
    const signupComplete = mode === "signup";
    return <div className="auth-form-container auth-success" role="status">
      <span className="auth-success-icon">{recovery || signupComplete ? <Mail size={27} /> : <CheckCircle2 size={29} />}</span>
      <div className="eyebrow">YOUR NEXT STEP</div>
      <h1>{signupComplete ? "Check your inbox" : recovery ? "Check your email" : "Password updated"}<span>.</span></h1>
      <p>{signupComplete ? <>Confirm your email using the link sent to <strong>{email.trim()}</strong>, then log in.</>
        : recovery ? "If an account exists for that email, a password recovery link will be sent. Open it to continue."
        : "Your new password has been saved. You can continue to your account."}</p>
      {(signupComplete || recovery) && <>
        <Link href={"/otp" + nextQuery + (recovery ? "&intent=recovery" : "")} className="button secondary full-width">Enter the code from my email <Mail size={16} /></Link>
        <button type="button" className="text-button auth-resend" disabled={pending || resendWait > 0} onClick={() => resend(recovery ? "recovery" : "signup")}>
          {resendWait ? `Resend email in ${resendWait}s` : "Resend verification email"}
        </button>
      </>}
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <Link href={mode === "reset-password" ? destination : "/login" + nextQuery} className="button primary full-width">
        <ArrowLeft size={15} />{mode === "reset-password" ? "Open my account" : "Back to login"}
      </Link>
    </div>;
  }

  return <div className="auth-form-container">
    <div className="eyebrow">{copy.kicker}</div>
    <h1>{copy.heading}<span>.</span></h1>
    <p className="auth-description">{copy.description}</p>
    {confirmationNotice && <p className="auth-confirmation-notice" role="status">{confirmationNotice}</p>}
    {callbackPending && <p className="auth-device-note" role="status"><LoaderCircle size={18} className="spin" />Confirming your sign-in link…</p>}
    {mode === "device-binding" && <div className="device-preview-card">
      <span className="device-preview-icon"><Monitor size={30} /></span>
      <div><span className="eyebrow">SIGNED-IN ACCOUNT</span><h2>{deviceName || "This browser"}</h2><p>Only trust a browser you recognise.</p></div>
    </div>}
    <form onSubmit={submit} noValidate className="auth-form">
      {mode === "signup" && <div className="auth-field">
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" autoComplete="name" placeholder="Your name" value={name} onChange={event => setName(event.target.value)}
          maxLength={80} required aria-invalid={!!errors.name} />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>}
      {hasEmail && <div className="auth-field">
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email}
          onChange={event => setEmail(event.target.value)} maxLength={254} required aria-invalid={!!errors.email} />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>}
      {mode === "otp" && <div className="auth-field">
        <label htmlFor="otp-code">Email verification code</label>
        <input id="otp-code" name="otp-code" className="otp-code-field" type="text" inputMode="numeric" autoComplete="one-time-code"
          placeholder="Enter your code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))}
          maxLength={10} required aria-invalid={!!errors.code} aria-describedby={`otp-hint${errors.code ? " otp-error" : ""}`} />
        <small id="otp-hint" className="otp-hint">Use the latest code in your email. If it contains a verification link, you can open that link instead.</small>
        {errors.code && <span className="field-error" id="otp-error">{errors.code}</span>}
      </div>}
      {hasPassword && <PasswordField id="password" label={mode === "reset-password" ? "New password" : "Password"}
        value={password} onChange={setPassword} error={errors.password} isNew={newPassword} />}
      {newPassword && <>
        <div className="password-checklist" aria-label="Password requirements"><span className={password.length >= 12 ? "passed" : ""}><Check size={11} />12 characters minimum</span></div>
        <PasswordField id="confirmation" label="Confirm password" value={confirmation} onChange={setConfirmation} error={errors.confirmation} isNew />
      </>}
      {mode === "login" && <div className="auth-form-links"><span><ShieldCheck size={13} />Your account, securely signed in</span>
        <Link href={"/forgot-password" + nextQuery}>Forgot password?</Link></div>}
      {mode === "device-binding" && <>
        <div className="auth-field"><label htmlFor="device-name">Browser name</label>
          <input id="device-name" name="device-name" value={deviceName} onChange={event => setDeviceName(event.target.value)} maxLength={80} required />
        </div>
        <label className="auth-checkbox"><input type="checkbox" checked={trustDevice} onChange={event => setTrustDevice(event.target.checked)} />I recognise this browser and want to trust it.</label>
        {errors.device && <span className="field-error">{errors.device}</span>}
      </>}
      {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
      <button type="submit" className="button primary full-width auth-submit" disabled={pending}>
        {pending ? <><LoaderCircle size={17} className="spin" />Please wait…</> : <>{copy.action}<ArrowRight size={16} /></>}
      </button>
      {mode === "otp" && <button type="button" className="text-button auth-resend" disabled={pending || resendWait > 0} onClick={() => resend(verificationIntent)}>
        {resendWait ? `Resend email in ${resendWait}s` : "Resend verification email"}
      </button>}
      {(mode === "forgot-password" || mode === "reset-password" || mode === "device-binding" || mode === "otp") &&
        <Link href={"/login" + nextQuery} className="auth-back-link"><ArrowLeft size={14} />Back to login</Link>}
    </form>
    {mode === "login" && <p className="auth-switch">New to RETREST? <Link href={"/signup" + nextQuery}>Create an account <ArrowRight size={13} /></Link></p>}
    {mode === "signup" && <p className="auth-switch">Already have an account? <Link href={"/login" + nextQuery}>Log in <ArrowRight size={13} /></Link></p>}
    <Link href="/shield?demo=1" className="auth-back-link">Explore the demo <ArrowRight size={14} /></Link>
  </div>;
}
