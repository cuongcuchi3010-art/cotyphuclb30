import { useState } from 'react';
import { TOKENS, formatMoney, type BuildRule, type Rules } from '@cotyphu/shared';
import { PLAYER_COLORS, S, TOKEN_NAMES } from '../strings.vi';
import { useStore } from '../store';
import { cx, useGame } from '../lib';
import { TokenIcon } from './TokenIcon';
import { Avatar } from './Avatar';
import { Btn, Panel } from './ui';
import { RulesButton } from './RulesGuide';
import { LegalNotice } from './LegalNotice';

export function Lobby() {
  const { room, me } = useGame();
  const send = useStore((s) => s.send);
  const [copied, setCopied] = useState(false);
  const [pw, setPw] = useState('');
  if (!room) return null;
  const isHost = room.hostId === me;
  const mySeat = room.players.find((p) => p.id === me);
  const link = `${location.origin}/r/${room.code}`;
  const rules = room.rules;
  const mode = rules.mode ?? 'classic';
  const free = mode === 'freestyle';
  const setRules = (patch: Partial<Rules>) =>
    send({ type: 'setRules', rules: { ...rules, ...patch } });

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold text-son dark:text-nghe">{S.appName}</h1>
        <div className="text-sm text-gray-500">{S.lobby.title}</div>
      </header>
      <LegalNotice />

      <Panel className="text-center">
        <div className="text-sm text-gray-500">{S.lobby.code}</div>
        <div className="font-mono text-4xl font-bold tracking-[0.3em] text-son dark:text-nghe">
          {room.code}
        </div>
        <Btn
          variant="gold"
          className="mt-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
            } catch {
              prompt('Link mời', link);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          🔗 {copied ? S.lobby.copied : S.lobby.copyLink}
        </Btn>
        <div className="mt-1 break-all text-xs text-gray-400">{link}</div>
      </Panel>

      <Panel>
        <div className="mb-2 font-bold">
          {S.lobby.players} ({room.players.length}/6)
        </div>
        <ul className="space-y-1.5">
          {room.players.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5"
            >
              <Avatar token={p.token} color={PLAYER_COLORS[i]!} size={36} photo={p.avatar} />
              <span className="flex-1 font-semibold">
                {p.name}{' '}
                {p.id === me && <span className="text-xs text-gray-400">({S.lobby.you})</span>}
                {room.hostId === p.id && <span className="ml-1">👑</span>}
                {!p.online && <span className="ml-1 text-xs text-son">{S.game.offline}</span>}
              </span>
              <span className="text-xs text-gray-500">{TOKEN_NAMES[p.token]}</span>
              {isHost && p.id !== me && (
                <Btn
                  variant="ghost"
                  className="!min-h-[30px] text-xs"
                  onClick={() => send({ type: 'kick', playerId: p.id })}
                >
                  {S.lobby.kick}
                </Btn>
              )}
            </li>
          ))}
        </ul>
        {mySeat && (
          <div className="mt-3">
            <div className="mb-1 text-sm font-semibold">{S.lobby.changeToken}</div>
            <TokenPicker
              value={mySeat.token}
              taken={room.players.filter((p) => p.id !== me).map((p) => p.token)}
              onChange={(t) => send({ type: 'setProfile', token: t })}
            />
          </div>
        )}
      </Panel>

      <Panel>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-bold">{S.lobby.rules}</div>
          <RulesButton label className="!min-h-[32px] text-xs" />
        </div>
        <fieldset disabled={!isHost} className="space-y-2 text-sm disabled:opacity-80">
          <div>
            <div className="mb-1 font-semibold">{S.lobby.mode}</div>
            <div className="flex rounded-xl bg-black/5 p-0.5 dark:bg-white/10" role="group">
              {(['classic', 'freestyle'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRules(m === mode ? {} : MODE_PRESETS[m])}
                  className={cx(
                    'flex-1 rounded-lg px-3 py-1.5 text-sm font-bold',
                    mode === m
                      ? 'bg-white text-son shadow dark:bg-gray-800 dark:text-nghe'
                      : 'text-gray-500',
                  )}
                >
                  {m === 'freestyle' ? '🎰 ' : '🎲 '}
                  {S.lobby.modes[m]}
                </button>
              ))}
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              {S.lobby.modeInfo[mode]}
            </div>
          </div>
          <Sel
            label={S.lobby.startingCash}
            value={rules.startingCash}
            options={[1000, 1500, 2000, 2500, 3000, 5000, 10000]}
            format={(v) =>
              formatMoney(v) + (v === (free ? 3000 : 1500) ? ` (${S.lobby.standard})` : '')
            }
            onChange={(v) => setRules({ startingCash: v })}
          />
          <Sel
            label={S.lobby.goSalary}
            value={rules.goSalary ?? 200}
            options={[100, 200, 300, 500, 1000]}
            format={(v) =>
              formatMoney(v) + (v === (free ? 500 : 200) ? ` (${S.lobby.standard})` : '')
            }
            onChange={(v) => setRules({ goSalary: v })}
          />
          {free && (
            <>
              <Sel
                label={S.lobby.rentMult}
                value={rules.rentMult ?? 2}
                options={[1, 1.5, 2, 3, 5]}
                format={(v) => `×${String(v).replace('.', ',')}`}
                onChange={(v) => setRules({ rentMult: v })}
              />
              <Sel
                label={S.lobby.feeMult}
                value={rules.feeMult ?? 2}
                options={[1, 2, 3, 5]}
                format={(v) => `×${v}`}
                onChange={(v) => setRules({ feeMult: v })}
              />
              <Sel
                label={S.lobby.firstBuildMax}
                value={rules.firstBuildMax ?? 4}
                options={[0, 1, 2, 3, 4]}
                format={(v) => (v === 0 ? S.lobby.firstBuildNone : `${v} nhà`)}
                onChange={(v) => setRules({ firstBuildMax: v })}
              />
              <Sel
                label={S.lobby.casinoMaxBet}
                value={Math.min(rules.casinoMaxBet ?? 1000, 1000)}
                options={[200, 500, 1000]}
                format={(v) => formatMoney(v) + (v === 1000 ? ` (${S.lobby.standard})` : '')}
                onChange={(v) => setRules({ casinoMaxBet: v })}
              />
            </>
          )}
          {!free && (
            <Toggle
              checked={!!rules.festivalSquare}
              onChange={(v) =>
                setRules(v ? { festivalSquare: true, jackpot: false } : { festivalSquare: false })
              }
              label={S.lobby.festivalSquare}
            />
          )}
          {!free && !rules.festivalSquare && (
            <Toggle
              checked={rules.jackpot}
              onChange={(v) => setRules({ jackpot: v })}
              label={S.lobby.jackpot}
            />
          )}
          <Toggle
            checked={rules.doubleGo}
            onChange={(v) => setRules({ doubleGo: v })}
            label={S.lobby.doubleGo(formatMoney((rules.goSalary ?? 200) * 2))}
          />
          <Toggle
            checked={!rules.auctions}
            onChange={(v) => setRules({ auctions: !v })}
            label={S.lobby.noAuction}
          />
          <Toggle
            checked={!!rules.showStandings}
            onChange={(v) => setRules({ showStandings: v })}
            label={S.lobby.showStandings}
          />
          <label className="flex items-center justify-between gap-2">
            {S.lobby.timeLimit}
            <select
              value={rules.timeLimitMinutes}
              onChange={(e) =>
                setRules({ timeLimitMinutes: Number(e.target.value) as 0 | 30 | 60 | 90 })
              }
              className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
            >
              {[0, 30, 60, 90].map((v) => (
                <option key={v} value={v}>
                  {v ? S.lobby.minutes(v) : S.lobby.off}
                </option>
              ))}
            </select>
          </label>
          {!free && (
            <>
              <label className="flex items-center justify-between gap-2">
                {S.lobby.houseStock}
                <select
                  value={rules.houseStock ?? 32}
                  onChange={(e) => setRules({ houseStock: Number(e.target.value) })}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
                >
                  {[16, 24, 32, 48, 64, 88, 120].map((v) => (
                    <option key={v} value={v}>
                      {v} nhà{v === 32 ? ` (${S.lobby.standard})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                {S.lobby.hotelStock}
                <select
                  value={rules.hotelStock ?? 12}
                  onChange={(e) => setRules({ hotelStock: Number(e.target.value) })}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
                >
                  {[4, 8, 12, 16, 22, 30].map((v) => (
                    <option key={v} value={v}>
                      {v} khách sạn{v === 12 ? ` (${S.lobby.standard})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="flex items-center justify-between gap-2">
            {S.lobby.maxFestivals}
            <select
              value={rules.maxFestivals ?? 3}
              onChange={(e) => setRules({ maxFestivals: Number(e.target.value) })}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
            >
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {v} ô{v === 3 ? ` (${S.lobby.standard})` : ''}
                </option>
              ))}
            </select>
          </label>
          {!free && (
            <>
              <label className="flex items-center justify-between gap-2">
                {S.lobby.buildRule}
                <select
                  value={rules.buildRule ?? 'combined'}
                  onChange={(e) => setRules({ buildRule: e.target.value as BuildRule })}
                  className="max-w-[60%] rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
                >
                  {(['combined', 'color', 'landing'] as const).map((v) => (
                    <option key={v} value={v}>
                      {S.lobby.buildRules[v]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg bg-nghe-50 px-2 py-1.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200">
                🏠 {S.lobby.buildInfos[rules.buildRule ?? 'combined']}
              </div>
            </>
          )}
          <label className="flex items-center justify-between gap-2">
            {S.lobby.turnTimer}
            <select
              value={rules.turnTimerSec}
              onChange={(e) => setRules({ turnTimerSec: Number(e.target.value) })}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
            >
              {[0, 30, 60, 90, 120, 180].map((v) => (
                <option key={v} value={v}>
                  {v ? S.lobby.seconds(v) : S.lobby.off}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        {isHost && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: 'setPassword', password: pw });
            }}
          >
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={S.lobby.password}
              maxLength={40}
              className="min-h-[40px] flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm dark:border-white/20 dark:bg-black/30"
            />
            <Btn type="submit" variant="ghost">
              {S.lobby.savePassword}
            </Btn>
          </form>
        )}
        {room.hasPassword && <div className="mt-1 text-xs text-gray-500">🔒 Phòng có mật khẩu</div>}
      </Panel>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-black/10 bg-giay/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-giay-dark/95">
        <Btn
          variant="ghost"
          big
          onClick={() => {
            send({ type: 'leave' });
            location.href = '/';
          }}
        >
          {S.lobby.leave}
        </Btn>
        {isHost ? (
          <Btn
            big
            className="flex-1 text-lg"
            disabled={room.players.length < 2}
            onClick={() => send({ type: 'start' })}
          >
            ▶ {room.players.length < 2 ? S.lobby.needTwo : S.lobby.start}
          </Btn>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl bg-black/5 text-sm text-gray-500 dark:bg-white/10">
            {S.lobby.waitingHost}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-son"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function TokenPicker({
  value,
  taken,
  onChange,
}: {
  value: string | null;
  taken: string[];
  onChange: (t: (typeof TOKENS)[number]) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {TOKENS.map((t) => {
        const isTaken = taken.includes(t);
        return (
          <button
            key={t}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(t)}
            className={cx(
              'flex flex-col items-center rounded-xl border-2 p-2 text-[11px] transition',
              value === t
                ? 'border-son bg-son-50 dark:bg-son-700/30'
                : 'border-transparent bg-black/5 dark:bg-white/5',
              isTaken && 'opacity-30',
            )}
          >
            <TokenIcon token={t} size={34} />
            <span className="mt-0.5 leading-tight">{TOKEN_NAMES[t]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Mức mặc định khi đổi chế độ chơi */
const MODE_PRESETS: Record<'classic' | 'freestyle', Partial<Rules>> = {
  classic: { mode: 'classic', startingCash: 1500, goSalary: 200 },
  freestyle: {
    mode: 'freestyle',
    startingCash: 3000,
    goSalary: 500,
    rentMult: 2,
    feeMult: 2,
    casinoMaxBet: 1000,
    firstBuildMax: 4,
    festivalSquare: false,
    jackpot: false,
  },
};

function Sel({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const opts = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <label className="flex items-center justify-between gap-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
      >
        {opts.map((v) => (
          <option key={v} value={v}>
            {format(v)}
          </option>
        ))}
      </select>
    </label>
  );
}
