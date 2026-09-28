(()=>{
  const state={name:'',original:null,bytes:null,offset:0,selected:0,rows:32,undo:[],redo:[]};
  const q=s=>document.querySelector(s);
  const hex=(n,w=2)=>Number(n).toString(16).toUpperCase().padStart(w,'0');
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function addStyle(){
    const st=document.createElement('style');
    st.textContent='.ecuShell{display:grid;gap:14px}.ecuToolbar,.ecuMeta,.ecuPager,.ecuInspector,.ecuActions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.ecuToolbar input[type=file]{max-width:100%}.ecuToolbar input,.ecuPager input{min-width:0}.ecuHexWrap{overflow:auto;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:#060a15}.ecuHex{font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-width:760px;padding:10px}.ecuRow{display:grid;grid-template-columns:78px repeat(16,34px) 1fr;gap:3px;align-items:center}.ecuAddr{opacity:.6}.ecuByte{appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:2px;border-radius:5px}.ecuByte.changed{background:rgba(255,174,0,.2);color:#ffd27a}.ecuByte.selected{outline:1px solid #61dafb;background:rgba(97,218,251,.14)}.ecuAscii{white-space:pre;opacity:.72;margin-left:8px}.ecuStat{padding:7px 10px;border-radius:999px;background:rgba(255,255,255,.06)}.ecuInspector{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ecuInspector>div{padding:10px;border-radius:12px;background:rgba(255,255,255,.05)}.ecuDiffList{max-height:220px;overflow:auto;font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.ecuDiffItem{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)}@media(max-width:700px){.ecuInspector{grid-template-columns:repeat(2,minmax(0,1fr))}.ecuHex{min-width:690px}.ecuRow{grid-template-columns:72px repeat(16,31px) 1fr}.ecuByte{font-size:11px}.ecuShell .card{padding:12px}}';
    document.head.appendChild(st);
  }
  function mount(){
    const main=q('main'); if(!main||q('#ecu')) return;
    const side=q('aside nav');
    if(side){
      const b=document.createElement('button'); b.dataset.page='ecu'; b.innerHTML='⌁ <span>ECU Studio</span>'; side.insertBefore(b,side.querySelector('[data-page="selfupdate"]'));
    }
    const sec=document.createElement('section'); sec.id='ecu'; sec.className='page';
    sec.innerHTML='<div class="ecuShell"><div class="card"><h2>ECU Studio</h2><p class="muted">Mobil BIN/HEX inceleme ve manuel düzenleme. Dosya tarayıcı içinde işlenir; orijinal kopya korunur.</p><div class="ecuToolbar"><input id="ecuFile" type="file" accept=".bin,.hex,.ori,.mod,.rom,.ecu,application/octet-stream"><button id="ecuReset" class="softBtn">ORIYE DÖN</button><button id="ecuUndo" class="softBtn">GERİ AL</button><button id="ecuRedo" class="softBtn">İLERİ AL</button><button id="ecuSave">MOD DOSYAYI KAYDET</button></div><div id="ecuMeta" class="ecuMeta"><span class="ecuStat">Dosya bekleniyor</span></div></div><div class="card"><div class="ecuPager"><input id="ecuGoto" placeholder="Offset örn. 1A3F0"><button id="ecuGo">GİT</button><input id="ecuFind" placeholder="Hex ara: 01 FF A0"><button id="ecuFindBtn">ARA</button><button id="ecuPrev" class="softBtn">◀</button><button id="ecuNext" class="softBtn">▶</button></div><div class="ecuHexWrap"><div id="ecuHex" class="ecuHex">Dosya yükleyin.</div></div></div><div class="card"><h3>Seçili Offset</h3><div id="ecuInspector" class="ecuInspector"></div></div><div class="card"><h3>ORI / MOD Farkları</h3><div id="ecuDiff" class="ecuDiffList">Henüz değişiklik yok.</div></div></div>';
    main.appendChild(sec);
    bind();
  }
  async function loadFile(file){
    if(!file)return;
    const buf=await file.arrayBuffer();
    state.name=file.name||'ecu.bin';
    state.original=new Uint8Array(buf);
    state.bytes=new Uint8Array(state.original);
    state.offset=0;state.selected=0;state.undo=[];state.redo=[];
    await renderMeta(); render();
  }
  async function sha256(a){
    if(!crypto?.subtle)return'—';
    const h=await crypto.subtle.digest('SHA-256',a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength));
    return [...new Uint8Array(h)].map(x=>hex(x)).join('');
  }
  function entropy(a){
    if(!a?.length)return 0; const c=new Uint32Array(256); for(const x of a)c[x]++;
    let e=0; for(const n of c)if(n){const p=n/a.length;e-=p*Math.log2(p)} return e;
  }
  async function renderMeta(){
    const e=q('#ecuMeta'); if(!e||!state.bytes)return;
    e.innerHTML='<span class="ecuStat">'+escapeHtml(state.name)+'</span><span class="ecuStat">'+state.bytes.length.toLocaleString('tr-TR')+' bayt</span><span class="ecuStat">Entropy '+entropy(state.bytes).toFixed(3)+'</span><span class="ecuStat">SHA-256 hesaplanıyor…</span>';
    const h=await sha256(state.bytes); const parts=[...e.children]; if(parts[3])parts[3].textContent='SHA-256 '+h.slice(0,16)+'…';
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
  function render(){
    renderHex(); renderInspector(); renderDiff();
  }
  function pageSize(){return state.rows*16}
  function renderHex(){
    const root=q('#ecuHex'); if(!root)return;
    if(!state.bytes){root.textContent='Dosya yükleyin.';return}
    state.offset=Math.floor(clamp(state.offset,0,Math.max(0,state.bytes.length-1))/16)*16;
    const end=Math.min(state.bytes.length,state.offset+pageSize()); let out='';
    for(let base=state.offset;base<end;base+=16){
      let ascii='';
      out+='<div class="ecuRow"><span class="ecuAddr">'+hex(base,8)+'</span>';
      for(let i=0;i<16;i++){
        const idx=base+i;
        if(idx<state.bytes.length){
          const changed=state.bytes[idx]!==state.original[idx], sel=idx===state.selected;
          out+='<button class="ecuByte'+(changed?' changed':'')+(sel?' selected':'')+'" data-i="'+idx+'">'+hex(state.bytes[idx])+'</button>';
          const c=state.bytes[idx]; ascii+=(c>=32&&c<=126)?String.fromCharCode(c):'.';
        }else out+='<span></span>';
      }
      out+='<span class="ecuAscii">'+escapeHtml(ascii)+'</span></div>';
    }
    root.innerHTML=out;
    root.querySelectorAll('.ecuByte').forEach(b=>b.onclick=()=>selectByte(Number(b.dataset.i)));
  }
  function selectByte(i){
    if(!state.bytes)return; state.selected=clamp(i,0,state.bytes.length-1); renderHex(); renderInspector();
  }
  function view(){
    if(!state.bytes)return null; return new DataView(state.bytes.buffer,state.bytes.byteOffset,state.bytes.byteLength);
  }
  function safeGet(fn,fallback='—'){try{return fn()}catch{return fallback}}
  function renderInspector(){
    const e=q('#ecuInspector'); if(!e)return;
    if(!state.bytes){e.innerHTML='<div>Dosya yok</div>';return}
    const i=state.selected,d=view(),v=state.bytes[i];
    e.innerHTML='<div><small>OFFSET</small><b>0x'+hex(i,8)+'</b></div><div><small>HEX / U8</small><b>'+hex(v)+' / '+v+'</b></div><div><small>U16 LE / BE</small><b>'+safeGet(()=>d.getUint16(i,true))+' / '+safeGet(()=>d.getUint16(i,false))+'</b></div><div><small>U32 LE / BE</small><b>'+safeGet(()=>d.getUint32(i,true))+' / '+safeGet(()=>d.getUint32(i,false))+'</b></div><div><small>S16 LE / BE</small><b>'+safeGet(()=>d.getInt16(i,true))+' / '+safeGet(()=>d.getInt16(i,false))+'</b></div><div><small>FLOAT LE / BE</small><b>'+safeGet(()=>d.getFloat32(i,true).toFixed(5))+' / '+safeGet(()=>d.getFloat32(i,false).toFixed(5))+'</b></div><div><small>ORI</small><b>'+hex(state.original[i])+'</b></div><div><small>MOD</small><div class="row"><input id="ecuValue" inputmode="text" maxlength="2" value="'+hex(v)+'"><button id="ecuApply">YAZ</button></div></div>';
    q('#ecuApply').onclick=()=>applyValue(q('#ecuValue').value);
    q('#ecuValue').onkeydown=x=>{if(x.key==='Enter')applyValue(x.currentTarget.value)};
  }
  function applyValue(raw){
    if(!state.bytes)return; const n=parseInt(String(raw).replace(/^0x/i,''),16);
    if(!Number.isInteger(n)||n<0||n>255){notify('00–FF arasında hex değer gir');return}
    const i=state.selected,old=state.bytes[i]; if(old===n)return;
    state.undo.push({i,from:old,to:n}); state.redo=[]; state.bytes[i]=n; render(); renderMeta();
  }
  function undo(){
    const a=state.undo.pop(); if(!a||!state.bytes)return; state.bytes[a.i]=a.from;state.redo.push(a);state.selected=a.i;ensureVisible(a.i);render();renderMeta();
  }
  function redo(){
    const a=state.redo.pop(); if(!a||!state.bytes)return; state.bytes[a.i]=a.to;state.undo.push(a);state.selected=a.i;ensureVisible(a.i);render();renderMeta();
  }
  function ensureVisible(i){if(i<state.offset||i>=state.offset+pageSize())state.offset=Math.floor(i/16)*16}
  function parseOffset(s){s=String(s||'').trim(); if(/^0x/i.test(s))return parseInt(s,16); if(/^[0-9a-f]+$/i.test(s))return parseInt(s,16); return NaN}
  function go(){
    if(!state.bytes)return; const i=parseOffset(q('#ecuGoto').value); if(!Number.isFinite(i)||i<0||i>=state.bytes.length){notify('Geçerli bir offset gir');return}
    state.selected=i;ensureVisible(i);render();
  }
  function findPattern(){
    if(!state.bytes)return;
    const p=String(q('#ecuFind').value||'').trim().replace(/0x/gi,'').split(/[\s,;:-]+/).filter(Boolean).map(x=>parseInt(x,16));
    if(!p.length||p.some(x=>!Number.isInteger(x)||x<0||x>255)){notify('Örnek: 01 FF A0');return}
    const start=Math.min(state.bytes.length,Math.max(state.selected+1,0));
    let found=-1;
    outer:for(let i=start;i<=state.bytes.length-p.length;i++){for(let j=0;j<p.length;j++)if(state.bytes[i+j]!==p[j])continue outer;found=i;break}
    if(found<0){notify('Desen bulunamadı');return} state.selected=found;ensureVisible(found);render();notify('Bulundu: 0x'+hex(found,8));
  }
  function diff(){
    const out=[]; if(!state.bytes)return out;
    for(let i=0;i<state.bytes.length;i++)if(state.bytes[i]!==state.original[i])out.push(i);
    return out;
  }
  function renderDiff(){
    const e=q('#ecuDiff');if(!e)return; const d=diff();
    if(!d.length){e.textContent='Henüz değişiklik yok.';return}
    e.innerHTML='<div class="ecuStat">'+d.length+' bayt değişti</div>'+d.slice(0,250).map(i=>'<div class="ecuDiffItem"><button class="ecuJump softBtn" data-i="'+i+'">0x'+hex(i,8)+'</button><span>'+hex(state.original[i])+' → '+hex(state.bytes[i])+'</span></div>').join('')+(d.length>250?'<div class="muted">İlk 250 değişiklik gösteriliyor.</div>':'');
    e.querySelectorAll('.ecuJump').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.i);state.selected=i;ensureVisible(i);render()});
  }
  function reset(){
    if(!state.original)return; state.bytes=new Uint8Array(state.original); state.undo=[];state.redo=[];state.selected=0;state.offset=0;render();renderMeta();notify('Dosya ORI durumuna döndü');
  }
  function save(){
    if(!state.bytes)return; const blob=new Blob([state.bytes],{type:'application/octet-stream'}),a=document.createElement('a');
    const base=state.name.replace(/\.[^.]+$/,''); a.href=URL.createObjectURL(blob);a.download=base+'_MOD.bin';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function notify(t){const toast=q('#toast');if(toast){toast.textContent=t;toast.classList.remove('hidden');setTimeout(()=>toast.classList.add('hidden'),2200)}}
  function bind(){
    q('#ecuFile').onchange=e=>loadFile(e.target.files?.[0]);
    q('#ecuReset').onclick=reset;q('#ecuUndo').onclick=undo;q('#ecuRedo').onclick=redo;q('#ecuSave').onclick=save;
    q('#ecuGo').onclick=go;q('#ecuGoto').onkeydown=e=>{if(e.key==='Enter')go()};
    q('#ecuFindBtn').onclick=findPattern;q('#ecuFind').onkeydown=e=>{if(e.key==='Enter')findPattern()};
    q('#ecuPrev').onclick=()=>{if(state.bytes){state.offset=Math.max(0,state.offset-pageSize());render()}};
    q('#ecuNext').onclick=()=>{if(state.bytes){state.offset=Math.min(Math.max(0,state.bytes.length-1),state.offset+pageSize());render()}};
  }
  addStyle(); if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();