# Ngân hàng 1000 câu hỏi – nạp vào game Cờ Tỷ Phú

Hãy chép `questions.json` vào thư mục dữ liệu của game (ví dụ `src/data/questions.json` hoặc `public/data/questions.json`), rồi dán đoạn yêu cầu dưới đây vào Claude Code.

## Cấu trúc dữ liệu

```json
{
  "version": 1,
  "total": 1000,
  "categories": ["Lịch sử Việt Nam", "..."],
  "questions": [
    {
      "id": 1,
      "category": "Lịch sử Việt Nam",
      "difficulty": 1,
      "difficultyLabel": "Dễ",
      "question": "Nhà nước đầu tiên của người Việt theo truyền thuyết là gì?",
      "options": ["Văn Lang", "Âu Lạc", "Vạn Xuân", "Đại Cồ Việt"],
      "answerIndex": 0,
      "answer": "Văn Lang"
    }
  ]
}
```

- `difficulty`: 1 = Dễ (558 câu), 2 = Trung bình (368 câu), 3 = Khó (74 câu)
- `answerIndex`: vị trí đáp án đúng trong `options` (0–3). Các đáp án đúng đã được trộn, phân bổ gần đều giữa A, B, C và D.
- Có 20 chủ đề, liệt kê trong `categories`.

## Gợi ý yêu cầu cho Claude Code

> Thêm tính năng câu hỏi kiến thức vào game Cờ Tỷ Phú, dùng dữ liệu trong `questions.json` (cấu trúc được mô tả trong HUONG_DAN_CLAUDE_CODE.md):
> 1. Khi người chơi rơi vào ô Cơ hội / Khí vận (hoặc ô mình chỉ định), hiện một câu hỏi ngẫu nhiên có 4 nút A–D và đồng hồ đếm ngược 20 giây.
> 2. Trả lời đúng thì được thưởng tiền theo độ khó: Dễ +100, Trung bình +200, Khó +400. Trả lời sai hoặc hết giờ thì bị trừ một nửa mức thưởng.
> 3. Không lặp lại câu đã hỏi trong cùng một ván, lưu danh sách `id` đã dùng ở state của phòng chơi trên server.
> 4. Câu hỏi và đáp án phải do server chọn và chấm. Không gửi `answerIndex` xuống client trước khi người chơi trả lời, để tránh gian lận khi chơi nhiều người.
> 5. Sau khi trả lời, hiện đáp án đúng cho cả phòng xem.
> 6. Cho chủ phòng chọn chủ đề và độ khó khi tạo phòng (mặc định là tất cả).
