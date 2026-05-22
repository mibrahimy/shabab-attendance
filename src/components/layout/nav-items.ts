import { isAdmin, isSuperAdmin } from "@/lib/roles";

export type NavItem = {
  label: string;
  href: string;
  /** SVG path `d` attribute for the icon */
  iconPath: string;
  /** If true, only shown to admin/super_admin users */
  adminOnly?: boolean;
  /** If true, only shown to super_admin users */
  superAdminOnly?: boolean;
  /** If true, shown directly in the bottom nav; otherwise in the "More" sheet */
  primary?: boolean;
};

/** Filter nav items based on the user's role string. */
export function getVisibleNavItems(userRoles: string): NavItem[] {
  const admin = isAdmin(userRoles);
  const superAdmin = isSuperAdmin(userRoles);
  return NAV_ITEMS.filter(
    (item) =>
      (!item.adminOnly || admin) && (!item.superAdminOnly || superAdmin)
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    iconPath:
      "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    primary: true,
  },
  {
    label: "Team",
    href: "/team",
    iconPath:
      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    primary: true,
  },
  {
    label: "Events",
    href: "/events",
    iconPath:
      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    primary: true,
  },
  {
    label: "Attendance",
    href: "/attendance",
    iconPath:
      "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    primary: true,
  },
  {
    label: "Users",
    href: "/users",
    iconPath:
      "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
    adminOnly: true,
  },
  {
    label: "Analytics",
    href: "/analytics",
    iconPath:
      "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];
