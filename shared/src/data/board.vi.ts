/**
 * Dữ liệu bàn cờ 40 ô — Cờ Tỷ Phú CLB30.
 * Đơn vị tiền: TRIỆU ĐỒNG. Muốn đổi tên ô / giá / tiền thuê: sửa trực tiếp ở file này.
 * Thế chấp = 50% giá mua (tính tự động, không cần khai báo).
 */

export type ColorGroup =
  'brown' | 'lightBlue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'darkBlue';

export interface GroupInfo {
  name: string;
  /** Màu hiển thị (hex) */
  color: string;
}

export const GROUPS: Record<ColorGroup, GroupInfo> = {
  brown: { name: 'Nâu', color: '#8B5A2B' },
  lightBlue: { name: 'Xanh nhạt', color: '#7CC8EC' },
  pink: { name: 'Hồng', color: '#E05FA4' },
  orange: { name: 'Cam', color: '#F28C28' },
  red: { name: 'Đỏ', color: '#D7263D' },
  yellow: { name: 'Vàng', color: '#F2C21B' },
  green: { name: 'Xanh lá', color: '#1E9E5A' },
  darkBlue: { name: 'Xanh đậm', color: '#1F4FA8' },
};

/** [đất trống, 1 nhà, 2 nhà, 3 nhà, 4 nhà, khách sạn] */
export type RentTable = readonly [number, number, number, number, number, number];

interface BaseSquare {
  index: number;
  name: string;
  /** Tên ngắn hiển thị trên ô (mobile) */
  short?: string;
}

export interface StreetSquare extends BaseSquare {
  kind: 'street';
  group: ColorGroup;
  price: number;
  rent: RentTable;
  /** Giá xây 1 nhà (khách sạn cùng giá) */
  houseCost: number;
  /** Ảnh minh hoạ tuỳ chọn: client/public/images/<image> */
  image?: string;
}

export interface TransportSquare extends BaseSquare {
  kind: 'transport';
  price: number;
  logo?: string;
  brandColor: string;
}

export interface UtilitySquare extends BaseSquare {
  kind: 'utility';
  price: number;
  logo?: string;
  brandColor: string;
}

export interface SimpleSquare extends BaseSquare {
  kind: 'go' | 'chest' | 'chance' | 'jail' | 'parking' | 'goToJail';
}

export interface TaxSquare extends BaseSquare {
  kind: 'tax';
  amount: number;
}

export type Square = StreetSquare | TransportSquare | UtilitySquare | SimpleSquare | TaxSquare;
export type OwnableSquare = StreetSquare | TransportSquare | UtilitySquare;

const street = (
  index: number,
  name: string,
  group: ColorGroup,
  price: number,
  rent: RentTable,
  houseCost: number,
  short?: string,
): StreetSquare => ({ index, name, kind: 'street', group, price, rent, houseCost, short });

export const BOARD: readonly Square[] = [
  { index: 0, kind: 'go', name: 'Khởi Hành' },
  street(1, 'Hà Giang', 'brown', 60, [2, 10, 30, 90, 160, 250], 50),
  { index: 2, kind: 'chest', name: 'Khí Vận' },
  street(3, 'Điện Biên', 'brown', 60, [4, 20, 60, 180, 320, 450], 50),
  { index: 4, kind: 'tax', name: 'Thuế Thu Nhập Cá Nhân', short: 'Thuế TNCN', amount: 200 },
  {
    index: 5,
    kind: 'transport',
    name: 'Đường sắt Việt Nam',
    short: 'Đường sắt VN',
    price: 200,
    logo: 'vnr',
    brandColor: '#1B4F9C',
  },
  street(6, 'Sa Pa', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  { index: 7, kind: 'chance', name: 'Cơ Hội' },
  street(8, 'Mộc Châu', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50),
  street(9, 'Ninh Bình – Tràng An', 'lightBlue', 120, [8, 40, 100, 300, 450, 600], 50, 'Ninh Bình'),
  { index: 10, kind: 'jail', name: 'Phòng Tạm Giữ / Ghé Thăm', short: 'Tạm Giữ' },
  street(11, 'Huế', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  {
    index: 12,
    kind: 'utility',
    name: 'EVN – Điện lực Việt Nam',
    short: 'EVN',
    price: 150,
    logo: 'evn',
    brandColor: '#E2231A',
  },
  street(13, 'Hội An', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
  street(14, 'Quy Nhơn', 'pink', 160, [12, 60, 180, 500, 700, 900], 100),
  {
    index: 15,
    kind: 'transport',
    name: 'Vietnam Airlines',
    short: 'VN Airlines',
    price: 200,
    logo: 'vietnam-airlines',
    brandColor: '#0A6B7C',
  },
  street(16, 'Phan Thiết – Mũi Né', 'orange', 180, [14, 70, 200, 550, 750, 950], 100, 'Mũi Né'),
  { index: 17, kind: 'chest', name: 'Khí Vận' },
  street(18, 'Nha Trang', 'orange', 180, [14, 70, 200, 550, 750, 950], 100),
  street(19, 'Đà Lạt', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100),
  { index: 20, kind: 'parking', name: 'Cà Phê Vỉa Hè', short: 'Cà Phê' },
  street(21, 'Cần Thơ', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  { index: 22, kind: 'chance', name: 'Cơ Hội' },
  street(23, 'Vũng Tàu', 'red', 220, [18, 90, 250, 700, 875, 1050], 150),
  street(24, 'Hạ Long', 'red', 240, [20, 100, 300, 750, 925, 1100], 150),
  {
    index: 25,
    kind: 'transport',
    name: 'Vietjet Air',
    short: 'Vietjet',
    price: 200,
    logo: 'vietjet',
    brandColor: '#E01E26',
  },
  street(26, 'Hải Phòng', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  street(27, 'Phú Quốc', 'yellow', 260, [22, 110, 330, 800, 975, 1150], 150),
  {
    index: 28,
    kind: 'utility',
    name: 'Viettel',
    price: 150,
    logo: 'viettel',
    brandColor: '#EE0033',
  },
  street(29, 'Đà Nẵng', 'yellow', 280, [24, 120, 360, 850, 1025, 1200], 150),
  {
    index: 30,
    kind: 'goToJail',
    name: 'Vượt Đèn Đỏ – Về Phòng Tạm Giữ',
    short: 'Vượt Đèn Đỏ',
  },
  street(31, 'Hà Nội – Tây Hồ', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200, 'Tây Hồ'),
  street(32, 'TP.HCM – Thảo Điền', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200, 'Thảo Điền'),
  { index: 33, kind: 'chest', name: 'Khí Vận' },
  street(
    34,
    'TP.HCM – Phú Mỹ Hưng',
    'green',
    320,
    [28, 150, 450, 1000, 1200, 1400],
    200,
    'Phú Mỹ Hưng',
  ),
  {
    index: 35,
    kind: 'transport',
    name: 'Xanh SM',
    price: 200,
    logo: 'xanh-sm',
    brandColor: '#00B4AE',
  },
  { index: 36, kind: 'chance', name: 'Cơ Hội' },
  street(
    37,
    'Hà Nội – Hồ Hoàn Kiếm',
    'darkBlue',
    350,
    [35, 175, 500, 1100, 1300, 1500],
    200,
    'Hồ Gươm',
  ),
  { index: 38, kind: 'tax', name: 'Thuế Tiêu Thụ Đặc Biệt', short: 'Thuế TTĐB', amount: 100 },
  street(
    39,
    'TP.HCM – Phố Đồng Khởi',
    'darkBlue',
    400,
    [50, 200, 600, 1400, 1700, 2000],
    200,
    'Đồng Khởi',
  ),
];

export const BOARD_SIZE = 40;
export const GO_INDEX = 0;
export const JAIL_INDEX = 10;
export const PARKING_INDEX = 20;
export const GO_TO_JAIL_INDEX = 30;

/** Tiền thuê vận tải theo số công ty sở hữu (1..4) */
export const TRANSPORT_RENT = [0, 25, 50, 100, 200] as const;
/** Hệ số tiền thuê tiện ích theo số công ty sở hữu (1..2) */
export const UTILITY_MULTIPLIER = [0, 4, 10] as const;

export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const HOUSE_STOCK = 32;
export const HOTEL_STOCK = 12;
/** Mức nhà = 5 nghĩa là khách sạn */
export const HOTEL_LEVEL = 5;

export function isOwnable(sq: Square): sq is OwnableSquare {
  return sq.kind === 'street' || sq.kind === 'transport' || sq.kind === 'utility';
}

export const OWNABLE_INDICES: readonly number[] = BOARD.filter(isOwnable).map((s) => s.index);

export const GROUP_MEMBERS: Record<ColorGroup, readonly number[]> = (() => {
  const out = {} as Record<ColorGroup, number[]>;
  for (const g of Object.keys(GROUPS) as ColorGroup[]) out[g] = [];
  for (const sq of BOARD) if (sq.kind === 'street') out[sq.group].push(sq.index);
  return out;
})();

export const TRANSPORT_INDICES = BOARD.filter((s) => s.kind === 'transport').map((s) => s.index);
export const UTILITY_INDICES = BOARD.filter((s) => s.kind === 'utility').map((s) => s.index);

export function square(index: number): Square {
  const sq = BOARD[index];
  if (!sq) throw new Error(`Ô không tồn tại: ${index}`);
  return sq;
}

export function ownable(index: number): OwnableSquare {
  const sq = square(index);
  if (!isOwnable(sq)) throw new Error(`Ô ${index} không mua được`);
  return sq;
}

export function mortgageValue(index: number): number {
  return Math.floor(ownable(index).price / 2);
}

/** Chuộc lại = giá thế chấp + 10%, làm tròn lên tới triệu */
export function unmortgageCost(index: number): number {
  return Math.ceil((mortgageValue(index) * 11) / 10);
}

/** Phí 10% khi nhận ô đang thế chấp qua giao dịch / phá sản */
export function mortgageTransferFee(index: number): number {
  return Math.ceil(mortgageValue(index) / 10);
}
