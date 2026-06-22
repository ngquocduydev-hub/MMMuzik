-- CreateEnum
CREATE TYPE "participant_role" AS ENUM ('host', 'member');

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "avatar" VARCHAR(512),
ADD COLUMN     "disconnected_at" TIMESTAMPTZ,
ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nickname" VARCHAR(40) NOT NULL,
ADD COLUMN     "role" "participant_role" NOT NULL DEFAULT 'member';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "closed_at" TIMESTAMPTZ,
ADD COLUMN     "code" VARCHAR(8) NOT NULL,
ADD COLUMN     "host_session_id" UUID NOT NULL,
ADD COLUMN     "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "name" VARCHAR(80) NOT NULL,
ADD COLUMN     "pb_current_item_id" UUID,
ADD COLUMN     "pb_position_ms" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "pb_revision" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "pb_updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "avatar" VARCHAR(512),
ADD COLUMN     "display_name" VARCHAR(40) NOT NULL,
ADD COLUMN     "expires_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "participants_room_id_joined_at_idx" ON "participants"("room_id", "joined_at");

-- CreateIndex
CREATE INDEX "participants_disconnected_at_idx" ON "participants"("disconnected_at");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");

-- CreateIndex
CREATE INDEX "rooms_status_last_activity_at_idx" ON "rooms"("status", "last_activity_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
