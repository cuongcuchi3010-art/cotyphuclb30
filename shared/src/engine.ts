import {
  BOARD_SIZE,
  GO_SALARY,
  GROUP_MEMBERS,
  HOTEL_LEVEL,
  HOTEL_STOCK,
  HOUSE_STOCK,
  JAIL_FINE,
  JAIL_INDEX,
  OWNABLE_INDICES,
  PARKING_INDEX,
  TRANSPORT_INDICES,
  TRANSPORT_RENT,
  UTILITY_INDICES,
  UTILITY_MULTIPLIER,
  isOwnable,
  mortgageTransferFee,
  mortgageValue,
  ownable,
  square,
  unmortgageCost,
  type StreetSquare,
} from './data/board.vi.js';
import { DECKS, type CardEffect, type DeckId } from './data/cards.vi.js';
import type { Action, Actor, GameEvent, PlayerAction } from './actions.js';
import type {
  Creditor,
  Debt,
  GameState,
  PlayerId,
  PlayerState,
  PropertyState,
  Rng,
  Rules,
  TokenId,
  Trade,
  TradeSide,
} from './types.js';
import { DEFAULT_RULES } from './types.js';

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameError';
  }
}

function fail(msg: string): never {
  throw new GameError(msg);
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

// ---------------------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------------------

export interface NewPlayer {
  id: PlayerId;
  name: string;
  token: TokenId;
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function rollDice(rng: Rng): [number, number] {
  return [rng.int(1, 6), rng.int(1, 6)];
}

export function createGame(players: NewPlayer[], rulesIn: Partial<Rules>, rng: Rng): ApplyResult {
  if (players.length < 2 || players.length > 6) fail('Cần từ 2 đến 6 người chơi');
  const rules: Rules = { ...DEFAULT_RULES, ...rulesIn };
  const events: GameEvent[] = [];

  // Tung xúc xắc chọn thứ tự: cao đi trước, hoà thì tung lại giữa những người hoà
  const rolls: { playerId: PlayerId; dice: [number, number] }[] = [];
  const order = decideOrder(
    players.map((p) => p.id),
    rng,
    rolls,
  );

  const byId = new Map(players.map((p) => [p.id, p]));
  const ps: PlayerState[] = order.map((id) => {
    const p = byId.get(id)!;
    return {
      id: p.id,
      name: p.name,
      token: p.token,
      cash: rules.startingCash,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      jailCards: [],
      bankrupt: false,
      stats: { rentCollected: 0, rentPaid: 0, jailVisits: 0, doubles: 0 },
    };
  });

  const properties: Record<number, PropertyState> = {};
  for (const i of OWNABLE_INDICES) properties[i] = { owner: null, houses: 0, mortgaged: false };

  const state: GameState = {
    rules,
    players: ps,
    current: 0,
    properties,
    bank: { houses: HOUSE_STOCK, hotels: HOTEL_STOCK },
    decks: {
      chance: shuffle(
        DECKS.chance.map((_, i) => i),
        rng,
      ),
      chest: shuffle(
        DECKS.chest.map((_, i) => i),
        rng,
      ),
    },
    jackpot: 0,
    phase: { kind: 'awaitRoll' },
    doublesCount: 0,
    extraRoll: false,
    lastDice: null,
    rolled: false,
    debts: [],
    resume: { kind: 'none' },
    auction: null,
    auctionQueue: [],
    trades: [],
    mortgageChoices: [],
    turn: 1,
    bankruptCount: 0,
    winner: null,
    landings: new Array(BOARD_SIZE).fill(0),
    seq: 0,
    nextTradeId: 1,
  };
  events.push({ t: 'orderRolls', rolls, order });
  events.push({ t: 'turnStart', playerId: ps[0]!.id, turn: 1 });
  return { state, events };
}

function decideOrder(
  ids: PlayerId[],
  rng: Rng,
  log: { playerId: PlayerId; dice: [number, number] }[],
): PlayerId[] {
  if (ids.length <= 1) return ids;
  const scored = ids.map((id) => {
    const dice = rollDice(rng);
    log.push({ playerId: id, dice });
    return { id, total: dice[0] + dice[1] };
  });
  const totals = [...new Set(scored.map((s) => s.total))].sort((a, b) => b - a);
  const out: PlayerId[] = [];
  for (const t of totals) {
    const tied = scored.filter((s) => s.total === t).map((s) => s.id);
    out.push(...(tied.length > 1 ? decideOrder(tied, rng, log) : tied));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Truy vấn tiện ích
// ---------------------------------------------------------------------------

export function getPlayer(s: GameState, id: PlayerId): PlayerState {
  const p = s.players.find((x) => x.id === id);
  if (!p) fail('Không tìm thấy người chơi');
  return p;
}

export function currentPlayer(s: GameState): PlayerState {
  return s.players[s.current]!;
}

export function getProp(s: GameState, pos: number): PropertyState {
  const p = s.properties[pos];
  if (!p) fail('Ô này không mua bán được');
  return p;
}

export function alivePlayers(s: GameState): PlayerState[] {
  return s.players.filter((p) => !p.bankrupt);
}

export function ownsWholeGroup(s: GameState, owner: PlayerId, pos: number): boolean {
  const sq = square(pos);
  if (sq.kind !== 'street') return false;
  return GROUP_MEMBERS[sq.group].every((i) => s.properties[i]?.owner === owner);
}

function groupOf(pos: number): readonly number[] {
  const sq = square(pos);
  return sq.kind === 'street' ? GROUP_MEMBERS[sq.group] : [pos];
}

/** Cả nhóm (nếu là đất) không có nhà nào */
export function groupHasNoBuildings(s: GameState, pos: number): boolean {
  return groupOf(pos).every((i) => (s.properties[i]?.houses ?? 0) === 0);
}

export function countOwned(s: GameState, owner: PlayerId, indices: readonly number[]): number {
  return indices.filter((i) => s.properties[i]?.owner === owner).length;
}

export interface RentContext {
  diceTotal: number;
  transportMultiplier?: number;
  /** Ép hệ số tiện ích (thẻ Cơ Hội: 10×) */
  utilityMultiplier?: number;
}

/** Tiền thuê khi dừng ở ô `pos` (0 nếu chưa có chủ / đang thế chấp) */
export function rentFor(s: GameState, pos: number, ctx: RentContext): number {
  const sq = ownable(pos);
  const st = getProp(s, pos);
  if (!st.owner || st.mortgaged) return 0;
  if (sq.kind === 'street') {
    if (st.houses === 0) {
      const base = sq.rent[0];
      return ownsWholeGroup(s, st.owner, pos) ? base * 2 : base;
    }
    return sq.rent[st.houses]!;
  }
  if (sq.kind === 'transport') {
    const n = countOwned(s, st.owner, TRANSPORT_INDICES);
    return TRANSPORT_RENT[n]! * (ctx.transportMultiplier ?? 1);
  }
  const n = countOwned(s, st.owner, UTILITY_INDICES);
  const mult = ctx.utilityMultiplier ?? UTILITY_MULTIPLIER[n]!;
  return mult * ctx.diceTotal;
}

/** Giá trị thanh lý: tiền + 50% giá nhà + giá thế chấp các ô chưa thế chấp */
export function liquidationValue(s: GameState, id: PlayerId): number {
  const p = getPlayer(s, id);
  let v = p.cash;
  for (const i of OWNABLE_INDICES) {
    const st = s.properties[i]!;
    if (st.owner !== id) continue;
    const sq = ownable(i);
    if (sq.kind === 'street') v += st.houses * Math.floor(sq.houseCost / 2);
    if (!st.mortgaged) v += mortgageValue(i);
  }
  return v;
}

/** Tổng tài sản (chế độ giới hạn thời gian) */
export function netWorth(s: GameState, id: PlayerId): number {
  const p = getPlayer(s, id);
  let v = p.cash;
  for (const i of OWNABLE_INDICES) {
    const st = s.properties[i]!;
    if (st.owner !== id) continue;
    const sq = ownable(i);
    v += st.mortgaged ? Math.floor(sq.price / 2) : sq.price;
    if (sq.kind === 'street') v += st.houses * sq.houseCost;
  }
  return v;
}

export function totalOwed(s: GameState, id: PlayerId): number {
  return s.debts.filter((d) => d.from === id).reduce((a, d) => a + d.amount, 0);
}

export function ranking(s: GameState): PlayerId[] {
  if (s.endReason === 'timeUp') {
    const alive = alivePlayers(s)
      .slice()
      .sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id))
      .map((p) => p.id);
    const dead = s.players
      .filter((p) => p.bankrupt)
      .sort((a, b) => (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0))
      .map((p) => p.id);
    return [...alive, ...dead];
  }
  return s.players
    .slice()
    .sort((a, b) => {
      if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
      return (b.bankruptOrder ?? 0) - (a.bankruptOrder ?? 0);
    })
    .map((p) => p.id);
}

// ---------------------------------------------------------------------------
// applyAction
// ---------------------------------------------------------------------------

interface Ctx {
  s: GameState;
  ev: GameEvent[];
  rng: Rng;
}

export function applyAction(state: GameState, by: Actor, action: Action, rng: Rng): ApplyResult {
  const s: GameState = structuredClone(state);
  const c: Ctx = { s, ev: [], rng };
  if (s.phase.kind === 'gameOver') fail('Ván đã kết thúc');
  if (by === 'system') {
    applySystem(c, action);
  } else {
    const p = getPlayer(s, by);
    if (p.bankrupt) fail('Bạn đã phá sản');
    applyPlayer(c, p, action as PlayerAction);
  }
  s.seq++;
  return { state: s, events: c.ev };
}

function applySystem(c: Ctx, a: Action): void {
  const { s } = c;
  switch (a.type) {
    case 'auctionClose':
      if (s.phase.kind !== 'auction' || !s.auction) fail('Không có đấu giá');
      closeAuction(c);
      return;
    case 'autoLiquidate': {
      if (s.phase.kind !== 'raiseFunds') fail('Không ở pha gom tiền');
      autoLiquidate(c, s.phase.debtor);
      return;
    }
    case 'forceBankrupt': {
      const p = getPlayer(s, a.playerId);
      if (p.bankrupt) fail('Người chơi đã phá sản');
      forceBankrupt(c, p);
      return;
    }
    case 'timeUp':
      endGame(c, 'timeUp');
      return;
    default:
      fail('Hành động hệ thống không hợp lệ');
  }
}

function requireCurrent(c: Ctx, p: PlayerState): void {
  if (currentPlayer(c.s).id !== p.id) fail('Chưa tới lượt bạn');
}

function requirePhase(c: Ctx, ...kinds: GameState['phase']['kind'][]): void {
  if (!kinds.includes(c.s.phase.kind)) fail('Không thể làm việc này lúc này');
}

/** Người được quản lý tài sản lúc này (xây/bán/thế chấp/chuộc) */
function canManage(s: GameState, p: PlayerState, op: 'build' | 'sell' | 'mortgage' | 'unmortgage') {
  if (s.phase.kind === 'raiseFunds') {
    if (s.phase.debtor === p.id) return op === 'sell' || op === 'mortgage';
    return false;
  }
  if (currentPlayer(s).id !== p.id) return false;
  return s.phase.kind === 'awaitRoll' || s.phase.kind === 'awaitBuy' || s.phase.kind === 'awaitEnd';
}

function applyPlayer(c: Ctx, p: PlayerState, a: PlayerAction): void {
  const { s } = c;
  switch (a.type) {
    case 'roll':
      requireCurrent(c, p);
      requirePhase(c, 'awaitRoll');
      doRoll(c, p);
      return;
    case 'payBail':
      requireCurrent(c, p);
      requirePhase(c, 'awaitRoll');
      if (!p.inJail) fail('Bạn không ở Phòng Tạm Giữ');
      if (p.cash < JAIL_FINE) fail('Không đủ tiền nộp phạt');
      payToBank(c, p, JAIL_FINE, 'jailFine');
      leaveJail(c, p, 'paid');
      return;
    case 'useJailCard': {
      requireCurrent(c, p);
      requirePhase(c, 'awaitRoll');
      if (!p.inJail) fail('Bạn không ở Phòng Tạm Giữ');
      const deck = p.jailCards.shift();
      if (!deck) fail('Bạn không có Thẻ Bảo Lãnh');
      returnJailCard(s, deck);
      leaveJail(c, p, 'card');
      return;
    }
    case 'buy': {
      requireCurrent(c, p);
      if (s.phase.kind !== 'awaitBuy') fail('Không có ô nào để mua');
      const pos = s.phase.pos;
      const price = ownable(pos).price;
      if (p.cash < price) fail('Không đủ tiền mua ô này');
      p.cash -= price;
      getProp(s, pos).owner = p.id;
      c.ev.push({ t: 'buy', playerId: p.id, pos, price });
      setNeutral(s);
      proceed(c);
      return;
    }
    case 'decline': {
      requireCurrent(c, p);
      if (s.phase.kind !== 'awaitBuy') fail('Không có ô nào để từ chối');
      declineOffer(c, p, s.phase.pos);
      return;
    }
    case 'bid':
      placeBid(c, p, a.amount);
      return;
    case 'build':
      if (!canManage(s, p, 'build')) fail('Chỉ được xây nhà trong lượt của mình');
      build(c, p, a.pos);
      return;
    case 'sell':
      if (!canManage(s, p, 'sell')) fail('Không thể bán nhà lúc này');
      sellBuilding(c, p, a.pos);
      return;
    case 'mortgage':
      if (!canManage(s, p, 'mortgage')) fail('Không thể thế chấp lúc này');
      mortgage(c, p, a.pos);
      return;
    case 'unmortgage':
      if (!canManage(s, p, 'unmortgage')) fail('Chỉ được chuộc ô trong lượt của mình');
      unmortgage(c, p, a.pos);
      return;
    case 'mortgageChoice':
      mortgageChoice(c, p, a.pos, a.redeem);
      return;
    case 'endTurn':
      requireCurrent(c, p);
      requirePhase(c, 'awaitEnd');
      nextTurn(c);
      return;
    case 'payDebt': {
      if (s.phase.kind !== 'raiseFunds' || s.phase.debtor !== p.id) fail('Bạn không có nợ');
      const d = s.debts[0]!;
      if (p.cash < d.amount) fail('Chưa đủ tiền để trả');
      proceed(c);
      return;
    }
    case 'declareBankruptcy': {
      if (s.phase.kind !== 'raiseFunds' || s.phase.debtor !== p.id) fail('Bạn không có nợ');
      if (liquidationValue(s, p.id) >= totalOwed(s, p.id))
        fail('Bạn vẫn có thể gom đủ tiền, chưa thể tuyên bố phá sản');
      bankrupt(c, p, s.debts[0]!.to);
      proceed(c);
      return;
    }
    case 'resign':
      forceBankrupt(c, p);
      return;
    case 'proposeTrade':
      proposeTrade(c, p, a);
      return;
    case 'acceptTrade':
      acceptTrade(c, p, a.id);
      return;
    case 'rejectTrade': {
      const t = s.trades.find((x) => x.id === a.id);
      if (!t || t.to !== p.id) fail('Không tìm thấy đề nghị');
      s.trades = s.trades.filter((x) => x.id !== a.id);
      c.ev.push({ t: 'tradeRejected', tradeId: a.id, by: p.id });
      return;
    }
    case 'cancelTrade': {
      const t = s.trades.find((x) => x.id === a.id);
      if (!t || t.from !== p.id) fail('Không tìm thấy đề nghị');
      s.trades = s.trades.filter((x) => x.id !== a.id);
      c.ev.push({ t: 'tradeCancelled', tradeId: a.id, reason: 'withdrawn' });
      return;
    }
    default:
      fail('Hành động không hợp lệ');
  }
}

/** Phase trung gian trong lúc xử lý (sẽ được proceed() đặt lại) */
function setNeutral(s: GameState): void {
  s.phase = { kind: 'awaitEnd' };
}

// ---------------------------------------------------------------------------
// Tung xúc xắc, di chuyển, tạm giữ
// ---------------------------------------------------------------------------

function doRoll(c: Ctx, p: PlayerState): void {
  const { s, rng } = c;
  const dice = rollDice(rng);
  const doubles = dice[0] === dice[1];
  const total = dice[0] + dice[1];
  s.lastDice = dice;
  s.rolled = true;
  if (doubles) p.stats.doubles++;

  if (p.inJail) {
    c.ev.push({ t: 'roll', playerId: p.id, dice, doubles, purpose: 'jail' });
    if (doubles) {
      p.inJail = false;
      p.jailAttempts = 0;
      s.extraRoll = false;
      c.ev.push({ t: 'leaveJail', playerId: p.id, how: 'doubles' });
      setNeutral(s);
      moveBy(c, p, total);
      landOn(c, p, { diceTotal: total });
      proceed(c);
      return;
    }
    p.jailAttempts++;
    s.extraRoll = false;
    if (p.jailAttempts >= 3) {
      // Lần thứ 3 thất bại: bắt buộc trả 50, đi theo lần tung này
      p.inJail = false;
      p.jailAttempts = 0;
      c.ev.push({ t: 'leaveJail', playerId: p.id, how: 'forced' });
      s.debts.push({ from: p.id, to: 'bank', amount: JAIL_FINE, reason: 'jailFine' });
      s.resume = { kind: 'moveAfterJail', steps: total };
      setNeutral(s);
      proceed(c);
      return;
    }
    c.ev.push({ t: 'jailStay', playerId: p.id, attempts: p.jailAttempts });
    s.phase = { kind: 'awaitEnd' };
    return;
  }

  c.ev.push({ t: 'roll', playerId: p.id, dice, doubles, purpose: 'move' });
  if (doubles) {
    s.doublesCount++;
    if (s.doublesCount >= 3) {
      sendToJail(c, p, 'doubles');
      s.extraRoll = false;
      setNeutral(s);
      proceed(c);
      return;
    }
    s.extraRoll = true;
  } else {
    s.extraRoll = false;
  }
  setNeutral(s);
  moveBy(c, p, total, true);
  landOn(c, p, { diceTotal: total });
  proceed(c);
}

function leaveJail(c: Ctx, p: PlayerState, how: 'paid' | 'card'): void {
  p.inJail = false;
  p.jailAttempts = 0;
  c.ev.push({ t: 'leaveJail', playerId: p.id, how });
  // Vẫn ở pha awaitRoll: tung bình thường
}

function sendToJail(c: Ctx, p: PlayerState, reason: 'square' | 'card' | 'doubles'): void {
  const from = p.position;
  p.position = JAIL_INDEX;
  p.inJail = true;
  p.jailAttempts = 0;
  p.stats.jailVisits++;
  c.s.extraRoll = false;
  c.s.doublesCount = 0;
  c.ev.push({ t: 'move', playerId: p.id, from, to: JAIL_INDEX, steps: 0 });
  c.ev.push({ t: 'jail', playerId: p.id, reason });
}

/** Đi tiến `steps` ô, nhận lương nếu qua Khởi Hành */
function moveBy(c: Ctx, p: PlayerState, steps: number, byDice = false): void {
  const from = p.position;
  const to = (from + steps) % BOARD_SIZE;
  p.position = to;
  c.ev.push({ t: 'move', playerId: p.id, from, to, steps });
  if (from + steps >= BOARD_SIZE) {
    const amount = byDice && to === 0 && c.s.rules.doubleGo ? GO_SALARY * 2 : GO_SALARY;
    p.cash += amount;
    c.ev.push({ t: 'passGo', playerId: p.id, amount });
  }
}

function moveToForward(c: Ctx, p: PlayerState, to: number): void {
  const steps = (to - p.position + BOARD_SIZE) % BOARD_SIZE || BOARD_SIZE;
  moveBy(c, p, steps);
}

function landOn(c: Ctx, p: PlayerState, ctx: RentContext): void {
  const { s } = c;
  const pos = p.position;
  const sq = square(pos);
  s.landings[pos] = (s.landings[pos] ?? 0) + 1;
  c.ev.push({ t: 'land', playerId: p.id, pos });

  if (isOwnable(sq)) {
    const st = getProp(s, pos);
    if (!st.owner) {
      s.phase = { kind: 'awaitBuy', pos };
      c.ev.push({ t: 'offer', playerId: p.id, pos });
      return;
    }
    if (st.owner === p.id || st.mortgaged) return;
    const owner = getPlayer(s, st.owner);
    if (owner.bankrupt) return;
    const amount = rentFor(s, pos, ctx);
    if (amount > 0) s.debts.push({ from: p.id, to: owner.id, amount, reason: 'rent', pos });
    return;
  }
  switch (sq.kind) {
    case 'tax':
      s.debts.push({ from: p.id, to: 'bank', amount: sq.amount, reason: 'tax', pos });
      return;
    case 'chance':
    case 'chest':
      drawCard(c, p, sq.kind);
      return;
    case 'goToJail':
      sendToJail(c, p, 'square');
      return;
    case 'parking':
      if (s.rules.jackpot && s.jackpot > 0 && pos === PARKING_INDEX) {
        p.cash += s.jackpot;
        c.ev.push({ t: 'collect', playerId: p.id, amount: s.jackpot, reason: 'jackpot' });
        s.jackpot = 0;
      }
      return;
    default:
      return;
  }
}

// ---------------------------------------------------------------------------
// Thẻ bài
// ---------------------------------------------------------------------------

function returnJailCard(s: GameState, deck: DeckId): void {
  const idx = DECKS[deck].findIndex((card) => card.effect.type === 'jailFree');
  s.decks[deck].push(idx);
}

function drawCard(c: Ctx, p: PlayerState, deck: DeckId): void {
  const { s } = c;
  const idx = s.decks[deck].shift();
  if (idx === undefined) return; // không thể xảy ra (bộ bài luôn có ít nhất 15 thẻ)
  const card = DECKS[deck][idx]!;
  c.ev.push({ t: 'card', playerId: p.id, deck, cardId: card.id });
  if (card.effect.type === 'jailFree') {
    p.jailCards.push(deck);
    c.ev.push({ t: 'getJailCard', playerId: p.id, deck });
  } else {
    s.decks[deck].push(idx);
  }
  applyCard(c, p, card.effect);
}

function nextIndexFrom(pos: number, targets: readonly number[]): number {
  for (let k = 1; k <= BOARD_SIZE; k++) {
    const i = (pos + k) % BOARD_SIZE;
    if (targets.includes(i)) return i;
  }
  return targets[0]!;
}

function applyCard(c: Ctx, p: PlayerState, e: CardEffect): void {
  const { s } = c;
  switch (e.type) {
    case 'moveTo':
      moveToForward(c, p, e.to);
      landOn(c, p, { diceTotal: diceTotal(s) });
      return;
    case 'nearestTransport': {
      moveToForward(c, p, nextIndexFrom(p.position, TRANSPORT_INDICES));
      landOn(c, p, { diceTotal: diceTotal(s), transportMultiplier: 2 });
      return;
    }
    case 'nearestUtility': {
      moveToForward(c, p, nextIndexFrom(p.position, UTILITY_INDICES));
      const st = getProp(s, p.position);
      if (st.owner && st.owner !== p.id && !st.mortgaged) {
        const dice = rollDice(c.rng);
        c.ev.push({
          t: 'roll',
          playerId: p.id,
          dice,
          doubles: dice[0] === dice[1],
          purpose: 'utility',
        });
        landOn(c, p, { diceTotal: dice[0] + dice[1], utilityMultiplier: 10 });
      } else {
        landOn(c, p, { diceTotal: diceTotal(s) });
      }
      return;
    }
    case 'collect':
      p.cash += e.amount;
      c.ev.push({ t: 'collect', playerId: p.id, amount: e.amount, reason: 'card' });
      return;
    case 'pay':
      s.debts.push({ from: p.id, to: 'bank', amount: e.amount, reason: 'card' });
      return;
    case 'jailFree':
      return;
    case 'back': {
      const from = p.position;
      const to = (from - e.steps + BOARD_SIZE) % BOARD_SIZE;
      p.position = to;
      c.ev.push({ t: 'move', playerId: p.id, from, to, steps: -e.steps });
      landOn(c, p, { diceTotal: diceTotal(s) });
      return;
    }
    case 'goToJail':
      sendToJail(c, p, 'card');
      return;
    case 'repairs': {
      let amount = 0;
      for (const i of OWNABLE_INDICES) {
        const st = s.properties[i]!;
        if (st.owner !== p.id) continue;
        if (st.houses === HOTEL_LEVEL) amount += e.perHotel;
        else amount += st.houses * e.perHouse;
      }
      if (amount > 0) s.debts.push({ from: p.id, to: 'bank', amount, reason: 'card' });
      return;
    }
    case 'payEach':
      for (const o of alivePlayers(s)) {
        if (o.id !== p.id)
          s.debts.push({ from: p.id, to: o.id, amount: e.amount, reason: 'payEach' });
      }
      return;
    case 'collectEach':
      for (const o of alivePlayers(s)) {
        if (o.id !== p.id)
          s.debts.push({ from: o.id, to: p.id, amount: e.amount, reason: 'collectEach' });
      }
      return;
  }
}

function diceTotal(s: GameState): number {
  return s.lastDice ? s.lastDice[0] + s.lastDice[1] : 7;
}

// ---------------------------------------------------------------------------
// Tiền, nợ, tiến trình lượt
// ---------------------------------------------------------------------------

const JACKPOT_REASONS = new Set(['tax', 'card', 'jailFine']);

function payToBank(c: Ctx, p: PlayerState, amount: number, reason: Debt['reason']): void {
  p.cash -= amount;
  if (c.s.rules.jackpot && JACKPOT_REASONS.has(reason)) {
    c.s.jackpot += amount;
    c.ev.push({ t: 'pay', from: p.id, to: 'jackpot', amount, reason });
  } else {
    c.ev.push({ t: 'pay', from: p.id, to: 'bank', amount, reason });
  }
}

/** Trả các khoản nợ trong hàng đợi. false = có người phải gom tiền. */
function settle(c: Ctx): boolean {
  const { s } = c;
  while (s.debts.length > 0) {
    const d = s.debts[0]!;
    const debtor = getPlayer(s, d.from);
    if (debtor.bankrupt || (d.to !== 'bank' && getPlayer(s, d.to).bankrupt)) {
      s.debts.shift();
      continue;
    }
    if (debtor.cash < d.amount) {
      if (s.phase.kind !== 'raiseFunds' || s.phase.debtor !== debtor.id) {
        s.phase = { kind: 'raiseFunds', debtor: debtor.id };
        c.ev.push({
          t: 'raiseFunds',
          playerId: debtor.id,
          owed: d.amount - debtor.cash,
          to: d.to,
        });
      }
      return false;
    }
    s.debts.shift();
    if (d.to === 'bank') {
      payToBank(c, debtor, d.amount, d.reason);
    } else {
      const cr = getPlayer(s, d.to);
      debtor.cash -= d.amount;
      cr.cash += d.amount;
      if (d.reason === 'rent') {
        cr.stats.rentCollected += d.amount;
        debtor.stats.rentPaid += d.amount;
      }
      c.ev.push({
        t: 'pay',
        from: debtor.id,
        to: cr.id,
        amount: d.amount,
        reason: d.reason,
        pos: d.pos,
      });
    }
  }
  if (s.phase.kind === 'raiseFunds') setNeutral(s);
  return true;
}

/**
 * Tiếp tục ván sau mỗi bước: trả nợ → việc còn dở (resume) → đấu giá trong hàng đợi →
 * tung tiếp / chờ kết thúc lượt / chuyển lượt.
 */
function proceed(c: Ctx): void {
  const { s } = c;
  for (let guard = 0; guard < 100; guard++) {
    if (s.phase.kind === 'gameOver') return;
    if (alivePlayers(s).length <= 1) {
      endGame(c, 'lastStanding');
      return;
    }
    if (s.phase.kind === 'awaitBuy' || s.phase.kind === 'auction') return;
    if (!settle(c)) return;

    const cur = currentPlayer(s);
    if (s.resume.kind === 'moveAfterJail') {
      const steps = s.resume.steps;
      s.resume = { kind: 'none' };
      if (!cur.bankrupt) {
        moveBy(c, cur, steps);
        landOn(c, cur, { diceTotal: steps });
        continue;
      }
    }
    if (s.auctionQueue.length > 0) {
      const pos = s.auctionQueue.shift()!;
      if (getProp(s, pos).owner === null) startAuction(c, pos);
      continue;
    }
    if (cur.bankrupt) {
      nextTurn(c);
      return;
    }
    if (s.extraRoll && !cur.inJail) {
      // Vừa tung đôi: được tung tiếp
      s.extraRoll = false;
      s.rolled = false;
    }
    s.phase = s.rolled ? { kind: 'awaitEnd' } : { kind: 'awaitRoll' };
    return;
  }
  fail('Lỗi nội bộ: vòng lặp xử lý quá dài');
}

function nextTurn(c: Ctx): void {
  const { s } = c;
  if (alivePlayers(s).length <= 1) {
    endGame(c, 'lastStanding');
    return;
  }
  let i = s.current;
  do {
    i = (i + 1) % s.players.length;
  } while (s.players[i]!.bankrupt);
  s.current = i;
  s.turn++;
  s.doublesCount = 0;
  s.extraRoll = false;
  s.rolled = false;
  s.resume = { kind: 'none' };
  s.mortgageChoices = [];
  s.phase = { kind: 'awaitRoll' };
  c.ev.push({ t: 'turnStart', playerId: s.players[i]!.id, turn: s.turn });
}

function endGame(c: Ctx, reason: 'lastStanding' | 'timeUp'): void {
  const { s } = c;
  s.endReason = reason;
  s.auction = null;
  s.auctionQueue = [];
  s.debts = [];
  s.trades = [];
  const rank = ranking(s);
  s.winner = rank[0] ?? null;
  s.phase = { kind: 'gameOver' };
  c.ev.push({ t: 'gameOver', winner: s.winner, reason, ranking: rank });
}

// ---------------------------------------------------------------------------
// Mua & đấu giá
// ---------------------------------------------------------------------------

function declineOffer(c: Ctx, p: PlayerState, pos: number): void {
  const { s } = c;
  c.ev.push({ t: 'decline', playerId: p.id, pos });
  setNeutral(s);
  if (s.rules.auctions) {
    startAuction(c, pos);
    return;
  }
  proceed(c);
}

export const AUCTION_MIN_BID = 10;

function startAuction(c: Ctx, pos: number): void {
  const { s } = c;
  s.auction = {
    pos,
    highBid: 0,
    highBidder: null,
    bidders: alivePlayers(s).map((p) => p.id),
    seq: 0,
  };
  s.phase = { kind: 'auction' };
  c.ev.push({ t: 'auctionStart', pos });
}

function placeBid(c: Ctx, p: PlayerState, amount: number): void {
  const { s } = c;
  const a = s.auction;
  if (s.phase.kind !== 'auction' || !a) fail('Không có đấu giá');
  if (!a.bidders.includes(p.id)) fail('Bạn không tham gia đấu giá này');
  if (!Number.isInteger(amount)) fail('Giá phải là số nguyên (triệu)');
  if (a.highBidder === p.id) fail('Bạn đang là người trả giá cao nhất');
  if (amount < AUCTION_MIN_BID) fail(`Giá tối thiểu là ${AUCTION_MIN_BID} tr`);
  if (amount <= a.highBid) fail('Phải trả cao hơn giá hiện tại');
  if (amount > p.cash) fail('Không được trả quá số tiền mặt đang có');
  a.highBid = amount;
  a.highBidder = p.id;
  a.seq++;
  c.ev.push({ t: 'bid', playerId: p.id, amount });
}

function closeAuction(c: Ctx): void {
  const { s } = c;
  const a = s.auction!;
  s.auction = null;
  if (a.highBidder) {
    const w = getPlayer(s, a.highBidder);
    if (!w.bankrupt && w.cash >= a.highBid) {
      w.cash -= a.highBid;
      getProp(s, a.pos).owner = w.id;
      c.ev.push({ t: 'auctionWon', playerId: w.id, pos: a.pos, amount: a.highBid });
    } else {
      c.ev.push({ t: 'auctionNoBids', pos: a.pos });
    }
  } else {
    c.ev.push({ t: 'auctionNoBids', pos: a.pos });
  }
  setNeutral(s);
  proceed(c);
}

// ---------------------------------------------------------------------------
// Nhà, khách sạn, thế chấp
// ---------------------------------------------------------------------------

function requireOwnedStreet(s: GameState, p: PlayerState, pos: number): StreetSquare {
  const sq = square(pos);
  if (sq.kind !== 'street') fail('Chỉ xây nhà trên ô đất');
  if (getProp(s, pos).owner !== p.id) fail('Ô này không phải của bạn');
  return sq;
}

export function canBuild(s: GameState, p: PlayerState, pos: number): string | null {
  const sq = square(pos);
  if (sq.kind !== 'street') return 'Chỉ xây nhà trên ô đất';
  const st = s.properties[pos]!;
  if (st.owner !== p.id) return 'Ô này không phải của bạn';
  if (!ownsWholeGroup(s, p.id, pos)) return 'Cần sở hữu trọn nhóm màu';
  const members = GROUP_MEMBERS[sq.group];
  if (members.some((i) => s.properties[i]!.mortgaged)) return 'Có ô trong nhóm đang thế chấp';
  if (st.houses >= HOTEL_LEVEL) return 'Ô đã có khách sạn';
  const min = Math.min(...members.map((i) => s.properties[i]!.houses));
  if (st.houses !== min) return 'Phải xây đều các ô trong nhóm';
  if (st.houses === 4) {
    if (s.bank.hotels < 1) return 'Ngân hàng đã hết khách sạn';
  } else if (s.bank.houses < 1) return 'Ngân hàng đã hết nhà';
  if (p.cash < sq.houseCost) return 'Không đủ tiền';
  return null;
}

function build(c: Ctx, p: PlayerState, pos: number): void {
  const { s } = c;
  const err = canBuild(s, p, pos);
  if (err) fail(err);
  const sq = square(pos) as StreetSquare;
  const st = s.properties[pos]!;
  p.cash -= sq.houseCost;
  if (st.houses === 4) {
    s.bank.hotels--;
    s.bank.houses += 4;
  } else {
    s.bank.houses--;
  }
  st.houses++;
  c.ev.push({ t: 'build', playerId: p.id, pos, level: st.houses, cost: sq.houseCost });
}

export function canSell(s: GameState, p: PlayerState, pos: number): string | null {
  const sq = square(pos);
  if (sq.kind !== 'street') return 'Ô này không có nhà';
  const st = s.properties[pos]!;
  if (st.owner !== p.id) return 'Ô này không phải của bạn';
  if (st.houses === 0) return 'Ô này không có nhà';
  const max = Math.max(...GROUP_MEMBERS[sq.group].map((i) => s.properties[i]!.houses));
  if (st.houses !== max) return 'Phải bán đều các ô trong nhóm';
  return null;
}

function sellBuilding(c: Ctx, p: PlayerState, pos: number): void {
  const { s } = c;
  const err = canSell(s, p, pos);
  if (err) fail(err);
  const sq = requireOwnedStreet(s, p, pos);
  const st = s.properties[pos]!;
  const half = Math.floor(sq.houseCost / 2);
  let refund: number;
  if (st.houses === HOTEL_LEVEL) {
    // Đổi khách sạn lấy 4 nhà; nếu kho thiếu thì xuống mức nhà kho đáp ứng được
    const k = Math.min(4, s.bank.houses);
    s.bank.hotels++;
    s.bank.houses -= k;
    refund = half * (1 + (4 - k));
    st.houses = k;
  } else {
    s.bank.houses++;
    st.houses--;
    refund = half;
  }
  p.cash += refund;
  c.ev.push({ t: 'sell', playerId: p.id, pos, level: st.houses, refund });
}

function mortgage(c: Ctx, p: PlayerState, pos: number): void {
  const { s } = c;
  const st = getProp(s, pos);
  if (st.owner !== p.id) fail('Ô này không phải của bạn');
  if (st.mortgaged) fail('Ô đã thế chấp');
  if (!groupHasNoBuildings(s, pos)) fail('Phải bán hết nhà trong nhóm trước khi thế chấp');
  const amount = mortgageValue(pos);
  st.mortgaged = true;
  p.cash += amount;
  s.mortgageChoices = s.mortgageChoices.filter((m) => m.pos !== pos);
  c.ev.push({ t: 'mortgage', playerId: p.id, pos, amount });
}

function unmortgage(c: Ctx, p: PlayerState, pos: number): void {
  const { s } = c;
  const st = getProp(s, pos);
  if (st.owner !== p.id) fail('Ô này không phải của bạn');
  if (!st.mortgaged) fail('Ô không thế chấp');
  const choice = s.mortgageChoices.find((m) => m.pos === pos && m.playerId === p.id);
  const amount = choice ? mortgageValue(pos) : unmortgageCost(pos);
  if (p.cash < amount) fail('Không đủ tiền chuộc');
  p.cash -= amount;
  st.mortgaged = false;
  s.mortgageChoices = s.mortgageChoices.filter((m) => m.pos !== pos);
  c.ev.push({ t: 'unmortgage', playerId: p.id, pos, amount });
}

function mortgageChoice(c: Ctx, p: PlayerState, pos: number, redeem: boolean): void {
  const { s } = c;
  const ch = s.mortgageChoices.find((m) => m.pos === pos && m.playerId === p.id);
  if (!ch) fail('Không có lựa chọn chuộc cho ô này');
  if (s.phase.kind === 'auction') fail('Đợi đấu giá kết thúc');
  if (redeem) {
    const amount = mortgageValue(pos);
    if (p.cash < amount) fail('Không đủ tiền chuộc');
    p.cash -= amount;
    getProp(s, pos).mortgaged = false;
    c.ev.push({ t: 'unmortgage', playerId: p.id, pos, amount });
  } else {
    c.ev.push({ t: 'keepMortgage', playerId: p.id, pos });
  }
  s.mortgageChoices = s.mortgageChoices.filter((m) => m !== ch);
}

// ---------------------------------------------------------------------------
// Phá sản
// ---------------------------------------------------------------------------

function bankrupt(c: Ctx, p: PlayerState, to: Creditor): void {
  const { s } = c;
  const creditor = to === 'bank' ? null : getPlayer(s, to);
  if (creditor && creditor.bankrupt) to = 'bank';

  // Bán nhà/khách sạn về ngân hàng
  for (const i of OWNABLE_INDICES) {
    const st = s.properties[i]!;
    if (st.owner !== p.id || st.houses === 0) continue;
    const sq = ownable(i) as StreetSquare;
    if (st.houses === HOTEL_LEVEL) s.bank.hotels++;
    else s.bank.houses += st.houses;
    if (to !== 'bank') p.cash += st.houses * Math.floor(sq.houseCost / 2);
    st.houses = 0;
  }

  const owned = OWNABLE_INDICES.filter((i) => s.properties[i]!.owner === p.id);
  if (to !== 'bank') {
    const cr = getPlayer(s, to);
    cr.cash += Math.max(0, p.cash);
    for (const i of owned) {
      const st = s.properties[i]!;
      st.owner = cr.id;
      if (st.mortgaged) {
        s.debts.push({
          from: cr.id,
          to: 'bank',
          amount: mortgageTransferFee(i),
          reason: 'mortgageFee',
        });
        s.mortgageChoices.push({ playerId: cr.id, pos: i });
      }
    }
    cr.jailCards.push(...p.jailCards);
  } else {
    for (const i of owned) {
      const st = s.properties[i]!;
      st.owner = null;
      st.mortgaged = false;
    }
    if (s.rules.auctions) s.auctionQueue.push(...owned);
    for (const d of p.jailCards) returnJailCard(s, d);
  }
  p.jailCards = [];
  p.cash = 0;
  p.bankrupt = true;
  p.inJail = false;
  s.bankruptCount++;
  p.bankruptOrder = s.bankruptCount;
  // Bỏ nợ của người phá sản, huỷ đề nghị giao dịch liên quan
  s.debts = s.debts.filter((d) => d.from !== p.id && d.to !== p.id);
  s.mortgageChoices = s.mortgageChoices.filter((m) => m.playerId !== p.id);
  for (const t of s.trades.filter((x) => x.from === p.id || x.to === p.id)) {
    c.ev.push({ t: 'tradeCancelled', tradeId: t.id, reason: 'bankrupt' });
  }
  s.trades = s.trades.filter((x) => x.from !== p.id && x.to !== p.id);
  if (currentPlayer(s).id === p.id) s.resume = { kind: 'none' };
  c.ev.push({ t: 'bankrupt', playerId: p.id, to });
}

/** Phá sản cưỡng bức về ngân hàng (bỏ cuộc / host xử lý người mất kết nối) */
function forceBankrupt(c: Ctx, p: PlayerState): void {
  const { s } = c;
  const wasCurrent = currentPlayer(s).id === p.id;
  if (s.phase.kind === 'auction' && s.auction) {
    const a = s.auction;
    a.bidders = a.bidders.filter((id) => id !== p.id);
    if (a.highBidder === p.id) {
      a.highBidder = null;
      a.highBid = 0;
      a.seq++;
    }
  }
  if (s.phase.kind === 'awaitBuy' && wasCurrent) setNeutral(s);
  bankrupt(c, p, 'bank');
  if (s.phase.kind === 'auction') {
    if (alivePlayers(s).length <= 1) endGame(c, 'lastStanding');
    return;
  }
  proceed(c);
}

function autoLiquidate(c: Ctx, id: PlayerId): void {
  const { s } = c;
  const p = getPlayer(s, id);
  const need = () => s.debts[0]?.amount ?? 0;
  // 1) bán nhà, nhóm rẻ nhất trước
  const streets = () =>
    OWNABLE_INDICES.filter((i) => {
      const st = s.properties[i]!;
      return st.owner === id && st.houses > 0;
    }).sort(
      (a, b) => (ownable(a) as StreetSquare).houseCost - (ownable(b) as StreetSquare).houseCost,
    );
  for (let guard = 0; guard < 200 && p.cash < need(); guard++) {
    const candidates = streets().filter((i) => canSell(s, p, i) === null);
    if (candidates.length === 0) break;
    sellBuilding(c, p, candidates[0]!);
  }
  // 2) thế chấp, ô rẻ nhất trước
  const mortgageable = OWNABLE_INDICES.filter((i) => {
    const st = s.properties[i]!;
    return st.owner === id && !st.mortgaged && groupHasNoBuildings(s, i);
  }).sort((a, b) => ownable(a).price - ownable(b).price);
  for (const i of mortgageable) {
    if (p.cash >= need()) break;
    mortgage(c, p, i);
  }
  if (p.cash >= need()) {
    proceed(c);
    return;
  }
  bankrupt(c, p, s.debts[0]?.to ?? 'bank');
  setNeutral(s);
  proceed(c);
}

// ---------------------------------------------------------------------------
// Giao dịch
// ---------------------------------------------------------------------------

function validateSide(s: GameState, owner: PlayerState, side: TradeSide): string | null {
  if (!Number.isInteger(side.cash) || side.cash < 0) return 'Số tiền không hợp lệ';
  if (side.cash > owner.cash) return `${owner.name} không đủ tiền mặt`;
  if (!Number.isInteger(side.jailCards) || side.jailCards < 0) return 'Số thẻ không hợp lệ';
  if (side.jailCards > owner.jailCards.length) return `${owner.name} không đủ Thẻ Bảo Lãnh`;
  if (new Set(side.properties).size !== side.properties.length) return 'Ô bị trùng';
  for (const pos of side.properties) {
    const st = s.properties[pos];
    if (!st) return 'Ô không hợp lệ';
    if (st.owner !== owner.id) return `${square(pos).name} không còn thuộc ${owner.name}`;
    if (!groupHasNoBuildings(s, pos)) return `Nhóm của ${square(pos).name} đang có nhà`;
  }
  return null;
}

function feesFor(s: GameState, props: number[]): number {
  return props
    .filter((i) => s.properties[i]!.mortgaged)
    .reduce((a, i) => a + mortgageTransferFee(i), 0);
}

export function validateTrade(s: GameState, t: Omit<Trade, 'id' | 'createdTurn'>): string | null {
  const a = s.players.find((p) => p.id === t.from);
  const b = s.players.find((p) => p.id === t.to);
  if (!a || !b || a.bankrupt || b.bankrupt) return 'Người chơi không hợp lệ';
  if (a.id === b.id) return 'Không thể giao dịch với chính mình';
  const empty =
    t.give.cash === 0 &&
    t.give.properties.length === 0 &&
    t.give.jailCards === 0 &&
    t.take.cash === 0 &&
    t.take.properties.length === 0 &&
    t.take.jailCards === 0;
  if (empty) return 'Đề nghị trống';
  const e1 = validateSide(s, a, t.give);
  if (e1) return e1;
  const e2 = validateSide(s, b, t.take);
  if (e2) return e2;
  // Mỗi bên phải đủ tiền mặt trả phí 10% cho ô thế chấp nhận về
  const aCashAfter = a.cash - t.give.cash + t.take.cash;
  const bCashAfter = b.cash - t.take.cash + t.give.cash;
  if (aCashAfter < feesFor(s, t.take.properties))
    return `${a.name} không đủ tiền trả phí 10% cho ô thế chấp`;
  if (bCashAfter < feesFor(s, t.give.properties))
    return `${b.name} không đủ tiền trả phí 10% cho ô thế chấp`;
  return null;
}

function proposeTrade(
  c: Ctx,
  p: PlayerState,
  a: Extract<PlayerAction, { type: 'proposeTrade' }>,
): void {
  const { s } = c;
  if (a.counterOf) {
    const orig = s.trades.find((x) => x.id === a.counterOf);
    if (!orig || orig.to !== p.id) fail('Không tìm thấy đề nghị gốc');
    s.trades = s.trades.filter((x) => x.id !== orig.id);
    c.ev.push({ t: 'tradeRejected', tradeId: orig.id, by: p.id });
  }
  const draft = { from: p.id, to: a.to, give: a.give, take: a.take };
  const err = validateTrade(s, draft);
  if (err) fail(err);
  const old = s.trades.find((x) => x.from === p.id && x.to === a.to);
  if (old) {
    s.trades = s.trades.filter((x) => x !== old);
    c.ev.push({ t: 'tradeCancelled', tradeId: old.id, reason: 'replaced' });
  }
  const trade: Trade = {
    id: `T${s.nextTradeId++}`,
    ...structuredClone(draft),
    createdTurn: s.turn,
  };
  s.trades.push(trade);
  c.ev.push({ t: 'tradeProposed', trade });
}

function acceptTrade(c: Ctx, p: PlayerState, id: string): void {
  const { s } = c;
  const t = s.trades.find((x) => x.id === id);
  if (!t || t.to !== p.id) fail('Không tìm thấy đề nghị');
  if (s.phase.kind === 'auction') fail('Đợi đấu giá kết thúc rồi mới chấp nhận giao dịch');
  s.trades = s.trades.filter((x) => x.id !== id);
  const err = validateTrade(s, t);
  if (err) {
    c.ev.push({ t: 'tradeCancelled', tradeId: id, reason: 'invalid' });
    return;
  }
  const a = getPlayer(s, t.from);
  const b = p;
  const transfer = (from: PlayerState, to: PlayerState, side: TradeSide) => {
    from.cash -= side.cash;
    to.cash += side.cash;
    for (const pos of side.properties) {
      const st = s.properties[pos]!;
      st.owner = to.id;
      s.mortgageChoices = s.mortgageChoices.filter((m) => m.pos !== pos);
      if (st.mortgaged) {
        const fee = mortgageTransferFee(pos);
        to.cash -= fee;
        c.ev.push({ t: 'pay', from: to.id, to: 'bank', amount: fee, reason: 'mortgageFee', pos });
        s.mortgageChoices.push({ playerId: to.id, pos });
      }
    }
    for (let k = 0; k < side.jailCards; k++) {
      const d = from.jailCards.shift();
      if (d) to.jailCards.push(d);
    }
  };
  c.ev.push({ t: 'tradeAccepted', trade: t });
  transfer(a, b, t.give);
  transfer(b, a, t.take);
}

// ---------------------------------------------------------------------------
// Hành động tự động khi hết giờ / mất kết nối
// ---------------------------------------------------------------------------

export interface TimeoutPlan {
  by: Actor;
  action: Action;
}

/** Hành động server tự làm khi hết giờ lượt (hoặc người chơi mất kết nối) */
export function timeoutAction(s: GameState): TimeoutPlan | null {
  const cur = currentPlayer(s);
  switch (s.phase.kind) {
    case 'awaitRoll':
      return { by: cur.id, action: { type: 'roll' } };
    case 'awaitBuy':
      return { by: cur.id, action: { type: 'decline' } };
    case 'awaitEnd':
      return { by: cur.id, action: { type: 'endTurn' } };
    case 'raiseFunds':
      return { by: 'system', action: { type: 'autoLiquidate' } };
    case 'auction':
      return { by: 'system', action: { type: 'auctionClose' } };
    default:
      return null;
  }
}

/** Người đang phải ra quyết định (để hiển thị & bấm giờ) */
export function actingPlayer(s: GameState): PlayerId | null {
  if (s.phase.kind === 'gameOver') return null;
  if (s.phase.kind === 'raiseFunds') return s.phase.debtor;
  if (s.phase.kind === 'auction') return null;
  return currentPlayer(s).id;
}
