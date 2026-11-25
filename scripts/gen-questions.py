#!/usr/bin/env python3
"""Sinh worker/src/questions.ts và shared/src/data/quizCategories.ts từ data/questions.json.

Chạy lại sau khi sửa ngân hàng câu hỏi:  python3 scripts/gen-questions.py
"""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parent.parent
d = json.loads((root / 'data/questions.json').read_text(encoding='utf-8'))
cats = d['categories']
for q in d['questions']:
    assert len(q['options']) == 4 and len(set(q['options'])) == 4, q['id']
    assert q['options'][q['answerIndex']] == q['answer'], q['id']
rows = [[q['id'], cats.index(q['category']), q['difficulty'], q['question'], q['options'], q['answerIndex']]
        for q in d['questions']]
(root / 'worker/src/questions.ts').write_text(
    '// Ngân hàng câu hỏi Đấu Trí. Tự sinh từ data/questions.json bằng scripts/gen-questions.py — không sửa tay.\n'
    '// Mỗi dòng: [mã, chỉ số chủ đề, độ khó 1–3, câu hỏi, 4 đáp án, vị trí đáp án đúng]\n'
    '// Chỉ nằm ở máy chủ: đáp án không gửi xuống người chơi trước khi chấm.\n\n'
    f'export const QUIZ_BANK_CATEGORIES: readonly string[] = {json.dumps(cats, ensure_ascii=False)};\n\n'
    'export type QuizRow = [number, number, number, string, string[], number];\n\n'
    f'export const QUIZ_BANK: readonly QuizRow[] = {json.dumps(rows, ensure_ascii=False, separators=(",", ":"))};\n',
    encoding='utf-8')
c = Counter(q['category'] for q in d['questions'])
dc = Counter(q['difficulty'] for q in d['questions'])
(root / 'shared/src/data/quizCategories.ts').write_text(
    '// Chủ đề + số câu của ngân hàng Đấu Trí (không chứa câu hỏi / đáp án). Tự sinh bằng scripts/gen-questions.py.\n\n'
    f'export const QUIZ_BANK_TOPICS: readonly {{ name: string; count: number }}[] = {json.dumps([{"name": k, "count": c[k]} for k in cats], ensure_ascii=False)};\n\n'
    f'/** Số câu theo độ khó: 1 Dễ · 2 Trung bình · 3 Khó */\nexport const QUIZ_BANK_DIFFICULTY: Readonly<Record<number, number>> = {json.dumps({str(k): dc[k] for k in sorted(dc)})};\n',
    encoding='utf-8')
print('ok', len(rows), 'câu,', len(cats), 'chủ đề')
