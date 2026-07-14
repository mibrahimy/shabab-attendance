// Student-intake contracts shared by the intake RSC/service and the client list
// (ENGINEERING.md §7 — one type, both sides). Pure types; no React, no Prisma.

// One "class" (the student-attach leaf level) the caller may add shabab to, named
// by its head murabbi (SI-5) so the admin sees who the student lands under.
export type IntakeClass = {
  nodeId: string;
  name: string;
  pathLabel: string; // readable ancestor chain within the caller's scope (may be "")
  cityId: string;
  murabbiName: string | null; // the class's head murabbi, or null if unstaffed
  studentCount?: number; // active shabab currently in the class
};
