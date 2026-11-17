import {
  DECKS,
  HOTEL_LEVEL,
  OWNABLE_INDICES,
  actingPlayer,
  applyAction,
  canBuild,
  candidateActions,
  createGame,
  seededRng,
  shuffle,
  TOKENS,
  type Action,
  type Actor,
  type GameState,
  type Rng,
} from '../src/index.js';

const PROGRESS = new Set([
  'roll',
  'buy',
  'decline',
  'endTurn',
  'payDebt',
  'declareBankruptcy',
  'payBail',
  'useJailCard',
]);

function tryApply(s: GameState, by: Actor, a: Action, rng: Rng): GameState | null {
  try {
    return applyAction(s, by, a, rng).state;
  } catch (e) {
    if ((e as Error).name !== 'GameError') throw e;
    return null;
  }
}

function checkInvariants(s: GameState): void {
  let houses = 0;
  let hotels = 0;
  for (const i of OWNABLE_INDICES) {
    const st = s.properties[i]!;
    if (st.houses === HOTEL_LEVEL) hotels++;
    else houses += st.houses;
    if (st.owner) {
      const o = s.players.find((p) => p.id === st.owner);
      if (!o || o.bankrupt) throw new Error(`Ô ${i} thuộc người không hợp lệ`);
    }
    if (st.mortgaged && st.houses > 0) throw new Error(`Ô ${i} thế chấp mà có nhà`);
    if (!st.owner && (st.houses > 0 || st.mortgaged))
      throw new Error(`Ô ${i} của ngân hàng có trạng thái lạ`);
  }
  const H = s.rules.houseStock;
  const K = s.rules.hotelStock;
  if (houses > H || hotels > K) throw new Error('Vượt giới hạn kho');
  if (houses + s.bank.houses !== H) throw new Error(`Lệch kho nhà ${houses}+${s.bank.houses}`);
  if (hotels + s.bank.hotels !== K) throw new Error('Lệch kho khách sạn');
  if (s.bank.houses < 0 || s.bank.hotels < 0) throw new Error('Kho âm');
  for (const p of s.players) {
    if (p.cash < 0) throw new Error(`${p.id} âm tiền ${p.cash} ở pha ${s.phase.kind}`);
  }
  for (const deck of ['chance', 'chest'] as const) {
    const held = s.players.reduce((a, p) => a + p.jailCards.filter((d) => d === deck).length, 0);
    if (s.decks[deck].length + held !== DECKS[deck].length)
      throw new Error(`Bộ ${deck} lệch số thẻ`);
  }
}

function step(s: GameState, rng: Rng): GameState {
  const ph = s.phase;
  if (ph.kind === 'auction') {
    if (rng.int(0, 2) > 0) {
      const alive = s.players.filter((p) => !p.bankrupt);
      const p = alive[rng.int(0, alive.length - 1)]!;
      const h = s.auction!.highBid;
      const amount = [Math.max(10, h + 10), h + 50, h + 100][rng.int(0, 2)]!;
      const ns = tryApply(s, p.id, { type: 'bid', amount }, rng);
      if (ns) return ns;
    }
    return applyAction(s, 'system', { type: 'auctionClose' }, rng).state;
  }
  // Thỉnh thoảng một người khác phản hồi giao dịch
  if (s.trades.length > 0 && rng.int(0, 3) === 0) {
    const t = s.trades[rng.int(0, s.trades.length - 1)]!;
    const a: Action = rng.int(0, 1)
      ? { type: 'acceptTrade', id: t.id }
      : { type: 'rejectTrade', id: t.id };
    const ns = tryApply(s, t.to, a, rng);
    if (ns) return ns;
  }
  if (ph.kind === 'raiseFunds' && rng.int(0, 4) === 0) {
    return applyAction(s, 'system', { type: 'autoLiquidate' }, rng).state;
  }
  const actor = actingPlayer(s)!;
  // Phần lớn thời gian chơi "tham" (mua hết, xây nhiều) để ván kết thúc thật
  if (rng.int(0, 9) < 8) {
    const greedy: Action[] = [];
    const me = s.players.find((p) => p.id === actor)!;
    if (ph.kind === 'awaitBuy') greedy.push({ type: 'buy' });
    if (ph.kind === 'awaitEnd' || ph.kind === 'awaitRoll') {
      for (const i of shuffle([...OWNABLE_INDICES], rng)) {
        if (s.properties[i]!.owner === actor && canBuild(s, me, i) === null)
          greedy.push({ type: 'build', pos: i });
      }
    }
    if (ph.kind === 'awaitRoll') greedy.push({ type: 'roll' });
    if (ph.kind === 'awaitEnd') greedy.push({ type: 'endTurn' });
    for (const a of greedy) {
      const ns = tryApply(s, actor, a, rng);
      if (ns) return ns;
    }
  }
  const cands = shuffle(candidateActions(s, actor, rng), rng);
  const progress = cands.filter((a) => PROGRESS.has(a.type));
  const other = cands.filter(
    (a) => !PROGRESS.has(a.type) && (a.type !== 'proposeTrade' || rng.int(0, 5) === 0),
  );
  const order = rng.int(0, 9) < 7 ? [...progress, ...other] : [...other, ...progress];
  for (const a of order) {
    const ns = tryApply(s, actor, a, rng);
    if (ns) return ns;
  }
  if (ph.kind === 'raiseFunds')
    return applyAction(s, 'system', { type: 'autoLiquidate' }, rng).state;
  throw new Error(`Kẹt: không có hành động hợp lệ ở pha ${ph.kind}`);
}

export function runSimulation(from: number, count: number): { finished: number; capped: number } {
  let finished = 0;
  let capped = 0;
  for (let g = from; g < from + count; g++) {
    const rng = seededRng(1000 + g);
    const n = 2 + (g % 5);
    let { state: s } = createGame(
      Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, token: TOKENS[i]! })),
      {
        jackpot: g % 3 === 0,
        doubleGo: g % 4 === 0,
        auctions: g % 7 !== 0,
        buildRule: g % 2 === 0 ? 'landing' : 'monopoly',
        houseStock: [32, 12, 64][g % 3]!,
        hotelStock: [12, 3, 24][g % 3]!,
      },
      rng,
    );
    let actions = 0;
    while (s.phase.kind !== 'gameOver' && s.turn < 2000) {
      s = step(s, rng);
      checkInvariants(s);
      if (++actions > 100_000) throw new Error(`Ván ${g}: quá nhiều hành động`);
    }
    if (s.phase.kind === 'gameOver') {
      finished++;
      if (s.players.filter((p) => !p.bankrupt).length !== 1)
        throw new Error(`Ván ${g}: kết thúc sai`);
    } else capped++;
  }
  return { finished, capped };
}
