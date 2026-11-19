import { describe, expect, it } from 'vitest';
import { FREESTYLE_STOCK, casinoBetLimit, festivalMult, rentFor } from '../src/index.js';
import { act, mkGame, own, pl } from './helpers.js';

const FS = { mode: 'freestyle' as const, goSalary: 500, rentMult: 2, feeMult: 2 };

describe('Freestyle: tiền và xây nhà', () => {
  it('qua Khởi Hành nhận theo mức chủ phòng chọn (cả chế độ Cổ điển)', () => {
    for (const rules of [FS, { goSalary: 300 }]) {
      let s = mkGame(2, rules);
      pl(s, 'p1').position = 39;
      ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1]));
      expect(pl(s, 'p1').cash).toBe(1500 + rules.goSalary);
    }
  });

  it('tiền thuê nhân hệ số, thuế nhân hệ số phạt', () => {
    const c = mkGame(2);
    const f = mkGame(2, FS);
    own(c, 'p2', 39);
    own(f, 'p2', 39);
    expect(rentFor(f, 39, { diceTotal: 7 })).toBe(rentFor(c, 39, { diceTotal: 7 }) * 2);
    let s = mkGame(2, FS);
    pl(s, 'p1').position = 1;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 4 Thuế TNCN 200 × 2
    expect(pl(s, 'p1').cash).toBe(1100);
  });

  it('mua xong xây ngay tới 4 nhà; khách sạn phải ghé lại; kho không giới hạn', () => {
    let s = mkGame(2, FS);
    expect(s.bank.houses).toBe(FREESTYLE_STOCK);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4])); // → 6 Sa Pa
    ({ state: s } = act(s, 'p1', { type: 'buy' }));
    for (let k = 0; k < 4; k++) ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    expect(s.properties[6]!.houses).toBe(4);
    expect(() => act(s, 'p1', { type: 'build', pos: 6 })).toThrow('sẵn 4 nhà');
  });

  it('dừng ở ô của mình (chưa trọn màu) là xây được', () => {
    let s = mkGame(2, FS);
    own(s, 'p1', 6);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(s.buildPass).toBe(6);
  });

  it('lễ hội ×3–×10', () => {
    for (const [r, m] of [
      [1, 3],
      [100, 10],
      [50, 5],
    ] as const) {
      let s = mkGame(2, FS);
      own(s, 'p1', 39);
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos: 39 }, [r]));
      expect(festivalMult(s, 39)).toBe(m);
    }
  });

  it('chế độ Cổ điển: ô 12 vẫn là EVN mua được', () => {
    let s = mkGame(2);
    pl(s, 'p1').position = 9;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(s.phase).toEqual({ kind: 'awaitBuy', pos: 12 });
  });
});

describe('Sòng Bạc Tiền', () => {
  function open3() {
    let s = mkGame(3, FS);
    pl(s, 'p1').position = 9;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 12
    return s;
  }

  it('mở bàn, cược, đổ: cao hơn nhà cái thắng, thấp hơn thua', () => {
    let s = open3();
    expect(s.phase.kind).toBe('casino');
    expect(s.casino!.cap).toBe(750); // min(1 tỷ, 1500 / 2)
    expect(() => act(s, 'p2', { type: 'casinoBet', amount: 800 })).toThrow('tối đa');
    expect(() => act(s, 'p1', { type: 'casinoBet', amount: 100 })).toThrow('không tham gia');
    ({ state: s } = act(s, 'p2', { type: 'casinoBet', amount: 100 }));
    ({ state: s } = act(s, 'p3', { type: 'casinoBet', amount: 200 }));
    expect(s.casino!.stage).toBe('roll');
    expect(() => act(s, 'p1', { type: 'casinoRoll' })).toThrow('đổ cuối');
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [5, 5]));
    ({ state: s } = act(s, 'p3', { type: 'casinoRoll' }, [1, 2]));
    const r = act(s, 'p1', { type: 'casinoRoll' }, [3, 3]);
    s = r.state;
    expect(s.casino).toBeNull();
    expect(s.phase.kind).toBe('awaitEnd');
    expect(pl(s, 'p1').cash).toBe(1600);
    expect(pl(s, 'p2').cash).toBe(1600);
    expect(pl(s, 'p3').cash).toBe(1300);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'casinoResult', kind: 'cash' }));
  });

  it('bằng điểm thì trả lại tiền; không ai cược thì huỷ bàn', () => {
    let s = open3();
    ({ state: s } = act(s, 'p2', { type: 'casinoBet', amount: 300 }));
    ({ state: s } = act(s, 'p3', { type: 'casinoPass' }));
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [5, 2]));
    ({ state: s } = act(s, 'p1', { type: 'casinoRoll' }, [3, 4]));
    expect(pl(s, 'p1').cash).toBe(1500);
    expect(pl(s, 'p2').cash).toBe(1500);
    s = open3();
    ({ state: s } = act(s, 'p2', { type: 'casinoPass' }));
    const r = act(s, 'p3', { type: 'casinoPass' });
    expect(r.events).toContainEqual({ t: 'casinoCancel', kind: 'cash' });
    expect(r.state.phase.kind).toBe('awaitEnd');
  });

  it('mức cược tối đa 1 tỷ', () => {
    let s = mkGame(3, { ...FS, startingCash: 10000 });
    pl(s, 'p1').position = 9;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(casinoBetLimit(s, 'p2')).toBe(1000);
    expect(() => act(s, 'p2', { type: 'casinoBet', amount: 1010 })).toThrow('tối đa');
  });

  it('mức cược không vượt tiền nhà cái chia đều', () => {
    let s = mkGame(3, FS);
    pl(s, 'p1').cash = 300;
    pl(s, 'p1').position = 9;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(casinoBetLimit(s, 'p2')).toBe(150);
  });

  it('hết giờ đặt cược thì đổ; hết giờ đổ thì máy đổ hộ', () => {
    let s = open3();
    ({ state: s } = act(s, 'p2', { type: 'casinoBet', amount: 100 }));
    ({ state: s } = act(s, 'system', { type: 'casinoTimeout' }));
    expect(s.casino!.rollers).toEqual(['p2', 'p1']);
    ({ state: s } = act(s, 'system', { type: 'casinoTimeout' }, [1, 1, 6, 6]));
    expect(s.casino).toBeNull();
    expect(pl(s, 'p2').cash).toBe(1400);
  });

  it('đang mở bàn thì không nhận giao dịch', () => {
    let s = open3();
    own(s, 'p2', 1);
    ({ state: s } = act(s, 'p2', {
      type: 'proposeTrade',
      to: 'p3',
      give: { cash: 0, properties: [1], jailCards: 0 },
      take: { cash: 10, properties: [], jailCards: 0 },
    }));
    const id = s.trades[0]!.id;
    expect(() => act(s, 'p3', { type: 'acceptTrade', id })).toThrow('Sòng Bạc');
  });
});

describe('Sòng Bạc Đất', () => {
  function openLand(n = 3) {
    let s = mkGame(n, FS);
    own(s, 'p1', 1);
    own(s, 'p2', 6);
    own(s, 'p3', 8);
    pl(s, 'p1').position = 25;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 28
    return s;
  }

  it('ai đổ cao nhất lấy hết các ô đã đặt', () => {
    let s = openLand();
    expect(s.casino!.kind).toBe('land');
    expect(() => act(s, 'p2', { type: 'casinoStake', pos: 1 })).toThrow('của bạn');
    ({ state: s } = act(s, 'p1', { type: 'casinoStake', pos: 1 }));
    ({ state: s } = act(s, 'p2', { type: 'casinoStake', pos: 6 }));
    ({ state: s } = act(s, 'p3', { type: 'casinoStake', pos: 8 }));
    ({ state: s } = act(s, 'p1', { type: 'casinoRoll' }, [2, 3]));
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [4, 4]));
    ({ state: s } = act(s, 'p3', { type: 'casinoRoll' }, [1, 1]));
    expect(s.properties[1]!.owner).toBe('p2');
    expect(s.properties[6]!.owner).toBe('p2');
    expect(s.properties[8]!.owner).toBe('p2');
  });

  it('hoà điểm cao nhất thì những người đó đổ lại', () => {
    let s = openLand();
    ({ state: s } = act(s, 'p1', { type: 'casinoStake', pos: 1 }));
    ({ state: s } = act(s, 'p2', { type: 'casinoStake', pos: 6 }));
    ({ state: s } = act(s, 'p3', { type: 'casinoStake', pos: 8 }));
    ({ state: s } = act(s, 'p1', { type: 'casinoRoll' }, [3, 4]));
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [5, 2]));
    ({ state: s } = act(s, 'p3', { type: 'casinoRoll' }, [1, 1]));
    expect(s.casino!.rollers).toEqual(['p1', 'p2']);
    expect(s.casino!.round).toBe(2);
    expect(() => act(s, 'p3', { type: 'casinoRoll' })).toThrow('không đổ');
    ({ state: s } = act(s, 'p1', { type: 'casinoRoll' }, [6, 6]));
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [1, 2]));
    expect(s.properties[6]!.owner).toBe('p1');
    expect(s.properties[8]!.owner).toBe('p1');
  });

  it('dưới 2 người đặt thì huỷ; dưới 2 người có đất thì không mở', () => {
    let s = openLand();
    ({ state: s } = act(s, 'p1', { type: 'casinoStake', pos: 1 }));
    ({ state: s } = act(s, 'p2', { type: 'casinoPass' }));
    const r = act(s, 'p3', { type: 'casinoPass' });
    expect(r.events).toContainEqual({ t: 'casinoCancel', kind: 'land' });
    expect(r.state.properties[1]!.owner).toBe('p1');
    let t = mkGame(2, FS);
    own(t, 'p1', 1);
    pl(t, 'p1').position = 25;
    const r2 = act(t, 'p1', { type: 'roll' }, [1, 2]);
    t = r2.state;
    expect(t.phase.kind).toBe('awaitEnd');
    expect(r2.events).toContainEqual(expect.objectContaining({ t: 'casinoSkip', kind: 'land' }));
  });

  it('đặt được ô đã có nhà (nhà đi kèm ô); nhận ô thế chấp trả phí 10%', () => {
    let s = mkGame(3, FS);
    own(s, 'p1', 1, 3);
    s.properties[3]!.houses = 4;
    own(s, 'p2', 6);
    own(s, 'p3', 9);
    s.properties[9]!.mortgaged = true;
    pl(s, 'p1').position = 25;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(s.casino!.eligible).toEqual(['p1', 'p2', 'p3']);
    ({ state: s } = act(s, 'p1', { type: 'casinoStake', pos: 3 }));
    ({ state: s } = act(s, 'p2', { type: 'casinoStake', pos: 6 }));
    ({ state: s } = act(s, 'p3', { type: 'casinoStake', pos: 9 }));
    ({ state: s } = act(s, 'p1', { type: 'casinoRoll' }, [1, 2]));
    ({ state: s } = act(s, 'p2', { type: 'casinoRoll' }, [6, 6]));
    ({ state: s } = act(s, 'p3', { type: 'casinoRoll' }, [1, 1]));
    expect(s.properties[3]!.owner).toBe('p2');
    expect(s.properties[3]!.houses).toBe(4);
    expect(s.properties[9]!.owner).toBe('p2');
    expect(pl(s, 'p2').cash).toBe(1500 - 6); // phí 10% của 60 tr thế chấp
  });
});
