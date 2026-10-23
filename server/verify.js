import { openDatabase } from './db.js';
import { reviewVerification } from './verification.js';
const db = await openDatabase();
const [command = 'list', id, note = '운영자 CLI 검토'] = process.argv.slice(2);
try {
  if (command === 'list') console.table((await db.execute("SELECT * FROM verification_requests WHERE status='pending'")).rows);
  else if (['approve', 'reject'].includes(command) && id) {
    const row = (await db.execute({ sql: "SELECT request_id FROM verification_requests WHERE user_id=? AND status='pending'", args: [id] })).rows[0];
    if (!row) throw new Error('대기 중인 인증 신청이 없습니다.');
    await reviewVerification(db, { userId: id, requestId: row.request_id, decision: command, note, reviewerId: 'operator-cli' });
    console.log(command === 'approve' ? '인증을 승인했습니다.' : '인증을 반려했습니다.');
  } else throw new Error('사용법: npm run verify -- list | approve USER_ID | reject USER_ID 사유');
} finally { db.close(); }
