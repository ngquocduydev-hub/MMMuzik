import { create } from 'zustand';

/**
 * Per-client preference: show DESKTOP notifications for new chat messages while the
 * tab is in the background. Persisted to localStorage (a device choice, not server
 * state). Independent of the in-app unread badge and the tab-title badge — those
 * need no permission; this gates the OS-level Notification only.
 */
const KEY = 'mmmuzik:chat-notify';

interface ChatNotifyState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useChatNotifyStore = create<ChatNotifyState>((set) => ({
  // Default ON — only off when the user explicitly turned it off ('0').
  enabled: typeof window === 'undefined' || window.localStorage.getItem(KEY) !== '0',
  setEnabled: (enabled) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, enabled ? '1' : '0');
    set({ enabled });
  },
}));
