import { useEffect, useState } from 'react';
import { TOKENS, type ClientMessage, type TokenId } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { api, loadPref, savePref, setJoinIntent, useStore } from '../store';
import { navigate } from '../router';
import { GameScreen } from './GameScreen';
import { Lobby, TokenPicker } from './Lobby';
import { Btn, Panel } from './ui';

interface Info {
  status: 'lobby' | 'playing' | 'ended';
  hasPassword: boolean;
  takenTokens: TokenId[];
  players: string[];
  full: boolean;
}

export function RoomPage({ code }: { code: string }) {
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const room = useStore((s) => s.room);
  const me = useStore((s) => s.me);
  const spectator = useStore((s) => s.spectator);
  const conn = useStore((s) => s.conn);
  const kicked = useStore((s) => s.kicked);
  const serverOutdated = useStore((s) => s.serverOutdated);
  const fatal = useStore((s) => s.fatal);
  const resumeChecked = useStore((s) => s.resumeChecked);

  useEffect(() => {
    connect(code);
    return () => {
      disconnect();
    };
  }, [code, connect, disconnect]);

  let body;
  if (kicked || fatal) {
    body = (
      <Center>
        <div className="mb-3 text-lg font-semibold">{kicked ? S.conn.kicked : fatal}</div>
        <Btn onClick={() => navigate('/')}>{S.join.backHome}</Btn>
      </Center>
    );
  } else if (room && (me || spectator)) {
    body =
      room.status === 'lobby' && me ? <Lobby /> : room.game ? <GameScreen /> : <SpectatorLobby />;
  } else if (!resumeChecked && conn !== 'closed') {
    body = <Center>{S.conn.connecting}</Center>;
  } else {
    body = <JoinForm code={code} />;
  }

  return (
    <>
      {body}
      {serverOutdated && (
        <div className="fixed inset-x-2 top-2 z-[70] mx-auto max-w-md rounded-2xl bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-white shadow">
          {S.conn.serverOutdated}{' '}
          <button type="button" className="underline" onClick={() => location.reload()}>
            {S.conn.reload}
          </button>
        </div>
      )}
      {(conn === 'reconnecting' || conn === 'connecting') && (me || spectator) && (
        <div className="fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-full bg-gray-900 px-4 py-1.5 text-sm text-white shadow">
          {conn === 'connecting' ? S.conn.connecting : S.conn.reconnecting}
        </div>
      )}
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}

function SpectatorLobby() {
  const room = useStore((s) => s.room);
  return (
    <Center>
      <div className="text-lg font-semibold">👀 {S.game.spectating}</div>
      <div className="mt-2 text-sm text-gray-500">{S.lobby.waitingHost}</div>
      <div className="mt-2">{room?.players.map((p) => p.name).join(', ')}</div>
    </Center>
  );
}

function JoinForm({ code }: { code: string }) {
  const send = useStore((s) => s.send);
  const [info, setInfo] = useState<Info | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [token, setToken] = useState<TokenId | null>(null);
  const [password, setPassword] = useState('');
  const room = useStore((s) => s.room);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api<Info>(`/api/rooms/${code}`);
        if (res.status === 404 || res.status === 400) {
          if (alive) setNotFound(true);
          return;
        }
        if (alive && res.ok) setInfo(res.data);
      } catch {
        /* thử lại sau */
      }
    };
    void load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  const taken = room ? room.players.map((p) => p.token) : (info?.takenTokens ?? []);
  useEffect(() => {
    if (!token || taken.includes(token)) {
      const pref = loadPref('token') as TokenId | null;
      setToken(
        pref && !taken.includes(pref) && TOKENS.includes(pref)
          ? pref
          : (TOKENS.find((t) => !taken.includes(t)) ?? null),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken.join(',')]);

  if (notFound)
    return (
      <Center>
        <div className="mb-3 text-lg font-semibold">{S.join.notFound}</div>
        <Btn onClick={() => navigate('/')}>{S.join.backHome}</Btn>
      </Center>
    );

  const started = info && info.status !== 'lobby';
  let hostKey: string | undefined;
  try {
    hostKey = sessionStorage.getItem(`cotyphu:hostKey:${code}`) ?? undefined;
  } catch {
    hostKey = undefined;
  }

  const join = () => {
    if (!token) return;
    savePref('token', token);
    const msg: ClientMessage = {
      type: 'join',
      token,
      password: password || undefined,
      hostKey,
    };
    setJoinIntent(msg);
    send(msg);
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-5">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-son dark:text-nghe">{S.appName}</h1>
        <div className="mt-1 font-mono text-xl tracking-[0.3em]">{code}</div>
        {info && info.players.length > 0 && (
          <div className="text-sm text-gray-500">{info.players.join(', ')}</div>
        )}
      </div>
      <Panel className="space-y-3 p-5">
        {started ? (
          <>
            <div className="text-center">{S.join.started}</div>
            {info?.hasPassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={S.join.password}
                className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white px-3 dark:border-white/20 dark:bg-black/30"
              />
            )}
            <Btn
              big
              className="w-full"
              onClick={() => send({ type: 'spectate', password: password || undefined })}
            >
              👀 {S.join.spectate}
            </Btn>
          </>
        ) : info?.full ? (
          <div className="text-center">{S.join.full}</div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <div className="text-center text-sm">
              {S.auth.hello(useStore.getState().auth?.username ?? '')}
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold">{S.join.token}</div>
              <TokenPicker value={token} taken={taken} onChange={setToken} />
            </div>
            {info?.hasPassword && !hostKey && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={S.join.password}
                className="min-h-[44px] w-full rounded-xl border border-black/10 bg-white px-3 dark:border-white/20 dark:bg-black/30"
              />
            )}
            <Btn big type="submit" className="w-full text-lg" disabled={!token}>
              {S.join.submit}
            </Btn>
          </form>
        )}
      </Panel>
      <Btn variant="ghost" onClick={() => navigate('/')}>
        {S.join.backHome}
      </Btn>
    </div>
  );
}
