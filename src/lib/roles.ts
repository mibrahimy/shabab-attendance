export function isAdmin(roles: string): boolean {
  return roles === "super_admin" || roles === "admin";
}

export function isSuperAdmin(roles: string): boolean {
  return roles === "super_admin";
}
