import express from 'express';
import helmet from 'helmet';
import { uploadVerification, prepareImage } from './uploads.js';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword, checkPassword, randomToken, digest } from './security.js';
import { reviewVerification } from './verification.js';
import { MAX_DUNGEONS } from '../shared/dungeons.js';
const failure = (status, message) => Object.assign(new Error(message), { status });
const text = (v, max, name, min = 0) => {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) throw failure(400, `${name} 입력을 확인해 주세요.`);
  return v.trim();
};
const number = (v, max) => {
  if (!Number.isSafeInteger(v) || v < 0 || v > max) throw failure(400, '능력치 범위를 확인해 주세요.');
  return v;
};
const username = v => {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_]{4,24}$/.test(v)) throw failure(400, '아이디는 영문·숫자·밑줄 4~24자로 입력해 주세요.');
  return v.toLowerCase();
};
const password = v => {
  if (typeof v !== 'string' || v.length < 12 || v.length > 128) throw failure(400, '비밀번호는 12~128자로 입력해 주세요.');
  return v;
};
function profile(row) {
  if (!row) return null;
  return { id: row.user_id, nickname: row.nickname, server: row.server, job: row.job, power: row.power,
    level: row.level, intro: row.intro, availability: row.availability, dungeons: JSON.parse(row.dungeons),
    public: !!row.public, verifiedPower: row.verified_power, verifiedLevel: row.verified_level, verifiedAt: row.verified_at };
}
export function createApp(db, { origins = ['http://localhost:3000'], authLimit = 20, adminIds = (process.env.ADMIN_USER_IDS || '').split(',').filter(Boolean) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
  app.use(helmet({ contentSecurityPolicy: { directives: { 'connect-src': ["'self'", ...origins], 'img-src': ["'self'", 'data:', 'blob:', 'https:'] } } }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && !origins.includes(origin)) return res.status(403).json({ error: '허용되지 않은 출처입니다.' });
    if (origin) res.set({ 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '잠시 후 다시 시도해 주세요.' } }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, limit: authLimit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '인증 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.' } }));
  async function auth(req, _res, next) {
    const token = req.get('authorization')?.match(/^Bearer ([\w-]{43})$/)?.[1];
    if (!token) throw failure(401, '로그인이 필요합니다.');
    const row = (await db.execute({ sql: 'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', args: [digest(token), Date.now()] })).rows[0];
    if (!row) throw failure(401, '로그인이 만료되었습니다.');
    req.user = row; req.token = digest(token); next();
  }
  async function session(id) {
    const token = randomToken();
    await db.execute({ sql: 'INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', args: [digest(token), id, Date.now() + 7 * 86400000] });
    await db.execute({ sql: 'DELETE FROM sessions WHERE expires < ?', args: [Date.now()] });
    return token;
  }
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.post('/api/auth/register', async (req, res) => {
    const name = username(req.body.username), pass = password(req.body.password);
    const id = randomUUID(), recoveryCode = randomToken(), hashed = await hashPassword(pass);
    try { await db.execute({ sql: 'INSERT INTO users(id,username,password,recovery) VALUES(?,?,?,?)', args: [id, name, hashed, digest(recoveryCode)] }); }
    catch (err) { if (err.code?.includes('CONSTRAINT')) throw failure(409, '사용할 수 없는 아이디입니다.'); throw err; }
    res.status(201).json({ token: await session(id), recoveryCode, user: { id, username: name } });
  });
  // A fixed valid dummy hash avoids a fast path for nonexistent usernames.
  const dummy = hashPassword(randomToken());
  app.post('/api/auth/login', async (req, res) => {
    const name = username(req.body.username), pass = password(req.body.password);
    const row = (await db.execute({ sql: 'SELECT * FROM users WHERE username=?', args: [name] })).rows[0];
    const valid = await checkPassword(pass, row?.password || await dummy);
    if (!row || !valid) throw failure(401, '아이디 또는 비밀번호를 확인해 주세요.');
    res.json({ token: await session(row.id), user: { id: row.id, username: row.username } });
  });
  app.post('/api/auth/recover', async (req, res) => {
    const name = username(req.body.username), pass = password(req.body.password);
    const code = text(req.body.recoveryCode, 100, '복구 코드', 1);
    const recoveryCode = randomToken(), hashed = await hashPassword(pass);
    const tx = await db.transaction('write');
    try {
      const result = await tx.execute({ sql: 'UPDATE users SET password=?, recovery=? WHERE username=? AND recovery=? RETURNING id', args: [hashed, digest(recoveryCode), name, digest(code)] });
      if (!result.rows.length) throw failure(400, '아이디 또는 복구 코드를 확인해 주세요.');
      await tx.execute({ sql: 'DELETE FROM sessions WHERE user_id=?', args: [result.rows[0].id] });
      await tx.commit();
    } finally { tx.close(); }
    res.json({ recoveryCode });
  });
  app.post('/api/logout', auth, async (req, res) => { await db.execute({ sql: 'DELETE FROM sessions WHERE token=?', args: [req.token] }); res.json({ ok: true }); });
  app.get('/api/me', auth, async (req, res) => {
    const p = (await db.execute({ sql: 'SELECT * FROM profiles WHERE user_id=?', args: [req.user.id] })).rows[0];
    res.json({ user: { ...req.user, isAdmin: adminIds.includes(req.user.id) }, profile: profile(p) });
  });
  app.get('/api/profiles', async (_req, res) => {
    const rows = (await db.execute('SELECT * FROM profiles WHERE public=1 ORDER BY updated_at DESC LIMIT 200')).rows;
    res.json(rows.map(profile));
  });
  app.post('/api/verification', auth, uploadVerification, async (req, res) => {
    const inputNumber = (value, max) => {
      if (typeof value !== 'string' || !/^\d+$/.test(value)) throw failure(400, '신스레벨과 전투력을 정수로 입력해 주세요.');
      return number(Number(value), max);
    };
    const power = inputNumber(req.body?.power, 999999999), level = inputNumber(req.body?.level, 9999);
    const image = await prepareImage(req.file);
    const requestId = randomUUID();
    const tx = await db.transaction('write');
    try {
      const row = (await tx.execute({ sql: 'SELECT * FROM profiles WHERE user_id=?', args: [req.user.id] })).rows[0];
      if (!row) throw failure(400, '프로필을 먼저 저장해 주세요.');
      await tx.execute({ sql: `INSERT INTO verification_requests(user_id,nickname,server,power,level,evidence,request_id,profile_power,profile_level) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,server=excluded.server,power=excluded.power,level=excluded.level,evidence=excluded.evidence,request_id=excluded.request_id,profile_power=excluded.profile_power,profile_level=excluded.profile_level,status='pending',requested_at=CURRENT_TIMESTAMP`, args: [req.user.id, row.nickname, row.server, power, level, '', requestId, row.power, row.level] });
      await tx.execute({ sql: 'DELETE FROM verification_images WHERE user_id=?', args: [req.user.id] });
      await tx.execute({ sql: 'INSERT INTO verification_images(request_id,user_id,mime,image) VALUES(?,?,?,?)', args: [requestId, req.user.id, 'image/webp', image] });
      await tx.commit();
    } finally { tx.close(); }
    res.json({ ok: true });
  });
  function admin(req, _res, next) {
    if (!adminIds.includes(req.user.id)) throw failure(403, '운영자만 인증 신청을 검토할 수 있습니다.');
    next();
  }
  app.get('/api/admin/verifications', auth, admin, async (_req, res) => {
    res.json((await db.execute(`SELECT v.*,p.nickname AS current_nickname,p.server AS current_server,
      p.power AS current_power,p.level AS current_level,d.note,d.reviewed_at,
      EXISTS(SELECT 1 FROM verification_images i WHERE i.request_id=v.request_id) AS has_image
      FROM verification_requests v LEFT JOIN profiles p ON p.user_id=v.user_id
      LEFT JOIN verification_decisions d ON d.request_id=v.request_id
      ORDER BY CASE WHEN v.status='pending' THEN 0 ELSE 1 END,v.requested_at DESC LIMIT 200`)).rows);
  });
  app.get('/api/admin/verifications/:id/image', auth, admin, async (req, res) => {
    const row = (await db.execute({ sql: "SELECT i.image,i.mime FROM verification_images i JOIN verification_requests v ON v.request_id=i.request_id WHERE i.request_id=? AND v.status='pending'", args: [req.params.id] })).rows[0];
    if (!row) throw failure(404, '첨부 이미지가 없거나 검토가 완료되었습니다.');
    res.set('Content-Type', row.mime).set('Content-Disposition', 'inline; filename="verification.webp"').send(Buffer.from(row.image));
  });
  app.post('/api/admin/verifications/:id/review', auth, admin, async (req, res) => {
    const note = text(req.body.note || '', 500, '검토 의견');
    if (!['approve', 'reject'].includes(req.body.decision)) throw failure(400, '검토 결과를 선택해 주세요.');
    if (req.body.decision === 'reject' && !note) throw failure(400, '반려 사유를 입력해 주세요.');
    const requestId = text(req.body.requestId, 64, '신청 식별자', 1);
    await reviewVerification(db, { userId: req.params.id, requestId, decision: req.body.decision, note, reviewerId: req.user.id });
    res.json({ ok: true });
  });
  app.get('/api/profiles/:id', async (req, res) => {
    const row = (await db.execute({ sql: 'SELECT * FROM profiles WHERE user_id=? AND public=1', args: [req.params.id] })).rows[0];
    if (!row) throw failure(404, '공개된 프로필이 없습니다.');
    res.json(profile(row));
  });
  app.put('/api/profile', auth, async (req, res) => {
    const b = req.body;
    if (!Array.isArray(b.dungeons) || b.dungeons.length > MAX_DUNGEONS || typeof b.public !== 'boolean') throw failure(400, '던전과 공개 설정을 확인해 주세요.');
    const args = [req.user.id, text(b.nickname, 24, '캐릭터명', 1), text(b.server, 24, '서버', 1), text(b.job, 24, '직업', 1), number(b.power, 999999999), number(b.level, 9999), text(b.intro, 1000, '소개'), text(b.availability, 100, '플레이 시간'), JSON.stringify([...new Set(b.dungeons.map(d => text(d, 120, '던전', 1)))]), Number(b.public)];
    // Verified values are server-controlled. Changes to character identity or stats clear prior verification.
    await db.execute({ sql: `INSERT INTO profiles(user_id,nickname,server,job,power,level,intro,availability,dungeons,public) VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET
      verified_power=CASE WHEN profiles.nickname=excluded.nickname AND profiles.server=excluded.server AND profiles.power=excluded.power THEN profiles.verified_power ELSE NULL END,
      verified_level=CASE WHEN profiles.nickname=excluded.nickname AND profiles.server=excluded.server AND profiles.level=excluded.level THEN profiles.verified_level ELSE NULL END,
      verified_at=CASE WHEN profiles.nickname=excluded.nickname AND profiles.server=excluded.server AND profiles.power=excluded.power AND profiles.level=excluded.level THEN profiles.verified_at ELSE NULL END,
      nickname=excluded.nickname,server=excluded.server,job=excluded.job,power=excluded.power,level=excluded.level,intro=excluded.intro,availability=excluded.availability,dungeons=excluded.dungeons,public=excluded.public,updated_at=CURRENT_TIMESTAMP`, args });
    res.json({ ok: true });
  });
  async function parties(where = '', args = []) {
    const rows = (await db.execute({ sql: `SELECT * FROM parties ${where} ORDER BY created_at DESC LIMIT 200`, args })).rows;
    const output = [];
    for (const row of rows) {
      const members = (await db.execute({ sql: 'SELECT p.* FROM party_members m JOIN profiles p ON p.user_id=m.user_id WHERE m.party_id=? AND p.public=1', args: [row.id] })).rows.map(profile);
      output.push({ id: row.id, ownerId: row.owner_id, title: row.title, dungeon: row.dungeon, schedule: row.schedule, roles: row.roles, description: row.description, contact: row.contact, status: row.status, createdAt: row.created_at, members });
    }
    return output;
  }
  app.get('/api/parties', async (_req, res) => res.json(await parties()));
  async function saveParty(req, res) {
    const b = req.body, id = req.params.id || randomUUID();
    if (!['open', 'closed'].includes(b.status) || !Array.isArray(b.members) || b.members.length > 20 || b.members.some(m => typeof m !== 'string' || m.length > 40)) throw failure(400, '파티 설정을 확인해 주세요.');
    const args = [text(b.title, 80, '제목', 2), text(b.dungeon, 120, '던전', 1), text(b.schedule, 100, '일정', 1), text(b.roles, 100, '모집 직업', 1), text(b.description, 3000, '소개'), text(b.contact, 150, '인게임 연락 방법', 1), b.status];
    const tx = await db.transaction('write');
    try {
      if (req.params.id) {
        const owned = (await tx.execute({ sql: 'SELECT id FROM parties WHERE id=? AND owner_id=?', args: [id, req.user.id] })).rows.length;
        if (!owned) throw failure(403, '본인의 모집글만 수정할 수 있습니다.');
      }
      for (const member of new Set(b.members)) {
        if (!(await tx.execute({ sql: 'SELECT user_id FROM profiles WHERE user_id=? AND public=1', args: [member] })).rows.length) throw failure(400, '공개된 프로필만 태그할 수 있습니다.');
      }
      if (req.params.id) await tx.execute({ sql: 'UPDATE parties SET title=?,dungeon=?,schedule=?,roles=?,description=?,contact=?,status=? WHERE id=?', args: [...args, id] });
      else await tx.execute({ sql: 'INSERT INTO parties(title,dungeon,schedule,roles,description,contact,status,id,owner_id) VALUES(?,?,?,?,?,?,?,?,?)', args: [...args, id, req.user.id] });
      await tx.execute({ sql: 'DELETE FROM party_members WHERE party_id=?', args: [id] });
      for (const member of new Set(b.members)) await tx.execute({ sql: 'INSERT INTO party_members(party_id,user_id) VALUES(?,?)', args: [id, member] });
      await tx.commit();
    } finally { tx.close(); }
    res.json({ id });
  }
  app.post('/api/parties', auth, saveParty);
  app.put('/api/parties/:id', auth, saveParty);
  app.delete('/api/parties/:id', auth, async (req, res) => {
    const result = await db.execute({ sql: 'DELETE FROM parties WHERE id=? AND owner_id=?', args: [req.params.id, req.user.id] });
    if (!result.rowsAffected) throw failure(403, '본인의 모집글만 삭제할 수 있습니다.');
    res.json({ ok: true });
  });
  app.delete('/api/parties/:id/tag', auth, async (req, res) => {
    await db.execute({ sql: 'DELETE FROM party_members WHERE party_id=? AND user_id=?', args: [req.params.id, req.user.id] }); res.json({ ok: true });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '요청을 찾을 수 없습니다.' }));
  app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
  app.use((err, _req, res, _next) => {
    if (err.name === 'MulterError') return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '이미지는 5MB 이하로 첨부해 주세요.' : '이미지 1장과 신스레벨·전투력을 입력해 주세요.' });
    const status = err.status || 500;
    if (status === 500) console.error('Request failed:', err.code || err.name);
    res.status(status).json({ error: status === 500 ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' : err.message });
  });
  return app;
}
