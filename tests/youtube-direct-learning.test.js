import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildYouTubeInsightRequest, parseYouTubeInsightResponse, canonicalYouTubeVideoUrl } from '../src/lib/youtube-insight.js';
import { encryptCredential } from '../src/lib/runtime.js';
import { analyzeYouTubeDirect } from '../src/application/capabilities/youtube-learning.js';

const fixture = {
  title: 'WinOLS checksum technique',
  summary: 'Videoda ECU dosyasındaki değişikliklerden sonra bütünlük kontrolünün neden yapıldığı gösteriliyor.',
  concepts: [{ name:'Checksum', explanation:'Veri bütünlüğünü doğrulama işlemi', why_it_matters:'Bozuk veri yazmayı önler' }],
  procedure: [{ timestamp:'01:20', action:'Checksum kontrol ekranı açılır', reason:'Değişikliği doğrulamak', expected_result:'Hata görünmemeli' }],
  decision_rules: [{ condition:'ECU dosyasında değişiklik varsa', action:'Checksum doğrula', reason:'Tutarsız kaydı engellemek' }],
  mistakes: [{risk:'Kontrolsüz yazma',why:'Hatalı veriler',prevention:'Yazmadan önce doğrulama'}],
  transferable_lessons:['Bir teknik değişiklikten sonra sonucunu ölç ve doğrula'],
  uncertainties:['Kesin ECU donanım kodu videoda görünmüyor']
};
const fakeModelResponse = { candidates:[{content:{parts:[{text:JSON.stringify(fixture)}]}}] };

test('YouTube URL is passed as native Gemini video input without downloading or uploading media',()=>{
  const input=buildYouTubeInsightRequest('https://youtu.be/jNQXAC9IVRw');
  assert.equal(input.contents[0].parts[1].file_data.file_uri,'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  assert.equal(input.generationConfig.responseMimeType,'application/json');
  assert.match(input.contents[0].parts[0].text,/nedensel mantığı/);
  assert.ok(!JSON.stringify(input).includes('inlineData'));
  assert.throws(()=>canonicalYouTubeVideoUrl('https://youtube.com.evil.test/watch?v=jNQXAC9IVRw'),/YOUTUBE_VIDEO_URL_REQUIRED/);
  assert.throws(()=>canonicalYouTubeVideoUrl('http://youtube.com/watch?v=jNQXAC9IVRw'),/YOUTUBE_VIDEO_URL_REQUIRED/);
});

test('video insight creates a durable, searchable causal lesson instead of a transcript dump',()=>{
  const insight=parseYouTubeInsightResponse(fakeModelResponse);
  assert.equal(insight.learning_method,'direct-youtube-video-understanding');
  assert.match(insight.transcript,/İşleyiş:/);
  assert.match(insight.transcript,/Nedeni: Değişikliği doğrulamak/);
  assert.match(insight.transcript,/Karar kuralı:/);
  assert.match(insight.transcript,/Aktarılabilir ilke:/);
  assert.match(insight.transcript,/Belirsiz\/doğrulanmalı:/);
  assert.ok(insight.insights_count>=4);
});

test('empty or unstructured model output cannot be marked learned',()=>{
  assert.throws(()=>parseYouTubeInsightResponse({candidates:[{content:{parts:[{text:'not json'}]}}]}),/INVALID_JSON/);
  assert.throws(()=>parseYouTubeInsightResponse({candidates:[{content:{parts:[{text:JSON.stringify({summary:'short'})}]}}]}),/INSUFFICIENT_INSIGHTS/);
});

test('Worker with connected Gemini credential sends URL-native video and returns lesson metadata',async()=>{
  const env={CREDENTIAL_MASTER_KEY:'test-encryption-master-key-at-least-24-characters'};
  const encrypted_secret=await encryptCredential(env,'unit-test-gemini-api-key');
  const credential={enabled:1,last_status:'ok',provider:'gemini',encrypted_secret,model:'gemini-2.5-flash'};
  env.DB={prepare:()=>({bind:()=>({all:async()=>({results:[credential]})})})};
  let called=false;
  const output=await analyzeYouTubeDirect(env,{url:'https://youtu.be/jNQXAC9IVRw'},{
    fetchImpl:async (url,options,timeout)=>{
      called=true;
      assert.match(url,/gemini-2\.5-flash:generateContent/);
      assert.equal(options.headers['x-goog-api-key'],'unit-test-gemini-api-key');
      assert.equal(timeout,110000);
      const input=JSON.parse(options.body);
      assert.equal(input.contents[0].parts[1].file_data.file_uri,'https://www.youtube.com/watch?v=jNQXAC9IVRw');
      return Response.json(fakeModelResponse);
    }
  });
  assert.equal(called,true);
  assert.equal(output.video_analyzed,true);
  assert.equal(output.source_url,'https://www.youtube.com/watch?v=jNQXAC9IVRw');
  assert.equal(output.lesson_details.decision_rules.length,1);
  assert.equal(output.learning_method,'direct-youtube-video-understanding');
  assert.ok(output.insights_count>0);
});

test('learning database only treats verified video insights as reusable knowledge',()=>{
  const source=readFileSync(new URL('../src/lib/youtube-learning-memory.js',import.meta.url),'utf8');
  assert.match(source,/result\?\.video_analyzed === true/);
  assert.match(source,/direct && transcript/);
  assert.match(source,/learning_method/);
});
