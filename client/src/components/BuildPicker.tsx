import { useMemo } from 'react';
import {
  applyAction,
  formatMoney,
  rentFor,
  seededRng,
  square,
  type GameState,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { squareName } from '../lib';
import { Btn, Modal } from './ui';

/** Các lựa chọn xây liền 1…n cấp (mô phỏng bằng engine để đúng luật ván) */
function buildOptions(game: GameState, me: string, pos: number) {
  const out: { count: number; level: number; cost: number; rent: number }[] = [];
  const cost = (square(pos) as { houseCost: number }).houseCost;
  for (let n = 1; n <= 5; n++) {
    try {
      const { state } = applyAction(game, me, { type: 'build', pos, count: n }, seededRng(1));
      out.push({
        count: n,
        level: state.properties[pos]!.houses,
        cost: cost * n,
        rent: rentFor(state, pos, { diceTotal: 7 }),
      });
    } catch {
      break;
    }
  }
  return out;
}

/** Hộp "Xây mấy nhà?": chọn xây liền 1–4 nhà (hoặc khách sạn) kèm giá và tiền thuê sau khi xây */
export function BuildPicker({
  pos,
  open,
  onClose,
}: {
  pos: number;
  open: boolean;
  onClose: () => void;
}) {
  const game = useStore((s) => s.room?.game ?? null);
  const me = useStore((s) => s.me);
  const act = useStore((s) => s.act);
  const opts = useMemo(
    () => (game && me && open ? buildOptions(game, me, pos) : []),
    [game, me, pos, open],
  );
  if (!game || !me) return null;
  const st = game.properties[pos]!;
  const meP = game.players.find((p) => p.id === me);
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center text-lg font-bold">🏗️ {S.build.title}</div>
      <div className="mt-2 rounded-2xl bg-son px-3 py-2 text-center text-white">
        <div className="text-xs opacity-90">{S.build.landed}</div>
        <div className="text-xl font-black">{squareName(game, pos)}</div>
      </div>
      <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-300">
        {S.build.now(
          st.houses === 0 ? S.build.empty : st.houses === 5 ? S.build.hotel : `${st.houses} nhà`,
          formatMoney((square(pos) as { houseCost: number }).houseCost),
          formatMoney(meP?.cash ?? 0),
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {opts.map((o) => (
          <button
            key={o.count}
            type="button"
            onClick={() => {
              act({ type: 'build', pos, count: o.count });
              onClose();
            }}
            className="rounded-xl bg-ngoc px-2 py-2 text-white shadow hover:bg-ngoc-600"
          >
            <div className="font-black">
              {o.level === 5 ? `🏨 ${S.build.hotel}` : `🏠 ${o.level} nhà`}
            </div>
            <div className="text-xs opacity-90">
              −{formatMoney(o.cost)} · {S.build.rent} {formatMoney(o.rent)}
            </div>
          </button>
        ))}
      </div>
      {opts.length === 0 && <div className="mt-2 text-center text-sm text-son">{S.build.none}</div>}
      <Btn variant="ghost" className="mt-3 w-full" onClick={onClose}>
        {S.build.later}
      </Btn>
    </Modal>
  );
}
