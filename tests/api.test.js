import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/db.js';
import { createApp } from '../server/app.js';

test('accounts, privacy, party ownership, recovery rotation and verification boundaries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asgard-test-'));
  const db = await openDatabase(`file:${join(dir, 'test.db')}`);
  const adminIds = [];
  const server = createApp(db, { authLimit: 100, adminIds }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function req(path, method = 'GET', body, token) {
    const r = await fetch(base + path, { method, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  const imageBytes = await readFile(new URL('../public/assets/jobs/prophet.png', import.meta.url));
  function upload(power = '81000', level = '100', bytes = imageBytes) {
    const data = new FormData(); data.append('power', power); data.append('level', level);
    data.append('image', new Blob([bytes], { type: 'image/png' }), 'proof.png'); return data;
  }
  try {
    const pass = 'a-long-password-123';
    const a = (await req('/auth/register', 'POST', { username: 'member_a', password: pass })).data;
    const b = (await req('/auth/register', 'POST', { username: 'member_b', password: pass })).data;
    assert.ok(a.token && a.recoveryCode && b.token);
    adminIds.push(b.user.id);
    const privateProfile = { nickname: '루어스', server: '테스트 서버', job: '바드', power: 80000, level: 99, intro: '<script>alert(1)</script>', availability: '21시', dungeons: ['멘트99', '케테르 · 거울성', '티아메트 · 87단계', '새 던전 · 1~5단계'], public: false, verifiedPower: 80000 };
    assert.equal((await req('/profile', 'PUT', privateProfile)).status, 401);
    assert.equal((await req('/profile', 'PUT', privateProfile, a.token)).status, 200);
    assert.deepEqual((await req('/me', 'GET', null, a.token)).data.profile.dungeons, privateProfile.dungeons);
    assert.equal((await req('/profile', 'PUT', { ...privateProfile, dungeons: [' '] }, a.token)).status, 400);
    assert.equal((await req('/profile', 'PUT', { ...privateProfile, dungeons: Array(21).fill('케테르') }, a.token)).status, 400);
    assert.deepEqual((await req('/profiles')).data, []);
    assert.equal((await req(`/profiles/${a.user.id}`)).status, 404);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.verifiedPower, null);
    const party = { title: '멘트 고정 파티', dungeon: '드제아트 · 95단계', schedule: '화 21시', roles: '바드 1명', description: '함께 해요', contact: '인게임 귓속말', status: 'open', members: [a.user.id] };
    assert.equal((await req('/parties', 'POST', party, b.token)).status, 400);
    await req('/profile', 'PUT', { ...privateProfile, public: true }, a.token);
    const created = await req('/parties', 'POST', party, b.token);
    assert.equal(created.status, 200);
    const id = created.data.id;
    assert.equal((await req('/parties')).data[0].dungeon, '드제아트 · 95단계');
    assert.equal((await req('/parties', 'POST', { ...party, dungeon: '' }, b.token)).status, 400);
    assert.equal((await req('/parties', 'POST', { ...party, dungeon: '던'.repeat(121) }, b.token)).status, 400);
    assert.equal((await req('/parties')).data[0].members[0].nickname, '루어스');
    assert.equal((await req(`/parties/${id}`, 'PUT', party, a.token)).status, 403);
    assert.equal((await req(`/parties/${id}`, 'DELETE', null, a.token)).status, 403);
    await req('/profile', 'PUT', privateProfile, a.token);
    assert.deepEqual((await req('/parties')).data[0].members, []);
    await req('/profile', 'PUT', { ...privateProfile, public: true }, a.token);
    assert.equal((await req(`/parties/${id}/tag`, 'DELETE', null, a.token)).status, 200);
    assert.deepEqual((await req('/parties')).data[0].members, []);
    assert.equal((await req('/verification', 'POST', { evidence: 'javascript:alert(1)' }, a.token)).status, 400);
    assert.equal((await req('/verification', 'POST', upload(), a.token)).status, 200);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.verifiedPower, null);
    assert.equal((await req('/admin/verifications')).status, 401);
    assert.equal((await req('/admin/verifications', 'GET', null, a.token)).status, 403);
    const pending = (await req('/admin/verifications', 'GET', null, b.token)).data[0];
    assert.equal(pending.power, 81000); assert.equal(pending.level, 100);
    assert.equal(pending.profile_power, 80000); assert.equal(pending.has_image, 1);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.power, 80000);
    const imageUrl = `${base}/admin/verifications/${pending.request_id}/image`;
    assert.equal((await fetch(imageUrl)).status, 401);
    assert.equal((await fetch(imageUrl, { headers: { Authorization: `Bearer ${a.token}` } })).status, 403);
    const imageResponse = await fetch(imageUrl, { headers: { Authorization: `Bearer ${b.token}` } });
    assert.equal(imageResponse.status, 200); assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
    assert.equal(Buffer.from(await imageResponse.arrayBuffer()).subarray(0, 4).toString(), 'RIFF');
    assert.equal((await req('/verification', 'POST', upload('-1'), a.token)).status, 400);
    assert.equal((await req('/verification', 'POST', upload('1', '1.5'), a.token)).status, 400);
    assert.equal((await req('/verification', 'POST', upload('1', '1', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), a.token)).status, 400);
    assert.equal((await req('/verification', 'POST', upload('1', '1', Buffer.alloc(5 * 1024 * 1024 + 1)), a.token)).status, 413);
    assert.equal((await req('/admin/verifications', 'GET', null, b.token)).data[0].request_id, pending.request_id);
    const reviewPath = `/admin/verifications/${a.user.id}/review`;
    assert.equal((await req(reviewPath, 'POST', { requestId: pending.request_id, decision: 'approve' }, a.token)).status, 403);
    assert.equal((await req(reviewPath, 'POST', { requestId: pending.request_id, decision: 'approve' }, b.token)).status, 200);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.verifiedPower, 81000);
    assert.equal((await req('/admin/verifications', 'GET', null, b.token)).data[0].evidence, '');
    assert.equal((await fetch(imageUrl, { headers: { Authorization: `Bearer ${b.token}` } })).status, 404);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.level, 100);
    assert.equal((await req(reviewPath, 'POST', { requestId: pending.request_id, decision: 'approve' }, b.token)).status, 409);
    await req('/verification', 'POST', upload('82000', '101'), a.token);
    assert.equal((await req(reviewPath, 'POST', { requestId: pending.request_id, decision: 'approve' }, b.token)).status, 409);
    const nextRequest = (await req('/admin/verifications', 'GET', null, b.token)).data[0];
    await req('/profile', 'PUT', { ...privateProfile, power: 80001 }, a.token);
    assert.equal((await req(reviewPath, 'POST', { requestId: nextRequest.request_id, decision: 'approve' }, b.token)).status, 409);
    assert.equal((await req(reviewPath, 'POST', { requestId: nextRequest.request_id, decision: 'reject' }, b.token)).status, 400);
    assert.equal((await req(reviewPath, 'POST', { requestId: nextRequest.request_id, decision: 'reject', note: '능력치가 변경되어 재신청 필요' }, b.token)).status, 200);
    await db.execute({ sql: 'UPDATE profiles SET verified_power=power,verified_level=level,verified_at=CURRENT_TIMESTAMP WHERE user_id=?', args: [a.user.id] });
    await req('/profile', 'PUT', { ...privateProfile, public: true, power: 90000 }, a.token);
    assert.equal((await req('/me', 'GET', null, a.token)).data.profile.verifiedPower, null);
    const reset = await req('/auth/recover', 'POST', { username: 'member_a', recoveryCode: a.recoveryCode, password: 'new-long-password-456' });
    assert.equal(reset.status, 200);
    assert.notEqual(reset.data.recoveryCode, a.recoveryCode);
    assert.equal((await req('/me', 'GET', null, a.token)).status, 401);
    assert.equal((await req('/auth/recover', 'POST', { username: 'member_a', recoveryCode: a.recoveryCode, password: pass })).status, 400);
    assert.equal((await req('/auth/login', 'POST', { username: 'member_a', password: pass })).status, 401);
    assert.equal((await req('/auth/login', 'POST', { username: 'MEMBER_A', password: 'new-long-password-456' })).status, 200);
    assert.equal((await req(`/parties/${id}`, 'PUT', { ...party, members: [], status: 'closed' }, b.token)).status, 200);
    assert.equal((await req('/parties')).data[0].status, 'closed');
    assert.equal((await req(`/parties/${id}`, 'DELETE', null, b.token)).status, 200);
    const stored = (await db.execute('SELECT password,recovery FROM users')).rows;
    assert.ok(stored.every(r => ![pass, a.recoveryCode, b.recoveryCode].includes(r.password) && ![a.recoveryCode, b.recoveryCode].includes(r.recovery)));
    const cors = await fetch(base + '/health', { headers: { Origin: 'https://attacker.example' } });
    assert.equal(cors.status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close(); await rm(dir, { recursive: true, force: true });
  }
});

test('authentication endpoints limit attempts', async () => {
  const db = await openDatabase('file::memory:');
  const server = createApp(db, { authLimit: 2 }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
    for (let i = 0; i < 2; i++) await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
