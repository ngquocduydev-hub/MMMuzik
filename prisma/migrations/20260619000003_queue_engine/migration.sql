-- DropIndex
DROP INDEX "queue_items_room_id_idx";

-- AlterTable
ALTER TABLE "queue_items" ADD COLUMN     "added_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "added_by_nickname" VARCHAR(40) NOT NULL,
ADD COLUMN     "added_by_session_id" UUID NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "pb_current_duration_ms" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "duration_ms" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "provider_track_id" VARCHAR(64) NOT NULL,
ADD COLUMN     "resolved_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "thumbnail_url" VARCHAR(1024),
ADD COLUMN     "title" VARCHAR(300) NOT NULL;

-- CreateIndex
CREATE INDEX "queue_items_room_id_position_idx" ON "queue_items"("room_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_provider_provider_track_id_key" ON "tracks"("provider", "provider_track_id");
