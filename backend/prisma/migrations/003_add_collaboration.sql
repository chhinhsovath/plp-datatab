-- Migration: Add collaboration features
-- This migration adds tables and columns for project collaboration, comments, and activity tracking

-- Add collaboration tables that might be missing
CREATE TABLE IF NOT EXISTS "project_collaborators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" "CollaboratorRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_collaborators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "details" JSONB NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- Add isArchived column to projects if it doesn't exist
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- Create unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "project_collaborators_user_id_project_id_key" ON "project_collaborators"("user_id", "project_id");

-- Add foreign key constraints
ALTER TABLE "project_collaborators" ADD CONSTRAINT IF NOT EXISTS "project_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_collaborators" ADD CONSTRAINT IF NOT EXISTS "project_collaborators_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comments" ADD CONSTRAINT IF NOT EXISTS "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT IF NOT EXISTS "comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT IF NOT EXISTS "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "activities" ADD CONSTRAINT IF NOT EXISTS "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT IF NOT EXISTS "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "project_collaborators_project_id_idx" ON "project_collaborators"("project_id");
CREATE INDEX IF NOT EXISTS "project_collaborators_user_id_idx" ON "project_collaborators"("user_id");
CREATE INDEX IF NOT EXISTS "comments_project_id_idx" ON "comments"("project_id");
CREATE INDEX IF NOT EXISTS "comments_parent_id_idx" ON "comments"("parent_id");
CREATE INDEX IF NOT EXISTS "activities_project_id_idx" ON "activities"("project_id");
CREATE INDEX IF NOT EXISTS "activities_created_at_idx" ON "activities"("created_at");
CREATE INDEX IF NOT EXISTS "projects_is_archived_idx" ON "projects"("is_archived");