-- Room visibility (Public / Private). Public rooms are discoverable in the
-- browse list and join in one click; Private rooms are hidden and join by code
-- only. Existing rooms default to 'public'.

-- CreateEnum
CREATE TYPE "room_visibility" AS ENUM ('public', 'private');

-- AlterTable: add visibility with a default so pre-existing rows are valid.
ALTER TABLE "rooms" ADD COLUMN "visibility" "room_visibility" NOT NULL DEFAULT 'public';

-- CreateIndex: backs the public-list query + the inactive-room reaper scan.
CREATE INDEX "rooms_visibility_status_last_activity_at_idx"
  ON "rooms"("visibility", "status", "last_activity_at");
