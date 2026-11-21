import type { FormEvent } from "react";

export interface AuthCardProps {
  mode: "login" | "signup";
  busy?: boolean;
  configured?: boolean;
  error?: string;
  message?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChangeMode: () => void;
}

export function AuthCard({
  mode,
  busy = false,
  configured = true,
  error = "",
  message = "",
  onSubmit,
  onChangeMode,
}: AuthCardProps) {
  return (
    <section className="panel auth-panel stack" aria-labelledby="auth-heading">
      <div className="stack">
        <span className="eyebrow">A little more peace of mind</span>
        <h2 id="auth-heading">
          {mode === "login" ? "Welcome back." : "Make room for better."}
        </h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to your personal workspace."
            : "Create your RETREST account."}
        </p>
      </div>
      {!configured && (
        <p className="notice" role="status">
          Account access is awaiting setup. You can still explore the app and
          change its appearance.
        </p>
      )}
      <form className="stack" onSubmit={onSubmit}>
        {mode === "signup" && (
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={80} required />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        <button className="button" disabled={busy || !configured}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
      <button
        type="button"
        className="button button-quiet"
        disabled={busy}
        onClick={onChangeMode}
      >
        {mode === "login"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </section>
  );
}
