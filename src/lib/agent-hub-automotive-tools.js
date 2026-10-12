// Verified automotive tooling discovery; this list is a catalog, not executable plugins.
export const AUTOMOTIVE_TOOLS=Object.freeze([
 {repo:'brendan-w/python-OBD',area:'OBD-II',title:'Standart OBD teşhis ve canlı PID verisi',terms:['obd','elm327','dtc','pid','arıza','diagnostic','canlı veri'],runtime:'Python + ELM327 host',device_required:true,thinkdiag_compatible:false},
 {repo:'tronikos/elm327_obdii',area:'OBD-II BLE',title:'Bluetooth LE üzerinden OBD canlı verileri',terms:['ble','bluetooth','elm327','obd','pid','canlı veri'],runtime:'Python BLE adapter',device_required:true,thinkdiag_compatible:false},
 {repo:'OBDb/OBDb',area:'Vehicle PIDs',title:'Araç özelinde PID ve sensör profilleri',terms:['obd','pid','sensör','vehicle','marka','model','canlı veri'],runtime:'Reference dataset; verify license',device_required:false,thinkdiag_compatible:false},
 {repo:'commaai/opendbc',area:'CAN database',title:'CAN mesaj tanımları ve DBC referansı',terms:['can','dbc','ecu','araç','protokol','mesaj'],runtime:'DBC parser/vehicle matching required',device_required:false,thinkdiag_compatible:false},
 {repo:'NationalSecurityAgency/ghidra',area:'ECU binary',title:'ECU firmware statik disassembly analizi',terms:['ecu','bin','hex','firmware','reverse','kalibrasyon','kt200'],runtime:'Isolated desktop/JVM; analysis only',device_required:false,thinkdiag_compatible:false},
 {repo:'davidpeckham/vpic-api',area:'VIN',title:'VIN ile marka, model ve yıl çözümleme',terms:['vin','şasi','model','marka','araç bul','vehicle finder'],runtime:'NHTSA public API; EU coverage incomplete',device_required:false,thinkdiag_compatible:false},
 {repo:'laferil/vpic',area:'VIN offline',title:'Self-host VIN decoding (offline API)',terms:['vin','şasi','offline','model','marka'],runtime:'Container + local database',device_required:false,thinkdiag_compatible:false},
 {repo:'mapforger/mapforge',area:'ECU XDF',title:'BIN ve XDF kalibrasyon tablolarını görselleştir',terms:['xdf','bin','ecu','kalibrasyon','map','checksum','harita'],runtime:'Python backend + React; AGPL-3.0 licensing',device_required:false,thinkdiag_compatible:false},
 {repo:'LeZed97/ZedSuite',area:'ECU maps',title:'VAG EDC15/EDC16 harita tanıma ve düzenleme',terms:['vag','edc15','edc16','vw','ecu','bin','map','harita'],runtime:'Local desktop; ECU family support limited',device_required:false,thinkdiag_compatible:false},
 {repo:'CAATZ/bimmerstein-bin-analyzer',area:'ECU maps',title:'BMW Siemens MS41 BIN harita ve checksum analizi',terms:['bmw','ms41','siemens','ecu','bin','checksum'],runtime:'Windows local app; BMW MS41 primary focus',device_required:false,thinkdiag_compatible:false},
 {repo:'pylessard/python-udsoncan',area:'UDS ISO14229',title:'Standart UDS teşhis protokol kütüphanesi',terms:['uds','isotp','iso14229','obd','diagnostic','diagnostik','ecu'],runtime:'Python host + compatible CAN interface; no Thinkdiag protocol',device_required:true,thinkdiag_compatible:false},
 {repo:'Aider-AI/aider',area:'Code agent',title:'Git üzerinde kod ajanı ve değişiklik önerileri',terms:['kod','agent','ajan','github','automasyon','geliştir','coding'],runtime:'Sandboxed host + model',device_required:false,thinkdiag_compatible:false}
]);
export function recommendAutomotiveTools(task,{limit=8}={}){
 const q=String(task||'').normalize('NFKD').toLocaleLowerCase('tr').slice(0,1000);
 if(!q.trim())return [];
 const normalized=q.replaceAll('ı','i').replaceAll('ş','s').replaceAll('ğ','g').replaceAll('ü','u').replaceAll('ö','o').replaceAll('ç','c');
 return AUTOMOTIVE_TOOLS.map(tool=>({...tool,
  matches:tool.terms.filter(term=>normalized.includes(term.normalize('NFKD').toLocaleLowerCase('tr').replaceAll('ı','i').replaceAll('ş','s').replaceAll('ğ','g').replaceAll('ü','u').replaceAll('ö','o').replaceAll('ç','c'))),
  installed:false,auto_execute:false
 })).filter(tool=>tool.matches.length).sort((a,b)=>b.matches.length-a.matches.length||a.repo.localeCompare(b.repo))
 .slice(0,Math.max(1,Math.min(8,Number(limit)||8)));
}
