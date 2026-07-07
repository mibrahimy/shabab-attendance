// Static catalog registry. Small JSON namespaces bundled directly (no HTTP
// backend) so both the server instance and the client provider share one source.

import type { Locale, Namespace } from "./config";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enAttendance from "./locales/en/attendance.json";
import enHierarchy from "./locales/en/hierarchy.json";
import enHome from "./locales/en/home.json";
import enRoles from "./locales/en/roles.json";
import enCities from "./locales/en/cities.json";
import urCommon from "./locales/ur/common.json";
import urAuth from "./locales/ur/auth.json";
import urAttendance from "./locales/ur/attendance.json";
import urHierarchy from "./locales/ur/hierarchy.json";
import urHome from "./locales/ur/home.json";
import urRoles from "./locales/ur/roles.json";
import urCities from "./locales/ur/cities.json";

type Bundle = Record<Namespace, Record<string, unknown>>;

export const resources: Record<Locale, Bundle> = {
  en: { common: enCommon, auth: enAuth, attendance: enAttendance, hierarchy: enHierarchy, home: enHome, roles: enRoles, cities: enCities },
  ur: { common: urCommon, auth: urAuth, attendance: urAttendance, hierarchy: urHierarchy, home: urHome, roles: urRoles, cities: urCities },
};
