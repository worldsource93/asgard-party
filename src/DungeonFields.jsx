import React, { useId } from 'react';
import { DUNGEON_SUGGESTIONS, dungeonLabel } from '../shared/dungeons.js';
export default function DungeonFields({ value, onChange, onRemove, index }) {
  const id = useId();
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <div className="dungeon-entry"><div className="dungeon-entry-fields"><label><span>던전 이름</span><input required maxLength={40} list={`${id}-names`} value={value.name} onChange={e => update('name', e.target.value)} placeholder="선택하거나 직접 입력"/><datalist id={`${id}-names`}>{DUNGEON_SUGGESTIONS.map(name => <option value={name} key={name}/>)}</datalist></label><label><span>상세 지역 <small>선택</small></span><input maxLength={40} value={value.area} onChange={e => update('area', e.target.value)} placeholder="델크레비스, 거울성 등"/></label><label><span>단계 <small>선택</small></span><input maxLength={16} value={value.stage} onChange={e => update('stage', e.target.value)} placeholder="예: 91 또는 91~99"/></label></div><div className="dungeon-entry-footer"><span className="badge">{value.name.trim() ? dungeonLabel(value) : '던전 이름을 입력해 주세요'}</span>{onRemove && <button type="button" className="dungeon-remove" aria-label={`${index + 1}번째 던전 삭제`} onClick={onRemove}>삭제 ×</button>}</div></div>;
}
