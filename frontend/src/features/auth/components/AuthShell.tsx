import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story" aria-label="About RETREST">
        <Link href="/" className="brand auth-brand" aria-label="RETREST home">
          <span className="brand-symbol">
            <ShieldCheck size={23} />
          </span>
          <span>
            retrest<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="auth-story-content">
          <span className="auth-story-kicker">
            <span className="status-dot" /> A LITTLE MORE FINANCIAL PEACE
          </span>
          <h2>
            Your money.
            <br />
            Your rules<span>.</span>
          </h2>
          <p>
            One card for the things you love.
            <br />A shield for the money you’ve earned.
          </p>
          <div className="auth-visual" aria-hidden="true">
            <div className="auth-orbit orbit-one" />
            <div className="auth-orbit orbit-two" />
            <div className="auth-floating-note">
              <span className="auth-note-icon">
                <ShieldCheck size={17} />
              </span>
              <div>
                <b>Price increase blocked</b>
                <small>Your money stayed put.</small>
              </div>
              <Check size={15} />
            </div>
            <div className="auth-preview-card">
              <div>
                <b>retrest ↗</b>
                <CreditCard size={22} />
              </div>
              <ShieldCheck
                className="auth-card-shield"
                size={54}
                strokeWidth={1}
              />
              <span className="auth-card-number">
                •••• &nbsp; •••• &nbsp; •••• &nbsp; 4289
              </span>
              <div className="auth-card-bottom">
                <span>ONE MASTER CARD</span>
                <span className="auth-card-circles">
                  <i />
                  <i />
                </span>
              </div>
            </div>
            <div className="auth-floating-pool">
              <Users size={17} />
              <div>
                <b>Better together.</b>
                <small>Your shared plans, sorted.</small>
              </div>
            </div>
          </div>
          <div className="auth-story-points">
            <span>
              <ShieldCheck size={16} /> Every merchant follows your rules
            </span>
            <span>
              <Sparkles size={16} /> Dollars only when you need them
            </span>
          </div>
        </div>
        <div className="auth-story-footer">
          <span>Made for a little less money admin.</span>
          <span>NGN + USD</span>
        </div>
      </aside>
      <div className="auth-content">
        <header className="auth-topbar">
          <Link href="/" className="auth-mobile-brand">
            retrest<span>.</span>
          </Link>
          <span className="preview-pill">
            <ShieldCheck size={13} /> SECURE ACCOUNT ACCESS
          </span>
          <div className="auth-topbar-actions">
            <ThemeToggle />
            <Link href="/support" className="auth-support-link" aria-label="Chat with us">
              <MessageCircle size={15} /> Chat with us <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>
        <main className="auth-main">{children}</main>
        <footer className="auth-content-footer">
          <ShieldCheck size={13} /> One card. Every subscription protected.
        </footer>
      </div>
    </div>
  );
}
