/**
 * Thẻ Cơ Hội & Khí Vận (mỗi bộ 16 thẻ). Đơn vị: triệu đồng.
 * `text` hiển thị cho người chơi; `effect` là hiệu ứng chạy trong engine.
 */

export type CardEffect =
  /** Đi tới ô (luôn đi tiến). Đi qua Khởi Hành thì nhận lương. */
  | { type: 'moveTo'; to: number }
  /** Đi tới công ty vận tải gần nhất phía trước; có chủ thì trả gấp đôi */
  | { type: 'nearestTransport' }
  /** Đi tới tiện ích gần nhất phía trước; có chủ thì tung xúc xắc trả 10× */
  | { type: 'nearestUtility' }
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'jailFree' }
  | { type: 'back'; steps: number }
  | { type: 'goToJail' }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }
  /** Cháy nhà: mất 1 cấp nhà trên một ô ngẫu nhiên của mình */
  | { type: 'fire' }
  /** Đập nhà hàng xóm: phá 1 cấp nhà trên một ô ngẫu nhiên của người khác */
  | { type: 'demolishNeighbor' }
  /** Buộc tặng 1 ô đất (chưa có nhà) của mình cho một người chơi khác ngẫu nhiên */
  | { type: 'giftProperty' }
  /** Nhận miễn phí 1 ô đất ngẫu nhiên còn thuộc ngân hàng */
  | { type: 'freeProperty' };

export type DeckId = 'chance' | 'chest';

export interface Card {
  id: string;
  deck: DeckId;
  text: string;
  effect: CardEffect;
  /** Logo thương hiệu tuỳ chọn: client/public/logos/<logo> */
  logo?: string;
}

export const DECK_NAMES: Record<DeckId, string> = {
  chance: 'Cơ Hội',
  chest: 'Khí Vận',
};

export const CHANCE_CARDS: readonly Card[] = [
  {
    id: 'ch01',
    deck: 'chance',
    text: 'Bay thẳng tới TP.HCM – Phố Đồng Khởi.',
    effect: { type: 'moveTo', to: 39 },
  },
  {
    id: 'ch02',
    deck: 'chance',
    text: 'Về Khởi Hành, nhận 200 tr.',
    effect: { type: 'moveTo', to: 0 },
  },
  {
    id: 'ch03',
    deck: 'chance',
    text: 'Du lịch Hạ Long. Đi qua Khởi Hành thì nhận 200 tr.',
    effect: { type: 'moveTo', to: 24 },
  },
  {
    id: 'ch04',
    deck: 'chance',
    text: 'Về thăm Huế. Đi qua Khởi Hành thì nhận 200 tr.',
    effect: { type: 'moveTo', to: 11 },
  },
  {
    id: 'ch05',
    deck: 'chance',
    text: 'Đặt Xanh SM tới công ty vận tải gần nhất phía trước. Có chủ: trả gấp đôi tiền thuê. Chưa có chủ: được mua.',
    effect: { type: 'nearestTransport' },
    logo: 'xanh-sm',
  },
  {
    id: 'ch06',
    deck: 'chance',
    text: 'Đặt Xanh SM tới công ty vận tải gần nhất phía trước. Có chủ: trả gấp đôi tiền thuê. Chưa có chủ: được mua.',
    effect: { type: 'nearestTransport' },
    logo: 'xanh-sm',
  },
  {
    id: 'ch07',
    deck: 'chance',
    text: 'Đi tới công ty tiện ích gần nhất phía trước (EVN/Viettel). Có chủ: tung xúc xắc, trả 10× tổng. Chưa có chủ: được mua.',
    effect: { type: 'nearestUtility' },
  },
  {
    id: 'ch08',
    deck: 'chance',
    text: 'Nhận cổ tức cổ phiếu Vinamilk: 50 tr.',
    effect: { type: 'collect', amount: 50 },
    logo: 'vinamilk',
  },
  {
    id: 'ch09',
    deck: 'chance',
    text: 'Thẻ Bảo Lãnh — Luật sư bảo lãnh thành công: dùng để ra khỏi Phòng Tạm Giữ. Giữ lại hoặc bán được.',
    effect: { type: 'jailFree' },
  },
  { id: 'ch10', deck: 'chance', text: 'Đi lùi 3 ô.', effect: { type: 'back', steps: 3 } },
  {
    id: 'ch11',
    deck: 'chance',
    text: 'Vượt đèn đỏ: về Phòng Tạm Giữ ngay, không qua Khởi Hành, không nhận 200 tr.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'ch12',
    deck: 'chance',
    text: 'Sửa chữa nhà cửa: trả 25 tr mỗi nhà, 100 tr mỗi khách sạn.',
    effect: { type: 'repairs', perHouse: 25, perHotel: 100 },
  },
  {
    id: 'ch13',
    deck: 'chance',
    text: 'Phạt nguội vượt tốc độ: trả 15 tr.',
    effect: { type: 'pay', amount: 15 },
  },
  {
    id: 'ch14',
    deck: 'chance',
    text: 'Đi tàu Đường sắt Việt Nam. Đi qua Khởi Hành thì nhận 200 tr.',
    effect: { type: 'moveTo', to: 5 },
    logo: 'vnr',
  },
  {
    id: 'ch15',
    deck: 'chance',
    text: 'Được bầu làm Chủ tịch HĐQT: trả mỗi người chơi 50 tr.',
    effect: { type: 'payEach', amount: 50 },
  },
  {
    id: 'ch16',
    deck: 'chance',
    text: 'Dự án bất động sản sinh lời: nhận 150 tr.',
    effect: { type: 'collect', amount: 150 },
  },
  {
    id: 'ch17',
    deck: 'chance',
    text: 'Cháy nhà! Một căn nhà bất kỳ của bạn bị thiêu rụi (mất 1 nhà).',
    effect: { type: 'fire' },
  },
  {
    id: 'ch18',
    deck: 'chance',
    text: 'Tranh chấp đất đai: bạn đập 1 căn nhà bất kỳ của hàng xóm.',
    effect: { type: 'demolishNeighbor' },
  },
  {
    id: 'ch19',
    deck: 'chance',
    text: 'Làm từ thiện bắt buộc: tặng 1 ô đất (chưa xây nhà) của bạn cho một người chơi khác.',
    effect: { type: 'giftProperty' },
  },
];

export const CHEST_CARDS: readonly Card[] = [
  {
    id: 'kv01',
    deck: 'chest',
    text: 'Về Khởi Hành, nhận 200 tr.',
    effect: { type: 'moveTo', to: 0 },
  },
  {
    id: 'kv02',
    deck: 'chest',
    text: 'Ngân hàng tính nhầm lãi có lợi cho bạn: nhận 200 tr.',
    effect: { type: 'collect', amount: 200 },
  },
  {
    id: 'kv03',
    deck: 'chest',
    text: 'Khám sức khoẻ định kỳ: trả 50 tr.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    id: 'kv04',
    deck: 'chest',
    text: 'Bán cổ phiếu Vingroup: nhận 50 tr.',
    effect: { type: 'collect', amount: 50 },
    logo: 'vingroup',
  },
  {
    id: 'kv05',
    deck: 'chest',
    text: 'Thẻ Bảo Lãnh — Luật sư bảo lãnh thành công: dùng để ra khỏi Phòng Tạm Giữ. Giữ lại hoặc bán được.',
    effect: { type: 'jailFree' },
  },
  {
    id: 'kv06',
    deck: 'chest',
    text: 'Về Phòng Tạm Giữ ngay, không qua Khởi Hành, không nhận 200 tr.',
    effect: { type: 'goToJail' },
  },
  {
    id: 'kv07',
    deck: 'chest',
    text: 'Thưởng Tết: nhận 100 tr.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    id: 'kv08',
    deck: 'chest',
    text: 'Hoàn thuế thu nhập cá nhân: nhận 20 tr.',
    effect: { type: 'collect', amount: 20 },
  },
  {
    id: 'kv09',
    deck: 'chest',
    text: 'Lì xì Tết: mỗi người chơi lì xì bạn 10 tr.',
    effect: { type: 'collectEach', amount: 10 },
  },
  {
    id: 'kv10',
    deck: 'chest',
    text: 'Bảo hiểm nhân thọ đáo hạn: nhận 100 tr.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    id: 'kv11',
    deck: 'chest',
    text: 'Viện phí: trả 100 tr.',
    effect: { type: 'pay', amount: 100 },
  },
  {
    id: 'kv12',
    deck: 'chest',
    text: 'Đóng học phí cho con: trả 50 tr.',
    effect: { type: 'pay', amount: 50 },
  },
  {
    id: 'kv13',
    deck: 'chest',
    text: 'Phí tư vấn: nhận 25 tr.',
    effect: { type: 'collect', amount: 25 },
  },
  {
    id: 'kv14',
    deck: 'chest',
    text: 'Phường sửa đường trước nhà: trả 40 tr mỗi nhà, 115 tr mỗi khách sạn.',
    effect: { type: 'repairs', perHouse: 40, perHotel: 115 },
  },
  {
    id: 'kv15',
    deck: 'chest',
    text: 'Giải nhì karaoke tổ dân phố: nhận 10 tr.',
    effect: { type: 'collect', amount: 10 },
  },
  {
    id: 'kv16',
    deck: 'chest',
    text: 'Nhận thừa kế: 100 tr.',
    effect: { type: 'collect', amount: 100 },
  },
  {
    id: 'kv17',
    deck: 'chest',
    text: 'Chúc mừng sinh nhật! Mỗi người chơi tặng bạn 20 tr.',
    effect: { type: 'collectEach', amount: 20 },
  },
  {
    id: 'kv18',
    deck: 'chest',
    text: 'Chập điện: một căn nhà bất kỳ của bạn bị cháy (mất 1 nhà).',
    effect: { type: 'fire' },
  },
  {
    id: 'kv19',
    deck: 'chest',
    text: 'Trúng thưởng bốc thăm: nhận miễn phí 1 ô đất bất kỳ còn thuộc ngân hàng.',
    effect: { type: 'freeProperty' },
  },
];

export const DECKS: Record<DeckId, readonly Card[]> = {
  chance: CHANCE_CARDS,
  chest: CHEST_CARDS,
};

export function cardById(id: string): Card {
  const c = [...CHANCE_CARDS, ...CHEST_CARDS].find((x) => x.id === id);
  if (!c) throw new Error(`Không có thẻ ${id}`);
  return c;
}
