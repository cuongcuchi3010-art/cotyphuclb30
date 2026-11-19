import type { DeckId } from './data/cards.vi.js';
import type {
  CasinoKind,
  Creditor,
  DebtReason,
  LoanOffer,
  PlayerId,
  Trade,
  TradeSide,
} from './types.js';

export type PlayerAction =
  | { type: 'roll' }
  | { type: 'payBail' }
  | { type: 'useJailCard' }
  | { type: 'buy' }
  | { type: 'decline' }
  | { type: 'bid'; amount: number }
  | { type: 'build'; pos: number }
  | { type: 'sell'; pos: number }
  | { type: 'mortgage'; pos: number }
  | { type: 'unmortgage'; pos: number }
  | { type: 'mortgageChoice'; pos: number; redeem: boolean }
  | { type: 'endTurn' }
  | { type: 'payDebt' }
  | { type: 'declareBankruptcy' }
  | {
      type: 'proposeTrade';
      to: PlayerId;
      give: TradeSide;
      take: TradeSide;
      counterOf?: string;
    }
  | { type: 'acceptTrade'; id: string }
  | { type: 'rejectTrade'; id: string }
  | { type: 'cancelTrade'; id: string }
  | { type: 'resign' }
  | { type: 'drawLot'; card: number }
  | { type: 'chooseDemolish'; pos: number }
  | { type: 'chooseGift'; pos: number; to: PlayerId }
  | { type: 'chooseFestival'; pos: number }
  | { type: 'bankLoan'; amount: number }
  | { type: 'repayLoan'; id: string }
  | {
      type: 'proposeLoan';
      to: PlayerId;
      /** true = mình cho người kia vay; false = mình xin vay */
      lend: boolean;
      amount: number;
      repay: number;
      turns: number;
    }
  | { type: 'acceptLoan'; id: string }
  | { type: 'rejectLoan'; id: string }
  | { type: 'cancelLoan'; id: string }
  | { type: 'casinoBet'; amount: number }
  | { type: 'casinoStake'; pos: number }
  | { type: 'casinoPass' }
  | { type: 'casinoRoll' };

export type SystemAction =
  | { type: 'auctionClose' }
  | { type: 'autoLiquidate' }
  | { type: 'forceBankrupt'; playerId: PlayerId }
  | { type: 'timeUp' }
  | { type: 'autoChoose' }
  | { type: 'autoDraw' }
  | { type: 'casinoTimeout' };

export type Action = PlayerAction | SystemAction;
export type Actor = PlayerId | 'system';

export type GameEvent =
  | {
      t: 'orderRolls';
      rolls: { playerId: PlayerId; dice: [number, number] }[];
      order: PlayerId[];
    }
  | { t: 'turnStart'; playerId: PlayerId; turn: number }
  | { t: 'drawStart'; count: number }
  | { t: 'lotDrawn'; playerId: PlayerId; card: number; number: number }
  | { t: 'orderDrawn'; order: PlayerId[] }
  | {
      t: 'roll';
      playerId: PlayerId;
      dice: [number, number];
      doubles: boolean;
      purpose: 'move' | 'jail' | 'utility';
    }
  | {
      t: 'move';
      playerId: PlayerId;
      from: number;
      to: number;
      /** Số bước đi (âm = đi lùi). 0 = dịch chuyển thẳng (vào tạm giữ) */
      steps: number;
    }
  | { t: 'passGo'; playerId: PlayerId; amount: number }
  | { t: 'land'; playerId: PlayerId; pos: number }
  | { t: 'offer'; playerId: PlayerId; pos: number }
  | { t: 'buy'; playerId: PlayerId; pos: number; price: number }
  | { t: 'decline'; playerId: PlayerId; pos: number }
  | {
      t: 'pay';
      from: PlayerId;
      to: Creditor | 'jackpot';
      amount: number;
      reason: DebtReason;
      pos?: number;
    }
  | { t: 'collect'; playerId: PlayerId; amount: number; reason: 'card' | 'jackpot' }
  | { t: 'card'; playerId: PlayerId; deck: DeckId; cardId: string }
  | { t: 'getJailCard'; playerId: PlayerId; deck: DeckId }
  | { t: 'jail'; playerId: PlayerId; reason: 'square' | 'card' | 'doubles' }
  | { t: 'leaveJail'; playerId: PlayerId; how: 'paid' | 'card' | 'doubles' | 'forced' }
  | { t: 'jailStay'; playerId: PlayerId; attempts: number }
  | { t: 'auctionStart'; pos: number }
  | { t: 'bid'; playerId: PlayerId; amount: number }
  | { t: 'auctionWon'; playerId: PlayerId; pos: number; amount: number }
  | { t: 'auctionNoBids'; pos: number }
  | { t: 'buildChance'; playerId: PlayerId; pos: number }
  | {
      t: 'houseLost';
      playerId: PlayerId;
      pos: number;
      level: number;
      reason: 'fire' | 'demolish';
      by?: PlayerId;
    }
  | { t: 'propertyGifted'; from: PlayerId; to: PlayerId; pos: number }
  | { t: 'propertyWon'; playerId: PlayerId; pos: number }
  | { t: 'cardNoEffect'; playerId: PlayerId }
  | { t: 'casinoOpen'; kind: CasinoKind; pos: number; opener: PlayerId; cap: number }
  | { t: 'casinoSkip'; kind: CasinoKind; opener: PlayerId; reason: 'noPlayers' | 'noCash' }
  | { t: 'casinoBet'; playerId: PlayerId; amount: number }
  | { t: 'casinoStake'; playerId: PlayerId; pos: number }
  | { t: 'casinoPass'; playerId: PlayerId }
  | { t: 'casinoCancel'; kind: CasinoKind }
  | { t: 'casinoRolling'; kind: CasinoKind; rollers: PlayerId[]; round: number }
  | { t: 'casinoRoll'; playerId: PlayerId; dice: [number, number] }
  | { t: 'casinoTie'; players: PlayerId[]; total: number }
  | {
      t: 'casinoResult';
      kind: 'cash';
      opener: PlayerId;
      openerDice: [number, number];
      results: {
        playerId: PlayerId;
        bet: number;
        dice: [number, number];
        outcome: 'win' | 'lose' | 'push';
      }[];
    }
  | {
      t: 'casinoResult';
      kind: 'land';
      winner: PlayerId;
      dice: [number, number];
      won: { pos: number; from: PlayerId }[];
      /** Người đã đặt ô và xí ngầu ở vòng cuối */
      players?: PlayerId[];
      rolls?: Record<PlayerId, [number, number]>;
    }
  | { t: 'choosing'; playerId: PlayerId; choice: 'demolish' | 'gift' | 'festival' }
  | { t: 'festival'; playerId: PlayerId; pos: number; mult?: number; ended?: number[] }
  | { t: 'build'; playerId: PlayerId; pos: number; level: number; cost: number }
  | { t: 'sell'; playerId: PlayerId; pos: number; level: number; refund: number }
  | { t: 'mortgage'; playerId: PlayerId; pos: number; amount: number }
  | { t: 'unmortgage'; playerId: PlayerId; pos: number; amount: number }
  | { t: 'keepMortgage'; playerId: PlayerId; pos: number }
  | { t: 'tradeProposed'; trade: Trade }
  | { t: 'tradeAccepted'; trade: Trade }
  | { t: 'tradeRejected'; tradeId: string; by: PlayerId }
  | {
      t: 'tradeCancelled';
      tradeId: string;
      reason: 'withdrawn' | 'invalid' | 'bankrupt' | 'replaced';
    }
  | {
      t: 'loanTaken';
      lender: Creditor;
      borrower: PlayerId;
      amount: number;
      repay: number;
      turns: number;
    }
  | { t: 'loanRepaid'; lender: Creditor; borrower: PlayerId; amount: number }
  | { t: 'loanDue'; lender: Creditor; borrower: PlayerId; amount: number }
  | { t: 'loanOffered'; offer: LoanOffer }
  | { t: 'loanRejected'; id: string; by: PlayerId }
  | { t: 'loanCancelled'; id: string; reason: 'withdrawn' | 'invalid' | 'bankrupt' | 'replaced' }
  | { t: 'raiseFunds'; playerId: PlayerId; owed: number; to: Creditor }
  | { t: 'bankrupt'; playerId: PlayerId; to: Creditor }
  | {
      t: 'gameOver';
      winner: PlayerId | null;
      reason: 'lastStanding' | 'timeUp';
      ranking: PlayerId[];
    };
