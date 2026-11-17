import { useEffect, useRef, useState } from 'react';
import {
  BANK_LOAN_MAX,
  BANK_LOAN_RATE_PCT,
  BANK_LOAN_TURNS,
  GROUPS,
  OWNABLE_INDICES,
  PLAYER_LOAN_MAX_TURNS,
  bankLoanPrincipal,
  bankLoanRepay,
  canBorrowFromBank,
  canBuild,
  formatMoney,
  blockHasNoBuildings,
  mortgageValue,
  ownable,
  unmortgageCost,
  validateLoanOffer,
  validateTrade,
  type GameState,
  type PlayerState,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore, type TradeDraft } from '../store';
import { cx, nameOf, playerColor, useGame } from '../lib';
import { Avatar } from './Avatar';
import { LoanActions, SideView, TradeActions } from './Prompts';
import { Btn } from './ui';

export function TabBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const setSheet = useStore((s) => s.setSheet);
  const unread = useStore((s) => s.unreadChat);
  const { game, me } = useGame();
  const incoming = game?.trades.filter((t) => t.to === me).length ?? 0;
  const loanIn = game?.loanOffers?.filter((o) => o.to === me).length ?? 0;
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
          {k === 'loan' && loanIn > 0 && <Badge n={loanIn} />}
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
  if (tab === 'loan') return <LoanTab />;
  return <ChatTab />;
}

function colorOf(i: number): string {
  const sq = ownable(i);
  return sq.kind === 'street' ? GROUPS[sq.group].color : sq.brandColor;
}

/** Chọn người chơi (dùng cho giao dịch & vay) */
function PlayerPicker({ value, onPick }: { value: string | null; onPick: (id: string) => void }) {
  const { room, game, me } = useGame();
  if (!room || !game) return null;
  const others = game.players.filter((p) => !p.bankrupt && p.id !== me);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {others.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onPick(o.id)}
          className={cx(
            'flex shrink-0 items-center gap-2 rounded-2xl border-2 px-2.5 py-1.5 text-left',
            value === o.id
              ? 'border-son bg-son-50 dark:bg-son-700/30'
              : 'border-transparent bg-black/5 dark:bg-white/5',
          )}
        >
          <Avatar token={o.token} color={playerColor(room, o.id)} size={30} />
          <span className="leading-tight">
            <span className="block text-sm font-bold">{o.name}</span>
            <span className="block text-xs text-son dark:text-nghe">{formatMoney(o.cash)}</span>
          </span>
        </button>
      ))}
    </div>
  );
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
  const small = '!min-h-[32px] !px-2';
  return (
    <div className="space-y-1.5 p-1">
      {meP.jailCards.length > 0 && (
        <div className="text-sm">🎫 {S.assets.jailCards(meP.jailCards.length)}</div>
      )}
      {mine.map((i) => {
        const sq = ownable(i);
        const st = game.properties[i]!;
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
              <span className="h-8 w-2 shrink-0 rounded" style={{ background: colorOf(i) }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {sq.kind === 'street' ? `${sq.icon ?? ''} ` : ''}
                  {sq.name}
                </span>
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
                  {canBuild(game, meP, i) === null && (
                    <Btn
                      variant="secondary"
                      className={small}
                      onClick={() => act({ type: 'build', pos: i })}
                    >
                      +🏠
                    </Btn>
                  )}
                  {st.houses > 0 && (
                    <Btn
                      variant="ghost"
                      className={small}
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
                  className={small}
                  onClick={() => act({ type: 'unmortgage', pos: i })}
                >
                  {S.assets.unmortgage} {formatMoney(unmortgageCost(i))}
                </Btn>
              ) : (
                blockHasNoBuildings(game, i) && (
                  <Btn
                    variant="ghost"
                    className={small}
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
// Giao dịch: chọn người trước → xổ danh sách tài sản của họ

const emptyDraft = (to: string): TradeDraft => ({
  to,
  giveCash: 0,
  giveProps: [],
  giveCards: 0,
  takeCash: 0,
  takeProps: [],
  takeCards: 0,
});

function TradeTab() {
  const { room, game, me } = useGame();
  const draft = useStore((s) => s.tradeDraft);
  const setDraft = useStore((s) => s.setTradeDraft);
  if (!room || !game || !me)
    return <div className="p-3 text-sm text-gray-500">{S.game.spectating}</div>;
  const meP = game.players.find((p) => p.id === me);
  if (!meP || meP.bankrupt)
    return <div className="p-3 text-sm text-gray-500">{S.game.bankrupt}</div>;
  const mineTrades = game.trades.filter((t) => t.from === me || t.to === me);

  return (
    <div className="space-y-3 p-1">
      <div>
        <div className="mb-1 text-sm font-bold">🤝 {S.trade.pick}</div>
        <PlayerPicker
          value={draft?.to ?? null}
          onPick={(id) => setDraft(draft?.to === id ? null : emptyDraft(id))}
        />
      </div>
      {draft && <TradeEditor draft={draft} onChange={setDraft} />}
      {mineTrades.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold">{S.trade.pending}</div>
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
        </div>
      )}
    </div>
  );
}

function AssetPicker({
  game,
  owner,
  selected,
  onToggle,
}: {
  game: GameState;
  owner: PlayerState;
  selected: number[];
  onToggle: (i: number) => void;
}) {
  const owned = OWNABLE_INDICES.filter((i) => game.properties[i]!.owner === owner.id);
  if (owned.length === 0) return <div className="text-xs text-gray-500">{S.trade.noProps}</div>;
  return (
    <div className="space-y-1">
      {owned.map((i) => {
        const sq = ownable(i);
        const st = game.properties[i]!;
        const ok = blockHasNoBuildings(game, i);
        const on = selected.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={!ok}
            onClick={() => onToggle(i)}
            className={cx(
              'flex w-full items-center gap-2 rounded-xl border-2 px-2 py-1.5 text-left text-sm',
              on
                ? 'border-son bg-son-50 dark:bg-son-700/30'
                : 'border-transparent bg-white/70 dark:bg-white/5',
              !ok && 'opacity-40',
            )}
          >
            <span className="text-base">{on ? '☑️' : '⬜'}</span>
            <span className="h-6 w-1.5 shrink-0 rounded" style={{ background: colorOf(i) }} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {sq.kind === 'street' ? `${sq.icon ?? ''} ` : ''}
              {sq.name}
            </span>
            <span className="shrink-0 text-xs text-gray-500">
              {st.mortgaged ? '🔒 TC' : !ok ? S.trade.hasHouses : formatMoney(sq.price)}
            </span>
          </button>
        );
      })}
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
  const toggle = (list: number[], i: number) =>
    list.includes(i) ? list.filter((x) => x !== i) : [...list, i];
  const give = { cash: draft.giveCash, properties: draft.giveProps, jailCards: draft.giveCards };
  const take = { cash: draft.takeCash, properties: draft.takeProps, jailCards: draft.takeCards };
  const err = validateTrade(game, { from: me, to: draft.to, give, take });
  const cashInput = (who: PlayerState, value: number, set: (v: number) => void) => (
    <label className="mt-2 flex items-center gap-2 text-sm">
      💵 {S.trade.cash}
      <input
        inputMode="numeric"
        value={value || ''}
        placeholder="0"
        onChange={(e) =>
          set(Math.min(who.cash, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))
        }
        className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
      />
      <span className="text-xs text-gray-500">/ {formatMoney(who.cash)}</span>
    </label>
  );
  const cardSelect = (who: PlayerState, value: number, set: (v: number) => void) =>
    who.jailCards.length > 0 ? (
      <label className="mt-1 flex items-center gap-2 text-sm">
        🎫 {S.trade.jailCards}
        <select
          value={value}
          onChange={(e) => set(parseInt(e.target.value, 10))}
          className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
        >
          {Array.from({ length: who.jailCards.length + 1 }, (_, k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <div className="space-y-2 rounded-2xl border-2 border-nghe p-2">
      <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Avatar token={other.token} color={playerColor(room, other.id)} size={22} />
          {S.trade.theirAssets(other.name)} — {S.trade.youGet}
        </div>
        <AssetPicker
          game={game}
          owner={other}
          selected={draft.takeProps}
          onToggle={(i) => onChange({ ...draft, takeProps: toggle(draft.takeProps, i) })}
        />
        {cashInput(other, draft.takeCash, (v) => onChange({ ...draft, takeCash: v }))}
        {cardSelect(other, draft.takeCards, (v) => onChange({ ...draft, takeCards: v }))}
      </div>
      <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold">
          <Avatar token={meP.token} color={playerColor(room, meP.id)} size={22} />
          {S.trade.youGive}
        </div>
        <AssetPicker
          game={game}
          owner={meP}
          selected={draft.giveProps}
          onToggle={(i) => onChange({ ...draft, giveProps: toggle(draft.giveProps, i) })}
        />
        {cashInput(meP, draft.giveCash, (v) => onChange({ ...draft, giveCash: v }))}
        {cardSelect(meP, draft.giveCards, (v) => onChange({ ...draft, giveCards: v }))}
      </div>
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
// Vay

function LoanTab() {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const [amount, setAmount] = useState(100);
  const [pick, setPick] = useState<string | null>(null);
  const [lend, setLend] = useState(false);
  const [pAmount, setPAmount] = useState(100);
  const [pRepay, setPRepay] = useState(120);
  const [pTurns, setPTurns] = useState(5);
  if (!room || !game || !me)
    return <div className="p-3 text-sm text-gray-500">{S.game.spectating}</div>;
  const meP = game.players.find((p) => p.id === me);
  if (!meP || meP.bankrupt)
    return <div className="p-3 text-sm text-gray-500">{S.game.bankrupt}</div>;
  const loans = game.loans ?? [];
  const offers = game.loanOffers ?? [];
  const left = BANK_LOAN_MAX - bankLoanPrincipal(game, me);
  const canBank = canBorrowFromBank(game, meP);
  const myLoans = loans.filter((l) => l.borrower === me);
  const lent = loans.filter((l) => l.lender === me);
  const myOffers = offers.filter((o) => o.from === me || o.to === me);
  const offerErr = pick
    ? validateLoanOffer(game, {
        lender: lend ? me : pick,
        borrower: lend ? pick : me,
        amount: pAmount,
        repay: pRepay,
        turns: pTurns,
      })
    : null;
  const num = (v: string) => parseInt(v.replace(/\D/g, '') || '0', 10);
  const inp =
    'w-24 rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30';

  return (
    <div className="space-y-3 p-1 text-sm">
      {/* Vay ngân hàng */}
      <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
        <div className="font-bold">🏦 {S.loan.bankTitle}</div>
        <div className="text-xs text-gray-500">
          {S.loan.bankInfo(BANK_LOAN_RATE_PCT, BANK_LOAN_TURNS, formatMoney(BANK_LOAN_MAX))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {[50, 100, 200, 500].map((v) => (
            <button
              key={v}
              type="button"
              disabled={v > left}
              onClick={() => setAmount(v)}
              className={cx(
                'rounded-lg border px-2 py-1 text-xs',
                amount === v
                  ? 'border-son bg-son text-white'
                  : 'border-black/10 dark:border-white/20',
                v > left && 'opacity-30',
              )}
            >
              {formatMoney(v)}
            </button>
          ))}
          <input
            inputMode="numeric"
            value={amount || ''}
            onChange={(e) => setAmount(num(e.target.value))}
            className={inp}
          />
        </div>
        <div className="mt-1 text-xs">
          {S.loan.repay}: <b>{formatMoney(bankLoanRepay(amount))}</b> ·{' '}
          {S.loan.available(formatMoney(left))}
        </div>
        {!canBank && <div className="mt-1 text-xs text-gray-500">{S.loan.onlyTurn}</div>}
        <Btn
          className="mt-2"
          disabled={!canBank || amount < 10 || amount > left}
          onClick={() => act({ type: 'bankLoan', amount })}
        >
          {S.loan.borrow} {formatMoney(amount)}
        </Btn>
      </div>

      {/* Khoản vay hiện có */}
      <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
        <div className="font-bold">{S.loan.myLoans}</div>
        {myLoans.length === 0 && <div className="text-xs text-gray-500">{S.loan.none}</div>}
        {myLoans.map((l) => (
          <div key={l.id} className="mt-1 flex items-center justify-between gap-2">
            <span>
              {l.lender === 'bank' ? `🏦 ${S.loan.bank}` : nameOf(room, l.lender)}:{' '}
              <b>{formatMoney(l.repay)}</b> · {S.loan.turnsLeft(l.turnsLeft)}
            </span>
            <Btn
              variant="gold"
              className="!min-h-[30px] !px-2"
              disabled={meP.cash < l.repay}
              onClick={() => act({ type: 'repayLoan', id: l.id })}
            >
              {S.loan.repayNow}
            </Btn>
          </div>
        ))}
        {lent.length > 0 && (
          <>
            <div className="mt-2 font-bold">{S.loan.lentLoans}</div>
            {lent.map((l) => (
              <div key={l.id} className="text-xs">
                {nameOf(room, l.borrower)}: {formatMoney(l.repay)} · {S.loan.turnsLeft(l.turnsLeft)}
              </div>
            ))}
          </>
        )}
        <div className="mt-1 text-xs text-gray-500">{S.loan.rentHint}</div>
      </div>

      {/* Vay người chơi */}
      <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5">
        <div className="mb-1 font-bold">🤝 {S.loan.playerTitle}</div>
        <PlayerPicker value={pick} onPick={(id) => setPick(pick === id ? null : id)} />
        {pick && (
          <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => setLend(v)}
                  className={cx(
                    'flex-1 rounded-lg py-1.5 text-xs font-semibold',
                    lend === v ? 'bg-son text-white' : 'bg-black/5 dark:bg-white/10',
                  )}
                >
                  {v ? S.loan.iLend : S.loan.iBorrow}
                </button>
              ))}
            </div>
            <label className="flex items-center justify-between gap-2">
              {S.loan.amount}
              <input
                inputMode="numeric"
                value={pAmount || ''}
                onChange={(e) => setPAmount(num(e.target.value))}
                className={inp}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              {S.loan.repayAmount}
              <input
                inputMode="numeric"
                value={pRepay || ''}
                onChange={(e) => setPRepay(num(e.target.value))}
                className={inp}
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              {S.loan.turns}
              <select
                value={pTurns}
                onChange={(e) => setPTurns(Number(e.target.value))}
                className="rounded-lg border border-black/10 bg-white px-2 py-1 dark:border-white/20 dark:bg-black/30"
              >
                {Array.from({ length: PLAYER_LOAN_MAX_TURNS }, (_, k) => k + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {offerErr && <div className="text-xs text-son">{offerErr}</div>}
            <Btn
              disabled={!!offerErr}
              onClick={() =>
                act({
                  type: 'proposeLoan',
                  to: pick,
                  lend,
                  amount: pAmount,
                  repay: pRepay,
                  turns: pTurns,
                })
              }
            >
              {S.loan.send}
            </Btn>
          </div>
        )}
        {myOffers.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="font-bold">{S.loan.pending}</div>
            {myOffers.map((o) => (
              <div key={o.id} className="rounded-lg bg-black/5 p-2 dark:bg-white/5">
                <div className="text-xs">
                  {nameOf(room, o.borrower)} ← {nameOf(room, o.lender)}:{' '}
                  {S.loan.terms(formatMoney(o.amount), formatMoney(o.repay), o.turns)}
                </div>
                <LoanActions o={o} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChatTab() {
  const { room } = useGame();
  const chat = useStore((s) => s.chat);
  const send = useStore((s) => s.send);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const lastChatId = chat[chat.length - 1]?.id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lastChatId]);
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
