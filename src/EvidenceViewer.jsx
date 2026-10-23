import React, { useEffect, useState } from 'react';
export default function EvidenceViewer({ row, fetchImage }) {
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false, objectUrl;
    if (!row.has_image) { setUrl(row.evidence || ''); return; }
    fetchImage(`/admin/verifications/${row.request_id}/image`).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [row.request_id, row.has_image, row.evidence, fetchImage]);
  return <><div className="evidence-viewer">{error ? <p role="alert">{error}</p> : url ? <img src={url} alt={`${row.nickname} 캐릭터 능력치 인증 제출 이미지`} referrerPolicy="no-referrer" onError={() => setError('이미지를 불러올 수 없습니다. 새로고침하거나 이미지를 다시 첨부하도록 안내해 주세요.')}/> : <p>{row.has_image ? '첨부 이미지를 불러오는 중…' : row.status === 'pending' ? '첨부된 이미지가 없습니다.' : '검토가 완료되어 첨부 이미지가 삭제되었습니다.'}</p>}</div>{url && !error && <a className="evidence-original" href={url} target="_blank" rel="noopener noreferrer">이미지 크게 보기 ↗</a>}</>;
}
