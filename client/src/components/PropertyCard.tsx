import {
  GROUPS,
  TRANSPORT_RENT,
  formatMoney,
  mortgageValue,
  ownable,
  unmortgageCost,
  type OwnableSquare,
} from '@cotyphu/shared';
import { S } from '../strings.vi';
import { useStore } from '../store';
import { nameOf, playerColor, useGame } from '../lib';
import { BrandLogo } from './BrandLogo';
import { Btn, Modal } from './ui';

export function PropertyCardModal() {
  const openSquare = useStore((s) => s.openSquare);
  const setOpen = useStore((s) => s.setOpenSquare);
  return (
    <Modal open={openSquare !== null} onClose={() => setOpen(null)}>
      {openSquare !== null && <PropertyCard pos={openSquare} onClose={() => setOpen(null)} />}
    </Modal>
  );
}

export function PropertyCard({ pos, onClose }: { pos: number; onClose: () => void }) {
  const { room, game, me } = useGame();
  const act = useStore((s) => s.act);
  const sq: OwnableSquare = ownable(pos);
  const st = game?.properties[pos];
  const mine = !!me && st?.owner === me;
  const head = sq.kind === 'street' ? GROUPS[sq.group].color : sq.brandColor;

  return (
    <div>
      <div
        className="-mx-5 -mt-5 mb-4 rounded-t-3xl px-5 py-4 text-center text-white"
        style={{ background: head }}
      >
        {sq.kind !== 'street' && (
          <div className="mb-1 flex justify-center">
            <BrandLogo id={sq.logo} name={sq.name} color="rgba(0,0,0,.2)" size={40} />
          </div>
        )}
        <div className="text-xs uppercase tracking-wider opacity-90">
          {sq.kind === 'street'
            ? `Nhóm ${GROUPS[sq.group].name}`
            : sq.kind === 'transport'
              ? 'Công ty vận tải'
              : 'Công ty tiện ích'}
        </div>
        <div className="text-xl font-bold drop-shadow">{sq.name}</div>
      </div>

      <table className="w-full text-sm">
        <tbody className="[&_td]:py-1 [&_td:last-child]:text-right [&_td:last-child]:font-semibold">
          <tr>
            <td>{S.card.price}</td>
            <td>{formatMoney(sq.price)}</td>
          </tr>
          {sq.kind === 'street' && (
            <>
              <tr>
                <td>{S.card.rent}</td>
                <td>{formatMoney(sq.rent[0])}</td>
              </tr>
              <tr>
                <td>{S.card.rentGroup}</td>
                <td>{formatMoney(sq.rent[0] * 2)}</td>
              </tr>
              {[1, 2, 3, 4].map((h) => (
                <tr key={h}>
                  <td>{S.card.withHouses(h)}</td>
                  <td>{formatMoney(sq.rent[h]!)}</td>
                </tr>
              ))}
              <tr>
                <td>{S.card.hotel}</td>
                <td>{formatMoney(sq.rent[5])}</td>
              </tr>
              <tr className="border-t border-black/10 dark:border-white/10">
                <td>{S.card.houseCost}</td>
                <td>{formatMoney(sq.houseCost)}</td>
              </tr>
            </>
          )}
          {sq.kind === 'transport' &&
            [1, 2, 3, 4].map((n) => (
              <tr key={n}>
                <td>{S.card.transportRent(n)}</td>
                <td>{formatMoney(TRANSPORT_RENT[n]!)}</td>
              </tr>
            ))}
          {sq.kind === 'utility' && (
            <>
              <tr>
                <td colSpan={2}>{S.card.utility1}</td>
              </tr>
              <tr>
                <td colSpan={2}>{S.card.utility2}</td>
              </tr>
            </>
          )}
          <tr className="border-t border-black/10 dark:border-white/10">
            <td>{S.card.mortgage}</td>
            <td>{formatMoney(mortgageValue(pos))}</td>
          </tr>
          <tr>
            <td>{S.card.unmortgage}</td>
            <td>{formatMoney(unmortgageCost(pos))}</td>
          </tr>
        </tbody>
      </table>

      {st && (
        <div className="mt-3 rounded-xl bg-black/5 p-3 text-sm dark:bg-white/10">
          <div className="flex items-center justify-between">
            <span>{S.card.owner}</span>
            <span className="flex items-center gap-1.5 font-semibold">
              {st.owner && (
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: playerColor(room, st.owner) }}
                />
              )}
              {st.owner ? nameOf(room, st.owner) : S.card.noOwner}
            </span>
          </div>
          {sq.kind === 'street' && (
            <div className="flex justify-between">
              <span>{S.card.status}</span>
              <span className="font-semibold">{S.card.level(st.houses)}</span>
            </div>
          )}
          {st.mortgaged && (
            <div className="mt-1 text-center font-bold text-son">{S.card.mortgagedTag}</div>
          )}
        </div>
      )}

      {mine && st && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {sq.kind === 'street' && (
            <>
              <Btn variant="secondary" onClick={() => act({ type: 'build', pos })}>
                🏠 {S.assets.build} ({formatMoney(sq.houseCost)})
              </Btn>
              <Btn
                variant="ghost"
                disabled={st.houses === 0}
                onClick={() => act({ type: 'sell', pos })}
              >
                {S.assets.sell} (+{formatMoney(sq.houseCost / 2)})
              </Btn>
            </>
          )}
          {st.mortgaged ? (
            <Btn variant="gold" onClick={() => act({ type: 'unmortgage', pos })}>
              {S.assets.unmortgage} ({formatMoney(unmortgageCost(pos))})
            </Btn>
          ) : (
            <Btn variant="ghost" onClick={() => act({ type: 'mortgage', pos })}>
              {S.assets.mortgage} (+{formatMoney(mortgageValue(pos))})
            </Btn>
          )}
        </div>
      )}
      <Btn variant="ghost" big className="mt-4 w-full" onClick={onClose}>
        {S.card.close}
      </Btn>
    </div>
  );
}
