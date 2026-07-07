-- OrgNode.parentId FK: ON DELETE SET NULL → RESTRICT.
-- SET NULL silently orphans a deleted node's children to root with stale paths
-- that still prefix-match the old ancestor's grants (an authz hole). RESTRICT makes
-- the DB refuse the delete; the service pre-checks for a friendly error.
ALTER TABLE "OrgNode" DROP CONSTRAINT "OrgNode_parentId_fkey";
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
