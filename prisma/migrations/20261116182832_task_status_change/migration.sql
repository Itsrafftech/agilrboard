-- CreateTable
CREATE TABLE "TaskStatusChange" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaskStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStatusChange_projectId_sprintId_changedAt_idx" ON "TaskStatusChange"("projectId", "sprintId", "changedAt");

-- CreateIndex
CREATE INDEX "TaskStatusChange_taskId_changedAt_idx" ON "TaskStatusChange"("taskId", "changedAt");

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatusChange" ADD CONSTRAINT "TaskStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: one BASELINE snapshot per existing task. Before this migration no
-- status history was stored, so the real time of each task's last change is
-- unknown. These rows are flagged `isBaseline` so reports can say "history
-- starts here" instead of inventing earlier data.
INSERT INTO "TaskStatusChange" ("id", "taskId", "projectId", "sprintId", "fromStatus", "toStatus", "changedById", "changedAt", "isBaseline")
SELECT gen_random_uuid()::text, t."id", t."projectId", t."sprintId", NULL, t."status", t."creatorId", CURRENT_TIMESTAMP, true
FROM "Task" t;
