import { LockKeyhole } from "lucide-react";
import { Brand } from "@/components/ui";

export function PageFooter() {
  return (
    <footer className="page-footer">
      <span>
        <Brand compact /> A little more financial peace.
      </span>
      <span>
        <LockKeyhole size={12} /> Your rules, enforced in real time <span className="footer-dot">·</span> Buildathon demo
      </span>
    </footer>
  );
}
