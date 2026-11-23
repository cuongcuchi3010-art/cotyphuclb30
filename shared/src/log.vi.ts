import type { GameEvent } from './actions.js';
import { square } from './data/board.vi.js';
import { DECK_NAMES, cardById } from './data/cards.vi.js';
import { formatMoney } from './format.js';
import type { GameState } from './types.js';

const REASON: Record<string, string> = {
  rent: 'tiền thuê',
  tax: 'thuế',
  card: 'theo thẻ',
  jailFine: 'tiền nộp phạt tạm giữ',
  mortgageFee: 'phí 10% nhận ô thế chấp',
  payEach: 'theo thẻ Chủ tịch HĐQT',
  collectEach: 'lì xì Tết',
  loan: 'trả nợ vay đến hạn',
  casino: 'thua cược Sòng Bạc',
};

/** Tên hai ô Sòng Bạc (Freestyle) */
export const CASINO_NAMES = { cash: 'Sòng Bạc Tiền', land: 'Sòng Bạc Đất' } as const;

/** Câu nhật ký tiếng Việt cho một sự kiện. null = không cần ghi. */
export function describeEvent(
  ev: GameEvent,
  s: Pick<GameState, 'players'> & { rules?: Pick<GameState['rules'], 'mode'> },
): string | null {
  const name = (id: string | null | undefined) =>
    id === 'bank' ? 'Ngân hàng' : (s.players.find((p) => p.id === id)?.name ?? '?');
  const free = s.rules?.mode === 'freestyle';
  const sq = (i: number) =>
    free && i === 12
      ? CASINO_NAMES.cash
      : free && i === 28
        ? CASINO_NAMES.land
        : free && i === 20
          ? 'Lễ Hội'
          : square(i).name;
  const dice = (d: [number, number]) => `${d[0]}+${d[1]}=${d[0] + d[1]}`;
  switch (ev.t) {
    case 'orderRolls':
      return `Thứ tự đi: ${ev.order.map(name).join(' → ')}`;
    case 'drawStart':
      return `🎴 Bốc thăm thứ tự xuất phát (${ev.count} lá)`;
    case 'lotDrawn':
      return `${name(ev.playerId)} bốc được số ${ev.number}`;
    case 'orderDrawn':
      return `Thứ tự đi: ${ev.order.map(name).join(' → ')}`;
    case 'turnStart':
      return `— Lượt ${ev.turn}: ${name(ev.playerId)} —`;
    case 'roll':
      if (ev.purpose === 'utility')
        return `${name(ev.playerId)} tung ${ev.dice[0]}+${ev.dice[1]} để tính tiền điện/viễn thông`;
      return `${name(ev.playerId)} tung ${ev.dice[0]}+${ev.dice[1]}${ev.doubles ? ' (đôi!)' : ''}${ev.power ? ` · lực ${ev.power}%` : ''}`;
    case 'move':
      if (ev.steps === 0) return null;
      if (ev.steps < 0) return `${name(ev.playerId)} lùi ${-ev.steps} ô tới ${sq(ev.to)}`;
      return `${name(ev.playerId)} đi tới ${sq(ev.to)}`;
    case 'passGo':
      return `${name(ev.playerId)} qua Khởi Hành, nhận ${formatMoney(ev.amount)}`;
    case 'land':
    case 'offer':
      return null;
    case 'buy':
      return `${name(ev.playerId)} mua ${sq(ev.pos)} giá ${formatMoney(ev.price)}`;
    case 'decline':
      return `${name(ev.playerId)} không mua ${sq(ev.pos)}`;
    case 'pay': {
      const to = ev.to === 'jackpot' ? 'Hũ tiền Cà Phê' : name(ev.to);
      return `${name(ev.from)} trả ${formatMoney(ev.amount)} cho ${to} (${REASON[ev.reason] ?? ev.reason})`;
    }
    case 'collect':
      return ev.reason === 'jackpot'
        ? `${name(ev.playerId)} ôm trọn Hũ tiền Cà Phê: ${formatMoney(ev.amount)}!`
        : `${name(ev.playerId)} nhận ${formatMoney(ev.amount)}`;
    case 'card':
      return `${name(ev.playerId)} rút thẻ ${DECK_NAMES[ev.deck]}: “${cardById(ev.cardId).text}”`;
    case 'getJailCard':
      return `${name(ev.playerId)} giữ một Thẻ Bảo Lãnh`;
    case 'jail':
      return ev.reason === 'doubles'
        ? `${name(ev.playerId)} tung đôi 3 lần — vào Phòng Tạm Giữ!`
        : `${name(ev.playerId)} vào Phòng Tạm Giữ`;
    case 'leaveJail':
      return {
        paid: `${name(ev.playerId)} nộp 50 tr, ra khỏi Phòng Tạm Giữ`,
        card: `${name(ev.playerId)} dùng Thẻ Bảo Lãnh, ra khỏi Phòng Tạm Giữ`,
        doubles: `${name(ev.playerId)} tung được đôi, ra khỏi Phòng Tạm Giữ`,
        forced: `${name(ev.playerId)} hết 3 lần, buộc nộp 50 tr để ra`,
      }[ev.how];
    case 'jailStay':
      return `${name(ev.playerId)} chưa được đôi, ở lại tạm giữ (lần ${ev.attempts}/3)`;
    case 'auctionStart':
      return `Bắt đầu đấu giá ${sq(ev.pos)}`;
    case 'bid':
      return `${name(ev.playerId)} trả ${formatMoney(ev.amount)}`;
    case 'auctionWon':
      return `${name(ev.playerId)} thắng đấu giá ${sq(ev.pos)} với ${formatMoney(ev.amount)}`;
    case 'auctionNoBids':
      return `Không ai trả giá, ${sq(ev.pos)} vẫn thuộc ngân hàng`;
    case 'houseLost':
      return ev.reason === 'fire'
        ? `🔥 Cháy nhà ở ${sq(ev.pos)} của ${name(ev.playerId)} (còn ${ev.level === 5 ? 'khách sạn' : `${ev.level} nhà`})`
        : `🔨 ${name(ev.by)} đập nhà của ${name(ev.playerId)} ở ${sq(ev.pos)} (còn ${ev.level} nhà)`;
    case 'propertyGifted':
      return `🎁 ${name(ev.from)} buộc phải tặng ${sq(ev.pos)} cho ${name(ev.to)}`;
    case 'propertyWon':
      return `🍀 ${name(ev.playerId)} trúng thưởng ô ${sq(ev.pos)}`;
    case 'festival':
      return (
        `🎉 ${name(ev.playerId)} tổ chức Lễ hội ở ${sq(ev.pos)}: tiền thuê ×${ev.mult ?? 2}!` +
        (ev.ended?.length ? ` Lễ hội ở ${ev.ended.map(sq).join(', ')} kết thúc.` : '')
      );
    case 'choosing':
      if (ev.choice === 'swap')
        return `😈 ${name(ev.playerId)} đang chọn người để hoán đổi tài sản…`;
      if (ev.choice === 'teleport')
        return `😈 ${name(ev.playerId)} đang chọn ô để dịch chuyển tới…`;
      return ev.choice === 'festival'
        ? `${name(ev.playerId)} đang chọn ô tổ chức lễ hội…`
        : ev.choice === 'demolish'
          ? `${name(ev.playerId)} đang chọn nhà để đập…`
          : `${name(ev.playerId)} đang chọn ô đất để tặng…`;
    case 'assetsSwapped':
      return `😈 ${name(ev.a)} hoán đổi toàn bộ tài sản với ${name(ev.b)}!`;
    case 'frozen':
      return `❄️ Băng giá! Mọi ô đất bị đóng băng tới lượt ${ev.until}: không thu thuê, không xây nhà`;
    case 'frozenRent':
      return `❄️ ${name(ev.playerId)} dừng ở ${sq(ev.pos)} đang đóng băng: không phải trả thuê`;
    case 'thunder':
      return `⚡ Thiên Lôi đánh sập nhà ở ${ev.hits.map((h) => `${sq(h.pos)} (${name(h.owner)})`).join(', ')}`;
    case 'teleport':
      return `😈 ${name(ev.playerId)} dịch chuyển tới ${sq(ev.pos)}`;
    case 'mercyRequested':
      return `🙏 ${name(ev.payer)} xin ${name(ev.owner)} ban ân huệ (tiền thuê ${formatMoney(ev.amount)})`;
    case 'mercy':
      return ev.choice === 'free'
        ? `🙏 ${name(ev.owner)} ban ân huệ: giảm 100% tiền thuê ${sq(ev.pos)} cho ${name(ev.payer)}`
        : ev.choice === 'half'
          ? `🙏 ${name(ev.owner)} ban ân huệ: giảm 50%, ${name(ev.payer)} chỉ trả ${formatMoney(ev.amount)}`
          : `${name(ev.owner)} từ chối ban ân huệ cho ${name(ev.payer)}`;
    case 'casinoOpen':
      return ev.kind === 'cash'
        ? `🎰 ${name(ev.opener)} mở ${CASINO_NAMES.cash}: mọi người đặt cược (tối đa ${formatMoney(ev.cap)})`
        : `🎰 ${name(ev.opener)} mở ${CASINO_NAMES.land}: ai muốn chơi thì đặt 1 ô đất`;
    case 'casinoSkip':
      return `🎰 ${CASINO_NAMES[ev.kind]} không mở được: ${ev.reason === 'noCash' ? `${name(ev.opener)} không đủ tiền làm nhà cái` : 'không đủ người có thể tham gia'}`;
    case 'casinoBet':
      return `${name(ev.playerId)} cược ${formatMoney(ev.amount)}`;
    case 'casinoStake':
      return `${name(ev.playerId)} đặt ${sq(ev.pos)}`;
    case 'casinoPass':
      return `${name(ev.playerId)} không chơi`;
    case 'casinoCancel':
      return `🎰 ${CASINO_NAMES[ev.kind]}: không đủ người đặt, huỷ bàn`;
    case 'casinoRolling':
      return ev.round > 1 ? '🎲 Hoà điểm cao nhất, đổ lại' : '🎲 Đổ xí ngầu!';
    case 'casinoRoll':
      return `${name(ev.playerId)} đổ ${dice(ev.dice)}`;
    case 'casinoTie':
      return `Hoà ${ev.total} điểm: ${ev.players.map(name).join(', ')}`;
    case 'casinoResult':
      if (ev.kind === 'cash') {
        const parts = ev.results.map((r) =>
          r.outcome === 'win'
            ? `${name(r.playerId)} thắng ${formatMoney(r.bet)}`
            : r.outcome === 'lose'
              ? `${name(r.playerId)} thua ${formatMoney(r.bet)}`
              : `${name(r.playerId)} hoà`,
        );
        return `🎰 Nhà cái ${name(ev.opener)} đổ ${dice(ev.openerDice)}: ${parts.join(' · ')}`;
      }
      return ev.won.length
        ? `🏆 ${name(ev.winner)} đổ ${dice(ev.dice)}, lấy ${ev.won.map((w) => sq(w.pos)).join(', ')}`
        : `🏆 ${name(ev.winner)} thắng bàn cược đất`;
    case 'cardNoEffect':
      return `Thẻ không có tác dụng với ${name(ev.playerId)}`;
    case 'buildChance':
      return `${name(ev.playerId)} trở lại ${sq(ev.pos)}, được xây nhà`;
    case 'build':
      return ev.level === 5
        ? `${name(ev.playerId)} xây khách sạn ở ${sq(ev.pos)}`
        : `${name(ev.playerId)} xây nhà ở ${sq(ev.pos)} (${ev.level} nhà)`;
    case 'sell':
      return `${name(ev.playerId)} bán công trình ở ${sq(ev.pos)}, nhận ${formatMoney(ev.refund)}`;
    case 'mortgage':
      return `${name(ev.playerId)} thế chấp ${sq(ev.pos)}, nhận ${formatMoney(ev.amount)}`;
    case 'unmortgage':
      return `${name(ev.playerId)} chuộc ${sq(ev.pos)}, trả ${formatMoney(ev.amount)}`;
    case 'keepMortgage':
      return `${name(ev.playerId)} giữ nguyên thế chấp ${sq(ev.pos)}`;
    case 'tradeProposed':
      return `${name(ev.trade.from)} gửi đề nghị giao dịch cho ${name(ev.trade.to)}`;
    case 'tradeAccepted':
      return `${name(ev.trade.to)} chấp nhận giao dịch với ${name(ev.trade.from)}`;
    case 'tradeRejected':
      return `${name(ev.by)} từ chối một đề nghị giao dịch`;
    case 'tradeCancelled':
      return ev.reason === 'invalid'
        ? 'Một đề nghị giao dịch bị huỷ vì tài sản đã thay đổi'
        : ev.reason === 'replaced'
          ? null
          : 'Một đề nghị giao dịch đã bị huỷ';
    case 'loanTaken':
      return `${name(ev.borrower)} vay ${name(ev.lender)} ${formatMoney(ev.amount)}, trả ${formatMoney(ev.repay)} trong ${ev.turns} lượt`;
    case 'loanRepaid':
      return `${name(ev.borrower)} trả hết nợ ${formatMoney(ev.amount)} cho ${name(ev.lender)}`;
    case 'loanDue':
      return `Khoản vay của ${name(ev.borrower)} đến hạn: phải trả ${formatMoney(ev.amount)} cho ${name(ev.lender)}`;
    case 'loanOffered':
      return ev.offer.lender === ev.offer.from
        ? `${name(ev.offer.from)} đề nghị cho ${name(ev.offer.to)} vay ${formatMoney(ev.offer.amount)}`
        : `${name(ev.offer.from)} xin vay ${name(ev.offer.to)} ${formatMoney(ev.offer.amount)}`;
    case 'loanRejected':
      return `${name(ev.by)} từ chối một đề nghị vay`;
    case 'loanCancelled':
      return ev.reason === 'invalid' ? 'Một đề nghị vay bị huỷ vì không còn đủ tiền' : null;
    case 'raiseFunds':
      return `${name(ev.playerId)} thiếu ${formatMoney(ev.owed)} — phải gom tiền!`;
    case 'bankrupt':
      if (ev.buyout)
        return `${name(ev.playerId)} PHÁ SẢN: ngân hàng mua lại nhà${ev.to === 'bank' ? '' : `, tiền trả cho ${name(ev.to)}`}; các ô thành đất trống`;
      return `${name(ev.playerId)} PHÁ SẢN${ev.to === 'bank' ? '' : `, tài sản về tay ${name(ev.to)}`}`;
    case 'gameOver':
      return ev.winner ? `🏆 ${name(ev.winner)} chiến thắng!` : 'Ván đấu kết thúc';
  }
}
