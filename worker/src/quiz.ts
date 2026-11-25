import { QUIZ_MATH_CATEGORY, type BankQuestion, type GameState, type Rng } from '@cotyphu/shared';
import { QUIZ_BANK, QUIZ_BANK_CATEGORIES } from './questions.js';

/**
 * Chọn câu hỏi Đấu Trí theo chủ đề / độ khó chủ phòng chọn, không lặp câu đã hỏi trong ván.
 * Trả về undefined khi rơi vào chủ đề "Tính nhẩm" (máy tự ra phép tính) hoặc đã hết câu phù hợp.
 */
export function pickQuizQuestion(g: GameState, rng: Rng): BankQuestion | undefined {
  const cats = g.rules.quizCategories ?? [];
  const diffs = g.rules.quizDifficulties ?? [];
  const used = new Set(g.quizUsed ?? []);
  const wantCat = (c: string) => cats.length === 0 || cats.includes(c);
  // Tính nhẩm là một chủ đề như các chủ đề khác: chọn theo tỉ lệ 1 / số chủ đề đang bật
  const topics = cats.length === 0 ? QUIZ_BANK_CATEGORIES.length + 1 : cats.length;
  const mathOn = wantCat(QUIZ_MATH_CATEGORY);
  if (mathOn && rng.int(1, topics) === 1) return undefined;
  const pool = QUIZ_BANK.filter(
    ([id, cat, diff]) =>
      !used.has(id) &&
      wantCat(QUIZ_BANK_CATEGORIES[cat]!) &&
      (diffs.length === 0 || diffs.includes(diff)),
  );
  if (pool.length === 0) return undefined;
  const [id, cat, difficulty, text, options, answerIndex] = pool[rng.int(0, pool.length - 1)]!;
  return { id, category: QUIZ_BANK_CATEGORIES[cat]!, difficulty, text, options, answerIndex };
}

/** Bỏ đáp án Đấu Trí khỏi trạng thái gửi xuống người chơi (chống xem trộm) */
export function hideQuizAnswer(g: GameState | null): GameState | null {
  if (!g?.quiz || g.quiz.answer === undefined) return g;
  const { answer: _hidden, ...quiz } = g.quiz;
  return { ...g, quiz };
}
