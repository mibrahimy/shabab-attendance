-- Team attendance: an event's roster is either its directly-assigned members
-- (default, unchanged behaviour) or the anchor node's DERIVED TEAM — the node's
-- own head plus the heads of its direct children (e.g. a park event whose roster
-- is the park lead + each child class's murabbi). Additive + reversible: every
-- existing event keeps the default 'members' mode, so no data or behaviour changes.

CREATE TYPE "RosterMode" AS ENUM ('members', 'team');

ALTER TABLE "Event" ADD COLUMN "rosterMode" "RosterMode" NOT NULL DEFAULT 'members';
