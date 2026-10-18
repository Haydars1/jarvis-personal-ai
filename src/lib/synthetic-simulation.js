// Deterministic synthetic scenario simulation. Not a substitute for real users.
function hash(value) {
  let h = 2166136261;
  for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function simulateAudience({ idea, personas, rounds = 3, seed = 'jarvis' } = {}) {
  if (typeof idea !== 'string' || !idea.trim() || idea.length > 2000) throw new Error('idea must be 1-2000 characters');
  if (!Array.isArray(personas) || personas.length < 1 || personas.length > 100) throw new Error('personas must contain 1-100 entries');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) throw new Error('rounds must be 1-20');
  const people = personas.map((p, i) => {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100) throw new Error('invalid persona name');
    const skepticism = p.skepticism ?? 0.5;
    if (typeof skepticism !== 'number' || !Number.isFinite(skepticism) || skepticism < 0 || skepticism > 1) throw new Error('skepticism must be between 0 and 1');
    return { id: i, name: p.name, skepticism };
  });
  const history = [];
  let adopted = new Set();
  for (let round = 1; round <= rounds; round++) {
    const decisions = people.map(p => {
      const socialProof = adopted.size / people.length;
      const noise = (hash([seed, idea, round, p.id].join('|')) % 10000) / 10000;
      const score = 0.45 * (1 - p.skepticism) + 0.35 * socialProof + 0.2 * noise;
      const accepts = adopted.has(p.id) || score >= 0.43;
      return { persona: p.name, accepts, score: Number(score.toFixed(4)), rationale: accepts ? 'Synthetic interest exceeds threshold' : 'Synthetic interest below threshold' };
    });
    adopted = new Set(decisions.flatMap((d, i) => d.accepts ? [i] : []));
    history.push({ round, adoption: adopted.size, total: people.length, decisions });
  }
  return { kind: 'synthetic_simulation', disclaimer: 'Generated hypothetical behavior; not real customer data or predictive evidence.', idea, seed, history };
}
