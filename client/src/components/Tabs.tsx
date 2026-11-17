import { useEffect, useRef, useState } from 'react';
import {
  GROUPS,
  OWNABLE_INDICES,
  formatMoney,
  groupHasNoBuildings,
  mortgageValue,
  ownable,
  square,
  unmortgageCost,
  validateTrade,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore, type TradeDraft } from '../store';
import { cx, nameOf, playerColor, useGame } from '../lib';
import { SideView, TradeActions } from './Prompts';
import { Btn } from './ui';

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  const unread = useStore((s) => s.unreadChat);
  const { game, me } = useGame();
  const incoming = game?.trades.filter((t) => t.to === me).length ?? 0;
  return (
    <div className="flex gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
      {(Object.keys(S.tabs) as (keyof typeof S.tabs)[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => {
            setTab(k);
            setSheet(true);
          }}
          className={cx(
            'relative flex-1 rounded-lg py-2 text-sm font-semibold',
            tab === k ? 'bg-white shadow dark:bg-gray-800' : 'text-gray-600 dark:text-gray-300',
          )}
        >
          {S.tabs[k]}
          {k === 'chat' && unread > 0 && <Badge n={unread} />}
          {k === 'trade' && incoming > 0 && <Badge n={incoming} />}
        </button>
      ))}
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-son px-1 text-[11px] leading-[18px] text-white">
      {n}
    </span>
  );
}

export function TabContent() {
  const tab = useStore((s) => s.tab);
  if (tab === 'assets') return <AssetsTab />;
  if (tab === 'trade') return <TradeTab />;
  if (tab === 'log') return <LogTab />;
  return <ChatTab />;
}

// ---------------------------------------------------------------------------

function AssetsTab() {
  const { game, me } = useGame();
  const act = useStore((s) => s.act);
  const open = useStore((s) => s.setOpenSquare);
  if (!game || !me) return <div className="p-3 text-sm text-gray-500">{S.game.spectating}</div>;
  const meP = game.players.find((p) => p.id === me)!;
  const mine = OWNABLE_INDICES.filter((i) => game.properties[i]!.owner === me);
  if (mine.length === 0)
    return (
      <div className="p-3 text-sm text-gray-500">
        {S.assets.none}
        {meP.jailCards.length > 0 && (
          <div className="mt-2">🎫 {S.assets.jailCards(meP.jailCards.length)}</div>
        )}
      </div>
    );
  return (
    <div className="space-y-1.5 p-1">
      {meP.jailCards.length > 0 && (
        <div className="text-sm">🎫 {S.assets.jailCards(meP.jailCards.length)}</div>
      )}
      {mine.map((i) => {
        const sq = ownable(i);
        const st = game.properties[i]!;
        const color = sq.kind === 'street' ? GROUPS[sq.group].color : sq.brandColor;
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl bg-white/70 p-2 dark:bg-white/5"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => open(i)}
            >
              <span className="h-8 w-2 shrink-0 rounded" style={{ background: color }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{sq.name}</span>
                <span className="block text-xs text-gray-500">
                  {st.mortgaged
                    ? `🔒 ${S.assets.mortgaged}`
                    : sq.kind === 'street'
                      ? S.card.level(st.houses)
                      : formatMoney(sq.price)}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 flex-wrap justify-end gap-1">
              {sq.kind === 'street' && !st.mortgaged && (
                <>
                  <Btn
                    variant="secondary"
                    className="!min-h-[32px] !px-2"
                    onClick={() => act({ type: 'build', pos: i })}
                  >
                    +🏠
                  </Btn>
                  {st.houses > 0 && (
                    <Btn
                      variant="ghost"
                      className="!min-h-[32px] !px-2"
                      onClick={() => act({ type: 'sell', pos: i })}
                    >
                      −🏠
                    </Btn>
                  )}
                </>
              )}
              {st.mortgaged ? (
                <Btn
                  variant="gold"
                  className="!min-h-[32px] !px-2"
                  onClick={() => act({ type: 'unmortgage', pos: i })}
                >
                  {S.assets.unmortgage} {formatMoney(unmortgageCost(i))}
                </Btn>
              ) : (
                groupHasNoBuildings(game, i) && (
                  <Btn
                    variant="ghost"
                    className="!min-h-[32px] !px-2"
                    onClick={() => act({ type: 'mortgage', pos: i })}
                  >
                    {S.assets.mortgage} +{formatMoney(mortgageValue(i))}
                  </Btn>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TradeTab() {
  const { room, game, me } = useGame();
  const draft = useStore((s) => s.tradeDraft);
  const setDraft = useStore((s) => s.setTradeDraft);
  if (!room || !game || !me)
    return <div className="p-3 text-sm text-gray-500">{S.game.spectating}</div>;
  const meP = game.players.find((p) => p.id === me);
  if (!meP || meP.bankrupt)
    return <div className="p-3 text-sm text-gray-500">{S.game.bankrupt}</div>;
  const others = game.players.filter((p) => !p.bankrupt && p.id !== me);
  const mineTrades = game.trades.filter((t) => t.from === me || t.to === me);

  return (
    <div className="space-y-3 p-1">
      {mineTrades.length === 0 && !draft && (
        <div className="text-sm text-gray-500">{S.trade.none}</div>
      )}
      {mineTrades.map((t) => (
        <div key={t.id} className="rounded-xl bg-white/70 p-3 dark:bg-white/5">
          <div className="mb-1 text-sm font-bold">
            {t.to === me
              ? S.trade.incoming(nameOf(room, t.from))
              : S.trade.outgoing(nameOf(room, t.to))}
          </div>
          <SideView side={t.give} owner={t.from} />
          <SideView side={t.take} owner={t.to} />
          <TradeActions t={t} />
        </div>
      ))}
      {draft ? (
        <TradeEditor draft={draft} onChange={setDraft} />
      ) : (
        others.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">{S.trade.new}</div>
            <div className="flex flex-wrap gap-2">
              {others.map((o) => (
                <Btn
                  key={o.id}
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      to: o.id,
                      giveCash: 0,
                      giveProps: [],
                      giveCards: 0,
                      takeCash: 0,
                      takeProps: [],
                      takeCards: 0,
                    })
                  }
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: playerColor(room, o.id) }}
                  />{' '}
                  {o.name}
                </Btn>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

function TradeEditor({
  draft,
  onChange,
}: {
  draft: TradeDraft;
  onChange: (d: TradeDraft | null) => void;
}) {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  if (!room || !game || !me) return null;
  const meP = game.players.find((p) => p.id === me)!;
  const other = game.players.find((p) => p.id === draft.to);
  if (!other) return null;
  const tradable = (owner: string) =>
    OWNABLE_INDICES.filter(
      (i) => game.properties[i]!.owner === owner && groupHasNoBuildings(game, i),
    );
  const toggle = (list: number[], i: number) =>
    list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
  const give = { cash: draft.giveCash, properties: draft.giveProps, jailCards: draft.giveCards };
  const take = { cash: draft.takeCash, properties: draft.takeProps, jailCards: draft.takeCards };
  const err = validateTrade(game, { from: me, to: draft.to, give, take });

  const Side = ({ who, isGive }: { who: typeof meP; isGive: boolean }) => {
    const props = isGive ? draft.giveProps : draft.takeProps;
    const cash = isGive ? draft.giveCash : draft.takeCash;
    const cards = isGive ? draft.giveCards : draft.takeCards;
    return (
      <div className="rounded-xl bg-white/70 p-2 dark:bg-white/5">
        <div className="mb-1 text-sm font-bold">{isGive ? S.trade.youGive : S.trade.youGet}</div>
        <label className="flex items-center gap-2 text-sm">
          {S.trade.cash}
          <input
            inputMode="numeric"
            value={cash || ''}
            placeholder="0"
            onChange={(e) => {
              const v = Math.min(who.cash, parseInt(e.target.value.replace(/\D/g, '') || '0', 10));
              onChange(isGive ? { ...draft, giveCash: v } : { ...draft, takeCash: v });
            }}
            className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
          />
          <span className="text-xs text-gray-500">/ {formatMoney(who.cash)}</span>
        </label>
        {who.jailCards.length > 0 && (
          <label className="mt-1 flex items-center gap-2 text-sm">
            {S.trade.jailCards}
            <select
              value={cards}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                onChange(isGive ? { ...draft, giveCards: v } : { ...draft, takeCards: v });
              }}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
            >
              {Array.from({ length: who.jailCards.length + 1 }, (_, k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {tradable(who.id).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                onChange(
                  isGive
                    ? { ...draft, giveProps: toggle(draft.giveProps, i) }
                    : { ...draft, takeProps: toggle(draft.takeProps, i) },
                )
              }
              className={cx(
                'rounded-lg border px-2 py-1 text-xs',
                props.includes(i)
                  ? 'border-son bg-son text-white'
                  : 'border-black/10 dark:border-white/20',
              )}
            >
              {square(i).short ?? square(i).name}
              {game.properties[i]!.mortgaged && ' 🔒'}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 rounded-xl border-2 border-nghe p-2">
      <div className="text-sm font-bold">
        {S.trade.new} — {S.trade.with} {other.name}
      </div>
      {Side({ who: meP, isGive: true })}
      {Side({ who: other, isGive: false })}
      <div className="text-xs text-gray-500">{S.trade.noHouses}</div>
      {err && <div className="text-xs text-son">{err}</div>}
      <div className="flex gap-2">
        <Btn
          disabled={!!err}
          onClick={() => {
            act({ type: 'proposeTrade', to: draft.to, give, take, counterOf: draft.counterOf });
            onChange(null);
          }}
        >
          {S.trade.send}
        </Btn>
        <Btn variant="ghost" onClick={() => onChange(null)}>
          {S.trade.cancel}
        </Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LogTab() {
  const { room } = useGame();
  const end = useRef<HTMLDivElement>(null);
  const log = room?.log ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);
  return (
    <div className="space-y-0.5 p-1 text-sm">
      {log.map((l) => (
        <div
          key={l.id}
          className={cx(
            l.text.startsWith('—')
              ? 'mt-2 font-semibold text-ngoc-700 dark:text-ngoc-100'
              : 'text-gray-700 dark:text-gray-200',
          )}
        >
          {l.text}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

function ChatTab() {
  const { room } = useGame();
  const chat = useStore((s) => s.chat);
  const send = useStore((s) => s.send);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1 text-sm">
        {chat.map((m) => (
          <div key={m.id}>
            <b style={{ color: playerColor(room, m.from) }}>{m.name}:</b>{' '}
            <span className="break-words">{m.text}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          send({ type: 'chat', text: t.slice(0, 300) });
          setText('');
        }}
      >
        <input
          value={text}
          maxLength={300}
          onChange={(e) => setText(e.target.value)}
          placeholder={S.chat.placeholder}
          className="min-h-[40px] flex-1 rounded-xl border border-black/10 bg-white px-3 dark:border-white/20 dark:bg-black/30"
        />
        <Btn type="submit">{S.chat.send}</Btn>
      </form>
    </div>
  );
}
