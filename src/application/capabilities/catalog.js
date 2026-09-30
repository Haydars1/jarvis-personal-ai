import registry from '../../../data/capability-registry.json' with { type: 'json' };

function values(value) {
  return Array.isArray(value) ? value.map(item => String(item)) : [];
}

export function capabilityCatalog(filters = {}) {
  const category = String(filters.category || '').trim();
  const status = String(filters.status || '').trim();
  const repo = String(filters.repo || '').trim().toLowerCase();
  return (Array.isArray(registry?.entries) ? registry.entries : [])
    .filter(entry => !category || values(entry.categories?.length ? entry.categories : [entry.category]).includes(category))
    .filter(entry => !status || String(entry.status) === status)
    .filter(entry => !repo || String(entry.repo || '').toLowerCase() === repo)
    .map(entry => ({ ...entry, categories: values(entry.categories), executionTargets: values(entry.executionTargets), topics: values(entry.topics) }));
}

export function capabilityCatalogSummary() {
  const entries = capabilityCatalog();
  const result = { total: entries.length, accepted: 0, quarantine: 0, externalOnly: 0, rejected: 0 };
  for (const entry of entries) {
    if (entry.status === 'accepted') result.accepted += 1;
    else if (entry.status === 'quarantine') result.quarantine += 1;
    else if (entry.status === 'external-only') result.externalOnly += 1;
    else if (entry.status === 'rejected') result.rejected += 1;
  }
  return result;
}
