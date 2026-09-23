export function extractVerifiedChangeEvidence(diff = {}) {
  const rows = [];
  const seen = new Set();
  const deltaByMap = new Map();
  for (const item of Array.isArray(diff.map_delta_evidence) ? diff.map_delta_evidence : []) {
    const label=String(item.semantic_label||item.semanticLabel||'UNKNOWN');
    const mapOffset=Number(item.map_offset??item.mapOffset??0);
    if(label==='UNKNOWN'||!Boolean(item.human_verified??item.humanVerified))continue;
    deltaByMap.set([label,mapOffset].join(':'),{
      changedCells:Number(item.changed_cells??item.changedCells??0),
      measuredCells:Number(item.measured_cells??item.measuredCells??0),
      meanAbsPercent:Number(item.mean_abs_percent??item.meanAbsPercent??0),
      maxAbsPercent:Number(item.max_abs_percent??item.maxAbsPercent??0),
      p95AbsPercent:Number(item.p95_abs_percent??item.p95AbsPercent??0),
    });
  }
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
      const deltaStats=deltaByMap.get([row.semanticLabel,row.mapOffset].join(':'));
      if(deltaStats)row.deltaStats=deltaStats;
      const key = [row.rangeStart,row.rangeEnd,row.mapOffset,row.semanticLabel].join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  rows.sort((a,b)=>a.rangeStart-b.rangeStart||a.mapOffset-b.mapOffset||a.semanticLabel.localeCompare(b.semanticLabel));
  return rows;
}
