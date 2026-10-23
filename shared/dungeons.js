export const DUNGEON_SUGGESTIONS = ['케테르', '멘트', '티아메트', '티크마', '델크레비스', '거울성', '드제아트'];
export const MAX_DUNGEONS = 20;
export function parseDungeon(value = '') {
  const parts = value.split(' · ');
  let name = parts.shift() || '', area = '', stage = '';
  const legacy = name.match(/^(멘트|티크마|티아메트)\s*(\d+)(?:단계)?$/);
  if (legacy) { name = legacy[1]; stage = legacy[2]; }
  for (const part of parts) {
    if (part.endsWith('단계')) stage = part.slice(0, -2);
    else area = area ? `${area} · ${part}` : part;
  }
  return { name, area, stage };
}
export function dungeonLabel({ name = '', area = '', stage = '' }) {
  return [name.trim(), area.trim(), stage.trim() ? `${stage.trim().replace(/단계$/, '').trim()}단계` : ''].filter(Boolean).join(' · ');
}
export function dungeonName(value) { return parseDungeon(value).name.trim(); }
