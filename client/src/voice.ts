import { create } from 'zustand';
import type { RoomView } from '@cotyphu/shared';
import { setRtcHandlers, useStore } from './store';

/**
 * Voice chat: WebRTC dạng lưới (mỗi cặp người chơi nối thẳng với nhau, âm thanh không qua server).
 * Tín hiệu (offer/answer/ICE) được chuyển qua WebSocket của phòng.
 * Người có id nhỏ hơn chủ động gửi offer để tránh hai bên cùng gọi.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

interface VoiceState {
  on: boolean;
  muted: boolean;
  connecting: boolean;
  error: string | null;
  /** Những người đang nói (theo id) */
  speaking: string[];
}

export const useVoice = create<VoiceState>(() => ({
  on: false,
  muted: false,
  connecting: false,
  error: null,
  speaking: [],
}));

let local: MediaStream | null = null;
const peers = new Map<string, RTCPeerConnection>();
const pendingIce = new Map<string, RTCIceCandidateInit[]>();
const audios = new Map<string, HTMLAudioElement>();
const meters = new Map<string, () => void>();
let audioCtx: AudioContext | null = null;

function send(to: string, data: Record<string, unknown>) {
  useStore.getState().send({ type: 'rtc', to, data });
}

function myId(): string | null {
  return useStore.getState().me;
}

/** Đo âm lượng để hiện biểu tượng "đang nói" */
function watchLevel(id: string, stream: MediaStream) {
  try {
    audioCtx ??= new AudioContext();
    const src = audioCtx.createMediaStreamSource(stream);
    const an = audioCtx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let alive = true;
    const loop = () => {
      if (!alive) return;
      an.getByteFrequencyData(buf);
      const level = buf.reduce((a, b) => a + b, 0) / buf.length;
      const speaking = level > 18;
      const cur = useVoice.getState().speaking;
      if (speaking && !cur.includes(id)) useVoice.setState({ speaking: [...cur, id] });
      if (!speaking && cur.includes(id))
        useVoice.setState({ speaking: cur.filter((x) => x !== id) });
      setTimeout(loop, 150);
    };
    loop();
    meters.get(id)?.();
    meters.set(id, () => {
      alive = false;
      src.disconnect();
    });
  } catch {
    /* trình duyệt không hỗ trợ: bỏ qua */
  }
}

function closePeer(id: string) {
  peers.get(id)?.close();
  peers.delete(id);
  pendingIce.delete(id);
  const a = audios.get(id);
  if (a) {
    a.srcObject = null;
    a.remove();
  }
  audios.delete(id);
  meters.get(id)?.();
  meters.delete(id);
  useVoice.setState((s) => ({ speaking: s.speaking.filter((x) => x !== id) }));
}

function createPeer(id: string): RTCPeerConnection {
  closePeer(id);
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peers.set(id, pc);
  if (local) for (const t of local.getTracks()) pc.addTrack(t, local);
  pc.onicecandidate = (e) => {
    if (e.candidate) send(id, { candidate: e.candidate.toJSON() });
  };
  pc.ontrack = (e) => {
    const stream = e.streams[0] ?? new MediaStream([e.track]);
    let a = audios.get(id);
    if (!a) {
      a = document.createElement('audio');
      a.autoplay = true;
      a.setAttribute('playsinline', '');
      a.style.display = 'none';
      document.body.appendChild(a);
      audios.set(id, a);
    }
    a.srcObject = stream;
    void a.play().catch(() => {});
    watchLevel(id, stream);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      // Thử lại: người chủ động gọi lại
      const me = myId();
      if (me && me < id && useVoice.getState().on) setTimeout(() => void call(id), 1500);
    }
  };
  return pc;
}

async function call(id: string) {
  const pc = createPeer(id);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send(id, { sdp: pc.localDescription?.toJSON() });
}

async function onSignal(from: string, data: Record<string, unknown>) {
  if (!useVoice.getState().on) return;
  const sdp = data.sdp as RTCSessionDescriptionInit | undefined;
  const cand = data.candidate as RTCIceCandidateInit | undefined;
  try {
    if (sdp) {
      let pc = peers.get(from);
      if (sdp.type === 'offer') pc = createPeer(from);
      if (!pc) return;
      await pc.setRemoteDescription(sdp);
      for (const c of pendingIce.get(from) ?? []) await pc.addIceCandidate(c);
      pendingIce.delete(from);
      if (sdp.type === 'offer') {
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        send(from, { sdp: pc.localDescription?.toJSON() });
      }
    } else if (cand) {
      const pc = peers.get(from);
      if (pc && pc.remoteDescription) await pc.addIceCandidate(cand);
      else pendingIce.set(from, [...(pendingIce.get(from) ?? []), cand]);
    }
  } catch (e) {
    console.warn('voice', e);
  }
}

/** Đồng bộ danh sách kết nối theo những người đang bật voice */
function onRoom(room: RoomView) {
  if (!useVoice.getState().on) return;
  const me = myId();
  if (!me) return;
  const inVoice = new Set(room.players.filter((p) => p.voice && p.id !== me).map((p) => p.id));
  for (const id of [...peers.keys()]) if (!inVoice.has(id)) closePeer(id);
  for (const id of inVoice) {
    if (!peers.has(id) && me < id) void call(id);
  }
}

setRtcHandlers((from, data) => void onSignal(from, data), onRoom);

export async function joinVoice() {
  if (useVoice.getState().on) return;
  useVoice.setState({ connecting: true, error: null });
  try {
    local = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    useVoice.setState({
      connecting: false,
      error: 'Không mở được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.',
    });
    return;
  }
  const me = myId();
  if (me) watchLevel(me, local);
  useVoice.setState({ on: true, muted: false, connecting: false });
  useStore.getState().send({ type: 'voice', on: true });
  const room = useStore.getState().room;
  if (room) onRoom(room);
}

export function leaveVoice() {
  for (const id of [...peers.keys()]) closePeer(id);
  const me = myId();
  if (me) {
    meters.get(me)?.();
    meters.delete(me);
  }
  local?.getTracks().forEach((t) => t.stop());
  local = null;
  useVoice.setState({ on: false, muted: false, speaking: [] });
  useStore.getState().send({ type: 'voice', on: false });
}

export function toggleMute() {
  const muted = !useVoice.getState().muted;
  local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  useVoice.setState({ muted });
}

// Mất kết nối rồi nối lại: báo lại server là mình vẫn đang bật voice
useStore.subscribe((s, prev) => {
  if (s.conn === 'open' && prev.conn !== 'open' && useVoice.getState().on) {
    s.send({ type: 'voice', on: true });
  }
  if (s.code === null && prev.code !== null && useVoice.getState().on) leaveVoice();
});
