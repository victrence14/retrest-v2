"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, CircleHelp, ShieldCheck } from "lucide-react";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { Avatar, Brand } from "@/components/ui";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { PRIMARY_NAV, UTILITY_NAV } from "./navigation";

export function Sidebar({ section }: { section: WorkspaceSection }) {
  const { data, profile, account, openDialog } = useWorkspace();
  return (
    <aside className="sidebar">
      <Brand />
      <div className="workspace-label">
        YOUR WORKSPACE <span>PERSONAL</span>
      </div>
      <nav aria-label="Primary navigation">
        {PRIMARY_NAV.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`${workspacePages[id].href}?demo=1`}
            aria-label={label}
            aria-current={section === id ? "page" : undefined}
            className={"nav-item " + (section === id ? "selected" : "")}
          >
            <Icon size={19} />
            <span>{label}</span>
            {id === "shield" && <span className="nav-count">{data.subscriptions.length}</span>}
          </Link>
        ))}
      </nav>
      <div className="sidebar-utilities" aria-label="Account and activity">
        {UTILITY_NAV.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`${workspacePages[id].href}?demo=1`}
            aria-label={label}
            aria-current={section === id ? "page" : undefined}
            className={"nav-item " + (section === id ? "selected" : "")}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "support" && <span className="status-dot" />}
          </Link>
        ))}
      </div>
      <div className="sidebar-note">
        <div className="orbit-art">
          <span />
          <span />
          <span />
          <ShieldCheck size={34} />
          <i className="orbit-star">✧</i>
        </div>
        <h3>
          Your rules.
          <br />
          Always enforced.
        </h3>
        <p>A separate shield for every merchant. One powerful card.</p>
        <span className="mini-label">
          <span className="status-dot" /> MERCHANT RULES ONLINE
        </span>
      </div>
      <div className="sidebar-bottom">
        <button className="help-button" onClick={() => openDialog({ kind: "help" })}>
          <CircleHelp size={18} /> Help & how it works <ArrowUpRight size={15} />
        </button>
        <Link href="/settings?demo=1" className="profile-button" aria-label="Your profile">
          <Avatar name={profile.name} />
          <span>
            <b>{profile.name}</b>
            <small>{account ? "Account preview" : "Personal demo account"}</small>
          </span>
          <ChevronDown size={16} />
        </Link>
      </div>
    </aside>
  );
}
