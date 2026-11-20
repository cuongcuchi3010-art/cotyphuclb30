import { describe, expect, it } from 'vitest';
import {
  DECKS,
  TOKENS,
  createGame,
  seededRng,
  standings,
  formatMoney,
  liquidationValue,
  mortgageTransferFee,
  mortgageValue,
  rentFor,
  activeFestivals,
  festivalMult,
  isFestival,
  unmortgageCost,
  type GameState,
} from '../src/index.js';
import { act, mkGame, own, pl, topCard } from './helpers.js';

// Chỉ số thẻ trong bộ bài
const CH_GO = 1;
const CH_HALONG = 2;
const CH_TRANSPORT = 4;
const CH_UTILITY = 6;
const CH_JAILFREE = 8;
const CH_BACK3 = 9;

describe('formatMoney', () => {
  it('định dạng kiểu Việt', () => {
    expect(formatMoney(850)).toBe('850 tr');
    expect(formatMoney(1000)).toBe('1 tỷ');
    expect(formatMoney(1500)).toBe('1,5 tỷ');
    expect(formatMoney(2350)).toBe('2,35 tỷ');
    expect(formatMoney(0)).toBe('0 tr');
    expect(formatMoney(-50)).toBe('-50 tr');
  });
});

describe('Tiền thuê', () => {
  it('đất trống ×2 khi trọn nhóm, kể cả khi ô khác trong nhóm đang thế chấp', () => {
    const s = mkGame();
    own(s, 'p1', 1);
    expect(rentFor(s, 1, { diceTotal: 7 })).toBe(2);
    own(s, 'p1', 3);
    expect(rentFor(s, 1, { diceTotal: 7 })).toBe(4);
    s.properties[3]!.mortgaged = true;
    expect(rentFor(s, 1, { diceTotal: 7 })).toBe(4);
    expect(rentFor(s, 3, { diceTotal: 7 })).toBe(0); // bản thân ô thế chấp không thu
  });

  it('có nhà/khách sạn thu theo bảng', () => {
    const s = mkGame();
    own(s, 'p1', 37, 39);
    s.properties[39]!.houses = 3;
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(1400);
    s.properties[39]!.houses = 5;
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(2000);
  });

  it('tự động thu tiền thuê khi dừng ô người khác', () => {
    let s = mkGame();
    own(s, 'p2', 6, 8, 9);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4])); // → ô 6 Sa Pa
    expect(pl(s, 'p1').cash).toBe(1500 - 12);
    expect(pl(s, 'p2').cash).toBe(1500 + 12);
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('người ở tạm giữ vẫn được thu tiền thuê', () => {
    let s = mkGame();
    own(s, 'p2', 6);
    Object.assign(pl(s, 'p2'), { inJail: true, position: 10 });
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(pl(s, 'p2').cash).toBe(1506);
  });

  it('công ty vận tải 1/2/3/4', () => {
    const s = mkGame();
    const expected = [25, 50, 100, 200];
    [5, 15, 25, 35].forEach((pos, k) => {
      own(s, 'p1', pos);
      expect(rentFor(s, 5, { diceTotal: 7 })).toBe(expected[k]);
    });
    // Tính cả công ty đang thế chấp vào số lượng
    s.properties[35]!.mortgaged = true;
    expect(rentFor(s, 5, { diceTotal: 7 })).toBe(200);
    expect(rentFor(s, 35, { diceTotal: 7 })).toBe(0);
  });

  it('tiện ích 4× / 10×', () => {
    const s = mkGame();
    own(s, 'p1', 12);
    expect(rentFor(s, 12, { diceTotal: 9 })).toBe(36);
    own(s, 'p1', 28);
    expect(rentFor(s, 12, { diceTotal: 9 })).toBe(90);
  });
});

describe('Thẻ bài', () => {
  it('Công ty gần nhất: trả gấp đôi tiền thuê vận tải', () => {
    let s = mkGame();
    own(s, 'p2', 15);
    topCard(s, 'chance', CH_TRANSPORT);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // → 7 Cơ Hội → 15
    expect(pl(s, 'p1').position).toBe(15);
    expect(pl(s, 'p2').cash).toBe(1500 + 50);
    expect(pl(s, 'p1').cash).toBe(1500 - 50);
  });

  it('Công ty gần nhất: chưa có chủ thì được mua', () => {
    let s = mkGame();
    topCard(s, 'chance', CH_TRANSPORT);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase).toEqual({ kind: 'awaitBuy', pos: 15 });
  });

  it('Tiện ích gần nhất: có chủ thì tung lại, trả 10×', () => {
    let s = mkGame();
    own(s, 'p2', 12);
    topCard(s, 'chance', CH_UTILITY);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4, 5, 6])); // tung lại 5+6 = 11
    expect(pl(s, 'p1').position).toBe(12);
    expect(pl(s, 'p1').cash).toBe(1500 - 110);
  });

  it('đi qua Khởi Hành bằng thẻ thì nhận 200', () => {
    let s = mkGame();
    pl(s, 'p1').position = 29;
    topCard(s, 'chance', CH_HALONG);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // → 36 → Hạ Long (24)
    expect(pl(s, 'p1').position).toBe(24);
    expect(pl(s, 'p1').cash).toBe(1700);
    expect(s.phase).toEqual({ kind: 'awaitBuy', pos: 24 });
  });

  it('thẻ Về Khởi Hành nhận 200', () => {
    let s = mkGame();
    topCard(s, 'chance', CH_GO);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(pl(s, 'p1').position).toBe(0);
    expect(pl(s, 'p1').cash).toBe(1700);
  });

  it('đi lùi 3 ô không nhận lương Khởi Hành', () => {
    let s = mkGame();
    topCard(s, 'chance', CH_BACK3);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // 7 → lùi về 4 (thuế 200)
    expect(pl(s, 'p1').position).toBe(4);
    expect(pl(s, 'p1').cash).toBe(1300);
  });

  it('dừng Khởi Hành gấp đôi khi bật luật', () => {
    let s = mkGame(2, { doubleGo: true });
    pl(s, 'p1').position = 33;
    s.decks.chest = s.decks.chest; // không dùng tới
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // 33 + 7 = 40 → 0
    expect(pl(s, 'p1').position).toBe(0);
    expect(pl(s, 'p1').cash).toBe(1900);
  });

  it('Lì xì Tết: mỗi người lì xì 10', () => {
    let s = mkGame(3);
    s.decks.chest = [8, ...s.decks.chest.filter((x) => x !== 8)];
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1])); // → ô 2 Khí Vận
    expect(pl(s, 'p1').cash).toBe(1520);
    expect(pl(s, 'p2').cash).toBe(1490);
  });

  it('Thẻ Bảo Lãnh rút ra không quay lại bộ bài cho tới khi dùng', () => {
    let s = mkGame();
    topCard(s, 'chance', CH_JAILFREE);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(pl(s, 'p1').jailCards).toEqual(['chance']);
    expect(s.decks.chance).not.toContain(CH_JAILFREE);
    expect(s.decks.chance).toHaveLength(DECKS.chance.length - 1);
  });
});

describe('Tung đôi & tạm giữ', () => {
  it('tung đôi được tung tiếp', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 3])); // → 6, chưa có chủ
    expect(s.phase.kind).toBe('awaitBuy');
    ({ state: s } = act(s, 'p1', { type: 'buy' }));
    expect(s.phase.kind).toBe('awaitRoll');
  });

  it('tung đôi 3 lần liên tiếp thì vào tạm giữ, không đi', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 2])); // → 4 thuế
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 3])); // → 10 ghé thăm
    expect(s.phase.kind).toBe('awaitRoll');
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [4, 4]));
    expect(pl(s, 'p1').position).toBe(10);
    expect(pl(s, 'p1').inJail).toBe(true);
    expect(s.phase.kind).toBe('awaitEnd');
  });

  function jailed(): GameState {
    const s = mkGame();
    Object.assign(pl(s, 'p1'), { inJail: true, position: 10 });
    return s;
  }

  it('ra tạm giữ: trả 50 rồi tung bình thường', () => {
    let s = jailed();
    ({ state: s } = act(s, 'p1', { type: 'payBail' }));
    expect(pl(s, 'p1').cash).toBe(1450);
    expect(pl(s, 'p1').inJail).toBe(false);
    expect(s.phase.kind).toBe('awaitRoll');
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(pl(s, 'p1').position).toBe(13);
  });

  it('ra tạm giữ: dùng Thẻ Bảo Lãnh, thẻ trả về đáy bộ', () => {
    let s = jailed();
    pl(s, 'p1').jailCards = ['chest'];
    s.decks.chest = s.decks.chest.filter((x) => x !== 4);
    ({ state: s } = act(s, 'p1', { type: 'useJailCard' }));
    expect(pl(s, 'p1').inJail).toBe(false);
    expect(s.decks.chest.at(-1)).toBe(4);
  });

  it('ra tạm giữ: tung được đôi thì đi, không được tung thêm', () => {
    let s = jailed();
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 2])); // → 14 Quy Nhơn
    expect(pl(s, 'p1').position).toBe(14);
    expect(pl(s, 'p1').inJail).toBe(false);
    ({ state: s } = act(s, 'p1', { type: 'decline' }));
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('thất bại lần thứ 3: buộc trả 50 và đi theo số tung', () => {
    let s = jailed();
    for (let k = 0; k < 2; k++) {
      ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
      expect(pl(s, 'p1').inJail).toBe(true);
      ({ state: s } = act(s, 'p1', { type: 'endTurn' }));
      ({ state: s } = act(s, 'p2', { type: 'roll' }, [5, 6]));
      if (s.phase.kind === 'awaitBuy') {
        ({ state: s } = act(s, 'p2', { type: 'decline' }));
        ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
      }
      ({ state: s } = act(s, 'p2', { type: 'endTurn' }));
    }
    pl(s, 'p1').jailCards = ['chance'];
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 3]));
    expect(pl(s, 'p1').inJail).toBe(false);
    expect(pl(s, 'p1').position).toBe(14);
    expect(pl(s, 'p1').cash).toBe(1450);
    expect(pl(s, 'p1').jailCards).toEqual(['chance']); // không dùng thẻ được ở lần này
  });

  it('ô 30 đưa vào tạm giữ, không nhận 200', () => {
    let s = mkGame();
    pl(s, 'p1').position = 25;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 3]));
    expect(pl(s, 'p1').position).toBe(10);
    expect(pl(s, 'p1').inJail).toBe(true);
    expect(pl(s, 'p1').cash).toBe(1500);
  });
});

describe('Xây & bán nhà (trọn nhóm màu + bước vào lại ô)', () => {
  function brown(): GameState {
    const s = mkGame();
    own(s, 'p1', 1, 3);
    return s;
  }
  /** Giả lập vừa bước vào ô `pos` */
  function pass(s: GameState, pos: number) {
    s.buildPass = pos;
    s.buildPassLevel = s.properties[pos]!.houses;
  }

  it('cần trọn nhóm và không ô nào thế chấp', () => {
    const s = mkGame();
    own(s, 'p1', 1);
    pass(s, 1);
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('trọn nhóm');
    own(s, 'p1', 3);
    s.properties[3]!.mortgaged = true;
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('thế chấp');
  });

  it('trọn nhóm nhưng chưa bước vào lại ô thì chưa được xây', () => {
    const s = brown();
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('bước vào lại');
  });

  it('bước vào lại ô của nhóm đã trọn: được xây tuỳ ý tới 4 nhà, không cần xây đều', () => {
    let s = brown();
    pl(s, 'p1').position = 39;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1])); // 39 → 1 (qua Khởi Hành)
    expect(s.buildPass).toBe(1);
    for (let k = 0; k < 4; k++) ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    expect(s.properties[1]!.houses).toBe(4);
    expect(s.properties[3]!.houses).toBe(0);
    expect(s.bank.houses).toBe(28);
    // Vừa đủ 4 nhà trong lần này: chưa được lên khách sạn
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('sẵn 4 nhà');
    // Ô khác trong nhóm: phải bước vào ô đó mới xây được
    expect(() => act(s, 'p1', { type: 'build', pos: 3 })).toThrow('bước vào lại');
  });

  it('nhóm chưa trọn thì bước vào ô của mình cũng không được xây', () => {
    let s = mkGame();
    own(s, 'p1', 6);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(s.buildPass ?? null).toBeNull();
  });

  it('bước vào ô đã có sẵn 4 nhà thì được xây khách sạn, trả 4 nhà về kho', () => {
    let s = brown();
    s.properties[1]!.houses = 4;
    s.bank.houses = 28;
    pl(s, 'p1').position = 39;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1]));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    expect(s.properties[1]!.houses).toBe(5);
    expect(s.bank.hotels).toBe(11);
    expect(s.bank.houses).toBe(32);
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('khách sạn');
  });

  it('hết lượt thì mất quyền xây', () => {
    let s = brown();
    pl(s, 'p1').position = 39;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 2 Khí Vận, không phải ô 1
    expect(s.buildPass ?? null).toBeNull();
  });

  it('bán nhà nhận 50%, không cần bán đều', () => {
    let s = brown();
    s.properties[1]!.houses = 2;
    s.properties[3]!.houses = 0;
    s.bank.houses = 30;
    ({ state: s } = act(s, 'p1', { type: 'sell', pos: 1 }));
    expect(s.properties[1]!.houses).toBe(1);
    expect(pl(s, 'p1').cash).toBe(1525);
  });

  it('chỉ xây trong lượt của mình', () => {
    const s = mkGame();
    own(s, 'p2', 1, 3);
    pass(s, 1);
    expect(() => act(s, 'p2', { type: 'build', pos: 1 })).toThrow('lượt');
  });

  it('giới hạn kho nhà / khách sạn', () => {
    let s = brown();
    pass(s, 1);
    s.bank.houses = 0;
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('hết nhà');
    s.properties[1]!.houses = 4;
    pass(s, 1);
    s.bank.hotels = 0;
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('hết khách sạn');
    s.bank.hotels = 1;
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    expect(s.bank.hotels).toBe(0);
  });

  it('bán khách sạn khi kho thiếu nhà: xuống mức kho đáp ứng được', () => {
    let s = brown();
    s.properties[1]!.houses = 5;
    s.properties[3]!.houses = 5;
    s.bank.houses = 2;
    s.bank.hotels = 10;
    ({ state: s } = act(s, 'p1', { type: 'sell', pos: 1 }));
    expect(s.properties[1]!.houses).toBe(2);
    expect(s.bank.houses).toBe(0);
    expect(s.bank.hotels).toBe(11);
    expect(pl(s, 'p1').cash).toBe(1500 + 25 * 3);
  });
});

describe('Chế độ xây nhà: Theo màu / Theo ô', () => {
  it('Theo màu: trọn nhóm là xây ngay trong lượt, không cần bước vào ô', () => {
    let s = mkGame(2, { buildRule: 'color' });
    own(s, 'p1', 1);
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('trọn nhóm');
    own(s, 'p1', 3);
    for (let k = 0; k < 4; k++) ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 3 }));
    // Đủ 4 nhà thì lên khách sạn ngay
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    expect(s.properties[1]!.houses).toBe(5);
    expect(s.properties[3]!.houses).toBe(1);
  });

  it('Theo màu: dừng ở ô của mình không mở lượt xây riêng', () => {
    let s = mkGame(2, { buildRule: 'color' });
    own(s, 'p1', 1, 3);
    pl(s, 'p1').position = 39;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1]));
    expect(s.buildPass ?? null).toBeNull();
  });

  it('Theo ô: không cần trọn màu, bước vào lại ô của mình là xây được', () => {
    let s = mkGame(2, { buildRule: 'landing' });
    own(s, 'p1', 6);
    expect(() => act(s, 'p1', { type: 'build', pos: 6 })).toThrow('bước vào lại');
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(s.buildPass).toBe(6);
    for (let k = 0; k < 4; k++) ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    expect(s.properties[6]!.houses).toBe(4);
    expect(() => act(s, 'p1', { type: 'build', pos: 6 })).toThrow('sẵn 4 nhà');
  });

  it('Theo ô: ô đang thế chấp không được xây', () => {
    let s = mkGame(2, { buildRule: 'landing' });
    own(s, 'p1', 6);
    s.properties[6]!.mortgaged = true;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(s.buildPass ?? null).toBeNull();
  });
});

describe('Thế chấp', () => {
  it('nhận 50%, chuộc 110% làm tròn lên', () => {
    let s = mkGame();
    own(s, 'p1', 9);
    ({ state: s } = act(s, 'p1', { type: 'mortgage', pos: 9 }));
    expect(pl(s, 'p1').cash).toBe(1560);
    expect(unmortgageCost(9)).toBe(66);
    expect(unmortgageCost(1)).toBe(33);
    ({ state: s } = act(s, 'p1', { type: 'unmortgage', pos: 9 }));
    expect(pl(s, 'p1').cash).toBe(1560 - 66);
    expect(s.properties[9]!.mortgaged).toBe(false);
  });

  it('phải bán hết nhà trong nhóm trước khi thế chấp', () => {
    const s = mkGame();
    own(s, 'p1', 1, 3);
    s.properties[3]!.houses = 1;
    expect(() => act(s, 'p1', { type: 'mortgage', pos: 1 })).toThrow('bán hết nhà');
  });

  it('nhận ô thế chấp qua giao dịch phải trả 10%, chuộc ngay không +10%', () => {
    let s = mkGame();
    own(s, 'p2', 16);
    s.properties[16]!.mortgaged = true; // giá 180, thế chấp 90, phí 9
    ({ state: s } = act(s, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      give: { cash: 100, properties: [], jailCards: 0 },
      take: { cash: 0, properties: [16], jailCards: 0 },
    }));
    const id = s.trades[0]!.id;
    ({ state: s } = act(s, 'p2', { type: 'acceptTrade', id }));
    expect(s.properties[16]!.owner).toBe('p1');
    expect(mortgageTransferFee(16)).toBe(9);
    expect(pl(s, 'p1').cash).toBe(1500 - 100 - 9);
    expect(s.mortgageChoices).toEqual([{ playerId: 'p1', pos: 16 }]);
    ({ state: s } = act(s, 'p1', { type: 'mortgageChoice', pos: 16, redeem: true }));
    expect(pl(s, 'p1').cash).toBe(1391 - mortgageValue(16));
    expect(s.properties[16]!.mortgaged).toBe(false);
  });

  it('giữ thế chấp thì lần chuộc sau vẫn +10%', () => {
    let s = mkGame();
    own(s, 'p2', 16);
    s.properties[16]!.mortgaged = true;
    ({ state: s } = act(s, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      give: { cash: 0, properties: [], jailCards: 0 },
      take: { cash: 0, properties: [16], jailCards: 0 },
    }));
    ({ state: s } = act(s, 'p2', { type: 'acceptTrade', id: s.trades[0]!.id }));
    ({ state: s } = act(s, 'p1', { type: 'mortgageChoice', pos: 16, redeem: false }));
    const before = pl(s, 'p1').cash;
    ({ state: s } = act(s, 'p1', { type: 'unmortgage', pos: 16 }));
    expect(pl(s, 'p1').cash).toBe(before - 99);
  });
});

describe('Gom tiền & phá sản', () => {
  it('pha Gom tiền: thế chấp rồi trả nợ', () => {
    let s = mkGame();
    own(s, 'p2', 37, 39);
    s.properties[39]!.houses = 1; // thuê 200
    pl(s, 'p1').cash = 100;
    own(s, 'p1', 31); // thế chấp được 150
    pl(s, 'p1').position = 32;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // → 39
    expect(s.phase).toEqual({ kind: 'raiseFunds', debtor: 'p1' });
    expect(() => act(s, 'p1', { type: 'endTurn' })).toThrow();
    expect(() => act(s, 'p1', { type: 'payDebt' })).toThrow('Chưa đủ');
    expect(() => act(s, 'p1', { type: 'declareBankruptcy' })).toThrow('gom đủ');
    ({ state: s } = act(s, 'p1', { type: 'mortgage', pos: 31 }));
    ({ state: s } = act(s, 'p1', { type: 'payDebt' }));
    expect(pl(s, 'p1').cash).toBe(50);
    expect(pl(s, 'p2').cash).toBe(1700);
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('phá sản về người chơi: nhà bán 50%, tiền + ô (giữ thế chấp, phí 10%) + thẻ về chủ nợ', () => {
    let s = mkGame(3);
    own(s, 'p2', 37, 39);
    s.properties[39]!.houses = 5; // thuê 2000
    const p1 = pl(s, 'p1');
    p1.cash = 100;
    p1.position = 32;
    p1.jailCards = ['chance'];
    own(s, 'p1', 1, 3, 5);
    s.properties[1]!.houses = 1;
    s.properties[3]!.houses = 1;
    s.properties[5]!.mortgaged = true;
    s.bank.houses = 30;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase.kind).toBe('raiseFunds');
    expect(liquidationValue(s, 'p1')).toBe(100 + 25 * 2 + 30 + 30);
    ({ state: s } = act(s, 'p1', { type: 'declareBankruptcy' }));
    expect(pl(s, 'p1').bankrupt).toBe(true);
    expect(s.bank.houses).toBe(32);
    const p2 = pl(s, 'p2');
    // 1500 + 100 tiền + 50 tiền bán nhà − 10 phí 10% ô 5 (thế chấp 100)
    expect(p2.cash).toBe(1500 + 150 - 10);
    expect(s.properties[1]!.owner).toBe('p2');
    expect(s.properties[5]).toEqual({ owner: 'p2', houses: 0, mortgaged: true });
    expect(p2.jailCards).toEqual(['chance']);
    expect(s.phase.kind).toBe('awaitRoll');
    expect(s.players[s.current]!.id).toBe('p2');
  });

  it('phá sản kiểu ngân hàng mua lại: nhà bán 50% trả chủ nợ, các ô thành đất trống', () => {
    let s = mkGame(3, { bankruptcyMode: 'bankBuyout' });
    own(s, 'p2', 37, 39);
    s.properties[39]!.houses = 5;
    const p1 = pl(s, 'p1');
    p1.cash = 100;
    p1.position = 32;
    p1.jailCards = ['chance'];
    s.decks.chance = s.decks.chance.filter((x) => x !== CH_JAILFREE);
    own(s, 'p1', 1, 3, 5);
    s.properties[1]!.houses = 1;
    s.properties[3]!.houses = 1;
    s.properties[5]!.mortgaged = true;
    s.bank.houses = 30;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    const r = act(s, 'p1', { type: 'declareBankruptcy' });
    s = r.state;
    expect(pl(s, 'p1').bankrupt).toBe(true);
    expect(pl(s, 'p2').cash).toBe(1500 + 100 + 50); // tiền mặt + 2 nhà × 25
    for (const i of [1, 3, 5])
      expect(s.properties[i]).toEqual({ owner: null, houses: 0, mortgaged: false });
    expect(s.auctionQueue).toEqual([]);
    expect(pl(s, 'p2').jailCards).toEqual([]);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'bankrupt', buyout: true }));
  });

  it('thẻ Khí Vận đầu tư thua lỗ: chỉ có ở Freestyle, trả 1 tỷ cố định', () => {
    const idx = DECKS.chest.findIndex((c) => c.id === 'kv21');
    let s = mkGame(2, { mode: 'freestyle', feeMult: 3 });
    pl(s, 'p1').cash = 5000;
    topCard(s, 'chest', idx);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1])); // → 2 Khí Vận
    expect(pl(s, 'p1').cash).toBe(4000);
    // Cổ điển: thẻ không có trong bộ; ván cũ còn thẻ thì bị bỏ qua
    const c = mkGame(2);
    expect(c.decks.chest).not.toContain(idx);
    let o = mkGame(2);
    topCard(o, 'chest', idx);
    const r = act(o, 'p1', { type: 'roll' }, [1, 1]);
    o = r.state;
    expect(r.events).not.toContainEqual(expect.objectContaining({ cardId: 'kv21' }));
    expect(o.decks.chest).not.toContain(idx);
  });

  it('thẻ trúng Vietlott: chỉ có ở Freestyle, nhận 3 tỷ cố định', () => {
    const idx = DECKS.chance.findIndex((c) => c.id === 'ch21');
    let s = mkGame(2, { mode: 'freestyle', feeMult: 3 });
    topCard(s, 'chance', idx);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(pl(s, 'p1').cash).toBe(1500 + 3000);
    expect(mkGame(2).decks.chance).not.toContain(idx);
  });

  it('phá sản về ngân hàng: nhà về kho, ô đem đấu giá đã xoá thế chấp, thẻ về bộ bài', () => {
    let s = mkGame(3);
    const p1 = pl(s, 'p1');
    p1.jailCards = ['chest'];
    s.decks.chest = s.decks.chest.filter((x) => x !== 4);
    own(s, 'p1', 6, 8, 9);
    s.properties[6]!.houses = 1;
    s.properties[9]!.mortgaged = true;
    s.bank.houses = 31;
    ({ state: s } = act(s, 'p1', { type: 'resign' }));
    expect(pl(s, 'p1').bankrupt).toBe(true);
    expect(s.bank.houses).toBe(32);
    expect(s.decks.chest.at(-1)).toBe(4);
    expect(s.properties[9]).toEqual({ owner: null, houses: 0, mortgaged: false });
    expect(s.phase.kind).toBe('auction');
    expect(s.auctionQueue).toEqual([8, 9]);
    for (let k = 0; k < 3; k++) ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    expect(s.players[s.current]!.id).toBe('p2');
    expect(s.phase.kind).toBe('awaitRoll');
  });

  it('phá sản về ngân hàng (tự gom khi hết giờ)', () => {
    let s = mkGame(3);
    const p1 = pl(s, 'p1');
    p1.cash = 10;
    p1.position = 1;
    p1.jailCards = ['chest'];
    s.decks.chest = s.decks.chest.filter((x) => x !== 4);
    own(s, 'p1', 6);
    s.properties[6]!.mortgaged = true;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(s.phase.kind).toBe('raiseFunds');
    ({ state: s } = act(s, 'system', { type: 'autoLiquidate' }));
    expect(pl(s, 'p1').bankrupt).toBe(true);
    expect(s.decks.chest.at(-1)).toBe(4);
    expect(s.phase.kind).toBe('auction');
    expect(s.auction!.pos).toBe(6);
    expect(s.properties[6]!.mortgaged).toBe(false);
    ({ state: s } = act(s, 'p3', { type: 'bid', amount: 40 }));
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    expect(s.properties[6]!.owner).toBe('p3');
    expect(s.players[s.current]!.id).toBe('p2');
    expect(s.phase.kind).toBe('awaitRoll');
  });

  it('còn 1 người thì kết thúc ván', () => {
    let s = mkGame(2);
    ({ state: s } = act(s, 'p2', { type: 'resign' }));
    expect(s.phase.kind).toBe('gameOver');
    expect(s.winner).toBe('p1');
  });
});

describe('Đấu giá', () => {
  function auction(): GameState {
    let s = mkGame(3);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 3 Điện Biên
    ({ state: s } = act(s, 'p1', { type: 'decline' }));
    return s;
  }

  it('không ai trả giá thì ô vẫn của ngân hàng', () => {
    let s = auction();
    expect(s.phase.kind).toBe('auction');
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    expect(s.properties[3]!.owner).toBeNull();
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('trả vượt tiền mặt bị từ chối; người cao nhất thắng', () => {
    let s = auction();
    pl(s, 'p2').cash = 30;
    expect(() => act(s, 'p2', { type: 'bid', amount: 40 })).toThrow('tiền mặt');
    expect(() => act(s, 'p2', { type: 'bid', amount: 5 })).toThrow('tối thiểu');
    ({ state: s } = act(s, 'p2', { type: 'bid', amount: 20 }));
    expect(() => act(s, 'p3', { type: 'bid', amount: 20 })).toThrow('cao hơn');
    ({ state: s } = act(s, 'p1', { type: 'bid', amount: 25 })); // người vừa từ chối vẫn được tham gia
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    expect(s.properties[3]!.owner).toBe('p1');
    expect(pl(s, 'p1').cash).toBe(1475);
  });

  it('tắt đấu giá: từ chối thì ô vẫn của ngân hàng', () => {
    let s = mkGame(2, { auctions: false });
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    ({ state: s } = act(s, 'p1', { type: 'decline' }));
    expect(s.phase.kind).toBe('awaitEnd');
  });
});

describe('Giao dịch', () => {
  it('bị huỷ khi tài sản đã thay đổi', () => {
    let s = mkGame();
    own(s, 'p2', 1);
    ({ state: s } = act(s, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      give: { cash: 1450, properties: [], jailCards: 0 },
      take: { cash: 0, properties: [1], jailCards: 0 },
    }));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 3])); // → 6, mua Sa Pa
    ({ state: s } = act(s, 'p1', { type: 'buy' }));
    const r = act(s, 'p2', { type: 'acceptTrade', id: s.trades[0]!.id });
    expect(r.events).toContainEqual(
      expect.objectContaining({ t: 'tradeCancelled', reason: 'invalid' }),
    );
    expect(r.state.properties[1]!.owner).toBe('p2');
    expect(r.state.trades).toHaveLength(0);
  });

  it('không giao dịch ô khi nhóm có nhà; mỗi cặp chỉ 1 đề nghị', () => {
    let s = mkGame();
    own(s, 'p1', 1, 3);
    s.properties[3]!.houses = 1;
    expect(() =>
      act(s, 'p1', {
        type: 'proposeTrade',
        to: 'p2',
        give: { cash: 0, properties: [1], jailCards: 0 },
        take: { cash: 10, properties: [], jailCards: 0 },
      }),
    ).toThrow('có nhà');
    const offer = {
      type: 'proposeTrade' as const,
      to: 'p2',
      give: { cash: 10, properties: [], jailCards: 0 },
      take: { cash: 0, properties: [], jailCards: 0 },
    };
    ({ state: s } = act(s, 'p1', offer));
    ({ state: s } = act(s, 'p1', { ...offer, give: { ...offer.give, cash: 20 } }));
    expect(s.trades).toHaveLength(1);
    expect(s.trades[0]!.give.cash).toBe(20);
  });

  it('đề nghị lại (counter) thay thế đề nghị gốc', () => {
    let s = mkGame();
    own(s, 'p2', 1);
    ({ state: s } = act(s, 'p1', {
      type: 'proposeTrade',
      to: 'p2',
      give: { cash: 50, properties: [], jailCards: 0 },
      take: { cash: 0, properties: [1], jailCards: 0 },
    }));
    ({ state: s } = act(s, 'p2', {
      type: 'proposeTrade',
      to: 'p1',
      give: { cash: 0, properties: [1], jailCards: 0 },
      take: { cash: 90, properties: [], jailCards: 0 },
      counterOf: s.trades[0]!.id,
    }));
    expect(s.trades).toHaveLength(1);
    expect(s.trades[0]!.from).toBe('p2');
    ({ state: s } = act(s, 'p1', { type: 'acceptTrade', id: s.trades[0]!.id }));
    expect(s.properties[1]!.owner).toBe('p1');
    expect(pl(s, 'p1').cash).toBe(1410);
  });
});

describe('Hũ tiền & giới hạn thời gian', () => {
  it('thuế vào hũ, dừng Cà Phê Vỉa Hè nhận hết', () => {
    let s = mkGame(2, { jackpot: true });
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 3])); // thuế 200
    expect(s.jackpot).toBe(200);
    ({ state: s } = act(s, 'p1', { type: 'endTurn' }));
    pl(s, 'p2').position = 14;
    ({ state: s } = act(s, 'p2', { type: 'roll' }, [2, 4]));
    expect(pl(s, 'p2').cash).toBe(1700);
    expect(s.jackpot).toBe(0);
  });

  it('hết giờ: người có tổng tài sản cao nhất thắng', () => {
    let s = mkGame(3, { timeLimitMinutes: 30 });
    own(s, 'p3', 39);
    ({ state: s } = act(s, 'system', { type: 'timeUp' }));
    expect(s.phase.kind).toBe('gameOver');
    expect(s.winner).toBe('p3');
  });
});

describe('Vay tiền', () => {
  it('vay ngân hàng: lãi 10%, tối đa 500 tr dư nợ, đến hạn sau 5 lượt thì tự thu', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p1', { type: 'bankLoan', amount: 300 }));
    expect(pl(s, 'p1').cash).toBe(1800);
    expect(s.loans[0]).toMatchObject({ lender: 'bank', principal: 300, repay: 330, turnsLeft: 5 });
    expect(() => act(s, 'p1', { type: 'bankLoan', amount: 250 })).toThrow('tối đa 200');
    expect(() => act(s, 'p2', { type: 'bankLoan', amount: 50 })).toThrow('lượt');
    // Qua 5 lượt của p1
    for (let k = 0; k < 5; k++) {
      ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
      if (s.phase.kind === 'awaitBuy') ({ state: s } = act(s, 'p1', { type: 'decline' }));
      if (s.phase.kind === 'auction') ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
      ({ state: s } = act(s, 'p1', { type: 'endTurn' }));
      ({ state: s } = act(s, 'p2', { type: 'roll' }, [1, 2]));
      if (s.phase.kind === 'awaitBuy') ({ state: s } = act(s, 'p2', { type: 'decline' }));
      if (s.phase.kind === 'auction') ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
      const before = pl(s, 'p1').cash;
      ({ state: s } = act(s, 'p2', { type: 'endTurn' }));
      if (k < 4) expect(s.loans).toHaveLength(1);
      else {
        expect(s.loans).toHaveLength(0);
        expect(pl(s, 'p1').cash).toBe(before - 330);
      }
    }
  });

  it('trả nợ sớm', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p1', { type: 'bankLoan', amount: 100 }));
    ({ state: s } = act(s, 'p1', { type: 'repayLoan', id: s.loans[0]!.id }));
    expect(pl(s, 'p1').cash).toBe(1490);
    expect(s.loans).toHaveLength(0);
  });

  it('vay ngân hàng khi đang gom tiền', () => {
    let s = mkGame();
    pl(s, 'p1').cash = 50;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 3])); // thuế 200
    expect(s.phase.kind).toBe('raiseFunds');
    ({ state: s } = act(s, 'p1', { type: 'bankLoan', amount: 200 }));
    ({ state: s } = act(s, 'p1', { type: 'payDebt' }));
    expect(pl(s, 'p1').cash).toBe(50);
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('vay người chơi: đề nghị, chấp nhận, đến hạn tự trả cho người cho vay', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p1', {
      type: 'proposeLoan',
      to: 'p2',
      lend: false,
      amount: 200,
      repay: 250,
      turns: 1,
    }));
    expect(s.loanOffers[0]).toMatchObject({ lender: 'p2', borrower: 'p1' });
    ({ state: s } = act(s, 'p2', { type: 'acceptLoan', id: s.loanOffers[0]!.id }));
    expect(pl(s, 'p1').cash).toBe(1700);
    expect(pl(s, 'p2').cash).toBe(1300);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    ({ state: s } = act(s, 'p1', { type: 'decline' }));
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    ({ state: s } = act(s, 'p1', { type: 'endTurn' }));
    ({ state: s } = act(s, 'p2', { type: 'roll' }, [1, 2]));
    ({ state: s } = act(s, 'p2', { type: 'decline' }));
    ({ state: s } = act(s, 'system', { type: 'auctionClose' }));
    ({ state: s } = act(s, 'p2', { type: 'endTurn' })); // lượt p1 → đến hạn
    expect(s.loans).toHaveLength(0);
    expect(pl(s, 'p1').cash).toBe(1700 - 250);
    expect(pl(s, 'p2').cash).toBe(1300 + 250);
  });

  it('đề nghị vay bị huỷ khi người cho vay không còn đủ tiền', () => {
    let s = mkGame();
    ({ state: s } = act(s, 'p2', {
      type: 'proposeLoan',
      to: 'p1',
      lend: true,
      amount: 1500,
      repay: 1600,
      turns: 3,
    }));
    pl(s, 'p2').cash = 100;
    const r = act(s, 'p1', { type: 'acceptLoan', id: s.loanOffers[0]!.id });
    expect(r.events).toContainEqual(
      expect.objectContaining({ t: 'loanCancelled', reason: 'invalid' }),
    );
    expect(r.state.loans).toHaveLength(0);
  });

  it('khoản vay tính vào tổng tài sản', () => {
    let s = mkGame(2, { timeLimitMinutes: 30 });
    ({ state: s } = act(s, 'p1', { type: 'bankLoan', amount: 500 }));
    ({ state: s } = act(s, 'system', { type: 'timeUp' }));
    expect(s.winner).toBe('p2');
  });
});

describe('Thẻ mới: cháy nhà, đập nhà, tặng đất, sinh nhật, trúng đất', () => {
  const idx = (deck: 'chance' | 'chest', id: string) => DECKS[deck].findIndex((c) => c.id === id);

  it('cháy nhà: mất 1 nhà của mình, nhà về kho', () => {
    let s = mkGame();
    own(s, 'p1', 1, 3);
    s.properties[1]!.houses = 2;
    s.bank.houses = 30;
    topCard(s, 'chance', idx('chance', 'ch17'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // → Cơ Hội ô 7
    expect(s.properties[1]!.houses).toBe(1);
    expect(s.bank.houses).toBe(31);
  });

  it('cháy khách sạn: xuống 4 nhà', () => {
    let s = mkGame();
    own(s, 'p1', 39);
    s.properties[39]!.houses = 5;
    s.bank.hotels = 11;
    topCard(s, 'chance', idx('chance', 'ch17'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.properties[39]!.houses).toBe(4);
    expect(s.bank.hotels).toBe(12);
    expect(s.bank.houses).toBe(28);
  });

  it('đập nhà hàng xóm: người rút thẻ tự chọn căn nhà', () => {
    let s = mkGame(3);
    own(s, 'p2', 6, 8, 9);
    s.properties[6]!.houses = 1;
    s.properties[9]!.houses = 3;
    s.bank.houses = 28;
    topCard(s, 'chance', idx('chance', 'ch18'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'demolish' });
    expect(() => act(s, 'p1', { type: 'endTurn' })).toThrow();
    expect(() => act(s, 'p2', { type: 'chooseDemolish', pos: 9 })).toThrow('lượt');
    expect(() => act(s, 'p1', { type: 'chooseDemolish', pos: 8 })).toThrow('căn nhà');
    const r = act(s, 'p1', { type: 'chooseDemolish', pos: 9 });
    expect(r.state.properties[9]!.houses).toBe(2);
    expect(r.state.properties[6]!.houses).toBe(1);
    expect(r.state.phase.kind).toBe('awaitEnd');
    expect(r.events).toContainEqual(
      expect.objectContaining({ t: 'houseLost', reason: 'demolish', by: 'p1' }),
    );
  });

  it('hết giờ khi đang chọn: máy chọn ngẫu nhiên', () => {
    let s = mkGame();
    own(s, 'p2', 9);
    s.properties[9]!.houses = 2;
    topCard(s, 'chance', idx('chance', 'ch18'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    ({ state: s } = act(s, 'system', { type: 'autoChoose' }));
    expect(s.properties[9]!.houses).toBe(1);
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('không có nhà để cháy thì thẻ không có tác dụng', () => {
    const s = mkGame();
    topCard(s, 'chance', idx('chance', 'ch17'));
    const r = act(s, 'p1', { type: 'roll' }, [3, 4]);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'cardNoEffect' }));
  });

  it('buộc tặng đất: người rút thẻ chọn ô (nhóm chưa có nhà) và người nhận', () => {
    let s = mkGame(3);
    own(s, 'p1', 1, 3);
    s.properties[1]!.houses = 1; // nhóm nâu có nhà → không tặng được
    s.bank.houses = 31;
    own(s, 'p1', 16, 18);
    topCard(s, 'chance', idx('chance', 'ch19'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'gift' });
    expect(() => act(s, 'p1', { type: 'chooseGift', pos: 3, to: 'p3' })).toThrow('ô đất');
    expect(() => act(s, 'p1', { type: 'chooseGift', pos: 18, to: 'p1' })).toThrow('người nhận');
    ({ state: s } = act(s, 'p1', { type: 'chooseGift', pos: 18, to: 'p3' }));
    expect(s.properties[18]!.owner).toBe('p3');
    expect(s.properties[16]!.owner).toBe('p1');
    expect(s.phase.kind).toBe('awaitEnd');
  });

  it('sinh nhật: mỗi người tặng 20 tr', () => {
    let s = mkGame(3);
    topCard(s, 'chest', idx('chest', 'kv17'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1])); // → Khí Vận ô 2
    expect(pl(s, 'p1').cash).toBe(1540);
    expect(pl(s, 'p3').cash).toBe(1480);
  });

  it('trúng thưởng đất: nhận 1 ô còn của ngân hàng', () => {
    const s = mkGame();
    topCard(s, 'chest', idx('chest', 'kv19'));
    const r = act(s, 'p1', { type: 'roll' }, [1, 1]);
    const won = r.events.find((e) => e.t === 'propertyWon');
    expect(won).toBeTruthy();
    if (won && won.t === 'propertyWon') expect(r.state.properties[won.pos]!.owner).toBe('p1');
  });
});

describe('Số nhà / khách sạn tối đa tuỳ chỉnh', () => {
  it('kho ngân hàng theo luật chọn ở sảnh', () => {
    const s = mkGame(2, { houseStock: 48, hotelStock: 4 });
    expect(s.bank).toEqual({ houses: 48, hotels: 4 });
  });
  it('hết kho thì không xây được', () => {
    let s = mkGame(2, { houseStock: 1, hotelStock: 1 });
    own(s, 'p1', 1, 3);
    s.buildPass = 1;
    s.buildPassLevel = 0;
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 1 }));
    expect(() => act(s, 'p1', { type: 'build', pos: 1 })).toThrow('hết nhà');
  });
});

describe('Thứ hạng theo tổng tài sản', () => {
  it('xếp hạng người còn chơi theo tổng tài sản', () => {
    const s = mkGame(3, { showStandings: true });
    own(s, 'p3', 39);
    pl(s, 'p2').cash = 100;
    const st = standings(s);
    expect(st.map((x) => x.id)).toEqual(['p3', 'p1', 'p2']);
    expect(st[0]).toMatchObject({ rank: 1, worth: 1900 });
  });
});

describe('Bốc thăm thứ tự xuất phát', () => {
  function fresh(n = 3) {
    return createGame(
      Array.from({ length: n }, (_, i) => ({
        id: `p${i + 1}`,
        name: `P${i + 1}`,
        token: TOKENS[i]!,
      })),
      {},
      seededRng(7),
    ).state;
  }

  it('ván mới bắt đầu bằng pha bốc thăm, chưa ai được tung', () => {
    const s = fresh();
    expect(s.phase.kind).toBe('drawOrder');
    expect(() => act(s, 'p1', { type: 'roll' })).toThrow();
  });

  it('mỗi người bốc 1 lá; số 1 đi đầu; bốc xong mới vào ván', () => {
    let s = fresh();
    ({ state: s } = act(s, 'p2', { type: 'drawLot', card: 0 }, [2])); // rút số thứ 3 trong [1,2,3] → 3
    expect(s.lots!.picks.p2).toEqual({ card: 0, number: 3 });
    expect(() => act(s, 'p2', { type: 'drawLot', card: 1 })).toThrow('đã bốc');
    expect(() => act(s, 'p1', { type: 'drawLot', card: 0 })).toThrow('đã có người');
    ({ state: s } = act(s, 'p1', { type: 'drawLot', card: 2 }, [1])); // [1,2] → 2
    expect(s.phase.kind).toBe('drawOrder');
    ({ state: s } = act(s, 'p3', { type: 'drawLot', card: 1 }, [0])); // → 1
    expect(s.phase.kind).toBe('awaitRoll');
    expect(s.players.map((p) => p.id)).toEqual(['p3', 'p1', 'p2']);
    expect(s.players[s.current]!.id).toBe('p3');
  });

  it('hết giờ: máy bốc hộ người chưa bốc', () => {
    let s = fresh();
    ({ state: s } = act(s, 'p1', { type: 'drawLot', card: 1 }));
    ({ state: s } = act(s, 'system', { type: 'autoDraw' }));
    expect(s.phase.kind).toBe('awaitRoll');
    expect(new Set(Object.values(s.lots!.picks).map((x) => x.number))).toEqual(new Set([1, 2, 3]));
    expect(new Set(Object.values(s.lots!.picks).map((x) => x.card)).size).toBe(3);
  });
});

describe('Thẻ Lễ hội', () => {
  const idx = (deck: 'chance' | 'chest', id: string) => DECKS[deck].findIndex((c) => c.id === id);
  const fest = (s: GameState) => activeFestivals(s).map((f) => f.pos);

  it('người rút chọn ô của mình, tiền thuê ×2 đến ×4 (ngẫu nhiên)', () => {
    let s = mkGame();
    own(s, 'p1', 16, 39);
    own(s, 'p2', 37);
    topCard(s, 'chance', idx('chance', 'ch20'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'festival' });
    expect(() => act(s, 'p1', { type: 'chooseFestival', pos: 37 })).toThrow('của bạn');
    ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos: 39 }));
    const m = festivalMult(s, 39);
    expect(m).toBeGreaterThanOrEqual(2);
    expect(m).toBeLessThanOrEqual(4);
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(50 * m);
    expect(rentFor(s, 16, { diceTotal: 7 })).toBe(14);
  });

  it('hệ số bốc từ ×2 đến ×4', () => {
    for (const m of [2, 3, 4]) {
      let s = mkGame();
      own(s, 'p1', 39);
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos: 39 }, [m]));
      expect(festivalMult(s, 39)).toBe(m);
    }
    const s = mkGame();
    own(s, 'p1', 39);
    s.phase = { kind: 'cardChoice', choice: 'festival' };
    expect(() => act(s, 'p1', { type: 'chooseFestival', pos: 39 }, [5])).toThrow('ngoài [2,4]');
  });

  it('tối đa 3 lễ hội; lễ hội thứ 4 làm lễ hội cũ nhất kết thúc', () => {
    let s = mkGame();
    own(s, 'p1', 1, 3, 6, 8);
    for (const pos of [1, 3, 6]) {
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos }));
    }
    expect(fest(s)).toEqual([1, 3, 6]);
    s.phase = { kind: 'cardChoice', choice: 'festival' };
    const r = act(s, 'p1', { type: 'chooseFestival', pos: 8 });
    expect(fest(r.state)).toEqual([3, 6, 8]);
    expect(isFestival(r.state, 1)).toBe(false);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'festival', pos: 8, ended: [1] }));
  });

  it('số lễ hội tối đa theo luật phòng (chọn 1–5)', () => {
    let s = mkGame(2, { maxFestivals: 1 });
    own(s, 'p1', 1, 3);
    for (const pos of [1, 3]) {
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos }));
    }
    expect(fest(s)).toEqual([3]);
    s = mkGame(2, { maxFestivals: 5 });
    own(s, 'p1', 1, 3, 6, 8, 9);
    for (const pos of [1, 3, 6, 8, 9]) {
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos }));
    }
    expect(fest(s)).toEqual([1, 3, 6, 8, 9]);
  });

  it('ô đổi chủ thì lễ hội kết thúc (nhường chỗ)', () => {
    const s = mkGame();
    own(s, 'p1', 39);
    s.festivals = [{ pos: 39, owner: 'p1', mult: 3 }];
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(150);
    s.properties[39]!.owner = 'p2';
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(50);
    expect(activeFestivals(s)).toEqual([]);
  });

  it('ván lưu kiểu cũ (một lễ hội) vẫn đọc được: ×2', () => {
    const s = mkGame();
    own(s, 'p1', 39);
    s.festival = { pos: 39, owner: 'p1' };
    expect(rentFor(s, 39, { diceTotal: 7 })).toBe(100);
  });

  it('không có ô thì thẻ không tác dụng; hết giờ máy chọn ô giá cao nhất', () => {
    let s = mkGame();
    topCard(s, 'chance', idx('chance', 'ch20'));
    let r = act(s, 'p1', { type: 'roll' }, [3, 4]);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'cardNoEffect' }));
    s = mkGame();
    own(s, 'p1', 1, 39);
    topCard(s, 'chance', idx('chance', 'ch20'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    r = act(s, 'system', { type: 'autoChoose' });
    expect(fest(r.state)).toEqual([39]);
  });
});

describe('Ô Lễ Hội thay Cà Phê', () => {
  it('dừng ô 20 được chọn ô đất của mình tổ chức lễ hội', () => {
    let s = mkGame(2, { festivalSquare: true, jackpot: true });
    own(s, 'p1', 39);
    pl(s, 'p1').position = 13;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // 13 → 20
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'festival' });
    ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos: 39 }));
    expect(activeFestivals(s).map((f) => f.pos)).toEqual([39]);
  });

  it('chưa có ô nào thì không phải chọn; hũ tiền tắt khi bật ô Lễ Hội', () => {
    let s = mkGame(2, { festivalSquare: true, jackpot: true });
    pl(s, 'p1').position = 13;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase.kind).not.toBe('cardChoice');
    let t = mkGame(2, { festivalSquare: true, jackpot: true });
    pl(t, 'p1').position = 1;
    ({ state: t } = act(t, 'p1', { type: 'roll' }, [1, 2])); // → 4 Thuế
    expect(t.jackpot).toBe(0);
  });
});
