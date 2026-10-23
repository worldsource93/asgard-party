import React, { useEffect, useState } from 'react';
import EvidenceViewer from './EvidenceViewer.jsx';
const statusLabels = { pending: '검토 대기', approved: '승인 완료', rejected: '반려' };
export default function VerificationReview({ api, fetchImage, onReviewed }) {
  const [rows, setRows] = useState([]), [selectedId, setSelectedId] = useState(null), [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false);
  async function load() {
    setLoading(true); setError('');
    try { setRows(await api('/admin/verifications')); } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const filtered = rows.filter(row => filter === 'all' || row.status === filter);
  const selected = filtered.find(row => row.request_id === selectedId) || filtered[0];
  useEffect(() => { setNote(''); setConfirmed(false); }, [selected?.request_id]);
  const changed = selected && (selected.nickname !== selected.current_nickname || selected.server !== selected.current_server || (selected.profile_power ?? selected.power) !== selected.current_power || (selected.profile_level ?? selected.level) !== selected.current_level);
  async function review(decision) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await api(`/admin/verifications/${selected.user_id}/review`, 'POST', { requestId: selected.request_id, decision, note });
      await load(); onReviewed();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <div className="review-console"><div className="review-toolbar"><p>제출된 이미지와 신청 당시 능력치를 대조해 주세요.</p><button className="outline" onClick={load} disabled={busy || loading}>새로고침</button></div><div className="chips review-filters">{[['pending', '검토 대기'], ['approved', '승인 완료'], ['rejected', '반려'], ['all', '전체']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => { setFilter(value); setSelectedId(null); }}>{label} {value === 'all' ? rows.length : rows.filter(r => r.status === value).length}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="review-empty">인증 신청을 불러오는 중…</p> : !selected ? <div className="review-empty"><h3>검토할 신청이 없습니다</h3><p>모험가가 프로필에서 인증 자료를 제출하면 이곳에 표시됩니다.</p></div> : <div className="review-layout"><aside className="review-list" aria-label="인증 신청 목록">{filtered.map(row => <button key={row.request_id} className={selected.request_id === row.request_id ? 'review-item selected' : 'review-item'} onClick={() => setSelectedId(row.request_id)}><strong>{row.nickname}</strong><span>{row.server} · {statusLabels[row.status]}</span><small>{new Date(`${row.requested_at.replace(' ', 'T')}Z`).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</small></button>)}</aside><section className="review-detail"><div className="review-summary"><div><h3>{selected.nickname}</h3><p>{selected.server} · {statusLabels[selected.status]}</p></div><div className="badges"><span className="badge stat-badge">신스 {selected.level}레벨</span><span className="badge stat-badge">전투력 {Number(selected.power).toLocaleString('ko-KR')}</span></div></div>{changed && selected.status === 'pending' && <p className="form-error">신청 이후 프로필이 변경되었습니다. 승인할 수 없으며 재신청을 안내해 주세요.</p>}<EvidenceViewer key={selected.request_id + selected.status} row={selected} fetchImage={fetchImage}/>{selected.status === 'pending' && <p className="muted">신청값: 신스 {selected.level}레벨 · 전투력 {Number(selected.power).toLocaleString('ko-KR')}<br/>현재 프로필: 신스 {selected.current_level}레벨 · 전투력 {Number(selected.current_power).toLocaleString('ko-KR')}<br/>승인하면 신청값을 프로필에 반영합니다.</p>}{selected.status === 'pending' ? <><label className="field"><span>검토 의견 · 반려 시 필수</span><textarea maxLength={500} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="캐릭터명·서버가 보이지 않습니다. 전체 화면으로 다시 제출해 주세요."/></label><label className="check review-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/> 이미지의 캐릭터명·서버·신스레벨·전투력이 신청 정보와 일치함을 확인했습니다.</label><div className="review-actions"><button className="danger" disabled={busy || !note.trim()} onClick={() => review('reject')}>반려하기</button><button className="primary" disabled={busy || !confirmed || changed} onClick={() => review('approve')}>{busy ? '처리 중…' : '승인하고 인증 뱃지 부여'}</button></div></> : <div className="callout"><strong>검토 결과</strong><p>{selected.note || '검토 의견 없음'}</p></div>}</section></div>}</div>;
}
