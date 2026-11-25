import { useEffect, useRef, useState } from 'react';
import { CASINO_NAMES, formatMoney, type GameEvent } from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { cx, nameOf, playerColor, photoOf, useGame, useNow } from '../lib';
import { Btn, Modal } from './ui';
import { Avatar } from './Avatar';

/** Tổng thời gian mỗi bước (khớp máy chủ) để vẽ thanh đếm ngược */
const STAGE_MS = { join: 10_000, ready: 5_000, question: 20_000 } as const;

/** Đấu Trí Toán (Freestyle, ô 28): vào chơi → chuẩn bị → trả lời nhanh nhất */
export function QuizPrompt() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const now = useNow(100);
  const q = game?.quiz;
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const qKey = q?.question ? `${q.question.a}${q.question.op}${q.question.b}` : '';
  useEffect(() => {
    setValue('');
    if (qKey) setTimeout(() => input.current?.focus(), 50);
  }, [qKey]);
  if (!room || !game || game.phase.kind !== 'quiz' || !q) return null;

  const left = room.deadline ? Math.max(0, room.deadline - now) : 0;
  const pct = Math.min(100, (left / STAGE_MS[q.stage]) * 100);
  const secs = Math.ceil(left / 1000);
  const canJoin = !!me && q.eligible.includes(me);
  const decided = !!me && (q.joined.includes(me) || q.passed.includes(me));
  const playing = !!me && q.joined.includes(me);
  const answered = !!me && q.answered.includes(me);

  const people = q.stage === 'join' ? q.eligible : q.joined;
  const submit = () => {
    const n = Number(value.trim());
    if (value.trim() === '' || !Number.isInteger(n)) return;
    act({ type: 'quizAnswer', value: n });
  };

  return (
    <Modal open>
      <div className="space-y-3 text-center">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-son">
            🧮 {CASINO_NAMES.quiz}
          </div>
          <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
            {S.quiz.intro(nameOf(room, q.opener), formatMoney(q.stake))}
          </div>
        </div>

        {/* Thanh thời gian */}
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={cx(
              'h-full rounded-full transition-[width] duration-100',
              q.stage === 'question' ? 'bg-son' : 'bg-nghe',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        {q.stage === 'join' && (
          <>
            <div className="text-lg font-black">
              {S.quiz.pot}: {formatMoney(q.pot)} · ⏱ {secs}s
            </div>
            {canJoin && !decided ? (
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={() => act({ type: 'quizJoin' })}>
                  {S.quiz.join(formatMoney(q.stake))}
                </Btn>
                <Btn variant="ghost" onClick={() => act({ type: 'quizPass' })}>
                  {S.quiz.pass}
                </Btn>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                {playing ? S.quiz.joined : canJoin ? S.quiz.passed : S.quiz.notEligible}
              </div>
            )}
          </>
        )}

        {q.stage === 'ready' && (
          <div>
            <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              {S.quiz.getReady} · {S.quiz.pot}: {formatMoney(q.pot)}
            </div>
            <div className="text-6xl font-black tabular-nums text-son">{secs}</div>
          </div>
        )}

        {q.stage === 'question' && q.question && (
          <div className="space-y-3">
            <div className="text-5xl font-black tabular-nums">
              {q.question.a} {q.question.op} {q.question.b} = ?
            </div>
            {playing && !answered ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  ref={input}
                  id="quiz-answer"
                  inputMode="numeric"
                  autoComplete="off"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ''))}
                  className="min-w-0 flex-1 rounded-xl border-2 border-son/40 bg-white px-3 py-2 text-center text-2xl font-black tabular-nums outline-none focus:border-son dark:bg-black/30"
                  placeholder="?"
                  aria-label={S.quiz.answerLabel}
                />
                <Btn type="submit" disabled={value.trim() === ''}>
                  {S.quiz.send}
                </Btn>
              </form>
            ) : (
              <div className="text-sm text-gray-500">
                {playing ? S.quiz.waitOthers : S.quiz.watching}
              </div>
            )}
            <div className="text-xs text-gray-500">
              ⏱ {secs}s · {S.quiz.oneTry}
            </div>
          </div>
        )}

        {/* Người chơi */}
        <div className="flex flex-wrap justify-center gap-2">
          {people.map((id) => {
            const rank = q.correct.indexOf(id);
            const status =
              q.stage === 'join'
                ? q.joined.includes(id)
                  ? '✅'
                  : q.passed.includes(id)
                    ? '—'
                    : '…'
                : rank === 0
                  ? '🥇'
                  : rank === 1
                    ? '🥈'
                    : q.answered.includes(id)
                      ? '❌'
                      : '…';
            return (
              <div
                key={id}
                className={cx(
                  'flex items-center gap-1.5 rounded-full bg-white/80 py-1 pl-1 pr-2.5 text-sm shadow-sm dark:bg-black/30',
                  id === me && 'ring-2 ring-son',
                )}
              >
                <Avatar
                  token={game.players.find((p) => p.id === id)?.token ?? 'con-trau'}
                  color={playerColor(room, id)}
                  size={26}
                  photo={photoOf(room, id)}
                />
                <span className="max-w-[7rem] truncate font-semibold">{nameOf(room, id)}</span>
                <span>{status}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-gray-500">{S.quiz.rule}</div>
      </div>
    </Modal>
  );
}

type QuizResultEv = Extract<GameEvent, { t: 'quizResult' }>;

/** Kết quả Đấu Trí Toán: hiện vài giây cho cả phòng */
export function QuizResult() {
  const { room } = useGame();
  const events = useStore((s) => s.events);
  const [res, setRes] = useState<QuizResultEv | null>(null);
  useEffect(() => {
    const ev = events.list.find((e): e is QuizResultEv => e.t === 'quizResult');
    if (!ev) return undefined;
    setRes(ev);
    const t = setTimeout(() => setRes(null), 6000);
    return () => clearTimeout(t);
  }, [events.id, events.list]);
  if (!room || !res) return null;
  return (
    <Modal open onClose={() => setRes(null)}>
      <div className="space-y-2 text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-son">
          🧮 {CASINO_NAMES.quiz}
        </div>
        <div className="text-lg font-semibold">
          {S.quiz.answerIs} <b className="text-2xl">{res.answer}</b>
        </div>
        {res.refunded ? (
          <div>{S.quiz.nobody}</div>
        ) : (
          <div className="space-y-1 text-lg">
            <div>
              🥇 <b>{nameOf(room, res.first)}</b> +{formatMoney(res.prize1)}
            </div>
            {res.second && (
              <div>
                🥈 <b>{nameOf(room, res.second)}</b> +{formatMoney(res.prize2)}
              </div>
            )}
          </div>
        )}
        <Btn variant="ghost" onClick={() => setRes(null)}>
          {S.quiz.close}
        </Btn>
      </div>
    </Modal>
  );
}
