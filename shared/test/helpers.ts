import {
  applyAction,
  createGame,
  scriptedRng,
  seededRng,
  TOKENS,
  type Action,
  type Actor,
  type GameEvent,
  type GameState,
  type Rules,
} from '../src/index.js';

/** Tạo ván với người chơi p1..pn theo đúng thứ tự, p1 đi trước */
export function mkGame(n = 2, rules: Partial<Rules> = {}): GameState {
  const { state } = createGame(
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
      token: TOKENS[i]!,
    })),
    rules,
    seededRng(42),
    { drawOrder: false },
  );
  state.players.sort((a, b) => a.id.localeCompare(b.id));
  state.current = 0;
  return state;
}

export function own(s: GameState, pid: string, ...positions: number[]): void {
  for (const i of positions) s.properties[i]!.owner = pid;
}

export function pl(s: GameState, id: string) {
  return s.players.find((p) => p.id === id)!;
}

export interface Step {
  state: GameState;
  events: GameEvent[];
}

/** Áp dụng hành động với xúc xắc định sẵn */
export function act(s: GameState, by: Actor, action: Action, dice: number[] = []): Step {
  return applyAction(s, by, action, scriptedRng(dice));
}

/** Đặt bộ bài sao cho thẻ `cardIdx` nằm trên cùng */
export function topCard(s: GameState, deck: 'chance' | 'chest', cardIdx: number): void {
  s.decks[deck] = [cardIdx, ...s.decks[deck].filter((x) => x !== cardIdx)];
}
