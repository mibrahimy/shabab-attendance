-- One ACTIVE assignment per (person, position, node): a partial unique index so a
-- double-submit or re-provision can't create duplicate live grants (which would
-- double-count in rosters/member lists). Ended assignments (endDate set) are
-- history and exempt. Partial-unique isn't expressible in the Prisma schema, so
-- it's hand-maintained here (like the OrgNode path text_pattern_ops index).
CREATE UNIQUE INDEX "Assignment_active_unique"
  ON "Assignment" ("personId", "positionId", "orgNodeId")
  WHERE "endDate" IS NULL;
