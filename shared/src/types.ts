import type { DeckId } from './data/cards.vi.js';

export type PlayerId = string;

export const TOKENS = [
  'xe-may',
  'non-la',
  'banh-mi',
  'ca-phe',
  'con-trau',
  'xich-lo',
  'hoa-sen',
  'ao-dai',
] as const;
export type TokenId = (typeof TOKENS)[number];

export interface Rules {
  startingCash: number;
  /** Hũ tiền Cà Phê Vỉa Hè */
  jackpot: boolean;
  /** Dừng đúng Khởi Hành (bằng xúc xắc) nhận gấp đôi */
  doubleGo: boolean;
  /** true = có đấu giá (luật chính thức) */
  auctions: boolean;
  /** 0 = tắt; 30/60/90 phút */
  timeLimitMinutes: 0 | 30 | 60 | 90;
  /** 0 = tắt đồng hồ lượt */
  turnTimerSec: number;
  /** Số nhà tối đa trong kho ngân hàng (chuẩn 32) */
  houseStock: number;
  /** Số khách sạn tối đa trong kho ngân hàng (chuẩn 12) */
  hotelStock: number;
  /** Hiện tổng tài sản & thứ hạng của mọi người suốt ván */
  showStandings: boolean;
  /**
   * Chế độ xây nhà:
   * - combined ("Trăm điều khó"): trọn nhóm màu + bước vào lại ô mới được xây
   * - color: trọn nhóm màu là xây được bất cứ lúc nào trong lượt mình
   * - landing: bước vào lại ô của mình là xây được (không cần trọn màu)
   */
  buildRule: BuildRule;
  /** Thay ô Cà Phê Vỉa Hè (20) bằng ô Lễ Hội: ai dừng ở đó được chọn 1 ô đất của mình, thuê ×2 */
  festivalSquare: boolean;
  /** Số ô lễ hội tối đa cùng lúc (1–5, chuẩn 3) */
  maxFestivals: number;
  /** Chế độ chơi: Cổ điển hoặc Freestyle (tiền to, xây ngay, sòng bạc) */
  mode: GameMode;
  /** Tiền qua / dừng Khởi Hành (chuẩn 200) */
  goSalary: number;
  /** Freestyle: hệ số tiền thuê */
  rentMult: number;
  /** Freestyle: hệ số tiền phạt / thuế / tiền thẻ */
  feeMult: number;
  /** Freestyle: mức cược tối đa mỗi người ở Sòng Bạc Tiền */
  casinoMaxBet: number;
  /** Freestyle: số nhà tối đa được xây ngay lần đầu (vừa mua xong), 0–4 */
  firstBuildMax: number;
  /**
   * Khi phá sản:
   * - creditor: chủ nợ nhận hết tiền, nhà đất (luật chính thức)
   * - bankBuyout: ngân hàng mua lại hết nhà (50% giá xây), tiền đó cùng tiền mặt trả cho chủ nợ; đất thành đất trống
   */
  bankruptcyMode: BankruptcyMode;
  /** Quyền ân huệ: chủ ô được miễn / giảm 50% tiền thuê, mỗi người chơi khác 1 lần */
  mercy: boolean;
  /** Freestyle: thêm Bộ thẻ Ác Quỷ (hoán đổi tài sản, băng giá, Thiên Lôi, dịch chuyển) */
  devilCards: boolean;
}

export type BankruptcyMode = 'creditor' | 'bankBuyout';

/** Thẻ cho người rút tự chọn */
export type CardChoiceKind = 'demolish' | 'gift' | 'festival' | 'swap' | 'teleport';

export type GameMode = 'classic' | 'freestyle';

export type BuildRule = 'combined' | 'color' | 'landing';

export const DEFAULT_RULES: Rules = {
  startingCash: 1500,
  jackpot: false,
  doubleGo: false,
  auctions: true,
  timeLimitMinutes: 0,
  turnTimerSec: 90,
  houseStock: 32,
  hotelStock: 12,
  showStandings: false,
  buildRule: 'combined',
  festivalSquare: false,
  maxFestivals: 3,
  mode: 'classic',
  goSalary: 200,
  rentMult: 2,
  feeMult: 2,
  casinoMaxBet: 0,
  firstBuildMax: 4,
  bankruptcyMode: 'creditor',
  mercy: true,
  devilCards: false,
};

export interface PlayerStats {
  rentCollected: number;
  rentPaid: number;
  jailVisits: number;
  doubles: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  token: TokenId;
  cash: number;
  position: number;
  inJail: boolean;
  /** Số lần tung tìm đôi thất bại trong lượt tạm giữ hiện tại */
  jailAttempts: number;
  /** Thẻ Bảo Lãnh đang giữ (ghi nhớ bộ bài gốc để trả về) */
  jailCards: DeckId[];
  bankrupt: boolean;
  /** Thứ tự phá sản (1 = phá sản đầu tiên) */
  bankruptOrder?: number;
  stats: PlayerStats;
}

export interface PropertyState {
  owner: PlayerId | null;
  /** 0–4 nhà, 5 = khách sạn */
  houses: number;
  mortgaged: boolean;
}

export type Creditor = PlayerId | 'bank';

export interface Debt {
  from: PlayerId;
  to: Creditor;
  amount: number;
  reason: DebtReason;
  /** Ô liên quan (thuê) */
  pos?: number;
  /** Đã xin ân huệ cho khoản này (bị từ chối thì không xin lại) */
  mercyAsked?: boolean;
}

export type DebtReason =
  | 'rent'
  | 'tax'
  | 'card'
  | 'jailFine'
  | 'mortgageFee'
  | 'payEach'
  | 'collectEach'
  | 'loan'
  | 'casino';

/** Việc cần làm tiếp sau khi trả hết nợ */
export type Resume =
  | { kind: 'afterLanding' }
  /** Sau khi trả 50 bắt buộc ở lần thứ 3: đi theo số đã tung */
  | { kind: 'moveAfterJail'; steps: number }
  | { kind: 'none' };

export interface Auction {
  pos: number;
  highBid: number;
  highBidder: PlayerId | null;
  /** Những người còn đủ tư cách tham gia */
  bidders: PlayerId[];
  /** Tăng mỗi lần có giá mới (server dùng để reset đồng hồ) */
  seq: number;
}

export interface TradeSide {
  cash: number;
  properties: number[];
  jailCards: number;
}

export interface Trade {
  id: string;
  from: PlayerId;
  to: PlayerId;
  /** Người đề nghị đưa */
  give: TradeSide;
  /** Người đề nghị nhận */
  take: TradeSide;
  createdTurn: number;
}

/** Khoản vay đang hiệu lực */
export interface Loan {
  id: string;
  lender: PlayerId | 'bank';
  borrower: PlayerId;
  principal: number;
  /** Số tiền phải trả lại (gốc + lãi) */
  repay: number;
  /** Số lượt (của người vay) còn lại trước khi đến hạn */
  turnsLeft: number;
}

/** Đề nghị vay / cho vay giữa người chơi, chờ người kia đồng ý */
export interface LoanOffer {
  id: string;
  from: PlayerId;
  to: PlayerId;
  lender: PlayerId;
  borrower: PlayerId;
  amount: number;
  repay: number;
  turns: number;
}

export const BANK_LOAN_MAX = 500;
export const BANK_LOAN_RATE_PCT = 10;
export const BANK_LOAN_TURNS = 5;
export const PLAYER_LOAN_MAX_TURNS = 20;

export type Phase =
  | { kind: 'awaitRoll' }
  | { kind: 'awaitBuy'; pos: number }
  | { kind: 'auction' }
  | { kind: 'awaitEnd' }
  /** Bốc thăm thứ tự xuất phát (đầu ván) */
  | { kind: 'drawOrder' }
  /** Thẻ cho người rút tự chọn: đập nhà người khác / tặng ô đất */
  | { kind: 'cardChoice'; choice: CardChoiceKind }
  | { kind: 'raiseFunds'; debtor: PlayerId }
  /** Freestyle: bàn cược Sòng Bạc đang mở (chi tiết ở state.casino) */
  | { kind: 'casino' }
  /** Quyền ân huệ: người thiếu tiền trả thuê đã xin, chủ ô chọn giảm 100% / 50% / từ chối */
  | { kind: 'mercy'; pos: number; owner: PlayerId; payer: PlayerId; amount: number }
  | { kind: 'gameOver' };

export interface GameState {
  rules: Rules;
  players: PlayerState[];
  /** Chỉ số người đang tới lượt trong `players` */
  current: number;
  properties: Record<number, PropertyState>;
  bank: { houses: number; hotels: number };
  /** Bộ bài: chỉ số thẻ trong DECKS[deck], phần tử 0 là trên cùng */
  decks: Record<DeckId, number[]>;
  jackpot: number;
  phase: Phase;
  /** Số lần tung đôi liên tiếp trong lượt */
  doublesCount: number;
  /** Được tung tiếp (vừa tung đôi) */
  extraRoll: boolean;
  lastDice: [number, number] | null;
  /** Đã tung trong lượt này chưa */
  rolled: boolean;
  debts: Debt[];
  resume: Resume;
  auction: Auction | null;
  /** Hàng đợi ô cần đấu giá (phá sản về ngân hàng) */
  auctionQueue: number[];
  trades: Trade[];
  /** Ô thế chấp vừa nhận, chờ chọn chuộc ngay (không +10%) hay giữ */
  mortgageChoices: { playerId: PlayerId; pos: number }[];
  turn: number;
  bankruptCount: number;
  winner: PlayerId | null;
  /** Số lần dừng ở mỗi ô */
  landings: number[];
  seq: number;
  /** Nguồn tạo ID giao dịch */
  nextTradeId: number;
  loans: Loan[];
  loanOffers: LoanOffer[];
  nextLoanId: number;
  /** Luật 'landing': ô người đang tới lượt vừa dừng lại (được xây nhà trong lượt này) */
  buildPass?: number | null;
  /** Số nhà trên ô lúc vừa dừng lại (4 = được xây khách sạn) */
  buildPassLevel?: number;
  /** Freestyle: lần xây đầu (vừa mua) chỉ được tới số nhà này */
  buildPassCap?: number | null;
  /** Lễ hội đang diễn ra (1 ô duy nhất trên bàn, tiền thuê ×2) */
  /** (cũ) một lễ hội duy nhất ×2 — chỉ còn để đọc ván lưu trước đây */
  festival?: { pos: number; owner: PlayerId } | null;
  /** Các ô đang có lễ hội (tối đa rules.maxFestivals, cũ nhất đứng đầu); mult = hệ số tiền thuê ×2–×4 */
  festivals?: Festival[];
  /** Bốc thăm thứ tự: lá đã bốc (vị trí lá + số) và các số còn lại */
  lots?: { picks: Record<PlayerId, { card: number; number: number }>; remaining: number[] };
  endReason?: 'lastStanding' | 'timeUp';
  /** Freestyle: bàn cược Sòng Bạc đang mở */
  casino?: Casino | null;
  /** Thẻ Băng giá: chủ đất → lượt hết đóng băng (đất của người đó không thu thuê, không xây) */
  frozen?: Record<PlayerId, number>;
  /** Quyền ân huệ đã dùng: chủ ô → danh sách người đã được ân huệ */
  mercyUsed?: Record<PlayerId, PlayerId[]>;
}

export type CasinoKind = 'cash' | 'land';

export interface Casino {
  kind: CasinoKind;
  pos: number;
  /** Người dừng ở ô (nhà cái ở sòng tiền) */
  opener: PlayerId;
  /** 'bet': đang đặt cược · 'roll': đang đổ xí ngầu */
  stage: 'bet' | 'roll';
  /** Người được đặt cược */
  eligible: PlayerId[];
  /** Sòng tiền: số tiền cược · Sòng đất: ô đặt cược */
  bets: Record<PlayerId, number>;
  /** Người bấm Không chơi */
  passed: PlayerId[];
  /** Mức cược tối đa mỗi người (sòng tiền) */
  cap: number;
  /** Người phải đổ xí ngầu ở vòng này */
  rollers: PlayerId[];
  rolls: Record<PlayerId, [number, number]>;
  /** Vòng đổ (sòng đất: hoà điểm cao nhất thì đổ lại) */
  round: number;
}

export interface Rng {
  /** Số nguyên ngẫu nhiên trong [min, max] (bao gồm 2 đầu) */
  int(min: number, max: number): number;
}

export interface Festival {
  pos: number;
  owner: PlayerId;
  /** Hệ số tiền thuê (2–4, bốc ngẫu nhiên khi tổ chức) */
  mult: number;
}
