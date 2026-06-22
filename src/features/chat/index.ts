/**
 * Feature: chat (SPEC §7.11). Real-time messaging with recent history on join
 * and dedupe-by-id convergence.
 *
 * Modules (imported directly by path, matching the other features):
 *   store.ts                — Zustand store (hydrate + append, deduped by id)
 *   services/chatApi.ts     — REST history snapshot
 *   components/ChatPanel.tsx — the chat UI (list + composer)
 * Live delivery is wired in features/room/services/realtimeService.ts
 * (`chat:messagePosted`) and sending is done via the shared socket (`chat:send`).
 */
export {};
