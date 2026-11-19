import type { Action, Actor, PlayerAction } from './actions.js';
import { OWNABLE_INDICES, ownable } from './data/board.vi.js';
import {
  applyAction,
  canBuild,
  casinoBetLimit,
  casinoStakeTargets,
  currentPlayer,
  demolishTargets,
  festivalTargets,
  giftTargets,
  getPlayer,
  liquidationValue,
  totalOwed,
} from './engine.js';
import type { GameState, PlayerId, Rng } from './types.js';

export interface Plan {
  by: Actor;
  action: Action;
}

const BOT_RESERVE = 200;

/**
 * Bot đơn giản (thay người mất kết nối): mua nếu còn ≥ 200 tr sau khi mua,
 * xây khi trọn nhóm, không giao dịch.
 */
export function botDecision(s: GameState, botId: PlayerId): Plan | null {
  const me = s.players.find((p) => p.id === botId);
  if (!me || me.bankrupt) return null;
  const ph = s.phase;

  // Từ chối mọi đề nghị giao dịch gửi tới bot
  const incoming = s.trades.find((t) => t.to === botId);
  if (incoming) return { by: botId, action: { type: 'rejectTrade', id: incoming.id } };
  const loanOffer = s.loanOffers?.find((o) => o.to === botId);
  if (loanOffer) return { by: botId, action: { type: 'rejectLoan', id: loanOffer.id } };
  // Giữ thế chấp các ô vừa nhận
  const choice = s.mortgageChoices.find((m) => m.playerId === botId);
  if (choice && ph.kind !== 'auction')
    return { by: botId, action: { type: 'mortgageChoice', pos: choice.pos, redeem: false } };

  if (ph.kind === 'cardChoice') {
    return currentPlayer(s).id === botId ? { by: 'system', action: { type: 'autoChoose' } } : null;
  }
  if (ph.kind === 'casino') return botCasino(s, botId);
  if (ph.kind === 'raiseFunds') {
    if (ph.debtor !== botId) return null;
    if (liquidationValue(s, botId) < totalOwed(s, botId))
      return { by: botId, action: { type: 'declareBankruptcy' } };
    return { by: 'system', action: { type: 'autoLiquidate' } };
  }
  if (ph.kind === 'auction') {
    const a = s.auction!;
    if (a.highBidder === botId || !a.bidders.includes(botId)) return null;
    const bid = Math.max(10, a.highBid + 10);
    const price = ownable(a.pos).price;
    if (bid <= price && me.cash - bid >= BOT_RESERVE)
      return { by: botId, action: { type: 'bid', amount: bid } };
    return null;
  }
  if (currentPlayer(s).id !== botId) return null;
  switch (ph.kind) {
    case 'awaitRoll':
      if (me.inJail && me.jailCards.length > 0)
        return { by: botId, action: { type: 'useJailCard' } };
      return { by: botId, action: { type: 'roll' } };
    case 'awaitBuy': {
      const price = ownable(ph.pos).price;
      return {
        by: botId,
        action: { type: me.cash - price >= BOT_RESERVE ? 'buy' : 'decline' },
      };
    }
    case 'awaitEnd': {
      for (const i of OWNABLE_INDICES) {
        if (s.properties[i]!.owner !== botId) continue;
        const sq = ownable(i);
        if (sq.kind !== 'street') continue;
        if (canBuild(s, me, i) === null && me.cash - sq.houseCost >= BOT_RESERVE)
          return { by: botId, action: { type: 'build', pos: i } };
      }
      return { by: botId, action: { type: 'endTurn' } };
    }
    default:
      return null;
  }
}

/** Liệt kê các hành động người chơi có thể thử (dùng cho bot ngẫu nhiên / mô phỏng) */
export function candidateActions(s: GameState, id: PlayerId, rng: Rng): PlayerAction[] {
  const me = getPlayer(s, id);
  const out: PlayerAction[] = [
    { type: 'roll' },
    { type: 'payBail' },
    { type: 'useJailCard' },
    { type: 'buy' },
    { type: 'decline' },
    { type: 'endTurn' },
    { type: 'payDebt' },
    { type: 'declareBankruptcy' },
  ];
  if (s.phase.kind === 'drawOrder')
    for (let k = 0; k < s.players.length; k++) out.push({ type: 'drawLot', card: k });
  if (s.phase.kind === 'cardChoice') {
    for (const pos of demolishTargets(s, id).slice(0, 4)) out.push({ type: 'chooseDemolish', pos });
    for (const pos of festivalTargets(s, id).slice(0, 4)) out.push({ type: 'chooseFestival', pos });
    const others = s.players.filter((p) => !p.bankrupt && p.id !== id);
    for (const pos of giftTargets(s, id).slice(0, 4))
      for (const o of others.slice(0, 2)) out.push({ type: 'chooseGift', pos, to: o.id });
  }
  if (s.auction) {
    const h = s.auction.highBid;
    out.push({ type: 'bid', amount: Math.max(10, h + 10) });
    out.push({ type: 'bid', amount: h + 50 });
    out.push({ type: 'bid', amount: me.cash });
  }
  for (const i of OWNABLE_INDICES) {
    if (s.properties[i]!.owner !== id) continue;
    out.push({ type: 'build', pos: i }, { type: 'sell', pos: i });
    out.push({ type: 'mortgage', pos: i }, { type: 'unmortgage', pos: i });
  }
  for (const m of s.mortgageChoices.filter((x) => x.playerId === id))
    out.push({ type: 'mortgageChoice', pos: m.pos, redeem: rng.int(0, 1) === 1 });
  out.push({ type: 'bankLoan', amount: [10, 50, 200][rng.int(0, 2)]! });
  for (const l of s.loans) if (l.borrower === id) out.push({ type: 'repayLoan', id: l.id });
  for (const o of s.loanOffers) {
    if (o.to === id) out.push({ type: 'acceptLoan', id: o.id }, { type: 'rejectLoan', id: o.id });
  }
  for (const t of s.trades) {
    if (t.to === id) out.push({ type: 'acceptTrade', id: t.id }, { type: 'rejectTrade', id: t.id });
  }
  {
    const o = s.players.filter((p) => !p.bankrupt && p.id !== id);
    if (o.length) {
      const amount = rng.int(1, 10) * 10;
      out.push({
        type: 'proposeLoan',
        to: o[rng.int(0, o.length - 1)]!.id,
        lend: rng.int(0, 1) === 1,
        amount,
        repay: amount + rng.int(0, 5) * 10,
        turns: rng.int(1, 6),
      });
    }
  }
  // Đề nghị giao dịch ngẫu nhiên
  const others = s.players.filter((p) => !p.bankrupt && p.id !== id);
  if (others.length > 0) {
    const o = others[rng.int(0, others.length - 1)]!;
    const mine = OWNABLE_INDICES.filter((i) => s.properties[i]!.owner === id);
    const theirs = OWNABLE_INDICES.filter((i) => s.properties[i]!.owner === o.id);
    const pick = (arr: number[]) => (arr.length ? [arr[rng.int(0, arr.length - 1)]!] : []);
    out.push({
      type: 'proposeTrade',
      to: o.id,
      give: { cash: rng.int(0, Math.min(100, me.cash)), properties: pick(mine), jailCards: 0 },
      take: {
        cash: rng.int(0, Math.min(100, o.cash)),
        properties: pick(theirs),
        jailCards: Math.min(o.jailCards.length, rng.int(0, 1)),
      },
    });
  }
  return out;
}

/** Lọc các hành động thực sự hợp lệ (thử áp dụng) */
export function legalActions(s: GameState, id: PlayerId, rng: Rng): PlayerAction[] {
  return candidateActions(s, id, rng).filter((a) => {
    try {
      applyAction(s, id, a, rng);
      return true;
    } catch {
      return false;
    }
  });
}

/** Bot ở Sòng Bạc: cược ~10% tiền (không phải lần nào cũng chơi); sòng đất chỉ đặt ô rẻ nhất khi trên bàn có ô đắt hơn */
function botCasino(s: GameState, botId: PlayerId): Plan | null {
  const k = s.casino;
  if (!k) return null;
  if (k.stage === 'roll') {
    return k.rollers.includes(botId) && !k.rolls[botId]
      ? { by: botId, action: { type: 'casinoRoll' } }
      : null;
  }
  if (!k.eligible.includes(botId) || botId in k.bets || k.passed.includes(botId)) return null;
  const idx = s.players.findIndex((p) => p.id === botId);
  if (k.kind === 'cash') {
    const limit = casinoBetLimit(s, botId);
    const amount = Math.min(limit, Math.max(10, Math.round(getPlayer(s, botId).cash / 100) * 10));
    if ((s.turn + idx) % 3 === 0 || amount < 10)
      return { by: botId, action: { type: 'casinoPass' } };
    return { by: botId, action: { type: 'casinoBet', amount } };
  }
  const mine = casinoStakeTargets(s, botId).sort((a, b) => ownable(a).price - ownable(b).price);
  const cheapest = mine[0];
  const best = Math.max(0, ...Object.values(k.bets).map((pos) => ownable(pos).price));
  if (cheapest !== undefined && best > ownable(cheapest).price)
    return { by: botId, action: { type: 'casinoStake', pos: cheapest } };
  return { by: botId, action: { type: 'casinoPass' } };
}
