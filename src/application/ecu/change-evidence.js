export function extractVerifiedChangeEvidence(diff = {}) {
  const rows = [];
  const seen = new Set();
  for (const range of Array.isArray(diff.linked_ranges) ? diff.linked_ranges : []) {
    for (const hit of Array.isArray(range.map_hits) ? range.map_hits : []) {
      const label = String(hit.semantic_label || hit.semanticLabel || 'UNKNOWN');
      const verified = Boolean(hit.human_verified ?? hit.humanVerified);
      const overlapBytes = Math.max(0, Number(hit.overlap_bytes ?? hit.overlapBytes ?? 0));
      if (!verified || label === 'UNKNOWN' || overlapBytes <= 0) continue;
      const row = {
        rangeStart: Number(range.start || 0),
        rangeEnd: Number(range.end || 0),
        mapOffset: Number(hit.offset || 0),
        semanticLabel: label,
        confidence: Math.max(0, Math.min(1, Number(hit.semantic_confidence ?? hit.confidence ?? 0))),
        overlapBytes,
      };
      const key = [row.rangeStart,row.rangeEnd,row.mapOffset,row.semanticLabel].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  rows.sort((a,b)=>a.rangeStart-b.rangeStart||a.mapOffset-b.mapOffset||a.semanticLabel.localeCompare(b.semanticLabel));
  return rows;
}
