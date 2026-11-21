"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, MessageCircle, Play, Plus } from "lucide-react";
import { workspacePages, type WorkspaceSection } from "@/lib/navigation";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";

/** Section title plus its primary actions. */
export function PageHeading({ section }: { section: WorkspaceSection }) {
  const { openDialog } = useWorkspace();
  const page = workspacePages[section];
  const accountPage = section === "settings" || section === "support";
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="status-dot" />
          {page.eyebrow}
        </div>
        <h1>
          {page.heading}
          <span>.</span>
        </h1>
        <p>{page.description}</p>
      </div>
      <div className="heading-actions">
        {accountPage ? (
          <Link href={section === "settings" ? "/support" : "/transactions"} className="button secondary">
            {section === "settings" ? <MessageCircle size={15} /> : <FileText size={15} />}{" "}
            {section === "settings" ? "Chat with us" : "View transactions"}
            <ArrowUpRight size={14} />
          </Link>
        ) : (
          <>
            <button className="button secondary" onClick={() => openDialog({ kind: "demo" })}>
              <Play size={14} fill="currentColor" /> Try a live demo
            </button>
            <button className="button primary" onClick={() => openDialog({ kind: section === "pools" ? "create-pool" : "fund" })}>
              <Plus size={17} />
              {section === "pools" ? "Create a pool" : "Fund wallet"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
