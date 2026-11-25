import { describe, expect, it } from 'vitest';
import {
  DECKS,
  FREESTYLE_STOCK,
  isFrozen,
  rollWithPower,
  seededRng,
  bankLoanMax,
  quizAnswerOf,
  casinoBetLimit,
  festivalMult,
  rentFor,
} from '../src/index.js';
import { act, mkGame, own, pl, topCard } from './helpers.js';

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

  it('lần đầu (vừa mua) chỉ xây tới số nhà chủ phòng chọn; lần sau tới 4', () => {
    let s = mkGame(2, { ...FS, firstBuildMax: 2 });
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4])); // → 6 Sa Pa
    ({ state: s } = act(s, 'p1', { type: 'buy' }));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    expect(() => act(s, 'p1', { type: 'build', pos: 6 })).toThrow('tối đa 2 nhà');
    // Lần ghé sau: xây tiếp tới 4
    s.buildPass = null;
    s.buildPassCap = null;
    s.players.find((p) => p.id === 'p1')!.position = 0;
    s.phase = { kind: 'awaitRoll' };
    s.rolled = false;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 6 }));
    expect(s.properties[6]!.houses).toBe(4);
    let z = mkGame(2, { ...FS, firstBuildMax: 0 });
    ({ state: z } = act(z, 'p1', { type: 'roll' }, [2, 4]));
    ({ state: z } = act(z, 'p1', { type: 'buy' }));
    expect(z.buildPass ?? null).toBeNull();
  });

  it('xây nhiều nhà một lần; vượt mức thì không xây gì', () => {
    let s = mkGame(2, FS);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    ({ state: s } = act(s, 'p1', { type: 'buy' }));
    expect(() => act(s, 'p1', { type: 'build', pos: 6, count: 5 })).toThrow();
    expect(s.properties[6]!.houses).toBe(0);
    ({ state: s } = act(s, 'p1', { type: 'build', pos: 6, count: 3 }));
    expect(s.properties[6]!.houses).toBe(3);
  });

  it('dừng ở ô của mình (chưa trọn màu) là xây được', () => {
    let s = mkGame(2, FS);
    own(s, 'p1', 6);
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 4]));
    expect(s.buildPass).toBe(6);
  });

  it('hạn mức vay ngân hàng = 1 tỷ × hệ số tiền phạt (không theo tiền thuê)', () => {
    let s = mkGame(2, { ...FS, feeMult: 3, rentMult: 5 });
    expect(bankLoanMax(s)).toBe(3000);
    const cash = pl(s, 'p1').cash;
    ({ state: s } = act(s, 'p1', { type: 'bankLoan', amount: 3000 }));
    expect(pl(s, 'p1').cash).toBe(cash + 3000);
    expect(() => act(s, 'p1', { type: 'bankLoan', amount: 10 })).toThrow('tối đa 0');
    expect(bankLoanMax(mkGame(2))).toBe(500);
  });

  it('lễ hội ×2–×5', () => {
    for (const [r, m] of [
      [1, 2],
      [50, 3],
      [80, 4],
      [100, 5],
    ] as const) {
      let s = mkGame(2, FS);
      own(s, 'p1', 39);
      s.phase = { kind: 'cardChoice', choice: 'festival' };
      ({ state: s } = act(s, 'p1', { type: 'chooseFestival', pos: 39 }, [r]));
      expect(festivalMult(s, 39)).toBe(m);
    }
  });

  it('ô Cà Phê (20) thành ô Lễ Hội; hũ tiền tắt', () => {
    let s = mkGame(2, { ...FS, jackpot: true });
    own(s, 'p1', 39);
    pl(s, 'p1').position = 13;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'festival' });
    s = mkGame(2);
    own(s, 'p1', 39);
    pl(s, 'p1').position = 13;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4]));
    expect(s.phase.kind).not.toBe('cardChoice');
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
    expect(s.casino!.cap).toBe(0); // không giới hạn
    expect(() => act(s, 'p2', { type: 'casinoBet', amount: 1510 })).toThrow('tối đa');
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

  it('cược không giới hạn: tối đa bằng tiền mặt của người cược', () => {
    let s = mkGame(3, { ...FS, startingCash: 10000 });
    pl(s, 'p1').cash = 300;
    pl(s, 'p1').position = 9;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2]));
    expect(casinoBetLimit(s, 'p2')).toBe(10000);
    expect(() => act(s, 'p2', { type: 'casinoBet', amount: 10010 })).toThrow('tối đa');
    ({ state: s } = act(s, 'p2', { type: 'casinoBet', amount: 5000 }));
    expect(s.casino?.bets.p2).toBe(5000);
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

describe('Bộ thẻ Ác Quỷ', () => {
  const DV = { ...FS, devilCards: true };
  const idx = (deck: 'chance' | 'chest', id: string) => DECKS[deck].findIndex((c) => c.id === id);

  it('chỉ có trong bộ bài khi Freestyle bật Bộ thẻ Ác Quỷ', () => {
    const ch = idx('chance', 'ch22');
    expect(mkGame(2, DV).decks.chance).toContain(ch);
    expect(mkGame(2, FS).decks.chance).not.toContain(ch);
    expect(mkGame(2, { devilCards: true }).decks.chance).not.toContain(ch);
  });

  it('Hoán đổi số phận: đổi tiền, đất, nhà với một người ngẫu nhiên', () => {
    let s = mkGame(3, DV);
    pl(s, 'p2').bankrupt = true; // chỉ còn p3 để ngẫu nhiên trúng
    own(s, 'p1', 1);
    own(s, 'p3', 39);
    s.properties[39]!.houses = 3;
    pl(s, 'p3').cash = 4000;
    topCard(s, 'chest', idx('chest', 'kv22'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 1])); // → 2 Khí Vận
    expect(s.phase.kind).not.toBe('cardChoice');
    expect(pl(s, 'p1').cash).toBe(4000);
    expect(pl(s, 'p3').cash).toBe(1500);
    expect(s.properties[39]).toEqual({ owner: 'p1', houses: 3, mortgaged: false });
    expect(s.properties[1]!.owner).toBe('p3');
  });

  it('Băng giá: nhà đất của người rút thẻ 3 vòng không thu thuê, không xây nhà', () => {
    let s = mkGame(2, DV);
    own(s, 'p1', 39);
    own(s, 'p2', 37);
    topCard(s, 'chance', idx('chance', 'ch22'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [3, 4])); // → 7 Cơ Hội
    expect(s.frozen?.p1).toBe(s.turn + 6);
    expect(isFrozen(s, 'p1')).toBe(true);
    expect(isFrozen(s, 'p2')).toBe(false);
    own(s, 'p1', 6);
    s.buildPass = 6;
    expect(() => act(s, 'p1', { type: 'build', pos: 6 })).toThrow('đóng băng');
    // p2 dừng ở ô của p1: không trả thuê
    s.phase = { kind: 'awaitRoll' };
    s.rolled = false;
    s.current = 1;
    pl(s, 'p2').position = 32;
    ({ state: s } = act(s, 'p2', { type: 'roll' }, [3, 4])); // → 39 của p1
    expect(pl(s, 'p2').cash).toBe(1500);
    // Đất của p2 vẫn thu thuê bình thường
    s.phase = { kind: 'awaitRoll' };
    s.rolled = false;
    s.current = 0;
    pl(s, 'p1').position = 32;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [2, 3])); // → 37 của p2
    expect(s.debts.length + (pl(s, 'p1').cash < 1500 ? 1 : 0)).toBeGreaterThan(0);
    s.turn = s.frozen!.p1!;
    expect(isFrozen(s, 'p1')).toBe(false);
  });

  it('Thiên Lôi: phá sập hết nhà trên 3 ô có nhà ngẫu nhiên', () => {
    let s = mkGame(2, DV);
    own(s, 'p2', 1, 3, 6, 39);
    for (const i of [1, 3, 6, 39]) s.properties[i]!.houses = 2;
    topCard(s, 'chance', idx('chance', 'ch23'));
    const r = act(s, 'p1', { type: 'roll' }, [3, 4]);
    s = r.state;
    const left = [1, 3, 6, 39].filter((i) => s.properties[i]!.houses > 0);
    expect(left).toHaveLength(1);
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'thunder' }));
  });

  it('Dịch chuyển: chọn ô bất kỳ để đi tới, qua Khởi Hành nhận lương', () => {
    let s = mkGame(2, DV);
    pl(s, 'p1').position = 33;
    topCard(s, 'chance', idx('chance', 'ch24'));
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2])); // → 36 Cơ Hội
    expect(s.phase).toEqual({ kind: 'cardChoice', choice: 'teleport' });
    expect(() => act(s, 'p1', { type: 'chooseTeleport', pos: 36 })).toThrow('ô khác');
    ({ state: s } = act(s, 'p1', { type: 'chooseTeleport', pos: 6 }));
    expect(pl(s, 'p1').position).toBe(6);
    expect(pl(s, 'p1').cash).toBe(1500 + 500);
    expect(s.phase).toEqual({ kind: 'awaitBuy', pos: 6 });
  });
});

describe('Tung canh lực', () => {
  it('lực chỉ là hiệu ứng: kết quả giống hệt tung ngẫu nhiên', () => {
    for (let k = 0; k < 20; k++) {
      expect(rollWithPower(seededRng(k), 100)).toEqual(rollWithPower(seededRng(k)));
      expect(rollWithPower(seededRng(k), 1)).toEqual(rollWithPower(seededRng(k)));
    }
  });

  it('lực không hợp lệ bị từ chối; không có lực thì tung ngẫu nhiên', () => {
    const s = mkGame(2);
    expect(() => act(s, 'p1', { type: 'roll', power: 0 })).toThrow('Lực');
    expect(() => act(s, 'p1', { type: 'roll', power: 101 })).toThrow('Lực');
    const r = act(s, 'p1', { type: 'roll', power: 100 });
    const ev = r.events.find((e) => e.t === 'roll');
    expect(ev && ev.t === 'roll' && ev.power).toBe(100);
  });
});

describe('Đấu Trí Toán (ô 28 Freestyle)', () => {
  /** p1 dừng ở ô 28; tiền vào cửa = stakeStep × 50 */
  function openQuiz(n = 3, stakeStep = 6) {
    let s = mkGame(n, FS);
    pl(s, 'p1').position = 25;
    ({ state: s } = act(s, 'p1', { type: 'roll' }, [1, 2, stakeStep]));
    return s;
  }

  it('dừng ở ô 28: mở Đấu Trí Toán, tiền vào cửa 100 tr – 1 tỷ', () => {
    const s = openQuiz(3, 6);
    expect(s.phase.kind).toBe('quiz');
    expect(s.quiz!.stake).toBe(300);
    expect(s.quiz!.eligible).toEqual(['p1', 'p2', 'p3']);
    const s2 = openQuiz(3, 20);
    expect(s2.quiz!.stake).toBe(1000);
  });

  it('nhất nhận 75% quỹ, nhì 25%', () => {
    let s = openQuiz(3, 6);
    ({ state: s } = act(s, 'p1', { type: 'quizJoin' }));
    ({ state: s } = act(s, 'p2', { type: 'quizJoin' }));
    ({ state: s } = act(s, 'p3', { type: 'quizJoin' }));
    expect(s.quiz!.stage).toBe('ready');
    expect(s.quiz!.pot).toBe(900);
    expect(pl(s, 'p1').cash).toBe(1200);
    // Hết 5 giây chuẩn bị: ra câu 20 + 30
    ({ state: s } = act(s, 'system', { type: 'quizTimeout' }, [0, 20, 30]));
    expect(s.quiz!.question).toMatchObject({ a: 20, op: '+', b: 30 });
    const opts = s.quiz!.question!.options;
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain(50);
    const wrong = opts.find((v) => v !== 50)!;
    expect(() => act(s, 'p3', { type: 'quizAnswer', value: 9999 })).toThrow('4 đáp án');
    expect(() => act(s, 'p1', { type: 'quizJoin' })).toThrow();
    ({ state: s } = act(s, 'p3', { type: 'quizAnswer', value: wrong })); // sai
    expect(() => act(s, 'p3', { type: 'quizAnswer', value: 50 })).toThrow('1 lần');
    ({ state: s } = act(s, 'p2', { type: 'quizAnswer', value: 50 }));
    const r = act(s, 'p1', { type: 'quizAnswer', value: 50 });
    s = r.state;
    expect(s.quiz).toBeNull();
    expect(pl(s, 'p2').cash).toBe(1200 + 675);
    expect(pl(s, 'p1').cash).toBe(1200 + 225);
    expect(pl(s, 'p3').cash).toBe(1200);
    expect(r.events).toContainEqual(
      expect.objectContaining({ t: 'quizResult', first: 'p2', second: 'p1', prize1: 675 }),
    );
  });

  it('chỉ một người đúng: nhận cả quỹ; không ai đúng: hoàn tiền', () => {
    let s = openQuiz(2, 4);
    ({ state: s } = act(s, 'p1', { type: 'quizJoin' }));
    ({ state: s } = act(s, 'p2', { type: 'quizJoin' }));
    ({ state: s } = act(s, 'system', { type: 'quizTimeout' }, [2, 7, 8]));
    expect(quizAnswerOf(s.quiz!.question!)).toBe(56);
    ({ state: s } = act(s, 'p1', { type: 'quizAnswer', value: 56 }));
    ({ state: s } = act(s, 'system', { type: 'quizTimeout' }));
    expect(pl(s, 'p1').cash).toBe(1500 + 200);
    expect(pl(s, 'p2').cash).toBe(1500 - 200);

    let t = openQuiz(2, 4);
    ({ state: t } = act(t, 'p1', { type: 'quizJoin' }));
    ({ state: t } = act(t, 'p2', { type: 'quizJoin' }));
    ({ state: t } = act(t, 'system', { type: 'quizTimeout' }, [1, 50, 20]));
    const bad = t.quiz!.question!.options.filter((v) => v !== 30);
    ({ state: t } = act(t, 'p1', { type: 'quizAnswer', value: bad[0]! }));
    ({ state: t } = act(t, 'p2', { type: 'quizAnswer', value: bad[1]! }));
    expect(pl(t, 'p1').cash).toBe(1500);
    expect(pl(t, 'p2').cash).toBe(1500);
  });

  it('dưới 2 người vào chơi thì huỷ, hoàn tiền; ai chưa quyết khi hết 10 giây coi như không chơi', () => {
    let s = openQuiz(3, 6);
    ({ state: s } = act(s, 'p2', { type: 'quizJoin' }));
    ({ state: s } = act(s, 'system', { type: 'quizTimeout' }));
    expect(s.quiz).toBeNull();
    expect(pl(s, 'p2').cash).toBe(1500);
  });
});
