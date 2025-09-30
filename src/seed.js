import { db, migrate } from './db.js';
import { genCode } from './util.js';
import dayjs from 'dayjs';

const firstTime = migrate();

const row = db.prepare('SELECT COUNT(*) as c FROM quizzes').get();
if (row.c === 0) {
  const tx = db.transaction(() => {
    const { lastInsertRowid: quizId } = db.prepare('INSERT INTO quizzes(title) VALUES (?)').run('StadsMysterie Demo');

    const qStmt = db.prepare('INSERT INTO questions(quiz_id, idx, text, answer) VALUES (?, ?, ?, ?)');
    const hStmt = db.prepare('INSERT INTO hints(question_id, idx, text) VALUES (?, ?, ?)');

    const qs = [
      {
        text: 'Welke kleur heeft de Nederlandse vlag bovenaan? (typ het woord)',
        answer: 'rood',
        hints: ['Het is niet blauw.', 'Denk aan rood-wit-blauw.']
      },
      {
        text: 'Hoeveel dagen zitten er in een week? (cijfer)',
        answer: '7',
        hints: ['Meer dan 6, minder dan 8.']
      },
      {
        text: 'Vul aan: Chat___ (drie letters)',
        answer: 'gpt',
        hints: ['De laatste letter is T.']
      }
    ];

    qs.forEach((q, i) => {
      const { lastInsertRowid: questionId } = qStmt.run(quizId, i, q.text, q.answer.toLowerCase());
      q.hints?.forEach((h, hi) => hStmt.run(questionId, hi, h));
    });

    const cStmt = db.prepare('INSERT INTO codes(code, quiz_id) VALUES (?, ?)');
    for (let i = 0; i < 20; i++) {
      cStmt.run(genCode(), quizId);
    }
  });

  tx();
  console.log('Database seeded with demo quiz and 20 join codes.');
  console.log('Fetch codes at /admin/codes?token=YOUR_ADMIN_TOKEN');
}
