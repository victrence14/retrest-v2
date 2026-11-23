"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CreditCard,
  Globe,
  LockKeyhole,
  MessageCircle,
  Play,
  ShieldCheck,
  ShieldOff,
  Users,
  X,
  Zap,
} from "lucide-react";
import SupportChat from "@/features/support/components/SupportChat";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useToast } from "@/hooks/useToast";
import "../styles.css";

const subscriptions = [
  {
    name: "Netflix",
    plan: "Premium",
    amount: "₦7,000",
    logo: "N",
    color: "netflix",
    renewal: "In 3 days",
  },
  {
    name: "Spotify",
    plan: "Individual",
    amount: "₦1,300",
    logo: "≋",
    color: "spotify",
    renewal: "In 5 days",
  },
  {
    name: "ChatGPT Plus",
    plan: "Productivity",
    amount: "$20.00",
    logo: "✳",
    color: "chatgpt",
    renewal: "In 8 days",
  },
  {
    name: "AWS",
    plan: "Cloud services",
    amount: "$15.00",
    logo: "aws",
    color: "aws",
    renewal: "In 12 days",
  },
];

export default function LandingPage() {
  const { notify } = useToast();
  const [active, setActive] = useState([true, true, true, true]);
  const [event, setEvent] = useState(
    "Spotify demo charge approved. Your configured rules apply.",
  );
  const [chat, setChat] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (chat && !dialog.current?.open) dialog.current?.showModal();
  }, [chat]);

  function toggle(index: number) {
    setActive((previous) =>
      previous.map((value, i) => (i === index ? !value : value)),
    );
    setEvent(
      active[index]
        ? subscriptions[index].name +
            " paused. Future charges blocked; other merchants stay active."
        : subscriptions[index].name +
            " is active. Your price limit still applies.",
    );
    notify(`${subscriptions[index].name} ${active[index] ? "paused" : "activated"} in the demo preview.`);
  }

  return (
    <div className="landing-page fe2-marketing">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="RETREST home">
          <span className="brand-symbol">
            <ShieldCheck size={24} />
          </span>
          RETREST<span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Website navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Your shield</a>
          <Link href="/shield?demo=1&simulator=1">
            <Play size={13} /> Demo Simulator
          </Link>
        </nav>
        <div className="landing-header-actions">
          <ThemeToggle />
          <span className="landing-currencies">
            <span className="flag" /> NGN <span>/</span> USD
          </span>
          <button
            className="icon-button"
            aria-label="Open help articles"
            onClick={() => setChat(true)}
          >
            <MessageCircle size={19} />
          </button>
          <Link href="/login" className="landing-login">
            Log in <ArrowUpRight size={13} />
          </Link>
          <Link href="/shield?demo=1" className="button primary" data-product-cta>
            Open demo <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="hero-pill">
              <span className="status-dot" /> THE SUBSCRIPTION PAYMENT SHIELD{" "}
              <ArrowUpRight size={12} />
            </span>
            <h1>
              Your subscriptions.
              <br />
              Your money.
              <br />
              <span>Your rules.</span>
            </h1>
            <p>
              Explore recurring payment control with one demo card.
              <br className="desktop-br" /> Test merchant rules, split a plan,
              <br className="desktop-br" /> and download your business receipts.
            </p>
            <div className="hero-actions">
              <Link href="/shield?demo=1" className="button primary" data-product-cta>
                Launch the demo <ArrowUpRight size={17} />
              </Link>
              <Link href="/shield?demo=1&simulator=1" className="button secondary">
                <span className="play-circle">
                  <Play size={11} fill="currentColor" />
                </span>{" "}
                See your shield in action
              </Link>
            </div>
            <div className="hero-proof">
              <span className="hero-proof-icon">
                <ShieldCheck size={19} />
              </span>
              <span>
                Merchant rules checked on the server.
                <br />
                <b>Pause controls and price limits.</b>
              </span>
              <span className="hero-proof-divider" />
              <span className="hero-proof-icon">
                <Globe size={19} />
              </span>
              <span>
                Local roots. Global plans.
                <br />
                <b>NGN + USD, in one wallet.</b>
              </span>
            </div>
            <p className="fe2-marketing-status"><b>Explore the demo or create an account.</b> Account subscriptions, reports, device settings and support messages use the account API. Card issuance, wallet funding and FX in the demo are simulated.</p>
          </div>
          <div className="hero-product">
            <div className="preview-topline">
              <span>
                <span className="status-dot" /> YOUR PAYMENT COMMAND CENTER
              </span>
              <span>
                ILLUSTRATIVE PREVIEW <Activity size={12} />
              </span>
            </div>
            <div className="landing-virtual-card">
              <div className="card-top">
                <b>retrest ↗</b>
                <span className="card-active">
                  <span />
                  DEMO
                </span>
              </div>
              <div className="landing-card-middle">
                <div className="card-chip">
                  <span />
                  <span />
                  <span />
                </div>
                <ShieldCheck size={68} strokeWidth={0.75} />
                <span className="contactless">)))</span>
              </div>
              <div className="landing-card-number">
                •••• &nbsp; •••• &nbsp; •••• &nbsp; 4289
              </div>
              <div className="landing-card-bottom">
                <span>
                  ONE DEMO VIRTUAL CARD<small>ILLUSTRATIVE ACCOUNT</small>
                </span>
                <span className="mastercard-logo">
                  <i />
                  <i />
                </span>
              </div>
            </div>
            <div className="preview-subscriptions">
              <div className="preview-list-title">
                <span>
                  Connected subscriptions <b>4</b>
                </span>
                <small>YOUR SHIELD</small>
              </div>
              {subscriptions.map((subscription, index) => (
                <div key={subscription.name} className="preview-merchant">
                  <span className={"preview-logo " + subscription.color}>
                    {subscription.logo}
                  </span>
                  <span className="preview-merchant-name">
                    <b>{subscription.name}</b>
                    <small>
                      {subscription.plan} · {subscription.renewal}
                    </small>
                  </span>
                  <b className="preview-price">
                    {subscription.amount}
                    <small>/ month</small>
                  </b>
                  <button
                    role="switch"
                    aria-checked={active[index]}
                    aria-label={
                      (active[index] ? "Pause " : "Activate ") +
                      subscription.name +
                      " preview"
                    }
                    className={"toggle " + (active[index] ? "on" : "")}
                    onClick={() => toggle(index)}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </div>
            <div className="preview-event" role="status">
              <span>
                <ShieldCheck size={17} />
              </span>
              <div>
                <b>{event}</b>
                <small>
                  Preview your rules. Launch the app to run the authorization
                  engine.
                </small>
              </div>
            </div>
            <div className="floating-security">
              <LockKeyhole size={14} />
              <span>ONE CARD. EVERY MERCHANT PROTECTED.</span>
            </div>
          </div>
        </section>
        <div className="merchant-marquee">
          <span>
            FOR THE PLANS
            <br />
            <b>YOU LIVE ON.</b>
          </span>
          <b className="marquee-netflix">NETFLIX</b>
          <b className="marquee-spotify">◉ Spotify</b>
          <b>✳ OpenAI</b>
          <b className="marquee-aws">
            aws<span>⌣</span>
          </b>
          <b className="marquee-canva">Canva</b>
          <b className="marquee-youtube">▶ YouTube</b>
        </div>
        <section className="landing-features" id="features">
          <div className="landing-section-heading">
            <div>
              <div className="eyebrow">A LITTLE MORE FINANCIAL CONTROL</div>
              <h2>
                Your card should
                <br />
                work on <span>your terms.</span>
              </h2>
            </div>
            <p>
              A calendar can remind you a charge is coming.
              <br />
              RETREST checks the charge before it goes through.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon red">
                <ShieldOff size={24} />
              </span>
              <small>01 / MERCHANT CONTROL</small>
              <h3>
                One tap.
                <br />
                No more charges.
              </h3>
              <p>
                Pause Netflix without touching Spotify. Each merchant has its
                own Kill Switch in the server-backed demo.
              </p>
              <div className="feature-example">
                <span>Netflix</span>
                <span className="badge red">
                  <ShieldOff size={11} /> PAUSED
                </span>
              </div>
            </article>
            <article className="feature-card">
              <span className="feature-icon emerald">
                <ShieldCheck size={24} />
              </span>
              <small>02 / PRICE-HIKE SHIELD</small>
              <h3>
                Surprise prices?
                <br />
                Blocked.
              </h3>
              <p>
                You set the maximum. A merchant raises its price? Your shield
                declines it and asks you first.
              </p>
              <div className="feature-example">
                <span>
                  ₦1,300 <ArrowRight size={11} /> ₦1,560
                </span>
                <span className="badge red">+20% BLOCKED</span>
              </div>
            </article>
            <article className="feature-card">
              <span className="feature-icon cyan">
                <Globe size={24} />
              </span>
              <small>03 / SMART TREASURY</small>
              <h3>
                Naira in.
                <br />
                Dollars on demand.
              </h3>
              <p>
                Demo Auto-FX converts only the USD shortfall when a global
                subscription charges, using a simulated quote.
              </p>
              <div className="feature-example">
                <span>
                  NGN <ArrowRight size={12} /> USD
                </span>
                <span className="badge amber">
                  <Zap size={11} /> JUST IN TIME
                </span>
              </div>
            </article>
            <article className="feature-card">
              <span className="feature-icon indigo">
                <Users size={24} />
              </span>
              <small>04 / SHARED POOLS</small>
              <h3>
                Share the plan.
                <br />
                Split the cost.
              </h3>
              <p>
                Equal or custom shares, one invite link. Simulated contributions
                fund the pool; you choose how to cover any gap.
              </p>
              <div className="feature-example">
                <span className="mini-avatar-stack">
                  <i>AO</i>
                  <i>TA</i>
                  <i>CE</i>
                </span>
                <span className="badge green">3 / 3 PAID</span>
              </div>
            </article>
          </div>
        </section>
        <section className="authorization-showcase" id="how-it-works">
          <div>
            <span className="hero-pill">
              <Zap size={13} /> BUILT AROUND THE PAYMENT
            </span>
            <h2>
              The shield acts
              <br />
              before money moves.
            </h2>
            <p>
              The demo authorization engine checks merchant rules, available
              funding and price limits before recording a decision. Card
              issuance and provider settlement are future integrations.
            </p>
            <Link href="/shield?demo=1&simulator=1" className="text-button">
              Try a server-backed demo decision <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="authorization-flow">
            <div>
              <span className="flow-icon">
                <CreditCard size={20} />
              </span>
              <span>
                <b>Incoming merchant charge</b>
                <small>SPOTIFY · ₦1,300 · NGN</small>
              </span>
              <ChevronRight size={17} />
            </div>
            <span className="flow-connector" />
            <div className="flow-rule">
              <span className="flow-icon">
                <ShieldCheck size={20} />
              </span>
              <span>
                <b>Your merchant rules</b>
                <small>Active shield · Within limit · Funds available</small>
              </span>
              <Check size={17} />
            </div>
            <span className="flow-connector" />
            <div className="flow-approved">
              <span className="flow-icon">
                <Check size={20} />
              </span>
              <span>
                <b>200 · APPROVED</b>
                <small>Receipt generated. Renewal advanced by 30 days.</small>
              </span>
              <span className="badge green">DEMO RESULT</span>
            </div>
          </div>
        </section>
        <section className="landing-final-cta">
          <span className="brand-symbol">
            <ShieldCheck size={32} />
          </span>
          <div className="eyebrow">LESS MONEY ADMIN. MORE LIVING.</div>
          <h2>
            A little more
            <br />
            <span>financial peace.</span>
          </h2>
          <p>Explore your subscription rules in the product demo.</p>
          <Link href="/shield?demo=1" className="button primary" data-product-cta>
            Explore the product demo <ArrowRight size={16} />
          </Link>
          <Link href="/signup" className="text-button">
            Create an account <ArrowUpRight size={14} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" className="landing-brand">
          <ShieldCheck size={20} />
          RETREST.
        </Link>
        <span>Made for Nigeria. Ready for your world.</span>
        <span>Buildathon demo · Issuance, funding & FX simulated.</span>
      </footer>
      {chat && (
        <dialog
          ref={dialog}
          className="standalone-dialog"
          aria-label="Help articles"
          onClose={() => setChat(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current?.close();
          }}
        >
          <div className="standalone-dialog-content">
            <button
              className="modal-close icon-button"
              aria-label="Close help"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
            <SupportChat name="You" />
          </div>
        </dialog>
      )}
    </div>
  );
}
