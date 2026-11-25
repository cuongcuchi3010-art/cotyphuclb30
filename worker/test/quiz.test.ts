import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, seededRng, type GameState } from '@cotyphu/shared';
import { hideQuizAnswer, pickQuizQuestion } from '../src/quiz.js';
import { QUIZ_BANK } from '../src/questions.js';

const game = (rules: Partial<GameState['rules']> = {}, used: number[] = []) =>
  ({ rules: { ...DEFAULT_RULES, ...rules }, quizUsed: used }) as unknown as GameState;

describe('Ngân hàng câu hỏi Đấu Trí', () => {
  it('đủ 1000 câu, mỗi câu 4 đáp án khác nhau, đáp án đúng hợp lệ', () => {
    expect(QUIZ_BANK).toHaveLength(1000);
    for (const [, , , , opts, ans] of QUIZ_BANK) {
      expect(new Set(opts).size).toBe(4);
      expect(ans).toBeGreaterThanOrEqual(0);
      expect(ans).toBeLessThan(4);
    }
  });

  it('lọc theo chủ đề và độ khó, không lặp câu đã hỏi', () => {
    const rng = seededRng(5);
    const seen = new Set<number>();
    let g = game({ quizCategories: ['Âm nhạc'], quizDifficulties: [1] });
    for (let k = 0; k < 20; k++) {
      const q = pickQuizQuestion(g, rng);
      if (!q) break;
      expect(q.category).toBe('Âm nhạc');
      expect(q.difficulty).toBe(1);
      expect(seen.has(q.id!)).toBe(false);
      seen.add(q.id!);
      g = game(g.rules, [...seen]);
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('chỉ chọn Tính nhẩm thì để máy ra phép tính', () => {
    expect(pickQuizQuestion(game({ quizCategories: ['Tính nhẩm'] }), seededRng(1))).toBeUndefined();
  });

  it('ẩn đáp án khi gửi xuống người chơi', () => {
    const g = { quiz: { answer: 2, stage: 'question' } } as unknown as GameState;
    expect(hideQuizAnswer(g)!.quiz).toEqual({ stage: 'question' });
  });
});
