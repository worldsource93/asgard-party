export async function reviewVerification(db, { userId, requestId, decision, note = '', reviewerId }) {
  const tx = await db.transaction('write');
  const fail = (message) => Object.assign(new Error(message), { status: 409 });
  try {
    const row = (await tx.execute({ sql: "SELECT * FROM verification_requests WHERE user_id=? AND request_id=? AND status='pending'", args: [userId, requestId] })).rows[0];
    if (!row) throw fail('이미 처리되었거나 새 신청으로 변경되었습니다. 목록을 새로고침해 주세요.');
    if (decision === 'approve') {
      const result = await tx.execute({ sql: 'UPDATE profiles SET power=?,level=?,verified_power=?,verified_level=?,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND nickname=? AND server=? AND power=? AND level=?', args: [row.power, row.level, row.power, row.level, userId, row.nickname, row.server, row.profile_power ?? row.power, row.profile_level ?? row.level] });
      if (!result.rowsAffected) throw fail('신청 이후 프로필이 변경되었습니다. 최신 정보로 다시 신청해야 합니다.');
    }
    await tx.execute({ sql: 'UPDATE verification_requests SET status=?,evidence=? WHERE user_id=? AND request_id=?', args: [decision === 'approve' ? 'approved' : 'rejected', '', userId, requestId] });
    await tx.execute({ sql: 'DELETE FROM verification_images WHERE request_id=?', args: [requestId] });
    await tx.execute({ sql: 'INSERT INTO verification_decisions(request_id,user_id,decision,note,reviewer_id) VALUES(?,?,?,?,?)', args: [requestId, userId, decision, note, reviewerId] });
    await tx.commit();
  } finally { tx.close(); }
}
