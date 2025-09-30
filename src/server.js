import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dayjs from 'dayjs';
import { db, migrate } from './db.js';
import { genCode, normalize } from './util.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme-please';
const APP_TITLE = process.env.APP_TITLE || 'Quiz';

migrate();

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));
app.use('/public', express.static('./public'));

function getSession(req) {
  const sid = req.cookies.sid;
  if (!sid) return null;
  return db.prepare('SELECT s.id as sid, p.* FROM sessions s JOIN participants p ON p.id = s.participant_id WHERE s.id = ?').get(sid);
}

function requireSession(req, res, next) {
  const sess = getSession(req);
  if (!sess) return res.redirect('/');
  req.session = sess;
  next();
}

app.get('/', (req, res) => {
  const sess = getSession(req);
  if (sess) return res.redirect('/play');
  res.render('join', { APP_TITLE });
});

app.post('/join', (req, res) => {
  const code = (req.body.code || '').toUpperCase().trim();
  if (!code) return res.render('join', { APP_TITLE, error: 'Vul een code in.' });

  const codeRow = db.prepare('SELECT * FROM codes WHERE code = ?').get(code);
  if (!codeRow) return res.render('join', { APP_TITLE, error: 'Ongeldige code.' });

  let participant;
  if (!codeRow.used_by) {
    const pid = 'p_' + genCode() + genCode();
    const now = dayjs().toISOString();
    db.prepare('INSERT INTO participants(id, quiz_id, code, current_idx, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(pid, codeRow.quiz_id, code, 0, now);
    db.prepare('UPDATE codes SET used_by = ? WHERE code = ?').run(pid, code);
    participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(pid);
  } else {
    participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(codeRow.used_by);
  }

  const sid = 's_' + genCode() + genCode();
  db.prepare('INSERT INTO sessions(id, participant_id, created_at) VALUES (?, ?, ?)')
    .run(sid, participant.id, dayjs().toISOString());
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 });
  res.redirect('/play');
});

app.get('/play', requireSession, (req, res) => {
  const p = req.session;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(p.quiz_id);
  const total = db.prepare('SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?').get(p.quiz_id).c;
  const done = p.current_idx >= total;
  if (done) return res.render('done', { APP_TITLE, quiz, total });

  const q = db.prepare('SELECT * FROM questions WHERE quiz_id = ? AND idx = ?').get(p.quiz_id, p.current_idx);
  const hints = db.prepare('SELECT * FROM hints WHERE question_id = ? ORDER BY idx ASC').all(q.id);
  const hcount = Math.max(0, Math.min(Number(req.query.h || 0), hints.length));
  res.render('play', { APP_TITLE, quiz, q, total, index: p.current_idx, hints: hints.slice(0, hcount), hcount });
});

app.post('/answer', requireSession, (req, res) => {
  const p = req.session;
  const { qid, answer } = req.body;
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(qid));
  const ok = normalize(answer) === normalize(q.answer);
  db.prepare('INSERT INTO attempts(participant_id, question_id, answer_text, correct, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(p.id, q.id, (answer || '').toString(), ok ? 1 : 0, dayjs().toISOString());

  if (ok) {
    db.prepare('UPDATE participants SET current_idx = current_idx + 1 WHERE id = ?').run(p.id);
    return res.redirect('/play');
  }

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(p.quiz_id);
  const total = db.prepare('SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?').get(p.quiz_id).c;
  const hints = db.prepare('SELECT * FROM hints WHERE question_id = ? ORDER BY idx ASC').all(q.id);
  res.status(200).render('play', {
    APP_TITLE,
    quiz,
    q,
    total,
    index: p.current_idx,
    hints: [],
    hcount: 0,
    error: 'Helaas, dat is niet goed. Probeer het opnieuw of vraag een hint.'
  });
});

app.post('/hint', requireSession, (req, res) => {
  const h = Math.max(0, Number(req.body.h || 0)) + 1;
  res.redirect('/play?h=' + h);
});

app.get('/admin/codes', (req, res) => {
  if ((req.query.token || '') !== ADMIN_TOKEN) return res.status(401).send('Unauthorized');
  const rows = db.prepare('SELECT c.code, c.quiz_id, c.used_by FROM codes c ORDER BY c.code ASC').all();
  res.type('text').send(rows.map(r => `${r.code}  quiz:${r.quiz_id}  used_by:${r.used_by || '-'} `).join('\n'));
});

app.get('/admin/new-codes', (req, res) => {
  if ((req.query.token || '') !== ADMIN_TOKEN) return res.status(401).send('Unauthorized');
  const n = Math.max(1, Math.min(200, Number(req.query.n || 10)));
  const qid = Number(req.query.quiz || 1);
  const ins = db.prepare('INSERT INTO codes(code, quiz_id) VALUES (?, ?)');
  const made = [];
  for (let i = 0; i < n; i++) {
    const code = genCode();
    try { ins.run(code, qid); made.push(code); } catch {}
  }
  res.type('text').send(made.join('\n'));
});

app.listen(PORT, () => console.log(`Quiz app listening on http://0.0.0.0:${PORT}`));
