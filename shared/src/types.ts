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
  /** Cách xây nhà: 'monopoly' = trọn nhóm màu (chuẩn); 'landing' = dừng lại ô của mình */
  buildRule: 'monopoly' | 'landing';
  /** Số nhà tối đa trong kho ngân hàng (chuẩn 32) */
  houseStock: number;
  /** Số khách sạn tối đa trong kho ngân hàng (chuẩn 12) */
  hotelStock: number;
  /** Hiện tổng tài sản & thứ hạng của mọi người suốt ván */
  showStandings: boolean;
}

export const DEFAULT_RULES: Rules = {
  startingCash: 1500,
  jackpot: false,
  doubleGo: false,
  auctions: true,
  timeLimitMinutes: 0,
  turnTimerSec: 90,
  buildRule: 'monopoly',
  houseStock: 32,
  hotelStock: 12,
  showStandings: false,
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
}

export type DebtReason =
  'rent' | 'tax' | 'card' | 'jailFine' | 'mortgageFee' | 'payEach' | 'collectEach' | 'loan';

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
  | { kind: 'raiseFunds'; debtor: PlayerId }
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
  endReason?: 'lastStanding' | 'timeUp';
}

export interface Rng {
  /** Số nguyên ngẫu nhiên trong [min, max] (bao gồm 2 đầu) */
  int(min: number, max: number): number;
}
