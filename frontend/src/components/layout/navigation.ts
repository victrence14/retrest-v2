import {
  Activity,
  ChartNoAxesCombined,
  MessageCircle,
  Settings2,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceSection } from "@/lib/navigation";

export interface NavItem {
  id: WorkspaceSection;
  label: string;
  icon: LucideIcon;
}

/** Primary sections, shown in the sidebar and the mobile bottom bar. */
export const PRIMARY_NAV: NavItem[] = [
  { id: "shield", label: "Shield", icon: Shield },
  { id: "pools", label: "Pools", icon: Users },
  { id: "insights", label: "Insights", icon: ChartNoAxesCombined },
];

/** Account and activity links under the primary navigation. */
export const UTILITY_NAV: NavItem[] = [
  { id: "transactions", label: "Transactions", icon: Activity },
  { id: "settings", label: "Account settings", icon: Settings2 },
  { id: "support", label: "Chat with us", icon: MessageCircle },
];
