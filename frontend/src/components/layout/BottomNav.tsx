"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { PRIMARY_NAV } from "./navigation";

/** Mobile navigation bar. */
export function BottomNav({ section }: { section: WorkspaceSection }) {
  const { data, openDialog } = useWorkspace();
  return (
    <nav className="bottom-nav" aria-label="Dashboard navigation">
      {PRIMARY_NAV.map(({ id, label, icon: Icon }) => (
        <Link
          key={id}
          href={workspacePages[id].href}
          aria-label={label}
          aria-current={section === id ? "page" : undefined}
          className={"bottom-nav-item " + (section === id ? "selected" : "")}
        >
          <Icon size={20} />
          <span>{label}</span>
          {id === "pools" && (
            <i className="bottom-count" aria-hidden="true">
              {data.pools.length}
            </i>
          )}
        </Link>
      ))}
      <span className="nav-separator" />
      <button
        className="bottom-live"
        onClick={() => openDialog({ kind: "demo" })}
        aria-label="Open simulator"
      >
        <span className="status-dot" />
        <span>Shield active</span>
        <Zap size={15} />
      </button>
    </nav>
  );
}
