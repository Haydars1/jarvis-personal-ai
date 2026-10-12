// Cloudflare-compatible ECU image utilities. All operations are read-only.
const MAX_FILE=4*1024*1024;
const encoder=new TextDecoder('utf-8',{fatal:true});
function asBytes(value){
 const bytes=value instanceof Uint8Array?value:new Uint8Array(value);
 if(!bytes.length||bytes.length>MAX_FILE)throw Error('ECU_FILE_SIZE_UNSUPPORTED');
 return bytes;
}
const hexByte=n=>n.toString(16).padStart(2,'0').toUpperCase();
const hexAddr=n=>'0x'+n.toString(16).toUpperCase().padStart(8,'0');
function parseIntelHex(bytes){
 let text;try{text=encoder.decode(bytes);}catch{throw Error('HEX_TEXT_INVALID');}
 const lines=text.split(/\r?\n/),segments=[];let base=0,records=0,eof=false,dataBytes=0;
 if(lines.length>120000)throw Error('HEX_TOO_MANY_RECORDS');
 for(const lineRaw of lines){
  const line=lineRaw.trim();if(!line)continue;
  if(eof)throw Error('HEX_DATA_AFTER_EOF');
  if(!/^:[0-9A-Fa-f]+$/.test(line)||(line.length-1)%2!==0||line.length<11)throw Error('HEX_RECORD_INVALID');
  const record=new Uint8Array((line.length-1)/2);
  for(let i=0;i<record.length;i++)record[i]=parseInt(line.slice(1+i*2,3+i*2),16);
  const size=record[0],offset=(record[1]<<8)|record[2],type=record[3];
  if(record.length!==size+5)throw Error('HEX_RECORD_LENGTH_INVALID');
  if(record.reduce((sum,b)=>sum+b,0)%256!==0)throw Error('HEX_RECORD_CHECKSUM_INVALID');
  records++;
  if(type===0){
   const start=base+offset;if(start+size>0x100000000)throw Error('HEX_ADDRESS_OVERFLOW');
   if(size){dataBytes+=size;if(dataBytes>MAX_FILE)throw Error('HEX_DATA_TOO_LARGE');segments.push({start,bytes:record.slice(4,4+size)});}
  }else if(type===1){
   if(size||offset)throw Error('HEX_EOF_INVALID');
   eof=true;
  }else if(type===2||type===4){
   if(size!==2||offset!==0)throw Error('HEX_EXTENDED_ADDRESS_INVALID');
   const val=(record[4]<<8)|record[5];
   base=type===2?val*16:val*65536;
  }else if(type===3||type===5){
   if(size!==4||offset!==0)throw Error('HEX_START_ADDRESS_INVALID');
  }else throw Error('HEX_RECORD_TYPE_UNSUPPORTED');
 }
 if(!eof)throw Error('HEX_EOF_MISSING');
 if(!dataBytes)throw Error('HEX_EMPTY_IMAGE');
 segments.sort((a,b)=>a.start-b.start);
 for(let i=1;i<segments.length;i++){
  if(segments[i].start<segments[i-1].start+segments[i-1].bytes.length)throw Error('HEX_OVERLAPPING_ADDRESSES');
 }
 return {format:'intel-hex',segments,records,dataBytes,checksum_valid:true};
}
export function parseEcuImage(value,filename='image.bin'){
 const bytes=asBytes(value),name=String(filename||'image.bin');
 if(/\.hex$/i.test(name)&&bytes[0]===58)return parseIntelHex(bytes);
 return {format:'raw-binary',segments:[{start:0,bytes}],dataBytes:bytes.length,records:null,checksum_valid:null};
}
function cursor(segments){
 let item=0,offset=0;
 return ()=>{while(item<segments.length){
  const part=segments[item];
  if(offset<part.bytes.length){const data={addr:part.start+offset,byte:part.bytes[offset]};offset++;return data;}
  item++;offset=0;
 }return null;};
}
export function compareEcuFiles(original,modified,originalName='original.bin',modifiedName='modified.bin'){
 const before=parseEcuImage(original,originalName),after=parseEcuImage(modified,modifiedName);
 if(before.format!==after.format)throw Error('ECU_COMPARE_FORMAT_MISMATCH');
 const nextA=cursor(before.segments),nextB=cursor(after.segments);
 let a=nextA(),b=nextB(),changed=0,added=0,removed=0,totalRanges=0;
 const ranges=[];let current=null;
 function flush(){if(!current)return;totalRanges++;if(ranges.length<64){
  ranges.push({...current,start_hex:hexAddr(current.start),end_hex:hexAddr(current.end),before_hex:current.before.join(' '),after_hex:current.after.join(' ')});
 }current=null;}
 while(a||b){
  let addr,category,oldValue=null,newValue=null;
  if(a&&b&&a.addr===b.addr){
   addr=a.addr;oldValue=a.byte;newValue=b.byte;a=nextA();b=nextB();
   if(oldValue===newValue){flush();continue;}
   changed++;category='changed';
  }else if(a&&(!b||a.addr<b.addr)){
   addr=a.addr;oldValue=a.byte;a=nextA();removed++;category='removed';
  }else{
   addr=b.addr;newValue=b.byte;b=nextB();added++;category='added';
  }
  if(!current||addr!==current.end+1){flush();current={start:addr,end:addr,changed:0,added:0,removed:0,before:[],after:[]};}
  current.end=addr;current[category]++;
  if(current.before.length<12){
   current.before.push(oldValue===null?'--':hexByte(oldValue));
   current.after.push(newValue===null?'--':hexByte(newValue));
  }
 }
 flush();
 return {original:{file:String(originalName).slice(0,120),format:before.format,size_bytes:before.dataBytes},
   modified:{file:String(modifiedName).slice(0,120),format:after.format,size_bytes:after.dataBytes},
   identical:changed===0&&added===0&&removed===0,changed_bytes:changed,added_bytes:added,removed_bytes:removed,
   total_different_bytes:changed+added+removed,total_changed_ranges:totalRanges,ranges,truncated_ranges:totalRanges>ranges.length,
   intel_hex_record_checksums_valid:before.format==='intel-hex'?before.checksum_valid&&after.checksum_valid:null,
   ecu_firmware_checksum_verified:false,ecu_model_verified:false,flashing_performed:false,persisted:false,read_only:true};
}
export function inspectIntelHexMetadata(value,filename){
 const parsed=parseEcuImage(value,filename);
 if(parsed.format!=='intel-hex')return {format:'raw-binary',record_checksums_valid:null};
 return {format:'intel-hex',record_count:parsed.records,data_bytes:parsed.dataBytes,record_checksums_valid:true,
   address_start_hex:hexAddr(parsed.segments[0].start),address_end_hex:hexAddr(parsed.segments.at(-1).start+parsed.segments.at(-1).bytes.length-1),
   ecu_firmware_checksum_verified:false};
}
