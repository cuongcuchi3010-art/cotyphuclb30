// Chủ đề + số câu của ngân hàng Đấu Trí (không chứa câu hỏi / đáp án). Tự sinh bằng scripts/gen-questions.py.

export const QUIZ_BANK_TOPICS: readonly { name: string; count: number }[] = [
  { name: 'Lịch sử Việt Nam', count: 92 },
  { name: 'Lịch sử thế giới', count: 70 },
  { name: 'Kiểu Ai là triệu phú', count: 81 },
  { name: 'Địa lý Việt Nam', count: 60 },
  { name: 'Địa lý thế giới', count: 60 },
  { name: 'Văn hóa – Phong tục Việt Nam', count: 50 },
  { name: 'Văn học Việt Nam', count: 60 },
  { name: 'Văn học thế giới', count: 45 },
  { name: 'Danh nhân', count: 60 },
  { name: 'Âm nhạc', count: 55 },
  { name: 'Hóa học', count: 55 },
  { name: 'Vật lý', count: 45 },
  { name: 'Sinh học', count: 45 },
  { name: 'Toán học', count: 35 },
  { name: 'Thiên văn – Vũ trụ', count: 30 },
  { name: 'Thể thao', count: 40 },
  { name: 'Công nghệ – Tin học', count: 30 },
  { name: 'Mỹ thuật – Kiến trúc – Điện ảnh', count: 30 },
  { name: 'Ẩm thực', count: 30 },
  { name: 'Tiếng Việt – Ngôn ngữ', count: 27 },
];

/** Số câu theo độ khó: 1 Dễ · 2 Trung bình · 3 Khó */
export const QUIZ_BANK_DIFFICULTY: Readonly<Record<number, number>> = {
  '1': 558,
  '2': 368,
  '3': 74,
};
