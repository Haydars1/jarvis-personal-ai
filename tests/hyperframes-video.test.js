import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHyperframesProject, normalizeHyperframesBrief } from '../src/application/video/hyperframes-project.js';
import { hyperframesCommand } from '../local-bridge/hyperframes-bridge.mjs';

test('HyperFrames creates a valid deterministic 9:16 starter with seekable timeline', () => {
  const p = buildHyperframesProject({ title: 'Stage 1', duration: 8 });
  assert.equal(p.rendered, false);
  assert.equal(p.filename, 'index.html');
  assert.match(p.html, /data-composition-id="main"/);
  assert.match(p.html, /data-width="1080" data-height="1920"/);
  assert.match(p.html, /data-duration="8"/);
  assert.match(p.html, /gsap\.timeline\(\{paused:true\}\)/);
  assert.match(p.html, /window\.__timelines\.main=tl/);
  assert.equal(p.html, buildHyperframesProject({ title: 'Stage 1', duration: 8 }).html);
});
test('landscape and escaped user text never become executable HTML', () => {
  const p = buildHyperframesProject({
    format:'landscape',
    title:'<script>alert("x")</script>',
    subtitle:'a & b',
    brand:'SIX < ZERO',
    duration:12
  });
  assert.match(p.html,/data-width="1920" data-height="1080"/);
  assert.ok(!p.html.includes('<script>alert("x")</script>'));
  assert.match(p.html,/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(p.html,/a &amp; b/);
  assert.match(p.html,/SIX &lt; ZERO/);
});
test('strict request bounds reject invalid inputs', () => {
  assert.throws(() => normalizeHyperframesBrief({format:'4k'}),/HYPERFRAMES_INVALID_FORMAT/);
  assert.throws(() => normalizeHyperframesBrief({duration:120}),/HYPERFRAMES_INVALID_DURATION/);
  assert.throws(() => normalizeHyperframesBrief({duration:0}),/HYPERFRAMES_INVALID_DURATION/);
  assert.throws(() => normalizeHyperframesBrief({title:'x'.repeat(121)}),/HYPERFRAMES_TEXT_TOO_LONG/);
  assert.throws(() => normalizeHyperframesBrief([]),/HYPERFRAMES_INVALID_BRIEF/);
});
test('CLI actions are allowlisted and never auto-install packages', () => {
  assert.deepEqual(hyperframesCommand('render','win32'),{
    command:'npx.cmd',args:['--no-install','hyperframes','render','--output','final.mp4']
  });
  assert.deepEqual(hyperframesCommand('lint','linux'),{
    command:'npx',args:['--no-install','hyperframes','lint']
  });
  assert.throws(() => hyperframesCommand('install'),/HYPERFRAMES_INVALID_ACTION/);
  assert.throws(() => hyperframesCommand('&& rm -rf /'),/HYPERFRAMES_INVALID_ACTION/);
});
