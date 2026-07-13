// Client-facing city-structure response contracts. Pure data shapes shared by the
// structure service (producer) and the levels editor (consumer) — kept in types/ so
// the frontend never imports from @/server.

export type ManagedLevel = {
  id: string; key: string; label: string; rank: number;
  color: string | null; headPositionKey: string | null;
  isCustom: boolean; nodeCount: number;
};

export type StructurePayload = {
  levels: ManagedLevel[];
  headRoleOptions: { key: string; label: string }[];
  colorOptions: string[];
};
