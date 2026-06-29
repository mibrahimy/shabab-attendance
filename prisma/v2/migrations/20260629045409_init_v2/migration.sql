-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('junior', 'senior');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('pending', 'active', 'rejected');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'excused');

-- CreateTable
CREATE TABLE "CanonicalNodeType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "CanonicalNodeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeType" (
    "id" TEXT NOT NULL,
    "cityId" TEXT,
    "canonicalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalPosition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "CanonicalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "cityId" TEXT,
    "canonicalId" TEXT NOT NULL,
    "functionId" TEXT,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Function" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Function_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionPermission" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "PositionPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "typeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "countryId" TEXT,
    "cityId" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnic" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "segment" "Segment",
    "status" "PersonStatus" NOT NULL DEFAULT 'pending',
    "cityId" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "orgNodeId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "cityId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orgNodeId" TEXT NOT NULL,
    "rosterDepth" INTEGER DEFAULT 1,
    "segment" "Segment",
    "audiencePositionId" TEXT,
    "programId" TEXT,
    "functionId" TEXT,
    "cityId" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedById" TEXT,
    "overrideReason" TEXT,
    "clientUpdatedAt" TIMESTAMP(3),
    "legacyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalNodeType_key_key" ON "CanonicalNodeType"("key");

-- CreateIndex
CREATE INDEX "NodeType_cityId_idx" ON "NodeType"("cityId");

-- CreateIndex
CREATE INDEX "NodeType_canonicalId_idx" ON "NodeType"("canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeType_cityId_canonicalId_key" ON "NodeType"("cityId", "canonicalId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalPosition_key_key" ON "CanonicalPosition"("key");

-- CreateIndex
CREATE INDEX "Position_cityId_idx" ON "Position"("cityId");

-- CreateIndex
CREATE INDEX "Position_canonicalId_idx" ON "Position"("canonicalId");

-- CreateIndex
CREATE INDEX "Position_functionId_idx" ON "Position"("functionId");

-- CreateIndex
CREATE UNIQUE INDEX "Function_key_key" ON "Function"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "PositionPermission_permissionId_idx" ON "PositionPermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionPermission_positionId_permissionId_key" ON "PositionPermission"("positionId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgNode_path_key" ON "OrgNode"("path");

-- CreateIndex
CREATE UNIQUE INDEX "OrgNode_legacyId_key" ON "OrgNode"("legacyId");

-- CreateIndex
CREATE INDEX "OrgNode_parentId_idx" ON "OrgNode"("parentId");

-- CreateIndex
CREATE INDEX "OrgNode_typeId_idx" ON "OrgNode"("typeId");

-- CreateIndex
CREATE INDEX "OrgNode_cityId_idx" ON "OrgNode"("cityId");

-- CreateIndex
-- text_pattern_ops so subtree scoping `WHERE path LIKE '/…/anchor/%'` uses the
-- index regardless of the database's default collation (see ENGINEERING.md §12 /
-- target-architecture.html point 20: materialized-path prefix scan).
CREATE INDEX "OrgNode_path_idx" ON "OrgNode" ("path" text_pattern_ops);

-- CreateIndex
CREATE UNIQUE INDEX "Person_cnic_key" ON "Person"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "Person_legacyId_key" ON "Person"("legacyId");

-- CreateIndex
CREATE INDEX "Person_cityId_idx" ON "Person"("cityId");

-- CreateIndex
CREATE INDEX "Person_status_idx" ON "Person"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_legacyId_key" ON "Assignment"("legacyId");

-- CreateIndex
CREATE INDEX "Assignment_personId_idx" ON "Assignment"("personId");

-- CreateIndex
CREATE INDEX "Assignment_orgNodeId_idx" ON "Assignment"("orgNodeId");

-- CreateIndex
CREATE INDEX "Assignment_positionId_idx" ON "Assignment"("positionId");

-- CreateIndex
CREATE INDEX "Assignment_endDate_idx" ON "Assignment"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Program_name_key" ON "Program"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Program_legacyId_key" ON "Program"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_legacyId_key" ON "Event"("legacyId");

-- CreateIndex
CREATE INDEX "Event_orgNodeId_idx" ON "Event"("orgNodeId");

-- CreateIndex
CREATE INDEX "Event_cityId_idx" ON "Event"("cityId");

-- CreateIndex
CREATE INDEX "Event_scheduledAt_idx" ON "Event"("scheduledAt");

-- CreateIndex
CREATE INDEX "Event_programId_idx" ON "Event"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_legacyId_key" ON "Attendance"("legacyId");

-- CreateIndex
CREATE INDEX "Attendance_eventId_idx" ON "Attendance"("eventId");

-- CreateIndex
CREATE INDEX "Attendance_personId_idx" ON "Attendance"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_eventId_personId_key" ON "Attendance"("eventId", "personId");

-- AddForeignKey
ALTER TABLE "NodeType" ADD CONSTRAINT "NodeType_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "CanonicalNodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "CanonicalPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "Function"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPermission" ADD CONSTRAINT "PositionPermission_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionPermission" ADD CONSTRAINT "PositionPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgNode" ADD CONSTRAINT "OrgNode_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_orgNodeId_fkey" FOREIGN KEY ("orgNodeId") REFERENCES "OrgNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_audiencePositionId_fkey" FOREIGN KEY ("audiencePositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "Function"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
