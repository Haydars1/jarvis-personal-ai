import test from 'node:test';
import assert from 'node:assert/strict';
import { createEcuResearch } from '../src/application/ecu/research.js';

function memoryRepository() {
  const buckets = new Set();
  const sources = [];
  const claims = [];
  const runs = [];
  return {
    sources,
    claims,
    runs,
    async claimRunBucket(_env, bucket) {
      if (buckets.has(bucket)) return false;
      buckets.add(bucket);
      runs.push({ bucket, status: 'RUNNING' });
      return true;
    },
    async storeSource(_env, source) { sources.push(source); },
    async storeClaim(_env, claim) { claims.push(claim); },
    async finishRun(_env, bucket, summary) {
      const run = runs.find(item => item.bucket === bucket);
      Object.assign(run, { status: 'COMPLETE', ...summary });
    },
  };
}

test('scheduled research stores provenance as unverified knowledge and deduplicates URLs', async () => {
  const repository = memoryRepository();
  const research = createEcuResearch({
    repository,
    topics: ['EDC17C46 torque map'],
    search: async () => [
      { title: 'Doc A', url: 'https://example.com/a', snippet: 'Torque calibration example', source: 'Google' },
      { title: 'Doc A duplicate', url: 'https://example.com/a', snippet: 'same URL', source: 'Google' },
      { title: 'Doc B', url: 'https://example.com/b', snippet: 'Boost calibration overview', source: 'Google' },
    ],
  });

  const result = await research.run({}, 1_800_000);

  assert.equal(result.skipped, false);
  assert.equal(repository.sources.length, 2);
  assert.equal(repository.claims.length, 2);
  assert.ok(repository.sources.every(item => item.verified === false));
  assert.ok(repository.claims.every(item => item.verificationState === 'UNVERIFIED'));
  assert.ok(repository.claims.every(item => item.sourceUrl.startsWith('https://example.com/')));
});

test('same research time bucket is idempotent', async () => {
  const repository = memoryRepository();
  let searches = 0;
  const research = createEcuResearch({
    repository,
    topics: ['EDC17C46'],
    search: async () => { searches += 1; return []; },
  });

  const first = await research.run({}, 7_200_000);
  const second = await research.run({}, 7_200_001);

  assert.equal(first.skipped, false);
  assert.equal(second.skipped, true);
  assert.equal(searches, 1);
});

test('research never requires a paid language model', async () => {
  const repository = memoryRepository();
  const research = createEcuResearch({ repository, topics: [], search: async () => [] });
  const status = await research.status({});

  assert.equal(status.paidApiRequired, false);
  assert.equal(status.mode, 'continuous-research');
});


test('corroborates similar claims from distinct sources without marking them verified', async () => {
  const repository=memoryRepository();
  repository.listClaims=async()=>[
    {id:'c1',sourceUrl:'https://a.example/doc',topic:'torque',text:'EDC17 torque limiter uses RPM and requested torque axes',verificationState:'UNVERIFIED'},
    {id:'c2',sourceUrl:'https://b.example/doc',topic:'torque',text:'EDC17 torque limiter uses requested torque and RPM axes',verificationState:'UNVERIFIED'},
    {id:'c3',sourceUrl:'https://c.example/doc',topic:'boost',text:'Unrelated compressor efficiency text',verificationState:'UNVERIFIED'},
  ];
  const patches=[];
  repository.markClaimState=async(_env,id,state)=>patches.push([id,state]);

  const research=createEcuResearch({repository,topics:[],search:async()=>[]});
  const result=await research.corroborate({});

  assert.equal(result.corroborated,2);
  assert.deepEqual(patches.sort(),[['c1','CORROBORATED'],['c2','CORROBORATED']]);
  assert.ok(patches.every(([,state])=>state!=='VERIFIED'));
});

test('does not corroborate claims from the same source URL alone', async () => {
  const repository=memoryRepository();
  repository.listClaims=async()=>[
    {id:'c1',sourceUrl:'https://same.example/doc',topic:'torque',text:'torque limiter rpm requested torque axes',verificationState:'UNVERIFIED'},
    {id:'c2',sourceUrl:'https://same.example/doc',topic:'torque',text:'requested torque rpm torque limiter axes',verificationState:'UNVERIFIED'},
  ];
  const patches=[];
  repository.markClaimState=async(_env,id,state)=>patches.push([id,state]);
  const research=createEcuResearch({repository,topics:[],search:async()=>[]});
  const result=await research.corroborate({});
  assert.equal(result.corroborated,0);
  assert.equal(patches.length,0);
});


test('research enriches search results with bounded fetched source text', async () => {
  const repository=memoryRepository();
  const research=createEcuResearch({
    repository,
    topics:['MED17 checksum'],
    search:async()=>[
      {title:'Technical page',url:'https://docs.example/checksum',snippet:'Short checksum summary',source:'Google'},
    ],
    fetchSource:async()=>({
      text:'MED17 checksum blocks use a structured calibration integrity process. '.repeat(40),
      contentType:'text/html',
    }),
    maxEnrichedSourcesPerTopic:1,
  });
  const result=await research.run({},10_800_000);
  assert.equal(result.skipped,false);
  assert.ok(repository.claims.length>1);
  assert.ok(repository.claims.some(item=>item.text.length>500));
  assert.ok(repository.claims.every(item=>item.verificationState==='UNVERIFIED'));
});


test('scheduled research ingests GitHub implementation sources with code provenance', async () => {
  const repository=memoryRepository();
  const research=createEcuResearch({
    repository,
    topics:[],
    search:async()=>[],
    githubDiscover:async()=>[
      {
        title:'openremap-core: README.md',
        url:'https://github.com/v-arapidis/openremap-core/blob/main/README.md',
        snippet:'Repository: v-arapidis/openremap-core | License: mit | Reuse policy: ADAPT_WITH_ATTRIBUTION\n\nIdentify health cook tune map discovery checksum recipe workflow.',
        source:'GitHub',
        sourceKind:'code',
        trustScore:0.9,
      },
      {
        title:'ZedSuite: README.md',
        url:'https://github.com/LeZed97/ZedSuite/blob/master/README.md',
        snippet:'Repository: LeZed97/ZedSuite | License: gpl-3.0 | Reuse policy: ARCHITECTURE_ONLY\n\nEDC15 EDC16 map detection DTC checksum architecture.',
        source:'GitHub',
        sourceKind:'code',
        trustScore:0.82,
      },
    ],
  });
  const result=await research.run({},21_600_000);
  assert.equal(result.skipped,false);
  assert.equal(repository.sources.length,2);
  assert.ok(repository.sources.every(item=>item.sourceKind==='code'));
  assert.ok(repository.sources.some(item=>item.trustScore===0.9));
  assert.ok(repository.claims.some(item=>item.topic==='github-ecu-source-code'));
  assert.ok(repository.claims.some(item=>/ADAPT_WITH_ATTRIBUTION/.test(item.text)));
  assert.ok(repository.claims.some(item=>/ARCHITECTURE_ONLY/.test(item.text)));
});


test('does not treat two files from the same GitHub repository as independent corroboration', async () => {
  const repository=memoryRepository();
  repository.listClaims=async()=>[
    {
      id:'g1',
      sourceUrl:'https://github.com/example/ecu-tool/blob/main/README.md',
      topic:'github-ecu-source-code',
      text:'EDC17 checksum correction uses CRC32 over calibration blocks',
      verificationState:'UNVERIFIED',
      trustScore:0.9,
    },
    {
      id:'g2',
      sourceUrl:'https://github.com/example/ecu-tool/blob/main/src/checksum.py',
      topic:'github-ecu-source-code',
      text:'EDC17 checksum correction uses CRC32 over calibration block regions',
      verificationState:'UNVERIFIED',
      trustScore:0.9,
    },
  ];
  const patches=[];
  repository.markClaimState=async(_env,id,state)=>patches.push([id,state]);
  const research=createEcuResearch({repository,topics:[],search:async()=>[],githubDiscover:null});
  const result=await research.corroborate({});
  assert.equal(result.corroborated,0);
  assert.deepEqual(patches,[]);
});


test('GitHub repository metadata is persisted alongside code claims', async () => {
  const repository=memoryRepository();
  const repos=[];
  repository.storeGitHubRepository=async(_env,meta)=>repos.push(meta);
  const research=createEcuResearch({
    repository,
    topics:[],
    search:async()=>[],
    githubDiscover:async()=>[
      {
        title:'openremap-core: patcher.py',
        url:'https://github.com/v-arapidis/openremap-core/blob/main/openremap/core/services/recipes/patcher.py',
        snippet:'context_before context_after patch recipe checksum',
        source:'GitHub',
        sourceKind:'code',
        trustScore:0.9,
        github:{
          repository:'v-arapidis/openremap-core',
          path:'openremap/core/services/recipes/patcher.py',
          license:'mit',
          reuse:'ADAPT_WITH_ATTRIBUTION',
          stars:123,
          capabilities:['PATCH_RECIPE','ORI_MOD_DIFF','CHECKSUM'],
          defaultBranch:'main',
        },
      },
    ],
  });
  await research.run({},32_400_000);
  assert.equal(repos.length,1);
  assert.equal(repos[0].repository,'v-arapidis/openremap-core');
  assert.equal(repos[0].reuse,'ADAPT_WITH_ATTRIBUTION');
  assert.ok(repos[0].capabilities.includes('PATCH_RECIPE'));
});
