import React, { useEffect, useState } from 'react';
export default function VerificationForm({ profile, api, onSubmitted }) {
  const [power, setPower] = useState(String(profile?.power ?? ''));
  const [level, setLevel] = useState(String(profile?.level ?? ''));
  const [file, setFile] = useState(null), [preview, setPreview] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function selectFile(e) {
    const selected = e.target.files?.[0]; setError(''); setFile(null);
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) { setError('이미지는 5MB 이하로 첨부해 주세요.'); e.target.value = ''; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError('JPG·PNG·WebP 이미지 파일을 선택해 주세요.'); e.target.value = ''; return; }
    setFile(selected);
  }
  async function submit(e) {
    e.preventDefault(); if (busy) return; setError('');
    if (!file) { setError('인증 이미지를 첨부해 주세요.'); return; }
    const data = new FormData(); data.append('power', power); data.append('level', level); data.append('image', file);
    setBusy(true);
    try { await api('/verification', 'POST', data); onSubmitted(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}><p className="muted">{profile?.nickname} · {profile?.server}의 인증할 수치를 입력하고, 캐릭터명·서버·능력치가 보이는 게임 화면을 첨부해 주세요.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-grid"><label className="field"><span>인증할 신스레벨</span><input type="number" required min="0" max="9999" step="1" value={level} onChange={e => setLevel(e.target.value)}/></label><label className="field"><span>인증할 전투력</span><input type="number" required min="0" max="999999999" step="1" value={power} onChange={e => setPower(e.target.value)}/></label></div><label className="field upload-field"><span>인증 이미지 첨부</span><input type="file" required accept="image/jpeg,image/png,image/webp" onChange={selectFile} aria-describedby="upload-help"/></label><p id="upload-help" className="muted">JPG·PNG·WebP 파일 1장, 최대 5MB. 개인정보가 보이지 않는 화면을 첨부해 주세요.</p>{preview && <div className="upload-preview"><img src={preview} alt="첨부할 인증 이미지 미리보기"/><p>{file.name} · {(file.size / 1024).toFixed(0)}KB</p></div>}<p className="callout">운영자가 이미지와 입력값을 확인한 후 승인하면, 입력한 신스레벨·전투력이 프로필에 반영되고 인증 뱃지가 표시됩니다. 첨부 이미지는 운영자만 조회하며 검토 완료 후 삭제됩니다.</p><button className="primary full" disabled={busy || !file}>{busy ? '이미지 전송 중…' : '이미지 첨부하여 인증 신청'}</button></form>;
}
