import { create } from 'zustand';
import type {
  ChatMessage,
  ClientMessage,
  GameEvent,
  PlayerAction,
  RoomView,
  ServerMessage,
} from '@cotyphu/shared';
import { playForEvents } from './sound';

type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface Session {
  playerId: string;
  secret: string;
}

const sessKey = (code: string) => `cotyphu:session:${code}`;
export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(sessKey(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(code: string, s: Session | null) {
  try {
    if (s) localStorage.setItem(sessKey(code), JSON.stringify(s));
    else localStorage.removeItem(sessKey(code));
  } catch {
    /* bỏ qua */
  }
}

export function savePref(key: string, v: string) {
  try {
    localStorage.setItem(`cotyphu:${key}`, v);
  } catch {
    /* bỏ qua */
  }
}
export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(`cotyphu:${key}`);
  } catch {
    return null;
  }
}

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

interface Store {
  code: string | null;
  conn: ConnState;
  room: RoomView | null;
  me: string | null;
  spectator: boolean;
  /** Lô sự kiện mới nhất (để animation) */
  events: { id: number; list: GameEvent[] };
  chat: ChatMessage[];
  toasts: Toast[];
  fatal: string | null;
  kicked: boolean;
  /** Chênh lệch đồng hồ server - client */
  clockOffset: number;
  /** Tab đang mở ở panel */
  tab: 'assets' | 'trade' | 'log' | 'chat';
  sheetOpen: boolean;
  unreadChat: number;
  tradeDraft: TradeDraft | null;
  openSquare: number | null;

  connect(code: string): void;
  disconnect(): void;
  send(m: ClientMessage): void;
  act(a: PlayerAction): void;
  toast(text: string, kind?: Toast['kind']): void;
  setTab(t: Store['tab']): void;
  setSheet(open: boolean): void;
  setTradeDraft(d: TradeDraft | null): void;
  setOpenSquare(i: number | null): void;
  onWelcome?: () => void;
}

export interface TradeDraft {
  to: string;
  giveCash: number;
  giveProps: number[];
  giveCards: number;
  takeCash: number;
  takeProps: number[];
  takeCards: number;
  counterOf?: string;
}

let ws: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pending: ClientMessage[] = [];
let wantOpen = false;
let toastSeq = 0;
let evSeq = 0;
/** Tin nhắn join gửi khi kết nối (do màn hình vào phòng đặt) */
let joinIntent: ClientMessage | null = null;

export function setJoinIntent(m: ClientMessage | null) {
  joinIntent = m;
}

export const useStore = create<Store>((set, get) => ({
  code: null,
  conn: 'idle',
  room: null,
  me: null,
  spectator: false,
  events: { id: 0, list: [] },
  chat: [],
  toasts: [],
  fatal: null,
  kicked: false,
  clockOffset: 0,
  tab: 'log',
  sheetOpen: false,
  unreadChat: 0,
  tradeDraft: null,
  openSquare: null,

  connect(code) {
    if (get().code === code && ws) return;
    get().disconnect();
    wantOpen = true;
    set({ code, conn: 'connecting', room: null, me: null, fatal: null, kicked: false, chat: [] });
    open(code);
  },

  disconnect() {
    wantOpen = false;
    if (retryTimer) clearTimeout(retryTimer);
    if (pingTimer) clearInterval(pingTimer);
    ws?.close();
    ws = null;
    set({ conn: 'idle', code: null });
  },

  send(m) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    else pending.push(m);
  },

  act(a) {
    get().send({ type: 'action', action: a });
  },

  toast(text, kind = 'info') {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },

  setTab(tab) {
    set({ tab, unreadChat: tab === 'chat' ? 0 : get().unreadChat });
  },
  setSheet(sheetOpen) {
    set({ sheetOpen, unreadChat: sheetOpen && get().tab === 'chat' ? 0 : get().unreadChat });
  },
  setTradeDraft(tradeDraft) {
    set({ tradeDraft });
  },
  setOpenSquare(openSquare) {
    set({ openSquare });
  },
}));

function open(code: string) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const sock = new WebSocket(`${proto}//${location.host}/ws/${code}`);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    useStore.setState({ conn: 'open' });
    const sess = loadSession(code);
    if (sess) sock.send(JSON.stringify({ type: 'resume', ...sess } satisfies ClientMessage));
    else if (joinIntent) sock.send(JSON.stringify(joinIntent));
    const q = pending;
    pending = [];
    for (const m of q) sock.send(JSON.stringify(m));
    if (pingTimer) clearInterval(pingTimer);
    // Giữ kết nối qua Cloudflare (cắt kết nối rảnh ~100 giây)
    pingTimer = setInterval(() => {
      if (sock.readyState === WebSocket.OPEN) sock.send('{"type":"ping"}');
    }, 25_000);
  };
  sock.onmessage = (e) => {
    let m: ServerMessage;
    try {
      m = JSON.parse(e.data as string) as ServerMessage;
    } catch {
      return;
    }
    handle(code, m);
  };
  sock.onclose = (e) => {
    if (ws !== sock) return;
    ws = null;
    if (pingTimer) clearInterval(pingTimer);
    if (!wantOpen || useStore.getState().kicked || useStore.getState().fatal) {
      useStore.setState({ conn: 'closed' });
      return;
    }
    if (e.code === 4001) {
      useStore.setState({ conn: 'closed', kicked: true });
      return;
    }
    useStore.setState({ conn: 'reconnecting' });
    const delay = Math.min(10_000, 500 * 2 ** retry++);
    retryTimer = setTimeout(() => open(code), delay);
  };
}

function handle(code: string, m: ServerMessage) {
  const st = useStore.getState();
  switch (m.type) {
    case 'welcome':
      if (m.playerId && m.secret) saveSession(code, { playerId: m.playerId, secret: m.secret });
      joinIntent = null;
      useStore.setState({ me: m.playerId, spectator: m.spectator });
      return;
    case 'room': {
      const events = m.events ?? [];
      useStore.setState({
        room: m.room,
        clockOffset: m.room.serverNow - Date.now(),
        chat: st.chat.length === 0 ? m.room.chat : st.chat,
        events: events.length ? { id: ++evSeq, list: events } : st.events,
      });
      if (events.length) playForEvents(events, st.me);
      // Mình không còn trong phòng (bị xoá ở sảnh)
      if (st.me && !m.room.players.some((p) => p.id === st.me)) {
        saveSession(code, null);
        useStore.setState({ me: null });
      }
      return;
    }
    case 'chat': {
      const visible = st.tab === 'chat' && (st.sheetOpen || window.innerWidth >= 1024);
      useStore.setState({
        chat: [...st.chat, m.message].slice(-100),
        unreadChat: visible ? 0 : st.unreadChat + 1,
      });
      return;
    }
    case 'error':
      if (m.message === 'Phiên cũ không còn hợp lệ') {
        saveSession(code, null);
        useStore.setState({ me: null });
        if (joinIntent) useStore.getState().send(joinIntent);
        return;
      }
      if (m.fatal) useStore.setState({ fatal: m.message });
      st.toast(m.message, 'error');
      return;
    case 'kicked':
      saveSession(code, null);
      useStore.setState({ kicked: true, me: null });
      return;
    case 'pong':
      return;
  }
}

export function forgetSession(code: string) {
  saveSession(code, null);
}

/** Giờ server hiện tại (ước lượng) */
export function serverNow(): number {
  return Date.now() + useStore.getState().clockOffset;
}
