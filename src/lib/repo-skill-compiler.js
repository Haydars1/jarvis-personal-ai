export const SKILL_COMPILER_VERSION='2026-10-02.1';

const RULES=Object.freeze([
  {id:'youtube-teaching',patterns:[/notebooklm-coach|youtube library|youtube channel.*(learn|teach|coach|source)|source-cited.*coach|notebooklm|bulk channel ingestion|video transcript research/i],weight:12},
  {id:'speech-to-text',patterns:[/speech[- ]to[- ]text|speech recognition|automatic speech recognition|transcrib|whisper/i],weight:9},
  {id:'wake-word-detection',patterns:[/wake[- ]?word|wakeword|keyword spotting|openwakeword/i],weight:9},
  {id:'audio-processing',patterns:[/audio|wav|mp3|speech|ffmpeg/i],weight:4},
  {id:'text-to-speech',patterns:[/text[- ]to[- ]speech|tts|speech synthesis|voice synthesis/i],weight:8},
  {id:'browser-automation',patterns:[/browser automation|playwright|puppeteer|selenium|chromium|browser agent/i],weight:9},
  {id:'web-navigation',patterns:[/navigate pages|click elements|fill forms|browser|web navigation/i],weight:5},
  {id:'web-scraping',patterns:[/scrap|crawl|crawler|extract web|html parser|beautifulsoup/i],weight:7},
  {id:'video-processing',patterns:[/video editing|video processing|ffmpeg|moviepy|transcod|concatenate|composite|encode video|render video/i],weight:9},
  {id:'video-generation',patterns:[/text[- ]to[- ]video|image[- ]to[- ]video|video generation|diffusion video|comfyui.*video|wan.*video|ltx.*video/i],weight:9},
  {id:'media-conversion',patterns:[/ffmpeg|transcod|encode|decode|convert media|mux|demux/i],weight:6},
  {id:'image-generation',patterns:[/image generation|stable diffusion|diffusers|comfyui|text[- ]to[- ]image|flux/i],weight:8},
  {id:'image-processing',patterns:[/opencv|image processing|resize image|upscal|background removal|segmentation|\brembg\b/i],weight:6},
  {id:'ocr',patterns:[/ocr|optical character recognition|tesseract|document text extraction/i],weight:8},
  {id:'prompt-engineering',patterns:[/prompt engineering|prompt-engineering|prompting techniques|prompt guide/i],weight:8},
  {id:'document-processing',patterns:[/pdf|document parser|docx|office document|markdown conversion|document processing|prompt engineering guide|prompt-engineering-guide/i],weight:6},
  {id:'local-llm',patterns:[/llama\.cpp|ollama|local llm|gguf|inference server|language model inference/i],weight:8},
  {id:'coding-agent',patterns:[/coding agent|software agent|code assistant|aider|openhands|code generation|repository agent/i],weight:8},
  {id:'workflow-automation',patterns:[/workflow automation|node-red|n8n|huginn|automation platform|rpa/i],weight:8},
  {id:'rag',patterns:[/retrieval augmented|\brag\b|vector database|embedding|semantic search|source-cited|grounded citations/i],weight:7},
  {id:'vector-search',patterns:[/vector database|vector search|faiss|qdrant|chroma|milvus/i],weight:7},
  {id:'vehicle-diagnostics',patterns:[/vehicle diagnostic|diagnostic service|read dtc|fault code|obd|iso 14229|unified diagnostic services/i],weight:10},
  {id:'uds',patterns:[/\buds\b|unified diagnostic services|iso 14229/i],weight:10},
  {id:'can-bus',patterns:[/can bus|socketcan|canbus|can frame|mcp2515/i],weight:8},
  {id:'ecu-file-analysis',patterns:[/ecu|firmware|flash|eeprom|calibration|romraider|checksum|binary map/i],weight:6},
  {id:'binary-analysis',patterns:[/binary analysis|binwalk|firmware analysis|reverse engineering|ghidra|hex editor/i],weight:7},
  {id:'home-automation',patterns:[/home assistant|home automation|mqtt|smart home/i],weight:8},
  {id:'social-automation',patterns:[/instagram|facebook|social media|mastodon|telegram bot|social automation/i],weight:5}
]);

const TASK_MAP=Object.freeze({
  video_creation:['video-generation','video-processing','media-conversion','image-generation'],
  youtube_teaching:['youtube-teaching','speech-to-text','rag','web-scraping'],
  audio:['speech-to-text','wake-word-detection','text-to-speech','audio-processing'],
  vision:['ocr','image-processing','document-processing'],
  image:['image-generation','image-processing'],
  coding:['coding-agent','local-llm','binary-analysis'],
  research:['web-scraping','browser-automation','web-navigation','rag','vector-search','prompt-engineering'],
  social_strategy:['social-automation','video-processing','workflow-automation'],
  ecu_diagnostics:['vehicle-diagnostics','uds','can-bus'],
  ecu_file_analysis:['ecu-file-analysis','binary-analysis'],
  vehicle_coding:['vehicle-diagnostics','uds','can-bus'],
  service_procedure:['vehicle-diagnostics','uds','can-bus'],
  reporting:['document-processing','ocr','rag','prompt-engineering'],
  chat:['local-llm','rag','prompt-engineering']
});

function normalizedText(inspect={}){
  const snippets=inspect.snippets&&typeof inspect.snippets==='object'?inspect.snippets:{};
  const files=Array.isArray(inspect.files)?inspect.files:[];
  return [inspect.repo||'',...Object.values(snippets).map(String),...files].join('\n').toLowerCase();
}
function detectCapabilities(text,repoText=''){
  const scored=[];
  for(const rule of RULES){
    let matches=0;
    let repoMatches=0;
    for(const pattern of rule.patterns){
      if(pattern.test(text))matches++;
      if(pattern.test(repoText))repoMatches++;
    }
    if(matches||repoMatches){
      const repositoryIdentityBoost=repoMatches?12+Math.min(4,repoMatches-1):0;
      scored.push({id:rule.id,score:rule.weight+Math.min(4,Math.max(0,matches-1))+repositoryIdentityBoost});
    }
  }
  return scored.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map(x=>x.id);
}
function laneFor(capabilities,text){
  if(capabilities.some(x=>['vehicle-diagnostics','uds','can-bus'].includes(x)))return 'device-bridge';
  if(/cuda|gpu|stable diffusion|comfyui|video generation|diffusion/i.test(text))return 'gpu-cloud-runner';
  return 'cloud-runner';
}
function riskFor(capabilities){
  if(capabilities.some(x=>['vehicle-diagnostics','uds','can-bus','ecu-file-analysis','binary-analysis'].includes(x)))return 'high';
  if(capabilities.some(x=>['browser-automation','web-navigation','workflow-automation','social-automation'].includes(x)))return 'medium';
  return 'low';
}

export function compileRepositorySkill(inspect={},hints={}){
  const text=normalizedText(inspect);
  const repo=String(inspect.repo||hints.repo||'').trim();
  const capabilities=detectCapabilities(text,repo.toLowerCase());
  const commit=/^[0-9a-f]{40}$/i.test(String(inspect.commit||''))?String(inspect.commit):null;
  return {
    id:`repo:${repo.toLowerCase()}`,
    repo,
    source_commit:commit,
    compiler_version:SKILL_COMPILER_VERSION,
    capabilities,
    primary_capability:capabilities[0]||'repository-knowledge',
    execution_lane:laneFor(capabilities,text),
    risk:riskFor(capabilities),
    requires_paid_api:false,
    status:capabilities.length?'learned':'needs-review',
    verification:'repository-inspection',
    adapter_status:'unverified',
    evidence:{files:Number(inspect.file_count||0),snippets:Object.keys(inspect.snippets||{})}
  };
}

export function skillMatchesTask(skill={},kind='chat'){
  const wanted=TASK_MAP[String(kind||'chat')]||TASK_MAP.chat;
  const caps=Array.isArray(skill.capabilities)?skill.capabilities:[];
  let score=0;
  wanted.forEach((cap,index)=>{if(caps.includes(cap))score=Math.max(score,100-index*12);});
  if(skill.status==='learned')score+=5;
  if(skill.adapter_status==='ready')score+=15;
  if(skill.risk==='high'&&!['ecu_diagnostics','ecu_file_analysis','vehicle_coding','service_procedure'].includes(kind))score-=25;
  return score;
}

export const REPOSITORY_SKILL_RULES=RULES;
export const SKILL_TASK_MAP=TASK_MAP;
