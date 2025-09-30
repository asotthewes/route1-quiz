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
        text: "Aan het Brinkplein staat een gebouw met een weegschaal erop. Hoe heet dit gebouw?",
        answer: "de waag",
        hints: [
          "Het staat midden op de Brink.",
          "Het werd vroeger gebruikt om goederen te wegen."
        ]
      },
      {
        text: "In welke rivier ligt Deventer?",
        answer: "ijssel",
        hints: [
          "Het is een zijtak van de Rijn.",
          "Deventer ligt aan de ..."
        ]
      },
      {
        text: "Welke bekende koek hoort bij Deventer?",
        answer: "deventer koek",
        hints: [
          "Het is een kruidige lekkernij.",
          "Het wordt vaak in blokken verkocht."
        ]
      },
      {
        text: "Wat is de bijnaam van de Lebuinuskerk?",
        answer: "grote kerk",
        hints: [
          "Het is de grootste kerk van Deventer.",
          "De bijnaam begint met 'G'."
        ]
      },
      {
        text: "Welke sportieve tocht eindigt traditioneel in Nijmegen, maar komt uit Deventer?",
        answer: "ijsselloop",
        hints: [
          "Het is een hardloopwedstrijd.",
          "De naam verwijst naar de rivier."
        ]
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
