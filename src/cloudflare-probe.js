export default { fetch() { return new Response(JSON.stringify({ ok: true, probe: 'jarvis' }), { headers: { 'content-type': 'application/json' } }); } };
