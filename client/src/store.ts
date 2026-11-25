import { create } from 'zustand';
import type {
  ChatMessage,
  ClientMessage,
  GameEvent,
  PlayerAction,
  RoomView,
  ServerMessage,
} from '@cotyphu/shared';
import { PROTOCOL_VERSION } from '@cotyphu/shared';
import { playForEvents } from './sound';

type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface Auth {
  token: string;
  username: string;
}

const AUTH_KEY = 'cotyphu:auth';
export function loadAuth(): Auth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Auth) : null;
  } catch {
    return null;
  }
}
export function saveAuth(a: Auth | null) {
  try {
    if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* bỏ qua */
  }
  useStore.setState({ auth: a });
}

/** fetch kèm token đăng nhập; 401 thì đăng xuất */
export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const a = useStore.getState().auth;
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(a ? { authorization: `Bearer ${a.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  if (res.status === 401 && a && !path.startsWith('/api/auth/')) saveAuth(null);
  if (res.status === 403 && (data as { gate?: boolean }).gate) useStore.setState({ gate: false });
  return { ok: res.ok, status: res.status, data };
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

/** Thông báo trả tiền giữa người chơi (cả phòng cùng thấy) */
export interface PayNotice {
  id: number;
  from: string;
  to: string;
  amount: number;
  reason: string;
  pos?: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'error' | 'info';
}

interface Store {
  /** Hình bàn cờ: thoi (người chơi ở 4 góc) hoặc vuông */
  boardShape: 'diamond' | 'square' | '3d';
  setBoardShape(v: 'diamond' | 'square' | '3d'): void;
  /** Đã báo danh (null = đang kiểm tra) */
  gate: boolean | null;
  auth: Auth | null;
  code: string | null;
  conn: ConnState;
  room: RoomView | null;
  me: string | null;
  spectator: boolean;
  /** Lô sự kiện mới nhất (để animation) */
  events: { id: number; list: GameEvent[] };
  chat: ChatMessage[];
  toasts: Toast[];
  notices: PayNotice[];
  fatal: string | null;
  kicked: boolean;
  /** Máy chủ đang chạy bản cũ hơn giao diện (đang deploy) */
  serverOutdated: boolean;
  /** Chênh lệch đồng hồ server - client */
  clockOffset: number;
  /** Tab đang mở ở panel */
  tab: 'assets' | 'trade' | 'loan' | 'chat';
  sheetOpen: boolean;
  unreadChat: number;
  tradeDraft: TradeDraft | null;
  openSquare: number | null;
  /** Server đã trả lời lệnh resume */
  resumeChecked: boolean;

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
  boardShape: (() => {
    try {
      const v = localStorage.getItem('cotyphu:shape');
      if (v === 'square' || v === 'diamond' || v === '3d') return v;
    } catch {
      /* bỏ qua */
    }
    // Mặc định: điện thoại cầm dọc (màn hẹp) dùng bàn vuông cho ô to; còn lại bàn thoi
    return typeof window !== 'undefined' && window.innerWidth < 520 ? 'square' : 'diamond';
  })(),
  setBoardShape(boardShape) {
    try {
      localStorage.setItem('cotyphu:shape', boardShape);
    } catch {
      /* bỏ qua */
    }
    set({ boardShape });
  },
  gate: null,
  auth: loadAuth(),
  code: null,
  conn: 'idle',
  room: null,
  me: null,
  spectator: false,
  events: { id: 0, list: [] },
  chat: [],
  toasts: [],
  notices: [],
  fatal: null,
  kicked: false,
  serverOutdated: false,
  clockOffset: 0,
  tab: 'assets',
  sheetOpen: false,
  unreadChat: 0,
  tradeDraft: null,
  openSquare: null,
  resumeChecked: false,

  connect(code) {
    if (get().code === code && ws) return;
    get().disconnect();
    wantOpen = true;
    set({
      code,
      conn: 'connecting',
      room: null,
      me: null,
      fatal: null,
      kicked: false,
      chat: [],
      resumeChecked: false,
    });
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
  const token = useStore.getState().auth?.token ?? '';
  const sock = new WebSocket(
    `${proto}//${location.host}/ws/${code}?token=${encodeURIComponent(token)}`,
  );
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    useStore.setState({ conn: 'open' });
    // Vào lại ghế của tài khoản (nếu có); không có thì gửi lệnh vào phòng nếu đã chọn
    sock.send(JSON.stringify({ type: 'resume' } satisfies ClientMessage));
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

/**
 * Client và máy chủ phải cùng phiên bản giao thức (lệch khi vừa deploy).
 * Máy chủ mới hơn → tải lại trang để lấy giao diện mới (1 lần mỗi phiên bản).
 * Máy chủ cũ hơn (deploy chưa xong) → báo đang cập nhật, không cho thao tác sai.
 */
function checkVersion(server: number) {
  if (server === PROTOCOL_VERSION) {
    if (useStore.getState().serverOutdated) useStore.setState({ serverOutdated: false });
    return;
  }
  if (server > PROTOCOL_VERSION) {
    try {
      const key = `cotyphu:reload-v${server}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        location.reload();
        return;
      }
    } catch {
      /* bỏ qua */
    }
  }
  if (!useStore.getState().serverOutdated) useStore.setState({ serverOutdated: true });
}

function handle(code: string, m: ServerMessage) {
  const st = useStore.getState();
  switch (m.type) {
    case 'welcome':
      if (!m.playerId && !m.spectator) {
        // Chưa có ghế: nếu người dùng đã bấm "Vào phòng" thì gửi lệnh
        useStore.setState({ me: null, resumeChecked: true });
        if (joinIntent) useStore.getState().send(joinIntent);
        return;
      }
      joinIntent = null;
      useStore.setState({ me: m.playerId, spectator: m.spectator, resumeChecked: true });
      return;
    case 'room': {
      checkVersion(m.room.v ?? 1);
      const events = m.events ?? [];
      useStore.setState({
        room: m.room,
        clockOffset: m.room.serverNow - Date.now(),
        chat: st.chat.length === 0 ? m.room.chat : st.chat,
        events: events.length ? { id: ++evSeq, list: events } : st.events,
      });
      if (events.length) playForEvents(events, st.me);
      pushPayNotices(events);
      // Mình không còn trong phòng (bị xoá ở sảnh)
      if (st.me && !m.room.players.some((p) => p.id === st.me)) useStore.setState({ me: null });
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
      if (m.fatal) useStore.setState({ fatal: m.message });
      st.toast(m.message, 'error');
      return;
    case 'kicked':
      useStore.setState({ kicked: true, me: null });
      return;
    case 'pong':
      return;
  }
}

/** Giờ server hiện tại (ước lượng) */
export function serverNow(): number {
  return Date.now() + useStore.getState().clockOffset;
}

/** Hỏi server đã báo danh chưa (cookie) */
export async function checkGate() {
  try {
    const res = await fetch('/api/gate');
    const d = (await res.json()) as { ok?: boolean };
    useStore.setState({ gate: !!d.ok });
  } catch {
    useStore.setState({ gate: false });
  }
}

let noticeSeq = 0;
/** Tạo thông báo cho các khoản trả tiền giữa người chơi (tiền thuê, lì xì, trả nợ…) */
function pushPayNotices(events: GameEvent[]) {
  for (const e of events) {
    if (e.t !== 'pay' || e.to === 'bank' || e.to === 'jackpot') continue;
    const n: PayNotice = {
      id: ++noticeSeq,
      from: e.from,
      to: e.to,
      amount: e.amount,
      reason: e.reason,
      pos: e.pos,
    };
    useStore.setState((s) => ({ notices: [...s.notices.slice(-2), n] }));
    setTimeout(
      () => useStore.setState((s) => ({ notices: s.notices.filter((x) => x.id !== n.id) })),
      4200,
    );
  }
}
