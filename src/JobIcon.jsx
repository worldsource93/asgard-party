import React, { useState } from 'react';
// Official Asgard website job portraits; representative artwork, not character appearance.
const icons = {
  전사: 'warrior', 도적: 'rogue', 무도가: 'monk', 기사: 'knight', 아수라: 'asuras',
  마법사: 'wizard', 성직자: 'priest', 바드: 'bard', 프로핏: 'prophet', 야차: 'yacha',
};
export const JOBS = Object.keys(icons);
export default function JobIcon({ job }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const src = icons[job] ? `${import.meta.env.BASE_URL}assets/jobs/${icons[job]}.png` : null;
  return <div className="avatar job-avatar">{src && failedSrc !== src
    ? <img src={src} alt={`${job} 직업 아이콘`} width="30" height="30" onError={() => setFailedSrc(src)}/>
    : <span aria-label={`${job || '알 수 없는'} 직업`}>{job?.slice(0, 1) || '?'}</span>}</div>;
}
