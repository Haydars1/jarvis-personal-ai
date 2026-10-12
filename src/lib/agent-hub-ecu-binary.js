// Deterministic read-only ECU binary fingerprint; never alters firmware or flashes a device.
export function inspectEcuBinary(buffer,file){
 const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
 if(bytes.length===0||bytes.length>4*1024*1024)throw Error('ECU_FILE_SIZE_UNSUPPORTED');
 const freq=new Uint32Array(256);for(const b of bytes)freq[b]++;
 let entropy=0;for(const n of freq)if(n){const p=n/bytes.length;entropy-=p*Math.log2(p);}
 const head=Array.from(bytes.subarray(0,32),b=>b.toString(16).padStart(2,'0')).join(' ').toUpperCase();
 const markers=['BOSCH','EDC15','EDC16','EDC17','MED17','SIMOS','CONTINENTAL','SIEMENS','DELPHI','DENSO','MAGNETI MARELLI'];
 const upper=Array.from(bytes.subarray(0,Math.min(bytes.length,524288)),b=>(b>=32&&b<127)?String.fromCharCode(b):' ').join('').toUpperCase();
 return {file:String(file||'').slice(0,240),size_bytes:bytes.length,entropy_bits_per_byte:Number(entropy.toFixed(3)),header_hex:head,
  ascii_markers:markers.filter(m=>upper.includes(m)),possible_encrypted_or_compressed:entropy>7.85,
  checksum_verified:false,ecu_model_verified:false,flashing_performed:false,read_only:true};
}
