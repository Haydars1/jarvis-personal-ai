import { inspectIntelHexMetadata, parseEcuImage } from './agent-hub-ecu-file-tools.js';
// Deterministic read-only ECU binary fingerprint; never alters firmware or flashes a device.
// Intel HEX signatures, entropy and headers describe decoded bytes, not textual records.
export function inspectEcuBinary(buffer,file){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.length===0||bytes.length>4*1024*1024)throw Error('ECU_FILE_SIZE_UNSUPPORTED');
 const image=parseEcuImage(bytes,file);
 const freq=new Uint32Array(256),prefix=[],sample=[];
 let sampled=0,previousEnd=null;
 for(const segment of image.segments){
  // Sparse Intel HEX addresses are not adjacent firmware bytes.
  if(previousEnd!==null&&segment.start!==previousEnd&&sampled<524288)sample.push(' ');
  for(const b of segment.bytes){
   freq[b]++;
   if(prefix.length<32)prefix.push(b);
   if(sampled<524288){
    sample.push((b>=32&&b<127)?String.fromCharCode(b):' ');
    sampled++;
   }
  }
  previousEnd=segment.start+segment.bytes.length;
 }
 let entropy=0;for(const n of freq)if(n){const p=n/image.dataBytes;entropy-=p*Math.log2(p);}
 const head=prefix.map(b=>b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
 const markers=['BOSCH','EDC15','EDC16','EDC17','MED17','SIMOS','CONTINENTAL','SIEMENS','DELPHI','DENSO','MAGNETI MARELLI'];
 const upper=sample.join('').toUpperCase();
 return {file:String(file||'').slice(0,240),size_bytes:bytes.length,payload_size_bytes:image.dataBytes,
  entropy_bits_per_byte:Number(entropy.toFixed(3)),header_hex:head,...inspectIntelHexMetadata(bytes,file),
  ascii_markers:markers.filter(m=>upper.includes(m)),possible_encrypted_or_compressed:entropy>7.85,
  checksum_verified:false,ecu_model_verified:false,flashing_performed:false,read_only:true};
}
