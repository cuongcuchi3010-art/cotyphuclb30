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
};

/** Câu nhật ký tiếng Việt cho một sự kiện. null = không cần ghi. */
export function describeEvent(ev: GameEvent, s: Pick<GameState, 'players'>): string | null {
  const name = (id: string | null | undefined) =>
    id === 'bank' ? 'Ngân hàng' : (s.players.find((p) => p.id === id)?.name ?? '?');
  const sq = (i: number) => square(i).name;
  switch (ev.t) {
    case 'orderRolls':
      return `Thứ tự đi: ${ev.order.map(name).join(' → ')}`;
    case 'turnStart':
      return `— Lượt ${ev.turn}: ${name(ev.playerId)} —`;
    case 'roll':
      if (ev.purpose === 'utility')
        return `${name(ev.playerId)} tung ${ev.dice[0]}+${ev.dice[1]} để tính tiền điện/viễn thông`;
      return `${name(ev.playerId)} tung ${ev.dice[0]}+${ev.dice[1]}${ev.doubles ? ' (đôi!)' : ''}`;
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
    case 'buildChance':
      return `${name(ev.playerId)} trở lại ${sq(ev.pos)}, được xây thêm nhà`;
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
      return `${name(ev.playerId)} PHÁ SẢN${ev.to === 'bank' ? '' : `, tài sản về tay ${name(ev.to)}`}`;
    case 'gameOver':
      return ev.winner ? `🏆 ${name(ev.winner)} chiến thắng!` : 'Ván đấu kết thúc';
  }
}
