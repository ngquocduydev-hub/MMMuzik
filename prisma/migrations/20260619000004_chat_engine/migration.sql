-- Chat engine (SPEC §7.11): promote the chat_messages placeholder to its
-- documented shape (docs/DATABASE.md §chat_messages). The table was created by
-- the init migration with only (id, room_id, session_id, created_at, updated_at)
-- and was never written to, so this is a safe, additive transform.

-- session_id is stored but no longer FK-enforced, so chat history survives
-- session cleanup (docs/DATABASE.md §relationships).
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_session_id_fkey";

-- Replace the audit columns the placeholder carried with the chat columns.
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "created_at";
ALTER TABLE "chat_messages" DROP COLUMN IF EXISTS "updated_at";

-- New columns. nickname/body are added with a transient default to satisfy
-- NOT NULL on any pre-existing rows, then the default is dropped to match the
-- Prisma schema (which declares no default for these two).
ALTER TABLE "chat_messages" ADD COLUMN "nickname"   VARCHAR(40)   NOT NULL DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN "body"       VARCHAR(2000) NOT NULL DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN "sent_at"    TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "chat_messages" ADD COLUMN "is_deleted" BOOLEAN       NOT NULL DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN "deleted_at" TIMESTAMPTZ;

ALTER TABLE "chat_messages" ALTER COLUMN "nickname" DROP DEFAULT;
ALTER TABLE "chat_messages" ALTER COLUMN "body" DROP DEFAULT;

-- Body length guard (docs/DATABASE.md CHECK ck_chat_body_len).
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "ck_chat_body_len" CHECK (char_length("body") BETWEEN 1 AND 2000);

-- Swap the plain room_id index for the (room_id, sent_at) recent-history index.
DROP INDEX IF EXISTS "chat_messages_room_id_idx";
CREATE INDEX "chat_messages_room_id_sent_at_idx" ON "chat_messages"("room_id", "sent_at");
