"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  Monitor,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { type AuthMode } from "@/lib/navigation";
import {
  currentPreviewDevice,
  DEMO_PROFILE,
  readPreviewAccount,
  savePreviewAccount,
} from "@/lib/preview-account";

const content = {
  login: {
    kicker: "GOOD TO HAVE YOU BACK",
    heading: "A little more peace",
    description:
      "Log in to take a breath. Your subscriptions are in good hands.",
    action: "Log in",
  },
  signup: {
    kicker: "YOUR NEXT MONEY MOVE",
    heading: "Less worry. More living",
    description:
      "One card. Your rules. A little more room for the things you love.",
    action: "Create account",
  },
  "forgot-password": {
    kicker: "LET’S GET YOU BACK IN",
    heading: "Forgot happens",
    description: "Enter your email and we’ll help you find your way back.",
    action: "Send reset link",
  },
  "reset-password": {
    kicker: "A FRESH START",
    heading: "Make it a good one",
    description: "Choose a new password that’s just for your RETREST account.",
    action: "Reset password",
  },
  "device-binding": {
    kicker: "ONE LAST LITTLE CHECK",
    heading: "Verify this device",
    description:
      "A new browser needs your approval. Verify it before adding it to your trusted devices.",
    action: "Verify & trust device",
  },
} as const;

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  isNew = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  isNew?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-wrap">
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={isNew ? "new-password" : "current-password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={isNew ? "Make it yours" : "Your password"}
          maxLength={128}
          required
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
        />
        <button
          type="button"
          aria-label={(visible ? "Hide " : "Show ") + label.toLowerCase()}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error && (
        <span className="field-error" id={id + "-error"}>
          {error}
        </span>
      )}
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { label: "8 characters", passed: password.length >= 8 },
    { label: "A letter", passed: /[a-zA-Z]/.test(password) },
    { label: "A number", passed: /\d/.test(password) },
  ];
  return (
    <div className="password-checklist" aria-label="Password requirements">
      {checks.map((check) => (
        <span key={check.label} className={check.passed ? "passed" : ""}>
          <Check size={11} /> {check.label}
        </span>
      ))}
    </div>
  );
}

export default function AuthScreen({
  mode,
  destination = "/shield",
}: {
  mode: AuthMode;
  destination?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [deviceName, setDeviceName] = useState("This browser");
  const [deviceKind, setDeviceKind] = useState<"desktop" | "mobile">("desktop");
  const [trustDevice, setTrustDevice] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [timeZone, setTimeZone] = useState("");
  function enterDigit(index: number, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length > 1) {
      setOtp(Array.from({ length: 6 }, (_, i) => digits[i] ?? ""));
      otpRefs.current[Math.min(digits.length, 5)]?.focus();
    } else {
      setOtp((previous) =>
        previous.map((digit, i) => (i === index ? digits : digit)),
      );
      if (digits && index < 5) otpRefs.current[index + 1]?.focus();
    }
  }
  const copy = content[mode];
  const nextQuery = "?next=" + encodeURIComponent(destination);
  const newPassword = mode === "signup" || mode === "reset-password";
  const hasEmail =
    mode === "login" || mode === "signup" || mode === "forgot-password";
  const hasPassword = mode === "login" || newPassword;

  useEffect(() => {
    if (mode !== "device-binding") return;
    const device = currentPreviewDevice();
    setDeviceName(device.name);
    setDeviceKind(device.kind);
    setDeviceId(device.id);
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [mode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid: Record<string, string> = {};
    const address = email.trim().toLowerCase();
    if (mode === "signup" && name.trim().length < 2)
      invalid.name = "Please enter your name.";
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      invalid.email = "Enter a valid email address.";
    if (hasPassword && !password) invalid.password = "Enter your password.";
    if (
      newPassword &&
      (password.length < 8 ||
        !/[a-zA-Z]/.test(password) ||
        !/\d/.test(password))
    ) {
      invalid.password =
        "Use at least 8 characters, including a letter and a number.";
    }
    if (newPassword && password !== confirmation)
      invalid.confirmation = "Your passwords don’t match.";
    if (mode === "device-binding" && !deviceName.trim())
      invalid.device = "Give this device a name.";
    if (mode === "device-binding" && otp.join("") !== "123456")
      invalid.otp = "Enter the six-digit demo code: 123456.";
    if (mode === "device-binding" && !trustDevice)
      invalid.device = "Confirm you recognise this device.";
    setErrors(invalid);
    if (Object.keys(invalid).length) return;

    if (mode === "forgot-password" || mode === "reset-password") {
      setPassword("");
      setConfirmation("");
      setComplete(true);
      return;
    }

    const previous = readPreviewAccount();
    if (mode === "device-binding") {
      savePreviewAccount({
        profile: previous?.profile ?? DEMO_PROFILE,
        device: {
          name: deviceName.trim(),
          kind: deviceKind,
          id: deviceId,
          addedAt: new Date().toISOString(),
        },
      });
      startTransition(() => router.push(destination));
      return;
    }

    const sameProfile = previous?.profile.email === address;
    const knownDevice =
      sameProfile && previous.device?.id === currentPreviewDevice().id;
    savePreviewAccount({
      profile: {
        name:
          mode === "signup"
            ? name.trim()
            : sameProfile
              ? previous.profile.name
              : address.split("@")[0].replace(/[._-]/g, " "),
        email: address,
        phone: sameProfile ? previous.profile.phone : "",
      },
      device: sameProfile ? previous.device : null,
    });
    setPassword("");
    setConfirmation("");
    startTransition(() =>
      router.push(
        mode === "login" && knownDevice && previous.device
          ? destination
          : "/device-binding" + nextQuery,
      ),
    );
  }

  if (complete) {
    const recovery = mode === "forgot-password";
    return (
      <div className="auth-form-container auth-success" role="status">
        <span className="auth-success-icon">
          {recovery ? <Mail size={27} /> : <CheckCircle2 size={29} />}
        </span>
        <div className="eyebrow">
          {recovery ? "THE NEXT STEP IS READY" : "LOOKING GOOD"}
        </div>
        <h1>
          {recovery ? "Recovery, previewed" : "Your password is ready"}
          <span>.</span>
        </h1>
        <p>
          {recovery ? (
            <>
              A reset link will go to <strong>{email.trim()}</strong> when
              account authentication is connected.
            </>
          ) : (
            "Your new password meets the requirements. Continue to the login preview when you’re ready."
          )}
        </p>
        {recovery && (
          <Link
            href={"/reset-password" + nextQuery}
            className="button primary full-width"
          >
            Preview password reset <ArrowRight size={16} />
          </Link>
        )}
        <Link
          href={"/login" + nextQuery}
          className={
            "button full-width " + (recovery ? "secondary" : "primary")
          }
        >
          <ArrowLeft size={15} /> Back to login
        </Link>
        <small className="auth-preview-note">
          Frontend preview. No credentials have been updated.
        </small>
      </div>
    );
  }

  return (
    <div className="auth-form-container">
      {(mode === "signup" || mode === "device-binding") && (
        <div className="auth-stepper" aria-label="Account setup progress">
          <span className={mode === "signup" ? "current" : "done"}>
            <i>{mode === "signup" ? "1" : <Check size={11} />}</i> Your details
          </span>
          <span className={mode === "device-binding" ? "current" : ""}>
            <i>2</i> Your device
          </span>
          <span>
            <i>3</i> Your wallet
          </span>
        </div>
      )}
      <div className="eyebrow">{copy.kicker}</div>
      <h1>
        {copy.heading}
        <span>.</span>
      </h1>
      <p className="auth-description">{copy.description}</p>

      {mode === "device-binding" && (
        <div className="device-preview-card">
          <span className="device-preview-icon">
            {deviceKind === "mobile" ? (
              <Smartphone size={28} />
            ) : (
              <Monitor size={30} />
            )}
          </span>
          <div>
            <span className="eyebrow">CURRENT DEVICE</span>
            <h2>{deviceName || "This browser"}</h2>
            <p>Only add a device you recognise.</p>
          </div>
          <span className="badge neutral">Preview</span>
        </div>
      )}

      {mode === "device-binding" && (
        <>
          <div className="device-location">
            <span>Location not verified</span>
            <span>Time zone: {timeZone || "Checking…"}</span>
          </div>
          <div className="device-security-badge">
            <ShieldCheck size={18} />
            <div>
              AES-256-GCM encrypted sessions
              <small>
                Production security design · demo verification below
              </small>
            </div>
          </div>
        </>
      )}

      <form onSubmit={submit} noValidate className="auth-form">
        {mode === "signup" && (
          <div className="auth-field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <span className="field-error" id="name-error">
                {errors.name}
              </span>
            )}
          </div>
        )}
        {hasEmail && (
          <div className="auth-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <span className="field-error" id="email-error">
                {errors.email}
              </span>
            )}
          </div>
        )}
        {hasPassword && (
          <PasswordField
            id="password"
            label={mode === "reset-password" ? "New password" : "Password"}
            value={password}
            onChange={setPassword}
            error={errors.password}
            isNew={newPassword}
          />
        )}
        {newPassword && (
          <>
            <PasswordChecklist password={password} />
            <PasswordField
              id="confirmation"
              label="Confirm password"
              value={confirmation}
              onChange={setConfirmation}
              error={errors.confirmation}
              isNew
            />
          </>
        )}
        {mode === "login" && (
          <div className="auth-form-links">
            <span>
              <ShieldCheck size={13} /> Your rules are waiting
            </span>
            <Link href={"/forgot-password" + nextQuery}>Forgot password?</Link>
          </div>
        )}
        {mode === "device-binding" && (
          <>
            <div className="auth-field">
              <span className="otp-label" id="otp-label">
                Six-digit verification code
              </span>
              <div
                className="otp-inputs"
                role="group"
                aria-labelledby="otp-label"
                onPaste={(event) => {
                  event.preventDefault();
                  enterDigit(0, event.clipboardData.getData("text"));
                }}
              >
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      otpRefs.current[index] = element;
                    }}
                    aria-label={"Verification digit " + (index + 1)}
                    aria-invalid={!!errors.otp}
                    aria-describedby={errors.otp ? "otp-error" : "otp-hint"}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={digit}
                    maxLength={6}
                    onChange={(event) => enterDigit(index, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !digit && index > 0)
                        otpRefs.current[index - 1]?.focus();
                      if (event.key === "ArrowLeft" && index > 0) {
                        event.preventDefault();
                        otpRefs.current[index - 1]?.focus();
                      }
                      if (event.key === "ArrowRight" && index < 5) {
                        event.preventDefault();
                        otpRefs.current[index + 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <small className="otp-hint" id="otp-hint">
                Demo code: <b>123456</b> · No verification email is sent.
              </small>
              {errors.otp && (
                <span className="field-error" id="otp-error" role="alert">
                  {errors.otp}
                </span>
              )}
            </div>
            <div className="auth-field">
              <label htmlFor="device-name">Device name</label>
              <input
                id="device-name"
                name="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                maxLength={60}
                required
                aria-invalid={!!errors.device}
                aria-describedby={errors.device ? "device-error" : undefined}
              />
            </div>
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(event) => setTrustDevice(event.target.checked)}
              />
              I recognise this device and want to trust it.
            </label>
            {errors.device && (
              <span className="field-error" id="device-error">
                {errors.device}
              </span>
            )}
            <div className="auth-device-note">
              <ShieldCheck size={16} />
              <p>
                This previews your trusted-device setup. Device verification
                connects with account authentication.
              </p>
            </div>
          </>
        )}
        <button
          type="submit"
          className="button primary full-width auth-submit"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" /> Taking you there…
            </>
          ) : (
            <>
              {copy.action}
              <ArrowRight size={16} />
            </>
          )}
        </button>
        {(mode === "forgot-password" || mode === "reset-password") && (
          <Link href={"/login" + nextQuery} className="auth-back-link">
            <ArrowLeft size={14} /> Back to login
          </Link>
        )}
        {mode === "device-binding" && (
          <Link href={destination} className="auth-back-link">
            Skip for this preview <ArrowRight size={14} />
          </Link>
        )}
      </form>

      {mode === "login" && (
        <>
          <div className="auth-divider">
            <span>or take a look around</span>
          </div>
          <Link
            href={destination}
            className="button secondary full-width auth-demo-link"
          >
            Explore the demo <ArrowUpRightIcon />
          </Link>
          <p className="auth-switch">
            New around here?{" "}
            <Link href={"/signup" + nextQuery}>
              Create an account <ArrowRight size={13} />
            </Link>
          </p>
        </>
      )}
      {mode === "signup" && (
        <p className="auth-switch">
          Already have an account?{" "}
          <Link href={"/login" + nextQuery}>
            Log in <ArrowRight size={13} />
          </Link>
        </p>
      )}
      <p className="auth-preview-note">
        <KeyRound size={12} /> Demo account flow. Use sample details; passwords
        and codes stay in this browser.
      </p>
    </div>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
