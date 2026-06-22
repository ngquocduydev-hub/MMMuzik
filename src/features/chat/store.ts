import { create } from 'zustand';
import type { ChatMessageDto } from '@/shared/types';

/** Client-only, ephemeral system notice (join / leave / host change) — shown as a
 *  centered chip in the chat stream. NOT persisted and NOT on the wire; synthesized
 *  from existing realtime presence events (UI_V1_REFERENCE §5.12, §8.5). */
export interface SystemChatEvent {
  id: string;
  text: string;
  at: string; // ISO
}

const SYSTEM_CAP = 50;

interface ChatState {
  messages: ChatMessageDto[];
  systemEvents: SystemChatEvent[];
  /** Count of messages that arrived while the chat view was NOT on-screen
   *  (Feature 2 — unread badge). Reset to 0 the moment chat becomes visible. */
  unread: number;
  /** Whether the chat view is currently on-screen. Drives unread gating: messages
   *  that arrive while visible are seen immediately, so they never count as unread.
   *  Always true on desktop/tablet (chat is a permanent column); on mobile it tracks
   *  the active tab. */
  chatVisible: boolean;
  /** Replace from a history snapshot, deduped + ordered oldest-first by sentAt. */
  hydrate: (messages: ChatMessageDto[]) => void;
  /** Append one live message; idempotent — a repeat id (ack + broadcast) is ignored.
   *  Bumps `unread` only when the chat view is hidden. */
  append: (message: ChatMessageDto) => void;
  /** Append an ephemeral system notice (presence/host change). */
  pushSystem: (text: string) => void;
  /** Set chat on/off-screen. Becoming visible clears the unread count. */
  setChatVisible: (visible: boolean) => void;
  reset: () => void;
}

const sortBySentAt = (list: ChatMessageDto[]): ChatMessageDto[] =>
  [...list].sort((a, b) => a.sentAt.localeCompare(b.sentAt));

const dedupeById = (list: ChatMessageDto[]): ChatMessageDto[] => {
  const byId = new Map<string, ChatMessageDto>();
  for (const m of list) byId.set(m.id, m);
  return [...byId.values()];
};

/**
 * Chat is convergent: history snapshot + live broadcasts + the sender's own ack
 * all flow here and are deduped BY MESSAGE ID (REALTIME §6.5), so a message
 * never double-renders regardless of which path delivered it first. System events
 * are a separate client-only stream merged into the view by timestamp.
 */
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  systemEvents: [],
  unread: 0,
  chatVisible: false,
  hydrate: (messages) => set({ messages: sortBySentAt(dedupeById(messages)) }),
  append: (message) =>
    set((s) => {
      if (s.messages.some((m) => m.id === message.id)) return {}; // dupe → ignore (no unread bump)
      return {
        messages: sortBySentAt([...s.messages, message]),
        // Gated by visibility, not authorship: you can only send from the chat view
        // (visible → not counted), so this also naturally excludes your own messages.
        unread: s.chatVisible ? s.unread : s.unread + 1,
      };
    }),
  setChatVisible: (visible) =>
    set((s) =>
      visible ? { chatVisible: true, unread: 0 } : { chatVisible: false, unread: s.unread },
    ),
  pushSystem: (text) =>
    set((s) => {
      const evt: SystemChatEvent = {
        id: typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${text}`,
        text,
        at: new Date().toISOString(),
      };
      const next = [...s.systemEvents, evt];
      return { systemEvents: next.length > SYSTEM_CAP ? next.slice(-SYSTEM_CAP) : next };
    }),
  reset: () => set({ messages: [], systemEvents: [], unread: 0, chatVisible: false }),
}));
