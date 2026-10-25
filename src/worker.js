import { ecuPermanentStudyContext } from './application/ecu/manual-study-context.js';
import { ensureRateLimitTable, rateLimit, clientIP, rateLimitResponse, rateLimitCleanup } from './lib/rate-limit.js';
// --- Module imports (extracted from monolith) ---
import { te, td, nativeFetch, fetchT, withTimeout, now, id, j, txt, parseCookies, safeJsonParse, body, privateHost } from './lib/core.js';
import { q1, qall, run, kvGet, kvSet, log } from './lib/d1.js';
import { hmac, sign, verify, hashPassword, masterKey, b64u, fromB64u, encSecret, decSecret, randB64u, bytesEq, sha256, readCbor } from './lib/crypto.js';
import { FILE_CHUNK, filePut, d1Bytes, fileGet, fileList, fileDelete } from './lib/file-storage.js';
import { isAuthed, cookie, passkeyCount, passkeys, rpFrom, registrationOptions, coseToJwk, verifyClient, parseAuthData, verifyRegistration, authenticationOptions, derToRawEcdsa, verifyAuthentication } from './lib/auth.js';
import { credentialRows, testCredential } from './lib/credentials.js';
import { githubCredential, repoCfg, gh, b64Utf8, repoFile, SELF_EDIT_ALLOW, cleanAiJson } from './lib/github.js';
import { googleCredential, googleStored, googleAccessToken, mailRaw, gmailList, gmailSend, driveFiles, metaCredential, metaFacebookPost, metaInstagramPost, pendingAction, executeAction } from './lib/integrations.js';
import { addChat, chatHistory, rememberExplicit } from './lib/chat.js';
import { aiFallback, aiRouterStatus, aiDiagnostics, aiRouterMark } from './lib/ai-router.js';
import { obdBridgeRouter } from './lib/obd-bridge.js';
import { thinkdiagRouter } from './lib/thinkdiag-import.js';
import { lookupDTC, searchDTCs, getTuningRelatedDTCs, getDTCSystems, getFlashProtocol, listFlashProtocols, getSafetyLimits, getAllSafetyLimits, batchLookupDTCs, analyzeDTCPattern } from './lib/dtc-database.js';
import { listChecksumAlgorithms, computeChecksum, detectChecksumAlgo, analyzeBinary, computeEntropy, entropyMap, extractStrings, detectSections, crc32, crc16, add32, add32le, add16, add16le, xor32, siemensChecksum, simosChecksum, delphiChecksum, marelliChecksum, densoChecksum, correctComplement } from './lib/ecu-checksum-extended.js';
import { createProject, getProject, listProjects, updateProject, deleteProject, addUploadToProject, addTunedToProject, startSession, endSession, addSessionOperation, addSessionChanges, getSession, listSessions, addNote, listNotes, deleteNote, projectStats, ensureProjectTables } from './lib/tuning-projects.js';
import { interpolate2D, interpolate3D, smooth2D, smooth3D, scaleMap, offsetMap, fillRegion, scaleRegion, clampMap, diffMaps, mapStats, rescaleXAxis, rescaleYAxis, copyRegion, pasteRegion, getMapTemplate, listMapTemplates, ensureMapTables, storeMap, getStoredMap, listStoredMaps, updateStoredMap, deleteStoredMap } from './lib/tuning-maps.js';
import { applyMapActions, mapActionProposals, applyRawBinaryAction, validateProposals, supportedActions, ensureMapActionTables, logMapAction, getMapActionHistory } from './lib/ecu-map-actions.js';
import { STANDARD_PIDS, getPID, searchPIDs, getPIDsByCategory, listPIDCategories, convertUnit, listConversions, GAUGE_CONFIGS, getGaugeConfig, DASHBOARD_PRESETS, getDashboardPreset, listDashboardPresets, DEFAULT_ALARMS, checkAlarms, getAlarmConfig, listAlarms, ensureLogTables, startLog, appendLogData, endLog, getLog, listLogs, deleteLog } from './lib/ecu-live-data.js';
import { OBD_MONITORS, parseMonitorStatus, readinessSummary, FREEZE_FRAME_PIDS, parseFreezeFrame, DRIVE_CYCLES, getDriveCycle, listDriveCycles, EMISSIONS_STANDARDS, checkEmissions, listEmissionsStandards, emissionsAdvisor, ensureReadinessTables, saveReadiness, getReadinessHistory, OBD_MODES, getOBDMode, listOBDModes } from './lib/ecu-readiness.js';
import { OBD2_CONNECTOR, ECU_PINOUTS, PIN_TYPE_COLORS, getEcuPinout, listEcuPinouts, searchEcuPinouts, getPinsByType, getEcuPinTypes, getFlashPins, verifyWiring, getOBD2Pin, getOBD2Protocol } from './lib/ecu-wiring.js';
import { parseIntelHex, generateIntelHex, parseSRecord, generateSRecord, detectFormat, convertFile, validateHexFile, compareFiles, SUPPORTED_FORMATS, listFormats } from './lib/file-converter.js';
import { parseCANFrame, decodeUDS, decodeKWP2000, parseISOTP, reassembleISOTP, parseCANLog, UDS_SERVICES, UDS_NRC, KWP2000_SERVICES, ISOTP_FRAME_TYPES, FLASH_SEQUENCES, getFlashSequence as getUDSFlashSequence, listFlashSequences as listUDSFlashSequences, listUDSServices, getUDSService, listDIDs, getDID, listKWP2000Services, COMMON_DIDS } from './lib/ecu-protocol.js';
import { decodeVIN, validateCheckDigit, searchManufacturer, getManufacturersByCountry, batchDecodeVIN, vinDecoderStats, WMI_DATABASE } from './lib/vin-decoder.js';
import { correctFlowForPressure, calcDutyCycle, sizeInjectors, calcAFR, lambdaToAFR, afrToLambda, calcBoost, calcWastegateDuty, calcMAFScale, sizeFuelPump, estimateVE, listInjectors, getInjector, listFuelTypes, getFuelType, fuelCalcStats, FUEL_DENSITY, INJECTOR_DATABASE } from './lib/fuel-injection.js';
import { calcAirflow, calcPressureRatio, calcCompressorTemp, calcIntercooler, selectAR, sizeTurbo, checkSurgeChoke, calcTwinTurbo, listTurbos, getTurbo, searchTurbos, turboCalcStats, TURBO_DATABASE } from './lib/turbo-calc.js';
import { calcExhaustFlow, sizeExhaustPipe, calcBackpressure, calcHeaderSize, sizeCat, checkEGT, listPipeSizes, listCats, getCat, exhaustCalcStats, PIPE_SIZES, CAT_DATABASE } from './lib/exhaust-calc.js';
import { calcDisplacement, calcCompressionRatio, calcDynamicCR, calcMeanPistonSpeed, convertTorqueHP, calcBMEP, calcEfficiency, calcRodRatio, estimateCylinderPressure, listEngineConfigs, getEngineConfig, searchEngineConfigs, engineMathStats, ENGINE_CONFIGS } from './lib/engine-math.js';
import { calcTimingEvents, calcValveFloat, compareCams, recommendCam, listCams, getCam, searchCams, camCalcStats, CAM_DATABASE } from './lib/camshaft-calc.js';
import { calcSpeedAtRPM, calcRPMAtSpeed, calcWheelHP, estimateCrankHP, analyzeGearRatios, estimate0to100, calcMaxSpeeds, listTransmissions, getTransmission, searchTransmissions, listTireSizes, listDrivetrainTypes, drivetrainCalcStats, TRANSMISSION_DATABASE, TIRE_DATABASE, DRIVETRAIN_LOSS } from './lib/drivetrain-calc.js';
import { calcHeatRejection, calcCoolantFlow, sizeRadiator, calcBoilingPoint, sizeFan, calcWaterPump, recommendThermostat, listCoolantTypes, listRadiators, getRadiator, listFans, listThermostats, coolingCalcStats, COOLANT_TYPES, RADIATOR_DATABASE, FAN_DATABASE, THERMOSTAT_RATINGS } from './lib/cooling-calc.js';
import { calcKnockFrequency, assessDetonationRisk, calcTimingRetard, recommendTimingMap, analyzeKnockWindow, listOctanes, getOctane, listKnockSensors, getKnockSensor, searchKnockSensors, knockCalcStats, OCTANE_DATABASE, KNOCK_SENSOR_DATABASE } from './lib/knock-calc.js';
import { calcPIDTuning, generateLambdaMap, calibrateSensor, freeAirCalibration, estimateEthanolContent, listFuelStoich, getFuelStoich, listWidebandSensors, getWidebandSensor, searchWidebandSensors, listLambdaTargets, getLambdaTarget, lambdaCalcStats, STOICH_DATABASE, WIDEBAND_SENSOR_DATABASE, LAMBDA_TARGETS } from './lib/lambda-calc.js';
import { estimateMBT, calcKnockLimitedTiming, generateTimingCurve, calcDwellTime, recommendSparkPlugGap, calcSparkEnergy, generateIgnitionTable, listCoils, getCoil, searchCoils, listSparkPlugs, getSparkPlug, searchSparkPlugs, ignitionCalcStats, COIL_DATABASE, SPARK_PLUG_DATABASE } from './lib/ignition-calc.js';
import { calcViscosityAtTemp, calcOilPressure, sizeOilCooler, calcPumpFlow, interpretOilAnalysis, recommendOilSpec, listOils, getOil, listPumps, getPump, listCoolers, getCooler, searchOils, oilCalcStats, OIL_DATABASE, PUMP_DATABASE, COOLER_DATABASE } from './lib/oil-calc.js';
import { estimateN2OGain, calcTimingRetard as calcN2OTimingRetard, calcFuelEnrichment, calcBottlePressure, calcBottleDuration, calcPurge, safetyChecklist, listJets, getJet, searchJets, listBottles, getBottle, nitrousCalcStats, JET_DATABASE, BOTTLE_DATABASE } from './lib/nitrous-calc.js';
import { calcRunnerLength, calcRunnerDiameter, calcPlenumVolume, sizeThrottleBody, estimateAirflow, analyzeVariableIntake, estimatePortFlow, listManifolds, getManifold, searchManifolds, listThrottleBodies, getThrottleBody, searchThrottleBodies, intakeCalcStats, MANIFOLD_DATABASE, THROTTLE_BODY_DATABASE } from './lib/intake-calc.js';
import { startDatalogSession, appendDatalogSamples, endDatalogSession, getDatalogSession, listDatalogSessions, deleteDatalogSession, exportDatalogSession, analyzeLogData, detectAnomalies, correlateChannels, toCSV, toMegaLogViewer, toVCDS, calcSampleBudget, listLogProfiles, getLogProfile, listTriggerTypes, dataloggerStats, LOG_PROFILES, TRIGGER_TYPES } from './lib/datalogger.js';
import { calcBlendProperties, calcInjectorRequirement, calcFuelPumpRequirement, calcTimingAdvance, calcColdStartEnrichment, calibrateSensorFrequency, calcSensorVoltage, calcE85Conversion, listFuelBlends, getFuelBlend, listEthanolSensors, getEthanolSensor, searchEthanolSensors, flexfuelCalcStats, FUEL_BLENDS, ETHANOL_SENSOR_DATABASE } from './lib/flexfuel-calc.js';
import { validateSensorReading, validateMultipleSensors, diagnoseFromReadings, calcEngineHealthScore, analyzeFuelTrims, interpretO2Sensor, generateMaintenanceSchedule, listSensorRanges, getSensorRange, listDiagnosticPatterns, getDiagnosticPattern, classifyDTC as classifyDTCSeverity, ecuDiagnosticsStats, SENSOR_RANGES, DIAGNOSTIC_PATTERNS, DTC_SEVERITY } from './lib/ecu-diagnostics.js';
import { calcShiftPoints, calcLinePressure, calcTorqueConverterSlip, calcLaunchControl, optimizeShiftSchedule, calcClutchWear, recommendFluid, listTransmissionTypes, getTransmissionType, searchTransmissionTypes, listTorqueConverters, getTorqueConverter, listShiftProfiles, getShiftProfile, tcuTuningStats, TRANSMISSION_TYPES as TCU_TRANS_TYPES, TORQUE_CONVERTERS, SHIFT_PROFILES } from './lib/tcu-tuning.js';
import { calcCrawlRatio, calcSpeedAtRPM as calcDiffSpeed, calcRPMAtSpeed as calcDiffRPM, calcTorqueSplit, calcDiffTemp, recommendDiffRatio, recommendDiffFluid as recDiffFluid, calcTransferCaseGearing, listDiffTypes, getDiffType, searchDiffTypes, listDiffRatios, getDiffRatio, listTransferCases, getTransferCase, searchTransferCases, listDiffFluids, differentialCalcStats, DIFF_TYPES, DIFF_RATIOS, TRANSFER_CASES, DIFF_FLUIDS } from './lib/differential-calc.js';
import { calcSpringRate, calcDamperRatio, calcRideHeight, calcSwayBarEffect, calcCornerWeight, calcBumpSteer, calcAntiSquat, recommendAlignment, listSpringTypes, getSpringType, listDamperTypes, getDamperType, searchDamperTypes, listSwayBarSizes, listAlignmentSpecs, getAlignmentSpec, suspensionCalcStats, SPRING_TYPES, DAMPER_TYPES, SWAY_BAR_SIZES, ALIGNMENT_SPECS } from './lib/suspension-calc.js';
import { calcBrakeForce, calcStoppingDistance, calcBrakeBias, calcRotorTemp, calcKineticEnergy, calcPedalRatio, calcBrakeLineLength, recommendBrakeFluid, listPadCompounds, getPadCompound, searchPadCompounds, listRotorTypes, getRotorType, listBrakeFluids, getBrakeFluid, listCaliperTypes, getCaliperType, brakeCalcStats, PAD_COMPOUNDS, ROTOR_TYPES, BRAKE_FLUIDS, CALIPER_TYPES } from './lib/brake-calc.js';
import { calcTireDiameter, compareTireSizes, calcOffset, compareOffsets, calcSpeedoCorrection, calcLoadIndex, calcSpeedRating, calcStretchFit, listBoltPatterns, getBoltPattern, searchBoltPatterns, listTireTypes, getTireType, wheelTireCalcStats, BOLT_PATTERNS, TIRE_TYPES } from './lib/wheel-tire-calc.js';
import { calcDragForce, calcTopSpeed, calcDownforce, calcAeroBalance, calcSpeedEffect, calcAltitudeEffect, calcCdFromCoasting, listDragProfiles, getDragProfile, searchDragProfiles, listWingProfiles, getWingProfile, aeroCalcStats, DRAG_PROFILES, WING_PROFILES } from './lib/aero-calc.js';
import { calcLongitudinalTransfer, calcLateralTransfer, estimateCGHeight, analyzeDistribution, calcBallast, calcPayloadEffect, calcPowerToWeight, analyzeWeightReduction, listWeightClasses, getWeightClass, searchWeightClasses, listLayoutTypes, getLayoutType, weightDistCalcStats, WEIGHT_CLASSES, LAYOUT_TYPES } from './lib/weight-dist-calc.js';
import { calcCompressorOutletTemp, calcIntercoolerEfficiency, sizeIntercoolerCore, calcPressureDrop, sizeWaterToAir, recommendPipingDiameter, calcWaterInjection, analyzeHeatSoak, listIntercoolerTypes, getIntercoolerType, listCoreSizes, getCoreSize, listPipingMaterials, getPipingMaterial, intercoolerCalcStats, INTERCOOLER_TYPES, PIPING_MATERIALS, CORE_SIZES } from './lib/intercooler-calc.js';
import { calcVoltageDrop, recommendWireGauge, sizeAlternator, analyzeBattery, sizeFuseRelay, auditElectricalSystem, calcBig3Upgrade, listWireGauges, getWireGauge, listBatteryTypes, getBatteryType, listCommonLoads, getCommonLoad, searchCommonLoads, electricalCalcStats, WIRE_GAUGES, BATTERY_TYPES, COMMON_LOADS } from './lib/electrical-calc.js';
import { estimateEmissions, checkCompliance, estimateCO2, calcEGRImpact, estimateCatHealth, compareFuelEmissions, assessModImpact, listEmissionStandards, getEmissionStandard, listFuelProperties, getFuelProperty, listCatalystTypes, getCatalystType, emissionsCalcStats, EMISSION_STANDARDS, FUEL_PROPERTIES, CATALYST_TYPES } from './lib/emissions-calc.js';

async function createSelfChange(env,request,origin='user'){
  const c=await githubCredential(env);if(!c)return {ok:false,need:'github',message:'Self Update için GitHub bağlantısı gerekiyor. Credential Manager’da GitHub token + owner/repo ekle.'};
  const {repo,branch}=repoCfg(c), files={};
  for(const path of ['src/worker.js','public/app.js','public/index.html','public/app.css','schema.sql','ios/JARVIS/JarvisAPI.swift','ios/JARVIS/AppState.swift','ios/JARVIS/ContentView.swift','ios/JARVIS/SettingsView.swift','ios/project.yml','.github/workflows/deploy-cloudflare.yml','.github/workflows/ios-native-check.yml']){try{files[path]=(await repoFile(c,repo,path,branch)).content}catch(e){files[path]='/* unavailable: '+e.message+' */'}}
  const system=`Sen JARVIS'in kıdemli yazılım ajanısın. Kullanıcının istediği özelliği mevcut Cloudflare Workers uygulamasına uygula. Yalnızca gerekli dosyaları değiştir. Mevcut özellikleri bozma. Secret/API key yazma. Cloudflare Workers Web APIs kullan; Node-only API kullanma. Geriye uyumlu D1 migration kullan (CREATE TABLE IF NOT EXISTS / additive changes). ÇIKTI SADECE JSON: {"summary":"...","files":[{"path":"src/worker.js","content":"tam dosya içeriği"}],"tests":["..."]}. İzinli yollar: ${[...SELF_EDIT_ALLOW].join(', ')}.`;
  const prompt=`İSTEK: ${request}\n\nMEVCUT DOSYALAR:\n`+Object.entries(files).map(([k,v])=>`\n--- ${k} ---\n${v}`).join('\n');
  const a=await aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}]);let patch;
  try{patch=cleanAiJson(a.text)}catch(e){throw Error('SELF_UPDATE_BAD_AI_JSON:'+e.message)}
  if(!Array.isArray(patch.files)||!patch.files.length)throw Error('SELF_UPDATE_NO_FILES');if(patch.files.length>8)throw Error('SELF_UPDATE_TOO_MANY_FILES');
  for(const f of patch.files){if(!SELF_EDIT_ALLOW.has(f.path))throw Error('SELF_UPDATE_PATH_NOT_ALLOWED:'+f.path);if(typeof f.content!=='string'||f.content.length>350000)throw Error('SELF_UPDATE_INVALID_CONTENT:'+f.path);if(/(?:AIza|sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{20,})/.test(f.content))throw Error('SELF_UPDATE_SECRET_DETECTED:'+f.path)}
  const baseRef=await gh(c,`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`),sha=baseRef.object.sha,changeId=id(),short=changeId.slice(0,8),newBranch=`jarvis/${short}`;
  await gh(c,`/repos/${repo}/git/refs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ref:`refs/heads/${newBranch}`,sha})});
  for(const f of patch.files){let old=null;try{old=await repoFile(c,repo,f.path,branch)}catch{};await gh(c,`/repos/${repo}/contents/${encodeURIComponent(f.path).replaceAll('%2F','/')}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({message:`JARVIS: ${String(patch.summary||request).slice(0,120)}`,content:b64Utf8(f.content),branch:newBranch,...(old?.sha?{sha:old.sha}:{})})})}
  const pr=await gh(c,`/repos/${repo}/pulls`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:`JARVIS self-update: ${String(patch.summary||request).slice(0,100)}`,head:newBranch,base:branch,body:`Otomatik JARVIS değişikliği.\n\nİstek: ${request}\n\nAI provider: ${a.provider}\n\nTest planı:\n${(patch.tests||[]).map(x=>'- '+x).join('\n')}`})});
  try{await gh(c,`/repos/${repo}/issues/${pr.number}/labels`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({labels:['jarvis-auto']})})}catch{}
  await run(env,'INSERT INTO change_requests(id,request,origin,status,provider,repo,branch,pr_url,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',changeId,request,origin,'pr_open',a.provider,repo,newBranch,pr.html_url,String(patch.summary||''),now(),now());
  await log(env,'self-update',`Kod değişikliği hazırlandı: ${patch.summary||request}`,{pr:pr.html_url,provider:a.provider});
  return {ok:true,id:changeId,summary:patch.summary||request,pr:pr.html_url,status:'pr_open',provider:a.provider};
}
async function recordRuntimeError(env,e,ctx='fetch'){
  try{const msg=String(e?.stack||e?.message||e).slice(0,3000),fingerprint=await hmac(env.JARVIS_SECRET||'jarvis',ctx+'|'+msg.slice(0,800));await run(env,'INSERT INTO runtime_errors(id,ts,context,message,fingerprint,resolved) VALUES(?,?,?,?,?,0)',id(),now(),ctx,msg,fingerprint)}catch{}
}
async function selfHeal(env,force=false){
  try{
    const minCount=force?1:3, windowMs=force?3600000:86400000;
    const recent=await q1(env,`SELECT fingerprint,COUNT(*) n,MAX(message) message,MAX(context) context FROM runtime_errors WHERE resolved=0 AND ts>? GROUP BY fingerprint HAVING COUNT(*)>=${minCount} ORDER BY n DESC LIMIT 1`,now()-windowMs);
    if(!recent)return;
    const last=await q1(env,"SELECT created_at FROM change_requests WHERE origin='self-heal' ORDER BY created_at DESC LIMIT 1");
    if(last&&now()-last.created_at<(force?1800000:21600000))return;
    const r=await createSelfChange(env,`Tekrarlanan runtime hatasını düzelt. Context: ${recent.context}. Hata: ${recent.message}. Bu hata kullanıcıya uygulama içinde göründüyse kullanıcıdan manuel teşhis bekleme; repo kodundan sebebi bul ve düzelt.`,'self-heal');
    if(r.ok)await run(env,'UPDATE runtime_errors SET resolved=1 WHERE fingerprint=?',recent.fingerprint)
  }catch(e){await log(env,'self-heal','Self-heal çalışmadı',{error:e.message})}
}





async function liveStatus(env){
  const rows=await credentialRows(env),enabled=rows.filter(x=>Number(x.enabled)===1),ok=enabled.filter(x=>x.last_status==='ok');
  const envProviders=[];
  if(env.OPENAI_API_KEY)envProviders.push('OpenAI'); if(env.ANTHROPIC_API_KEY)envProviders.push('Anthropic'); if(env.GEMINI_API_KEY)envProviders.push('Gemini'); if(env.GROQ_API_KEY)envProviders.push('Groq'); if(env.OPENROUTER_API_KEY)envProviders.push('OpenRouter'); if(env.MISTRAL_API_KEY)envProviders.push('Mistral'); if(env.DEEPSEEK_API_KEY)envProviders.push('DeepSeek'); if(env.TOGETHER_API_KEY)envProviders.push('Together'); if(env.CEREBRAS_API_KEY)envProviders.push('Cerebras'); if(env.PERPLEXITY_API_KEY)envProviders.push('Perplexity'); if(env.XAI_API_KEY)envProviders.push('xAI'); if(env.AI)envProviders.push('Cloudflare AI');
  const names=[...new Set([...enabled.filter(x=>['gemini','groq','openrouter','nvidia','openai','anthropic','mistral','deepseek','together','cerebras','perplexity','xai','openai-compatible'].includes(String(x.provider).toLowerCase())).map(x=>x.label||x.provider),...envProviders])];
  const google=!!(await googleStored(env));
  const meta=enabled.some(x=>String(x.provider).toLowerCase()==='meta');
  const github=enabled.some(x=>String(x.provider).toLowerCase()==='github');
  return {ai:{connected:names.length>0,count:names.length,healthy:ok.length+envProviders.length,providers:names,router:await aiRouterStatus(env)},d1:{connected:!!env.DB},r2:{connected:true},google:{connected:google},social:{connected:meta},selfUpdate:{connected:github},passkeys:{count:await passkeyCount(env)}};
}

async function brief(env){const open=await q1(env,"SELECT COUNT(*) n FROM tasks WHERE status!='done'"), urgent=await q1(env,"SELECT COUNT(*) n FROM tasks WHERE status!='done' AND priority='Yüksek'"), pending=await q1(env,"SELECT COUNT(*) n FROM actions WHERE status='pending'"), top=await q1(env,"SELECT title FROM tasks WHERE status!='done' ORDER BY CASE priority WHEN 'Yüksek' THEN 0 WHEN 'Orta' THEN 1 ELSE 2 END, created_at ASC LIMIT 1");return{open:open?.n||0,urgent:urgent?.n||0,pending:pending?.n||0,top:top?.title||null,text:`${open?.n||0} açık görev var${urgent?.n?`, ${urgent.n} tanesi yüksek öncelikli`:''}. ${pending?.n?`${pending.n} işlem onayını bekliyor.`:'Onay bekleyen işlem yok.'}`}}
async function state(env){
  const [tasks,projects,memories,logs,actions,b,status]=await Promise.all([
    qall(env,'SELECT id,title,priority,status,area,created_at createdAt,updated_at updatedAt FROM tasks ORDER BY created_at DESC LIMIT 200'),
    qall(env,'SELECT id,title,type,status,notes,created_at createdAt,updated_at updatedAt FROM projects ORDER BY updated_at DESC LIMIT 200'),
    qall(env,'SELECT id,text,tags,created_at createdAt FROM memories ORDER BY created_at DESC LIMIT 100'),
    qall(env,'SELECT id,ts,kind,text,meta FROM logs ORDER BY ts DESC LIMIT 100'),
    qall(env,"SELECT id,type,payload,summary,risk,status,created_at createdAt FROM actions WHERE status='pending' ORDER BY created_at DESC LIMIT 100"),brief(env),liveStatus(env)]);
  return{tasks,projects,memories:memories.map(x=>({...x,tags:JSON.parse(x.tags||'[]')})),logs,actions,brief:b,status,
    integrations:{
      ai:{connected:status.ai.connected,provider:status.ai.providers.join(', ')||'AI sağlayıcısı yok',count:status.ai.count,healthy:status.ai.healthy},
      research:{connected:true,provider:'Web Search'},
      google:{connected:status.google.connected,provider:'Google OAuth'},
      credentials:{connected:(await q1(env,'SELECT COUNT(*) n FROM credentials'))?.n>0,provider:'Encrypted Vault'},
      cloud:{connected:true,provider:'Cloudflare Workers + D1'},
      files:{connected:status.r2.connected,provider:'Cloudflare R2'},
      social:{connected:status.social.connected,provider:'Meta Graph API'},
      selfUpdate:{connected:status.selfUpdate.connected,provider:'GitHub + Cloudflare CI'}},
    settings:await kvGet(env,'settings',{name:'Heido',language:'tr-TR',assistantName:'JARVIS'})}
}
async function ddg(q,ms=3500){const r=await fetchT('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q),{headers:{'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}},ms);if(!r.ok)throw Error('SEARCH_'+r.status);const h=await r.text(),out=[],re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;const clean=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/\s+/g,' ').trim();let m;while((m=re.exec(h))&&out.length<5)out.push({title:clean(m[2]),url:m[1].replace(/&amp;/g,'&'),snippet:clean(m[3])});return out}
async function sportsDbLookup(text,ms=2800){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 let team=null;if(/galatasaray|\bgs\b/.test(l))team='Galatasaray';else if(/fenerbahçe|fenerbahce|\bfb\b/.test(l))team='Fenerbahce';else if(/beşiktaş|besiktas|\bbjk\b/.test(l))team='Besiktas';else if(/trabzonspor/.test(l))team='Trabzonspor';
 if(!team)return [];
 const s=await fetchT('https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t='+encodeURIComponent(team),{},ms);
 if(!s.ok)return [];
 const sj=await s.json(),id=sj?.teams?.[0]?.idTeam;if(!id)return [];
 const [last,next]=await Promise.allSettled([
  fetchT('https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id='+encodeURIComponent(id),{},ms).then(r=>r.ok?r.json():null),
  fetchT('https://www.thesportsdb.com/api/v1/json/3/eventsnext.php?id='+encodeURIComponent(id),{},ms).then(r=>r.ok?r.json():null)
 ]);
 const events=[...(last.value?.results||[]),...(next.value?.events||[])].filter(Boolean).slice(0,8);
 return events.map(e=>({title:[e.dateEvent,e.strEvent,e.intHomeScore!=null&&e.intAwayScore!=null?e.intHomeScore+'-'+e.intAwayScore:null].filter(Boolean).join(' | '),url:'https://www.thesportsdb.com/event/'+(e.idEvent||''),snippet:[e.strLeague,e.strSeason,e.strVenue,e.strStatus,e.strTime].filter(Boolean).join(' - '),source:'TheSportsDB'}));
}
async function liveResearch(text,ms=3000){
 const queries=[liveSearchQuery(text)];
 // Throttled: max 2 DDG queries per message (was 5-8, caused Cloudflare abuse flag)
 if(isSportsQuestion(text)){
  const d=todayTR(),team=sportsTeamName(text);
  queries.push((team||String(text||''))+' '+d+' maç sonucu özet goller');
 }
 const seen=new Set(),out=[],per=Math.max(1200,Math.min(ms,2200));
 // Sequential DDG with delay between calls — no more parallel burst
 if(isSportsQuestion(text)){const sp=await sportsDbLookup(text,per).catch(()=>[]);for(const x of sp)if(x?.title){const k=(String(x.title||'')+'|'+String(x.url||'')).toLowerCase();if(!seen.has(k)){seen.add(k);out.push(x)}}}
 for(const q of queries){
  try{const res=await ddg(q,per);for(const x of res){const k=(String(x.title||'')+'|'+String(x.url||'')).toLowerCase();if(x?.title&&!seen.has(k)){seen.add(k);out.push(x)}}}catch{}
  if(queries.indexOf(q)<queries.length-1)await new Promise(r=>setTimeout(r,300)); // 300ms delay between queries
 }
 // Single media query if needed
 const mediaQueries=mediaSearchQueries(text);
 if(mediaQueries.length>0){
  try{const res=await ddg(mediaQueries[0],per);for(const x of res){const k=(String(x.title||'')+'|'+String(x.url||'')).toLowerCase();if(x?.title&&!seen.has(k)){seen.add(k);out.push({...x,kind:'media'})}}}catch{}
 }
 const media=out.filter(x=>x.kind==='media'),regular=out.filter(x=>x.kind!=='media');
 return regular.concat(media).slice(0,isSportsQuestion(text)?10:8);
}
async function behaviorSkills(env){
 const saved=await kvGet(env,'behavior_skills',[]);
 const base=[
  'Kullanıcı bir sorunu test amaçlı sorabilir; tek soruya özel yama yapma, genel davranış problemini düzelt.',
  'Kullanıcı senden işini yaptırmak istiyor; gereksiz izin istemeden araştır, kontrol et, bağlamı toparla ve uygulanabilir cevap ver.',
  'Canlı bilgi gerekiyorsa kullanıcıya siteye bak deme; önce bağlı arama/kaynak/entegrasyonları kendin dene, kaynak yetersizse net söyle.',
  'AI veya entegrasyon hata verirse teknik hata dökmek yerine kısa anlaşılır durum ver, logla, çalışan sağlayıcıya geç ve mümkünse yerel/arama yedeğiyle cevapla.',
  'Cevaplar ChatGPT gibi doğal, hızlı ve işe yarar olsun; kullanıcı detay istiyorsa kim/ne/ne zaman/nerede/neden/nasıl/rakam/sonuç/sonraki adım bilgisini doldur, tek cümleyle geçiştirme.',
  'Ayar, bağlantı, Google servisleri, konum, takvim, dosya ve otomasyon isteklerinde eksik bağlantıyı tespit et; kullanıcıya hangi ekranda ne yapacağını net göster.',
  'Kullanıcı kızgınsa savunmaya geçme; önce hatayı sahiplen, sonra somut düzeltmeyi uygula ve sonucu doğrula.',
  'Demo/video/PDF ile gelen davranışları kalıcı çalışma kuralına çevir; aynı şikayet tekrar ederse sistemi yeniden teşhis et.',
  'PROMPT MASTER: Kullanıcının kaba veya kısa isteğini doğrudan çalıştırmadan önce sessizce netleştir: görev, hedef araç/model, çıktı biçimi, kapsam, kısıtlar, mevcut bağlam, başarı kriteri ve gerekirse örnekleri çıkar.',
  'PROMPT MASTER: Kritik bilgi eksikse en fazla 3 hedefli soru sor; eksik bilgi kritik değilse kullanıcıyı prompt yazmaya zorlamadan makul varsayımla devam et.',
  'PROMPT MASTER: Kodlama ve ajan görevlerinde hedef durum, izinli dosya/kapsam, dokunulmaması gereken alanlar, onay sınırları, doğrulama/test ve bitiş koşulunu belirle. Geri döndürülemez veya kapsam dışı işlemde onay iste.',
  'PROMPT MASTER: Uzun veya dağınık talimatları gereksiz kelimelerden arındır; aynı kuralı tekrar etme. Kullanıcı sonucu ister, prompt teorisini değil. İç yönlendirmeyi kullanıcıya göstermeden doğru AI sağlayıcısına uygun biçimde uygula.',
  'PROMPT MASTER: Geçmiş kararlar varsa context carry-forward kullan; yeni talimat geçmiş mimariyle çelişirse bunu fark et ve çelişkiyi çözmeden eski kararı sessizce ezme.',
  'PROMPT MASTER: Gizli chain-of-thought isteme veya gösterme; sonuç, varsayım, kanıt, kısa gerekçe ve doğrulama çıktısı gibi denetlenebilir sonuçlar üret.'
 ];
 const extra=Array.isArray(saved)?saved:[];
 return [...base,...extra].filter(Boolean);
}
async function behaviorSkillText(env){
 const list=await behaviorSkills(env);
 return list.map((x,i)=>(i+1)+'. '+x).join('\n');
}
function answerDetailMode(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/detay|ayrıntı|ayrinti|özetle|ozetle|anlat|açıkla|acikla|nasıl|nasil|neden|niye|kim|hangi|kaç|kac|ne zaman|dakika|fiyat|karşılaştır|karsilastir|listele|adım adım|adim adim|crt|cart|curt/.test(l))return 'detailed';
 if(l.length<28&&/(nedir|ne demek|ne işe yarar|ne ise yarar)/.test(l))return 'compact_but_useful';
 return 'normal';
}
function responsePolicy(text){
 const mode=answerDetailMode(text);
 const base='Genel cevap politikası: Kullanıcı test sorusu soruyor olabilir; konuya özel ezber cevap verme, sorunun niyetine göre kaliteli cevap üret. Sadece spor değil; yemek, ürün, araba, hukuk, sağlık dışı genel bilgi, canlı bilgi, teknik ayar, fiyat, rota ve entegrasyon sorularında aynı kaliteyi uygula. Cevabı güçlendirecek video, görsel, resmi kaynak, ürün sayfası, klip, inceleme veya kanıt linki varsa bulup cevaba ekle; telifli medyayı kopyalama, resmi/erişilebilir bağlantı ver.';
 if(mode==='detailed')return base+' Bu soru detay istiyor: kim/ne/ne zaman/nerede/neden/nasıl/kaç/sonuç/rakam/önemli olaylar/sonraki adım bilgilerini mümkün olduğunca doldur. Tek cümleyle geçiştirme. İlgili medya/kanıt varsa “İlgili video/kaynak” bölümü ekle. Kaynakta veri yoksa uydurma; “bu detay kaynakta görünmedi” diye ayır.';
 if(mode==='compact_but_useful')return base+' Soru kısa ama faydalı cevap ister: 2-4 cümleyle tanım, ne işe yarar, önemli içerik/örnek ve pratik not ver. Sadece “X şudur” deyip bırakma; uygun link/video varsa sona ekle.';
 return base+' Cevap ne çok kısa ne gereksiz uzun olsun; kullanıcının işini görecek kadar bilgi, gerekirse madde madde pratik sonuç ve ilgili link/video ver.';
}
function isBadAssistantAnswer(s){
 s=String(s||'').toLocaleLowerCase('tr-TR');
 return /google aramasını dene|google'da ara|googleda ara|siteye bak|sitelerine bak|kendin kontrol et|göz atabilirsiniz|goz atabilirsiniz|arama motorunda ara|bilemem|bilgim yok/.test(s);
}
function mediaSearchQueries(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR'),q=String(text||'').trim(),d=todayTR?.()||new Date().toISOString().slice(0,10),team=typeof sportsTeamName==='function'?sportsTeamName(text):'';
 const out=[];
 if(/maç|mac|gol|özet|ozet|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig/.test(l)){
  const base=(team||q)+' '+d;
  out.push(base+' gol videosu resmi');
  out.push(base+' maç özeti video beIN SPORTS');
  out.push(base+' highlights video');
 }else if(/ürün|urun|inceleme|review|nasıl yapılır|nasil yapilir|tamir|arıza|ariza|montaj|kurulum|ayar|bağla|bagla|kullanım|kullanim/.test(l)){
  out.push(q+' video inceleme');
  out.push(q+' nasıl yapılır video');
  out.push(q+' YouTube resmi anlatım');
 }else if(/görsel|gorsel|foto|resim|video|klip|kanıt|kanit|örnek|ornek/.test(l)){
  out.push(q+' video');
  out.push(q+' görsel kaynak');
 }
 return out.slice(0,3);
}
function isMediaResult(x){
 const u=String(x?.url||'').toLowerCase(),t=String(x?.title||'').toLowerCase();
 return /youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|beinsports|bein sports|video|highlights|özet|ozet|gol/.test(u+' '+t);
}
function isSportsQuestion(text){
 return /maç|mac|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig|spor|lig|hangi kanalda|fikstür|fikstur/.test(String(text||'').toLocaleLowerCase('tr-TR'));
}
function todayTR(){try{return new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'long',year:'numeric'}).format(new Date())}catch{return new Date().toISOString().slice(0,10)}}
function sportsDetailNeed(text){return /özet|ozet|gol|kim attı|kim atti|kaçıncı dakika|kacinci dakika|dakika|kart|penaltı|penalti|asist|maçını|macini/.test(String(text||'').toLocaleLowerCase('tr-TR'))}
function sportsTeamName(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/galatasaray|\bgs\b/.test(l))return 'Galatasaray';
 if(/fenerbahçe|fenerbahce|\bfb\b/.test(l))return 'Fenerbahçe';
 if(/beşiktaş|besiktas|\bbjk\b/.test(l))return 'Beşiktaş';
 if(/trabzonspor/.test(l))return 'Trabzonspor';
 return '';
}
function liveSearchQuery(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR'),d=todayTR(),team=sportsTeamName(text);
 if(team)return team+' '+d+' maç sonucu gol atanlar kaçıncı dakika maç özeti';
 if(/maç|mac|süper lig|super lig|spor|lig/.test(l))return text+' '+d+' maç sonucu gol atanlar özet';
 return text;
}
function compactResearchAnswer(text,results=[]){
 const clean=(results||[]).filter(x=>x&&x.title).slice(0,4);
 if(!clean.length)return null;
 const lines=clean.map(x=>`- ${x.title}${x.snippet?' — '+x.snippet:''}`);
 return `AI sağlayıcısı cevap veremedi ama ben aramayı yaptım. Bulduğum bilgiye göre:

${lines.join('\n')}`;
}
function researchFallbackAnswer(text,results=[]){
 const clean=(results||[]).filter(x=>x&&x.title).slice(0,5);
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(!clean.length){
  if(isSportsQuestion(text))return 'Canlı maç kaynağı şu an boş döndü. Kesin skor uydurmuyorum; ama sorunu kaybettirmedim ve çalışan AI sağlayıcısına kısa özet/yorum için geçiyorum.';
  return 'Canlı kaynak şu an boş döndü. Kesin bilgi uydurmuyorum; çalışan AI sağlayıcısı ve yerel yedekle cevaplamaya devam ediyorum.';
 }
 const lines=clean.map((x,i)=>`${i+1}. ${x.title}${x.snippet?' - '+x.snippet:''}${x.url?' ('+x.url+')':''}`);
 if(isSportsQuestion(text)){
  return `Baktım. Canlı kaynaklardan netleştirebildiğim maç bilgisi şu:

${lines.join('\n')}

Saat/kanal değişebildiği için resmi kulüp, TFF veya yayıncı bilgisini esas aldım; sonuçlar yetersizse bunu açıkça söylerim, seni Google'a göndermem.`;
 }
 return `Baktım. Ulaşabildiğim canlı sonuçların özeti:

${lines.join('\n')}

Kaynaklar yetersizse bunu açıkça söylerim; seni aramaya göndermem.`;
}
function localFallbackAnswer(text,error=''){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 if(/kola|cola|coca.?cola|pepsi/.test(l)&&/(nedir|ne demek|içinde|icinde|içindeki|icindeki|element|madde|neler var|ne var|bileşen|bilesen|içerik|icerik)/.test(l)){
  if(/nedir|ne demek/.test(l)&&!/(içinde|icinde|element|madde|içerik|icerik)/.test(l))return 'Kola; su, şeker veya tatlandırıcı, karbondioksit, kafein, asitlik düzenleyici ve aroma karışımıyla yapılan gazlı bir içecektir. Yani temel olarak gazlı, tatlı ve kafeinli bir meşrubattır.';
  return `Kolanın temel içeriği genelde şunlardır:

- Su
- Şeker veya tatlandırıcı
- Karbondioksit: gazlı yapan madde
- Karamel renklendirici
- Fosforik asit veya sitrik asit: ekşi/sert tadı verir
- Kafein: uyarıcı etki
- Aroma karışımı: markaya göre gizli formül
- Bazı çeşitlerde koruyucu/asitlik düzenleyici maddeler

Kimyasal element olarak bakarsan en çok karbon, hidrojen ve oksijen vardır; karbondioksitten karbon/oksijen, fosforik asitten fosfor da gelir. Yani “element” değil “içindekiler” diye sorarsak cevap daha çok su, şeker, CO2, asit, kafein ve aroma olur.`;
 }
 if(/fırında|firinda/.test(l)&&/tavuk/.test(l)){
  return `Fırında tavuk için pratik ayar:

- Fanlı fırın: 190°C
- Alt-üst: 200°C
- Kanat/pirzola küçük parçalar: 35-45 dakika
- But/kalın parça: 45-60 dakika
- Son 8-10 dakika 220°C yaparsan üstü güzel kızarır.

Tepsiye çok üst üste koyma. Soslu tavukta ilk 25-30 dakika pişir, sonra çevir. İçinin güvenli olması için en kalın yerde suyu berrak akmalı; termometre varsa iç sıcaklık 74°C üstü olsun.`;
 }
 if(/anzeige|şikayet|sikayet|polise|polis/.test(l)){
  return `Almanya'da polise Anzeige yapmak için kısa yol:

1. Acil tehlike varsa 110 ara.
2. Acil değilse eyaletinin Onlinewache/Internetwache sitesinden online Anzeige yapabilirsin.
3. Olay yeri, tarih-saat, karşı taraf bilgisi, ekran görüntüsü/fotoğraf/video ve tanık varsa hazırla.
4. Yakındaki Polizeidienststelle'ye gidip sözlü Anzeige de verebilirsin.
5. İşlem sonunda Vorgangsnummer/Aktenzeichen iste ve sakla.

Bana şehir/eyaletini yazarsan sana doğru Onlinewache linkini net veriririm.`;
 }
 if(/google|gmail|calendar|drive|docs|maps|youtube|search/.test(l)&&/(bağla|bagla|servis|ayar|izin|oauth)/.test(l)){
  return `Google servisleri için gereken akış şu olmalı:

1. Ayarlar > Google servisleri bölümünden bağlantı ekranı açılır.
2. Backend'de Google OAuth Client ID ve Client Secret tanımlı olmalı.
3. Redirect URL Google Cloud Console'a birebir eklenmeli.
4. Kullanıcı Safari'de Google hesabıyla izin verir.
5. Dönen token güvenli kasaya kaydedilir; Gmail, Calendar, Drive, Docs, Maps/Search/YouTube istekleri oradan çalışır.

Şu an bağlantı cevap vermiyorsa sorun genelde OAuth ayarı veya backend timeout tarafında. JARVIS bunu kullanıcıya sadece \"siteye bak\" diye bırakmamalı; bağlantı durumunu kendisi test edip eksik alanı söylemeli.`;
 }
 if(/nasıl|nasil|ne yap|anlat|tarif|kaç|kac|neden|niye|olur mu|olurmu/.test(l)){
  return `Bağlı AI servisleri şu an cevap vermedi ama isteğini kaybettirmedim. Bu soru için hızlı cevap verebilmem gerekiyor; servisler düşse bile JARVIS'in yerel yedek cevabı devreye girdi. Teknik ayrıntıyı sana dökmek yerine arka planda logladım. Soruyu biraz daha net yazarsan kısa pratik cevapla devam ederim.`;
 }
 return null;
}
async function discoverTools(env,cap){const q=`best AI tool ${cap} API automation`;const results=await ddg(q);return results.slice(0,6)}
function needsLiveLookupText(text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');
 return /(güncel|guncel|bugün|bugun|şimdi|simdi|son durum|sonuç|sonuc|fiyat|kaç para|kac para|ne kadar|satılıyor|satiliyor|nerede|nerden|nereden|yakınımda|yakinimda|açık mı|acik mi|uçuş|ucus|tren|kargo|rezervasyon|seçim|secim|hava durumu|kur|borsa|sigara|market|amazon|ebay|link|araştır|arastir|bakabilir|bakıp|bakip|kontrol et|bak|maç|mac|galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig|spor|lig)/.test(l);
}
async function quickCommand(env,text){
 const l=String(text||'').toLocaleLowerCase('tr-TR');

 // YouTube URL otomatik öğrenme
 const ytMatch=text.match(/https?:\/\/(?:(?:www|m)\.)?(?:youtube\.com\/watch\?[^\s]*v=[A-Za-z0-9_-]+|youtu\.be\/[A-Za-z0-9_-]+)/i);
 if(ytMatch&&/öğren|learn|izle|watch|kaydet|öğret|analiz/i.test(l)){
   try{
     const{parseYouTubeResourceUrl,fetchYouTubeTranscript}=await import('./lib/youtube-teaching-runtime.js');
     const{persistYouTubeLearning}=await import('./lib/youtube-learning-memory.js');
     const parsed=parseYouTubeResourceUrl(ytMatch[0]);
     if(parsed?.videoId){
       const result=await fetchYouTubeTranscript(ytMatch[0]);
       if(result?.transcript){
         const lr=await persistYouTubeLearning(env,{kind:'video',source_url:ytMatch[0],video_id:parsed.videoId,title:result.title||'',language:result.language||'',transcript:result.transcript},{});
         return{reply:`✓ Video öğrenildi: "${result.title||'Video'}"\n\n${lr.learning_chunks} parça hafızaya kaydedildi (${result.transcript.length} karakter). Artık bu konuda sorduğun sorularda bu videodan öğrendiğim bilgiyi kullanacağım.`,action:'youtube_learn',provider:'JARVIS Skill'};
       }
     }
   }catch(e){
     return{reply:`YouTube transcript çekilemedi: ${e.message}. Video'da altyazı kapalı olabilir.`,action:'youtube_learn_error',provider:'JARVIS Skill'};
   }
 }

 // Sadece DTC kodu sorulmuşsa direkt veritabanından cevapla (AI çağırmadan)
 const dtcOnly=text.match(/^\s*([PBCU][0-3]\d{3})\s*$/i);
 if(dtcOnly){
   try{
     const code=dtcOnly[1].toUpperCase();
     const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);
     if(row){
       const causes=(safeJsonParse(row.causes,[])||[]).map((c,i)=>`${i+1}. [${c.p||'?'}] ${c.de||c.en||c.id}`).join('\n');
       const repair=safeJsonParse(row.repair,{});
       let reply=`**${code}** — ${row.title_de||row.title_en}\n\n${row.desc_de||row.desc_en}`;
       if(causes)reply+=`\n\nOlası sebepler:\n${causes}`;
       if(repair.difficulty)reply+=`\n\nTamir: ${repair.difficulty}${repair.diy_possible?' · DIY mümkün':''}${repair.estimated_cost_eur?` · €${repair.estimated_cost_eur[0]}–${repair.estimated_cost_eur[1]}`:''}`;
       return{reply,action:'dtc_lookup',provider:'JARVIS DTC Database'};
     }
   }catch{}
 }

 if(needsLiveLookupText(text)){
  let results=[];try{results=await withTimeout(liveResearch(text,isSportsQuestion(text)?2300:2800),3000,'LIVE_RESEARCH_TOTAL_TIMEOUT')}catch{}
  const system='Sen JARVIS adlı Türkçe asistansın. Kullanıcıya doğrudan ve işe yarar cevap ver. Google’a yönlendirme, “kendin bak” deme. '+responsePolicy(text)+' Canlı/web sonuçları varsa değerlendir; tek cümleyle geçiştirme. Sonuçlarda video/klip/ürün/resmi kaynak bağlantısı varsa cevabın sonuna “İlgili video/kaynak” diye ekle. Bugünkü/şimdiki sorularda eski/sonraki sonuçları karıştırma. Detay kaynakta yoksa bunu açık yaz, uydurma.';
  const prompt='Bugünün tarihi: '+todayTR()+'\nKullanıcı sorusu: '+text+'\n\nCanlı/web sonuçları: '+JSON.stringify(results.slice(0,12));
  try{const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}],{userText:text,mode:'fast'}),3800,'LIVE_AI_TIMEOUT');if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:results.length?'live_ai_research':'live_ai_no_results',provider:a.provider,results:results.slice(0,6)}}catch{}
  const local=localFallbackAnswer(text,'');
  if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'JARVIS Local'};
  return{reply:researchFallbackAnswer(text,results),action:'live_research',provider:results.length?'JARVIS Live Search':'JARVIS Live Search: empty',results:results.slice(0,5)};
 }
 const local=localFallbackAnswer(text,'');
 if(local&&!/Bağlı AI servisleri/.test(local))return{reply:local,action:'local_fallback',provider:'JARVIS Local'};
 const system="Sen JARVIS — Türkçe kişisel asistan. HER ZAMAN Türkçe cevap ver. Doğal, samimi ve net konuş. Kullanıcıya \"Google’da ara\" veya \"siteye bak\" deme. Bilmediğini uydurma, açıkça söyle. "+responsePolicy(text);
 try{
  const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:text}],{userText:text,mode:'fast'}),8500,'QUICK_AI_TIMEOUT');
  if(a?.text&&!isBadAssistantAnswer(a.text))return{reply:a.text,action:'ai',provider:a.provider};
 }catch{}
 try{
  const results=await ddg(text+' nedir açıklama',2800);
  const answer=compactResearchAnswer(text,results);
  if(answer)return{reply:answer,action:'search_fallback',provider:'JARVIS Search',results:results.slice(0,4)};
 }catch{}
 return{reply:local||'Şu an bağlı cevap motoru zamanında dönemedi. Sorunu kaydettim; kısa cevap için tekrar deniyorum ve çalışan sağlayıcıları öne alıyorum.',action:'local_fallback',provider:'JARVIS Local'};
}
async function command(env,text){await log(env,'user',text);const l=text.toLocaleLowerCase('tr-TR');const remembered=await rememberExplicit(env,text);if(remembered){const reply=`Bunu hafızama kaydettim: ${remembered}`;await log(env,'jarvis',reply);return{reply,action:'memory'}}
 if(/davranış becerileri|davranis becerileri|çalışma kuralları|calisma kurallari|skills cloud|claude\.md|jarvis kuralları|jarvis kurallari/.test(l)){const reply='JARVIS davranış becerileri aktif:\n'+await behaviorSkillText(env);await log(env,'jarvis',reply,{provider:'JARVIS Behavior Skills'});return{reply,action:'behavior_skills',provider:'JARVIS Behavior Skills'}}
 if(/görev.*ekle|hatırlat/.test(l)){const title=text.replace(/^(jarvis[, ]*)?/i,'').replace(/görev.*ekle[: ]*/i,'').replace(/bana hatırlat[: ]*/i,'').trim()||text;const t=now();await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id(),title,'Orta','open','genel',t,t);const reply=`Görevi ekledim: ${title}`;await log(env,'jarvis',reply);return{reply,action:'task'}}
 if((l.includes('bugün')&&(l.includes('ne yapt')||l.includes('özet')||l.includes('neler oldu')))||l.includes('günlük brief')){const b=await brief(env);const reply=`Bugünkü durum: ${b.text}${b.top?` Sıradaki iş: ${b.top}.`:''}`;await log(env,'jarvis',reply);return{reply,action:'brief'}}
 if(l.startsWith('araştır ')||l.includes('internette araştır')){const q=text.replace(/^araştır\s*/i,'').replace(/internette araştır/ig,'').trim()||text;const results=await ddg(q),reply=`Araştırmayı yaptım. ${results.length} sonuç buldum${results[0]?`: ${results[0].title}`:''}.`;await log(env,'jarvis',reply,{q,count:results.length});return{reply,action:'research',results}}
 if(/(?:jarvis[, ]*)?(?:şunu|sunu|bu|şu)?\s*(?:özelliği|özellik|modül|modulu|panel|fonksiyon).*ekle|kendini.*(?:düzelt|güncelle|iyileştir)|(?:hata|bug).*?(?:bul|düzelt)|(?:ekle|değiştir|düzelt).*?(?:jarvis|uygulama)/i.test(text)){const r=await createSelfChange(env,text,'user');const reply=r.ok?`İsteği kendi koduma uygulamak için değişikliği hazırladım: ${r.summary}. Otomatik test/deploy hattına gönderdim.`:r.message;await log(env,'jarvis',reply,r);return{reply,action:'self_update',selfUpdate:r}}
 if(/reels|video oluştur|görsel oluştur|şarkı.*üret|seslendir|altyazı/.test(l)){let cap='content-generation';if(/reels|video/.test(l))cap='reels-video';else if(/görsel/.test(l))cap='image-generation';else if(/şarkı|müzik/.test(l))cap='music-generation';else if(/seslendir/.test(l))cap='tts';else if(/altyazı/.test(l))cap='transcription';const tools=await qall(env,'SELECT * FROM tool_registry WHERE capability=? AND enabled=1 ORDER BY priority ASC',cap);if(!tools.length){const found=await discoverTools(env,cap);const reply=`Bu iş için henüz bağlı bir araç yok. ${found.length} uygun AI aracı buldum; Araç Keşfi bölümünde göstereceğim.`;await log(env,'jarvis',reply,{cap});return{reply,action:'tool_discovery',cap,tools:found}}}
 const needsLiveResearch=needsLiveLookupText(text)||/(nedir|ne demek|ne işe yarar|ne ise yarar|içinde|icinde|içindeki|icindeki|neler var|ne var|kimdir|hangisi|nasıl|nasil)/.test(l);
 let researchContext='',researchResults=[];
 if(needsLiveResearch){
  try{
   researchResults=await liveResearch(text,isSportsQuestion(text)?2400:3200);
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA SONUÇLARI (kullanıcıya sitelere kendin bak deme; bu sonuçları değerlendir, yeterli değilse erişemediğini açık söyle; detay sorulduysa kim/ne/ne zaman/nerede/neden/nasıl/rakam/sonuç bilgilerini doldur; video/klip/resmi kaynak/ürün linki varsa “İlgili video/kaynak” olarak ekle): '+JSON.stringify(researchResults.slice(0,10));
   await log(env,'research','Otomatik araştırma: '+text,{count:researchResults.length});
  }catch(e){
   researchContext='\\n\\nCANLI/WEB ARAŞTIRMA DENEMESİ BAŞARISIZ: '+e.message+'. Kullanıcıya rastgele siteye bak demek yerine, erişemediğini açık söyle ve hangi resmi kaynağın gerektiğini belirt.';
   await log(env,'research','Otomatik araştırma başarısız: '+text,{error:e.message});
  }
 }
 if(needsLiveResearch&&researchResults.length){
  const system='Sen JARVIS adlı Türkçe asistansın. Canlı/web sonuçlarını kullanarak doğrudan cevap ver. Kullanıcıyı aramaya yönlendirme. '+responsePolicy(text)+' Sonuçlarda video/klip/resmi kaynak/ürün linki varsa cevabın sonuna “İlgili video/kaynak” bölümü ekle. Bugünkü/şimdiki sorularda eski/sonraki verileri karıştırma.';
  const prompt='Bugünün tarihi: '+todayTR()+'\nKullanıcı sorusu: '+text+'\n\nCanlı/web sonuçları: '+JSON.stringify(researchResults.slice(0,12));
  try{const a=await withTimeout(aiFallback(env,[{role:'system',content:system},{role:'user',content:prompt}],{userText:text,mode:'fast'}),3800,'LIVE_AI_TIMEOUT');if(a?.text&&!isBadAssistantAnswer(a.text)){await log(env,'jarvis',a.text,{provider:a.provider,direct:true});return{reply:a.text,action:'live_ai_research',provider:a.provider,results:researchResults.slice(0,6)}}}catch(e){await recordRuntimeError(env,e,'command.live_ai')}
 }
 const s=await state(env),history=await chatHistory(env,30),mem=await qall(env,'SELECT text,tags FROM memories ORDER BY created_at DESC LIMIT 30'),skills=await behaviorSkillText(env),policy=responsePolicy(text);
 // YouTube öğrenme hafızasını ara — ücretsiz, AI çağrısı değil
 let learningContext='';
 try{const{searchLearningMemory,learningContextText}=await import('./lib/youtube-learning-memory.js');const lRows=await searchLearningMemory(env,text,{limit:4});if(lRows.length)learningContext='\n\nÖĞRENİLMİŞ VİDEO NOTLARI (YouTube\'dan öğrenilen içerik — bu bilgileri cevabında kullan):\n'+learningContextText(lRows)}catch{}
 // DTC kodu tespit — P0xxx, B0xxx, C0xxx, U0xxx formatında
 let dtcContext='';
 try{const dtcMatches=text.match(/\b[PBCU][0-3]\d{3}\b/gi);if(dtcMatches){const unique=[...new Set(dtcMatches.map(c=>c.toUpperCase()))].slice(0,5);const results=[];for(const code of unique){const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);if(row)results.push({code,title_en:row.title_en,title_de:row.title_de,desc_en:row.desc_en,parts:safeJsonParse(row.parts,[]),causes:safeJsonParse(row.causes,[]),repair:safeJsonParse(row.repair,{})})}if(results.length)dtcContext='\n\nDTC VERİTABANI SONUÇLARI (9204 kodluk OBDex veritabanından — bu bilgileri cevabında kullan, tek DTC\'ye körü körüne bağlanma, bütün hata ağını değerlendir):\n'+JSON.stringify(results)}}catch{}
 const permanentStudy=ecuPermanentStudyContext(text);
 const memShort=mem.slice(0,15).map(x=>x.text).join('; ');
 const taskShort=s.tasks.slice(0,10).map(x=>x.title).join(', ');
 const system=`Sen JARVIS — Türkçe kişisel asistan ve ECU tuning uzmanı. HER ZAMAN Türkçe cevap ver. Doğal, samimi, net konuş. Kullanıcıya "Google'a bak" veya "siteye gir" deme; bilmiyorsan açıkça söyle. Kısa sorulara kısa, detaylı sorulara detaylı cevap ver. ${policy}
Hafıza: ${memShort}
Aktif görevler: ${taskShort}${researchContext}${learningContext}${permanentStudy}${dtcContext}`;let a;try{a=await aiFallback(env,[{role:'system',content:system},...history.slice(-20,-1).map(x=>({role:x.role==='assistant'?'assistant':'user',content:x.content})),{role:'user',content:text}],{userText:text})}catch(e){const msg=String(e?.message||e||'UNKNOWN').slice(0,500),fallback=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,researchResults),reply=fallback||'Şu an bağlı AI servisleri zamanında cevap vermedi. Teknik hatayı kaydettim; ayarlardaki AI sağlayıcısı/model anahtarlarını yenilemek gerekiyor.';await recordRuntimeError(env,e,'chat.ai');await log(env,'jarvis',reply,{provider:'system',error:msg});return{reply,action:fallback?'local_fallback':'ai_error',provider:fallback?'JARVIS Local':'system'}}if(!String(a.text||'').trim()){const reply='AI sağlayıcısı boş cevap döndürdü. Bunu hata olarak kaydettim; başka sağlayıcı veya ayar kontrolü gerekiyor.';await recordRuntimeError(env,Error('EMPTY_AI_REPLY:'+a.provider),'chat.ai');await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai_error',provider:a.provider}}
 let reply=a.text;
 if(isBadAssistantAnswer(reply)){
  await aiRouterMark(env,a.provider,false,'BAD_ASSISTANT_ANSWER');
  const fixed=researchFallbackAnswer(text,researchResults)||localFallbackAnswer(text,'BAD_ASSISTANT_ANSWER');
  if(fixed){reply=fixed;await log(env,'jarvis',reply,{provider:'JARVIS Guard',blockedProvider:a.provider});return{reply,action:'guarded_fallback',provider:'JARVIS Guard',results:researchResults.slice(0,5)}}
 }
 await log(env,'jarvis',reply,{provider:a.provider});return{reply,action:'ai',provider:a.provider}}
async function router(req,env,ctx=null){const u=new URL(req.url),p=u.pathname,m=req.method;
 if(p==='/api/health')return j({ok:true,cloud:true,ts:now()});
 if(p==='/api/auth/passkey/auth/options'&&m==='POST'){const x=await authenticationOptions(req,env);return x?.error?j({error:x.error},x.status||400):j(x)}
 if(p==='/api/auth/passkey/auth/verify'&&m==='POST'){const x=await verifyAuthentication(req,env);return x.ok?j({ok:true,verified:true},200,{'set-cookie':x.cookie}):j({error:x.error||'PASSKEY_VERIFY_FAILED'},400)}
 if(p==='/api/auth/status'){const cfg=!!(await kvGet(env,'auth',null));return j({configured:cfg,authenticated:await isAuthed(req,env),passkeys:await passkeyCount(env)})}
 if(p==='/api/auth/setup'&&m==='POST'){if(await kvGet(env,'auth',null))return j({error:'ALREADY_CONFIGURED'},409);const b=await body(req),pw=String(b.password||'');if(pw.length<8)return j({error:'PASSWORD_MIN_8'},400);const salt=id(),auth={salt,hash:await hashPassword(pw,salt)};await kvSet(env,'auth',auth);const tok=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'owner',exp:now()+2592e6});return j({ok:true},200,{'set-cookie':cookie(tok)})}
 if(p==='/api/auth/login'&&m==='POST'){const rl=await rateLimit(env,clientIP(req),'auth-login',5,300000);if(!rl.allowed)return rateLimitResponse(rl.retryAfter);const auth=await kvGet(env,'auth',null),b=await body(req);if(!auth)return j({error:'NOT_CONFIGURED'},400);if(await hashPassword(String(b.password||''),auth.salt)!==auth.hash)return j({error:'INVALID_PASSWORD'},403);const tok=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'owner',exp:now()+2592e6});return j({ok:true},200,{'set-cookie':cookie(tok)})}
 if(p==='/api/auth/logout'&&m==='POST')return j({ok:true},200,{'set-cookie':cookie('',0)});
 if(p==='/api/runtime/report'&&m==='POST'){const rl=await rateLimit(env,clientIP(req),'runtime-report',5,60000);if(!rl.allowed)return rateLimitResponse(rl.retryAfter);const b=await body(req),message=String(b.message||b.error||'UNKNOWN').slice(0,3000),context=String(b.context||'ios').slice(0,200),userText=String(b.userText||'').slice(0,1000);await recordRuntimeError(env,Error(message),context+(userText?' | user: '+userText:''));await log(env,'runtime','Uygulama hatası raporlandı',{context,message:message.slice(0,500),userText});return j({ok:true,queued:true})}
  if(p.startsWith('/api/')&&!(await isAuthed(req,env)))return j({error:'AUTH_REQUIRED'},401);
 if(p==='/api/auth/passkey/register/options'&&m==='POST')return j(await registrationOptions(req,env));
 if(p==='/api/auth/passkey/register/verify'&&m==='POST'){const x=await verifyRegistration(req,env);return x.ok?j(x):j({error:x.error||'PASSKEY_VERIFY_FAILED'},400)}
 if(p==='/api/auth/passkeys'&&m==='GET')return j(await passkeys(env));
 let pkm=p.match(/^\/api\/auth\/passkeys\/([^/]+)$/);if(pkm&&m==='DELETE'){await run(env,'DELETE FROM passkeys WHERE id=?',decodeURIComponent(pkm[1]));await log(env,'auth','Passkey silindi');return j({ok:true})}
 if(p==='/api/credentials'&&m==='GET')return j(await credentialRows(env));
 if(p==='/api/credentials'&&m==='POST'){
   const b=await body(req),provider=String(b.provider||'').trim(),label=String(b.label||provider).trim(),secret=String(b.secret||'').trim();
   if(!provider||!secret)return j({error:'PROVIDER_AND_SECRET_REQUIRED'},400);
   const x={id:id(),provider,label,kind:b.kind||'api_key',encrypted:await encSecret(env,secret),caps:Array.isArray(b.capabilities)?b.capabilities:['chat'],endpoint:b.endpoint||null,model:b.model||null,priority:Number(b.priority||100),meta:b.meta||{},t:now()};
   await run(env,'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',x.id,x.provider,x.label,x.kind,x.encrypted,JSON.stringify(x.caps),x.endpoint,x.model,x.priority,1,JSON.stringify(x.meta),'untested',x.t,x.t);
   await log(env,'credential','Yeni sağlayıcı eklendi: '+x.label,{provider:x.provider,capabilities:x.caps});return j({ok:true,id:x.id})
 }
 let cm=p.match(/^\/api\/credentials\/([^/]+)$/);if(cm&&m==='DELETE'){await run(env,'DELETE FROM credentials WHERE id=?',cm[1]);return j({ok:true})}
 cm=p.match(/^\/api\/credentials\/([^/]+)\/toggle$/);if(cm&&m==='POST'){const c=await q1(env,'SELECT enabled FROM credentials WHERE id=?',cm[1]);if(!c)return j({error:'NOT_FOUND'},404);await run(env,'UPDATE credentials SET enabled=?,updated_at=? WHERE id=?',c.enabled?0:1,now(),cm[1]);return j({ok:true})}
 cm=p.match(/^\/api\/credentials\/([^/]+)\/test$/);if(cm&&m==='POST'){const c=await q1(env,'SELECT * FROM credentials WHERE id=?',cm[1]);if(!c)return j({error:'NOT_FOUND'},404);c.secret=await decSecret(env,c.encrypted_secret);return j(await testCredential(env,c))}
 if(p==='/api/self-update/status'){const c=await githubCredential(env),changes=await qall(env,'SELECT id,request,origin,status,provider,repo,branch,pr_url,summary,created_at,updated_at FROM change_requests ORDER BY created_at DESC LIMIT 50');return j({connected:!!c,repo:c?repoCfg(c).repo:null,changes})}
 if(p==='/api/self-update/request'&&m==='POST'){const b=await body(req),request=String(b.request||'').trim();if(!request)return j({error:'REQUEST_REQUIRED'},400);return j(await createSelfChange(env,request,'user'))}

 if(p==='/api/google/setup-info'&&m==='GET'){const c=await googleCredential(env),rp=rpFrom(req);return j({configured:!!c,connected:!!(await googleStored(env)),redirect:rp.origin+'/api/google/callback',client_id:c?.endpoint||null})}
 if(p==='/api/google/setup'&&m==='POST'){const b=await body(req),clientId=String(b.client_id||'').trim(),clientSecret=String(b.client_secret||'').trim();if(!clientId||!clientSecret)return j({error:'GOOGLE_CLIENT_ID_AND_SECRET_REQUIRED'},400);if(!clientId.includes('.apps.googleusercontent.com'))return j({error:'GOOGLE_CLIENT_ID_INVALID',detail:'Client ID .apps.googleusercontent.com ile bitmeli'},400);const t=now(),existing=await q1(env,"SELECT id FROM credentials WHERE provider='google' ORDER BY created_at DESC LIMIT 1"),enc=await encSecret(env,clientSecret);if(existing){await run(env,"UPDATE credentials SET label=?,kind=?,encrypted_secret=?,capabilities=?,endpoint=?,model=?,priority=?,enabled=1,last_status='ok',last_error=NULL,updated_at=? WHERE id=?",'Google OAuth','oauth_client',enc,JSON.stringify(['gmail','drive']),clientId,null,10,t,existing.id)}else{await run(env,'INSERT INTO credentials(id,provider,label,kind,encrypted_secret,capabilities,endpoint,model,priority,enabled,meta,last_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id(),'google','Google OAuth','oauth_client',enc,JSON.stringify(['gmail','drive']),clientId,null,10,1,JSON.stringify({}),'ok',t,t)}await log(env,'credential','Google OAuth istemcisi kaydedildi');return j({ok:true,redirect:rpFrom(req).origin+'/api/google/callback'})}
 if(p==='/api/google/connect'&&m==='GET'){const c=await googleCredential(env),rp=rpFrom(req),redirect=rp.origin+'/api/google/callback';if(!c)return j({error:'GOOGLE_CREDENTIAL_REQUIRED',setupRequired:true,redirect,detail:'Google OAuth Client ID ve Client Secret gerekli'},400);const state=await sign(env.JARVIS_SECRET||'CHANGE_ME',{sub:'google-oauth',exp:now()+600000}),scopes=['openid','email','profile','https://www.googleapis.com/auth/gmail.modify','https://www.googleapis.com/auth/drive'].join(' '),url='https://accounts.google.com/o/oauth2/v2/auth?'+new URLSearchParams({client_id:String(c.endpoint||''),redirect_uri:redirect,response_type:'code',scope:scopes,access_type:'offline',prompt:'consent',state});return j({url,redirect})}
 if(p==='/api/google/callback'&&m==='GET'){const st=await verify(env.JARVIS_SECRET||'CHANGE_ME',u.searchParams.get('state'));if(!st||st.sub!=='google-oauth')return txt('Invalid OAuth state',400);const c=await googleCredential(env);if(!c)return txt('Google credential missing',400);const redirect=u.origin+'/api/google/callback',form=new URLSearchParams({code:String(u.searchParams.get('code')||''),client_id:String(c.endpoint||''),client_secret:c.secret,redirect_uri:redirect,grant_type:'authorization_code'}),r=await fetchT('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});if(!r.ok)return txt('Google token exchange failed '+r.status,400);const t=await r.json();t.expires_at=now()+Number(t.expires_in||3600)*1000;const pr=await fetchT('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{authorization:'Bearer '+t.access_token}}),profile=pr.ok?await pr.json():{};await kvSet(env,'google_oauth',{email:profile.email||'',scope:t.scope||'',blob:await encSecret(env,JSON.stringify(t))});await log(env,'integration','Google hesabı bağlandı: '+(profile.email||''));return Response.redirect(u.origin+'/?google=connected',302)}
 if(p==='/api/gmail/messages'&&m==='GET')return j(await gmailList(env,10));
 if(p==='/api/gmail/prepare-send'&&m==='POST'){const b=await body(req),to=String(b.to||'').trim(),subject=String(b.subject||''),bd=String(b.body||'').trim();if(!to||!bd)return j({error:'TO_AND_BODY_REQUIRED'},400);return j(await pendingAction(env,'gmail_send',{to,subject,body:bd},`${to} adresine e-posta gönder: ${subject||'(konusuz)'}`))}
 if(p==='/api/drive/files'&&m==='GET')return j(await driveFiles(env));
 if(p==='/api/social/prepare-facebook'&&m==='POST'){const b=await body(req);if(!String(b.message||'').trim())return j({error:'MESSAGE_REQUIRED'},400);return j(await pendingAction(env,'facebook_post',{message:String(b.message)},'Facebook paylaşımı yap'))}
 if(p==='/api/social/prepare-instagram'&&m==='POST'){const b=await body(req);if(!String(b.imageUrl||'').trim())return j({error:'IMAGE_URL_REQUIRED'},400);return j(await pendingAction(env,'instagram_post',{imageUrl:String(b.imageUrl),caption:String(b.caption||'')},'Instagram paylaşımı yap'))}
 let am=p.match(/^\/api\/actions\/([^/]+)\/(approve|reject)$/);if(am&&m==='POST'){const a=await q1(env,'SELECT * FROM actions WHERE id=?',am[1]);if(!a)return j({error:'NOT_FOUND'},404);if(am[2]==='reject'){await run(env,'UPDATE actions SET status=?,completed_at=? WHERE id=?','rejected',now(),a.id);return j({ok:true})}const result=await executeAction(env,a);await run(env,'UPDATE actions SET status=?,completed_at=? WHERE id=?','done',now(),a.id);await log(env,'action','İşlem gerçekleştirildi: '+a.summary,{result});return j({ok:true,result})}

 if(p==='/api/chat/history'&&m==='GET')return j(await chatHistory(env,Number(u.searchParams.get('limit')||120)));
 if(p==='/api/chat/send'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);const ts=now();try{if(/ai.*(durum|test|kontrol|diag)|sağlayıcı.*(durum|test|kontrol)|saglayici.*(durum|test|kontrol)/i.test(text)){const d=await aiDiagnostics(env);const reply=d.ok?('AI sistemi çalışıyor. Çalışan sağlayıcı sayısı: '+d.working+'/'+d.total+'. '+d.recommendation):('AI sistemi çalışmıyor. '+d.recommendation);return j({reply,action:'ai_diagnostics',provider:'JARVIS Diagnostics',diagnostics:d,history:[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'JARVIS Diagnostics',created_at:now()}]})}const r=await withTimeout(quickCommand(env,text),9500,'QUICK_COMMAND_TIMEOUT');const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:r.reply,provider:r.provider||null,created_at:now()}];const persist=async()=>{try{await addChat(env,'user',text,null);await addChat(env,'assistant',r.reply,r.provider||null);await log(env,'jarvis-fast',r.reply,{provider:r.provider,action:r.action})}catch(e){await recordRuntimeError(env,e,'chat.persist')}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({...r,history})}catch(e){const msg=String(e?.message||e||'UNKNOWN'),reply=localFallbackAnswer(text,msg)||researchFallbackAnswer(text,[])||'Cevap motoru zamanında dönemedi. İsteğini kaydettim; teknik hata detayını sana dökmüyorum.';const history=[{role:'user',content:text,provider:null,created_at:ts},{role:'assistant',content:reply,provider:'JARVIS Local',created_at:now()}];const persist=async()=>{try{await recordRuntimeError(env,e,'chat.send');await addChat(env,'user',text,null);await addChat(env,'assistant',reply,'JARVIS Local')}catch{}};if(ctx?.waitUntil)ctx.waitUntil(persist());else persist();return j({reply,action:'local_fallback',provider:'JARVIS Local',history})}}
 if(p==='/api/chat/clear'&&m==='POST'){await run(env,'DELETE FROM chat_messages');return j({ok:true})}

 // ECU Tuning v2 — vehicle-db + upload + scan + AI
 if(p==='/api/ecu/vehicle-db'&&m==='GET'){try{
   const mod=await import('./lib/tuning-engine.js');
   return j({ok:true,...mod.VEHICLE_DB});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/upload'&&m==='POST'){try{
   const b=await body(req);
   const fileData=typeof b.fileData==='string'?Uint8Array.from(atob(b.fileData),c=>c.charCodeAt(0)):new Uint8Array(b.fileData||[]);
   if(!fileData.length)return j({error:'EMPTY_FILE'},400);
   if(fileData.length>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(fileData);
   const stats=mod.fileStats(fileData);
   // Tier 0: Import edilmiş A2L/XDF tanımlarını D1'den çek ve scanRegions'a aktar
   let normalized=null;
   try{
     const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');
     normalized=normalizeD1Definitions(importedDefs);
   }catch(_defErr){/* tanım yükleme hatası taramayı durdurmamalı */}
   const regions=await mod.scanRegions(fileData, normalized);
   const upload_id=id();
   const file_hash=await mod.sha256Hex(fileData);
   const key='ecu/'+upload_id+'/'+String(b.filename||'file.bin').replace(/[\\/]/g,'_');
   await filePut(env,key,fileData,{contentType:'application/octet-stream'});
   const vehicleInfo={make:b.make||'',model:b.model||'',year:b.year||'',ecuType:b.ecuType||'',systems:[...new Set(regions.map(r=>r.system))]};
   const ts=Date.now();
   // --- Checksum validation on upload ---
   let checksumStatus=null;
   try{checksumStatus=mod.validateChecksums(fileData)}catch(_){}
   // --- ECU type detection ---
   const ecuProfile=regions._ecuProfile||{ecuType:'unknown',fuel:'unknown'};
   // --- Auto-analyze: store full analysis_json if requested or by default ---
   const analysisData={format:fmt,stats,regions:regions.map(r=>({system:r.system,actionCount:r.actions?.length||0,tierUsed:r.tierUsed||'unknown'})),ecuProfile,checksum:checksumStatus,systemCount:new Set(regions.map(r=>r.system)).size,totalActions:regions.reduce((s,r)=>s+(r.actions?.length||0),0)};
   // --- Definition auto-match: find best matching definition set ---
   let matchedDefinitionSet=null;
   try{
     const defSets=await qall(env,'SELECT id,filename,format,definition_count FROM ecu_definition_sets ORDER BY definition_count DESC LIMIT 5');
     if(defSets.length){
       const {matchDefinitions}=await import('./lib/ecu-definition-parser.js');
       for(const ds of defSets){
         const defs=await qall(env,'SELECT * FROM ecu_definitions WHERE def_set_id=?',ds.id);
         if(defs.length){
           const match=matchDefinitions(defs,fileData);
           if(match&&match.matchScore>0.3){matchedDefinitionSet={id:ds.id,name:ds.filename,matchScore:match.matchScore,matchedMaps:match.matchedCount||0};break}
         }
       }
     }
   }catch(_defMatchErr){}
   await run(env,'INSERT INTO ecu_uploads(id,user_id,filename,format,vehicle_type,file_hash,file_size,binary_data,uploaded_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',upload_id,'owner',String(b.filename||'file.bin'),fmt.format,JSON.stringify(vehicleInfo),file_hash,fileData.length,key,ts,ts);
   // Store analysis_json if column exists (migration may not have run yet)
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify(analysisData),ts,upload_id)}catch(_){}
   // Enriched response with system info and stage1 package
   const systemNames=[...new Set(regions.map(r=>r.system))];
   const systemInfos=systemNames.map(s=>mod.getSystemInfo(s)).filter(Boolean);
   const stage1=mod.buildStage1Package(systemNames);
   // --- VEHICLE_DB auto-match: try to identify vehicle from ECU type ---
   let vehicleMatch=null;
   try{
     if(ecuProfile.ecuType&&ecuProfile.ecuType!=='unknown'){
       const vdb=mod.VEHICLE_DB;
       if(vdb){
         const matches=[];
         for(const entry of vdb){
           if(entry.ecuTypes&&entry.ecuTypes.includes(ecuProfile.ecuType))matches.push({make:entry.make,model:entry.model,years:entry.years,ecuType:ecuProfile.ecuType});
         }
         if(matches.length)vehicleMatch=matches.slice(0,5);
       }
     }
   }catch(_){}
   // --- Dosya hafıza sistemi: hash ile tanı veya yeni kayıt oluştur ---
   let fileMemory=null,previousMods=[];
   try{
     const existing=await q1(env,'SELECT * FROM ecu_file_memory WHERE file_hash=?',file_hash);
     if(existing){
       // Bilinen dosya — güncelle
       const prevUploadIds=JSON.parse(existing.upload_ids||'[]');
       prevUploadIds.push(upload_id);
       previousMods=JSON.parse(existing.last_modifications||'[]');
       await run(env,'UPDATE ecu_file_memory SET times_uploaded=times_uploaded+1,last_seen_at=?,upload_ids=?,vehicle_make=COALESCE(NULLIF(?,\'\'),vehicle_make),vehicle_model=COALESCE(NULLIF(?,\'\'),vehicle_model),vehicle_year=COALESCE(NULLIF(?,\'\'),vehicle_year),detected_systems=?,ecu_profile_data=? WHERE file_hash=?',
         ts,JSON.stringify(prevUploadIds),b.make||'',b.model||'',b.year||'',JSON.stringify(systemNames),JSON.stringify(ecuProfile),file_hash);
       fileMemory={known:true,timesUploaded:existing.times_uploaded+1,firstSeen:existing.first_seen_at,previousMods,notes:existing.notes,tags:JSON.parse(existing.tags||'[]')};
     }else{
       // Yeni dosya — kaydet
       await run(env,'INSERT INTO ecu_file_memory(id,file_hash,filename,file_size,ecu_type,fuel_type,vehicle_make,vehicle_model,vehicle_year,detected_systems,ecu_profile_data,scan_result_summary,first_seen_at,last_seen_at,upload_ids) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
         id(),file_hash,String(b.filename||'file.bin'),fileData.length,ecuProfile.ecuType,ecuProfile.fuel,b.make||'',b.model||'',b.year||'',JSON.stringify(systemNames),JSON.stringify(ecuProfile),JSON.stringify({format:fmt.format,regionCount:regions.length}),ts,ts,JSON.stringify([upload_id]));
       fileMemory={known:false,timesUploaded:1,firstSeen:ts,previousMods:[],notes:'',tags:[]};
     }
   }catch(memErr){fileMemory={known:false,error:memErr.message}}
   return j({ok:true,upload_id,uploadId:upload_id,format:fmt.format,size:fileData.length,stats,regions,systems:systemNames,systemInfos,stage1,vehicle:vehicleInfo,rulepackMatches:regions._rulepackMatches||[],ecuProfile,fileMemory,checksum:checksumStatus,analysis:analysisData,matchedDefinitionSet,vehicleMatch});
 }catch(e){return j({error:e.message||'UPLOAD_FAILED',stack:e.stack?.split('\n').slice(0,3).join(' | ')},500)}}

 if(p==='/api/ecu/rulepacks'&&m==='GET'){try{
   const {RULEPACKS,allSources}=await import('./lib/ecu-rulepacks.js');
   return j({ok:true,packs:RULEPACKS.map(p=>({family:p.family,familyName:p.familyName,description:p.description,sourceCount:(p.sources||[]).length,firmwareCount:Object.keys(p.firmwares||{}).length,mapCount:(p.familyMaps||[]).length,notes:p.notes})),sources:allSources()});
 }catch(e){return j({error:e.message||'RULEPACKS_FAILED'},500)}}

 if(p==='/api/ecu/related-repos'&&m==='GET'){try{
   const data=(await import('../data/ecu-registry-filtered.json',{with:{type:'json'}})).default;
   return j({ok:true,total:data.total,accepted:data.accepted||[],quarantine:data.quarantine||[]});
 }catch(e){return j({ok:true,total:0,accepted:[],quarantine:[],error:e.message},200)}}

 if(p==='/api/ecu/ai-suggest'&&m==='POST'){try{
   const b=await body(req);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId||b.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Tier 0: D1'den tanımları yükle ve scanRegions'a aktar
   let normalized=null;
   try{
     const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');
     normalized=normalizeD1Definitions(importedDefs);
   }catch(_defErr){/* tanım yükleme hatası taramayı durdurmamalı */}
   const regions=await mod.scanRegions(bytes, normalized);
   const summary=mod.summarizeForAI(bytes,regions);
   const vehicleCtx=upload.vehicle_type?JSON.parse(upload.vehicle_type):{};
   const vehicleStr=vehicleCtx.make?`Araç: ${vehicleCtx.make} ${vehicleCtx.model||''} ${vehicleCtx.year||''} ECU: ${vehicleCtx.ecuType||'bilinmiyor'}. `:'';
   const sys=`Sen bir ECU tuning uzmanısın. ${vehicleStr}Verilen dosya özetine bakarak her sistem için SOMUT bir öneri yaz. Her öneri için açıklama da ekle. SADECE JSON array döndür, başka metin yok.
İki format desteklenir:
1) Tek-byte: {"system":"EGR","offset":"0x4A20","currentByte":"0x01","newByte":"0x00","action":"EGR bayrağını sıfırla","result":"EGR devre dışı","explain":"...","risk":"low","hpGain":"+5 HP"}
2) Harita: {"system":"DPF","offset":"0x8000","dataSize":512,"mapAction":"zero","action":"DPF haritasını sıfırla","result":"DPF filtre basınç haritası devre dışı","explain":"...","risk":"high","hpGain":"+10 HP"}
   mapAction değerleri: "zero" (tüm byte sıfır), "scale" (scaleFactor ile çarp, ör 1.15), "fill" (fillValue ile doldur, ör 65535)
   scale için scaleFactor, fill için fillValue ekle. elementSize (1/2/4) ve elementCount gereklidir.
Özetdeki 'definitionMeta' ve 'mapAction' bilgilerini dikkate al. En fazla 8 öneri.`;
   const userMsg='DOSYA ÖZETİ:\n'+JSON.stringify(summary,null,2);
   let aiSuggestions=[],provider='unknown',rawText='';
   // Try aiFallback first, then direct Cloudflare AI as fallback
   try{
     const a=await withTimeout(aiFallback(env,[{role:'system',content:sys},{role:'user',content:userMsg}],{userText:userMsg,mode:'strong'}),25000,'AI_SUGGEST_TIMEOUT');
     rawText=typeof a?.text==='string'?a.text:a?.text?JSON.stringify(a.text):'';provider=a?.provider||'unknown';
   }catch(e1){
     // aiFallback failed — try env.AI directly (Cloudflare AI free tier)
     if(env.AI){try{
       const cfModels=['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/google/gemma-3-12b-it','@cf/meta/llama-3.1-8b-instruct-fp8'];
       for(const cfm of cfModels){try{
         const r=await withTimeout(env.AI.run(cfm,{messages:[{role:'system',content:sys},{role:'user',content:userMsg}],temperature:0.3,max_tokens:1500}),18000,'CF_AI_TIMEOUT');
         const rr=typeof r==='string'?r:(r?.response||r?.result||'');
         rawText=typeof rr==='string'?rr:rr?JSON.stringify(rr):'';
         if(rawText){provider='Cloudflare AI ('+cfm.split('/').pop()+')';break}
       }catch{continue}}
     }catch{}}
     if(!rawText)return j({ok:false,error:'AI_UNAVAILABLE',detail:e1.message,suggestions:[]},200);
   }
   if(typeof rawText!=='string')rawText=rawText?JSON.stringify(rawText):'';
   const jsonMatch=rawText.match(/\[[\s\S]*\]/);
   if(jsonMatch){try{aiSuggestions=JSON.parse(jsonMatch[0])}catch(err){aiSuggestions=[{system:'AI',action:'JSON parse hatası',result:rawText.slice(0,400),risk:'unknown'}]}}
   else if(rawText){aiSuggestions=[{system:'AI',action:'Genel öneri',result:rawText.slice(0,600),risk:'info'}]}
   return j({ok:true,suggestions:aiSuggestions,provider,raw:rawText.slice(0,2000)});
 }catch(e){return j({error:e.message||'AI_SUGGEST_FAILED'},500)}}

 if(p==='/api/ecu/generate'&&m==='POST'){try{
   const b=await body(req);
   if(!b.uploadId&&!b.upload_id)return j({error:'BODY_PARSE_FAILED',detail:'uploadId eksik — istek gövdesi okunamadı',keys:Object.keys(b)},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId||b.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const original=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // --- System filter: only apply actions from specified systems ---
   const systemFilter=Array.isArray(b.systems)&&b.systems.length?b.systems.map(s=>s.toLowerCase()):null;
   // Primary path: use full action objects sent from frontend (no re-scan needed)
   let toApply=[];
   const sentActions=Array.isArray(b.actions)?b.actions:[];
   if(sentActions.length){
     toApply=sentActions.filter(a=>{
       const o=Number(a.offset);
       if(!isFinite(o)||o<0||o>=original.length) return false;
       if(systemFilter&&a.system&&!systemFilter.includes(a.system.toLowerCase())) return false;
       if(a.mapAction) return true;
       if(a.newValue!=null&&isFinite(Number(a.newValue))) return true;
       return isFinite(Number(a.newByte));
     }).map(a=>{
       const base={id:a.id||'action',label:a.label||'',offset:Number(a.offset),risk:a.risk||'medium',system:a.system||''};
       if(a.mapAction){
         return {...base,dataSize:Number(a.dataSize)||1,mapAction:a.mapAction,
           fillByte:a.fillByte,fillValue:a.fillValue!=null?Number(a.fillValue):null,
           scaleFactor:a.scaleFactor!=null?Number(a.scaleFactor):null,
           elementSize:Number(a.elementSize)||1,elementCount:Number(a.elementCount)||1,
           datatype:a.datatype||null};
       }
       if(a.newValue!=null) return {...base,dataSize:Number(a.dataSize)||2,datatype:a.datatype||null,newValue:Number(a.newValue)};
       return {...base,dataSize:1,currentByte:Number(a.currentByte||0),newByte:Number(a.newByte)};
     });
   }
   // Fallback: re-scan and match by ID (legacy compatibility)
   if(!toApply.length){
     const regions=await mod.scanRegions(original);
     let allActions=regions.flatMap(r=>r.actions.map(a=>({...a,system:r.system})));
     if(systemFilter)allActions=allActions.filter(a=>!a.system||systemFilter.includes(a.system.toLowerCase()));
     const selectedIds=Array.isArray(b.actionIds||b.proposals)?(b.actionIds||b.proposals):[];
     if(selectedIds.length)toApply=allActions.filter(a=>selectedIds.includes(a.id));
     // If preset or stage name given, use all filtered actions
     if(!toApply.length&&(b.preset||b.stageName||b.applyAll)&&allActions.length)toApply=allActions;
   }
   if(!toApply.length)return j({error:'NO_ACTIONS_SELECTED',debug:{sentCount:sentActions.length,bodyKeys:Object.keys(b),fileLen:original.length,sentSample:sentActions.slice(0,2).map(a=>({id:a.id,offset:a.offset,offsetType:typeof a.offset,newByte:a.newByte,newByteType:typeof a.newByte}))}},400);
   // --- Collect undo data: original bytes at each action offset before apply ---
   const undoMap=toApply.map(a=>{
     const off=Number(a.offset);const size=Number(a.dataSize)||1;
     const origBytes=[];
     for(let i=0;i<size&&off+i<original.length;i++)origBytes.push(original[off+i]);
     return {id:a.id||'action',offset:off,size,system:a.system||'',label:a.label||'',originalBytes:origBytes};
   });
   // --- Preview mode: return what would change without writing ---
   if(b.preview){
     const previewResult=await mod.applyActions(original,toApply);
     const previewChanges=previewResult.applied.map((a,i)=>({
       offset:a.offset,offsetHex:a.offsetHex,before:a.before,after:a.after,
       label:a.label||'',id:a.id||'',system:toApply[i]?.system||'',
       originalBytes:undoMap[i]?.originalBytes||[]
     }));
     const bySystem={};
     for(const a of toApply){const sys=a.system||'Diğer';if(!bySystem[sys])bySystem[sys]={count:0,actions:[]};bySystem[sys].count++;bySystem[sys].actions.push({offset:a.offset,label:a.label||'',id:a.id||''})}
     const checksumAfter=mod.validateChecksums(previewResult.tuned);
     return j({ok:true,preview:true,totalActions:toApply.length,totalBytes:original.length,
       changedBytes:previewResult.applied.length,changes:previewChanges,bySystem,
       checksumBefore:mod.validateChecksums(original),checksumAfter,
       sizeMatch:original.length===previewResult.tuned.length,
       hashBefore:await mod.sha256Hex(original),hashAfter:previewResult.hash});
   }
   const result=await mod.applyActions(original,toApply);
   const tuned_id=id();
   const stageName=b.stageName||b.preset||'scan-v2';
   const outKey='ecu/'+tuned_id+'/tuned-'+String(upload.filename||'file.bin').replace(/[\\/]/g,'_');
   await filePut(env,outKey,result.tuned,{contentType:'application/octet-stream'});
   // Store undo data alongside proposals for rollback capability
   const proposalsData={applied:result.applied,undo:undoMap,stageName,systems:[...new Set(toApply.map(a=>a.system).filter(Boolean))]};
   await run(env,'INSERT INTO ecu_tuned_outputs(id,upload_id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,tuned_binary_data,created_at) VALUES(?,?,?,?,?,?,?,?)',tuned_id,upload.id,stageName,JSON.stringify(proposalsData),result.hash,result.size,outKey,now());
   // Dosya hafızasında son modifikasyonları güncelle
   try{
     const modEntry={date:Date.now(),tunedId:tuned_id,stageName,actions:result.applied.map(a=>a.id||a.action||'unknown'),systems:[...new Set(toApply.map(a=>a.system).filter(Boolean))]};
     const mem=await q1(env,'SELECT id,last_modifications FROM ecu_file_memory WHERE file_hash=?',upload.file_hash);
     if(mem){const mods=JSON.parse(mem.last_modifications||'[]');mods.push(modEntry);if(mods.length>20)mods.splice(0,mods.length-20);await run(env,'UPDATE ecu_file_memory SET last_modifications=?,last_seen_at=? WHERE id=?',JSON.stringify(mods),Date.now(),mem.id)}
   }catch(memErr){}
   // Checksum validation on generated file
   let checksumResult=null;
   try{checksumResult=mod.validateChecksums(result.tuned)}catch(_){}
   // Build comparison data for auto-diff
   const comparison={totalBytes:original.length,changedBytes:result.applied.length,changes:result.applied.map(a=>({offset:a.offset,offsetHex:a.offsetHex,before:a.before,after:a.after,label:a.label||'',id:a.id||''})),bySystem:{}};
   for(const a of toApply){const sys=a.system||'Diğer';if(!comparison.bySystem[sys])comparison.bySystem[sys]={count:0,changes:[]};comparison.bySystem[sys].count++;comparison.bySystem[sys].changes.push({offset:a.offset,label:a.label||''})}
   return j({ok:true,tunedId:tuned_id,tuned_id,size:result.size,hash:result.hash,applied:result.applied,appliedPatches:result.applied,comparison,checksum:checksumResult,undo:undoMap,stageName});
 }catch(e){return j({error:e.message||'GENERATE_FAILED'},500)}}

 if(p==='/api/ecu/checksum'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const result=mod.validateChecksums(bytes);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message||'CHECKSUM_FAILED'},500)}}

 if(p.startsWith('/api/ecu/download')){try{
   const u=new URL(req.url);
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const fmt=u.searchParams.get('format')||'bin'; // bin | hex | srec | original
   // --- Original file download ---
   if(fmt==='original'&&uploadId){
     const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
     if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
     const obj=await fileGet(env,upload.binary_data);
     if(!obj)return j({error:'FILE_NOT_FOUND'},404);
     return new Response(obj.body,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+String(upload.filename||'original.bin')+'"'}});
   }
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const obj=await fileGet(env,tuned.tuned_binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const upload=await q1(env,'SELECT filename FROM ecu_uploads WHERE id=?',tuned.upload_id);
   const baseName=(upload?.filename||'tuned.bin').replace(/(\.[^.]+)$/,'_tuned');
   // --- Hex format download (Intel HEX) ---
   if(fmt==='hex'){
     const bytes=new Uint8Array(await obj.arrayBuffer());
     let hex=':020000040000FA\n'; // Extended Linear Address Record
     for(let addr=0;addr<bytes.length;addr+=16){
       const count=Math.min(16,bytes.length-addr);
       let line=':'+count.toString(16).toUpperCase().padStart(2,'0')+(addr&0xFFFF).toString(16).toUpperCase().padStart(4,'0')+'00';
       let cksum=count+((addr>>8)&0xFF)+(addr&0xFF);
       for(let i=0;i<count;i++){line+=bytes[addr+i].toString(16).toUpperCase().padStart(2,'0');cksum+=bytes[addr+i]}
       cksum=((~cksum)+1)&0xFF;line+=cksum.toString(16).toUpperCase().padStart(2,'0');hex+=line+'\n';
       // Extended address records every 64KB
       if(addr>0&&(addr+16)%0x10000===0&&addr+16<bytes.length){
         const seg=((addr+16)>>16)&0xFFFF;
         let earLine=':02000004'+seg.toString(16).toUpperCase().padStart(4,'0');
         let earCk=2+4+((seg>>8)&0xFF)+(seg&0xFF);earCk=((~earCk)+1)&0xFF;
         earLine+=earCk.toString(16).toUpperCase().padStart(2,'0');hex+=earLine+'\n';
       }
     }
     hex+=':00000001FF\n'; // EOF
     return new Response(hex,{headers:{'content-type':'text/plain','content-disposition':'attachment; filename="'+baseName+'.hex"'}});
   }
   // --- S-Record format download (Motorola SREC) ---
   if(fmt==='srec'){
     const bytes=new Uint8Array(await obj.arrayBuffer());
     let srec='S0030000FC\n'; // Header
     for(let addr=0;addr<bytes.length;addr+=32){
       const count=Math.min(32,bytes.length-addr);
       const byteCount=count+5; // data + 4 addr + 1 cksum
       let line='S3'+byteCount.toString(16).toUpperCase().padStart(2,'0')+addr.toString(16).toUpperCase().padStart(8,'0');
       let cksum=byteCount+((addr>>24)&0xFF)+((addr>>16)&0xFF)+((addr>>8)&0xFF)+(addr&0xFF);
       for(let i=0;i<count;i++){line+=bytes[addr+i].toString(16).toUpperCase().padStart(2,'0');cksum+=bytes[addr+i]}
       cksum=((~cksum)&0xFF);line+=cksum.toString(16).toUpperCase().padStart(2,'0');srec+=line+'\n';
     }
     srec+='S70500000000FA\n'; // End record
     return new Response(srec,{headers:{'content-type':'text/plain','content-disposition':'attachment; filename="'+baseName+'.srec"'}});
   }
   // --- Default binary download ---
   return new Response(obj.body,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="'+baseName+'.bin"'}});
 }catch(e){return j({error:e.message||'DOWNLOAD_FAILED'},500)}}

 // === ECU DOSYA HAFIZA SİSTEMİ ===
 if(p==='/api/ecu/file-memory/search'&&m==='POST'){try{
   const b=await body(req);
   const conditions=[];const params=[];
   if(b.query){conditions.push("(filename LIKE ? OR vehicle_make LIKE ? OR vehicle_model LIKE ? OR ecu_type LIKE ? OR tags LIKE ?)");const q='%'+b.query+'%';params.push(q,q,q,q,q)}
   if(b.make){conditions.push("vehicle_make LIKE ?");params.push('%'+b.make+'%')}
   if(b.model){conditions.push("vehicle_model LIKE ?");params.push('%'+b.model+'%')}
   if(b.ecuType){conditions.push("ecu_type LIKE ?");params.push('%'+b.ecuType+'%')}
   if(b.fuel){conditions.push("fuel_type=?");params.push(b.fuel)}
   if(b.tag){conditions.push("tags LIKE ?");params.push('%'+JSON.stringify(b.tag).slice(1,-1)+'%')}
   const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
   const limit=Math.min(parseInt(b.limit)||50,200);
   const offset=parseInt(b.offset)||0;
   const rows=await qall(env,'SELECT * FROM ecu_file_memory '+where+' ORDER BY last_seen_at DESC LIMIT ? OFFSET ?',...params,limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory '+where,...params);
   return j({ok:true,files:rows.map(r=>({...r,detected_systems:JSON.parse(r.detected_systems||'[]'),ecu_profile_data:JSON.parse(r.ecu_profile_data||'{}'),tags:JSON.parse(r.tags||'[]'),last_modifications:JSON.parse(r.last_modifications||'[]'),upload_ids:JSON.parse(r.upload_ids||'[]')})),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'SEARCH_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/list'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit'))||50,200);
   const offset=parseInt(u.searchParams.get('offset'))||0;
   const rows=await qall(env,'SELECT * FROM ecu_file_memory ORDER BY last_seen_at DESC LIMIT ? OFFSET ?',limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory');
   return j({ok:true,files:rows.map(r=>({...r,detected_systems:JSON.parse(r.detected_systems||'[]'),ecu_profile_data:JSON.parse(r.ecu_profile_data||'{}'),tags:JSON.parse(r.tags||'[]'),last_modifications:JSON.parse(r.last_modifications||'[]'),upload_ids:JSON.parse(r.upload_ids||'[]')})),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'LIST_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/update'&&m==='POST'){try{
   const b=await body(req);
   if(!b.id&&!b.file_hash)return j({error:'ID_OR_HASH_REQUIRED'},400);
   const existing=b.id?await q1(env,'SELECT * FROM ecu_file_memory WHERE id=?',b.id):await q1(env,'SELECT * FROM ecu_file_memory WHERE file_hash=?',b.file_hash);
   if(!existing)return j({error:'FILE_NOT_FOUND'},404);
   const updates=[];const params=[];
   if(b.tags!==undefined){updates.push('tags=?');params.push(JSON.stringify(b.tags))}
   if(b.notes!==undefined){updates.push('notes=?');params.push(b.notes)}
   if(b.vehicle_make!==undefined){updates.push('vehicle_make=?');params.push(b.vehicle_make)}
   if(b.vehicle_model!==undefined){updates.push('vehicle_model=?');params.push(b.vehicle_model)}
   if(b.vehicle_year!==undefined){updates.push('vehicle_year=?');params.push(b.vehicle_year)}
   if(b.last_modifications!==undefined){updates.push('last_modifications=?');params.push(JSON.stringify(b.last_modifications))}
   if(!updates.length)return j({error:'NO_FIELDS_TO_UPDATE'},400);
   params.push(existing.id);
   await run(env,'UPDATE ecu_file_memory SET '+updates.join(',')+' WHERE id=?',...params);
   return j({ok:true,updated:existing.id});
 }catch(e){return j({error:e.message||'UPDATE_FAILED'},500)}}

 if(p==='/api/ecu/file-memory/stats'){try{
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_file_memory');
   const byEcu=await qall(env,'SELECT ecu_type,COUNT(*) as c FROM ecu_file_memory WHERE ecu_type IS NOT NULL GROUP BY ecu_type ORDER BY c DESC');
   const byFuel=await qall(env,'SELECT fuel_type,COUNT(*) as c FROM ecu_file_memory WHERE fuel_type IS NOT NULL GROUP BY fuel_type ORDER BY c DESC');
   const byMake=await qall(env,'SELECT vehicle_make,COUNT(*) as c FROM ecu_file_memory WHERE vehicle_make IS NOT NULL AND vehicle_make!=\'\' GROUP BY vehicle_make ORDER BY c DESC');
   const recentFiles=await qall(env,'SELECT id,filename,ecu_type,fuel_type,vehicle_make,vehicle_model,times_uploaded,last_seen_at FROM ecu_file_memory ORDER BY last_seen_at DESC LIMIT 10');
   return j({ok:true,totalFiles:total?.c||0,byEcuType:byEcu,byFuelType:byFuel,byMake,recentFiles});
 }catch(e){return j({error:e.message||'STATS_FAILED'},500)}}

 // === ECU DEFINITION IMPORT (A2L / XDF) ===
 if(p==='/api/ecu/import-definitions'&&m==='POST'){try{
   const b=await body(req);
   const defText=b.content||b.text||'';
   if(!defText||defText.length<50)return j({error:'EMPTY_OR_TOO_SHORT'},400);
   if(defText.length>20*1024*1024)return j({error:'FILE_TOO_LARGE',max:'20MB'},413);
   const {parseDefinitionFile}=await import('./lib/ecu-definition-parser.js');
   const result=parseDefinitionFile(defText);
   if(!result.definitions.length)return j({error:'NO_DEFINITIONS_FOUND',meta:result.meta},400);
   const setId=id();
   const ts=Date.now();
   await run(env,'INSERT INTO ecu_definition_sets(id,user_id,filename,format,ecu_family,base_offset,definition_count,meta,tags,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
     setId,'owner',String(b.filename||'definitions.'+result.meta.format),result.meta.format,b.ecuFamily||b.ecu_family||'',result.baseOffset||0,result.definitions.length,JSON.stringify(result.meta),'[]','',ts,ts);
   // Batch insert tanımlar — 50'lik gruplar halinde
   const defs=result.definitions;
   for(let i=0;i<defs.length;i+=50){
     const batch=defs.slice(i,i+50);
     const vals=[];const params=[];
     for(const d of batch){
       const did=id();
       vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
       params.push(did,setId,d.name,d.description||'',d.displayId||d.name,d.address,d.rawAddress,d.datatype||'UWORD',d.dataSize||2,d.type||'scalar',d.system||null,d.unit||'',d.math||'X',d.lowerLimit!=null?d.lowerLimit:null,d.upperLimit!=null?d.upperLimit:null,JSON.stringify(d.axes||[]),d.elementCount||1,d.totalBytes||2,d.source||result.meta.format,ts,ts);
     }
     await run(env,'INSERT INTO ecu_definitions(id,def_set_id,name,description,display_id,address,raw_address,datatype,data_size,type,system,unit,math,lower_limit,upper_limit,axes,element_count,total_bytes,source,created_at,updated_at) VALUES '+vals.join(','),...params);
   }
   // Sistem dağılım özeti
   const systemCounts={};
   for(const d of defs)if(d.system){systemCounts[d.system]=(systemCounts[d.system]||0)+1}
   return j({ok:true,setId,format:result.meta.format,definitionCount:defs.length,baseOffset:result.baseOffset||0,systems:systemCounts,meta:result.meta});
 }catch(e){return j({error:e.message||'IMPORT_FAILED',stack:e.stack?.split('\n').slice(0,3).join(' | ')},500)}}

 if(p==='/api/ecu/definition-sets'&&m==='GET'){try{
   const rows=await qall(env,'SELECT * FROM ecu_definition_sets ORDER BY created_at DESC LIMIT 100');
   return j({ok:true,sets:rows.map(r=>({...r,meta:JSON.parse(r.meta||'{}'),tags:JSON.parse(r.tags||'[]')}))});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/definition-sets/')&&m==='GET'){try{
   const setId=p.split('/api/ecu/definition-sets/')[1];
   if(!setId)return j({error:'SET_ID_REQUIRED'},400);
   const set=await q1(env,'SELECT * FROM ecu_definition_sets WHERE id=?',setId);
   if(!set)return j({error:'SET_NOT_FOUND'},404);
   const defs=await qall(env,'SELECT * FROM ecu_definitions WHERE def_set_id=? ORDER BY address ASC',setId);
   return j({ok:true,set:{...set,meta:JSON.parse(set.meta||'{}'),tags:JSON.parse(set.tags||'[]')},definitions:defs.map(d=>({...d,axes:JSON.parse(d.axes||'[]')}))});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/definition-sets/')&&m==='DELETE'){try{
   const setId=p.split('/api/ecu/definition-sets/')[1];
   if(!setId)return j({error:'SET_ID_REQUIRED'},400);
   const set=await q1(env,'SELECT id FROM ecu_definition_sets WHERE id=?',setId);
   if(!set)return j({error:'SET_NOT_FOUND'},404);
   await run(env,'DELETE FROM ecu_definitions WHERE def_set_id=?',setId);
   await run(env,'DELETE FROM ecu_definition_sets WHERE id=?',setId);
   return j({ok:true,deleted:setId});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/definitions/match'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   // Tüm import edilmiş tanımları çek
   const defs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
   if(!defs.length)return j({ok:true,matched:[],regions:[],message:'Henüz import edilmiş tanım yok'});
   const {matchDefinitions,definitionsToRegions}=await import('./lib/ecu-definition-parser.js');
   const normalized=defs.map(d=>({name:d.name,description:d.description,displayId:d.display_id,address:d.address,rawAddress:d.raw_address,datatype:d.datatype,dataSize:d.data_size,type:d.type,system:d.system,unit:d.unit,math:d.math,lowerLimit:d.lower_limit,upperLimit:d.upper_limit,axes:JSON.parse(d.axes||'[]'),elementCount:d.element_count,totalBytes:d.total_bytes,source:d.source}));
   const matched=matchDefinitions(bytes,normalized);
   const regions=definitionsToRegions(matched);
   return j({ok:true,totalDefs:defs.length,matchedCount:matched.length,regionCount:regions.length,matched:matched.slice(0,200),regions});
 }catch(e){return j({error:e.message||'MATCH_FAILED'},500)}}

 // === ECU ANALYZE — five-tier scan, ECU profil, sistem bilgisi, cached ===
 if(p==='/api/ecu/analyze'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   const forceRescan=b.force||b.rescan||false;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   // Cache kontrolü — force yoksa ve analysis_json varsa cached döndür
   if(!forceRescan&&upload.analysis_json&&upload.analyzed_at){try{
     const cachedRegions=JSON.parse(upload.analysis_json);
     const mod=await import('./lib/tuning-engine.js');
     const systemMap=new Map();
     for(const r of cachedRegions){if(!systemMap.has(r.system))systemMap.set(r.system,{system:r.system,regionCount:0,actionCount:0,confidence:0,info:mod.getSystemInfo(r.system)});const s=systemMap.get(r.system);s.regionCount++;if(r.actions)s.actionCount+=r.actions.length;if(r.confidence>s.confidence)s.confidence=r.confidence}
     return j({ok:true,cached:true,analyzedAt:upload.analyzed_at,uploadId,format:upload.format,fileSize:upload.file_size,systems:[...systemMap.values()],totalRegions:cachedRegions.length,regions:cachedRegions.slice(0,60),stage1Package:mod.buildStage1Package([...systemMap.keys()])});
   }catch(_){}}
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   // Tier 0: upload'a bağlı tanım seti
   let definitions=null;let defSource='none';
   try{
     const defRows=await qall(env,`SELECT d.name,d.description,d.display_id,d.address,d.raw_address,d.datatype,d.data_size,d.type,d.system,d.unit,d.math,d.lower_limit,d.upper_limit,d.axes,d.element_count,d.total_bytes FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address`,uploadId);
     if(defRows.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(defRows);defSource='upload-linked ('+defRows.length+' defs)'}
   }catch(_){}
   // Genel tanımlar fallback
   if(!definitions){try{
     const allDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     if(allDefs.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(allDefs);defSource='global ('+allDefs.length+' defs)'}
   }catch(_){}}
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(bytes);
   const regions=await mod.scanRegions(bytes,definitions);
   const stats=mod.fileStats(bytes);
   const summary=mod.summarizeForAI(bytes,regions);
   const checksumResult=mod.validateChecksums(bytes);
   // Tier dağılımı
   const tierCounts={0:0,1:0,2:0,3:0};
   for(const r of regions){const t=r.tier||(r.id?.startsWith('def_')?0:r.id?.startsWith('rp_')?1:2);tierCounts[t]=(tierCounts[t]||0)+1}
   // Sistem haritası + getSystemInfo ile zenginleştir
   const systemMap=new Map();
   for(const r of regions){
     if(!systemMap.has(r.system)){const info=mod.getSystemInfo(r.system);systemMap.set(r.system,{system:r.system,regionCount:0,actionCount:0,mapCount:0,confidence:0,info:info||null})}
     const s=systemMap.get(r.system);s.regionCount++;
     if(r.actions){s.actionCount+=r.actions.length;for(const a of r.actions)if(a.mapAction)s.mapCount++}
     if(r.confidence>s.confidence)s.confidence=r.confidence
   }
   const detectedSystems=[...systemMap.keys()];
   const stage1=mod.buildStage1Package(detectedSystems);
   // Araç bilgisi
   let vehicleInfo=null;try{vehicleInfo=JSON.parse(upload.vehicle_type||'{}')}catch(_){vehicleInfo={raw:upload.vehicle_type}}
   // ECU profil eşleşme
   let ecuProfile=null;
   if(fmt.format){const fmtUp=fmt.format.toUpperCase();const profiles=['EDC17','EDC16','EDC15','MED17','ME7','SID','PCR'];for(const pn of profiles)if(fmtUp.includes(pn)){ecuProfile=pn;break}}
   // Tuning history kaydı
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,upload.vehicle_type||'unknown','analysis','ok',now());
   // Analysis cache
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify(regions),now(),uploadId)}catch(_){}
   // Tanım seti sayısı
   let defSetCount=0;try{const dc=await q1(env,'SELECT COUNT(*) as c FROM ecu_definition_sets WHERE upload_id=?',uploadId);defSetCount=dc?.c||0}catch(_){}
   return j({ok:true,cached:false,uploadId,filename:upload.filename,format:fmt,fileSize:bytes.length,fileHash:upload.file_hash,vehicle:vehicleInfo,ecuProfile,stats:{entropy:stats.entropy,zeroPct:stats.zeroPct,ffPct:stats.ffPct,mapCandidates:stats.mapCandidates||0},checksums:checksumResult,definitionSource:defSource,definitionSetsLinked:defSetCount,tierBreakdown:tierCounts,systems:[...systemMap.values()],totalRegions:regions.length,regions:regions.slice(0,80).map(r=>({id:r.id,system:r.system,desc:r.desc,offsetHex:r.offsetHex,offset:r.offset,length:r.length||0,confidence:r.confidence,tier:r.tier||(r.id?.startsWith('rp_')?1:r.id?.startsWith('def_')?0:2),foundString:r.foundString?.slice(0,80),damosLabel:r.damosLabel||null,actions:(r.actions||[]).map(a=>({id:a.id,label:a.label,offset:a.offset,dataSize:a.dataSize,newValue:a.newValue,mapAction:a.mapAction||null,effect:a.effect||null,system:a.system,desc:a.desc||a.label}))})),stage1Package:stage1,aiSummary:summary});
 }catch(e){return j({error:e.message||'ANALYZE_FAILED'},500)}}

 // === ECU RE-ANALYZE — tanım yüklendikten sonra tekrar analiz ===
 if(p==='/api/ecu/re-analyze'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   // analysis cache temizle ve force rescan yap
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=NULL,analyzed_at=NULL WHERE id=?',uploadId)}catch(_){}
   // Aynı analyze handler'a yönlendir — force: true
   const fakeReq=new Request(req.url,{method:'POST',headers:req.headers,body:JSON.stringify({uploadId,force:true})});
   // Inline re-call analyze
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   let definitions=null;
   try{const defRows=await qall(env,`SELECT d.* FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address`,uploadId);
     if(defRows.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(defRows)}
   }catch(_){}
   if(!definitions){try{const allDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');
     if(allDefs.length){const {normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');definitions=normalizeD1Definitions(allDefs)}}catch(_){}}
   const mod=await import('./lib/tuning-engine.js');
   const regions=await mod.scanRegions(bytes,definitions);
   try{await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify(regions),now(),uploadId)}catch(_){}
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,upload.vehicle_type||'unknown','re-analysis','ok',now());
   return j({ok:true,uploadId,regionsFound:regions.length,definitionsUsed:definitions?.length||0,message:'Re-analysis complete with latest definitions'});
 }catch(e){return j({error:e.message||'RE_ANALYZE_FAILED'},500)}}

 // === ECU DEFINITION UPLOAD — A2L/XDF dosyası import + auto re-analyze ===
 if(p==='/api/ecu/definition'&&m==='POST'){try{
   const formData=await req.formData();
   const uploadId=formData.get('uploadId');
   const defFile=formData.get('file');
   const autoAnalyze=formData.get('autoAnalyze')!=='false'; // default true
   if(!uploadId||!defFile)return j({error:'MISSING_UPLOAD_ID_OR_FILE'},400);
   const upload=await q1(env,'SELECT id,filename,vehicle_type FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const text=await defFile.text();
   const filename=defFile.name||'';
   const isXdf=/\.xdf$/i.test(filename);
   const isOdx=/\.odx$/i.test(filename);
   const {parseA2L,parseXDF}=await import('./lib/ecu-definition-parser.js');
   let parsed;
   if(isXdf)parsed=parseXDF(text);
   else parsed=parseA2L(text); // A2L ve ODX aynı parser ile
   const defs=parsed.definitions||[];
   if(!defs.length)return j({error:'NO_DEFINITIONS_FOUND',hint:'Dosya geçerli bir A2L/XDF formatında değil veya tanım içermiyor'},400);
   const ts=now();const fmt=isXdf?'xdf':isOdx?'odx':'a2l';
   // Mevcut tanım seti var mı kontrol — aynı dosya adı varsa güncelle
   const existingSet=await q1(env,'SELECT id FROM ecu_definition_sets WHERE upload_id=? AND filename=?',uploadId,filename);
   const defSetId=existingSet?.id||id();
   if(existingSet){
     // Mevcut tanımları sil, yeni yükle
     await run(env,'DELETE FROM ecu_definitions WHERE def_set_id=?',defSetId);
     await run(env,'UPDATE ecu_definition_sets SET definition_count=?,base_offset=?,meta=?,updated_at=? WHERE id=?',defs.length,parsed.baseOffset??0,JSON.stringify(parsed.meta||{}),ts,defSetId);
   }else{
     await run(env,'INSERT INTO ecu_definition_sets(id,user_id,upload_id,filename,format,ecu_family,base_offset,definition_count,meta,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',defSetId,'system',uploadId,filename,fmt,parsed.meta?.ecuFamily||null,parsed.baseOffset??0,defs.length,JSON.stringify(parsed.meta||{}),ts,ts);
   }
   // Batch insert — D1 batch limit 100
   const BATCH=80;let inserted=0;
   const systemCounts=new Map();
   for(let i=0;i<defs.length;i+=BATCH){
     const chunk=defs.slice(i,i+BATCH);
     const stmts=chunk.map(d=>{
       const sys=d.system||'unknown';systemCounts.set(sys,(systemCounts.get(sys)||0)+1);
       return env.DB.prepare('INSERT OR REPLACE INTO ecu_definitions(id,def_set_id,name,description,display_id,address,raw_address,datatype,data_size,type,system,unit,math,lower_limit,upper_limit,axes,element_count,total_bytes,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id(),defSetId,d.name,d.description||d.name,d.displayId||'',d.address??d.offset??0,d.rawAddress??d.address??0,d.datatype||'UWORD',d.dataSize||2,d.type||'scalar',sys,d.unit||'',d.math||'X',d.lowerLimit??d.min??null,d.upperLimit??d.max??null,JSON.stringify(d.axes||[]),d.elementCount||1,d.totalBytes||d.dataSize||2,fmt,ts,ts)
     });
     await env.DB.batch(stmts);inserted+=chunk.length;
   }
   await run(env,'INSERT INTO ecu_tuning_history(id,upload_id,vehicle_type,tuning_type,status,created_at) VALUES(?,?,?,?,?,?)',id(),uploadId,'definition','definition_upload','ok',ts);
   // Auto re-analyze: tanım yüklendikten sonra cache temizle
   if(autoAnalyze){try{await run(env,'UPDATE ecu_uploads SET analysis_json=NULL,analyzed_at=NULL WHERE id=?',uploadId)}catch(_){}}
   // Tanım tipi dağılımı
   const typeCounts={scalar:0,map:0,curve:0,axis:0,other:0};
   for(const d of defs){const t=d.type||'scalar';typeCounts[t]=(typeCounts[t]||0)+1}
   return j({ok:true,updated:!!existingSet,uploadId,defSetId,definitionFile:filename,format:fmt.toUpperCase(),definitionsImported:inserted,baseOffset:parsed.baseOffset??0,ecuFamily:parsed.meta?.ecuFamily||null,meta:parsed.meta||{},typeBreakdown:typeCounts,systemBreakdown:Object.fromEntries(systemCounts),autoAnalyzeTriggered:autoAnalyze,hint:autoAnalyze?'Cache temizlendi — /api/ecu/analyze ile yeniden tarayın':null});
 }catch(e){return j({error:e.message||'DEFINITION_UPLOAD_FAILED'},500)}}

 // === ECU DEFINITIONS LIST — upload'a bağlı tanım setlerini listele ===
 if(p==='/api/ecu/definitions/list'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   if(uploadId){
     const sets=await qall(env,'SELECT s.*,COUNT(d.id) as actual_count FROM ecu_definition_sets s LEFT JOIN ecu_definitions d ON d.def_set_id=s.id WHERE s.upload_id=? GROUP BY s.id ORDER BY s.created_at DESC',uploadId);
     const defs=await qall(env,`SELECT d.name,d.type,d.system,d.address,d.unit,d.datatype,d.data_size,d.element_count FROM ecu_definitions d JOIN ecu_definition_sets s ON s.id=d.def_set_id WHERE s.upload_id=? ORDER BY d.address LIMIT 500`,uploadId);
     return j({ok:true,uploadId,sets,definitions:defs,totalDefinitions:defs.length});
   }
   // Tüm tanım setleri
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'50'),200);
   const sets=await qall(env,'SELECT s.*,COUNT(d.id) as actual_count FROM ecu_definition_sets s LEFT JOIN ecu_definitions d ON d.def_set_id=s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT ?',limit);
   return j({ok:true,sets,total:sets.length});
 }catch(e){return j({error:e.message||'DEFINITIONS_LIST_FAILED'},500)}}

 // === ECU COMPARE — annotated byte diff with system matching ===
 if(p==='/api/ecu/compare'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!uploadId||!tunedId)return j({error:'MISSING_IDS'},400);
   const upload=await q1(env,'SELECT binary_data,file_size,analysis_json FROM ecu_uploads WHERE id=?',uploadId);
   const tuned=await q1(env,'SELECT tuned_binary_data,tuned_file_size,proposals_applied FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!upload||!tuned)return j({error:'NOT_FOUND'},404);
   const origObj=await fileGet(env,upload.binary_data);
   if(!origObj)return j({error:'ORIGINAL_FILE_NOT_FOUND'},404);
   const orig=new Uint8Array(await origObj.arrayBuffer());
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const modBytes=new Uint8Array(await tunedObj.arrayBuffer());
   // Analiz verisi — diff'leri sisteme eşle
   let analysisRegions=[];
   try{if(upload.analysis_json)analysisRegions=JSON.parse(upload.analysis_json)}catch(_){}
   // Byte diff — daha detaylı
   const diffs=[];let idx=0;let totalChanged=0;
   while(idx<orig.length&&idx<modBytes.length){
     if(orig[idx]!==modBytes[idx]){
       const start=idx;while(idx<orig.length&&idx<modBytes.length&&orig[idx]!==modBytes[idx]&&(idx-start)<4096)idx++;
       const len=idx-start;totalChanged+=len;
       // Bu offset hangi sisteme ait?
       let matchedSystem=null;let matchedRegion=null;
       for(const r of analysisRegions){
         const rOff=r.offset||0;const rLen=r.length||r.totalBytes||0;
         if(start>=rOff&&start<rOff+rLen){matchedSystem=r.system;matchedRegion=r.desc||r.id;break}
       }
       diffs.push({offset:start,offsetHex:'0x'+start.toString(16).toUpperCase(),length:len,system:matchedSystem,regionDesc:matchedRegion,originalBytes:Array.from(orig.subarray(start,Math.min(start+48,idx))).map(b=>b.toString(16).padStart(2,'0')).join(' '),tunedBytes:Array.from(modBytes.subarray(start,Math.min(start+48,idx))).map(b=>b.toString(16).padStart(2,'0')).join(' '),truncated:len>48});
     }else{idx++}
   }
   // Ek boyut bilgisi
   const sizeDiff=modBytes.length-orig.length;
   let applied=[];try{applied=JSON.parse(tuned.proposals_applied||'[]')}catch(_){}
   // Sistem bazlı değişiklik özeti
   const systemChanges=new Map();
   for(const d of diffs){const sys=d.system||'unknown';if(!systemChanges.has(sys))systemChanges.set(sys,{system:sys,regions:0,bytesChanged:0});const sc=systemChanges.get(sys);sc.regions++;sc.bytesChanged+=d.length}
   // Checksum doğrulama — tuned dosyada
   const mod=await import('./lib/tuning-engine.js');
   const tunedChecksums=mod.validateChecksums(modBytes);
   return j({ok:true,uploadId,tunedId,originalSize:orig.length,tunedSize:modBytes.length,sizeDifference:sizeDiff,changedRegions:diffs.length,totalChangedBytes:totalChanged,changePercentage:orig.length?(totalChanged/orig.length*100).toFixed(3)+'%':'N/A',systemSummary:[...systemChanges.values()],tunedChecksums,diffs:diffs.slice(0,150),appliedActions:applied.map(a=>({id:a.id,label:a.label,system:a.system,offset:a.offset,effectType:a.effectType||a.mapAction||'byte'}))});
 }catch(e){return j({error:e.message||'COMPARE_FAILED'},500)}}

 // === ECU VALIDATE — tuned dosya checksum + integrity kontrolü ===
 if(p==='/api/ecu/validate'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   const uploadId=b.uploadId||b.upload_id;
   if(!tunedId)return j({error:'MISSING_TUNED_ID'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const tunedBytes=new Uint8Array(await tunedObj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Checksum kontrolü
   const checksums=mod.validateChecksums(tunedBytes);
   // Boyut kontrolü
   const sizeOk=tunedBytes.length===tuned.tuned_file_size;
   // Hash kontrolü
   const currentHash=await mod.sha256Hex(tunedBytes);
   const hashOk=currentHash===tuned.tuned_file_hash;
   // Orijinal ile karşılaştır
   let sizeMatch=true;
   if(uploadId){const upload=await q1(env,'SELECT file_size FROM ecu_uploads WHERE id=?',uploadId);if(upload)sizeMatch=tunedBytes.length===upload.file_size}
   // File stats
   const stats=mod.fileStats(tunedBytes);
   const valid=sizeOk&&hashOk&&sizeMatch;
   return j({ok:true,tunedId,valid,checks:{sizeOk,hashOk,sizeMatch,checksums},fileSize:tunedBytes.length,hash:currentHash,expectedHash:tuned.tuned_file_hash,stats:{entropy:stats.entropy,zeroPct:stats.zeroPct,ffPct:stats.ffPct},verdict:valid?'SAFE_TO_FLASH':'CHECK_WARNINGS',warnings:(!sizeOk?['Dosya boyutu DB kaydıyla uyuşmuyor']:[] ).concat(!hashOk?['Hash uyuşmuyor — dosya bozulmuş olabilir']:[]).concat(!sizeMatch?['Tuned boyut orijinalden farklı — ECU kabul etmeyebilir']:[])});
 }catch(e){return j({error:e.message||'VALIDATE_FAILED'},500)}}

 // === ECU STATS — genel dashboard istatistikleri ===
 if(p==='/api/ecu/stats'&&m==='GET'){try{
   const [uploads,tuned,history,defSets]=await Promise.all([
     q1(env,'SELECT COUNT(*) as total, SUM(file_size) as totalSize FROM ecu_uploads'),
     q1(env,'SELECT COUNT(*) as total FROM ecu_tuned_outputs'),
     qall(env,'SELECT tuning_type, status, COUNT(*) as count FROM ecu_tuning_history GROUP BY tuning_type, status'),
     q1(env,'SELECT COUNT(*) as total, SUM(definition_count) as totalDefs FROM ecu_definition_sets')
   ]);
   // Son 7 gün aktivite
   const weekAgo=now()-7*86400;
   const recentUploads=await q1(env,'SELECT COUNT(*) as c FROM ecu_uploads WHERE created_at>?',weekAgo);
   const recentTunes=await q1(env,'SELECT COUNT(*) as c FROM ecu_tuned_outputs WHERE created_at>?',weekAgo);
   // Araç dağılımı
   const vehicles=await qall(env,'SELECT vehicle_type, COUNT(*) as count FROM ecu_uploads WHERE vehicle_type IS NOT NULL GROUP BY vehicle_type ORDER BY count DESC LIMIT 20');
   // Format dağılımı
   const formats=await qall(env,'SELECT format, COUNT(*) as count FROM ecu_uploads GROUP BY format ORDER BY count DESC');
   // History türleri
   const historyByType={};for(const h of history){if(!historyByType[h.tuning_type])historyByType[h.tuning_type]={total:0,ok:0,error:0};historyByType[h.tuning_type].total+=h.count;if(h.status==='ok')historyByType[h.tuning_type].ok+=h.count;else historyByType[h.tuning_type].error+=h.count}
   return j({ok:true,uploads:{total:uploads?.total||0,totalSizeMB:((uploads?.totalSize||0)/1024/1024).toFixed(2)},tuned:{total:tuned?.total||0},definitions:{sets:defSets?.total||0,totalDefinitions:defSets?.totalDefs||0},activity:{last7days:{uploads:recentUploads?.c||0,tunes:recentTunes?.c||0}},historyByType,vehicles:vehicles.map(v=>{let parsed=v.vehicle_type;try{parsed=JSON.parse(v.vehicle_type)}catch(_){};return{vehicle:parsed,count:v.count}}),formats});
 }catch(e){return j({error:e.message||'STATS_FAILED'},500)}}

 // === ECU HISTORY — zenginleştirilmiş tuning geçmişi (filtreleme + istatistik) ===
 if(p==='/api/ecu/history'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const offset=parseInt(u.searchParams.get('offset')||'0');
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const tuningType=u.searchParams.get('type')||u.searchParams.get('tuning_type');
   const status=u.searchParams.get('status');
   // Dinamik WHERE
   let where='1=1';const params=[];
   if(uploadId){where+=' AND h.upload_id=?';params.push(uploadId)}
   if(tuningType){where+=' AND h.tuning_type=?';params.push(tuningType)}
   if(status){where+=' AND h.status=?';params.push(status)}
   params.push(limit,offset);
   const rows=await qall(env,`SELECT h.id,h.upload_id,h.vehicle_type,h.tuning_type,h.status,h.error_msg,h.created_at,u.filename,u.format,u.file_size FROM ecu_tuning_history h LEFT JOIN ecu_uploads u ON u.id=h.upload_id WHERE ${where} ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,...params);
   // Toplam sayı
   const countParams=params.slice(0,-2);
   const total=await q1(env,`SELECT COUNT(*) as c FROM ecu_tuning_history h WHERE ${where}`,...countParams);
   return j({ok:true,history:rows,total:total?.c||0,limit,offset,hasMore:(offset+limit)<(total?.c||0)});
 }catch(e){return j({error:e.message||'HISTORY_FAILED'},500)}}

 // === ECU UPLOADS LIST — yüklenen dosyaları listele ===
 if(p==='/api/ecu/uploads'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const offset=parseInt(u.searchParams.get('offset')||'0');
   const rows=await qall(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at,created_at,analyzed_at FROM ecu_uploads ORDER BY created_at DESC LIMIT ? OFFSET ?',limit,offset);
   const total=await q1(env,'SELECT COUNT(*) as c FROM ecu_uploads');
   return j({ok:true,uploads:rows.map(r=>{let vehicle=r.vehicle_type;try{vehicle=JSON.parse(r.vehicle_type)}catch(_){};return{...r,vehicle_type:vehicle,hasAnalysis:!!r.analyzed_at}}),total:total?.c||0,limit,offset});
 }catch(e){return j({error:e.message||'UPLOADS_LIST_FAILED'},500)}}

 // === ECU UPLOAD DETAIL — tek upload detayı + ilişkili tune/tanım ===
 if(p.startsWith('/api/ecu/uploads/')&&m==='GET'){try{
   const uploadId=p.split('/api/ecu/uploads/')[1];
   if(!uploadId)return j({error:'MISSING_ID'},400);
   const upload=await q1(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at,created_at,analyzed_at FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   let vehicle=upload.vehicle_type;try{vehicle=JSON.parse(upload.vehicle_type)}catch(_){}
   // İlişkili tune çıktıları
   const tunes=await qall(env,'SELECT id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,created_at FROM ecu_tuned_outputs WHERE upload_id=? ORDER BY created_at DESC',uploadId);
   // İlişkili tanım setleri
   const defSets=await qall(env,'SELECT id,filename,format,ecu_family,definition_count,created_at FROM ecu_definition_sets WHERE upload_id=? ORDER BY created_at DESC',uploadId);
   // İlişkili history
   const hist=await qall(env,'SELECT id,tuning_type,status,error_msg,created_at FROM ecu_tuning_history WHERE upload_id=? ORDER BY created_at DESC LIMIT 20',uploadId);
   return j({ok:true,upload:{...upload,vehicle_type:vehicle,hasAnalysis:!!upload.analyzed_at},tunedOutputs:tunes.map(t=>{let ap=[];try{ap=JSON.parse(t.proposals_applied||'[]')}catch(_){};return{...t,appliedCount:ap.length,systems:[...new Set(ap.map(a=>a.system).filter(Boolean))]}}),definitionSets:defSets,history:hist});
 }catch(e){return j({error:e.message||'UPLOAD_DETAIL_FAILED'},500)}}

 // === ECU TUNED OUTPUTS LIST — tüm tune edilmiş dosyalar ===
 if(p==='/api/ecu/tuned'&&m==='GET'){try{
   const u=new URL(req.url);
   const limit=Math.min(parseInt(u.searchParams.get('limit')||'20'),100);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   let rows;
   if(uploadId){
     rows=await qall(env,'SELECT t.id,t.upload_id,t.vehicle_id,t.proposals_applied,t.tuned_file_hash,t.tuned_file_size,t.created_at,u.filename,u.format FROM ecu_tuned_outputs t LEFT JOIN ecu_uploads u ON u.id=t.upload_id WHERE t.upload_id=? ORDER BY t.created_at DESC LIMIT ?',uploadId,limit);
   }else{
     rows=await qall(env,'SELECT t.id,t.upload_id,t.vehicle_id,t.proposals_applied,t.tuned_file_hash,t.tuned_file_size,t.created_at,u.filename,u.format FROM ecu_tuned_outputs t LEFT JOIN ecu_uploads u ON u.id=t.upload_id ORDER BY t.created_at DESC LIMIT ?',limit);
   }
   return j({ok:true,tunedOutputs:rows.map(r=>{let ap=[];try{ap=JSON.parse(r.proposals_applied||'[]')}catch(_){};return{...r,appliedCount:ap.length,systems:[...new Set(ap.map(a=>a.system).filter(Boolean))]}})});
 }catch(e){return j({error:e.message||'TUNED_LIST_FAILED'},500)}}

 // === ECU SYSTEM INFO — belirli bir sistem hakkında detaylı bilgi ===
 if(p==='/api/ecu/system-info'&&m==='GET'){try{
   const u=new URL(req.url);
   const system=u.searchParams.get('system');
   if(!system)return j({error:'MISSING_SYSTEM'},400);
   const mod=await import('./lib/tuning-engine.js');
   const info=mod.getSystemInfo(system);
   if(!info)return j({error:'SYSTEM_NOT_FOUND',available:['EGR','DPF','AdBlue/SCR','Lambda','Boost','Torque','Injection','MAF/MAP','Hız sınırı','RPM sınırı','Checksum','DTC','Pop&Bang','Start/Stop','Flap/Swirl','Cruise Control']},404);
   return j({ok:true,...info});
 }catch(e){return j({error:e.message||'SYSTEM_INFO_FAILED'},500)}}

 // === ECU PROFİLLERİ — ECU_PROFILES verisini expose et ===
 if(p==='/api/ecu/profiles'&&m==='GET'){try{
   const mod=await import('./lib/tuning-engine.js');
   const u=new URL(req.url);
   const ecuType=u.searchParams.get('ecuType');
   if(ecuType){
     const profile=mod.ECU_PROFILES[ecuType];
     if(!profile)return j({error:'ECU_TYPE_NOT_FOUND',available:Object.keys(mod.ECU_PROFILES)},404);
     return j({ok:true,ecuType,profile});
   }
   const profiles={};for(const[k,v]of Object.entries(mod.ECU_PROFILES)){profiles[k]={fuel:v.fuel,systemCount:(v.systems||[]).length,systems:v.systems||[],damosLabelCount:(v.damosLabels||[]).length}}
   return j({ok:true,profiles,totalTypes:Object.keys(mod.ECU_PROFILES).length,dieselTypes:Object.entries(mod.ECU_PROFILES).filter(([,v])=>v.fuel==='diesel').map(([k])=>k),gasolineTypes:Object.entries(mod.ECU_PROFILES).filter(([,v])=>v.fuel==='gasoline').map(([k])=>k)});
 }catch(e){return j({error:e.message||'PROFILES_FAILED'},500)}}

 // === ECU RAPOR EXPORT — yapılandırılmış analiz raporu ===
 if(p==='/api/ecu/export-report'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const original=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const fmt=mod.detectFileFormat(original);
   const stats=mod.fileStats(original);
   let normalized=null;
   try{const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');const{normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');normalized=normalizeD1Definitions(importedDefs)}catch(_){}
   const regions=await mod.scanRegions(original,normalized);
   const systemNames=[...new Set(regions.map(r=>r.system))];
   const systemInfos=systemNames.map(s=>mod.getSystemInfo(s)).filter(Boolean);
   const stage1=mod.buildStage1Package(systemNames);
   const ecuProfile=regions._ecuProfile||{ecuType:'unknown',fuel:'unknown'};
   const checksumResult=mod.validateChecksums(original);
   // Tuned outputs varsa onları da ekle
   const tunedOutputs=await qall(env,'SELECT id,tuned_file_size,tuned_file_hash,proposals_applied,created_at FROM ecu_tuned_outputs WHERE upload_id=?',uploadId);
   // Dosya hafızası
   const fileMem=await q1(env,'SELECT * FROM ecu_file_memory WHERE file_hash=?',upload.file_hash);
   const report={
     meta:{generatedAt:Date.now(),version:'2.0',format:b.format||'json'},
     file:{name:upload.filename,size:original.length,hash:upload.file_hash,format:fmt.format,stats:{entropy:stats.entropy,zeroPct:stats.zeroPct,ffPct:stats.ffPct}},
     vehicle:JSON.parse(upload.vehicle_type||'{}'),
     ecuProfile,
     analysis:{totalRegions:regions.length,systems:systemNames,systemDetails:systemInfos,stage1Package:stage1,rulepackMatches:regions._rulepackMatches||[],tierBreakdown:{tier0:regions.filter(r=>r.tier===0).length,tier1:regions.filter(r=>r.tier===1).length,tier1b:regions.filter(r=>r.tier==='1b').length,tier2:regions.filter(r=>r.tier===2).length,tier3:regions.filter(r=>r.tier===3).length},regionsBySystem:{}},
     checksum:checksumResult,
     tunedOutputs:tunedOutputs.map(t=>({id:t.id,size:t.tuned_file_size,hash:t.tuned_file_hash,appliedCount:JSON.parse(t.proposals_applied||'[]').length,createdAt:t.created_at})),
     fileMemory:fileMem?{timesUploaded:fileMem.times_uploaded,firstSeen:fileMem.first_seen_at,lastSeen:fileMem.last_seen_at,notes:fileMem.notes,tags:JSON.parse(fileMem.tags||'[]')}:null
   };
   for(const sys of systemNames){report.analysis.regionsBySystem[sys]=regions.filter(r=>r.system===sys).map(r=>({id:r.id,label:r.label||'',offset:r.offset,offsetHex:'0x'+r.offset.toString(16).toUpperCase(),tier:r.tier,actionCount:(r.actions||[]).length}))}
   return j({ok:true,report});
 }catch(e){return j({error:e.message||'EXPORT_REPORT_FAILED'},500)}}

 // === ECU BATCH İŞLEMLERİ — birden fazla upload üzerinde toplu operasyon ===
 if(p==='/api/ecu/batch'&&m==='POST'){try{
   const b=await body(req);
   const op=b.operation;
   const uploadIds=Array.isArray(b.uploadIds)?b.uploadIds:[];
   if(!op)return j({error:'OPERATION_REQUIRED',available:['analyze','delete','tag','export-hashes']},400);
   if(!uploadIds.length)return j({error:'UPLOAD_IDS_REQUIRED'},400);
   if(uploadIds.length>50)return j({error:'TOO_MANY_IDS',max:50},400);
   const results=[];
   if(op==='analyze'){
     const mod=await import('./lib/tuning-engine.js');
     let normalized=null;
     try{const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');const{normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');normalized=normalizeD1Definitions(importedDefs)}catch(_){}
     for(const uid of uploadIds){
       try{
         const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uid);
         if(!upload){results.push({id:uid,ok:false,error:'NOT_FOUND'});continue}
         const obj=await fileGet(env,upload.binary_data);
         if(!obj){results.push({id:uid,ok:false,error:'FILE_NOT_FOUND'});continue}
         const bytes=new Uint8Array(await obj.arrayBuffer());
         const regions=await mod.scanRegions(bytes,normalized);
         const systemNames=[...new Set(regions.map(r=>r.system))];
         const ecuProfile=regions._ecuProfile||{ecuType:'unknown',fuel:'unknown'};
         const ts=Date.now();
         await run(env,'UPDATE ecu_uploads SET analysis_json=?,analyzed_at=? WHERE id=?',JSON.stringify({regions:regions.length,systems:systemNames,ecuProfile,tiers:{t0:regions.filter(r=>r.tier===0).length,t1:regions.filter(r=>r.tier===1).length,t2:regions.filter(r=>r.tier===2).length}}),ts,uid);
         results.push({id:uid,ok:true,regions:regions.length,systems:systemNames,ecuProfile});
       }catch(err){results.push({id:uid,ok:false,error:err.message})}
     }
   }else if(op==='delete'){
     for(const uid of uploadIds){
       try{await run(env,'DELETE FROM ecu_tuned_outputs WHERE upload_id=?',uid);await run(env,'DELETE FROM ecu_uploads WHERE id=?',uid);results.push({id:uid,ok:true})}catch(err){results.push({id:uid,ok:false,error:err.message})}
     }
   }else if(op==='tag'){
     const tag=b.tag||'';
     if(!tag)return j({error:'TAG_REQUIRED'},400);
     for(const uid of uploadIds){
       try{
         const mem=await q1(env,'SELECT id,tags FROM ecu_file_memory fm INNER JOIN ecu_uploads u ON fm.file_hash=u.file_hash WHERE u.id=?',uid);
         if(mem){const tags=JSON.parse(mem.tags||'[]');if(!tags.includes(tag)){tags.push(tag);await run(env,'UPDATE ecu_file_memory SET tags=? WHERE id=?',JSON.stringify(tags),mem.id)}results.push({id:uid,ok:true})}
         else results.push({id:uid,ok:false,error:'NO_FILE_MEMORY'});
       }catch(err){results.push({id:uid,ok:false,error:err.message})}
     }
   }else if(op==='export-hashes'){
     for(const uid of uploadIds){
       try{const u=await q1(env,'SELECT id,filename,file_hash,file_size FROM ecu_uploads WHERE id=?',uid);if(u)results.push({id:uid,ok:true,filename:u.filename,hash:u.file_hash,size:u.file_size});else results.push({id:uid,ok:false,error:'NOT_FOUND'})}catch(err){results.push({id:uid,ok:false,error:err.message})}
     }
   }else return j({error:'UNKNOWN_OPERATION',available:['analyze','delete','tag','export-hashes']},400);
   return j({ok:true,operation:op,total:uploadIds.length,succeeded:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,results});
 }catch(e){return j({error:e.message||'BATCH_FAILED'},500)}}

 // === ECU DIFF RAPOR — orijinal ve tuned arasında byte-seviye fark ===
 if(p==='/api/ecu/diff-report'&&m==='GET'){try{
   const u=new URL(req.url);
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',tuned.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const[origObj,tunedObj]=await Promise.all([fileGet(env,upload.binary_data),fileGet(env,tuned.tuned_binary_data)]);
   if(!origObj||!tunedObj)return j({error:'FILE_NOT_FOUND'},404);
   const[origBuf,tunedBuf]=await Promise.all([origObj.arrayBuffer(),tunedObj.arrayBuffer()]);
   const orig=new Uint8Array(origBuf),mod=new Uint8Array(tunedBuf);
   const maxLen=Math.max(orig.length,mod.length);
   const limit=Number(u.searchParams.get('limit'))||500;
   const changes=[];let totalChanged=0;
   for(let i=0;i<maxLen&&changes.length<limit;i++){
     const ob=i<orig.length?orig[i]:0,mb=i<mod.length?mod[i]:0;
     if(ob!==mb){totalChanged++;changes.push({offset:i,offsetHex:'0x'+i.toString(16).toUpperCase(),original:ob,originalHex:'0x'+ob.toString(16).toUpperCase().padStart(2,'0'),modified:mb,modifiedHex:'0x'+mb.toString(16).toUpperCase().padStart(2,'0')})}
   }
   // Bölge bazlı grupla
   const applied=JSON.parse(tuned.proposals_applied||'[]');
   const changeRegions=[];let regionStart=-1,regionEnd=-1;
   for(const c of changes){
     if(regionStart===-1){regionStart=c.offset;regionEnd=c.offset}
     else if(c.offset-regionEnd>16){changeRegions.push({start:regionStart,startHex:'0x'+regionStart.toString(16).toUpperCase(),end:regionEnd,byteCount:regionEnd-regionStart+1});regionStart=c.offset;regionEnd=c.offset}
     else regionEnd=c.offset;
   }
   if(regionStart!==-1)changeRegions.push({start:regionStart,startHex:'0x'+regionStart.toString(16).toUpperCase(),end:regionEnd,byteCount:regionEnd-regionStart+1});
   return j({ok:true,uploadId:tuned.upload_id,tunedId,originalSize:orig.length,tunedSize:mod.length,totalChangedBytes:totalChanged,changesShown:changes.length,truncated:totalChanged>limit,changes,changeRegions,appliedActions:applied});
 }catch(e){return j({error:e.message||'DIFF_FAILED'},500)}}

 // === ECU CLONE — tuned çıktıyı yeni başlangıç noktası olarak klonla ===
 if(p==='/api/ecu/clone'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const origUpload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',tuned.upload_id);
   if(!origUpload)return j({error:'ORIGINAL_UPLOAD_NOT_FOUND'},404);
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const tunedBytes=new Uint8Array(await tunedObj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   const newId=id();
   const newHash=await mod.sha256Hex(tunedBytes);
   const newFilename='cloned-'+String(origUpload.filename||'file.bin');
   const newKey='ecu/'+newId+'/'+newFilename.replace(/[\\/]/g,'_');
   await filePut(env,newKey,tunedBytes,{contentType:'application/octet-stream'});
   const vehicleInfo=JSON.parse(origUpload.vehicle_type||'{}');
   const ts=Date.now();
   await run(env,'INSERT INTO ecu_uploads(id,user_id,filename,format,vehicle_type,file_hash,file_size,binary_data,uploaded_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',newId,'owner',newFilename,origUpload.format||'bin',JSON.stringify(vehicleInfo),newHash,tunedBytes.length,newKey,ts,ts);
   return j({ok:true,newUploadId:newId,filename:newFilename,size:tunedBytes.length,hash:newHash,clonedFrom:{tunedId,originalUploadId:tuned.upload_id}});
 }catch(e){return j({error:e.message||'CLONE_FAILED'},500)}}

 // === ECU ROLLBACK — tuned çıktıyı sil/geri al ===
 if(p==='/api/ecu/rollback'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   // Dosyayı sil
   try{await fileDelete(env,tuned.tuned_binary_data)}catch(_){}
   await run(env,'DELETE FROM ecu_tuned_outputs WHERE id=?',tunedId);
   // Dosya hafızasından son modifikasyonu kaldır
   try{
     const upload=await q1(env,'SELECT file_hash FROM ecu_uploads WHERE id=?',tuned.upload_id);
     if(upload){
       const mem=await q1(env,'SELECT id,last_modifications FROM ecu_file_memory WHERE file_hash=?',upload.file_hash);
       if(mem){const mods=JSON.parse(mem.last_modifications||'[]').filter(m=>m.tunedId!==tunedId);await run(env,'UPDATE ecu_file_memory SET last_modifications=? WHERE id=?',JSON.stringify(mods),mem.id)}
     }
   }catch(_){}
   return j({ok:true,deletedTunedId:tunedId,uploadId:tuned.upload_id});
 }catch(e){return j({error:e.message||'ROLLBACK_FAILED'},500)}}

 // === ECU ARAMA — uploads, tuned, history üzerinde birleşik arama ===
 if(p==='/api/ecu/search'&&m==='GET'){try{
   const u=new URL(req.url);
   const q=u.searchParams.get('q')||'';
   const type=u.searchParams.get('type')||'all';
   const limit=Math.min(Number(u.searchParams.get('limit'))||25,100);
   const results={uploads:[],tuned:[],history:[],fileMemory:[]};
   if(type==='all'||type==='uploads'){
     const uploads=q?await qall(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at FROM ecu_uploads WHERE filename LIKE ? OR vehicle_type LIKE ? ORDER BY uploaded_at DESC LIMIT ?','%'+q+'%','%'+q+'%',limit):await qall(env,'SELECT id,filename,format,vehicle_type,file_hash,file_size,uploaded_at FROM ecu_uploads ORDER BY uploaded_at DESC LIMIT ?',limit);
     results.uploads=uploads.map(u=>({...u,vehicle:JSON.parse(u.vehicle_type||'{}')}));
   }
   if(type==='all'||type==='tuned'){
     results.tuned=await qall(env,'SELECT t.id,t.upload_id,t.tuned_file_size,t.tuned_file_hash,t.proposals_applied,t.created_at,u.filename FROM ecu_tuned_outputs t LEFT JOIN ecu_uploads u ON t.upload_id=u.id ORDER BY t.created_at DESC LIMIT ?',limit);
     results.tuned=results.tuned.map(t=>({...t,appliedCount:JSON.parse(t.proposals_applied||'[]').length}));
   }
   if(type==='all'||type==='history'){
     results.history=q?await qall(env,'SELECT * FROM ecu_action_history WHERE action_type LIKE ? OR details LIKE ? ORDER BY created_at DESC LIMIT ?','%'+q+'%','%'+q+'%',limit):await qall(env,'SELECT * FROM ecu_action_history ORDER BY created_at DESC LIMIT ?',limit);
   }
   if(type==='all'||type==='file-memory'){
     results.fileMemory=q?await qall(env,'SELECT id,file_hash,filename,ecu_type,fuel_type,vehicle_make,vehicle_model,times_uploaded,tags,notes FROM ecu_file_memory WHERE filename LIKE ? OR ecu_type LIKE ? OR vehicle_make LIKE ? OR vehicle_model LIKE ? OR notes LIKE ? ORDER BY last_seen_at DESC LIMIT ?','%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%',limit):await qall(env,'SELECT id,file_hash,filename,ecu_type,fuel_type,vehicle_make,vehicle_model,times_uploaded,tags,notes FROM ecu_file_memory ORDER BY last_seen_at DESC LIMIT ?',limit);
   }
   const total=results.uploads.length+results.tuned.length+results.history.length+results.fileMemory.length;
   return j({ok:true,query:q,type,total,results});
 }catch(e){return j({error:e.message||'SEARCH_FAILED'},500)}}

 // === ECU PRESETS — öntanımlı tuning paketleri ===
 if(p==='/api/ecu/presets'&&m==='GET'){try{
   const u=new URL(req.url);
   const fuel=u.searchParams.get('fuel');
   const ecuType=u.searchParams.get('ecuType');
   const mod=await import('./lib/tuning-engine.js');
   const presets=[
     {id:'stage1-diesel',name:'Stage 1 — Dizel',fuel:'diesel',description:'EGR Off + DPF Off + Tork limitleri kaldır',systems:['EGR','DPF','Torque','Boost'],riskLevel:'medium',estimatedHpGain:'20-40%',popular:true},
     {id:'stage1-gasoline',name:'Stage 1 — Benzin',fuel:'gasoline',description:'Lambda ayar + Boost artır + Tork limitleri kaldır',systems:['Lambda','Boost','Torque'],riskLevel:'medium',estimatedHpGain:'15-30%',popular:true},
     {id:'dpf-off',name:'DPF Off',fuel:'diesel',description:'Dizel Partikül Filtresi kapatma',systems:['DPF'],riskLevel:'medium',estimatedHpGain:'5-10%',popular:true},
     {id:'egr-off',name:'EGR Off',fuel:'diesel',description:'Egzoz Gaz Geri Devir kapatma',systems:['EGR'],riskLevel:'low',estimatedHpGain:'3-5%',popular:true},
     {id:'adblue-off',name:'AdBlue/SCR Off',fuel:'diesel',description:'AdBlue/SCR sistemi kapatma',systems:['AdBlue/SCR'],riskLevel:'medium',estimatedHpGain:'0-2%',popular:true},
     {id:'pop-bang',name:'Pop & Bang',fuel:'gasoline',description:'Egzoz patlaması efekti',systems:['Pop&Bang'],riskLevel:'high',estimatedHpGain:'0%',popular:false},
     {id:'speed-limit-off',name:'Hız Sınırı Kaldır',fuel:'all',description:'Elektronik hız sınırlayıcı kapatma',systems:['Hız sınırı'],riskLevel:'low',estimatedHpGain:'0%',popular:true},
     {id:'rpm-limit-raise',name:'RPM Sınırı Yükselt',fuel:'all',description:'Motor devir sınırını yükselt',systems:['RPM sınırı'],riskLevel:'medium',estimatedHpGain:'0%',popular:false},
     {id:'dtc-off',name:'DTC Off',fuel:'all',description:'Belirli hata kodlarını kapat',systems:['DTC'],riskLevel:'low',estimatedHpGain:'0%',popular:false},
     {id:'full-delete-diesel',name:'Full Delete — Dizel',fuel:'diesel',description:'EGR + DPF + AdBlue + Lambda + Flap Off',systems:['EGR','DPF','AdBlue/SCR','Lambda','Flap/Swirl'],riskLevel:'high',estimatedHpGain:'25-45%',popular:false},
     {id:'start-stop-off',name:'Start/Stop Devre Dışı',fuel:'all',description:'Otomatik start/stop fonksiyonunu kapat',systems:['Start/Stop'],riskLevel:'low',estimatedHpGain:'0%',popular:false},
     {id:'flap-swirl-off',name:'Flap/Swirl Kapatma',fuel:'diesel',description:'Emme manifold klapesi kapatma',systems:['Flap/Swirl'],riskLevel:'low',estimatedHpGain:'2-5%',popular:false},
   ];
   let filtered=presets;
   if(fuel&&fuel!=='all')filtered=filtered.filter(p=>p.fuel===fuel||p.fuel==='all');
   if(ecuType){
     const profile=mod.ECU_PROFILES[ecuType];
     if(profile){
       filtered=filtered.filter(p=>p.fuel===profile.fuel||p.fuel==='all');
       filtered=filtered.map(p=>({...p,compatible:p.systems.every(s=>(profile.systems||[]).includes(s)),matchingSystems:p.systems.filter(s=>(profile.systems||[]).includes(s))}));
     }
   }
   return j({ok:true,presets:filtered,total:filtered.length});
 }catch(e){return j({error:e.message||'PRESETS_FAILED'},500)}}

 // === ECU PRESETS POST — preset uygula ===
 if(p==='/api/ecu/presets'&&m==='POST'){try{
   const b=await body(req);
   const presetId=b.presetId||b.preset_id;
   const uploadId=b.uploadId||b.upload_id;
   if(!presetId||!uploadId)return j({error:'PRESET_ID_AND_UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const original=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   let normalized=null;
   try{const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');const{normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');normalized=normalizeD1Definitions(importedDefs)}catch(_){}
   const regions=await mod.scanRegions(original,normalized);
   // Preset'e göre sistemleri filtrele
   const presetSystems={'stage1-diesel':['EGR','DPF','Torque','Boost'],'stage1-gasoline':['Lambda','Boost','Torque'],'dpf-off':['DPF'],'egr-off':['EGR'],'adblue-off':['AdBlue/SCR'],'pop-bang':['Pop&Bang'],'speed-limit-off':['Hız sınırı'],'rpm-limit-raise':['RPM sınırı'],'dtc-off':['DTC'],'full-delete-diesel':['EGR','DPF','AdBlue/SCR','Lambda','Flap/Swirl'],'start-stop-off':['Start/Stop'],'flap-swirl-off':['Flap/Swirl']};
   const targetSystems=presetSystems[presetId];
   if(!targetSystems)return j({error:'PRESET_NOT_FOUND',available:Object.keys(presetSystems)},404);
   const matchingActions=regions.filter(r=>targetSystems.includes(r.system)).flatMap(r=>r.actions.map(a=>({...a,system:r.system})));
   if(!matchingActions.length)return j({error:'NO_MATCHING_ACTIONS',preset:presetId,scannedSystems:[...new Set(regions.map(r=>r.system))]},404);
   // Preview modu
   if(b.preview)return j({ok:true,preview:true,presetId,matchingActions:matchingActions.length,systems:[...new Set(matchingActions.map(a=>a.system))],actions:matchingActions.map(a=>({id:a.id,label:a.label||'',system:a.system,offset:a.offset,offsetHex:'0x'+a.offset.toString(16).toUpperCase(),risk:a.risk||'medium'}))});
   // Apply
   const result=await mod.applyActions(original,matchingActions);
   const tuned_id=id();
   const outKey='ecu/'+tuned_id+'/tuned-'+String(upload.filename||'file.bin').replace(/[\\/]/g,'_');
   await filePut(env,outKey,result.tuned,{contentType:'application/octet-stream'});
   await run(env,'INSERT INTO ecu_tuned_outputs(id,upload_id,vehicle_id,proposals_applied,tuned_file_hash,tuned_file_size,tuned_binary_data,created_at) VALUES(?,?,?,?,?,?,?,?)',tuned_id,upload.id,'preset-'+presetId,JSON.stringify(result.applied),result.hash,result.size,outKey,now());
   return j({ok:true,tunedId:tuned_id,presetId,size:result.size,hash:result.hash,applied:result.applied,checksum:result.checksum||null});
 }catch(e){return j({error:e.message||'PRESET_APPLY_FAILED'},500)}}

 // === ECU HEX GÖRÜNTÜLEYICI — binary dosyanın hex dump'ı ===
 if(p==='/api/ecu/hex-view'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   const tunedId=u.searchParams.get('tunedId')||u.searchParams.get('tuned_id');
   if(!uploadId&&!tunedId)return j({error:'UPLOAD_ID_OR_TUNED_ID_REQUIRED'},400);
   let fileKey,fileName;
   if(tunedId){const t=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);if(!t)return j({error:'TUNED_NOT_FOUND'},404);fileKey=t.tuned_binary_data;const u2=await q1(env,'SELECT filename FROM ecu_uploads WHERE id=?',t.upload_id);fileName=(u2?.filename||'tuned.bin')}
   else{const up=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);if(!up)return j({error:'UPLOAD_NOT_FOUND'},404);fileKey=up.binary_data;fileName=up.filename}
   const obj=await fileGet(env,fileKey);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const offset=Math.max(0,Number(u.searchParams.get('offset'))||0);
   const length=Math.min(Number(u.searchParams.get('length'))||256,4096);
   const end=Math.min(offset+length,bytes.length);
   const slice=bytes.slice(offset,end);
   const lines=[];
   for(let i=0;i<slice.length;i+=16){
     const hex=[];const ascii=[];
     for(let k=0;k<16;k++){if(i+k<slice.length){const b=slice[i+k];hex.push(b.toString(16).toUpperCase().padStart(2,'0'));ascii.push(b>=32&&b<127?String.fromCharCode(b):'.')}else{hex.push('  ');ascii.push(' ')}}
     lines.push({address:offset+i,addressHex:'0x'+(offset+i).toString(16).toUpperCase().padStart(8,'0'),hex:hex.join(' '),ascii:ascii.join('')});
   }
   return j({ok:true,fileName,fileSize:bytes.length,offset,length:end-offset,totalSize:bytes.length,lines,hasMore:end<bytes.length});
 }catch(e){return j({error:e.message||'HEX_VIEW_FAILED'},500)}}

 // === ECU MAP TABLOLARI — dosyadaki tespit edilen harita tabloları ===
 if(p==='/api/ecu/map-tables'&&m==='GET'){try{
   const u=new URL(req.url);
   const uploadId=u.searchParams.get('uploadId')||u.searchParams.get('upload_id');
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   let normalized=null;
   try{const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');const{normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');normalized=normalizeD1Definitions(importedDefs)}catch(_){}
   const regions=await mod.scanRegions(bytes,normalized);
   // Map action'ları olan bölgeleri çıkar
   const mapTables=[];
   for(const r of regions){
     for(const a of(r.actions||[])){
       if(a.mapAction||a.elementCount>1){
         const tbl={system:r.system,label:a.label||r.label||'',offset:a.offset,offsetHex:'0x'+a.offset.toString(16).toUpperCase(),elementCount:a.elementCount||1,elementSize:a.elementSize||1,dataSize:a.dataSize||1,mapAction:a.mapAction||null,tier:r.tier,id:a.id};
         // Mevcut değerleri oku
         if(a.offset>=0&&a.offset+((a.elementCount||1)*(a.elementSize||1))<=bytes.length){
           const elCount=a.elementCount||1,elSize=a.elementSize||1;
           const vals=[];for(let i=0;i<Math.min(elCount,64);i++){let v=0;const o=a.offset+i*elSize;for(let b=0;b<elSize;b++)v|=bytes[o+b]<<(8*b);vals.push(v)}
           tbl.currentValues=vals;tbl.previewHex=vals.slice(0,16).map(v=>v.toString(16).toUpperCase().padStart(elSize*2,'0'));
         }
         mapTables.push(tbl);
       }
     }
   }
   return j({ok:true,uploadId,totalMaps:mapTables.length,mapTables,systemSummary:{},...(()=>{const s={};for(const m of mapTables){s[m.system]=(s[m.system]||0)+1}return{systemSummary:s}})()});
 }catch(e){return j({error:e.message||'MAP_TABLES_FAILED'},500)}}

 // === ARAÇ VERİTABANI ARAMA — VEHICLE_DB üzerinde arama ===
 if(p==='/api/ecu/vehicle-db/search'&&m==='GET'){try{
   const u=new URL(req.url);
   const q=(u.searchParams.get('q')||'').toLowerCase();
   const make=u.searchParams.get('make');
   const ecuType=u.searchParams.get('ecuType');
   if(!q&&!make&&!ecuType)return j({error:'QUERY_REQUIRED',params:['q','make','ecuType']},400);
   const mod=await import('./lib/tuning-engine.js');
   const db=mod.VEHICLE_DB;
   const results=[];
   for(const entry of db){
     const matchMake=!make||entry.make.toLowerCase()===make.toLowerCase();
     const matchEcu=!ecuType||entry.ecuType===ecuType;
     const matchQ=!q||entry.make.toLowerCase().includes(q)||entry.model.toLowerCase().includes(q)||entry.ecuType.toLowerCase().includes(q)||(entry.engine||'').toLowerCase().includes(q);
     if(matchMake&&matchEcu&&matchQ)results.push(entry);
   }
   return j({ok:true,query:q||make||ecuType,total:results.length,results:results.slice(0,50),allMakes:[...new Set(db.map(e=>e.make))],allEcuTypes:[...new Set(db.map(e=>e.ecuType))]});
 }catch(e){return j({error:e.message||'VEHICLE_SEARCH_FAILED'},500)}}

 // === ECU FLASH HAZIRLAMA — dosyayı flash için son doğrulama ve paketleme ===
 if(p==='/api/ecu/flash-prepare'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',tuned.upload_id);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const[origObj,tunedObj]=await Promise.all([fileGet(env,upload.binary_data),fileGet(env,tuned.tuned_binary_data)]);
   if(!origObj||!tunedObj)return j({error:'FILE_NOT_FOUND'},404);
   const[origBuf,tunedBuf]=await Promise.all([origObj.arrayBuffer(),tunedObj.arrayBuffer()]);
   const orig=new Uint8Array(origBuf),tunedBytes=new Uint8Array(tunedBuf);
   const mod=await import('./lib/tuning-engine.js');
   const checks={sizeMatch:orig.length===tunedBytes.length,checksum:mod.validateChecksums(tunedBytes),format:mod.detectFileFormat(tunedBytes),validate:mod.validateTunedFile(orig,tunedBytes)};
   const applied=JSON.parse(tuned.proposals_applied||'[]');
   let changedBytes=0;for(let i=0;i<Math.min(orig.length,tunedBytes.length);i++){if(orig[i]!==tunedBytes[i])changedBytes++}
   const warnings=[];
   if(!checks.sizeMatch)warnings.push('Dosya boyutu eşleşmiyor — flash araçları ret edebilir');
   if(checks.checksum&&!checks.checksum.valid)warnings.push('Checksum geçersiz — ECU bu dosyayı kabul etmeyebilir');
   if(changedBytes>orig.length*0.05)warnings.push('Toplam değişiklik oranı %5\'in üzerinde — dikkatli kontrol edin');
   if(changedBytes===0)warnings.push('Hiçbir byte değişmemiş — bu dosya orijinal ile aynı');
   return j({ok:true,ready:checks.sizeMatch&&(checks.checksum?.valid!==false)&&changedBytes>0,tunedId,uploadId:tuned.upload_id,filename:(upload.filename||'file.bin').replace(/(\.[^.]+)$/,'_tuned$1'),originalSize:orig.length,tunedSize:tunedBytes.length,changedBytes,changePercent:Number((changedBytes/orig.length*100).toFixed(3)),appliedActions:applied.length,checks,warnings,flashInfo:{tool:'K-TAG / KESS / CMD / PCMFlash / MPPS',protocol:checks.format?.format||'unknown',recommendation:warnings.length===0?'Dosya flash\'a hazır':'Uyarıları kontrol edin'}});
 }catch(e){return j({error:e.message||'FLASH_PREPARE_FAILED'},500)}}

 // === ECU STAGE 1 ÖNİZLEME — belirli upload için Stage 1 paketini önizle ===
 if(p==='/api/ecu/stage1-preview'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.uploadId||b.upload_id;
   if(!uploadId)return j({error:'UPLOAD_ID_REQUIRED'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'FILE_NOT_FOUND'},404);
   const bytes=new Uint8Array(await obj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   let normalized=null;
   try{const importedDefs=await qall(env,'SELECT * FROM ecu_definitions ORDER BY address ASC');const{normalizeD1Definitions}=await import('./lib/ecu-definition-parser.js');normalized=normalizeD1Definitions(importedDefs)}catch(_){}
   const regions=await mod.scanRegions(bytes,normalized);
   const systemNames=[...new Set(regions.map(r=>r.system))];
   const ecuProfile=regions._ecuProfile||{ecuType:'unknown',fuel:'unknown'};
   const stage1=mod.buildStage1Package(systemNames);
   const systemInfos=systemNames.map(s=>mod.getSystemInfo(s)).filter(Boolean);
   // Her sistem için action sayısı
   const actionBreakdown={};
   for(const r of regions){const sys=r.system;if(!actionBreakdown[sys])actionBreakdown[sys]={system:sys,regions:0,actions:0,info:mod.getSystemInfo(sys)};actionBreakdown[sys].regions++;actionBreakdown[sys].actions+=(r.actions||[]).length}
   return j({ok:true,uploadId,vehicle:JSON.parse(upload.vehicle_type||'{}'),ecuProfile,stage1,detectedSystems:systemNames,systemInfos,actionBreakdown:Object.values(actionBreakdown),totalRegions:regions.length,totalActions:regions.reduce((s,r)=>s+(r.actions||[]).length,0)});
 }catch(e){return j({error:e.message||'STAGE1_PREVIEW_FAILED'},500)}}

 // === ECU TOPLU SİLME — birden fazla upload/tuned silme ===
 if(p==='/api/ecu/bulk-delete'&&m==='POST'){try{
   const b=await body(req);
   const uploadIds=Array.isArray(b.uploadIds)?b.uploadIds:[];
   const tunedIds=Array.isArray(b.tunedIds)?b.tunedIds:[];
   if(!uploadIds.length&&!tunedIds.length)return j({error:'NO_IDS_PROVIDED'},400);
   if(uploadIds.length+tunedIds.length>100)return j({error:'TOO_MANY_IDS',max:100},400);
   const results={deletedUploads:[],deletedTuned:[],errors:[]};
   for(const tid of tunedIds){
     try{const t=await q1(env,'SELECT tuned_binary_data FROM ecu_tuned_outputs WHERE id=?',tid);if(t){try{await fileDelete(env,t.tuned_binary_data)}catch(_){}await run(env,'DELETE FROM ecu_tuned_outputs WHERE id=?',tid);results.deletedTuned.push(tid)}else results.errors.push({id:tid,type:'tuned',error:'NOT_FOUND'})}catch(err){results.errors.push({id:tid,type:'tuned',error:err.message})}
   }
   for(const uid of uploadIds){
     try{
       const u=await q1(env,'SELECT binary_data FROM ecu_uploads WHERE id=?',uid);
       if(u){
         // Önce ilişkili tuned dosyaları sil
         const related=await qall(env,'SELECT id,tuned_binary_data FROM ecu_tuned_outputs WHERE upload_id=?',uid);
         for(const r of related){try{await fileDelete(env,r.tuned_binary_data)}catch(_){}await run(env,'DELETE FROM ecu_tuned_outputs WHERE id=?',r.id);results.deletedTuned.push(r.id)}
         try{await fileDelete(env,u.binary_data)}catch(_){}
         await run(env,'DELETE FROM ecu_uploads WHERE id=?',uid);
         results.deletedUploads.push(uid);
       }else results.errors.push({id:uid,type:'upload',error:'NOT_FOUND'});
     }catch(err){results.errors.push({id:uid,type:'upload',error:err.message})}
   }
   return j({ok:true,...results,summary:{uploadsDeleted:results.deletedUploads.length,tunedDeleted:results.deletedTuned.length,errors:results.errors.length}});
 }catch(e){return j({error:e.message||'BULK_DELETE_FAILED'},500)}}

 // === ECU CHECKSUM OTO-DÜZELT — tuned dosyadaki checksum'ları otomatik düzelt ===
 if(p==='/api/ecu/checksum/auto-correct'&&m==='POST'){try{
   const b=await body(req);
   const tunedId=b.tunedId||b.tuned_id;
   if(!tunedId)return j({error:'TUNED_ID_REQUIRED'},400);
   const tuned=await q1(env,'SELECT * FROM ecu_tuned_outputs WHERE id=?',tunedId);
   if(!tuned)return j({error:'TUNED_NOT_FOUND'},404);
   const tunedObj=await fileGet(env,tuned.tuned_binary_data);
   if(!tunedObj)return j({error:'TUNED_FILE_NOT_FOUND'},404);
   const tunedBytes=new Uint8Array(await tunedObj.arrayBuffer());
   const mod=await import('./lib/tuning-engine.js');
   // Önce mevcut checksum durumunu kontrol et
   const beforeCheck=mod.validateChecksums(tunedBytes);
   if(beforeCheck.valid)return j({ok:true,alreadyValid:true,checksum:beforeCheck});
   // Checksum düzeltme — Bosch blok bazlı
   const corrected=new Uint8Array(tunedBytes);
   let correctedCount=0;
   if(beforeCheck.blocks&&Array.isArray(beforeCheck.blocks)){
     for(const block of beforeCheck.blocks){
       if(!block.valid&&block.offset!=null&&block.length!=null&&block.checksumOffset!=null){
         // Blok checksum'ını yeniden hesapla
         let sum=0;
         for(let i=block.offset;i<block.offset+block.length;i++){if(i!==block.checksumOffset&&i<corrected.length)sum=(sum+corrected[i])&0xFFFFFFFF}
         const target=(0x100000000-sum)&0xFFFFFFFF;
         if(block.checksumOffset+4<=corrected.length){
           corrected[block.checksumOffset]=target&0xFF;
           corrected[block.checksumOffset+1]=(target>>8)&0xFF;
           corrected[block.checksumOffset+2]=(target>>16)&0xFF;
           corrected[block.checksumOffset+3]=(target>>24)&0xFF;
           correctedCount++;
         }
       }
     }
   }
   if(correctedCount===0)return j({ok:false,error:'CHECKSUM_CORRECTION_NOT_POSSIBLE',detail:'Blok bilgisi yetersiz veya desteklenmeyen checksum formatı',before:beforeCheck});
   // Düzeltilmiş dosyayı kaydet
   const newHash=await mod.sha256Hex(corrected);
   await filePut(env,tuned.tuned_binary_data,corrected,{contentType:'application/octet-stream'});
   await run(env,'UPDATE ecu_tuned_outputs SET tuned_file_hash=?,tuned_file_size=? WHERE id=?',newHash,corrected.length,tunedId);
   const afterCheck=mod.validateChecksums(corrected);
   return j({ok:true,correctedBlocks:correctedCount,before:beforeCheck,after:afterCheck,newHash});
 }catch(e){return j({error:e.message||'CHECKSUM_CORRECT_FAILED'},500)}}

 // === DOSYA HAFIZA BİRLEŞTİR — birden fazla file memory kaydını birleştir ===
 if(p==='/api/ecu/file-memory/merge'&&m==='POST'){try{
   const b=await body(req);
   const sourceIds=Array.isArray(b.sourceIds)?b.sourceIds:[];
   const targetId=b.targetId;
   if(sourceIds.length<1||!targetId)return j({error:'SOURCE_IDS_AND_TARGET_ID_REQUIRED'},400);
   const target=await q1(env,'SELECT * FROM ecu_file_memory WHERE id=?',targetId);
   if(!target)return j({error:'TARGET_NOT_FOUND'},404);
   let mergedTags=JSON.parse(target.tags||'[]');
   let mergedMods=JSON.parse(target.last_modifications||'[]');
   let mergedUploads=JSON.parse(target.upload_ids||'[]');
   let mergedNotes=target.notes||'';
   let totalUploads=target.times_uploaded||1;
   const merged=[];
   for(const sid of sourceIds){
     if(sid===targetId)continue;
     const src=await q1(env,'SELECT * FROM ecu_file_memory WHERE id=?',sid);
     if(!src){continue}
     const srcTags=JSON.parse(src.tags||'[]');for(const t of srcTags){if(!mergedTags.includes(t))mergedTags.push(t)}
     const srcMods=JSON.parse(src.last_modifications||'[]');mergedMods=mergedMods.concat(srcMods);
     const srcUploads=JSON.parse(src.upload_ids||'[]');for(const u of srcUploads){if(!mergedUploads.includes(u))mergedUploads.push(u)}
     if(src.notes&&src.notes.trim())mergedNotes+=(mergedNotes?'\n':'')+src.notes;
     totalUploads+=src.times_uploaded||0;
     merged.push(sid);
   }
   mergedMods.sort((a,b)=>(a.date||0)-(b.date||0));
   if(mergedMods.length>50)mergedMods=mergedMods.slice(-50);
   await run(env,'UPDATE ecu_file_memory SET tags=?,last_modifications=?,upload_ids=?,notes=?,times_uploaded=?,last_seen_at=? WHERE id=?',JSON.stringify(mergedTags),JSON.stringify(mergedMods),JSON.stringify(mergedUploads),mergedNotes,totalUploads,Date.now(),targetId);
   // Kaynak kayıtları sil
   for(const sid of merged){await run(env,'DELETE FROM ecu_file_memory WHERE id=?',sid)}
   return j({ok:true,targetId,mergedSources:merged,resultTags:mergedTags,resultModCount:mergedMods.length,resultUploadCount:mergedUploads.length});
 }catch(e){return j({error:e.message||'MERGE_FAILED'},500)}}

 // === DOSYA HAFIZA EXPORT — tüm file memory verilerini dışa aktar ===
 if(p==='/api/ecu/file-memory/export'&&m==='GET'){try{
   const u=new URL(req.url);
   const format=u.searchParams.get('format')||'json';
   const all=await qall(env,'SELECT * FROM ecu_file_memory ORDER BY last_seen_at DESC');
   const entries=all.map(m=>({
     id:m.id,fileHash:m.file_hash,filename:m.filename,fileSize:m.file_size,ecuType:m.ecu_type,fuelType:m.fuel_type,
     vehicle:{make:m.vehicle_make,model:m.vehicle_model,year:m.vehicle_year},
     detectedSystems:JSON.parse(m.detected_systems||'[]'),ecuProfileData:JSON.parse(m.ecu_profile_data||'{}'),
     scanResultSummary:JSON.parse(m.scan_result_summary||'{}'),
     timesUploaded:m.times_uploaded,firstSeen:m.first_seen_at,lastSeen:m.last_seen_at,
     uploadIds:JSON.parse(m.upload_ids||'[]'),tags:JSON.parse(m.tags||'[]'),notes:m.notes||'',
     lastModifications:JSON.parse(m.last_modifications||'[]')
   }));
   if(format==='csv'){
     const header='id,fileHash,filename,fileSize,ecuType,fuelType,make,model,year,timesUploaded,tags,notes';
     const rows=entries.map(e=>[e.id,e.fileHash,e.filename,e.fileSize,e.ecuType,e.fuelType,e.vehicle.make,e.vehicle.model,e.vehicle.year,e.timesUploaded,'"'+e.tags.join(',')+'"','"'+(e.notes||'').replace(/"/g,'""')+'"'].join(','));
     return new Response(header+'\n'+rows.join('\n'),{headers:{'content-type':'text/csv','content-disposition':'attachment; filename="ecu-file-memory.csv"'}});
   }
   return j({ok:true,total:entries.length,exportedAt:Date.now(),entries});
 }catch(e){return j({error:e.message||'EXPORT_FAILED'},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === MAP ACTIONS — Rulepack familyMaps eylem motoru ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Desteklenen eylem tipleri ---
 if(p==='/api/ecu/map-actions/supported'&&m==='GET'){
   return j({ok:true,actions:supportedActions()});
 }

 // --- Önizleme teklifleri (uygulamadan önce review) ---
 if(p==='/api/ecu/map-actions/proposals'&&m==='POST'){try{
   const b=await body(req);
   if(!b.matches||!Array.isArray(b.matches))return j({error:'MISSING_MATCHES',hint:'matches array from rulepack match required'},400);
   const proposals=mapActionProposals(b.matches);
   return j({ok:true,count:proposals.length,proposals});
 }catch(e){return j({error:e.message||'PROPOSALS_FAILED'},500)}}

 // --- Teklif doğrulama ---
 if(p==='/api/ecu/map-actions/validate'&&m==='POST'){try{
   const b=await body(req);
   if(!b.proposals||!Array.isArray(b.proposals))return j({error:'MISSING_PROPOSALS'},400);
   const result=validateProposals(b.proposals);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message||'VALIDATE_FAILED'},500)}}

 // --- Harita eylemlerini uygula (tam pipeline) ---
 if(p==='/api/ecu/map-actions/apply'&&m==='POST'){try{
   await ensureMapActionTables(env);
   const b=await body(req);
   if(!b.matches||!Array.isArray(b.matches))return j({error:'MISSING_MATCHES'},400);
   if(!b.uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   // Harita verilerini mapDataLookup olarak hazırla
   const mapDataLookup={};
   if(b.mapData&&typeof b.mapData==='object'){
     Object.assign(mapDataLookup,b.mapData);
   }
   // Stored maps'ten de çek
   try{
     await ensureMapTables(env);
     const storedMaps=await qall(env,'SELECT * FROM ecu_stored_maps WHERE upload_id=?',b.uploadId);
     for(const sm of storedMaps){
       try{
         const parsed=JSON.parse(sm.map_data);
         if(parsed.name&&!mapDataLookup[parsed.name])mapDataLookup[parsed.name]=parsed;
       }catch(_){}
     }
   }catch(_){}
   const result=applyMapActions(b.matches,mapDataLookup);
   // Sonuçları D1'e logla
   const vehicleId=b.vehicleId||upload.vehicle_id||null;
   for(const pr of result.proposals){
     try{await logMapAction(env,b.uploadId,vehicleId,pr);}catch(_){}
   }
   return j({ok:true,...result});
 }catch(e){return j({error:e.message||'APPLY_FAILED'},500)}}

 // --- Ham binary üzerinde eylem uygula ---
 if(p==='/api/ecu/map-actions/apply-binary'&&m==='POST'){try{
   await ensureMapActionTables(env);
   const b=await body(req);
   if(!b.uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   if(b.address===undefined||b.address===null)return j({error:'MISSING_ADDRESS'},400);
   if(!b.length)return j({error:'MISSING_LENGTH'},400);
   if(!b.familyMapDef)return j({error:'MISSING_FAMILY_MAP_DEF'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',b.uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const obj=await fileGet(env,upload.binary_data);
   if(!obj)return j({error:'BINARY_NOT_FOUND'},404);
   const srcBuf=await obj.arrayBuffer();
   const buffer=srcBuf.slice(0);// clone
   const result=applyRawBinaryAction(buffer,b.address,b.length,b.familyMapDef);
   // Modified binary'yi kaydet
   const newKey='tuned_mapaction_'+b.uploadId+'_'+Date.now();
   await filePut(env,newKey,new Uint8Array(buffer));
   const vehicleId=b.vehicleId||upload.vehicle_id||null;
   try{await logMapAction(env,b.uploadId,vehicleId,{mapName:b.familyMapDef.name||'raw_binary',actionType:b.familyMapDef.mapAction||'unknown',address:b.address,length:b.length,...result});}catch(_){}
   return j({ok:true,newBinaryKey:newKey,originalSize:srcBuf.byteLength,...result});
 }catch(e){return j({error:e.message||'APPLY_BINARY_FAILED'},500)}}

 // --- Eylem geçmişi ---
 if(p==='/api/ecu/map-actions/history'&&m==='GET'){try{
   await ensureMapActionTables(env);
   const u2=new URL(req.url);
   const filters={};
   if(u2.searchParams.get('uploadId'))filters.uploadId=u2.searchParams.get('uploadId');
   if(u2.searchParams.get('vehicleId'))filters.vehicleId=u2.searchParams.get('vehicleId');
   if(u2.searchParams.get('family'))filters.family=u2.searchParams.get('family');
   if(u2.searchParams.get('actionType'))filters.actionType=u2.searchParams.get('actionType');
   if(u2.searchParams.get('limit'))filters.limit=parseInt(u2.searchParams.get('limit'))||50;
   const history=await getMapActionHistory(env,filters);
   return j({ok:true,count:history.length,history});
 }catch(e){return j({error:e.message||'HISTORY_FAILED'},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === DTC DATABASE — Arıza kodu arama, analiz, toplu sorgulama ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Tek DTC sorgu ---
 if(p==='/api/ecu/dtc/lookup'&&m==='GET'){
   const u=new URL(req.url);const code=u.searchParams.get('code');
   if(!code)return j({error:'MISSING_CODE',hint:'?code=P0420'},400);
   const result=lookupDTC(code);
   if(!result)return j({error:'DTC_NOT_FOUND',code},404);
   return j({ok:true,...result});
 }

 // --- DTC arama (keyword) ---
 if(p==='/api/ecu/dtc/search'&&m==='GET'){
   const u=new URL(req.url);const q=u.searchParams.get('q')||'';
   const system=u.searchParams.get('system')||undefined;
   const severity=u.searchParams.get('severity')||undefined;
   const limit=parseInt(u.searchParams.get('limit')||'50');
   const results=searchDTCs(q,{system,severity,limit});
   return j({ok:true,query:q,total:results.length,results});
 }

 // --- Toplu DTC sorgu ---
 if(p==='/api/ecu/dtc/batch'&&m==='POST'){try{
   const b=await body(req);const codes=b.codes||[];
   if(!Array.isArray(codes)||!codes.length)return j({error:'MISSING_CODES'},400);
   const results=batchLookupDTCs(codes);
   return j({ok:true,total:results.length,results});
 }catch(e){return j({error:e.message},500)}}

 // --- DTC pattern analiz ---
 if(p==='/api/ecu/dtc/analyze'&&m==='POST'){try{
   const b=await body(req);const codes=b.codes||[];
   if(!Array.isArray(codes)||!codes.length)return j({error:'MISSING_CODES'},400);
   const analysis=analyzeDTCPattern(codes);
   return j({ok:true,...analysis});
 }catch(e){return j({error:e.message},500)}}

 // --- Tuning-ilişkili DTC'ler ---
 if(p==='/api/ecu/dtc/tuning-related'&&m==='GET'){
   const u=new URL(req.url);const op=u.searchParams.get('operation')||'';
   if(!op)return j({error:'MISSING_OPERATION',hint:'?operation=dpf_delete'},400);
   const codes=getTuningRelatedDTCs(op);
   return j({ok:true,operation:op,total:codes.length,codes});
 }

 // --- DTC sistem kategorileri ---
 if(p==='/api/ecu/dtc/systems'&&m==='GET'){
   const systems=getDTCSystems();
   return j({ok:true,systems});
 }

 // ═══════════════════════════════════════════════════════════════════════════
 // === FLASH PROTOCOL — ECU flash protokol bilgileri ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Tek ECU tipi flash protokol ---
 if(p==='/api/ecu/flash-protocol'&&m==='GET'){
   const u=new URL(req.url);const ecuType=u.searchParams.get('ecu_type')||'';
   if(!ecuType)return j({error:'MISSING_ECU_TYPE',hint:'?ecu_type=MED17.5.2'},400);
   const proto=getFlashProtocol(ecuType);
   if(!proto)return j({error:'PROTOCOL_NOT_FOUND',ecuType},404);
   return j({ok:true,...proto});
 }

 // --- Tüm flash protokoller ---
 if(p==='/api/ecu/flash-protocols'&&m==='GET'){
   const protocols=listFlashProtocols();
   return j({ok:true,total:protocols.length,protocols});
 }

 // ═══════════════════════════════════════════════════════════════════════════
 // === SAFETY LIMITS — Tuning güvenlik sınırları ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Sistem/yakıt bazlı güvenlik limitleri ---
 if(p==='/api/ecu/safety-limits'&&m==='GET'){
   const u=new URL(req.url);
   const system=u.searchParams.get('system')||'';
   const fuelType=u.searchParams.get('fuel_type')||'diesel';
   if(!system)return j({error:'MISSING_SYSTEM',hint:'?system=boost&fuel_type=diesel'},400);
   const limits=getSafetyLimits(system,fuelType);
   if(!limits)return j({error:'LIMITS_NOT_FOUND',system,fuelType},404);
   return j({ok:true,system,fuelType,limits});
 }

 // --- Tüm güvenlik limitleri ---
 if(p==='/api/ecu/safety-limits/all'&&m==='GET'){
   const all=getAllSafetyLimits();
   return j({ok:true,...all});
 }

 // ═══════════════════════════════════════════════════════════════════════════
 // === CHECKSUM ALGORITHMS — Genişletilmiş checksum hesaplama ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Mevcut algoritmaları listele ---
 if(p==='/api/ecu/checksum/algorithms'&&m==='GET'){
   const algos=listChecksumAlgorithms();
   return j({ok:true,total:algos.length,algorithms:algos});
 }

 // --- Genel checksum hesaplama ---
 if(p==='/api/ecu/checksum/compute'&&m==='POST'){try{
   const b=await body(req);
   const uploadId=b.upload_id;const algo=b.algorithm;
   if(!uploadId||!algo)return j({error:'MISSING_PARAMS',hint:'upload_id + algorithm required'},400);
   const upload=await q1(env,'SELECT binary_data FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_NOT_FOUND'},404);
   const buf=await fileObj.arrayBuffer();
   const data=new Uint8Array(buf);
   const offset=parseInt(b.offset||'0');
   const length=parseInt(b.length||String(data.length));
   const result=computeChecksum(algo,data,offset,length);
   return j({ok:true,algorithm:algo,uploadId,offset,length,checksum:result,hex:'0x'+result.toString(16).toUpperCase().padStart(8,'0')});
 }catch(e){return j({error:e.message},500)}}

 // --- ECU tipine göre otomatik checksum algoritma tespiti ---
 if(p==='/api/ecu/checksum/detect'&&m==='GET'){
   const u=new URL(req.url);const ecuType=u.searchParams.get('ecu_type')||'';
   if(!ecuType)return j({error:'MISSING_ECU_TYPE'},400);
   const detected=detectChecksumAlgo(ecuType);
   return j({ok:true,ecuType,detected});
 }

 // ═══════════════════════════════════════════════════════════════════════════
 // === BINARY ANALYSIS — Gelişmiş binary analiz (entropy, strings, sections) ===
 // ═══════════════════════════════════════════════════════════════════════════

 if(p==='/api/ecu/binary-analysis'&&m==='POST'){try{
   const b=await body(req);const uploadId=b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT binary_data,filename FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_NOT_FOUND'},404);
   const buf=await fileObj.arrayBuffer();
   const data=new Uint8Array(buf);
   const report=analyzeBinary(data);
   return j({ok:true,uploadId,filename:upload.filename,...report});
 }catch(e){return j({error:e.message},500)}}

 // --- Entropy haritası ---
 if(p==='/api/ecu/entropy-map'&&m==='POST'){try{
   const b=await body(req);const uploadId=b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT binary_data FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_NOT_FOUND'},404);
   const buf=await fileObj.arrayBuffer();
   const data=new Uint8Array(buf);
   const windowSize=parseInt(b.window_size||'4096');
   const map=entropyMap(data,windowSize);
   return j({ok:true,uploadId,windowSize,totalPoints:map.length,map});
 }catch(e){return j({error:e.message},500)}}

 // --- String çıkarma ---
 if(p==='/api/ecu/strings'&&m==='POST'){try{
   const b=await body(req);const uploadId=b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT binary_data FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_NOT_FOUND'},404);
   const buf=await fileObj.arrayBuffer();
   const data=new Uint8Array(buf);
   const minLen=parseInt(b.min_length||'6');
   const strings=extractStrings(data,minLen);
   return j({ok:true,uploadId,minLength:minLen,total:strings.length,strings:strings.slice(0,500)});
 }catch(e){return j({error:e.message},500)}}

 // --- Section tespiti ---
 if(p==='/api/ecu/sections'&&m==='POST'){try{
   const b=await body(req);const uploadId=b.upload_id;
   if(!uploadId)return j({error:'MISSING_UPLOAD_ID'},400);
   const upload=await q1(env,'SELECT binary_data FROM ecu_uploads WHERE id=?',uploadId);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_NOT_FOUND'},404);
   const buf=await fileObj.arrayBuffer();
   const data=new Uint8Array(buf);
   const sections=detectSections(data);
   return j({ok:true,uploadId,totalSections:sections.length,sections});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === TUNING PROJECTS — Proje yönetimi, session tracking, notlar ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Proje listele ---
 if(p==='/api/ecu/projects'&&m==='GET'){try{
   const u=new URL(req.url);
   const status=u.searchParams.get('status')||undefined;
   const limit=parseInt(u.searchParams.get('limit')||'50');
   const offset=parseInt(u.searchParams.get('offset')||'0');
   const projects=await listProjects(env,{status,limit,offset});
   return j({ok:true,total:projects.length,projects});
 }catch(e){return j({error:e.message},500)}}

 // --- Proje oluştur ---
 if(p==='/api/ecu/projects'&&m==='POST'){try{
   const b=await body(req);
   if(!b.name)return j({error:'MISSING_NAME'},400);
   const project=await createProject(env,b);
   return j({ok:true,project});
 }catch(e){return j({error:e.message},500)}}

 // --- Tek proje getir ---
 if(p.startsWith('/api/ecu/projects/')&&!p.includes('/sessions')&&!p.includes('/notes')&&!p.includes('/stats')&&!p.includes('/uploads')&&!p.includes('/tuned')&&m==='GET'){try{
   const projectId=p.split('/api/ecu/projects/')[1];
   if(!projectId)return j({error:'MISSING_ID'},400);
   const project=await getProject(env,projectId);
   if(!project)return j({error:'PROJECT_NOT_FOUND'},404);
   return j({ok:true,project});
 }catch(e){return j({error:e.message},500)}}

 // --- Proje güncelle ---
 if(p.match(/^\/api\/ecu\/projects\/[^/]+$/)&&m==='PUT'){try{
   const projectId=p.split('/api/ecu/projects/')[1];
   const b=await body(req);
   const updated=await updateProject(env,projectId,b);
   if(!updated)return j({error:'PROJECT_NOT_FOUND'},404);
   return j({ok:true,project:updated});
 }catch(e){return j({error:e.message},500)}}

 // --- Proje sil ---
 if(p.match(/^\/api\/ecu\/projects\/[^/]+$/)&&m==='DELETE'){try{
   const projectId=p.split('/api/ecu/projects/')[1];
   await deleteProject(env,projectId);
   return j({ok:true,deleted:projectId});
 }catch(e){return j({error:e.message},500)}}

 // --- Proje istatistikleri ---
 if(p.match(/^\/api\/ecu\/projects\/[^/]+\/stats$/)&&m==='GET'){try{
   const projectId=p.split('/')[4];
   const stats=await projectStats(env,projectId);
   if(!stats)return j({error:'PROJECT_NOT_FOUND'},404);
   return j({ok:true,...stats});
 }catch(e){return j({error:e.message},500)}}

 // --- Projeye upload ekle ---
 if(p.match(/^\/api\/ecu\/projects\/[^/]+\/uploads$/)&&m==='POST'){try{
   const projectId=p.split('/')[4];
   const b=await body(req);
   if(!b.upload_id)return j({error:'MISSING_UPLOAD_ID'},400);
   const ok=await addUploadToProject(env,projectId,b.upload_id);
   if(!ok)return j({error:'PROJECT_NOT_FOUND'},404);
   return j({ok:true,projectId,uploadId:b.upload_id});
 }catch(e){return j({error:e.message},500)}}

 // --- Projeye tuned dosya ekle ---
 if(p.match(/^\/api\/ecu\/projects\/[^/]+\/tuned$/)&&m==='POST'){try{
   const projectId=p.split('/')[4];
   const b=await body(req);
   if(!b.tuned_id)return j({error:'MISSING_TUNED_ID'},400);
   const ok=await addTunedToProject(env,projectId,b.tuned_id);
   if(!ok)return j({error:'PROJECT_NOT_FOUND'},404);
   return j({ok:true,projectId,tunedId:b.tuned_id});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === TUNING SESSIONS — Oturum takibi ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Session listele ---
 if(p==='/api/ecu/sessions'&&m==='GET'){try{
   const u=new URL(req.url);
   const projectId=u.searchParams.get('project_id')||null;
   const status=u.searchParams.get('status')||undefined;
   const limit=parseInt(u.searchParams.get('limit')||'50');
   const sessions=await listSessions(env,projectId,{status,limit});
   return j({ok:true,total:sessions.length,sessions});
 }catch(e){return j({error:e.message},500)}}

 // --- Session başlat ---
 if(p==='/api/ecu/sessions'&&m==='POST'){try{
   const b=await body(req);
   const session=await startSession(env,b.project_id||null,b.session_type||'tuning');
   return j({ok:true,session});
 }catch(e){return j({error:e.message},500)}}

 // --- Tek session getir ---
 if(p.match(/^\/api\/ecu\/sessions\/[^/]+$/)&&m==='GET'){try{
   const sessionId=p.split('/api/ecu/sessions/')[1];
   const session=await getSession(env,sessionId);
   if(!session)return j({error:'SESSION_NOT_FOUND'},404);
   return j({ok:true,session});
 }catch(e){return j({error:e.message},500)}}

 // --- Session bitir ---
 if(p.match(/^\/api\/ecu\/sessions\/[^/]+\/end$/)&&m==='POST'){try{
   const sessionId=p.split('/')[4];
   const b=await body(req);
   const session=await endSession(env,sessionId,b);
   if(!session)return j({error:'SESSION_NOT_FOUND'},404);
   return j({ok:true,session});
 }catch(e){return j({error:e.message},500)}}

 // --- Session'a operasyon ekle ---
 if(p.match(/^\/api\/ecu\/sessions\/[^/]+\/operations$/)&&m==='POST'){try{
   const sessionId=p.split('/')[4];
   const b=await body(req);
   const ok=await addSessionOperation(env,sessionId,b);
   if(!ok)return j({error:'SESSION_NOT_FOUND'},404);
   return j({ok:true,sessionId});
 }catch(e){return j({error:e.message},500)}}

 // --- Session'a değişiklik ekle ---
 if(p.match(/^\/api\/ecu\/sessions\/[^/]+\/changes$/)&&m==='POST'){try{
   const sessionId=p.split('/')[4];
   const b=await body(req);
   const ok=await addSessionChanges(env,sessionId,b.changes||[]);
   if(!ok)return j({error:'SESSION_NOT_FOUND'},404);
   return j({ok:true,sessionId});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === TUNING NOTES — Proje ve session notları ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Notları listele ---
 if(p==='/api/ecu/notes'&&m==='GET'){try{
   const u=new URL(req.url);
   const filters={
     project_id:u.searchParams.get('project_id')||undefined,
     session_id:u.searchParams.get('session_id')||undefined,
     upload_id:u.searchParams.get('upload_id')||undefined,
     note_type:u.searchParams.get('note_type')||undefined,
     limit:parseInt(u.searchParams.get('limit')||'100')
   };
   const notes=await listNotes(env,filters);
   return j({ok:true,total:notes.length,notes});
 }catch(e){return j({error:e.message},500)}}

 // --- Not ekle ---
 if(p==='/api/ecu/notes'&&m==='POST'){try{
   const b=await body(req);
   if(!b.content)return j({error:'MISSING_CONTENT'},400);
   const note=await addNote(env,b);
   return j({ok:true,note});
 }catch(e){return j({error:e.message},500)}}

 // --- Not sil ---
 if(p.match(/^\/api\/ecu\/notes\/[^/]+$/)&&m==='DELETE'){try{
   const noteId=p.split('/api/ecu/notes/')[1];
   await deleteNote(env,noteId);
   return j({ok:true,deleted:noteId});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === TUNING MAPS — 2D/3D Kalibrasyon Harita Motoru ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- Map Templates ---
 if(p==='/api/ecu/maps/templates'&&m==='GET'){try{
   return j({ok:true,templates:listMapTemplates()});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/maps/templates/')&&m==='GET'){try{
   const tName=p.split('/api/ecu/maps/templates/')[1];
   const tpl=getMapTemplate(tName);
   if(!tpl)return j({error:'TEMPLATE_NOT_FOUND'},404);
   return j({ok:true,template:tpl});
 }catch(e){return j({error:e.message},500)}}

 // --- Map Operations (stateless compute) ---
 if(p==='/api/ecu/maps/interpolate'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   if(b.map.y_axis){
     const val=interpolate3D(b.map,b.x,b.y);
     return j({ok:true,value:val,type:'3d'});
   }else{
     const val=interpolate2D(b.map,b.x);
     return j({ok:true,value:val,type:'2d'});
   }
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/smooth'&&m==='POST'){try{
   const b=await body(req);
   if(!b.values&&!b.matrix)return j({error:'MISSING_DATA'},400);
   if(b.matrix){
     const result=smooth3D(b.matrix,b.passes||1,b.weight||0.5);
     return j({ok:true,result,type:'3d'});
   }else{
     const result=smooth2D(b.values,b.passes||1,b.weight||0.5);
     return j({ok:true,result,type:'2d'});
   }
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/scale'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=scaleMap(b.map,b.percentage||100);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/offset'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=offsetMap(b.map,b.offset||0);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/clamp'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=clampMap(b.map,b.min??-Infinity,b.max??Infinity);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/fill-region'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=fillRegion(b.map,b.value??0,b.region);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/scale-region'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=scaleRegion(b.map,b.percentage||100,b.region);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/diff'&&m==='POST'){try{
   const b=await body(req);
   if(!b.original||!b.modified)return j({error:'MISSING_MAPS'},400);
   const result=diffMaps(b.original,b.modified);
   return j({ok:true,diff:result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/stats'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   const result=mapStats(b.map);
   return j({ok:true,stats:result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/rescale-axis'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   let result=b.map;
   if(b.newXValues)result=rescaleXAxis(result,b.newXValues);
   if(b.newYValues)result=rescaleYAxis(result,b.newYValues);
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/copy-paste'&&m==='POST'){try{
   const b=await body(req);
   if(!b.map)return j({error:'MISSING_MAP'},400);
   if(b.action==='copy'){
     const clipboard=copyRegion(b.map,b.region);
     return j({ok:true,clipboard});
   }else if(b.action==='paste'){
     if(!b.clipboard)return j({error:'MISSING_CLIPBOARD'},400);
     const result=pasteRegion(b.map,b.clipboard,b.xStart||0,b.yStart||0);
     return j({ok:true,result});
   }
   return j({error:'INVALID_ACTION — use copy or paste'},400);
 }catch(e){return j({error:e.message},500)}}

 // --- Stored Maps (D1 CRUD) ---
 if(p==='/api/ecu/maps/stored'&&m==='GET'){try{
   await ensureMapTables(env);
   const sp=new URL(req.url).searchParams;
   const maps=await listStoredMaps(env,{upload_id:sp.get('upload_id'),project_id:sp.get('project_id'),category:sp.get('category'),limit:parseInt(sp.get('limit'))||50});
   return j({ok:true,maps});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/maps/stored'&&m==='POST'){try{
   const b=await body(req);
   if(!b.name)return j({error:'MISSING_NAME'},400);
   const map=await storeMap(env,b);
   return j({ok:true,map});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/maps/stored/')&&m==='GET'){try{
   const mapId=p.split('/api/ecu/maps/stored/')[1];
   const map=await getStoredMap(env,mapId);
   if(!map)return j({error:'MAP_NOT_FOUND'},404);
   return j({ok:true,map});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/maps/stored/')&&m==='PUT'){try{
   const mapId=p.split('/api/ecu/maps/stored/')[1];
   const b=await body(req);
   const map=await updateStoredMap(env,mapId,b);
   if(!map)return j({error:'MAP_NOT_FOUND'},404);
   return j({ok:true,map});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/maps/stored/')&&m==='DELETE'){try{
   const mapId=p.split('/api/ecu/maps/stored/')[1];
   await deleteStoredMap(env,mapId);
   return j({ok:true,deleted:mapId});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ECU LIVE DATA — PID, Gauge, Logging, Alarms ===
 // ═══════════════════════════════════════════════════════════════════════════

 // --- PID Lookup ---
 if(p==='/api/ecu/live/pids'&&m==='GET'){try{
   const sp=new URL(req.url).searchParams;
   const q=sp.get('q')||sp.get('search');
   const cat=sp.get('category');
   if(q){return j({ok:true,pids:searchPIDs(q)})}
   if(cat){return j({ok:true,pids:getPIDsByCategory(cat)})}
   return j({ok:true,pids:Object.entries(STANDARD_PIDS).map(([code,pid])=>({code,...pid})),total:Object.keys(STANDARD_PIDS).length});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/live/pids/categories'&&m==='GET'){try{
   return j({ok:true,categories:listPIDCategories()});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/live/pids/')&&m==='GET'){try{
   const code=p.split('/api/ecu/live/pids/')[1].toUpperCase();
   const pid=getPID(code);
   if(!pid)return j({error:'PID_NOT_FOUND'},404);
   const gauge=getGaugeConfig(pid.shortName);
   const alarm=getAlarmConfig(code);
   return j({ok:true,code,pid,gauge,alarm});
 }catch(e){return j({error:e.message},500)}}

 // --- Unit Conversion ---
 if(p==='/api/ecu/live/convert'&&m==='POST'){try{
   const b=await body(req);
   if(b.value===undefined||!b.from||!b.to)return j({error:'MISSING value/from/to'},400);
   const result=convertUnit(b.value,b.from,b.to);
   if(result===null)return j({error:'UNSUPPORTED_CONVERSION'},400);
   return j({ok:true,original:b.value,from:b.from,to:b.to,result});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/live/conversions'&&m==='GET'){try{
   const unit=new URL(req.url).searchParams.get('unit');
   if(!unit)return j({error:'MISSING_UNIT'},400);
   return j({ok:true,unit,convertibleTo:listConversions(unit)});
 }catch(e){return j({error:e.message},500)}}

 // --- Gauge Configs ---
 if(p==='/api/ecu/live/gauges'&&m==='GET'){try{
   return j({ok:true,gauges:Object.entries(GAUGE_CONFIGS).map(([key,cfg])=>({key,...cfg}))});
 }catch(e){return j({error:e.message},500)}}

 // --- Dashboard Presets ---
 if(p==='/api/ecu/live/dashboards'&&m==='GET'){try{
   return j({ok:true,presets:listDashboardPresets()});
 }catch(e){return j({error:e.message},500)}}

 if(p.startsWith('/api/ecu/live/dashboards/')&&m==='GET'){try{
   const presetName=p.split('/api/ecu/live/dashboards/')[1];
   const preset=getDashboardPreset(presetName);
   if(!preset)return j({error:'PRESET_NOT_FOUND'},404);
   // enrich with PID details
   const pidDetails=preset.pids.map(code=>({code,...(getPID(code)||{}),gauge:getGaugeConfig(getPID(code)?.shortName),alarm:getAlarmConfig(code)}));
   return j({ok:true,preset:{...preset,pidDetails}});
 }catch(e){return j({error:e.message},500)}}

 // --- Alarms ---
 if(p==='/api/ecu/live/alarms'&&m==='GET'){try{
   return j({ok:true,alarms:listAlarms()});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/live/alarms/check'&&m==='POST'){try{
   const b=await body(req);
   if(!b.readings||!Array.isArray(b.readings))return j({error:'MISSING_READINGS'},400);
   const results=b.readings.map(r=>({code:r.code,value:r.value,...checkAlarms(r.code,r.value)}));
   const warnings=results.filter(r=>r.status==='warning');
   const criticals=results.filter(r=>r.status==='critical');
   return j({ok:true,results,summary:{total:results.length,ok:results.filter(r=>r.status==='ok').length,warnings:warnings.length,critical:criticals.length}});
 }catch(e){return j({error:e.message},500)}}

 // --- Data Logging ---
 if(p==='/api/ecu/live/logs'&&m==='GET'){try{
   const sp=new URL(req.url).searchParams;
   const logs=await listLogs(env,{session_id:sp.get('session_id'),upload_id:sp.get('upload_id'),status:sp.get('status'),limit:parseInt(sp.get('limit'))||50});
   return j({ok:true,logs});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/live/logs'&&m==='POST'){try{
   const b=await body(req);
   const log=await startLog(env,b);
   return j({ok:true,log});
 }catch(e){return j({error:e.message},500)}}

 if(p.match(/^\/api\/ecu\/live\/logs\/[^/]+$/)&&m==='GET'){try{
   const logId=p.split('/api/ecu/live/logs/')[1];
   const logEntry=await getLog(env,logId);
   if(!logEntry)return j({error:'LOG_NOT_FOUND'},404);
   return j({ok:true,log:logEntry});
 }catch(e){return j({error:e.message},500)}}

 if(p.match(/^\/api\/ecu\/live\/logs\/[^/]+\/append$/)&&m==='POST'){try{
   const logId=p.split('/api/ecu/live/logs/')[1].replace('/append','');
   const b=await body(req);
   const ok=await appendLogData(env,logId,b.data_points||b.dataPoints||[]);
   if(!ok)return j({error:'LOG_NOT_FOUND'},404);
   return j({ok:true,appended:true});
 }catch(e){return j({error:e.message},500)}}

 if(p.match(/^\/api\/ecu\/live\/logs\/[^/]+\/end$/)&&m==='POST'){try{
   const logId=p.split('/api/ecu/live/logs/')[1].replace('/end','');
   const result=await endLog(env,logId);
   if(!result)return j({error:'LOG_NOT_FOUND'},404);
   return j({ok:true,log:result});
 }catch(e){return j({error:e.message},500)}}

 if(p.match(/^\/api\/ecu\/live\/logs\/[^/]+$/)&&m==='DELETE'){try{
   const logId=p.split('/api/ecu/live/logs/')[1];
   await deleteLog(env,logId);
   return j({ok:true,deleted:logId});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ECU READINESS & EMISSIONS — Monitor durumu, emisyon, drive cycle ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List all OBD monitor definitions
 if(p==='/api/ecu/readiness/monitors'&&m==='GET'){
   return j({ok:true,monitors:OBD_MONITORS})}

 // Parse Mode 01 PID 01 bytes → monitor status
 if(p==='/api/ecu/readiness/parse'&&m==='POST'){try{
   const d=await body(req);
   if(!d.bytes||!Array.isArray(d.bytes))return j({error:'bytes array required (4 bytes from PID 01)'},400);
   const parsed=parseMonitorStatus(d.bytes);
   return j({ok:true,status:parsed});
 }catch(e){return j({error:e.message},500)}}

 // Readiness summary (parse + summary in one call)
 if(p==='/api/ecu/readiness/summary'&&m==='POST'){try{
   const d=await body(req);
   if(!d.bytes||!Array.isArray(d.bytes))return j({error:'bytes array required (4 bytes from PID 01)'},400);
   const parsed=parseMonitorStatus(d.bytes);
   const summary=readinessSummary(parsed);
   return j({ok:true,parsed,summary});
 }catch(e){return j({error:e.message},500)}}

 // Parse freeze frame data
 if(p==='/api/ecu/readiness/freeze-frame'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data||typeof d.data!=='object')return j({error:'data object required: {pidHex: [byte, byte, ...]}'},400);
   const ff=parseFreezeFrame(d.data);
   return j({ok:true,freezeFrame:ff,supportedPids:FREEZE_FRAME_PIDS});
 }catch(e){return j({error:e.message},500)}}

 // List all drive cycles
 if(p==='/api/ecu/readiness/drive-cycles'&&m==='GET'){
   return j({ok:true,driveCycles:listDriveCycles()})}

 // Get drive cycle for specific make
 if(p.startsWith('/api/ecu/readiness/drive-cycles/')&&m==='GET'){
   const make=decodeURIComponent(p.split('/api/ecu/readiness/drive-cycles/')[1]);
   const dc=getDriveCycle(make);
   if(!dc)return j({error:'DRIVE_CYCLE_NOT_FOUND',available:listDriveCycles().map(d=>d.id)},404);
   return j({ok:true,driveCycle:dc})}

 // List emissions standards
 if(p==='/api/ecu/readiness/emissions/standards'&&m==='GET'){
   return j({ok:true,standards:listEmissionsStandards()})}

 // Check readings against emissions standard
 if(p==='/api/ecu/readiness/emissions/check'&&m==='POST'){try{
   const d=await body(req);
   if(!d.readings||!d.standard)return j({error:'readings object and standard required'},400);
   const result=checkEmissions(d.readings,d.standard,d.fuelType||'gasoline');
   return j({ok:true,result});
 }catch(e){return j({error:e.message},500)}}

 // Full pre-check advisor
 if(p==='/api/ecu/readiness/advisor'&&m==='POST'){try{
   const d=await body(req);
   if(!d.monitorStatus)return j({error:'monitorStatus required (parsed monitor status object)'},400);
   const advice=emissionsAdvisor(d.monitorStatus,d.dtcList||[]);
   return j({ok:true,advice});
 }catch(e){return j({error:e.message},500)}}

 // Save readiness snapshot to D1
 if(p==='/api/ecu/readiness/save'&&m==='POST'){try{
   const d=await body(req);
   await ensureReadinessTables(env);
   const saved=await saveReadiness(env,d);
   return j({ok:true,saved});
 }catch(e){return j({error:e.message},500)}}

 // Get readiness history
 if(p==='/api/ecu/readiness/history'&&m==='GET'){try{
   await ensureReadinessTables(env);
   const vehicleId=u.searchParams.get('vehicle_id');
   const uploadId=u.searchParams.get('upload_id');
   const limit=parseInt(u.searchParams.get('limit')||'50');
   const rows=await getReadinessHistory(env,{vehicle_id:vehicleId,upload_id:uploadId,limit});
   return j({ok:true,history:rows});
 }catch(e){return j({error:e.message},500)}}

 // List all OBD modes
 if(p==='/api/ecu/obd/modes'&&m==='GET'){
   return j({ok:true,modes:listOBDModes()})}

 // Get single OBD mode
 if(p.startsWith('/api/ecu/obd/modes/')&&m==='GET'){
   const code=p.split('/api/ecu/obd/modes/')[1];
   const mode=getOBDMode(code);
   if(!mode)return j({error:'OBD_MODE_NOT_FOUND'},404);
   return j({ok:true,mode})}

 // === ECU WIRING & PINOUT DATABASE — Konnektör pinout, OBD-II, doğrulama ===

 // List all ECU families
 if(p==='/api/ecu/wiring/families'&&m==='GET'){
   return j({ok:true,families:listEcuPinouts()})}

 // Search ECU pinouts by vehicle/variant/family
 if(p==='/api/ecu/wiring/search'&&m==='GET'){
   const query=u.searchParams.get('q');
   if(!query)return j({error:'q parameter required'},400);
   return j({ok:true,results:searchEcuPinouts(query)})}

 // Get full ECU pinout by ID
 if(p.startsWith('/api/ecu/wiring/pinout/')&&m==='GET'){
   const ecuId=p.split('/api/ecu/wiring/pinout/')[1];
   const pinout=getEcuPinout(ecuId);
   if(!pinout)return j({error:'ECU_NOT_FOUND',available:listEcuPinouts().map(f=>f.id)},404);
   return j({ok:true,pinout})}

 // Get pins by type for an ECU
 if(p.startsWith('/api/ecu/wiring/pins-by-type/')&&m==='GET'){
   const parts=p.split('/api/ecu/wiring/pins-by-type/')[1].split('/');
   const ecuId=parts[0],pinType=parts[1];
   if(!pinType)return j({error:'Usage: /api/ecu/wiring/pins-by-type/{ecuId}/{pinType}'},400);
   const pins=getPinsByType(ecuId,pinType);
   return j({ok:true,ecuId,pinType,pins})}

 // Get all pin types for an ECU
 if(p.startsWith('/api/ecu/wiring/pin-types/')&&m==='GET'){
   const ecuId=p.split('/api/ecu/wiring/pin-types/')[1];
   const types=getEcuPinTypes(ecuId);
   if(!types.length)return j({error:'ECU_NOT_FOUND'},404);
   return j({ok:true,ecuId,pinTypes:types})}

 // Get flash interface info
 if(p.startsWith('/api/ecu/wiring/flash-pins/')&&m==='GET'){
   const ecuId=p.split('/api/ecu/wiring/flash-pins/')[1];
   const info=getFlashPins(ecuId);
   if(!info)return j({error:'ECU_NOT_FOUND'},404);
   return j({ok:true,...info})}

 // Verify wiring connections
 if(p==='/api/ecu/wiring/verify'&&m==='POST'){try{
   const d=await body(req);
   if(!d.ecuId||!d.connections)return j({error:'ecuId and connections[] required'},400);
   const result=verifyWiring(d.ecuId,d.connections);
   if(result.error)return j({error:result.error},404);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // OBD-II connector reference
 if(p==='/api/ecu/wiring/obd2'&&m==='GET'){
   return j({ok:true,connector:OBD2_CONNECTOR})}

 // OBD-II single pin
 if(p.startsWith('/api/ecu/wiring/obd2/pin/')&&m==='GET'){
   const num=parseInt(p.split('/api/ecu/wiring/obd2/pin/')[1]);
   const pin=getOBD2Pin(num);
   if(!pin)return j({error:'PIN_NOT_FOUND',validPins:'1-16'},404);
   return j({ok:true,pin:num,...pin})}

 // OBD-II protocol pinout
 if(p.startsWith('/api/ecu/wiring/obd2/protocol/')&&m==='GET'){
   const proto=p.split('/api/ecu/wiring/obd2/protocol/')[1];
   const info=getOBD2Protocol(proto);
   if(!info)return j({error:'PROTOCOL_NOT_FOUND',available:Object.keys(OBD2_CONNECTOR.protocols)},404);
   return j({ok:true,protocol:proto,...info})}

 // Pin type color/icon reference
 if(p==='/api/ecu/wiring/pin-colors'&&m==='GET'){
   return j({ok:true,pinTypeColors:PIN_TYPE_COLORS})}

 // === TUNING FILE FORMAT CONVERTER — Intel HEX ↔ S-Record ↔ BIN ===

 // List supported formats
 if(p==='/api/ecu/converter/formats'&&m==='GET'){
   return j({ok:true,formats:listFormats()})}

 // Detect file format
 if(p==='/api/ecu/converter/detect'&&m==='POST'){try{
   const d=await body(req);
   if(!d.content)return j({error:'content (string or base64) required'},400);
   let input=d.content;
   if(d.encoding==='base64'){
     const bin=Uint8Array.from(atob(d.content),c=>c.charCodeAt(0));
     input=bin;
   }
   const result=detectFormat(input);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Validate hex/srec file
 if(p==='/api/ecu/converter/validate'&&m==='POST'){try{
   const d=await body(req);
   if(!d.content)return j({error:'content (hex file text) required'},400);
   const result=validateHexFile(d.content);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Convert file format
 if(p==='/api/ecu/converter/convert'&&m==='POST'){try{
   const d=await body(req);
   if(!d.from||!d.to)return j({error:'from and to format required (ihex/srec/bin)'},400);
   if(!d.content)return j({error:'content required'},400);
   let input=d.content;
   if(d.encoding==='base64'){
     input=Uint8Array.from(atob(d.content),c=>c.charCodeAt(0));
   }
   const opts={startAddress:d.startAddress||0,bytesPerLine:d.bytesPerLine||16,header:d.header||'ECU_DATA'};
   const result=convertFile(input,d.from,d.to,opts);
   if(result.output instanceof Uint8Array){
     result.output=btoa(String.fromCharCode(...result.output));
     result.outputEncoding='base64';
   }
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Parse Intel HEX file
 if(p==='/api/ecu/converter/parse-ihex'&&m==='POST'){try{
   const d=await body(req);
   if(!d.content)return j({error:'content (Intel HEX text) required'},400);
   const parsed=parseIntelHex(d.content);
   const resp={ok:true,startAddress:'0x'+parsed.startAddress.toString(16).toUpperCase(),endAddress:'0x'+parsed.endAddress.toString(16).toUpperCase(),dataSize:parsed.data.length,records:parsed.records,entryPoint:parsed.entryPoint,errors:parsed.errors};
   if(d.includeData){resp.data=btoa(String.fromCharCode(...parsed.data));resp.dataEncoding='base64'}
   return j(resp);
 }catch(e){return j({error:e.message},500)}}

 // Parse S-Record file
 if(p==='/api/ecu/converter/parse-srec'&&m==='POST'){try{
   const d=await body(req);
   if(!d.content)return j({error:'content (S-Record text) required'},400);
   const parsed=parseSRecord(d.content);
   const resp={ok:true,startAddress:'0x'+parsed.startAddress.toString(16).toUpperCase(),endAddress:'0x'+parsed.endAddress.toString(16).toUpperCase(),dataSize:parsed.data.length,records:parsed.records,entryPoint:parsed.entryPoint,header:parsed.header,errors:parsed.errors};
   if(d.includeData){resp.data=btoa(String.fromCharCode(...parsed.data));resp.dataEncoding='base64'}
   return j(resp);
 }catch(e){return j({error:e.message},500)}}

 // Generate Intel HEX from binary
 if(p==='/api/ecu/converter/generate-ihex'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data)return j({error:'data (base64 binary) required'},400);
   const bin=Uint8Array.from(atob(d.data),c=>c.charCodeAt(0));
   const hex=generateIntelHex(bin,d.startAddress||0,d.bytesPerLine||16);
   return j({ok:true,output:hex,records:hex.split('\n').filter(l=>l.startsWith(':')).length,size:hex.length});
 }catch(e){return j({error:e.message},500)}}

 // Generate S-Record from binary
 if(p==='/api/ecu/converter/generate-srec'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data)return j({error:'data (base64 binary) required'},400);
   const bin=Uint8Array.from(atob(d.data),c=>c.charCodeAt(0));
   const srec=generateSRecord(bin,d.startAddress||0,d.bytesPerLine||16,d.header||'ECU_DATA');
   return j({ok:true,output:srec,records:srec.split('\n').filter(l=>/^S[123]/i.test(l)).length,size:srec.length});
 }catch(e){return j({error:e.message},500)}}

 // Compare two files
 if(p==='/api/ecu/converter/compare'&&m==='POST'){try{
   const d=await body(req);
   if(!d.file1||!d.file2)return j({error:'file1 and file2 required with {content, format, encoding?}'},400);
   let input1=d.file1.content,input2=d.file2.content;
   if(d.file1.encoding==='base64') input1=Uint8Array.from(atob(d.file1.content),c=>c.charCodeAt(0));
   if(d.file2.encoding==='base64') input2=Uint8Array.from(atob(d.file2.content),c=>c.charCodeAt(0));
   const result=compareFiles(input1,d.file1.format||'bin',input2,d.file2.format||'bin');
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Convert uploaded ECU file (from ecu_uploads)
 if(p==='/api/ecu/converter/convert-upload'&&m==='POST'){try{
   const d=await body(req);
   if(!d.uploadId||!d.toFormat)return j({error:'uploadId and toFormat required'},400);
   const upload=await q1(env,'SELECT * FROM ecu_uploads WHERE id=?',[d.uploadId]);
   if(!upload)return j({error:'UPLOAD_NOT_FOUND'},404);
   const fileObj=await fileGet(env,upload.binary_data);
   if(!fileObj)return j({error:'FILE_DATA_NOT_FOUND'},404);
   const ab=await fileObj.arrayBuffer();
   const bin=new Uint8Array(ab);
   const detected=detectFormat(bin);
   const fromFmt=d.fromFormat||detected.format||'bin';
   const opts={startAddress:d.startAddress||0,bytesPerLine:d.bytesPerLine||16,header:d.header||upload.filename||'ECU_DATA'};
   const result=convertFile(bin,fromFmt,d.toFormat,opts);
   if(result.output instanceof Uint8Array){
     result.output=btoa(String.fromCharCode(...result.output));
     result.outputEncoding='base64';
   }
   return j({ok:true,uploadId:d.uploadId,filename:upload.filename,...result});
 }catch(e){return j({error:e.message},500)}}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ECU PROTOCOL ANALYZER — CAN / UDS / KWP2000 / ISO-TP ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Parse a single CAN frame
 if(p==='/api/ecu/protocol/can-frame'&&m==='POST'){try{
   const d=await body(req);
   if(!d.frame)return j({error:'frame hex string required (e.g. "7E8 06 41 0C 1A F8 00 00")'},400);
   const result=parseCANFrame(d.frame);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Parse CAN bus log (multiple frames)
 if(p==='/api/ecu/protocol/can-log'&&m==='POST'){try{
   const d=await body(req);
   if(!d.log)return j({error:'log (CAN log text) required'},400);
   const opts={};
   if(d.filterArbitrationId)opts.filterArbitrationId=parseInt(d.filterArbitrationId,16);
   if(d.filterOBD)opts.filterOBD=true;
   const result=parseCANLog(d.log,opts);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Decode UDS message
 if(p==='/api/ecu/protocol/uds-decode'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data)return j({error:'data (byte array or hex string) required'},400);
   let bytes=d.data;
   if(typeof bytes==='string')bytes=bytes.trim().split(/\s+/).map(b=>parseInt(b,16));
   const result=decodeUDS(bytes);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Decode KWP2000 message
 if(p==='/api/ecu/protocol/kwp2000-decode'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data)return j({error:'data (byte array or hex string) required'},400);
   let bytes=d.data;
   if(typeof bytes==='string')bytes=bytes.trim().split(/\s+/).map(b=>parseInt(b,16));
   const result=decodeKWP2000(bytes);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Parse ISO-TP frame
 if(p==='/api/ecu/protocol/isotp-frame'&&m==='POST'){try{
   const d=await body(req);
   if(!d.data)return j({error:'data (byte array or hex string) required'},400);
   let bytes=d.data;
   if(typeof bytes==='string')bytes=bytes.trim().split(/\s+/).map(b=>parseInt(b,16));
   const result=parseISOTP(bytes);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Reassemble ISO-TP multi-frame message
 if(p==='/api/ecu/protocol/isotp-reassemble'&&m==='POST'){try{
   const d=await body(req);
   if(!d.frames||!Array.isArray(d.frames))return j({error:'frames (array of byte arrays or hex strings) required'},400);
   const parsed=d.frames.map(f=>{
     if(typeof f==='string')return f.trim().split(/\s+/).map(b=>parseInt(b,16));
     return f;
   });
   const result=reassembleISOTP(parsed);
   if(result.complete&&result.data.length>0){
     result.udsDecoded=decodeUDS(result.data);
   }
   return j({ok:true,...result,dataHex:result.data.map(b=>b.toString(16).toUpperCase().padStart(2,'0')).join(' ')});
 }catch(e){return j({error:e.message},500)}}

 // List all UDS services
 if(p==='/api/ecu/protocol/uds-services'&&m==='GET'){
   return j({ok:true,services:listUDSServices()})}

 // Get specific UDS service info
 if(p.startsWith('/api/ecu/protocol/uds-services/')&&m==='GET'){
   const sid=p.split('/').pop();
   const svc=getUDSService(sid);
   if(!svc)return j({error:'SERVICE_NOT_FOUND'},404);
   return j({ok:true,sid,service:svc})}

 // List UDS NRC (Negative Response Codes)
 if(p==='/api/ecu/protocol/uds-nrc'&&m==='GET'){
   const nrcs=Object.entries(UDS_NRC).map(([code,name])=>({code:'0x'+parseInt(code).toString(16).toUpperCase(),name}));
   return j({ok:true,nrcs})}

 // List common DIDs
 if(p==='/api/ecu/protocol/dids'&&m==='GET'){
   return j({ok:true,dids:listDIDs()})}

 // Get specific DID info
 if(p.startsWith('/api/ecu/protocol/dids/')&&m==='GET'){
   const didVal=p.split('/').pop();
   const name=getDID(didVal);
   if(!name)return j({error:'DID_NOT_FOUND'},404);
   return j({ok:true,did:didVal,name})}

 // List KWP2000 services
 if(p==='/api/ecu/protocol/kwp2000-services'&&m==='GET'){
   return j({ok:true,services:listKWP2000Services()})}

 // List flash sequences (UDS/KWP2000 programming procedures)
 if(p==='/api/ecu/protocol/flash-sequences'&&m==='GET'){
   return j({ok:true,sequences:listUDSFlashSequences()})}

 // Get specific flash sequence
 if(p.startsWith('/api/ecu/protocol/flash-sequences/')&&m==='GET'){
   const seqName=p.split('/').pop();
   const seq=getUDSFlashSequence(seqName);
   if(!seq)return j({error:'SEQUENCE_NOT_FOUND'},404);
   return j({ok:true,id:seqName,...seq})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === VIN DECODER — ISO 3779/3780 VIN çözücü ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Decode a VIN
 if(p==='/api/ecu/vin/decode'&&m==='POST'){try{
   const b=await body(req);
   const vin=String(b.vin||'').trim().toUpperCase();
   if(!vin)return j({error:'EMPTY_VIN'},400);
   const result=decodeVIN(vin);
   if(result.error)return j(result,400);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Decode VIN via GET
 if(p.startsWith('/api/ecu/vin/decode/')&&m==='GET'){try{
   const vin=p.split('/').pop().toUpperCase();
   const result=decodeVIN(vin);
   if(result.error)return j(result,400);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Validate VIN check digit
 if(p==='/api/ecu/vin/validate'&&m==='POST'){try{
   const b=await body(req);
   const vin=String(b.vin||'').trim().toUpperCase();
   if(!vin)return j({error:'EMPTY_VIN'},400);
   return j({ok:true,...validateCheckDigit(vin)});
 }catch(e){return j({error:e.message},500)}}

 // Search manufacturers by name
 if(p==='/api/ecu/vin/manufacturers/search'&&m==='GET'){try{
   const query=new URL(req.url).searchParams.get('q')||'';
   if(!query)return j({error:'EMPTY_QUERY'},400);
   return j({ok:true,results:searchManufacturer(query)});
 }catch(e){return j({error:e.message},500)}}

 // Get manufacturers by country
 if(p==='/api/ecu/vin/manufacturers/country'&&m==='GET'){try{
   const country=new URL(req.url).searchParams.get('country')||'';
   if(!country)return j({error:'EMPTY_COUNTRY'},400);
   return j({ok:true,results:getManufacturersByCountry(country)});
 }catch(e){return j({error:e.message},500)}}

 // Batch decode VINs
 if(p==='/api/ecu/vin/batch'&&m==='POST'){try{
   const b=await body(req);
   const vins=b.vins;
   if(!Array.isArray(vins)||!vins.length)return j({error:'EMPTY_VINS_ARRAY'},400);
   return j({ok:true,...batchDecodeVIN(vins)});
 }catch(e){return j({error:e.message},500)}}

 // VIN decoder stats
 if(p==='/api/ecu/vin/stats'&&m==='GET'){
   return j({ok:true,...vinDecoderStats()})}

 // List all WMI codes
 if(p==='/api/ecu/vin/wmi'&&m==='GET'){
   const entries=Object.entries(WMI_DATABASE).map(([code,mfr])=>({wmi:code,manufacturer:mfr}));
   return j({ok:true,count:entries.length,wmiCodes:entries})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === FUEL INJECTION & BOOST CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Calculate injector duty cycle
 if(p==='/api/ecu/fuel/duty-cycle'&&m==='POST'){try{
   const b=await body(req);
   if(!b.flowCc||!b.numInjectors||!b.targetHp)return j({error:'MISSING_PARAMS: flowCc, numInjectors, targetHp required'},400);
   return j({ok:true,...calcDutyCycle(b.flowCc,b.numInjectors,b.targetHp,b.bsfc||0.50,b.rpm||6500,b.fuelType||'gasoline')});
 }catch(e){return j({error:e.message},500)}}

 // Size injectors for target power
 if(p==='/api/ecu/fuel/size-injectors'&&m==='POST'){try{
   const b=await body(req);
   if(!b.targetHp||!b.numInjectors)return j({error:'MISSING_PARAMS: targetHp, numInjectors required'},400);
   return j({ok:true,...sizeInjectors(b.targetHp,b.numInjectors,b.fuelType||'gasoline',b.bsfc||0.50,b.maxDuty||80,b.fuelPressureBar||3)});
 }catch(e){return j({error:e.message},500)}}

 // Correct injector flow for pressure
 if(p==='/api/ecu/fuel/flow-correction'&&m==='POST'){try{
   const b=await body(req);
   if(!b.baseCc||!b.basePressureBar||!b.newPressureBar)return j({error:'MISSING_PARAMS: baseCc, basePressureBar, newPressureBar required'},400);
   return j({ok:true,...correctFlowForPressure(b.baseCc,b.basePressureBar,b.newPressureBar)});
 }catch(e){return j({error:e.message},500)}}

 // Calculate AFR targets
 if(p==='/api/ecu/fuel/afr'&&m==='GET'){try{
   const u=new URL(req.url);
   const fuelType=u.searchParams.get('fuel')||'gasoline';
   const mode=u.searchParams.get('mode')||'all';
   return j({ok:true,...calcAFR(fuelType,mode)});
 }catch(e){return j({error:e.message},500)}}

 // Lambda ↔ AFR conversion
 if(p==='/api/ecu/fuel/lambda-to-afr'&&m==='GET'){try{
   const u=new URL(req.url);
   const lambda=parseFloat(u.searchParams.get('lambda'));
   const fuelType=u.searchParams.get('fuel')||'gasoline';
   if(isNaN(lambda))return j({error:'MISSING_LAMBDA'},400);
   return j({ok:true,...lambdaToAFR(lambda,fuelType)});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/ecu/fuel/afr-to-lambda'&&m==='GET'){try{
   const u=new URL(req.url);
   const afr=parseFloat(u.searchParams.get('afr'));
   const fuelType=u.searchParams.get('fuel')||'gasoline';
   if(isNaN(afr))return j({error:'MISSING_AFR'},400);
   return j({ok:true,...afrToLambda(afr,fuelType)});
 }catch(e){return j({error:e.message},500)}}

 // Boost power calculator
 if(p==='/api/ecu/fuel/boost'&&m==='POST'){try{
   const b=await body(req);
   if(!b.naHp||!b.boostPsi)return j({error:'MISSING_PARAMS: naHp, boostPsi required'},400);
   return j({ok:true,...calcBoost(b.naHp,b.boostPsi,b.intercoolerEfficiency||0.70,b.altitudeFt||0)});
 }catch(e){return j({error:e.message},500)}}

 // Wastegate duty cycle
 if(p==='/api/ecu/fuel/wastegate'&&m==='POST'){try{
   const b=await body(req);
   if(!b.targetBoostPsi)return j({error:'MISSING_PARAMS: targetBoostPsi required'},400);
   return j({ok:true,...calcWastegateDuty(b.targetBoostPsi,b.springPressurePsi||7,b.maxDuty||95)});
 }catch(e){return j({error:e.message},500)}}

 // MAF scaling calculator
 if(p==='/api/ecu/fuel/maf-scale'&&m==='POST'){try{
   const b=await body(req);
   if(!b.stockFlowCc||!b.newFlowCc)return j({error:'MISSING_PARAMS: stockFlowCc, newFlowCc required'},400);
   return j({ok:true,...calcMAFScale(b.stockFlowCc,b.newFlowCc,b.stockPressureBar||3,b.newPressureBar||3)});
 }catch(e){return j({error:e.message},500)}}

 // Fuel pump sizing
 if(p==='/api/ecu/fuel/size-pump'&&m==='POST'){try{
   const b=await body(req);
   if(!b.targetHp)return j({error:'MISSING_PARAMS: targetHp required'},400);
   return j({ok:true,...sizeFuelPump(b.targetHp,b.fuelType||'gasoline',b.bsfc||0.50,b.fuelPressureBar||3,b.safetyMargin||1.2)});
 }catch(e){return j({error:e.message},500)}}

 // Volumetric efficiency estimator
 if(p==='/api/ecu/fuel/ve'&&m==='POST'){try{
   const b=await body(req);
   if(!b.measuredAFR||!b.injectorFlowCc||!b.pulseWidthMs||!b.rpm||!b.displacement_cc||!b.numCylinders)
     return j({error:'MISSING_PARAMS: measuredAFR, injectorFlowCc, pulseWidthMs, rpm, displacement_cc, numCylinders required'},400);
   return j({ok:true,...estimateVE(b.measuredAFR,b.injectorFlowCc,b.pulseWidthMs,b.rpm,b.displacement_cc,b.numCylinders,b.fuelType||'gasoline')});
 }catch(e){return j({error:e.message},500)}}

 // List injectors database
 if(p==='/api/ecu/fuel/injectors'&&m==='GET'){
   return j({ok:true,injectors:listInjectors()})}

 // Get specific injector
 if(p.startsWith('/api/ecu/fuel/injectors/')&&m==='GET'){
   const name=p.split('/').pop();
   const inj=getInjector(name);
   if(!inj)return j({error:'INJECTOR_NOT_FOUND'},404);
   return j({ok:true,name,...inj})}

 // List fuel types
 if(p==='/api/ecu/fuel/types'&&m==='GET'){
   return j({ok:true,fuelTypes:listFuelTypes()})}

 // Get specific fuel type
 if(p.startsWith('/api/ecu/fuel/types/')&&m==='GET'){
   const name=p.split('/').pop();
   const ft=getFuelType(name);
   if(!ft)return j({error:'FUEL_TYPE_NOT_FOUND'},404);
   return j({ok:true,name,...ft})}

 // Fuel calculator stats
 if(p==='/api/ecu/fuel/stats'&&m==='GET'){
   return j({ok:true,...fuelCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === TURBO & COMPRESSOR CALCULATOR — Turbo boyutlandırma, kompresör haritası ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Calculate required airflow for target HP
 if(p==='/api/ecu/turbo/airflow'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcAirflow(b.targetHp,b.bsfc,b.afr)});
 }catch(e){return j({error:e.message},500)}}

 // Calculate compressor pressure ratio
 if(p==='/api/ecu/turbo/pressure-ratio'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcPressureRatio(b.boostPsi,b.intakeLoss_psi,b.altitudeFt)});
 }catch(e){return j({error:e.message},500)}}

 // Calculate compressor outlet temperature
 if(p==='/api/ecu/turbo/compressor-temp'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcCompressorTemp(b.pressureRatio,b.inletTempC,b.compressorEfficiency)});
 }catch(e){return j({error:e.message},500)}}

 // Calculate intercooler sizing
 if(p==='/api/ecu/turbo/intercooler'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcIntercooler(b.airflowLbMin,b.compOutletTempC,b.ambientTempC,b.targetEfficiency)});
 }catch(e){return j({error:e.message},500)}}

 // Select turbine A/R ratio
 if(p==='/api/ecu/turbo/ar-select'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...selectAR(b.displacement_cc,b.targetBoostPsi,b.numCylinders,b.maxRPM)});
 }catch(e){return j({error:e.message},500)}}

 // Size turbo for target power
 if(p==='/api/ecu/turbo/size'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...sizeTurbo(b.targetHp,b.displacement_cc,b.fuelType,b.bsfc)});
 }catch(e){return j({error:e.message},500)}}

 // Check surge/choke for operating point
 if(p==='/api/ecu/turbo/surge-choke'&&m==='POST'){try{
   const b=await body(req);
   const result=checkSurgeChoke(b.turboName,b.operatingFlow_lb_min,b.pressureRatio);
   if(result.error)return j(result,404);
   return j({ok:true,...result});
 }catch(e){return j({error:e.message},500)}}

 // Twin turbo configuration
 if(p==='/api/ecu/turbo/twin'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcTwinTurbo(b.targetHp,b.displacement_cc,b.config)});
 }catch(e){return j({error:e.message},500)}}

 // List all turbos in database
 if(p==='/api/ecu/turbo/list'&&m==='GET'){
   return j({ok:true,turbos:listTurbos()})}

 // Search turbos
 if(p==='/api/ecu/turbo/search'&&m==='GET'){
   const q=new URL(req.url).searchParams.get('q')||'';
   return j({ok:true,results:searchTurbos(q)})}

 // Get specific turbo
 if(p.startsWith('/api/ecu/turbo/db/')&&m==='GET'){
   const name=p.replace('/api/ecu/turbo/db/','');
   const t=getTurbo(name);
   if(!t)return j({error:'TURBO_NOT_FOUND'},404);
   return j({ok:true,name,...t})}

 // Turbo calculator stats
 if(p==='/api/ecu/turbo/stats'&&m==='GET'){
   return j({ok:true,...turboCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === EXHAUST FLOW & DOWNPIPE CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Exhaust gas flow calculation
 if(p==='/api/ecu/exhaust/flow'&&m==='POST'){
   const b=await body(req);
   if(!b.hp)return j({error:'hp required'},400);
   return j({ok:true,...calcExhaustFlow(b.hp, b.afr, b.bsfc, b.exhaustTemp_C)})}

 // Exhaust pipe sizing
 if(p==='/api/ecu/exhaust/pipe-size'&&m==='POST'){
   const b=await body(req);
   if(!b.hp)return j({error:'hp required'},400);
   return j({ok:true,...sizeExhaustPipe(b.hp, b.numPipes, b.exhaustTemp_C, b.maxVelocity_m_s)})}

 // Backpressure estimation
 if(p==='/api/ecu/exhaust/backpressure'&&m==='POST'){
   const b=await body(req);
   if(!b.hp||!b.pipeDiameter_in)return j({error:'hp and pipeDiameter_in required'},400);
   const r=calcBackpressure(b.hp, b.pipeDiameter_in, b.pipeLength_ft, b.numBends, b.hasCat, b.catType, b.hasMuffler);
   if(r.error)return j(r,400);
   return j({ok:true,...r})}

 // Header design calculator
 if(p==='/api/ecu/exhaust/header-size'&&m==='POST'){
   const b=await body(req);
   if(!b.displacement_cc||!b.numCylinders)return j({error:'displacement_cc and numCylinders required'},400);
   return j({ok:true,...calcHeaderSize(b.displacement_cc, b.numCylinders, b.peakPowerRPM, b.headerType)})}

 // Catalytic converter sizing
 if(p==='/api/ecu/exhaust/cat-size'&&m==='POST'){
   const b=await body(req);
   if(!b.targetHp)return j({error:'targetHp required'},400);
   return j({ok:true,...sizeCat(b.targetHp, b.requirements)})}

 // EGT safety check
 if(p==='/api/ecu/exhaust/egt-check'&&m==='POST'){
   const b=await body(req);
   if(!b.egt_C&&b.egt_C!==0)return j({error:'egt_C required'},400);
   return j({ok:true,...checkEGT(b.egt_C, b.fuelType)})}

 // List available pipe sizes
 if(p==='/api/ecu/exhaust/pipes'&&m==='GET'){
   return j({ok:true,pipes:listPipeSizes()})}

 // List catalytic converters
 if(p==='/api/ecu/exhaust/cats'&&m==='GET'){
   return j({ok:true,catalyticConverters:listCats()})}

 // Get specific catalytic converter
 if(p.startsWith('/api/ecu/exhaust/cat/')&&m==='GET'){
   const name=p.split('/api/ecu/exhaust/cat/')[1];
   const c=getCat(decodeURIComponent(name));
   if(!c)return j({error:'CAT_NOT_FOUND'},404);
   return j({ok:true,name:decodeURIComponent(name),...c})}

 // Exhaust calculator stats
 if(p==='/api/ecu/exhaust/stats'&&m==='GET'){
   return j({ok:true,...exhaustCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ENGINE MATH & COMPRESSION RATIO CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Engine displacement calculator
 if(p==='/api/ecu/engine/displacement'&&m==='POST'){
   const b=await body(req);
   if(!b.bore_mm||!b.stroke_mm||!b.cylinders)return j({error:'bore_mm, stroke_mm, cylinders required'},400);
   return j({ok:true,...calcDisplacement(b.bore_mm, b.stroke_mm, b.cylinders)})}

 // Compression ratio calculator
 if(p==='/api/ecu/engine/compression-ratio'&&m==='POST'){
   const b=await body(req);
   if(!b.bore_mm||!b.stroke_mm||!b.chamberVolume_cc||!b.gasketThickness_mm)return j({error:'bore_mm, stroke_mm, chamberVolume_cc, gasketThickness_mm required'},400);
   return j({ok:true,...calcCompressionRatio(b.bore_mm, b.stroke_mm, b.chamberVolume_cc, b.gasketThickness_mm, b.gasketBore_mm, b.pistonDomeVolume_cc, b.deckClearance_mm)})}

 // Dynamic compression ratio
 if(p==='/api/ecu/engine/dynamic-cr'&&m==='POST'){
   const b=await body(req);
   if(!b.staticCR||!b.stroke_mm||!b.rodLength_mm||!b.intakeValveClose_ABDC)return j({error:'staticCR, stroke_mm, rodLength_mm, intakeValveClose_ABDC required'},400);
   return j({ok:true,...calcDynamicCR(b.staticCR, b.stroke_mm, b.rodLength_mm, b.intakeValveClose_ABDC)})}

 // Mean piston speed
 if(p==='/api/ecu/engine/piston-speed'&&m==='POST'){
   const b=await body(req);
   if(!b.stroke_mm||!b.rpm)return j({error:'stroke_mm and rpm required'},400);
   return j({ok:true,...calcMeanPistonSpeed(b.stroke_mm, b.rpm)})}

 // Torque / HP conversion
 if(p==='/api/ecu/engine/torque-hp'&&m==='POST'){
   const b=await body(req);
   if(!b.value||!b.from||!b.rpm)return j({error:'value, from (hp/nm/ftlb/kw/ps), rpm required'},400);
   const r=convertTorqueHP(b.value, b.from, b.rpm);
   if(r.error)return j(r,400);
   return j({ok:true,...r})}

 // BMEP calculator
 if(p==='/api/ecu/engine/bmep'&&m==='POST'){
   const b=await body(req);
   if(!b.torque_nm||!b.displacement_cc)return j({error:'torque_nm and displacement_cc required'},400);
   return j({ok:true,...calcBMEP(b.torque_nm, b.displacement_cc, b.strokes)})}

 // Engine efficiency
 if(p==='/api/ecu/engine/efficiency'&&m==='POST'){
   const b=await body(req);
   if(!b.hp||!b.fuelFlow_kg_hr)return j({error:'hp and fuelFlow_kg_hr required'},400);
   return j({ok:true,...calcEfficiency(b.hp, b.fuelFlow_kg_hr, b.fuelType, b.displacement_cc, b.rpm, b.actualAirflow_kg_hr)})}

 // Rod ratio analysis
 if(p==='/api/ecu/engine/rod-ratio'&&m==='POST'){
   const b=await body(req);
   if(!b.rodLength_mm||!b.stroke_mm)return j({error:'rodLength_mm and stroke_mm required'},400);
   return j({ok:true,...calcRodRatio(b.rodLength_mm, b.stroke_mm)})}

 // Cylinder pressure estimation
 if(p==='/api/ecu/engine/cylinder-pressure'&&m==='POST'){
   const b=await body(req);
   if(!b.compressionRatio)return j({error:'compressionRatio required'},400);
   return j({ok:true,...estimateCylinderPressure(b.compressionRatio, b.boostPressure_bar, b.fuelType)})}

 // List engine configs
 if(p==='/api/ecu/engine/configs'&&m==='GET'){
   return j({ok:true,configs:listEngineConfigs()})}

 // Search engine configs
 if(p==='/api/ecu/engine/configs/search'&&m==='GET'){
   const u=new URL(req.url);const q=u.searchParams.get('q')||'';
   return j({ok:true,results:searchEngineConfigs(q)})}

 // Get specific engine config
 if(p.startsWith('/api/ecu/engine/config/')&&m==='GET'){
   const name=decodeURIComponent(p.split('/api/ecu/engine/config/')[1]);
   const cfg=getEngineConfig(name);
   if(!cfg)return j({error:'ENGINE_NOT_FOUND'},404);
   return j({ok:true,name,...cfg})}

 // Engine math stats
 if(p==='/api/ecu/engine/stats'&&m==='GET'){
   return j({ok:true,...engineMathStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === CAMSHAFT PROFILE ANALYZER ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Cam timing events
 if(p==='/api/ecu/cam/timing'&&m==='POST'){try{
   const b=await body(req);
   if(!b.intake_duration||!b.intake_centerline||!b.exhaust_duration||!b.exhaust_centerline)return j({error:'MISSING_PARAMS',required:['intake_duration','intake_centerline','exhaust_duration','exhaust_centerline']},400);
   return j({ok:true,...calcTimingEvents(b.intake_duration,b.intake_centerline,b.exhaust_duration,b.exhaust_centerline)})}catch(e){return j({error:e.message},500)}}

 // Valve float RPM estimate
 if(p==='/api/ecu/cam/valve-float'&&m==='POST'){try{
   const b=await body(req);
   if(!b.lift_mm||!b.springRate_N_mm||!b.installedPreload_N||!b.valveMass_g||!b.retainerMass_g||!b.springMass_g)return j({error:'MISSING_PARAMS',required:['lift_mm','springRate_N_mm','installedPreload_N','valveMass_g','retainerMass_g','springMass_g']},400);
   return j({ok:true,...calcValveFloat(b.lift_mm,b.springRate_N_mm,b.installedPreload_N,b.valveMass_g,b.retainerMass_g,b.springMass_g,b.followerType||'roller')})}catch(e){return j({error:e.message},500)}}

 // Compare two cam profiles
 if(p==='/api/ecu/cam/compare'&&m==='POST'){try{
   const b=await body(req);
   if(!b.cam1||!b.cam2)return j({error:'MISSING_PARAMS',required:['cam1','cam2']},400);
   const result=compareCams(b.cam1,b.cam2);
   if(result.error)return j(result,404);
   return j({ok:true,...result})}catch(e){return j({error:e.message},500)}}

 // Recommend cam for application
 if(p==='/api/ecu/cam/recommend'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...recommendCam(b.application||'street',b.forced_induction||false,b.targetRPM||6500)})}catch(e){return j({error:e.message},500)}}

 // List all cam profiles
 if(p==='/api/ecu/cam/profiles'&&m==='GET'){
   return j({ok:true,profiles:listCams()})}

 // Search cam profiles
 if(p==='/api/ecu/cam/profiles/search'&&m==='GET'){
   const u=new URL(req.url);const q=u.searchParams.get('q')||'';
   return j({ok:true,results:searchCams(q)})}

 // Get specific cam profile
 if(p.startsWith('/api/ecu/cam/profile/')&&m==='GET'){
   const name=decodeURIComponent(p.split('/api/ecu/cam/profile/')[1]);
   const cam=getCam(name);
   if(!cam)return j({error:'CAM_NOT_FOUND'},404);
   return j({ok:true,name,...cam})}

 // Cam stats
 if(p==='/api/ecu/cam/stats'&&m==='GET'){
   return j({ok:true,...camCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === DRIVETRAIN LOSS & GEAR RATIO CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Speed at RPM
 if(p==='/api/ecu/drivetrain/speed-at-rpm'&&m==='POST'){try{
   const b=await body(req);
   if(!b.gears||!b.finalDrive||!b.rpm)return j({error:'MISSING_PARAMS',required:['gears','finalDrive','tireWidth','tireAspect','tireRim','rpm']},400);
   return j({ok:true,...calcSpeedAtRPM(b.gears,b.finalDrive,b.tireWidth||225,b.tireAspect||45,b.tireRim||17,b.rpm)});
 }catch(e){return j({error:e.message},500)}}

 // RPM at speed
 if(p==='/api/ecu/drivetrain/rpm-at-speed'&&m==='POST'){try{
   const b=await body(req);
   if(!b.gears||!b.finalDrive||!b.speed_kmh)return j({error:'MISSING_PARAMS',required:['gears','finalDrive','speed_kmh']},400);
   return j({ok:true,...calcRPMAtSpeed(b.gears,b.finalDrive,b.tireWidth||225,b.tireAspect||45,b.tireRim||17,b.speed_kmh)});
 }catch(e){return j({error:e.message},500)}}

 // Wheel HP from crank HP
 if(p==='/api/ecu/drivetrain/wheel-hp'&&m==='POST'){try{
   const b=await body(req);
   if(!b.crankHP)return j({error:'MISSING_PARAMS',required:['crankHP']},400);
   return j({ok:true,...calcWheelHP(b.crankHP,b.drivetrainType||'rwd-manual',b.customLoss_pct||null)});
 }catch(e){return j({error:e.message},500)}}

 // Estimate crank HP from dyno wheel HP
 if(p==='/api/ecu/drivetrain/crank-hp'&&m==='POST'){try{
   const b=await body(req);
   if(!b.wheelHP)return j({error:'MISSING_PARAMS',required:['wheelHP']},400);
   return j({ok:true,...estimateCrankHP(b.wheelHP,b.drivetrainType||'rwd-manual',b.customLoss_pct||null)});
 }catch(e){return j({error:e.message},500)}}

 // Gear ratio analysis
 if(p==='/api/ecu/drivetrain/gear-analysis'&&m==='POST'){try{
   const b=await body(req);
   if(!b.gears||!b.finalDrive)return j({error:'MISSING_PARAMS',required:['gears','finalDrive']},400);
   return j({ok:true,...analyzeGearRatios(b.gears,b.finalDrive)});
 }catch(e){return j({error:e.message},500)}}

 // 0-100 km/h estimate
 if(p==='/api/ecu/drivetrain/zero-to-100'&&m==='POST'){try{
   const b=await body(req);
   if(!b.crankHP||!b.weight_kg)return j({error:'MISSING_PARAMS',required:['crankHP','weight_kg']},400);
   return j({ok:true,...estimate0to100(b.crankHP,b.weight_kg,b.drivetrainType||'rwd-manual',b.tireType||'summer')});
 }catch(e){return j({error:e.message},500)}}

 // Max speeds per gear
 if(p==='/api/ecu/drivetrain/max-speeds'&&m==='POST'){try{
   const b=await body(req);
   if(!b.gears||!b.finalDrive||!b.redlineRPM||!b.crankHP)return j({error:'MISSING_PARAMS',required:['gears','finalDrive','redlineRPM','crankHP']},400);
   return j({ok:true,...calcMaxSpeeds(b.gears,b.finalDrive,b.tireWidth||225,b.tireAspect||45,b.tireRim||17,b.redlineRPM,b.crankHP,b.dragCoeff||0.32,b.frontalArea_m2||2.2,b.weight_kg||1500)});
 }catch(e){return j({error:e.message},500)}}

 // List transmission database
 if(p==='/api/ecu/drivetrain/transmissions'&&m==='GET'){
   return j({ok:true,transmissions:listTransmissions()})}

 // Search transmissions
 if(p==='/api/ecu/drivetrain/transmissions/search'&&m==='GET'){
   const u=new URL(req.url);const q=u.searchParams.get('q')||'';
   return j({ok:true,results:searchTransmissions(q)})}

 // Get specific transmission
 if(p.startsWith('/api/ecu/drivetrain/transmission/')&&m==='GET'){
   const name=p.split('/api/ecu/drivetrain/transmission/')[1];
   const tx=getTransmission(decodeURIComponent(name));
   if(!tx)return j({error:'NOT_FOUND'},404);
   return j({ok:true,name,...tx})}

 // List tire sizes
 if(p==='/api/ecu/drivetrain/tires'&&m==='GET'){
   return j({ok:true,tires:listTireSizes()})}

 // List drivetrain types with loss percentages
 if(p==='/api/ecu/drivetrain/types'&&m==='GET'){
   return j({ok:true,types:listDrivetrainTypes()})}

 // Drivetrain stats
 if(p==='/api/ecu/drivetrain/stats'&&m==='GET'){
   return j({ok:true,...drivetrainCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === COOLING SYSTEM CALCULATOR — Radyatör, soğutma, fan, termostat ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Heat rejection requirement from engine HP
 if(p==='/api/ecu/cooling/heat-rejection'&&m==='POST'){const b=await body(req);
   if(!b.crankHP)return j({error:'crankHP required'},400);
   return j({ok:true,...calcHeatRejection(b.crankHP,b.efficiency_pct||30)})}

 // Coolant flow requirement
 if(p==='/api/ecu/cooling/coolant-flow'&&m==='POST'){const b=await body(req);
   if(!b.heatRejection_kW)return j({error:'heatRejection_kW required'},400);
   return j({ok:true,...calcCoolantFlow(b.heatRejection_kW,b.deltaT_C||10,b.coolantType||'water-glycol-50')})}

 // Radiator sizing
 if(p==='/api/ecu/cooling/radiator-size'&&m==='POST'){const b=await body(req);
   if(!b.crankHP)return j({error:'crankHP required'},400);
   return j({ok:true,...sizeRadiator(b.crankHP,b.ambientTemp_C||35,b.targetCoolantTemp_C||90,b.airSpeed_kmh||30)})}

 // Boiling point under pressure
 if(p==='/api/ecu/cooling/boiling-point'&&m==='POST'){const b=await body(req);
   return j({ok:true,...calcBoilingPoint(b.pressureCap_psi||15,b.coolantType||'water-glycol-50')})}

 // Fan sizing
 if(p==='/api/ecu/cooling/fan-size'&&m==='POST'){const b=await body(req);
   if(!b.crankHP)return j({error:'crankHP required'},400);
   return j({ok:true,...sizeFan(b.radiatorArea_cm2||3500,b.crankHP,b.hasAC||false)})}

 // Water pump analysis
 if(p==='/api/ecu/cooling/water-pump'&&m==='POST'){const b=await body(req);
   if(!b.pumpFlow_Lpm||!b.systemVolume_L||!b.heatRejection_kW)return j({error:'pumpFlow_Lpm, systemVolume_L, heatRejection_kW required'},400);
   return j({ok:true,...calcWaterPump(b.pumpFlow_Lpm,b.systemVolume_L,b.heatRejection_kW,b.coolantType||'water-glycol-50')})}

 // Thermostat recommendation
 if(p==='/api/ecu/cooling/thermostat-recommend'&&m==='POST'){const b=await body(req);
   return j({ok:true,...recommendThermostat(b.application||'street',b.forced_induction||false)})}

 // List coolant types
 if(p==='/api/ecu/cooling/coolants'&&m==='GET'){
   return j({ok:true,coolants:listCoolantTypes()})}

 // List radiators
 if(p==='/api/ecu/cooling/radiators'&&m==='GET'){
   return j({ok:true,radiators:listRadiators()})}

 // Get specific radiator
 if(p.startsWith('/api/ecu/cooling/radiator/')&&m==='GET'){const name=decodeURIComponent(p.split('/').pop());
   const r=getRadiator(name);if(!r)return j({error:'Radiator not found'},404);
   return j({ok:true,name,radiator:r})}

 // List fans
 if(p==='/api/ecu/cooling/fans'&&m==='GET'){
   return j({ok:true,fans:listFans()})}

 // List thermostats
 if(p==='/api/ecu/cooling/thermostats'&&m==='GET'){
   return j({ok:true,thermostats:listThermostats()})}

 // Cooling stats
 if(p==='/api/ecu/cooling/stats'&&m==='GET'){
   return j({ok:true,...coolingCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === KNOCK DETECTION ANALYZER ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Knock frequency by bore size
 if(p==='/api/ecu/knock/frequency'&&m==='POST'){try{
   const b=await body(req);if(!b.bore_mm)return j({error:'bore_mm required'},400);
   return j({ok:true,...calcKnockFrequency(b.bore_mm)})}catch(e){return j({error:e.message},500)}}

 // Detonation risk assessment
 if(p==='/api/ecu/knock/detonation-risk'&&m==='POST'){try{
   const b=await body(req);if(!b.compressionRatio)return j({error:'compressionRatio required'},400);
   return j({ok:true,...assessDetonationRisk(b.compressionRatio,b.boostPSI||0,b.octane_RON||95,b.intakeTemp_C||25,b.timing_deg||0)})}catch(e){return j({error:e.message},500)}}

 // Timing retard recommendation
 if(p==='/api/ecu/knock/timing-retard'&&m==='POST'){try{
   const b=await body(req);if(!b.baseAdvance_deg&&b.baseAdvance_deg!==0)return j({error:'baseAdvance_deg required'},400);
   return j({ok:true,...calcTimingRetard(b.baseAdvance_deg,b.knockCount||0,b.knockIntensity||1.0)})}catch(e){return j({error:e.message},500)}}

 // Timing map recommendation
 if(p==='/api/ecu/knock/timing-map'&&m==='POST'){try{
   const b=await body(req);if(!b.compressionRatio)return j({error:'compressionRatio required'},400);
   return j({ok:true,...recommendTimingMap(b.compressionRatio,b.fuelOctane_RON||95,b.boostPSI||0,b.engineType||'na')})}catch(e){return j({error:e.message},500)}}

 // Knock window analysis
 if(p==='/api/ecu/knock/window'&&m==='POST'){try{
   const b=await body(req);if(!b.rpm)return j({error:'rpm required'},400);
   return j({ok:true,...analyzeKnockWindow(b.rpm,b.strokeLength_mm||86)})}catch(e){return j({error:e.message},500)}}

 // List octane ratings
 if(p==='/api/ecu/knock/octanes'&&m==='GET'){
   return j({ok:true,octanes:listOctanes()})}

 // Get specific octane
 if(p.startsWith('/api/ecu/knock/octane/')&&m==='GET'){
   const name=p.split('/api/ecu/knock/octane/')[1];
   const o=getOctane(decodeURIComponent(name));
   if(!o)return j({error:'Octane not found'},404);
   return j({ok:true,octane:o})}

 // List knock sensors
 if(p==='/api/ecu/knock/sensors'&&m==='GET'){
   return j({ok:true,sensors:listKnockSensors()})}

 // Get specific knock sensor
 if(p.startsWith('/api/ecu/knock/sensor/')&&m==='GET'){
   const name=p.split('/api/ecu/knock/sensor/')[1];
   const s=getKnockSensor(decodeURIComponent(name));
   if(!s)return j({error:'Sensor not found'},404);
   return j({ok:true,sensor:s})}

 // Search knock sensors
 if(p==='/api/ecu/knock/sensors/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchKnockSensors(b.query)})}catch(e){return j({error:e.message},500)}}

 // Knock stats
 if(p==='/api/ecu/knock/stats'&&m==='GET'){
   return j({ok:true,...knockCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === WIDEBAND LAMBDA CONTROLLER — AFR/Lambda hesaplama ve kontrol ===
 // ═══════════════════════════════════════════════════════════════════════════

 // PID tuning parameters
 if(p==='/api/ecu/lambda/pid'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcPIDTuning(b.targetLambda||1.0,b.sensorType||'wideband',b.engineSize_cc||2000)})}catch(e){return j({error:e.message},500)}}

 // Lambda target map generation
 if(p==='/api/ecu/lambda/map'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...generateLambdaMap(b.fuelType||'gasoline',b.engineType||'na',b.boostMax_bar||0)})}catch(e){return j({error:e.message},500)}}

 // Sensor calibration (voltage to lambda/AFR)
 if(p==='/api/ecu/lambda/calibrate'&&m==='POST'){try{
   const b=await body(req);if(!b.sensorModel)return j({error:'sensorModel required'},400);
   if(b.outputVoltage_V===undefined)return j({error:'outputVoltage_V required'},400);
   return j({ok:true,...calibrateSensor(b.sensorModel,b.outputVoltage_V)})}catch(e){return j({error:e.message},500)}}

 // Free air calibration procedure
 if(p==='/api/ecu/lambda/free-air-cal'&&m==='POST'){try{
   const b=await body(req);if(!b.sensorModel)return j({error:'sensorModel required'},400);
   return j({ok:true,...freeAirCalibration(b.sensorModel)})}catch(e){return j({error:e.message},500)}}

 // Ethanol content estimation from stoich AFR
 if(p==='/api/ecu/lambda/ethanol-estimate'&&m==='POST'){try{
   const b=await body(req);if(!b.measuredStoichAFR)return j({error:'measuredStoichAFR required'},400);
   return j({ok:true,...estimateEthanolContent(b.measuredStoichAFR)})}catch(e){return j({error:e.message},500)}}

 // List fuel stoichiometric ratios
 if(p==='/api/ecu/lambda/fuels'&&m==='GET'){
   return j({ok:true,fuels:listFuelStoich()})}

 // Get specific fuel
 if(p.startsWith('/api/ecu/lambda/fuel/')&&m==='GET'){
   const name=p.split('/api/ecu/lambda/fuel/')[1];
   const f=getFuelStoich(decodeURIComponent(name));
   if(!f)return j({error:'Fuel type not found'},404);
   return j({ok:true,fuel:f})}

 // List wideband sensors
 if(p==='/api/ecu/lambda/sensors'&&m==='GET'){
   return j({ok:true,sensors:listWidebandSensors()})}

 // Get specific wideband sensor
 if(p.startsWith('/api/ecu/lambda/sensor/')&&m==='GET'){
   const name=p.split('/api/ecu/lambda/sensor/')[1];
   const s=getWidebandSensor(decodeURIComponent(name));
   if(!s)return j({error:'Sensor not found'},404);
   return j({ok:true,sensor:s})}

 // Search wideband sensors
 if(p==='/api/ecu/lambda/sensors/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchWidebandSensors(b.query)})}catch(e){return j({error:e.message},500)}}

 // List lambda targets
 if(p==='/api/ecu/lambda/targets'&&m==='GET'){
   return j({ok:true,targets:listLambdaTargets()})}

 // Get specific lambda target
 if(p.startsWith('/api/ecu/lambda/target/')&&m==='GET'){
   const name=p.split('/api/ecu/lambda/target/')[1];
   const t=getLambdaTarget(decodeURIComponent(name));
   if(!t)return j({error:'Target not found'},404);
   return j({ok:true,target:t})}

 // Lambda stats
 if(p==='/api/ecu/lambda/stats'&&m==='GET'){
   return j({ok:true,...lambdaCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === Ignition Timing Calculator — MBT, knock limit, dwell, spark ===
 // ═══════════════════════════════════════════════════════════════════════════

 // MBT timing estimate
 if(p==='/api/ecu/ignition/mbt'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...estimateMBT(b.compressionRatio||10,b.rpm||3000,b.load_pct||50,b.fuelType||'gasoline')})}catch(e){return j({error:e.message},500)}}

 // Knock-limited timing
 if(p==='/api/ecu/ignition/knock-limit'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcKnockLimitedTiming(b.compressionRatio||10,b.boostPSI||0,b.octane_RON||95,b.intakeTemp_C||25)})}catch(e){return j({error:e.message},500)}}

 // Timing advance curve
 if(p==='/api/ecu/ignition/curve'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...generateTimingCurve(b.compressionRatio||10,b.maxRPM||7000,b.boostPSI||0,b.octane_RON||95,b.engineType||'na')})}catch(e){return j({error:e.message},500)}}

 // Dwell time calculator
 if(p==='/api/ecu/ignition/dwell'&&m==='POST'){try{
   const b=await body(req);if(!b.coilModel)return j({error:'coilModel required'},400);
   return j({ok:true,...calcDwellTime(b.coilModel,b.rpm||3000,b.batteryVoltage_V||14.0)})}catch(e){return j({error:e.message},500)}}

 // Spark plug gap recommendation
 if(p==='/api/ecu/ignition/spark-gap'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...recommendSparkPlugGap(b.boostPSI||0,b.coilEnergy_mJ||80,b.fuelType||'gasoline')})}catch(e){return j({error:e.message},500)}}

 // Spark energy vs cylinder pressure
 if(p==='/api/ecu/ignition/spark-energy'&&m==='POST'){try{
   const b=await body(req);if(!b.cylinderPressure_bar)return j({error:'cylinderPressure_bar required'},400);
   return j({ok:true,...calcSparkEnergy(b.cylinderPressure_bar,b.gap_mm||0.8,b.coilEnergy_mJ||80)})}catch(e){return j({error:e.message},500)}}

 // Full ignition timing table
 if(p==='/api/ecu/ignition/table'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...generateIgnitionTable(b.compressionRatio||10,b.maxRPM||7000,b.boostMax_bar||0,b.octane_RON||95,b.engineType||'na')})}catch(e){return j({error:e.message},500)}}

 // List ignition coils
 if(p==='/api/ecu/ignition/coils'&&m==='GET'){
   return j({ok:true,coils:listCoils()})}

 // Get specific coil
 if(p.startsWith('/api/ecu/ignition/coil/')&&m==='GET'){
   const name=p.split('/api/ecu/ignition/coil/')[1];
   const c=getCoil(decodeURIComponent(name));
   if(!c)return j({error:'Coil not found'},404);
   return j({ok:true,coil:c})}

 // Search coils
 if(p==='/api/ecu/ignition/coils/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchCoils(b.query)})}catch(e){return j({error:e.message},500)}}

 // List spark plugs
 if(p==='/api/ecu/ignition/plugs'&&m==='GET'){
   return j({ok:true,sparkPlugs:listSparkPlugs()})}

 // Get specific spark plug
 if(p.startsWith('/api/ecu/ignition/plug/')&&m==='GET'){
   const name=p.split('/api/ecu/ignition/plug/')[1];
   const s=getSparkPlug(decodeURIComponent(name));
   if(!s)return j({error:'Spark plug not found'},404);
   return j({ok:true,sparkPlug:s})}

 // Search spark plugs
 if(p==='/api/ecu/ignition/plugs/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchSparkPlugs(b.query)})}catch(e){return j({error:e.message},500)}}

 // Ignition stats
 if(p==='/api/ecu/ignition/stats'&&m==='GET'){
   return j({ok:true,...ignitionCalcStats()})}

 // ─── Oil System Calculator ─────────────────────────────────────────────

 // Oil viscosity at temperature
 if(p==='/api/ecu/oil/viscosity'&&m==='POST'){try{
   const b=await body(req);if(!b.oilGrade)return j({error:'oilGrade required'},400);
   if(!b.temperature_C&&b.temperature_C!==0)return j({error:'temperature_C required'},400);
   return j({ok:true,...calcViscosityAtTemp(b.oilGrade,b.temperature_C)})}catch(e){return j({error:e.message},500)}}

 // Oil pressure requirements
 if(p==='/api/ecu/oil/pressure'&&m==='POST'){try{
   const b=await body(req);if(!b.oilGrade)return j({error:'oilGrade required'},400);
   return j({ok:true,...calcOilPressure(b.rpm||3000,b.oilGrade,b.bearingClearance_mm||0.05,b.numberOfBearings||10)})}catch(e){return j({error:e.message},500)}}

 // Oil cooler sizing
 if(p==='/api/ecu/oil/cooler-size'&&m==='POST'){try{
   const b=await body(req);if(!b.engineHP)return j({error:'engineHP required'},400);
   return j({ok:true,...sizeOilCooler(b.engineHP,b.oilTemp_target_C||110,b.ambientTemp_C||35,b.isTurbo||false)})}catch(e){return j({error:e.message},500)}}

 // Oil pump flow calculator
 if(p==='/api/ecu/oil/pump-flow'&&m==='POST'){try{
   const b=await body(req);if(!b.pumpModel)return j({error:'pumpModel required'},400);
   return j({ok:true,...calcPumpFlow(b.pumpModel,b.rpm||3000,b.oilGrade)})}catch(e){return j({error:e.message},500)}}

 // Oil analysis interpreter
 if(p==='/api/ecu/oil/analysis'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...interpretOilAnalysis(b)})}catch(e){return j({error:e.message},500)}}

 // Oil spec recommendation
 if(p==='/api/ecu/oil/recommend'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...recommendOilSpec(b.engineType||'na',b.powerLevel_HP||200,b.usage||'daily')})}catch(e){return j({error:e.message},500)}}

 // List oil grades
 if(p==='/api/ecu/oil/grades'&&m==='GET'){
   return j({ok:true,oils:listOils()})}

 // Get specific oil grade
 if(p.startsWith('/api/ecu/oil/grade/')&&m==='GET'){
   const name=p.split('/api/ecu/oil/grade/')[1];
   const o=getOil(decodeURIComponent(name));
   if(!o)return j({error:'Oil grade not found'},404);
   return j({ok:true,oil:o})}

 // Search oils
 if(p==='/api/ecu/oil/grades/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchOils(b.query)})}catch(e){return j({error:e.message},500)}}

 // List oil pumps
 if(p==='/api/ecu/oil/pumps'&&m==='GET'){
   return j({ok:true,pumps:listPumps()})}

 // Get specific pump
 if(p.startsWith('/api/ecu/oil/pump/')&&m==='GET'){
   const name=p.split('/api/ecu/oil/pump/')[1];
   const pu=getPump(decodeURIComponent(name));
   if(!pu)return j({error:'Pump not found'},404);
   return j({ok:true,pump:pu})}

 // List oil coolers
 if(p==='/api/ecu/oil/coolers'&&m==='GET'){
   return j({ok:true,coolers:listCoolers()})}

 // Get specific cooler
 if(p.startsWith('/api/ecu/oil/cooler/')&&m==='GET'){
   const name=p.split('/api/ecu/oil/cooler/')[1];
   const co=getCooler(decodeURIComponent(name));
   if(!co)return j({error:'Cooler not found'},404);
   return j({ok:true,cooler:co})}

 // Oil system stats
 if(p==='/api/ecu/oil/stats'&&m==='GET'){
   return j({ok:true,...oilCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === NITROUS OXIDE (N2O) CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // N2O HP gain estimate
 if(p==='/api/ecu/nitrous/hp-gain'&&m==='POST'){try{
   const b=await body(req);if(!b.baseHP)return j({error:'baseHP required'},400);
   if(!b.shotSize_HP)return j({error:'shotSize_HP required'},400);
   return j({ok:true,...estimateN2OGain(b.baseHP,b.shotSize_HP,b.numStages||1)})}catch(e){return j({error:e.message},500)}}

 // N2O timing retard calculator
 if(p==='/api/ecu/nitrous/timing-retard'&&m==='POST'){try{
   const b=await body(req);if(!b.shotSize_HP)return j({error:'shotSize_HP required'},400);
   return j({ok:true,...calcN2OTimingRetard(b.shotSize_HP,b.compressionRatio||10,b.fuelType||'gasoline')})}catch(e){return j({error:e.message},500)}}

 // N2O fuel enrichment calculator
 if(p==='/api/ecu/nitrous/fuel-enrichment'&&m==='POST'){try{
   const b=await body(req);if(!b.shotSize_HP)return j({error:'shotSize_HP required'},400);
   return j({ok:true,...calcFuelEnrichment(b.shotSize_HP,b.injectorSize_cc||440,b.numInjectors||4,b.fuelPressure_bar||3.0)})}catch(e){return j({error:e.message},500)}}

 // Bottle pressure / temperature
 if(p==='/api/ecu/nitrous/bottle-pressure'&&m==='POST'){try{
   const b=await body(req);if(b.temperature_C===undefined&&b.temperature_C!==0)return j({error:'temperature_C required'},400);
   return j({ok:true,...calcBottlePressure(b.temperature_C)})}catch(e){return j({error:e.message},500)}}

 // Bottle duration estimate
 if(p==='/api/ecu/nitrous/bottle-duration'&&m==='POST'){try{
   const b=await body(req);if(!b.bottleSize)return j({error:'bottleSize required'},400);
   if(!b.shotSize_HP)return j({error:'shotSize_HP required'},400);
   return j({ok:true,...calcBottleDuration(b.bottleSize,b.shotSize_HP)})}catch(e){return j({error:e.message},500)}}

 // Purge system calculator
 if(p==='/api/ecu/nitrous/purge'&&m==='POST'){try{
   const b=await body(req);
   return j({ok:true,...calcPurge(b.lineLength_m||2,b.lineDiameter_mm||6.35)})}catch(e){return j({error:e.message},500)}}

 // Safety checklist
 if(p==='/api/ecu/nitrous/safety-checklist'&&m==='POST'){try{
   const b=await body(req);if(!b.shotSize_HP)return j({error:'shotSize_HP required'},400);
   return j({ok:true,...safetyChecklist(b.shotSize_HP,b.engineType||'na',b.fuelType||'gasoline')})}catch(e){return j({error:e.message},500)}}

 // List jets/nozzles
 if(p==='/api/ecu/nitrous/jets'&&m==='GET'){
   return j({ok:true,jets:listJets()})}

 // Get specific jet
 if(p.startsWith('/api/ecu/nitrous/jet/')&&m==='GET'){
   const key=p.split('/api/ecu/nitrous/jet/')[1];
   const jt=getJet(decodeURIComponent(key));
   if(!jt)return j({error:'Jet not found'},404);
   return j({ok:true,jet:jt})}

 // Search jets
 if(p==='/api/ecu/nitrous/jets/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchJets(b.query)})}catch(e){return j({error:e.message},500)}}

 // List bottles
 if(p==='/api/ecu/nitrous/bottles'&&m==='GET'){
   return j({ok:true,bottles:listBottles()})}

 // Get specific bottle
 if(p.startsWith('/api/ecu/nitrous/bottle/')&&m==='GET'){
   const key=p.split('/api/ecu/nitrous/bottle/')[1];
   const bt=getBottle(decodeURIComponent(key));
   if(!bt)return j({error:'Bottle not found'},404);
   return j({ok:true,bottle:bt})}

 // Nitrous system stats
 if(p==='/api/ecu/nitrous/stats'&&m==='GET'){
   return j({ok:true,...nitrousCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === INTAKE MANIFOLD & THROTTLE BODY CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Runner length calculator
 if(p==='/api/ecu/intake/runner-length'&&m==='POST'){try{
   const b=await body(req);if(!b.targetPeakTorqueRPM)return j({error:'targetPeakTorqueRPM required'},400);
   return j({ok:true,...calcRunnerLength(b.targetPeakTorqueRPM,b.numCylinders||4)})}catch(e){return j({error:e.message},500)}}

 // Runner diameter calculator
 if(p==='/api/ecu/intake/runner-diameter'&&m==='POST'){try{
   const b=await body(req);if(!b.targetHP)return j({error:'targetHP required'},400);
   return j({ok:true,...calcRunnerDiameter(b.targetHP,b.numCylinders||4,b.peakRPM||6500)})}catch(e){return j({error:e.message},500)}}

 // Plenum volume calculator
 if(p==='/api/ecu/intake/plenum-volume'&&m==='POST'){try{
   const b=await body(req);if(!b.displacement_cc)return j({error:'displacement_cc required'},400);
   return j({ok:true,...calcPlenumVolume(b.displacement_cc,b.numCylinders||4,b.isTurbo||false)})}catch(e){return j({error:e.message},500)}}

 // Throttle body sizing
 if(p==='/api/ecu/intake/throttle-body-size'&&m==='POST'){try{
   const b=await body(req);if(!b.targetHP)return j({error:'targetHP required'},400);
   return j({ok:true,...sizeThrottleBody(b.targetHP,b.isTurbo||false)})}catch(e){return j({error:e.message},500)}}

 // Airflow estimate
 if(p==='/api/ecu/intake/airflow'&&m==='POST'){try{
   const b=await body(req);if(!b.displacement_cc)return j({error:'displacement_cc required'},400);
   if(!b.rpm)return j({error:'rpm required'},400);
   return j({ok:true,...estimateAirflow(b.displacement_cc,b.rpm,b.VE_pct||90,b.boostPressure_bar||0)})}catch(e){return j({error:e.message},500)}}

 // Variable intake analysis
 if(p==='/api/ecu/intake/variable-intake'&&m==='POST'){try{
   const b=await body(req);if(!b.shortLength_mm)return j({error:'shortLength_mm required'},400);
   if(!b.longLength_mm)return j({error:'longLength_mm required'},400);
   if(!b.switchRPM)return j({error:'switchRPM required'},400);
   return j({ok:true,...analyzeVariableIntake(b.shortLength_mm,b.longLength_mm,b.switchRPM)})}catch(e){return j({error:e.message},500)}}

 // Port flow estimate
 if(p==='/api/ecu/intake/port-flow'&&m==='POST'){try{
   const b=await body(req);if(!b.portDiameter_mm)return j({error:'portDiameter_mm required'},400);
   return j({ok:true,...estimatePortFlow(b.portDiameter_mm,b.portLength_mm||120,b.surfaceFinish||'cast')})}catch(e){return j({error:e.message},500)}}

 // List manifolds
 if(p==='/api/ecu/intake/manifolds'&&m==='GET'){
   return j({ok:true,manifolds:listManifolds()})}

 // Get specific manifold
 if(p.startsWith('/api/ecu/intake/manifold/')&&m==='GET'){
   const key=p.split('/api/ecu/intake/manifold/')[1];
   const mf=getManifold(decodeURIComponent(key));
   if(!mf)return j({error:'Manifold not found'},404);
   return j({ok:true,manifold:mf})}

 // Search manifolds
 if(p==='/api/ecu/intake/manifolds/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchManifolds(b.query)})}catch(e){return j({error:e.message},500)}}

 // List throttle bodies
 if(p==='/api/ecu/intake/throttle-bodies'&&m==='GET'){
   return j({ok:true,throttleBodies:listThrottleBodies()})}

 // Get specific throttle body
 if(p.startsWith('/api/ecu/intake/throttle-body/')&&m==='GET'){
   const key=p.split('/api/ecu/intake/throttle-body/')[1];
   const tb=getThrottleBody(decodeURIComponent(key));
   if(!tb)return j({error:'Throttle body not found'},404);
   return j({ok:true,throttleBody:tb})}

 // Search throttle bodies
 if(p==='/api/ecu/intake/throttle-bodies/search'&&m==='POST'){try{
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchThrottleBodies(b.query)})}catch(e){return j({error:e.message},500)}}

 // Intake system stats
 if(p==='/api/ecu/intake/stats'&&m==='GET'){
   return j({ok:true,...intakeCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === DATA LOGGER & REALTIME MONITOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List log profiles
 if(p==='/api/ecu/datalog/profiles'&&m==='GET'){
   return j({ok:true,profiles:listLogProfiles()})}

 // Get specific log profile
 if(p.startsWith('/api/ecu/datalog/profile/')&&m==='GET'){
   const key=p.split('/api/ecu/datalog/profile/')[1];
   const prof=getLogProfile(decodeURIComponent(key));
   if(!prof)return j({error:'Profile not found'},404);
   return j({ok:true,profile:prof})}

 // List trigger types
 if(p==='/api/ecu/datalog/triggers'&&m==='GET'){
   return j({ok:true,triggers:listTriggerTypes()})}

 // Start datalog session
 if(p==='/api/ecu/datalog/start'&&m==='POST'){try{
   const b=await body(req);
   const result=await startDatalogSession(env,b.vehicleId,b.profile,b.triggerType,b.sampleRate_hz,b.metadata);
   return j({ok:true,...result})}catch(e){return j({error:e.message},500)}}

 // Append samples to session
 if(p==='/api/ecu/datalog/append'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   if(!b.samples||!Array.isArray(b.samples))return j({error:'samples array required'},400);
   const result=await appendDatalogSamples(env,b.sessionId,b.samples);
   return j({ok:true,...result})}catch(e){return j({error:e.message},500)}}

 // End datalog session
 if(p==='/api/ecu/datalog/end'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   const result=await endDatalogSession(env,b.sessionId);
   return j({ok:true,session:result})}catch(e){return j({error:e.message},500)}}

 // Get datalog session with samples
 if(p.startsWith('/api/ecu/datalog/session/')&&m==='GET'){try{
   const sid=p.split('/api/ecu/datalog/session/')[1];
   const session=await getDatalogSession(env,decodeURIComponent(sid));
   if(!session)return j({error:'Session not found'},404);
   return j({ok:true,session})}catch(e){return j({error:e.message},500)}}

 // List datalog sessions
 if(p==='/api/ecu/datalog/sessions'&&m==='GET'){try{
   const sessions=await listDatalogSessions(env);
   return j({ok:true,sessions})}catch(e){return j({error:e.message},500)}}

 // Delete datalog session
 if(p==='/api/ecu/datalog/delete'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   const result=await deleteDatalogSession(env,b.sessionId);
   return j({ok:true,...result})}catch(e){return j({error:e.message},500)}}

 // Export datalog session (csv, json, megalogviewer, vcds)
 if(p==='/api/ecu/datalog/export'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   const result=await exportDatalogSession(env,b.sessionId,b.format||'csv');
   if(!result)return j({error:'Session not found'},404);
   return j({ok:true,...result})}catch(e){return j({error:e.message},500)}}

 // Analyze log data
 if(p==='/api/ecu/datalog/analyze'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   const session=await getDatalogSession(env,b.sessionId);
   if(!session)return j({error:'Session not found'},404);
   const prof=getLogProfile(session.profile);
   return j({ok:true,...analyzeLogData(session.samples,prof?.pidNames||b.pidNames)})}catch(e){return j({error:e.message},500)}}

 // Detect anomalies
 if(p==='/api/ecu/datalog/anomalies'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   const session=await getDatalogSession(env,b.sessionId);
   if(!session)return j({error:'Session not found'},404);
   const prof=getLogProfile(session.profile);
   return j({ok:true,...detectAnomalies(session.samples,prof?.pidNames||b.pidNames,b.sensitivity||2.0)})}catch(e){return j({error:e.message},500)}}

 // Correlate channels
 if(p==='/api/ecu/datalog/correlate'&&m==='POST'){try{
   const b=await body(req);if(!b.sessionId)return j({error:'sessionId required'},400);
   if(!b.channelA||!b.channelB)return j({error:'channelA and channelB required'},400);
   const session=await getDatalogSession(env,b.sessionId);
   if(!session)return j({error:'Session not found'},404);
   return j({ok:true,...correlateChannels(session.samples,b.channelA,b.channelB)})}catch(e){return j({error:e.message},500)}}

 // Sample budget calculator
 if(p==='/api/ecu/datalog/sample-budget'&&m==='POST'){try{
   const b=await body(req);if(!b.numPIDs)return j({error:'numPIDs required'},400);
   return j({ok:true,...calcSampleBudget(b.numPIDs,b.targetRate_hz||10,b.busSpeed||'fast')})}catch(e){return j({error:e.message},500)}}

 // Datalogger stats
 if(p==='/api/ecu/datalog/stats'&&m==='GET'){
   return j({ok:true,...dataloggerStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === FLEX FUEL & ETHANOL CONTENT SENSOR CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List fuel blends
 if(p==='/api/ecu/flexfuel/blends'&&m==='GET'){
   return j({ok:true,blends:listFuelBlends()})}

 // Get specific blend
 if(p.startsWith('/api/ecu/flexfuel/blend/')&&m==='GET'){
   const key=p.split('/api/ecu/flexfuel/blend/')[1];
   const blend=getFuelBlend(decodeURIComponent(key));
   if(!blend)return j({error:'Blend not found'},404);
   return j({ok:true,blend})}

 // List ethanol sensors
 if(p==='/api/ecu/flexfuel/sensors'&&m==='GET'){
   return j({ok:true,sensors:listEthanolSensors()})}

 // Get specific sensor
 if(p.startsWith('/api/ecu/flexfuel/sensor/')&&m==='GET'){
   const key=p.split('/api/ecu/flexfuel/sensor/')[1];
   const sensor=getEthanolSensor(decodeURIComponent(key));
   if(!sensor)return j({error:'Sensor not found'},404);
   return j({ok:true,sensor})}

 // Search ethanol sensors
 if(p==='/api/ecu/flexfuel/sensors/search'&&m==='POST'){
   const b=await body(req);if(!b.query)return j({error:'query required'},400);
   return j({ok:true,results:searchEthanolSensors(b.query)})}

 // Calculate blend properties for any ethanol percentage
 if(p==='/api/ecu/flexfuel/calc/blend'&&m==='POST'){try{
   const b=await body(req);if(b.ethanol_pct==null)return j({error:'ethanol_pct required'},400);
   return j({ok:true,...calcBlendProperties(b.ethanol_pct)})}catch(e){return j({error:e.message},500)}}

 // Calculate injector requirement for ethanol conversion
 if(p==='/api/ecu/flexfuel/calc/injector'&&m==='POST'){try{
   const b=await body(req);
   if(!b.baseFuelFlow_cc_min)return j({error:'baseFuelFlow_cc_min required'},400);
   return j({ok:true,...calcInjectorRequirement(b.baseFuelFlow_cc_min,b.baseEthanol_pct||0,b.targetEthanol_pct||85)})}catch(e){return j({error:e.message},500)}}

 // Calculate fuel pump requirement
 if(p==='/api/ecu/flexfuel/calc/pump'&&m==='POST'){try{
   const b=await body(req);
   if(!b.basePumpFlow_lph)return j({error:'basePumpFlow_lph required'},400);
   return j({ok:true,...calcFuelPumpRequirement(b.basePumpFlow_lph,b.baseEthanol_pct||0,b.targetEthanol_pct||85)})}catch(e){return j({error:e.message},500)}}

 // Calculate timing advance for ethanol
 if(p==='/api/ecu/flexfuel/calc/timing'&&m==='POST'){try{
   const b=await body(req);
   if(b.baseTimingDeg==null)return j({error:'baseTimingDeg required'},400);
   return j({ok:true,...calcTimingAdvance(b.baseTimingDeg,b.baseEthanol_pct||0,b.targetEthanol_pct||85)})}catch(e){return j({error:e.message},500)}}

 // Calculate cold start enrichment
 if(p==='/api/ecu/flexfuel/calc/coldstart'&&m==='POST'){try{
   const b=await body(req);
   if(b.ethanol_pct==null)return j({error:'ethanol_pct required'},400);
   return j({ok:true,...calcColdStartEnrichment(b.ethanol_pct,b.ambientTemp_C!=null?b.ambientTemp_C:20)})}catch(e){return j({error:e.message},500)}}

 // Calibrate sensor from frequency (GM flex fuel sensor)
 if(p==='/api/ecu/flexfuel/calc/sensor-freq'&&m==='POST'){try{
   const b=await body(req);
   if(b.frequency_hz==null)return j({error:'frequency_hz required'},400);
   return j({ok:true,...calibrateSensorFrequency(b.frequency_hz)})}catch(e){return j({error:e.message},500)}}

 // Calibrate sensor from voltage
 if(p==='/api/ecu/flexfuel/calc/sensor-volt'&&m==='POST'){try{
   const b=await body(req);
   if(b.voltage==null)return j({error:'voltage required'},400);
   return j({ok:true,...calcSensorVoltage(b.voltage,b.sensorType||'linear_0_5v')})}catch(e){return j({error:e.message},500)}}

 // Full E85 conversion analysis
 if(p==='/api/ecu/flexfuel/calc/e85-conversion'&&m==='POST'){try{
   const b=await body(req);
   if(!b.vehicleHP)return j({error:'vehicleHP required'},400);
   if(!b.currentInjectorSize_cc)return j({error:'currentInjectorSize_cc required'},400);
   if(!b.currentPumpFlow_lph)return j({error:'currentPumpFlow_lph required'},400);
   if(b.currentTiming_deg==null)return j({error:'currentTiming_deg required'},400);
   return j({ok:true,...calcE85Conversion(b.vehicleHP,b.currentInjectorSize_cc,b.currentPumpFlow_lph,b.currentTiming_deg,b.currentEthanol_pct||0)})}catch(e){return j({error:e.message},500)}}

 // Flex fuel stats
 if(p==='/api/ecu/flexfuel/stats'&&m==='GET'){
   return j({ok:true,...flexfuelCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ECU Diagnostics & Health Monitor ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List all sensor ranges
 if(p==='/api/ecu/diagnostics/sensors'&&m==='GET'){
   return j({ok:true,sensors:listSensorRanges()})}

 // Get specific sensor range
 if(p.startsWith('/api/ecu/diagnostics/sensor/')&&m==='GET'){
   const key=p.split('/api/ecu/diagnostics/sensor/')[1];
   const s=getSensorRange(decodeURIComponent(key));
   if(!s)return j({error:'Sensor not found'},404);
   return j({ok:true,sensor:s})}

 // Validate a single sensor reading
 if(p==='/api/ecu/diagnostics/validate-sensor'&&m==='POST'){try{
   const b=await body(req);if(!b.sensor||b.value==null)return j({error:'sensor and value required'},400);
   return j({ok:true,...validateSensorReading(b.sensor,b.value)})}catch(e){return j({error:e.message},500)}}

 // Validate multiple sensors at once
 if(p==='/api/ecu/diagnostics/validate-multi'&&m==='POST'){try{
   const b=await body(req);if(!b.readings)return j({error:'readings object required'},400);
   return j({ok:true,...validateMultipleSensors(b.readings)})}catch(e){return j({error:e.message},500)}}

 // Diagnose from live readings
 if(p==='/api/ecu/diagnostics/diagnose'&&m==='POST'){try{
   const b=await body(req);if(!b.readings)return j({error:'readings object required'},400);
   return j({ok:true,...diagnoseFromReadings(b.readings)})}catch(e){return j({error:e.message},500)}}

 // Calculate engine health score
 if(p==='/api/ecu/diagnostics/health-score'&&m==='POST'){try{
   const b=await body(req);if(!b.readings)return j({error:'readings object required'},400);
   return j({ok:true,...calcEngineHealthScore(b.readings)})}catch(e){return j({error:e.message},500)}}

 // Analyze fuel trims
 if(p==='/api/ecu/diagnostics/fuel-trims'&&m==='POST'){try{
   const b=await body(req);if(b.stftB1==null||b.ltftB1==null)return j({error:'stftB1 and ltftB1 required'},400);
   return j({ok:true,...analyzeFuelTrims(b.stftB1,b.ltftB1,b.stftB2,b.ltftB2)})}catch(e){return j({error:e.message},500)}}

 // Interpret O2 sensor voltage
 if(p==='/api/ecu/diagnostics/o2-sensor'&&m==='POST'){try{
   const b=await body(req);if(b.voltage==null)return j({error:'voltage required'},400);
   return j({ok:true,...interpretO2Sensor(b.voltage,b.position||'upstream')})}catch(e){return j({error:e.message},500)}}

 // Generate maintenance schedule
 if(p==='/api/ecu/diagnostics/maintenance'&&m==='POST'){try{
   const b=await body(req);if(!b.mileage_km||!b.lastService_km)return j({error:'mileage_km and lastService_km required'},400);
   return j({ok:true,...generateMaintenanceSchedule(b.mileage_km,b.lastService_km,b.engineType||'gasoline',b.turbo||false)})}catch(e){return j({error:e.message},500)}}

 // List diagnostic patterns
 if(p==='/api/ecu/diagnostics/patterns'&&m==='GET'){
   return j({ok:true,patterns:listDiagnosticPatterns()})}

 // Get specific diagnostic pattern
 if(p.startsWith('/api/ecu/diagnostics/pattern/')&&m==='GET'){
   const key=p.split('/api/ecu/diagnostics/pattern/')[1];
   const pat=getDiagnosticPattern(decodeURIComponent(key));
   if(!pat)return j({error:'Pattern not found'},404);
   return j({ok:true,pattern:pat})}

 // Classify DTC severity
 if(p==='/api/ecu/diagnostics/classify-dtc'&&m==='POST'){try{
   const b=await body(req);if(!b.code)return j({error:'code required'},400);
   return j({ok:true,...classifyDTCSeverity(b.code)})}catch(e){return j({error:e.message},500)}}

 // Diagnostics stats
 if(p==='/api/ecu/diagnostics/stats'&&m==='GET'){
   return j({ok:true,...ecuDiagnosticsStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === Transmission & TCU Tuning Calculator ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List all transmission types
 if(p==='/api/ecu/tcu/transmissions'&&m==='GET'){
   const q=url.searchParams.get('q');
   return j({ok:true,transmissions:q?searchTransmissionTypes(q):listTransmissionTypes()})}

 // Get specific transmission
 if(p.startsWith('/api/ecu/tcu/transmission/')&&m==='GET'){
   const key=p.split('/api/ecu/tcu/transmission/')[1];
   const t=getTransmissionType(decodeURIComponent(key));
   if(!t)return j({error:'Transmission not found'},404);
   return j({ok:true,transmission:t})}

 // List torque converters
 if(p==='/api/ecu/tcu/converters'&&m==='GET'){
   return j({ok:true,converters:listTorqueConverters()})}

 // Get specific torque converter
 if(p.startsWith('/api/ecu/tcu/converter/')&&m==='GET'){
   const key=p.split('/api/ecu/tcu/converter/')[1];
   const tc=getTorqueConverter(decodeURIComponent(key));
   if(!tc)return j({error:'Converter not found'},404);
   return j({ok:true,converter:tc})}

 // List shift profiles
 if(p==='/api/ecu/tcu/profiles'&&m==='GET'){
   return j({ok:true,profiles:listShiftProfiles()})}

 // Get specific shift profile
 if(p.startsWith('/api/ecu/tcu/profile/')&&m==='GET'){
   const key=p.split('/api/ecu/tcu/profile/')[1];
   const pr=getShiftProfile(decodeURIComponent(key));
   if(!pr)return j({error:'Profile not found'},404);
   return j({ok:true,profile:pr})}

 // Calculate shift points
 if(p==='/api/ecu/tcu/shift-points'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission||!b.redline_rpm||!b.peakTorqueRPM)return j({error:'transmission, redline_rpm, peakTorqueRPM required'},400);
   return j({ok:true,...calcShiftPoints(b.transmission,b.redline_rpm,b.peakTorqueRPM,b.profile||'normal')})}catch(e){return j({error:e.message},500)}}

 // Calculate line pressure
 if(p==='/api/ecu/tcu/line-pressure'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission||!b.torque_nm||!b.gear)return j({error:'transmission, torque_nm, gear required'},400);
   return j({ok:true,...calcLinePressure(b.transmission,b.torque_nm,b.gear,b.safetyMargin)})}catch(e){return j({error:e.message},500)}}

 // Calculate torque converter slip
 if(p==='/api/ecu/tcu/converter-slip'&&m==='POST'){try{
   const b=await body(req);if(!b.converter||b.engineTorque_nm==null||!b.engineRPM||!b.turbineRPM)return j({error:'converter, engineTorque_nm, engineRPM, turbineRPM required'},400);
   return j({ok:true,...calcTorqueConverterSlip(b.converter,b.engineTorque_nm,b.engineRPM,b.turbineRPM)})}catch(e){return j({error:e.message},500)}}

 // Calculate launch control settings
 if(p==='/api/ecu/tcu/launch-control'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission||!b.redline_rpm||!b.vehicleWeight_kg)return j({error:'transmission, redline_rpm, vehicleWeight_kg required'},400);
   return j({ok:true,...calcLaunchControl(b.transmission,b.converter||null,b.redline_rpm,b.vehicleWeight_kg,b.tireGrip_g)})}catch(e){return j({error:e.message},500)}}

 // Optimize shift schedule from torque curve
 if(p==='/api/ecu/tcu/optimize-shifts'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission||!b.torqueCurve||!b.redline_rpm)return j({error:'transmission, torqueCurve (array of {rpm,torque_nm}), redline_rpm required'},400);
   return j({ok:true,...optimizeShiftSchedule(b.transmission,b.torqueCurve,b.redline_rpm)})}catch(e){return j({error:e.message},500)}}

 // Calculate clutch wear
 if(p==='/api/ecu/tcu/clutch-wear'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission||b.torque_nm==null||b.slipTime_s==null||b.slipRPM_delta==null)return j({error:'transmission, torque_nm, slipTime_s, slipRPM_delta required'},400);
   return j({ok:true,...calcClutchWear(b.transmission,b.torque_nm,b.slipTime_s,b.slipRPM_delta)})}catch(e){return j({error:e.message},500)}}

 // Recommend transmission fluid
 if(p==='/api/ecu/tcu/fluid'&&m==='POST'){try{
   const b=await body(req);if(!b.transmission)return j({error:'transmission required'},400);
   return j({ok:true,...recommendFluid(b.transmission)})}catch(e){return j({error:e.message},500)}}

 // TCU tuning stats
 if(p==='/api/ecu/tcu/stats'&&m==='GET'){
   return j({ok:true,...tcuTuningStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === Differential & Transfer Case Calculator ===
 // ═══════════════════════════════════════════════════════════════════════════

 // List diff types
 if(p==='/api/ecu/diff/types'&&m==='GET'){
   const q=url.searchParams.get('q');
   return j({ok:true,types:q?searchDiffTypes(q):listDiffTypes()})}

 // Get specific diff type
 if(p.startsWith('/api/ecu/diff/type/')&&m==='GET'){
   const key=p.split('/api/ecu/diff/type/')[1];
   const d=getDiffType(decodeURIComponent(key));
   if(!d)return j({error:'Diff type not found'},404);
   return j({ok:true,type:d})}

 // List diff ratios
 if(p==='/api/ecu/diff/ratios'&&m==='GET'){
   return j({ok:true,ratios:listDiffRatios()})}

 // Get specific ratio
 if(p.startsWith('/api/ecu/diff/ratio/')&&m==='GET'){
   const key=p.split('/api/ecu/diff/ratio/')[1];
   const r=getDiffRatio(decodeURIComponent(key));
   if(!r)return j({error:'Ratio not found'},404);
   return j({ok:true,ratio:r})}

 // List transfer cases
 if(p==='/api/ecu/diff/transfer-cases'&&m==='GET'){
   const q=url.searchParams.get('q');
   return j({ok:true,transferCases:q?searchTransferCases(q):listTransferCases()})}

 // Get specific transfer case
 if(p.startsWith('/api/ecu/diff/transfer-case/')&&m==='GET'){
   const key=p.split('/api/ecu/diff/transfer-case/')[1];
   const tc=getTransferCase(decodeURIComponent(key));
   if(!tc)return j({error:'Transfer case not found'},404);
   return j({ok:true,transferCase:tc})}

 // List diff fluids
 if(p==='/api/ecu/diff/fluids'&&m==='GET'){
   return j({ok:true,fluids:listDiffFluids()})}

 // Calculate crawl ratio
 if(p==='/api/ecu/diff/crawl-ratio'&&m==='POST'){try{
   const b=await body(req);if(!b.diffRatio||!b.transLowGear)return j({error:'diffRatio, transLowGear required'},400);
   return j({ok:true,...calcCrawlRatio(b.diffRatio,b.transLowGear,b.tcaseLowRatio)})}catch(e){return j({error:e.message},500)}}

 // Calculate speed at RPM
 if(p==='/api/ecu/diff/speed-at-rpm'&&m==='POST'){try{
   const b=await body(req);if(!b.diffRatio||!b.transGearRatio||!b.tireDiameter_in||!b.rpm)return j({error:'diffRatio, transGearRatio, tireDiameter_in, rpm required'},400);
   return j({ok:true,...calcDiffSpeed(b.diffRatio,b.transGearRatio,b.tireDiameter_in,b.rpm)})}catch(e){return j({error:e.message},500)}}

 // Calculate RPM at speed
 if(p==='/api/ecu/diff/rpm-at-speed'&&m==='POST'){try{
   const b=await body(req);if(!b.diffRatio||!b.transGearRatio||!b.tireDiameter_in||!b.speed_kph)return j({error:'diffRatio, transGearRatio, tireDiameter_in, speed_kph required'},400);
   return j({ok:true,...calcDiffRPM(b.diffRatio,b.transGearRatio,b.tireDiameter_in,b.speed_kph)})}catch(e){return j({error:e.message},500)}}

 // Calculate torque split
 if(p==='/api/ecu/diff/torque-split'&&m==='POST'){try{
   const b=await body(req);if(!b.diffType||b.inputTorque_nm==null)return j({error:'diffType, inputTorque_nm required'},400);
   return j({ok:true,...calcTorqueSplit(b.diffType,b.inputTorque_nm,b.leftGrip_pct,b.rightGrip_pct)})}catch(e){return j({error:e.message},500)}}

 // Calculate diff temperature
 if(p==='/api/ecu/diff/temp'&&m==='POST'){try{
   const b=await body(req);if(b.inputTorque_nm==null||b.slipRPM_delta==null||b.duration_s==null)return j({error:'inputTorque_nm, slipRPM_delta, duration_s required'},400);
   return j({ok:true,...calcDiffTemp(b.inputTorque_nm,b.slipRPM_delta,b.duration_s,b.oilVolume_l)})}catch(e){return j({error:e.message},500)}}

 // Recommend diff ratio for tire change
 if(p==='/api/ecu/diff/recommend-ratio'&&m==='POST'){try{
   const b=await body(req);if(!b.currentRatio||!b.currentTireDiam_in||!b.newTireDiam_in)return j({error:'currentRatio, currentTireDiam_in, newTireDiam_in required'},400);
   return j({ok:true,...recommendDiffRatio(b.currentRatio,b.currentTireDiam_in,b.newTireDiam_in)})}catch(e){return j({error:e.message},500)}}

 // Recommend diff fluid
 if(p==='/api/ecu/diff/recommend-fluid'&&m==='POST'){try{
   const b=await body(req);if(!b.diffType)return j({error:'diffType required'},400);
   return j({ok:true,...recDiffFluid(b.diffType,b.isLSD,b.heavyDuty)})}catch(e){return j({error:e.message},500)}}

 // Calculate transfer case gearing
 if(p==='/api/ecu/diff/tcase-gearing'&&m==='POST'){try{
   const b=await body(req);if(!b.transferCase||!b.diffRatio||!b.transLowGear)return j({error:'transferCase, diffRatio, transLowGear required'},400);
   return j({ok:true,...calcTransferCaseGearing(b.transferCase,b.diffRatio,b.transLowGear)})}catch(e){return j({error:e.message},500)}}

 // Differential stats
 if(p==='/api/ecu/diff/stats'&&m==='GET'){
   return j({ok:true,...differentialCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === SUSPENSION & ALIGNMENT CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Calculate spring rate
 if(p==='/api/ecu/suspension/spring-rate'&&m==='POST'){try{
   const b=await body(req);if(!b.vehicleWeight_kg)return j({error:'vehicleWeight_kg required'},400);
   return j({ok:true,...calcSpringRate(b.vehicleWeight_kg,b.wheelRate_pct||60,b.naturalFreq_hz||1.5)})}catch(e){return j({error:e.message},500)}}

 // Calculate damper ratio
 if(p==='/api/ecu/suspension/damper-ratio'&&m==='POST'){try{
   const b=await body(req);if(!b.springRate_n_m||!b.cornerWeight_kg)return j({error:'springRate_n_m, cornerWeight_kg required'},400);
   return j({ok:true,...calcDamperRatio(b.springRate_n_m,b.cornerWeight_kg,b.targetRatio||0.3)})}catch(e){return j({error:e.message},500)}}

 // Calculate ride height
 if(p==='/api/ecu/suspension/ride-height'&&m==='POST'){try{
   const b=await body(req);if(!b.springRate_n_m||!b.cornerWeight_kg||!b.springFreeLength_mm)return j({error:'springRate_n_m, cornerWeight_kg, springFreeLength_mm required'},400);
   return j({ok:true,...calcRideHeight(b.springRate_n_m,b.cornerWeight_kg,b.springFreeLength_mm,b.desiredDrop_mm||0)})}catch(e){return j({error:e.message},500)}}

 // Calculate sway bar effect
 if(p==='/api/ecu/suspension/sway-bar'&&m==='POST'){try{
   const b=await body(req);if(!b.frontBar_mm||!b.rearBar_mm||!b.vehicleWeight_kg)return j({error:'frontBar_mm, rearBar_mm, vehicleWeight_kg required'},400);
   return j({ok:true,...calcSwayBarEffect(b.frontBar_mm,b.rearBar_mm,b.vehicleWeight_kg,b.cg_height_mm||500,b.trackWidth_mm||1500)})}catch(e){return j({error:e.message},500)}}

 // Corner weight balance
 if(p==='/api/ecu/suspension/corner-weight'&&m==='POST'){try{
   const b=await body(req);if(!b.fl_kg||!b.fr_kg||!b.rl_kg||!b.rr_kg)return j({error:'fl_kg, fr_kg, rl_kg, rr_kg required'},400);
   return j({ok:true,...calcCornerWeight(b.fl_kg,b.fr_kg,b.rl_kg,b.rr_kg)})}catch(e){return j({error:e.message},500)}}

 // Bump steer analysis
 if(p==='/api/ecu/suspension/bump-steer'&&m==='POST'){try{
   const b=await body(req);if(!b.steeringRackHeight_mm||!b.tieRodLength_mm||!b.suspTravel_mm)return j({error:'steeringRackHeight_mm, tieRodLength_mm, suspTravel_mm required'},400);
   return j({ok:true,...calcBumpSteer(b.steeringRackHeight_mm,b.tieRodLength_mm,b.suspTravel_mm)})}catch(e){return j({error:e.message},500)}}

 // Anti-squat geometry
 if(p==='/api/ecu/suspension/anti-squat'&&m==='POST'){try{
   const b=await body(req);if(!b.pivotHeight_mm||!b.wheelbase_mm||!b.cg_height_mm)return j({error:'pivotHeight_mm, wheelbase_mm, cg_height_mm required'},400);
   return j({ok:true,...calcAntiSquat(b.pivotHeight_mm,b.wheelbase_mm,b.cg_height_mm,b.driveType||'rwd')})}catch(e){return j({error:e.message},500)}}

 // Alignment recommendation
 if(p==='/api/ecu/suspension/alignment'&&m==='GET'){
   const use=u.searchParams.get('use')||'street_neutral';
   return j({ok:true,...recommendAlignment(use)})}

 // List spring types
 if(p==='/api/ecu/suspension/springs'&&m==='GET'){return j({ok:true,springs:listSpringTypes()})}

 // Get spring type
 if(p.startsWith('/api/ecu/suspension/springs/')&&m==='GET'){
   const key=p.split('/').pop();const s=getSpringType(key);
   return s?j({ok:true,...s}):j({error:'Spring type not found'},404)}

 // List damper types
 if(p==='/api/ecu/suspension/dampers'&&m==='GET'){
   const q=u.searchParams.get('q');
   return j({ok:true,dampers:q?searchDamperTypes(q):listDamperTypes()})}

 // Get damper type
 if(p.startsWith('/api/ecu/suspension/dampers/')&&m==='GET'){
   const key=p.split('/').pop();const d=getDamperType(key);
   return d?j({ok:true,...d}):j({error:'Damper type not found'},404)}

 // List sway bar sizes
 if(p==='/api/ecu/suspension/sway-bars'&&m==='GET'){return j({ok:true,swayBars:listSwayBarSizes()})}

 // List alignment specs
 if(p==='/api/ecu/suspension/alignment-specs'&&m==='GET'){return j({ok:true,specs:listAlignmentSpecs()})}

 // Get alignment spec
 if(p.startsWith('/api/ecu/suspension/alignment-specs/')&&m==='GET'){
   const key=p.split('/').pop();const a=getAlignmentSpec(key);
   return a?j({ok:true,...a}):j({error:'Alignment spec not found'},404)}

 // Suspension stats
 if(p==='/api/ecu/suspension/stats'&&m==='GET'){
   return j({ok:true,...suspensionCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === BRAKE SYSTEM CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Calculate brake force
 if(p==='/api/ecu/brake/force'&&m==='POST'){try{
   const b=await body(req);if(!b.pedalForce_n||!b.boosterRatio||!b.masterBore_mm||!b.caliperBore_mm||!b.caliperPistons||!b.padMu||!b.effectiveRadius_mm)return j({error:'pedalForce_n, boosterRatio, masterBore_mm, caliperBore_mm, caliperPistons, padMu, effectiveRadius_mm required'},400);
   return j({ok:true,...calcBrakeForce(b.pedalForce_n,b.boosterRatio,b.masterBore_mm,b.caliperBore_mm,b.caliperPistons,b.padMu,b.effectiveRadius_mm)})}catch(e){return j({error:e.message},500)}}

 // Stopping distance
 if(p==='/api/ecu/brake/stopping-distance'&&m==='POST'){try{
   const b=await body(req);if(!b.speed_kmh||!b.vehicleWeight_kg||!b.totalBrakeForce_n)return j({error:'speed_kmh, vehicleWeight_kg, totalBrakeForce_n required'},400);
   return j({ok:true,...calcStoppingDistance(b.speed_kmh,b.vehicleWeight_kg,b.totalBrakeForce_n,b.tireGrip_mu||1.0,b.tireRadius_mm||310)})}catch(e){return j({error:e.message},500)}}

 // Brake bias
 if(p==='/api/ecu/brake/bias'&&m==='POST'){try{
   const b=await body(req);if(!b.frontBrakeForce_n||!b.rearBrakeForce_n||!b.vehicleWeight_kg)return j({error:'frontBrakeForce_n, rearBrakeForce_n, vehicleWeight_kg required'},400);
   return j({ok:true,...calcBrakeBias(b.frontBrakeForce_n,b.rearBrakeForce_n,b.vehicleWeight_kg,b.frontWeightPct||60)})}catch(e){return j({error:e.message},500)}}

 // Rotor temperature
 if(p==='/api/ecu/brake/rotor-temp'&&m==='POST'){try{
   const b=await body(req);if(!b.kineticEnergy_j||!b.rotorMass_kg)return j({error:'kineticEnergy_j, rotorMass_kg required'},400);
   return j({ok:true,...calcRotorTemp(b.kineticEnergy_j,b.rotorMass_kg,b.rotorMaterial||'cast_iron')})}catch(e){return j({error:e.message},500)}}

 // Kinetic energy
 if(p==='/api/ecu/brake/kinetic-energy'&&m==='POST'){try{
   const b=await body(req);if(!b.vehicleWeight_kg||!b.speed_kmh)return j({error:'vehicleWeight_kg, speed_kmh required'},400);
   return j({ok:true,...calcKineticEnergy(b.vehicleWeight_kg,b.speed_kmh)})}catch(e){return j({error:e.message},500)}}

 // Pedal ratio
 if(p==='/api/ecu/brake/pedal-ratio'&&m==='POST'){try{
   const b=await body(req);if(!b.pedalLength_mm||!b.pivotToMaster_mm)return j({error:'pedalLength_mm, pivotToMaster_mm required'},400);
   return j({ok:true,...calcPedalRatio(b.pedalLength_mm,b.pivotToMaster_mm)})}catch(e){return j({error:e.message},500)}}

 // Brake line volume
 if(p==='/api/ecu/brake/line-volume'&&m==='POST'){try{
   const b=await body(req);if(!b.caliper_bore_mm||!b.caliper_pistons||!b.masterBore_mm)return j({error:'caliper_bore_mm, caliper_pistons, masterBore_mm required'},400);
   return j({ok:true,...calcBrakeLineLength(b.caliper_bore_mm,b.caliper_pistons,b.masterBore_mm)})}catch(e){return j({error:e.message},500)}}

 // Recommend brake fluid
 if(p==='/api/ecu/brake/recommend-fluid'&&m==='GET'){
   const temp=parseInt(u.searchParams.get('maxRotorTemp_c')||'400');
   return j({ok:true,...recommendBrakeFluid(temp)})}

 // Pad compounds
 if(p==='/api/ecu/brake/pads'&&m==='GET'){
   const q=u.searchParams.get('q');
   return j({ok:true,pads:q?searchPadCompounds(q):listPadCompounds()})}

 // Get pad compound
 if(p.startsWith('/api/ecu/brake/pads/')&&m==='GET'){
   const key=p.split('/').pop();const pad=getPadCompound(key);
   return pad?j({ok:true,...pad}):j({error:'Pad compound not found'},404)}

 // Rotor types
 if(p==='/api/ecu/brake/rotors'&&m==='GET'){return j({ok:true,rotors:listRotorTypes()})}

 // Get rotor type
 if(p.startsWith('/api/ecu/brake/rotors/')&&m==='GET'){
   const key=p.split('/').pop();const r=getRotorType(key);
   return r?j({ok:true,...r}):j({error:'Rotor type not found'},404)}

 // Brake fluids
 if(p==='/api/ecu/brake/fluids'&&m==='GET'){return j({ok:true,fluids:listBrakeFluids()})}

 // Get brake fluid
 if(p.startsWith('/api/ecu/brake/fluids/')&&m==='GET'){
   const key=p.split('/').pop();const f=getBrakeFluid(key);
   return f?j({ok:true,...f}):j({error:'Brake fluid not found'},404)}

 // Caliper types
 if(p==='/api/ecu/brake/calipers'&&m==='GET'){return j({ok:true,calipers:listCaliperTypes()})}

 // Get caliper type
 if(p.startsWith('/api/ecu/brake/calipers/')&&m==='GET'){
   const key=p.split('/').pop();const c=getCaliperType(key);
   return c?j({ok:true,...c}):j({error:'Caliper type not found'},404)}

 // Brake stats
 if(p==='/api/ecu/brake/stats'&&m==='GET'){
   return j({ok:true,...brakeCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === WHEEL & TIRE FITMENT CALCULATOR ===
 // ═══════════════════════════════════════════════════════════════════════════

 // Tire diameter calc
 if(p==='/api/ecu/wheel/tire-diameter'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcTireDiameter(d.width_mm||225,d.aspect_ratio||45,d.wheel_diameter_in||18)})}

 // Compare tire sizes
 if(p==='/api/ecu/wheel/compare-tires'&&m==='POST'){const d=await body(r);
   return j({ok:true,...compareTireSizes(d.stock_width||225,d.stock_aspect||45,d.stock_wheel||17,d.new_width||235,d.new_aspect||40,d.new_wheel||18)})}

 // Wheel offset calc
 if(p==='/api/ecu/wheel/offset'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcOffset(d.wheel_width_in||8,d.et_mm||35)})}

 // Compare offsets
 if(p==='/api/ecu/wheel/compare-offsets'&&m==='POST'){const d=await body(r);
   return j({ok:true,...compareOffsets(d.stock_width_in||7,d.stock_et_mm||45,d.new_width_in||8.5,d.new_et_mm||35)})}

 // Speedometer correction
 if(p==='/api/ecu/wheel/speedo-correction'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcSpeedoCorrection(d.stock_diameter_mm||634,d.new_diameter_mm||650)})}

 // Load index lookup
 if(p==='/api/ecu/wheel/load-index'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcLoadIndex(d.load_index||91)})}

 // Speed rating lookup
 if(p==='/api/ecu/wheel/speed-rating'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcSpeedRating(d.rating||'V')})}

 // Stretch fit check
 if(p==='/api/ecu/wheel/stretch-fit'&&m==='POST'){const d=await body(r);
   return j({ok:true,...calcStretchFit(d.tire_width_mm||205,d.wheel_width_in||9)})}

 // Bolt pattern list
 if(p==='/api/ecu/wheel/bolt-patterns'&&m==='GET'){
   return j({ok:true,boltPatterns:listBoltPatterns()})}

 // Bolt pattern get
 if(p.startsWith('/api/ecu/wheel/bolt-patterns/')&&m==='GET'){const k=decodeURIComponent(p.split('/').pop());
   const b=getBoltPattern(k);
   return b?j({ok:true,...b}):j({error:'Bolt pattern not found'},404)}

 // Bolt pattern search
 if(p==='/api/ecu/wheel/bolt-patterns/search'&&m==='POST'){const d=await body(r);
   return j({ok:true,results:searchBoltPatterns(d.q||'')})}

 // Tire types list
 if(p==='/api/ecu/wheel/tire-types'&&m==='GET'){
   return j({ok:true,tireTypes:listTireTypes()})}

 // Tire type get
 if(p.startsWith('/api/ecu/wheel/tire-types/')&&m==='GET'){const k=decodeURIComponent(p.split('/').pop());
   const t=getTireType(k);
   return t?j({ok:true,...t}):j({error:'Tire type not found'},404)}

 // Wheel-tire stats
 if(p==='/api/ecu/wheel/stats'&&m==='GET'){
   return j({ok:true,...wheelTireCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === AERODYNAMICS CALCULATOR — Aerodinamik hesaplama motoru ===
 // ═══════════════════════════════════════════════════════════════════════════

 // -- Drag Profiles --
 if(p==='/api/ecu/aero/profiles'&&m==='GET'){
   const q=u.searchParams.get('q');
   return j({ok:true,profiles:q?searchDragProfiles(q):listDragProfiles()})}

 if(p.startsWith('/api/ecu/aero/profiles/')&&m==='GET'){
   const key=p.split('/').pop();const d=getDragProfile(key);
   return d?j({ok:true,...d}):j({ok:false,error:'Profile not found',available:Object.keys(DRAG_PROFILES)},404)}

 // -- Wing Profiles --
 if(p==='/api/ecu/aero/wings'&&m==='GET'){
   return j({ok:true,profiles:listWingProfiles()})}

 if(p.startsWith('/api/ecu/aero/wings/')&&m==='GET'){
   const key=p.split('/').pop();const w=getWingProfile(key);
   return w?j({ok:true,...w}):j({ok:false,error:'Wing profile not found',available:Object.keys(WING_PROFILES)},404)}

 // -- Drag Force Calculator --
 if(p==='/api/ecu/aero/drag'&&m==='POST'){
   const b=await body(request);
   if(!b.cd||!b.frontalArea_m2||!b.speed_kmh)return j({ok:false,error:'cd, frontalArea_m2, speed_kmh required'},400);
   return j({ok:true,...calcDragForce(b.cd,b.frontalArea_m2,b.speed_kmh,b.airDensity)})}

 if(p==='/api/ecu/aero/drag/profile'&&m==='POST'){
   const b=await body(request);
   if(!b.profile||!b.speed_kmh)return j({ok:false,error:'profile (key), speed_kmh required'},400);
   const d=getDragProfile(b.profile);
   if(!d)return j({ok:false,error:'Profile not found',available:Object.keys(DRAG_PROFILES)},404);
   return j({ok:true,profile:d,...calcDragForce(d.cd,d.frontalArea_m2,b.speed_kmh,b.airDensity)})}

 // -- Top Speed Estimator --
 if(p==='/api/ecu/aero/topspeed'&&m==='POST'){
   const b=await body(request);
   if(!b.power_hp||!b.cd||!b.frontalArea_m2)return j({ok:false,error:'power_hp, cd, frontalArea_m2 required'},400);
   return j({ok:true,...calcTopSpeed(b.power_hp,b.cd,b.frontalArea_m2,b.rollingResistance,b.vehicleWeight_kg,b.airDensity)})}

 if(p==='/api/ecu/aero/topspeed/profile'&&m==='POST'){
   const b=await body(request);
   if(!b.power_hp||!b.profile)return j({ok:false,error:'power_hp, profile (key) required'},400);
   const d=getDragProfile(b.profile);
   if(!d)return j({ok:false,error:'Profile not found',available:Object.keys(DRAG_PROFILES)},404);
   return j({ok:true,profile:d,...calcTopSpeed(b.power_hp,d.cd,d.frontalArea_m2,b.rollingResistance,b.vehicleWeight_kg,b.airDensity)})}

 // -- Downforce Calculator --
 if(p==='/api/ecu/aero/downforce'&&m==='POST'){
   const b=await body(request);
   if(!b.wing||!b.speed_kmh)return j({ok:false,error:'wing (profile key), speed_kmh required'},400);
   return j({ok:true,...calcDownforce(b.wing,b.speed_kmh,b.frontalArea_m2,b.airDensity)})}

 // -- Aero Balance --
 if(p==='/api/ecu/aero/balance'&&m==='POST'){
   const b=await body(request);
   if(b.frontDownforce_n==null||b.rearDownforce_n==null||!b.vehicleWeight_kg)return j({ok:false,error:'frontDownforce_n, rearDownforce_n, vehicleWeight_kg required'},400);
   return j({ok:true,...calcAeroBalance(b.frontDownforce_n,b.rearDownforce_n,b.vehicleWeight_kg,b.frontWeightPct)})}

 // -- Speed Effect Curve --
 if(p==='/api/ecu/aero/speed-effect'&&m==='POST'){
   const b=await body(request);
   if(!b.cd||!b.frontalArea_m2)return j({ok:false,error:'cd, frontalArea_m2 required'},400);
   return j({ok:true,...calcSpeedEffect(b.cd,b.frontalArea_m2,b.vehicleWeight_kg,b.airDensity)})}

 if(p==='/api/ecu/aero/speed-effect/profile'&&m==='POST'){
   const b=await body(request);
   if(!b.profile)return j({ok:false,error:'profile (key) required'},400);
   const d=getDragProfile(b.profile);
   if(!d)return j({ok:false,error:'Profile not found',available:Object.keys(DRAG_PROFILES)},404);
   return j({ok:true,profile:d,...calcSpeedEffect(d.cd,d.frontalArea_m2,b.vehicleWeight_kg,b.airDensity)})}

 // -- Altitude Effect --
 if(p==='/api/ecu/aero/altitude'&&m==='POST'){
   const b=await body(request);
   if(!b.altitude_m||!b.cd||!b.frontalArea_m2||!b.speed_kmh)return j({ok:false,error:'altitude_m, cd, frontalArea_m2, speed_kmh required'},400);
   return j({ok:true,...calcAltitudeEffect(b.altitude_m,b.cd,b.frontalArea_m2,b.speed_kmh)})}

 // -- Coast-Down Cd Estimator --
 if(p==='/api/ecu/aero/coastdown'&&m==='POST'){
   const b=await body(request);
   if(!b.speed1_kmh||!b.speed2_kmh||!b.time_s||!b.vehicleWeight_kg||!b.frontalArea_m2)return j({ok:false,error:'speed1_kmh, speed2_kmh, time_s, vehicleWeight_kg, frontalArea_m2 required'},400);
   return j({ok:true,...calcCdFromCoasting(b.speed1_kmh,b.speed2_kmh,b.time_s,b.vehicleWeight_kg,b.frontalArea_m2,b.gradient_pct)})}

 // -- Full Aero Analysis (compound) --
 if(p==='/api/ecu/aero/analyze'&&m==='POST'){
   const b=await body(request);
   if(!b.profile||!b.speed_kmh||!b.power_hp)return j({ok:false,error:'profile, speed_kmh, power_hp required'},400);
   const d=getDragProfile(b.profile);
   if(!d)return j({ok:false,error:'Profile not found'},404);
   const drag=calcDragForce(d.cd,d.frontalArea_m2,b.speed_kmh,b.airDensity);
   const topSpd=calcTopSpeed(b.power_hp,d.cd,d.frontalArea_m2,b.rollingResistance,b.vehicleWeight_kg,b.airDensity);
   const speedCurve=calcSpeedEffect(d.cd,d.frontalArea_m2,b.vehicleWeight_kg,b.airDensity);
   const wings=b.wings?b.wings.map(w=>({wing:w,...calcDownforce(w,b.speed_kmh,d.frontalArea_m2,b.airDensity)})):[];
   return j({ok:true,profile:d,atSpeed:drag,topSpeed:topSpd,speedCurve,wingAnalysis:wings})}

 // -- Aero Stats --
 if(p==='/api/ecu/aero/stats'&&m==='GET'){
   return j({ok:true,...aeroCalcStats()})}

 // ===================== WEIGHT DISTRIBUTION & LOAD TRANSFER CALCULATOR =====================

 // -- Weight Classes --
 if(p==='/api/ecu/weight/classes'&&m==='GET'){
   const q=new URL(req.url).searchParams.get('q');
   return j({ok:true,classes:q?searchWeightClasses(q):listWeightClasses()})}

 if(p.match(/^\/api\/ecu\/weight\/classes\/[^/]+$/)&&m==='GET'){
   const k=p.split('/').pop();
   const c=getWeightClass(k);
   if(!c)return j({ok:false,error:'Weight class not found'},404);
   return j({ok:true,...c})}

 // -- Layout Types --
 if(p==='/api/ecu/weight/layouts'&&m==='GET'){
   return j({ok:true,layouts:listLayoutTypes()})}

 if(p.match(/^\/api\/ecu\/weight\/layouts\/[^/]+$/)&&m==='GET'){
   const k=p.split('/').pop();
   const l=getLayoutType(k);
   if(!l)return j({ok:false,error:'Layout type not found'},404);
   return j({ok:true,...l})}

 // -- Longitudinal Transfer --
 if(p==='/api/ecu/weight/longitudinal'&&m==='POST'){
   const b=await body(request);
   if(!b.vehicleWeight_kg||!b.wheelbase_mm||!b.cgHeight_mm||!b.accel_g)return j({ok:false,error:'vehicleWeight_kg, wheelbase_mm, cgHeight_mm, accel_g required'},400);
   return j({ok:true,...calcLongitudinalTransfer(b.vehicleWeight_kg,b.wheelbase_mm,b.cgHeight_mm,b.accel_g)})}

 // -- Lateral Transfer --
 if(p==='/api/ecu/weight/lateral'&&m==='POST'){
   const b=await body(request);
   if(!b.vehicleWeight_kg||!b.trackWidth_mm||!b.cgHeight_mm||!b.lateral_g)return j({ok:false,error:'vehicleWeight_kg, trackWidth_mm, cgHeight_mm, lateral_g required'},400);
   return j({ok:true,...calcLateralTransfer(b.vehicleWeight_kg,b.trackWidth_mm,b.cgHeight_mm,b.lateral_g)})}

 // -- Estimate CG Height --
 if(p==='/api/ecu/weight/cg-height'&&m==='POST'){
   const b=await body(request);
   if(!b.vehicleWeight_kg||!b.wheelbase_mm||!b.frontAxleWeight_rear_lifted_kg||!b.liftHeight_mm)return j({ok:false,error:'vehicleWeight_kg, wheelbase_mm, frontAxleWeight_rear_lifted_kg, liftHeight_mm required'},400);
   return j({ok:true,...estimateCGHeight(b.vehicleWeight_kg,b.wheelbase_mm,b.frontAxleWeight_rear_lifted_kg,b.liftHeight_mm)})}

 // -- Distribution Analysis --
 if(p==='/api/ecu/weight/distribution'&&m==='POST'){
   const b=await body(request);
   if(!b.frontWeight_kg||!b.rearWeight_kg||!b.layout)return j({ok:false,error:'frontWeight_kg, rearWeight_kg, layout required'},400);
   return j({ok:true,...analyzeDistribution(b.frontWeight_kg,b.rearWeight_kg,b.layout,b.wheelbase_mm)})}

 // -- Ballast Calculator --
 if(p==='/api/ecu/weight/ballast'&&m==='POST'){
   const b=await body(request);
   if(!b.currentFront_kg||!b.currentRear_kg||!b.targetFrontPct)return j({ok:false,error:'currentFront_kg, currentRear_kg, targetFrontPct required'},400);
   return j({ok:true,...calcBallast(b.currentFront_kg,b.currentRear_kg,b.targetFrontPct,b.maxBallast_kg)})}

 // -- Payload Effect --
 if(p==='/api/ecu/weight/payload'&&m==='POST'){
   const b=await body(request);
   if(!b.vehicleWeight_kg||!b.frontPct||!b.payloadWeight_kg||b.payloadPosition_pct_from_front==null)return j({ok:false,error:'vehicleWeight_kg, frontPct, payloadWeight_kg, payloadPosition_pct_from_front required'},400);
   return j({ok:true,...calcPayloadEffect(b.vehicleWeight_kg,b.frontPct,b.payloadWeight_kg,b.payloadPosition_pct_from_front)})}

 // -- Power-to-Weight --
 if(p==='/api/ecu/weight/power-to-weight'&&m==='POST'){
   const b=await body(request);
   if(!b.power_hp||!b.vehicleWeight_kg)return j({ok:false,error:'power_hp, vehicleWeight_kg required'},400);
   return j({ok:true,...calcPowerToWeight(b.power_hp,b.vehicleWeight_kg,b.driverWeight_kg)})}

 // -- Weight Reduction Analysis --
 if(p==='/api/ecu/weight/reduction'&&m==='POST'){
   const b=await body(request);
   if(!b.vehicleWeight_kg||!b.power_hp||!b.reductions)return j({ok:false,error:'vehicleWeight_kg, power_hp, reductions[] required'},400);
   return j({ok:true,...analyzeWeightReduction(b.vehicleWeight_kg,b.power_hp,b.reductions)})}

 // -- Full Weight Analysis (compound) --
 if(p==='/api/ecu/weight/analyze'&&m==='POST'){
   const b=await body(request);
   if(!b.frontWeight_kg||!b.rearWeight_kg||!b.layout||!b.power_hp)return j({ok:false,error:'frontWeight_kg, rearWeight_kg, layout, power_hp required'},400);
   const dist=analyzeDistribution(b.frontWeight_kg,b.rearWeight_kg,b.layout,b.wheelbase_mm);
   const ptw=calcPowerToWeight(b.power_hp,b.frontWeight_kg+b.rearWeight_kg,b.driverWeight_kg);
   const longT=b.wheelbase_mm&&b.cgHeight_mm?calcLongitudinalTransfer(b.frontWeight_kg+b.rearWeight_kg,b.wheelbase_mm,b.cgHeight_mm,b.accel_g||0.5):null;
   const latT=b.trackWidth_mm&&b.cgHeight_mm?calcLateralTransfer(b.frontWeight_kg+b.rearWeight_kg,b.trackWidth_mm,b.cgHeight_mm,b.lateral_g||0.8):null;
   const payload=b.payloadWeight_kg?calcPayloadEffect(b.frontWeight_kg+b.rearWeight_kg,dist.frontPct,b.payloadWeight_kg,b.payloadPosition_pct_from_front||50):null;
   const reduction=b.reductions?analyzeWeightReduction(b.frontWeight_kg+b.rearWeight_kg,b.power_hp,b.reductions):null;
   return j({ok:true,distribution:dist,powerToWeight:ptw,longitudinalTransfer:longT,lateralTransfer:latT,payloadEffect:payload,weightReduction:reduction})}

 // -- Weight Stats --
 if(p==='/api/ecu/weight/stats'&&m==='GET'){
   return j({ok:true,...weightDistCalcStats()})}

 // ===================== INTERCOOLER & CHARGE AIR SYSTEM CALCULATOR =====================

 // -- Intercooler Types DB --
 if(p==='/api/ecu/intercooler/types'&&m==='GET'){return j({ok:true,types:listIntercoolerTypes()})}
 if(p.match(/^\/api\/ecu\/intercooler\/types\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const t=getIntercoolerType(id);return t?j({ok:true,type:t}):j({error:'TYPE_NOT_FOUND'},404)}

 // -- Core Sizes DB --
 if(p==='/api/ecu/intercooler/core-sizes'&&m==='GET'){return j({ok:true,coreSizes:listCoreSizes()})}
 if(p.match(/^\/api\/ecu\/intercooler\/core-sizes\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const c=getCoreSize(id);return c?j({ok:true,coreSize:c}):j({error:'SIZE_NOT_FOUND'},404)}

 // -- Piping Materials DB --
 if(p==='/api/ecu/intercooler/piping-materials'&&m==='GET'){return j({ok:true,materials:listPipingMaterials()})}
 if(p.match(/^\/api\/ecu\/intercooler\/piping-materials\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const pm=getPipingMaterial(id);return pm?j({ok:true,material:pm}):j({error:'MATERIAL_NOT_FOUND'},404)}

 // -- Compressor Outlet Temp --
 if(p==='/api/ecu/intercooler/compressor-outlet-temp'&&m==='POST'){
   const b=await body(req);
   if(!b.ambientTemp_C||!b.pressureRatio)return j({error:'MISSING_PARAMS: ambientTemp_C, pressureRatio'},400);
   return j({ok:true,...calcCompressorOutletTemp(b.ambientTemp_C,b.pressureRatio,b.compressorEfficiency)})}

 // -- Intercooler Efficiency --
 if(p==='/api/ecu/intercooler/efficiency'&&m==='POST'){
   const b=await body(req);
   if(!b.inletTemp_C||!b.outletTemp_C||!b.ambientTemp_C)return j({error:'MISSING_PARAMS: inletTemp_C, outletTemp_C, ambientTemp_C'},400);
   return j({ok:true,...calcIntercoolerEfficiency(b.inletTemp_C,b.outletTemp_C,b.ambientTemp_C)})}

 // -- Size Intercooler Core --
 if(p==='/api/ecu/intercooler/size-core'&&m==='POST'){
   const b=await body(req);
   if(!b.power_hp||!b.boost_psi)return j({error:'MISSING_PARAMS: power_hp, boost_psi'},400);
   return j({ok:true,...sizeIntercoolerCore(b.power_hp,b.boost_psi,b.ambientTemp_C,b.type)})}

 // -- Pressure Drop --
 if(p==='/api/ecu/intercooler/pressure-drop'&&m==='POST'){
   const b=await body(req);
   if(!b.boost_psi||!b.flowRate_cfm)return j({error:'MISSING_PARAMS: boost_psi, flowRate_cfm'},400);
   return j({ok:true,...calcPressureDrop(b.boost_psi,b.flowRate_cfm,b.coreDepth_mm,b.pipeDiameter_mm)})}

 // -- Water-to-Air IC Sizing --
 if(p==='/api/ecu/intercooler/water-to-air'&&m==='POST'){
   const b=await body(req);
   if(!b.power_hp||!b.boost_psi)return j({error:'MISSING_PARAMS: power_hp, boost_psi'},400);
   return j({ok:true,...sizeWaterToAir(b.power_hp,b.boost_psi,b.ambientTemp_C,b.waterTemp_C)})}

 // -- Piping Diameter Recommendation --
 if(p==='/api/ecu/intercooler/piping-diameter'&&m==='POST'){
   const b=await body(req);
   if(!b.power_hp||!b.boost_psi)return j({error:'MISSING_PARAMS: power_hp, boost_psi'},400);
   return j({ok:true,...recommendPipingDiameter(b.power_hp,b.boost_psi)})}

 // -- Water/Meth Injection --
 if(p==='/api/ecu/intercooler/water-injection'&&m==='POST'){
   const b=await body(req);
   if(!b.power_hp||!b.boost_psi)return j({error:'MISSING_PARAMS: power_hp, boost_psi'},400);
   return j({ok:true,...calcWaterInjection(b.power_hp,b.boost_psi,b.ambientTemp_C)})}

 // -- Heat Soak Analysis --
 if(p==='/api/ecu/intercooler/heat-soak'&&m==='POST'){
   const b=await body(req);
   if(!b.intercoolerType||!b.ambientTemp_C||!b.boostPressure_psi)return j({error:'MISSING_PARAMS: intercoolerType, ambientTemp_C, boostPressure_psi'},400);
   return j({ok:true,...analyzeHeatSoak(b.intercoolerType,b.ambientTemp_C,b.boostPressure_psi,b.idleTime_min)})}

 // -- Intercooler Stats --
 if(p==='/api/ecu/intercooler/stats'&&m==='GET'){
   return j({ok:true,...intercoolerCalcStats()})}

 // ===================== AUTOMOTIVE ELECTRICAL SYSTEM CALCULATOR =====================

 // -- Wire Gauges DB --
 if(p==='/api/ecu/electrical/wire-gauges'&&m==='GET'){return j({ok:true,gauges:listWireGauges()})}
 if(p.match(/^\/api\/ecu\/electrical\/wire-gauges\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const w=getWireGauge(id);return w?j({ok:true,gauge:w}):j({error:'GAUGE_NOT_FOUND'},404)}

 // -- Battery Types DB --
 if(p==='/api/ecu/electrical/battery-types'&&m==='GET'){return j({ok:true,batteryTypes:listBatteryTypes()})}
 if(p.match(/^\/api\/ecu\/electrical\/battery-types\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const bt=getBatteryType(id);return bt?j({ok:true,batteryType:bt}):j({error:'BATTERY_TYPE_NOT_FOUND'},404)}

 // -- Common Loads DB --
 if(p==='/api/ecu/electrical/common-loads'&&m==='GET'){return j({ok:true,loads:listCommonLoads()})}
 if(p.match(/^\/api\/ecu\/electrical\/common-loads\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const l=getCommonLoad(id);return l?j({ok:true,load:l}):j({error:'LOAD_NOT_FOUND'},404)}

 // -- Search Common Loads --
 if(p==='/api/ecu/electrical/common-loads/search'&&m==='GET'){
   const u=new URL(req.url);const q=u.searchParams.get('q')||'';
   return j({ok:true,results:searchCommonLoads(q)})}

 // -- Voltage Drop --
 if(p==='/api/ecu/electrical/voltage-drop'&&m==='POST'){
   const b=await body(req);
   if(!b.current_A||!b.wireLength_m||!b.gaugeAWG)return j({error:'MISSING_PARAMS: current_A, wireLength_m, gaugeAWG'},400);
   return j({ok:true,...calcVoltageDrop(b.current_A,b.wireLength_m,b.gaugeAWG,b.systemVoltage)})}

 // -- Wire Gauge Recommendation --
 if(p==='/api/ecu/electrical/recommend-gauge'&&m==='POST'){
   const b=await body(req);
   if(!b.current_A||!b.wireLength_m)return j({error:'MISSING_PARAMS: current_A, wireLength_m'},400);
   return j({ok:true,...recommendWireGauge(b.current_A,b.wireLength_m,b.maxDropPercent,b.environment)})}

 // -- Alternator Sizing --
 if(p==='/api/ecu/electrical/size-alternator'&&m==='POST'){
   const b=await body(req);
   if(!b.loads||!Array.isArray(b.loads))return j({error:'MISSING_PARAMS: loads (array of load IDs or objects)'},400);
   return j({ok:true,...sizeAlternator(b.loads,b.idleRPMRatio,b.headroom_pct)})}

 // -- Battery Analysis --
 if(p==='/api/ecu/electrical/analyze-battery'&&m==='POST'){
   const b=await body(req);
   if(!b.batteryType||!b.capacity_Ah||!b.loads)return j({error:'MISSING_PARAMS: batteryType, capacity_Ah, loads'},400);
   return j({ok:true,...analyzeBattery(b.batteryType,b.capacity_Ah,b.loads,b.cranking_A)})}

 // -- Fuse & Relay Sizing --
 if(p==='/api/ecu/electrical/size-fuse-relay'&&m==='POST'){
   const b=await body(req);
   if(!b.current_A)return j({error:'MISSING_PARAMS: current_A'},400);
   return j({ok:true,...sizeFuseRelay(b.current_A,b.loadType,b.wireGauge)})}

 // -- Full Electrical Audit --
 if(p==='/api/ecu/electrical/audit'&&m==='POST'){
   const b=await body(req);
   if(!b.alternator_A||!b.battery_Ah||!b.batteryType)return j({error:'MISSING_PARAMS: alternator_A, battery_Ah, batteryType'},400);
   return j({ok:true,...auditElectricalSystem(b.alternator_A,b.battery_Ah,b.batteryType,b.loadIds,b.customLoads)})}

 // -- Big 3 Upgrade --
 if(p==='/api/ecu/electrical/big3-upgrade'&&m==='POST'){
   const b=await body(req);
   if(!b.alternator_A)return j({error:'MISSING_PARAMS: alternator_A'},400);
   return j({ok:true,...calcBig3Upgrade(b.alternator_A,b.cableLength_battery_to_engine_m,b.cableLength_battery_to_chassis_m,b.cableLength_alternator_to_battery_m)})}

 // -- Electrical Stats --
 if(p==='/api/ecu/electrical/stats'&&m==='GET'){
   return j({ok:true,...electricalCalcStats()})}

 // ===================== EMISSIONS & ENVIRONMENTAL COMPLIANCE CALCULATOR =====================

 // -- Emission Standards DB --
 if(p==='/api/ecu/emissions/standards'&&m==='GET'){
   const u=new URL(req.url);const region=u.searchParams.get('region')||null;
   return j({ok:true,standards:listEmissionStandards(region)})}
 if(p.match(/^\/api\/ecu\/emissions\/standards\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const s=getEmissionStandard(id);return s?j({ok:true,standard:s}):j({error:'STANDARD_NOT_FOUND'},404)}

 // -- Fuel Properties DB --
 if(p==='/api/ecu/emissions/fuel-properties'&&m==='GET'){return j({ok:true,fuels:listFuelProperties()})}
 if(p.match(/^\/api\/ecu\/emissions\/fuel-properties\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const f=getFuelProperty(id);return f?j({ok:true,fuel:f}):j({error:'FUEL_NOT_FOUND'},404)}

 // -- Catalyst Types DB --
 if(p==='/api/ecu/emissions/catalyst-types'&&m==='GET'){return j({ok:true,catalysts:listCatalystTypes()})}
 if(p.match(/^\/api\/ecu\/emissions\/catalyst-types\/[^/]+$/)&&m==='GET'){const id=p.split('/').pop();const c=getCatalystType(id);return c?j({ok:true,catalyst:c}):j({error:'CATALYST_NOT_FOUND'},404)}

 // -- Estimate Emissions --
 if(p==='/api/ecu/emissions/estimate'&&m==='POST'){
   const b=await body(req);
   if(!b.power_hp||!b.fuelConsumption_LPer100km)return j({error:'MISSING_PARAMS: power_hp, fuelConsumption_LPer100km'},400);
   return j({ok:true,...estimateEmissions(b.power_hp,b.fuelConsumption_LPer100km,b.fuelType,b.lambda,b.catalystType)})}

 // -- Compliance Check --
 if(p==='/api/ecu/emissions/check-compliance'&&m==='POST'){
   const b=await body(req);
   if(!b.emissions_gPerKm||!b.standardId)return j({error:'MISSING_PARAMS: emissions_gPerKm, standardId'},400);
   return j({ok:true,...checkCompliance(b.emissions_gPerKm,b.standardId)})}

 // -- CO2 Estimation --
 if(p==='/api/ecu/emissions/co2'&&m==='POST'){
   const b=await body(req);
   if(!b.fuelConsumption_LPer100km)return j({error:'MISSING_PARAMS: fuelConsumption_LPer100km'},400);
   return j({ok:true,...estimateCO2(b.fuelConsumption_LPer100km,b.fuelType,b.annualDistance_km)})}

 // -- EGR Impact --
 if(p==='/api/ecu/emissions/egr-impact'&&m==='POST'){
   const b=await body(req);
   if(!b.egrRate_pct||!b.baseNox_gPerKm||!b.baseCO2_gPerKm)return j({error:'MISSING_PARAMS: egrRate_pct, baseNox_gPerKm, baseCO2_gPerKm'},400);
   return j({ok:true,...calcEGRImpact(b.egrRate_pct,b.baseNox_gPerKm,b.baseCO2_gPerKm,b.basePM_gPerKm)})}

 // -- Catalyst Health Estimation --
 if(p==='/api/ecu/emissions/cat-health'&&m==='POST'){
   const b=await body(req);
   if(!b.catAge_km)return j({error:'MISSING_PARAMS: catAge_km'},400);
   return j({ok:true,...estimateCatHealth(b.catAge_km,b.catType,b.operatingConditions)})}

 // -- Compare Fuel Emissions --
 if(p==='/api/ecu/emissions/compare-fuels'&&m==='POST'){
   const b=await body(req);
   if(!b.fuelConsumption_LPer100km)return j({error:'MISSING_PARAMS: fuelConsumption_LPer100km'},400);
   return j({ok:true,...compareFuelEmissions(b.fuelConsumption_LPer100km,b.fuelTypes)})}

 // -- Modification Impact Assessment --
 if(p==='/api/ecu/emissions/mod-impact'&&m==='POST'){
   const b=await body(req);
   if(!b.modifications||!Array.isArray(b.modifications))return j({error:'MISSING_PARAMS: modifications (array)'},400);
   return j({ok:true,...assessModImpact(b.modifications)})}

 // -- Emissions Stats --
 if(p==='/api/ecu/emissions/stats'&&m==='GET'){
   return j({ok:true,...emissionsCalcStats()})}

 // ═══════════════════════════════════════════════════════════════════════════
 // === ECU SYSTEM OVERVIEW — Tüm ECU sistemi durum özeti ===
 // ═══════════════════════════════════════════════════════════════════════════

 if(p==='/api/ecu/overview'&&m==='GET'){try{
   const uploads=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_uploads');
   const tuned=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_tuned_outputs');
   const history=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_tuning_history');
   const defSets=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_definition_sets');
   const defs=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_definitions');
   const memory=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_file_memory');
   let projectCount=0;try{const pc=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_tuning_projects');projectCount=pc?.cnt||0}catch(e){}
   let sessionCount=0;try{const sc=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_tuning_sessions');sessionCount=sc?.cnt||0}catch(e){}
   let readinessCount=0;try{const rc=await q1(env,'SELECT COUNT(*) as cnt FROM ecu_readiness_history');readinessCount=rc?.cnt||0}catch(e){}
   const checksumAlgos=listChecksumAlgorithms();
   const flashProtos=listFlashProtocols();
   const safetyAll=getAllSafetyLimits();
   const dtcSystems=getDTCSystems();
   return j({ok:true,overview:{
     uploads:uploads?.cnt||0,
     tunedOutputs:tuned?.cnt||0,
     tuningHistory:history?.cnt||0,
     definitionSets:defSets?.cnt||0,
     definitions:defs?.cnt||0,
     fileMemory:memory?.cnt||0,
     projects:projectCount,
     sessions:sessionCount,
     readinessSnapshots:readinessCount,
     obdMonitors:Object.keys(OBD_MONITORS).length,
     emissionsStandards:listEmissionsStandards().length,
     driveCycles:listDriveCycles().length,
     ecuPinoutFamilies:listEcuPinouts().length,
     obd2Protocols:Object.keys(OBD2_CONNECTOR.protocols).length,
     fileConverterFormats:listFormats().length,
     udsServices:listUDSServices().length,
     kwp2000Services:listKWP2000Services().length,
     commonDIDs:listDIDs().length,
     flashSequences:listUDSFlashSequences().length,
     checksumAlgorithms:checksumAlgos.length,
     flashProtocols:flashProtos.length,
     safetyLimitSystems:Object.keys(safetyAll).length,
     dtcSystems:dtcSystems.length,
     vinManufacturers:Object.keys(WMI_DATABASE).length,
     vinStats:vinDecoderStats(),
     fuelInjectors:listInjectors().length,
     fuelTypes:listFuelTypes().length,
     fuelCalculations:fuelCalcStats().calculations.length,
     turboDatabase:listTurbos().length,
     turboManufacturers:turboCalcStats().manufacturers.length,
     turboCalculations:turboCalcStats().calculations.length,
     exhaustPipeSizes:listPipeSizes().length,
     exhaustCats:listCats().length,
     exhaustCalculations:exhaustCalcStats().calculations.length,
     engineConfigs:listEngineConfigs().length,
     engineCalculations:engineMathStats().calculations.length,
     camProfiles:listCams().length,
     camCalculations:camCalcStats().calculations.length,
     transmissionDatabase:listTransmissions().length,
     tireSizes:listTireSizes().length,
     drivetrainTypes:listDrivetrainTypes().length,
     drivetrainCalculations:drivetrainCalcStats().calculations.length,
     coolantTypes:listCoolantTypes().length,
     radiatorDatabase:listRadiators().length,
     fanDatabase:listFans().length,
     thermostatRatings:listThermostats().length,
     coolingCalculations:coolingCalcStats().calculations.length,
     octaneRatings:listOctanes().length,
     knockSensors:listKnockSensors().length,
     knockCalculations:knockCalcStats().calculations.length,
     fuelStoichTypes:listFuelStoich().length,
     widebandSensors:listWidebandSensors().length,
     lambdaTargets:listLambdaTargets().length,
     lambdaCalculations:lambdaCalcStats().calculations.length,
     ignitionCoils:listCoils().length,
     sparkPlugs:listSparkPlugs().length,
     ignitionCalculations:ignitionCalcStats().calculations.length,
     oilGrades:listOils().length,
     oilPumps:listPumps().length,
     oilCoolers:listCoolers().length,
     oilCalculations:oilCalcStats().calculations.length,
     nitrousJets:listJets().length,
     nitrousBottles:listBottles().length,
     nitrousCalculations:nitrousCalcStats().calculations.length,
     intakeManifolds:listManifolds().length,
     throttleBodies:listThrottleBodies().length,
     intakeCalculations:intakeCalcStats().calculations.length,
     datalogProfiles:listLogProfiles().length,
     datalogTriggerTypes:listTriggerTypes().length,
     datalogExportFormats:dataloggerStats().exportFormats.length,
     flexFuelBlends:listFuelBlends().length,
     ethanolSensors:listEthanolSensors().length,
     flexFuelCalculations:flexfuelCalcStats().calculations.length,
     diagnosticSensorRanges:listSensorRanges().length,
     diagnosticPatterns:listDiagnosticPatterns().length,
     diagnosticCalculations:ecuDiagnosticsStats().calculations.length,
     tcuTransmissions:Object.keys(TCU_TRANS_TYPES).length,
     tcuConverters:Object.keys(TORQUE_CONVERTERS).length,
     tcuShiftProfiles:Object.keys(SHIFT_PROFILES).length,
     tcuCalculations:tcuTuningStats().calculations.length,
     diffTypes:Object.keys(DIFF_TYPES).length,
     diffRatios:Object.keys(DIFF_RATIOS).length,
     transferCases:Object.keys(TRANSFER_CASES).length,
     diffCalculations:differentialCalcStats().calculations.length,
     suspSpringTypes:Object.keys(SPRING_TYPES).length,
     suspDamperTypes:Object.keys(DAMPER_TYPES).length,
     suspSwayBarSizes:Object.keys(SWAY_BAR_SIZES).length,
     suspAlignmentPresets:Object.keys(ALIGNMENT_SPECS).length,
     suspCalculations:suspensionCalcStats().calculations.length,
     brakePadCompounds:Object.keys(PAD_COMPOUNDS).length,
     brakeRotorTypes:Object.keys(ROTOR_TYPES).length,
     brakeFluids:Object.keys(BRAKE_FLUIDS).length,
     brakeCaliperTypes:Object.keys(CALIPER_TYPES).length,
     brakeCalculations:brakeCalcStats().calculations.length,
     wheelBoltPatterns:Object.keys(BOLT_PATTERNS).length,
     wheelTireTypes:Object.keys(TIRE_TYPES).length,
     wheelCalculations:wheelTireCalcStats().calculations.length,
     aeroDragProfiles:Object.keys(DRAG_PROFILES).length,
     aeroWingProfiles:Object.keys(WING_PROFILES).length,
     aeroCalculations:aeroCalcStats().calculations.length,
     weightClasses:Object.keys(WEIGHT_CLASSES).length,
     layoutTypes:Object.keys(LAYOUT_TYPES).length,
     weightDistCalculations:weightDistCalcStats().calculations.length,
     intercoolerCalculations:intercoolerCalcStats().calculations.length,
     electricalCalculations:electricalCalcStats().calculations.length,
     emissionsCalculations:emissionsCalcStats().calculations.length,
     capabilities:[
       'binary_upload','multi_format_download','5_tier_detection',
       'definition_matching','a2l_xdf_parsing','checksum_correction',
       'extended_checksums','binary_analysis','entropy_mapping',
       'string_extraction','section_detection','dtc_database',
       'flash_protocols','safety_limits','project_management',
       'session_tracking','notes','file_memory','vehicle_db',
       'hex_view','map_tables','batch_operations','diff_reports',
       'stage1_preview','obd_bridge','thinkdiag_import',
       'readiness_monitors','emissions_check','drive_cycles',
       'freeze_frame','obd_modes','readiness_history',
       'wiring_pinouts','obd2_connector','wiring_verify','flash_pins',
       'file_converter','ihex_parse','srec_parse','format_detect','file_compare',
       'can_frame_parse','can_log_parse','uds_decode','kwp2000_decode',
       'isotp_parse','isotp_reassemble','flash_sequences','did_lookup','nrc_lookup',
       'vin_decode','vin_validate','vin_batch','vin_manufacturer_search','vin_wmi_lookup',
       'fuel_duty_cycle','fuel_injector_sizing','fuel_afr_calc','fuel_lambda_convert',
       'fuel_boost_calc','fuel_wastegate','fuel_maf_scale','fuel_pump_sizing','fuel_ve_estimate',
       'fuel_injector_db','fuel_type_db',
       'turbo_airflow','turbo_pressure_ratio','turbo_compressor_temp','turbo_intercooler',
       'turbo_ar_select','turbo_sizing','turbo_surge_choke','turbo_twin_config',
       'turbo_database','turbo_search',
       'exhaust_flow','exhaust_pipe_size','exhaust_backpressure','exhaust_header_size',
       'exhaust_cat_size','exhaust_egt_check','exhaust_pipe_db','exhaust_cat_db',
       'engine_displacement','engine_compression_ratio','engine_dynamic_cr','engine_piston_speed',
       'engine_torque_hp','engine_bmep','engine_efficiency','engine_rod_ratio',
       'engine_cylinder_pressure','engine_config_db',
       'cam_timing_events','cam_valve_float','cam_compare','cam_recommend',
       'cam_profile_db','cam_search',
       'drivetrain_speed_at_rpm','drivetrain_rpm_at_speed','drivetrain_wheel_hp',
       'drivetrain_crank_hp','drivetrain_gear_analysis','drivetrain_0to100',
       'drivetrain_max_speeds','drivetrain_transmission_db','drivetrain_tire_db',
       'cooling_heat_rejection','cooling_coolant_flow','cooling_radiator_size',
       'cooling_boiling_point','cooling_fan_size','cooling_water_pump',
       'cooling_thermostat','cooling_coolant_db','cooling_radiator_db','cooling_fan_db',
       'knock_frequency','knock_detonation_risk','knock_timing_retard','knock_timing_map',
       'knock_window_analysis','knock_octane_db','knock_sensor_db','knock_sensor_search',
       'lambda_pid_tuning','lambda_map_gen','lambda_sensor_calibrate','lambda_free_air_cal',
       'lambda_ethanol_estimate','lambda_fuel_stoich_db','lambda_wideband_sensor_db',
       'lambda_sensor_search','lambda_target_db','lambda_target_lookup',
       'ignition_mbt','ignition_knock_limit','ignition_timing_curve','ignition_dwell',
       'ignition_spark_gap','ignition_spark_energy','ignition_timing_table',
       'ignition_coil_db','ignition_coil_search','ignition_spark_plug_db','ignition_spark_plug_search',
       'oil_viscosity','oil_pressure','oil_cooler_sizing','oil_pump_flow','oil_analysis',
       'oil_spec_recommend','oil_grade_db','oil_pump_db','oil_cooler_db','oil_search',
       'nitrous_hp_gain','nitrous_timing_retard','nitrous_fuel_enrichment','nitrous_bottle_pressure',
       'nitrous_bottle_duration','nitrous_purge','nitrous_safety_checklist','nitrous_jet_db','nitrous_bottle_db','nitrous_search',
       'intake_runner_length','intake_runner_diameter','intake_plenum_volume','intake_throttle_body_size',
       'intake_airflow','intake_variable_intake','intake_port_flow','intake_manifold_db','intake_throttle_body_db','intake_search',
       'datalog_session_mgmt','datalog_sample_append','datalog_export_csv','datalog_export_megalogviewer','datalog_export_vcds',
       'datalog_analyze','datalog_anomaly_detect','datalog_correlate','datalog_sample_budget','datalog_profiles','datalog_triggers',
       'flexfuel_blend_calc','flexfuel_injector_req','flexfuel_pump_req','flexfuel_timing_advance','flexfuel_coldstart',
       'flexfuel_sensor_freq','flexfuel_sensor_volt','flexfuel_e85_conversion','flexfuel_blend_db','flexfuel_sensor_db','flexfuel_sensor_search',
       'diag_sensor_validate','diag_multi_validate','diag_diagnose','diag_health_score','diag_fuel_trims','diag_o2_sensor','diag_maintenance','diag_pattern_db','diag_classify_dtc',
       'tcu_shift_points','tcu_line_pressure','tcu_converter_slip','tcu_launch_control','tcu_optimize_shifts',
       'tcu_clutch_wear','tcu_recommend_fluid','tcu_transmission_db','tcu_converter_db','tcu_shift_profile_db','tcu_search',
       'diff_crawl_ratio','diff_speed_at_rpm','diff_rpm_at_speed','diff_torque_split','diff_temp',
       'diff_recommend_ratio','diff_recommend_fluid','diff_tcase_gearing','diff_type_db','diff_ratio_db','diff_tcase_db','diff_fluid_db',
       'susp_spring_rate','susp_damper_ratio','susp_ride_height','susp_sway_bar','susp_corner_weight',
       'susp_bump_steer','susp_anti_squat','susp_alignment','susp_spring_db','susp_damper_db','susp_sway_bar_db','susp_alignment_db',
       'brake_force','brake_stopping_dist','brake_bias','brake_rotor_temp','brake_kinetic_energy',
       'brake_pedal_ratio','brake_line_volume','brake_recommend_fluid','brake_pad_db','brake_rotor_db','brake_fluid_db','brake_caliper_db',
       'wheel_tire_diameter','wheel_compare_tires','wheel_offset','wheel_compare_offsets','wheel_speedo_correction',
       'wheel_load_index','wheel_speed_rating','wheel_stretch_fit','wheel_bolt_pattern_db','wheel_tire_type_db',
       'aero_drag_force','aero_top_speed','aero_downforce','aero_balance','aero_speed_effect',
       'aero_altitude_effect','aero_coastdown_cd','aero_full_analysis','aero_drag_profile_db','aero_wing_profile_db',
       'weight_longitudinal_transfer','weight_lateral_transfer','weight_cg_height','weight_distribution','weight_ballast',
       'weight_payload_effect','weight_power_to_weight','weight_reduction','weight_full_analysis','weight_class_db','weight_layout_db',
       'ic_compressor_outlet_temp','ic_efficiency','ic_size_core','ic_pressure_drop','ic_water_to_air','ic_piping_diameter',
       'ic_water_injection','ic_heat_soak','ic_type_db','ic_core_size_db','ic_piping_material_db',
       'elec_voltage_drop','elec_wire_gauge','elec_alternator_size','elec_battery_analysis','elec_fuse_relay',
       'elec_system_audit','elec_big3_upgrade','elec_wire_gauge_db','elec_battery_type_db','elec_common_load_db',
       'emissions_estimate','emissions_compliance','emissions_co2','emissions_egr_impact','emissions_cat_health',
       'emissions_compare_fuels','emissions_mod_impact','emissions_standard_db','emissions_fuel_property_db','emissions_catalyst_type_db'
     ]
   }});
 }catch(e){return j({error:e.message},500)}}

 // === OBD-II BRIDGE (ELM327 decode, live sessions, DTC) ===
 if(p.startsWith('/api/obd/')){const obdRes=await obdBridgeRouter(req,env,p,m);if(obdRes)return obdRes}

 // === THINKDIAG TC RECORDING IMPORT ===
 if(p.startsWith('/api/ecu/thinkdiag/')){const tdRes=await thinkdiagRouter(req,env,p,m);if(tdRes)return tdRes}

 // === GÖRSEL ÜRETME (Cloudflare AI — ücretsiz) ===
 if(p==='/api/ai/image'&&m==='POST'){try{
   if(!env.AI)return j({error:'CLOUDFLARE_AI_NOT_BOUND'},400);
   const b=await body(req);
   const prompt=String(b.prompt||'').trim();
   if(!prompt)return j({error:'EMPTY_PROMPT'},400);
   const model=b.model||'@cf/black-forest-labs/FLUX.1-schnell';
   const result=await env.AI.run(model,{prompt,num_steps:b.steps||4});
   if(!result?.image)return j({error:'AI_NO_IMAGE'},500);
   // R2'ye kaydet
   const imgId=id();
   const key='images/'+imgId+'.png';
   const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
   await filePut(env,key,imgBytes,{contentType:'image/png'});
   return j({ok:true,id:imgId,size:imgBytes.length,model,key,base64:result.image.slice(0,100)+'...(truncated)'});
 }catch(e){return j({error:e.message||'IMAGE_FAILED'},500)}}

 if(p==='/api/ai/image/serve'){try{
   const imgId=new URL(req.url).searchParams.get('id');
   if(!imgId)return j({error:'MISSING'},400);
   const obj=await fileGet(env,'images/'+imgId+'.png');
   if(!obj)return j({error:'NOT_FOUND'},404);
   return new Response(obj.body,{headers:{'content-type':'image/png','cache-control':'public, max-age=86400'}});
 }catch(e){return j({error:e.message},500)}}

 // === YOUTUBE ÖĞRENME — link at, transcript çek, hafızaya kaydet ===
 if(p==='/api/learn/youtube'&&m==='POST'){try{
   const b=await body(req);
   const url=String(b.url||'').trim();
   if(!url)return j({error:'EMPTY_URL'},400);
   const{parseYouTubeResourceUrl,fetchYouTubeTranscript}=await import('./lib/youtube-teaching-runtime.js');
   const parsed=parseYouTubeResourceUrl(url);
   if(!parsed?.videoId)return j({error:'INVALID_YOUTUBE_URL',detail:'Video ID bulunamadı'},400);
   // Transcript çek (ücretsiz — HTML scrape)
   let transcript='',title='',language='';
   try{
     const result=await fetchYouTubeTranscript(parsed.videoId);
     transcript=result?.transcript||'';
     title=result?.title||'';
     language=result?.language||'';
   }catch(e){
     // Whisper fallback olabilir ama şimdilik transcript çekilemezse hata ver
     return j({error:'TRANSCRIPT_FAILED',detail:e.message},400);
   }
   if(!transcript)return j({error:'NO_TRANSCRIPT',detail:'Bu videoda altyazı/transcript bulunamadı.'},400);
   // Hafızaya kaydet
   const{persistYouTubeLearning}=await import('./lib/youtube-learning-memory.js');
   const lr=await persistYouTubeLearning(env,{kind:'video',source_url:url,video_id:parsed.videoId,title,language,transcript},{});
   return j({ok:true,...lr,title,language,transcriptLength:transcript.length,preview:transcript.slice(0,500)});
 }catch(e){return j({error:e.message||'LEARN_FAILED'},500)}}

 // === ÖĞRENİLMİŞ İÇERİK LİSTESİ ===
 if(p==='/api/learn/list'&&m==='GET'){try{
   const{listYouTubeLearningSources}=await import('./lib/youtube-learning-memory.js');
   const sources=await listYouTubeLearningSources(env,100);
   return j({ok:true,count:sources.length,sources});
 }catch(e){return j({error:e.message},500)}}

 // === ÖĞRENİLMİŞ İÇERİK ARA ===
 if(p==='/api/learn/search'&&m==='POST'){try{
   const b=await body(req);
   const q=String(b.query||b.q||'').trim();
   if(!q)return j({error:'EMPTY_QUERY'},400);
   const{searchLearningMemory,learningContextText}=await import('./lib/youtube-learning-memory.js');
   const rows=await searchLearningMemory(env,q,{limit:8});
   return j({ok:true,count:rows.length,context:learningContextText(rows),results:rows});
 }catch(e){return j({error:e.message},500)}}

 // === SOSYAL MEDYA OTOMASYON — zamanlanmış görev oluştur ===
 if(p==='/api/social/schedule'&&m==='POST'){try{
   const b=await body(req);
   const platform=String(b.platform||'instagram').toLowerCase();
   const cadence=String(b.cadence||'weekly').toLowerCase();
   const topic=String(b.topic||b.prompt||'').trim();
   if(!topic)return j({error:'EMPTY_TOPIC'},400);
   // D1'e scheduled_jobs tablosu
   await run(env,`CREATE TABLE IF NOT EXISTS scheduled_jobs(id TEXT PRIMARY KEY,type TEXT,platform TEXT,cadence TEXT,topic TEXT,status TEXT DEFAULT 'active',last_run INTEGER,next_run INTEGER,created_at INTEGER)`);
   const jobId=id();
   const intervals={daily:86400000,weekly:604800000,biweekly:1209600000,monthly:2592000000};
   const interval=intervals[cadence]||604800000;
   const nextRun=now()+interval;
   await run(env,'INSERT INTO scheduled_jobs(id,type,platform,cadence,topic,status,next_run,created_at) VALUES(?,?,?,?,?,?,?,?)',jobId,'social_post',platform,cadence,topic,'active',nextRun,now());
   return j({ok:true,jobId,platform,cadence,topic,nextRun:new Date(nextRun).toISOString()});
 }catch(e){return j({error:e.message||'SCHEDULE_FAILED'},500)}}

 if(p==='/api/social/jobs'&&m==='GET'){try{
   await run(env,`CREATE TABLE IF NOT EXISTS scheduled_jobs(id TEXT PRIMARY KEY,type TEXT,platform TEXT,cadence TEXT,topic TEXT,status TEXT DEFAULT 'active',last_run INTEGER,next_run INTEGER,created_at INTEGER)`);
   const jobs=await qall(env,'SELECT * FROM scheduled_jobs WHERE status=? ORDER BY next_run ASC','active');
   return j({ok:true,count:jobs.length,jobs});
 }catch(e){return j({error:e.message},500)}}

 // === DTC LOOKUP — 9204 kod, ücretsiz, AI çağrısı yok ===
 if(p==='/api/dtc/lookup'){try{
   const u2=new URL(req.url);
   const code=String(u2.searchParams.get('code')||'').toUpperCase().trim();
   if(!code)return j({error:'EMPTY_CODE'},400);
   const row=await q1(env,'SELECT * FROM dtc_codes WHERE code=?',code);
   if(!row)return j({error:'CODE_NOT_FOUND',code,detail:`${code} veritabanında bulunamadı.`},404);
   return j({ok:true,code:row.code,category:row.category,title:{en:row.title_en,de:row.title_de},description:{en:row.desc_en,de:row.desc_de},parts:safeJsonParse(row.parts,[]),causes:safeJsonParse(row.causes,[]),repair:safeJsonParse(row.repair,{}),mil:!!row.mil});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/dtc/search'&&m==='POST'){try{
   const b=await body(req);
   const q=String(b.query||b.q||'').trim();
   if(!q)return j({error:'EMPTY_QUERY'},400);
   const term='%'+q.toLowerCase()+'%';
   const rows=await qall(env,'SELECT code,category,title_en,title_de,desc_en FROM dtc_codes WHERE lower(code) LIKE ? OR lower(title_en) LIKE ? OR lower(title_de) LIKE ? OR lower(desc_en) LIKE ? LIMIT 20',term,term,term,term);
   return j({ok:true,count:rows.length,results:rows.map(r=>({code:r.code,category:r.category,title_en:r.title_en,title_de:r.title_de,desc_en:(r.desc_en||'').slice(0,150)}))});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/dtc/stats'){try{
   const total=await q1(env,'SELECT COUNT(*) n FROM dtc_codes');
   const byCat=await qall(env,'SELECT category,COUNT(*) n FROM dtc_codes GROUP BY category ORDER BY n DESC');
   return j({ok:true,total:total?.n||0,byCategory:byCat});
 }catch(e){return j({error:e.message},500)}}

 // === VİDEO PİPELINE v2 — çoklu model, seslendirme, altyazı, metin overlay, stok video ===
 if(p==='/api/video/create'&&m==='POST'){try{
   const b=await body(req);
   const{generateVideoJobSpec,IMAGE_STYLES,enrichPrompt}=await import('./lib/video-pipeline.js');
   const{IMAGE_MODELS,generateHashtags,generateContentCalendar,TTS_VOICES}=await import('./lib/creative-tools.js');
   const spec=generateVideoJobSpec({platform:b.platform||'instagram_reels',imageCount:b.imageCount||5,perImageSec:b.perImageSec||3,topic:b.topic||'',style:b.style||'automotive'});
   
   // 1) AI ile slayt planı yaz (başlık + açıklama + metin overlay + seslendirme)
   let slidePlan=[];
   let narration='';
   try{
     const planPrompt=`${spec.imageCount} slaytlık bir ${spec.platform} videosu planla. Konu: "${spec.topic}".\nHer slayt için:\n1. Görsel açıklaması (İngilizce, AI image prompt)\n2. Üzerine yazılacak kısa metin (Türkçe, max 6 kelime)\n3. Seslendirme metni (Türkçe, o slayt süresince okunacak, max 20 kelime)\n\nJSON array döndür: [{"imagePrompt":"...","overlayText":"...","narrationText":"..."}]. Sadece JSON, başka metin yok.`;
     const a=await withTimeout(aiFallback(env,[{role:'user',content:planPrompt}],{mode:'fast'}),12000,'PLAN_TIMEOUT');
     const jsonMatch=(a?.text||'').match(/\[[\s\S]*\]/);
     if(jsonMatch)slidePlan=JSON.parse(jsonMatch[0]);
   }catch{}
   // Seslendirme metnini birleştir
   if(slidePlan.length)narration=slidePlan.map(s=>s.narrationText||'').filter(Boolean).join('. ');
   if(b.narration)narration=b.narration; // kullanıcı override

   // 2) Görselleri üret
   const modelKey=b.model||'flux-schnell';
   const model=IMAGE_MODELS[modelKey]||IMAGE_MODELS['flux-schnell'];
   const imageUrls=[];
   const textOverlays=[];
   if(env.AI){
     for(let i=0;i<spec.imageCount;i++){
       try{
         const slideInfo=slidePlan[i]||{};
         const rawPrompt=slideInfo.imagePrompt||`${spec.style}. Slide ${i+1}/${spec.imageCount}: ${spec.topic}`;
         const enriched=enrichPrompt?enrichPrompt(rawPrompt,b.style||'automotive',spec.platform):rawPrompt;
         const result=await env.AI.run(model.id,{prompt:enriched,num_steps:model.steps||4});
         if(result?.image){
           const imgId=id();
           const key='video-frames/'+imgId+'.png';
           const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
           await filePut(env,key,imgBytes,{contentType:'image/png'});
           imageUrls.push('/api/ai/image/serve?id='+imgId);
           textOverlays.push(slideInfo.overlayText?{text:slideInfo.overlayText,position:i===0?'center':'bottom'}:null);
         }
       }catch{}
     }
   }

   // 3) Hashtag üret
   const hashtags=generateHashtags?generateHashtags(spec.topic,spec.platform.split('_')[0],15):'';

   // 4) Job kaydet
   await run(env,'CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,platform TEXT,topic TEXT,spec TEXT,image_urls TEXT,video_key TEXT,status TEXT DEFAULT "pending",created_at INTEGER,narration TEXT,voice TEXT,subtitles INTEGER,text_overlays TEXT,hashtags TEXT,music TEXT)');
   const jobId=id();
   const voice=b.voice||'tr-TR-AhmetNeural';
   const subtitles=b.subtitles!==false;
   await run(env,'INSERT INTO video_jobs(id,platform,topic,spec,image_urls,status,created_at,narration,voice,subtitles,text_overlays,hashtags,music) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
     jobId,spec.platform,spec.topic,JSON.stringify(spec),JSON.stringify(imageUrls),'images_ready',now(),
     narration,voice,subtitles?1:0,JSON.stringify(textOverlays),hashtags,b.music||'none');
   
   return j({ok:true,jobId,platform:spec.platform,imageCount:imageUrls.length,imageUrls,textOverlays,narration:narration.slice(0,500),voice,subtitles,hashtags,model:model.name,slidePlan:slidePlan.slice(0,spec.imageCount),note:'Görseller üretildi. Video render için GitHub Actions → video-render workflow çalıştır.'});
 }catch(e){return j({error:e.message||'VIDEO_CREATE_FAILED'},500)}}

 if(p==='/api/video/job'){try{
   const jobId=new URL(req.url).searchParams.get('id');
   if(!jobId)return j({error:'MISSING_ID'},400);
   await run(env,'CREATE TABLE IF NOT EXISTS video_jobs(id TEXT PRIMARY KEY,platform TEXT,topic TEXT,spec TEXT,image_urls TEXT,video_key TEXT,status TEXT DEFAULT "pending",created_at INTEGER,narration TEXT,voice TEXT,subtitles INTEGER,text_overlays TEXT,hashtags TEXT,music TEXT)');
   const job=await q1(env,'SELECT * FROM video_jobs WHERE id=?',jobId);
   if(!job)return j({error:'JOB_NOT_FOUND'},404);
   return j({ok:true,...job,spec:safeJsonParse(job.spec,{}),imageUrls:safeJsonParse(job.image_urls,[]),textOverlays:safeJsonParse(job.text_overlays,[]),perImageSec:safeJsonParse(job.spec,{}).perImageSec||3});
 }catch(e){return j({error:e.message},500)}}

 if(p==='/api/video/complete'&&m==='POST'){try{
   const b=await body(req);
   if(!b.jobId||!b.videoBase64)return j({error:'MISSING_FIELDS'},400);
   const videoBytes=Uint8Array.from(atob(b.videoBase64),c=>c.charCodeAt(0));
   const key='videos/'+b.jobId+'.mp4';
   await filePut(env,key,videoBytes,{contentType:'video/mp4'});
   await run(env,'UPDATE video_jobs SET video_key=?,status=? WHERE id=?',key,'ready',b.jobId);
   return j({ok:true,jobId:b.jobId,videoKey:key,size:videoBytes.length});
 }catch(e){return j({error:e.message},500)}}

 // === STOK VİDEO / GÖRSEL ARAMA (Pexels — ücretsiz) ===
 if(p==='/api/stock/search'&&m==='POST'){try{
   const b=await body(req);
   const query=String(b.query||'').trim();
   if(!query)return j({error:'EMPTY_QUERY'},400);
   const type=b.type||'videos'; // videos or photos
   // Pexels API key — credential store'dan al
   let pexelsKey='';
   try{const creds=await qall(env,'SELECT * FROM credentials WHERE provider IN (?,?) AND status=?','pexels','stock','active');if(creds.length)pexelsKey=creds[0].secret}catch{}
   if(!pexelsKey)return j({error:'PEXELS_KEY_NEEDED',detail:'Ayarlar → AI Sağlayıcı → Pexels (ücretsiz: https://www.pexels.com/api/new/ ) ekle'},400);
   const endpoint=type==='photos'?'https://api.pexels.com/v1/search':'https://api.pexels.com/videos/search';
   const res2=await fetchT(`${endpoint}?query=${encodeURIComponent(query)}&per_page=${b.count||6}&orientation=${b.orientation||'portrait'}`,{headers:{authorization:pexelsKey}});
   if(!res2.ok)throw Error('PEXELS_'+res2.status);
   const data=await res2.json();
   const results=type==='photos'
     ?(data.photos||[]).map(p=>({id:p.id,url:p.src?.large||p.src?.medium,thumb:p.src?.tiny,alt:p.alt,photographer:p.photographer}))
     :(data.videos||[]).map(v=>({id:v.id,url:(v.video_files||[]).find(f=>f.quality==='hd')?.link||(v.video_files||[])[0]?.link,thumb:v.image,duration:v.duration,user:v.user?.name}));
   return j({ok:true,type,count:results.length,results});
 }catch(e){return j({error:e.message},500)}}

 // === GÖRSEL ANLAMA (Cloudflare AI Vision — ücretsiz) ===
 if(p==='/api/ai/vision'&&m==='POST'){try{
   if(!env.AI)return j({error:'AI_NOT_BOUND'},400);
   const b=await body(req);
   const imageB64=b.image||b.imageBase64||'';
   const question=b.question||b.prompt||'Bu görselde ne var? Detaylı açıkla.';
   if(!imageB64)return j({error:'NO_IMAGE'},400);
   const result=await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct',{messages:[{role:'user',content:[{type:'text',text:question},{type:'image',image:imageB64}]}]});
   return j({ok:true,answer:result?.response||result?.text||'',model:'llama-3.2-11b-vision'});
 }catch(e){return j({error:e.message},500)}}

 // === ÇOKLU MODEL GÖRSEL ÜRETME ===
 if(p==='/api/ai/image/models'&&m==='GET'){try{
   const{IMAGE_MODELS}=await import('./lib/creative-tools.js');
   return j({ok:true,models:Object.entries(IMAGE_MODELS).map(([k,v])=>({id:k,...v}))});
 }catch(e){return j({error:e.message},500)}}

 // === İÇERİK TAKVİMİ ÜRETİCİ ===
 if(p==='/api/content/calendar'&&m==='POST'){try{
   const b=await body(req);
   const{generateContentCalendar,generateHashtags}=await import('./lib/creative-tools.js');
   const topic=String(b.topic||'').trim();
   if(!topic)return j({error:'EMPTY_TOPIC'},400);
   const weeks=b.weeks||4;
   const postsPerWeek=b.postsPerWeek||3;
   const calendar=generateContentCalendar(topic,weeks,postsPerWeek);
   // AI ile her post için kısa açıklama
   let enriched=calendar;
   try{
     const prompt=`İçerik takvimi için ${calendar.length} post. Her biri için 1 cümle açıklama ve 1 emoji yaz. Konu: "${topic}". JSON array: [{"caption":"...","emoji":"..."}]. Sadece JSON.`;
     const a=await withTimeout(aiFallback(env,[{role:'user',content:prompt}],{mode:'fast'}),8000,'CAL_TIMEOUT');
     const match=(a?.text||'').match(/\[[\s\S]*\]/);
     if(match){
       const captions=JSON.parse(match[0]);
       enriched=calendar.map((post,i)=>({...post,caption:captions[i]?.caption||'',emoji:captions[i]?.emoji||''}));
     }
   }catch{}
   return j({ok:true,topic,weeks,postsPerWeek,totalPosts:enriched.length,calendar:enriched,hashtags:generateHashtags(topic)});
 }catch(e){return j({error:e.message},500)}}

 // === SES MODELLARI LİSTESİ ===
 if(p==='/api/tts/voices'&&m==='GET'){try{
   const{TTS_VOICES}=await import('./lib/creative-tools.js');
   return j({ok:true,voices:Object.entries(TTS_VOICES).map(([id,v])=>({id,...v}))});
 }catch(e){return j({error:e.message},500)}}

 // === YOUTUBE UPLOAD ===
 if(p==='/api/youtube/upload'&&m==='POST'){try{
   const b=await body(req);
   const videoJobId=b.videoJobId||b.jobId;
   if(!videoJobId)return j({error:'MISSING_JOB_ID'},400);
   const job=await q1(env,'SELECT * FROM video_jobs WHERE id=?',videoJobId);
   if(!job||job.status!=='ready')return j({error:'VIDEO_NOT_READY'},400);
   const videoObj=await fileGet(env,job.video_key);
   if(!videoObj)return j({error:'VIDEO_FILE_MISSING'},404);
   // Google OAuth token al
   const token=await googleAccessToken(env);
   // YouTube Data API — resumable upload
   const title=b.title||job.topic||'JARVIS Video';
   const description=b.description||`${job.topic} — JARVIS tarafından otomatik üretildi.`;
   const tags=b.tags||['jarvis','automotive','tuning'];
   const categoryId=b.categoryId||'22'; // People & Blogs
   // 1) Resumable upload başlat
   const initRes=await fetchT('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{
     method:'POST',
     headers:{authorization:'Bearer '+token,'content-type':'application/json'},
     body:JSON.stringify({snippet:{title,description,tags,categoryId},status:{privacyStatus:b.privacy||'unlisted',selfDeclaredMadeForKids:false}})
   });
   if(!initRes.ok)throw Error('YOUTUBE_INIT_'+initRes.status+':'+(await initRes.text()).slice(0,200));
   const uploadUrl=initRes.headers.get('location');
   if(!uploadUrl)throw Error('YOUTUBE_NO_UPLOAD_URL');
   // 2) Video yükle
   const videoBytes=new Uint8Array(await videoObj.arrayBuffer());
   const uploadRes=await fetchT(uploadUrl,{method:'PUT',headers:{'content-type':'video/mp4','content-length':String(videoBytes.length)},body:videoBytes});
   if(!uploadRes.ok)throw Error('YOUTUBE_UPLOAD_'+uploadRes.status+':'+(await uploadRes.text()).slice(0,200));
   const ytResult=await uploadRes.json();
   await run(env,'UPDATE video_jobs SET status=? WHERE id=?','published:youtube:'+ytResult.id,videoJobId);
   await log(env,'youtube','Video yüklendi: '+title,{videoId:ytResult.id,platform:'youtube'});
   return j({ok:true,videoId:ytResult.id,url:'https://youtube.com/watch?v='+ytResult.id,title});
 }catch(e){return j({error:e.message||'YOUTUBE_UPLOAD_FAILED'},500)}}

 // === INSTAGRAM REELS UPLOAD ===
 if(p==='/api/instagram/reels'&&m==='POST'){try{
   const b=await body(req);
   const c=await metaCredential(env);
   if(!c)return j({error:'META_NOT_CONNECTED'},400);
   const ig=String(c.model||'').trim();
   if(!ig)return j({error:'INSTAGRAM_BUSINESS_ID_REQUIRED'},400);
   // Instagram Reels: video URL lazım (R2'den public serve)
   const videoUrl=b.videoUrl||'';
   if(!videoUrl)return j({error:'VIDEO_URL_REQUIRED'},400);
   const caption=b.caption||'';
   // 1) Container oluştur
   const form1=new URLSearchParams({media_type:'REELS',video_url:videoUrl,caption,access_token:c.secret});
   const r1=await fetchT(`https://graph.facebook.com/v24.0/${ig}/media`,{method:'POST',body:form1});
   if(!r1.ok)throw Error('IG_CONTAINER_'+r1.status+':'+(await r1.text()).slice(0,200));
   const containerId=(await r1.json()).id;
   // 2) Yayınla
   const form2=new URLSearchParams({creation_id:containerId,access_token:c.secret});
   const r2=await fetchT(`https://graph.facebook.com/v24.0/${ig}/media_publish`,{method:'POST',body:form2});
   if(!r2.ok)throw Error('IG_PUBLISH_'+r2.status+':'+(await r2.text()).slice(0,200));
   const result=await r2.json();
   await log(env,'instagram','Reels yüklendi: '+caption.slice(0,80),{mediaId:result.id});
   return j({ok:true,mediaId:result.id,platform:'instagram_reels'});
 }catch(e){return j({error:e.message||'INSTAGRAM_REELS_FAILED'},500)}}

 if(p==='/api/ai/router/status')return j({router:await aiRouterStatus(env)});
 if(p==='/api/ai/diagnose')return j(await aiDiagnostics(env));
 if(p==='/api/status')return j(await liveStatus(env));
 if(p==='/api/state')return j(await state(env));
 if(p==='/api/tasks'&&m==='POST'){const b=await body(req),title=String(b.title||'').trim();if(!title)return j({error:'TITLE_REQUIRED'},400);const t=now(),x={id:id(),title,priority:b.priority||'Orta',status:'open',area:b.area||'genel',createdAt:t,updatedAt:t};await run(env,'INSERT INTO tasks(id,title,priority,status,area,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',x.id,x.title,x.priority,x.status,x.area,t,t);await log(env,'task','Görev eklendi: '+title);return j(x)}
 let mm=p.match(/^\/api\/tasks\/([^/]+)$/);if(mm&&m==='PATCH'){const b=await body(req);if('status'in b)await run(env,'UPDATE tasks SET status=?,updated_at=? WHERE id=?',b.status,now(),mm[1]);return j({ok:true})}
 if(p==='/api/projects'&&m==='POST'){const b=await body(req),title=String(b.title||'').trim();if(!title)return j({error:'TITLE_REQUIRED'},400);const t=now(),x={id:id(),title,type:b.type||'genel',status:'active',notes:b.notes||'',createdAt:t,updatedAt:t};await run(env,'INSERT INTO projects(id,title,type,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',x.id,x.title,x.type,x.status,x.notes,t,t);return j(x)}
 if(p==='/api/memory'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'TEXT_REQUIRED'},400);await run(env,'INSERT INTO memories(id,text,tags,created_at) VALUES(?,?,?,?)',id(),text,JSON.stringify(b.tags||[]),now());return j({ok:true})}
 if(p==='/api/research'){const q=u.searchParams.get('q')||'';if(!q)return j({error:'QUERY_REQUIRED'},400);const results=await ddg(q);await log(env,'research','Araştırıldı: '+q,{count:results.length});return j({q,results})}
 if(p==='/api/tools/discover'){const cap=u.searchParams.get('capability')||'ai-tool';return j({capability:cap,results:await discoverTools(env,cap)})}

 if(p==='/api/files/download-url'&&m==='POST'){const b=await body(req),url=String(b.url||'').trim();let u2;try{u2=new URL(url)}catch{return j({error:'INVALID_URL'},400)}if(!/^https?:$/.test(u2.protocol)||privateHost(u2.hostname))return j({error:'URL_NOT_ALLOWED'},400);const r=await fetchT(u2.toString(),{redirect:'follow'});if(!r.ok)return j({error:'DOWNLOAD_HTTP_'+r.status},400);const len=Number(r.headers.get('content-length')||0);if(len>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);const buf=new Uint8Array(await r.arrayBuffer());if(buf.byteLength>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);let name=String(b.name||'').trim()||u2.pathname.split('/').filter(Boolean).pop()||'download.bin';name=name.replace(/[\\/]/g,'_');const key=`${now()}-${id()}-${name}`;await filePut(env,key,buf,{contentType:r.headers.get('content-type')||'application/octet-stream'});await log(env,'file','URL dosyası indirildi: '+name,{url:u2.origin});return j({ok:true,key,name,size:buf.byteLength})}
 if(p==='/api/files'&&m==='POST'){const b=await body(req),name=String(b.name||'file').replace(/[\\/]/g,'_'),raw=Uint8Array.from(atob(String(b.base64||'')),c=>c.charCodeAt(0));if(raw.byteLength>10*1024*1024)return j({error:'FILE_TOO_LARGE',max:'10MB'},413);const key=`${now()}-${id()}-${name}`;await filePut(env,key,raw,{contentType:b.type||'application/octet-stream'});await log(env,'file','Dosya yüklendi: '+name);return j({ok:true,key,name,size:raw.byteLength})}
 if(p==='/api/files'&&m==='GET'){const x=await fileList(env,{limit:100});return j(x.objects.map(o=>({file:o.key,size:o.size,mtime:o.uploaded||0})))}
 mm=p.match(/^\/api\/files\/(.+)$/);if(mm&&m==='GET'){const key=decodeURIComponent(mm[1]),o=await fileGet(env,key);if(!o)return txt('Not found',404);return new Response(o.body,{headers:{'content-type':o.httpMetadata?.contentType||'application/octet-stream','content-disposition':`attachment; filename="${key.split('-').slice(3).join('-')}"`}})}
 if(p==='/api/command'&&m==='POST'){const b=await body(req),text=String(b.text||'').trim();if(!text)return j({error:'EMPTY'},400);await addChat(env,'user',text,null);const r=await command(env,text);await addChat(env,'assistant',r.reply,r.provider||null);return j({...r,state:await state(env),history:await chatHistory(env,120)})}

 // ===== FATURA / INVOICE =====
 if(p==='/api/invoice/create'&&m==='POST'){try{
   const b=await body(req);
   const items=b.items||[];
   const cur=b.currency||'€';const taxR=b.taxRate||19;const lang=b.lang||'de';
   const sub=items.reduce((s,i)=>s+(i.qty||1)*(i.price||0),0);const tax=sub*taxR/100;const total=sub+tax;
   const fmt=n=>n.toFixed(2).replace('.',',');
   const invId=id();const invNum=b.number||('INV-'+Date.now().toString(36).toUpperCase());const invDate=b.date||new Date().toISOString().slice(0,10);
   const from=b.from||{};const to=b.to||{};
   const e=s=>String(s==null?'':s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
   const L=lang==='tr'?{inv:'FATURA',date:'Tarih',from:'Gönderen',to:'Alıcı',desc:'Açıklama',qty:'Adet',price:'Fiyat',sum:'Toplam',sub:'Ara Toplam',tax:`KDV (${taxR}%)`,total:'TOPLAM',notes:'Notlar'}:{inv:'RECHNUNG',date:'Datum',from:'Absender',to:'Empfänger',desc:'Beschreibung',qty:'Menge',price:'Preis',sum:'Summe',sub:'Zwischensumme',tax:`MwSt. (${taxR}%)`,total:'GESAMT',notes:'Hinweise'};
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${L.inv} ${e(invNum)}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#1a1a2e;font-size:14px;line-height:1.5}.head{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0a0a1a}.head h1{font-size:24px;letter-spacing:2px}.parties{display:flex;gap:32px;margin-bottom:24px}.parties div{flex:1}.parties h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#0a0a1a;color:#fff;padding:8px 10px;text-align:left;font-size:12px}td{padding:8px 10px;border-bottom:1px solid #e0e0e0}.right{text-align:right}.totals{margin-left:auto;width:260px;margin-bottom:20px}.totals div{display:flex;justify-content:space-between;padding:5px 0}.totals .grand{font-size:18px;font-weight:700;border-top:2px solid #0a0a1a;padding-top:8px;margin-top:4px}.notes{background:#f5f5f8;padding:12px;border-radius:8px;font-size:12px;color:#555}@media print{body{padding:12px}}</style></head><body><div class="head"><div><h1>${L.inv}</h1><div style="margin-top:4px;font-size:13px;color:#555">${e(invNum)}</div></div><div style="text-align:right;font-size:13px;color:#555">${L.date}: <b>${e(invDate)}</b></div></div><div class="parties"><div><h3>${L.from}</h3><b>${e(from.name||'')}</b><br>${e(from.address||'')}<br>${e(from.tax_id||'')}<br>${e(from.phone||'')}<br>${e(from.email||'')}</div><div><h3>${L.to}</h3><b>${e(to.name||'')}</b><br>${e(to.address||'')}<br>${e(to.tax_id||'')}<br>${e(to.phone||'')}</div></div><table><tr><th>#</th><th>${L.desc}</th><th class="right">${L.qty}</th><th class="right">${L.price}</th><th class="right">${L.sum}</th></tr>${items.map((it,i)=>`<tr><td>${i+1}</td><td>${e(it.desc||'')}</td><td class="right">${it.qty||1}</td><td class="right">${cur}${fmt(it.price||0)}</td><td class="right">${cur}${fmt((it.qty||1)*(it.price||0))}</td></tr>`).join('')}</table><div class="totals"><div><span>${L.sub}</span><span>${cur}${fmt(sub)}</span></div><div><span>${L.tax}</span><span>${cur}${fmt(tax)}</span></div><div class="grand"><span>${L.total}</span><span>${cur}${fmt(total)}</span></div></div>${b.notes?`<div class="notes"><b>${L.notes}:</b> ${e(b.notes)}</div>`:''}<div style="margin-top:32px;text-align:center;font-size:11px;color:#aaa">JARVIS · ${new Date().toISOString().slice(0,16)}</div></body></html>`;
   await run(env,'INSERT INTO invoices(id,customer_id,job_id,number,html,total,currency,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',invId,b.customer_id||null,b.job_id||null,invNum,html,total,cur,'draft',now(),now());
   await log(env,'invoice','Fatura oluşturuldu: '+invNum,{total,currency:cur});
   return j({ok:true,id:invId,number:invNum,total,html});
 }catch(e){return j({error:e.message||'INVOICE_FAILED'},500)}}

 if(p==='/api/invoice/list')return j({ok:true,invoices:await qall(env,'SELECT id,customer_id,job_id,number,total,currency,status,created_at FROM invoices ORDER BY created_at DESC LIMIT 50')});
 mm=p.match(/^\/api\/invoice\/([^/]+)$/);if(mm&&m==='GET'){const inv=await q1(env,'SELECT * FROM invoices WHERE id=?',mm[1]);if(!inv)return j({error:'NOT_FOUND'},404);return new Response(inv.html||'<p>Boş fatura</p>',{headers:{'content-type':'text/html; charset=utf-8'}})}

 // ===== CRM — MÜŞTERİ DEFTERİ =====
 if(p==='/api/crm/customers'&&m==='GET'){return j({ok:true,customers:await qall(env,'SELECT * FROM customers ORDER BY updated_at DESC LIMIT 100')})}
 if(p==='/api/crm/customers'&&m==='POST'){try{
   const b=await body(req);const cId=id();const t=now();
   await run(env,'INSERT INTO customers(id,name,phone,email,vehicle,plate,notes,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',cId,String(b.name||'').trim(),b.phone||'',b.email||'',b.vehicle||'',b.plate||'',b.notes||'',JSON.stringify(b.tags||[]),t,t);
   await log(env,'crm','Müşteri eklendi: '+(b.name||''),{id:cId});
   return j({ok:true,id:cId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/crm\/customers\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['name','phone','email','vehicle','plate','notes']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(b.tags){sets.push('tags=?');vals.push(JSON.stringify(b.tags))}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE customers SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM customers WHERE id=?',mm[1]);return j({ok:true})}

 if(p==='/api/crm/jobs'&&m==='GET'){const cid=u.searchParams.get('customer_id');const q=cid?await qall(env,'SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC LIMIT 50',cid):await qall(env,'SELECT j.*,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id ORDER BY j.created_at DESC LIMIT 100');return j({ok:true,jobs:q})}
 if(p==='/api/crm/jobs'&&m==='POST'){try{
   const b=await body(req);const jId=id();const t=now();
   await run(env,'INSERT INTO jobs(id,customer_id,type,title,description,status,price,currency,files,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',jId,b.customer_id||'',b.type||'tuning',String(b.title||'').trim(),b.description||'','open',b.price||0,b.currency||'EUR','[]',b.notes||'',t,t);
   await log(env,'crm','İş eklendi: '+(b.title||''),{id:jId,customer_id:b.customer_id});
   return j({ok:true,id:jId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/crm\/jobs\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['type','title','description','status','price','currency','notes']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE jobs SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}

 // ===== HAVA DURUMU (Open-Meteo — ücretsiz, API key yok) =====
 if(p==='/api/weather'){try{
   const lat=u.searchParams.get('lat')||'51.23',lon=u.searchParams.get('lon')||'6.78',days=u.searchParams.get('days')||'3';
   const wr=await fetchT(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&current=temperature_2m,weathercode,wind_speed_10m,relative_humidity_2m&timezone=Europe%2FBerlin&forecast_days=${days}`);
   if(!wr.ok)return j({error:'WEATHER_HTTP_'+wr.status},500);
   const wd=await wr.json();
   const wc={0:'☀️ Açık',1:'🌤 Az bulutlu',2:'⛅ Parçalı',3:'☁️ Bulutlu',45:'🌫 Sis',48:'🌫 Kırağı',51:'🌦 Çise',53:'🌧 Çise',55:'🌧 Yoğun çise',61:'🌧 Hafif yağmur',63:'🌧 Yağmur',65:'🌧 Şiddetli',71:'🌨 Hafif kar',73:'🌨 Kar',75:'🌨 Yoğun kar',80:'🌦 Sağanak',81:'🌧 Yoğun sağanak',82:'⛈ Şiddetli',95:'⛈ Fırtına',96:'⛈ Dolu',99:'⛈ Yoğun dolu'};
   return j({ok:true,current:{temp:wd.current?.temperature_2m,wind:wd.current?.wind_speed_10m,humidity:wd.current?.relative_humidity_2m,desc:wc[wd.current?.weathercode]||'?'},daily:(wd.daily?.time||[]).map((d,i)=>({date:d,max:wd.daily.temperature_2m_max[i],min:wd.daily.temperature_2m_min[i],rain:wd.daily.precipitation_sum[i],desc:wc[wd.daily.weathercode[i]]||'?'}))});
 }catch(e){return j({error:e.message},500)}}

 // ===== YAKIT FİYATLARI (Tankerkönig — ücretsiz) =====
 if(p==='/api/fuel'){try{
   const lat=u.searchParams.get('lat'),lon=u.searchParams.get('lon'),rad=u.searchParams.get('radius')||'5';
   if(!lat||!lon)return j({error:'LAT_LON_REQUIRED'},400);
   const fuelKey=await kvGet(env,'tankerkoenig_key','');
   if(!fuelKey)return j({error:'TANKERKOENIG_KEY_NOT_SET. Ayarlar > AI Sağlayıcı Anahtarları bölümünden ekle.'},400);
   const fr=await fetchT(`https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lon}&rad=${rad}&sort=price&type=all&apikey=${encodeURIComponent(fuelKey)}`);
   if(!fr.ok)return j({error:'FUEL_HTTP_'+fr.status},500);
   const fd=await fr.json();if(!fd.ok)return j({error:fd.message||'FUEL_API_ERROR'},500);
   return j({ok:true,stations:(fd.stations||[]).slice(0,10).map(s=>({name:s.name,brand:s.brand,dist:s.dist,diesel:s.diesel,e5:s.e5,e10:s.e10,open:s.isOpen,address:`${s.street} ${s.houseNumber}, ${s.postCode} ${s.place}`}))});
 }catch(e){return j({error:e.message},500)}}

 // ===== ÇEVİRİ (Cloudflare AI m2m100 — ücretsiz) =====
 if(p==='/api/translate'&&m==='POST'){try{
   const b=await body(req);const text=String(b.text||'').trim();if(!text)return j({error:'TEXT_REQUIRED'},400);
   if(!env.AI)return j({error:'AI_BINDING_MISSING'},500);
   const result=await env.AI.run('@cf/meta/m2m100-1.2b',{text,source_lang:b.source||'tr',target_lang:b.target||'de'});
   return j({ok:true,translated:result?.translated_text||'',source:b.source||'tr',target:b.target||'de'});
 }catch(e){return j({error:e.message},500)}}

 // ===== QR KOD =====
 if(p==='/api/qr'){const text=u.searchParams.get('text')||'';const size=u.searchParams.get('size')||'200';if(!text)return j({error:'TEXT_REQUIRED'},400);return j({ok:true,url:`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=svg`})}

 // ===== OCR (Cloudflare AI Vision — ücretsiz) =====
 if(p==='/api/ocr'&&m==='POST'){try{
   if(!env.AI)return j({error:'AI_BINDING_MISSING'},500);
   const b=await body(req);const b64=String(b.image||'');if(!b64)return j({error:'IMAGE_REQUIRED'},400);
   const result=await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct',{messages:[{role:'user',content:[{type:'text',text:'Bu görseldeki tüm metni oku ve yaz. Sadece metni yaz, başka bir şey ekleme.'},{type:'image',image:b64}]}],max_tokens:2000});
   return j({ok:true,text:result?.response||''});
 }catch(e){return j({error:e.message},500)}}

 // ===== VARDİYA PLANI =====
 if(p==='/api/shifts'){
   const start=u.searchParams.get('start')||new Date().toISOString().slice(0,10);const days=parseInt(u.searchParams.get('days')||'7');
   const shifts=(u.searchParams.get('shifts')||'08:00-16:00,16:00-00:00').split(',');
   const dayNames=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
   const result=[];const sd=new Date(start);
   for(let d=0;d<days;d++){const dt=new Date(sd);dt.setDate(sd.getDate()+d);const iso=dt.toISOString().slice(0,10);const wd=dt.getDay();result.push({date:iso,day:dayNames[wd],weekend:wd===0||wd===6,shifts:wd===0||wd===6?['İZİN']:shifts})}
   return j({ok:true,schedule:result});
 }

 // ===== DASHBOARD / İSTATİSTİKLER =====
 if(p==='/api/dashboard/stats'){try{
   const totalCustomers=await q1(env,'SELECT COUNT(*) n FROM customers');
   const totalJobs=await q1(env,'SELECT COUNT(*) n FROM jobs');
   const openJobs=await q1(env,'SELECT COUNT(*) n FROM jobs WHERE status=?','open');
   const completedJobs=await q1(env,'SELECT COUNT(*) n FROM jobs WHERE status=?','completed');
   const revenue=await q1(env,'SELECT COALESCE(SUM(price),0) total FROM jobs WHERE status=?','completed');
   const monthRevenue=await q1(env,'SELECT COALESCE(SUM(price),0) total FROM jobs WHERE status=? AND created_at>?','completed',now()-30*86400000);
   const totalInvoices=await q1(env,'SELECT COUNT(*) n FROM invoices');
   const recentJobs=await qall(env,'SELECT j.id,j.title,j.type,j.status,j.price,j.currency,j.created_at,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id ORDER BY j.created_at DESC LIMIT 10');
   const topCustomers=await qall(env,'SELECT c.name,COUNT(j.id) job_count,COALESCE(SUM(j.price),0) total_spent FROM customers c LEFT JOIN jobs j ON c.id=j.customer_id GROUP BY c.id ORDER BY total_spent DESC LIMIT 5');
   const totalAppointments=await q1(env,"SELECT COUNT(*) n FROM appointments WHERE status='scheduled'").catch(()=>({n:0}));
   return j({ok:true,customers:totalCustomers?.n||0,jobs:totalJobs?.n||0,openJobs:openJobs?.n||0,completedJobs:completedJobs?.n||0,revenue:revenue?.total||0,monthRevenue:monthRevenue?.total||0,invoices:totalInvoices?.n||0,upcomingAppointments:totalAppointments?.n||0,recentJobs,topCustomers});
 }catch(e){return j({error:e.message},500)}}

 // ===== RANDEVULAR =====
 if(p==='/api/appointments'&&m==='GET'){try{
   const status=u.searchParams.get('status')||'scheduled';
   const rows=await qall(env,'SELECT a.*,c.name as customer_name,c.plate as customer_plate FROM appointments a LEFT JOIN customers c ON a.customer_id=c.id WHERE a.status=? ORDER BY a.date ASC, a.time ASC LIMIT 50',status);
   return j({ok:true,appointments:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/appointments'&&m==='POST'){try{
   const b=await body(req);const title=String(b.title||'').trim();
   if(!title)return j({error:'TITLE_REQUIRED'},400);
   if(!b.date)return j({error:'DATE_REQUIRED'},400);
   const aId=id();const t=now();
   await run(env,'INSERT INTO appointments(id,customer_id,title,date,time,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',aId,b.customer_id||null,title,b.date,b.time||'10:00','scheduled',b.notes||'',t,t);
   await log(env,'appointment','Randevu eklendi: '+title+' ('+b.date+')',{id:aId});
   return j({ok:true,id:aId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/appointments\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['title','date','time','status','notes','customer_id']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE appointments SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM appointments WHERE id=?',mm[1]);return j({ok:true})}

 // ===== ARAÇ GEÇMİŞİ (Plaka bazlı arama) =====
 if(p==='/api/vehicle/history'){try{
   const plate=String(u.searchParams.get('plate')||'').trim().toUpperCase();
   if(!plate)return j({error:'PLATE_REQUIRED'},400);
   const term='%'+plate+'%';
   const customers=await qall(env,'SELECT * FROM customers WHERE UPPER(plate) LIKE ? ORDER BY updated_at DESC',term);
   const custIds=customers.map(c=>c.id);
   let jobs=[];
   if(custIds.length){const ph=custIds.map(()=>'?').join(',');jobs=await qall(env,`SELECT j.*,c.name as customer_name,c.plate as customer_plate FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id WHERE j.customer_id IN (${ph}) ORDER BY j.created_at DESC`,... custIds)}
   return j({ok:true,plate,customers,jobs});
 }catch(e){return j({error:e.message},500)}}

 // ===== NOT DEFTERİ =====
 if(p==='/api/notes'&&m==='GET'){try{
   const cat=u.searchParams.get('category')||'';
   const q=u.searchParams.get('q')||'';
   let sql='SELECT * FROM notes';const params=[];
   if(cat){sql+=' WHERE category=?';params.push(cat)}
   if(q){sql+=(cat?' AND':' WHERE')+" (UPPER(title) LIKE ? OR UPPER(content) LIKE ?)";const t='%'+q.toUpperCase()+'%';params.push(t,t)}
   sql+=' ORDER BY pinned DESC, updated_at DESC LIMIT 100';
   const rows=await qall(env,sql,...params);
   return j({ok:true,notes:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/notes'&&m==='POST'){try{
   const b=await body(req);const content=String(b.content||'').trim();
   if(!content)return j({error:'CONTENT_REQUIRED'},400);
   const nId=id();const t=now();
   await run(env,'INSERT INTO notes(id,title,content,category,pinned,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',nId,b.title||'',content,b.category||'genel',b.pinned?1:0,t,t);
   return j({ok:true,id:nId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/notes\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['title','content','category']){if(k in b){sets.push(k+'=?');vals.push(b[k])}}
   if('pinned' in b){sets.push('pinned=?');vals.push(b.pinned?1:0)}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE notes SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM notes WHERE id=?',mm[1]);return j({ok:true})}

 // ===== YAPILACAKLAR (TODOS) =====
 if(p==='/api/todos'&&m==='GET'){try{
   const done=u.searchParams.get('done');
   let sql='SELECT * FROM todos';const params=[];
   if(done!==null&&done!==''){sql+=' WHERE done=?';params.push(Number(done))}
   sql+=' ORDER BY done ASC, CASE priority WHEN \'high\' THEN 0 WHEN \'normal\' THEN 1 WHEN \'low\' THEN 2 END, due_date ASC, created_at DESC LIMIT 200';
   const rows=await qall(env,sql,...params);
   return j({ok:true,todos:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/todos'&&m==='POST'){try{
   const b=await body(req);const text=String(b.text||'').trim();
   if(!text)return j({error:'TEXT_REQUIRED'},400);
   const tId=id();const t=now();
   await run(env,'INSERT INTO todos(id,text,done,priority,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',tId,text,0,b.priority||'normal',b.due_date||'',t,t);
   return j({ok:true,id:tId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/todos\/([^/]+)$/);
 if(mm&&m==='POST'){try{
   const b=await body(req);const sets=[];const vals=[];
   if('text' in b){sets.push('text=?');vals.push(b.text)}
   if('done' in b){sets.push('done=?');vals.push(b.done?1:0)}
   if('priority' in b){sets.push('priority=?');vals.push(b.priority)}
   if('due_date' in b){sets.push('due_date=?');vals.push(b.due_date)}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE todos SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM todos WHERE id=?',mm[1]);return j({ok:true})}

 // ===== MÜŞTERİ RAPORU =====
 if(p==='/api/customer/report'){try{
   const cid=u.searchParams.get('id')||'';
   if(!cid)return j({error:'ID_REQUIRED'},400);
   const customer=await q1(env,'SELECT * FROM customers WHERE id=?',cid);
   if(!customer)return j({error:'NOT_FOUND'},404);
   const jobs=await qall(env,'SELECT * FROM jobs WHERE customer_id=? ORDER BY created_at DESC',cid);
   const invoices=await qall(env,'SELECT * FROM invoices WHERE customer_id=? ORDER BY created_at DESC',cid);
   const appointments=await qall(env,'SELECT * FROM appointments WHERE customer_id=? ORDER BY date DESC',cid).catch(()=>[]);
   const contacts=await qall(env,'SELECT * FROM contact_log WHERE customer_id=? ORDER BY created_at DESC',cid).catch(()=>[]);
   const totalSpent=jobs.reduce((s,j)=>s+(j.price||0),0);
   const completedJobs=jobs.filter(j=>j.status==='completed').length;
   const openJobs=jobs.filter(j=>j.status==='open').length;
   return j({ok:true,customer,jobs,invoices,appointments,contacts,summary:{totalJobs:jobs.length,completedJobs,openJobs,totalSpent,invoiceCount:invoices.length,contactCount:contacts.length}});
 }catch(e){return j({error:e.message},500)}}

 // ===== HIZLI İŞ OLUŞTUR (tek adımda müşteri + iş + randevu) =====
 if(p==='/api/quick-job'&&m==='POST'){try{
   const b=await body(req);
   const t=now();let customerId=b.customer_id||'';
   // Müşteri yoksa oluştur
   if(!customerId&&b.customer_name){
     customerId=id();
     await run(env,'INSERT INTO customers(id,name,phone,email,vehicle,plate,notes,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',customerId,b.customer_name,b.phone||'',b.email||'',b.vehicle||'',b.plate||'','','[]',t,t);
   }
   if(!customerId)return j({error:'CUSTOMER_REQUIRED'},400);
   // İş oluştur
   const jobId=id();
   await run(env,'INSERT INTO jobs(id,customer_id,type,title,description,status,price,currency,files,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',jobId,customerId,b.type||'tuning',b.title||'ECU Tuning',b.description||'','open',Number(b.price||0),b.currency||'EUR','[]',b.notes||'',t,t);
   // Randevu oluştur (opsiyonel)
   let aptId=null;
   if(b.date){
     aptId=id();
     await run(env,'INSERT INTO appointments(id,customer_id,title,date,time,status,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',aptId,customerId,b.title||'ECU Tuning',b.date,b.time||'10:00','scheduled','',t,t);
   }
   // Gelir kaydı (fiyat varsa)
   if(Number(b.price)>0){
     await run(env,'INSERT INTO transactions(id,type,amount,currency,category,description,date,customer_id,job_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id(),'income',Number(b.price),b.currency||'EUR',b.type||'tuning',(b.customer_name||'')+ ' — '+(b.title||'ECU Tuning'),b.date||new Date().toISOString().slice(0,10),customerId,jobId,t,t).catch(()=>{});
   }
   await log(env,'quick-job','Hızlı iş: '+(b.customer_name||customerId)+' — '+(b.title||'ECU Tuning'),{jobId,customerId,aptId});
   return j({ok:true,customerId,jobId,aptId});
 }catch(e){return j({error:e.message},500)}}

 // ===== MÜŞTERİ İLETİŞİM KAYDI =====
 if(p==='/api/contacts'&&m==='GET'){try{
   const cid=u.searchParams.get('customer_id')||'';
   let sql='SELECT cl.*,c.name as customer_name,c.plate as customer_plate FROM contact_log cl LEFT JOIN customers c ON cl.customer_id=c.id';const params=[];
   if(cid){sql+=' WHERE cl.customer_id=?';params.push(cid)}
   sql+=' ORDER BY cl.created_at DESC LIMIT 100';
   const rows=await qall(env,sql,...params);
   return j({ok:true,contacts:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/contacts'&&m==='POST'){try{
   const b=await body(req);
   if(!b.customer_id||!b.summary)return j({error:'CUSTOMER_AND_SUMMARY_REQUIRED'},400);
   const cId=id();const t=now();
   await run(env,'INSERT INTO contact_log(id,customer_id,channel,direction,summary,created_at) VALUES(?,?,?,?,?,?)',cId,b.customer_id,b.channel||'whatsapp',b.direction||'outgoing',b.summary,t);
   return j({ok:true,id:cId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/contacts\/([^/]+)$/);
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM contact_log WHERE id=?',mm[1]);return j({ok:true})}

 // ===== VERİ YEDEKLEME / DIŞA AKTARMA =====
 if(p==='/api/export'&&m==='GET'){try{
   const tables=['customers','jobs','invoices','appointments','notes','todos','price_list','transactions','contact_log'];
   const data={exported_at:new Date().toISOString(),tables:{}};
   for(const t of tables){try{data.tables[t]=await qall(env,'SELECT * FROM '+t)}catch{data.tables[t]=[]}}
   return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="jarvis-backup-'+new Date().toISOString().slice(0,10)+'.json"','Access-Control-Allow-Origin':'*'}});
 }catch(e){return j({error:e.message},500)}}

 // ===== FİYAT LİSTESİ =====
 if(p==='/api/prices'&&m==='GET'){try{
   const cat=u.searchParams.get('category')||'';
   let sql='SELECT * FROM price_list WHERE active=1';const params=[];
   if(cat){sql+=' AND category=?';params.push(cat)}
   sql+=' ORDER BY category, price ASC';
   const rows=await qall(env,sql,...params);
   return j({ok:true,prices:rows});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/prices'&&m==='POST'){try{
   const b=await body(req);
   if(!b.service||!b.price)return j({error:'SERVICE_AND_PRICE_REQUIRED'},400);
   const pId=id();const t=now();
   await run(env,'INSERT INTO price_list(id,service,description,price,currency,category,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',pId,b.service,b.description||'',Number(b.price),b.currency||'EUR',b.category||'tuning',1,t,t);
   return j({ok:true,id:pId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/prices\/([^/]+)$/);
 if(mm&&m==='PATCH'){try{
   const b=await body(req);const sets=[];const vals=[];
   for(const k of ['service','description','price','currency','category','active']){if(k in b){sets.push(k+'=?');vals.push(k==='price'?Number(b[k]):k==='active'?(b[k]?1:0):b[k])}}
   if(!sets.length)return j({error:'NO_FIELDS'},400);
   sets.push('updated_at=?');vals.push(now());vals.push(mm[1]);
   await run(env,`UPDATE price_list SET ${sets.join(',')} WHERE id=?`,...vals);
   return j({ok:true});
 }catch(e){return j({error:e.message},500)}}
 if(mm&&m==='DELETE'){await run(env,'UPDATE price_list SET active=0 WHERE id=?',mm[1]);return j({ok:true})}

 // ===== GELİR/GİDER TAKİBİ =====
 if(p==='/api/transactions'&&m==='GET'){try{
   const type=u.searchParams.get('type')||'';
   const month=u.searchParams.get('month')||'';
   let sql='SELECT * FROM transactions';const params=[];const conds=[];
   if(type){conds.push('type=?');params.push(type)}
   if(month){conds.push("date LIKE ?");params.push(month+'%')}
   if(conds.length)sql+=' WHERE '+conds.join(' AND ');
   sql+=' ORDER BY date DESC, created_at DESC LIMIT 200';
   const rows=await qall(env,sql,...params);
   // Toplamlar
   const incomeQ=await q1(env,"SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='income'"+(month?" AND date LIKE '"+month+"%'":""));
   const expenseQ=await q1(env,"SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE type='expense'"+(month?" AND date LIKE '"+month+"%'":""));
   return j({ok:true,transactions:rows,income:incomeQ?.total||0,expense:expenseQ?.total||0,profit:(incomeQ?.total||0)-(expenseQ?.total||0)});
 }catch(e){return j({error:e.message},500)}}
 if(p==='/api/transactions'&&m==='POST'){try{
   const b=await body(req);
   if(!b.amount)return j({error:'AMOUNT_REQUIRED'},400);
   if(!b.date)return j({error:'DATE_REQUIRED'},400);
   const tId=id();const t=now();
   await run(env,'INSERT INTO transactions(id,type,amount,currency,category,description,date,customer_id,job_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',tId,b.type||'income',Number(b.amount),b.currency||'EUR',b.category||'genel',b.description||'',b.date,b.customer_id||'',b.job_id||'',t,t);
   return j({ok:true,id:tId});
 }catch(e){return j({error:e.message},500)}}
 mm=p.match(/^\/api\/transactions\/([^/]+)$/);
 if(mm&&m==='DELETE'){await run(env,'DELETE FROM transactions WHERE id=?',mm[1]);return j({ok:true})}

 // ===== İŞ TAKVİMİ (tarih bazlı özet) =====
 if(p==='/api/calendar/day'){try{
   const date=u.searchParams.get('date')||new Date().toISOString().slice(0,10);
   const appointments=await qall(env,'SELECT a.*,c.name as customer_name,c.plate as customer_plate FROM appointments a LEFT JOIN customers c ON a.customer_id=c.id WHERE a.date=? ORDER BY a.time ASC',date).catch(()=>[]);
   const jobs=await qall(env,'SELECT j.*,c.name as customer_name FROM jobs j LEFT JOIN customers c ON j.customer_id=c.id WHERE date(j.created_at/1000,\'unixepoch\')=? ORDER BY j.created_at DESC',date).catch(()=>[]);
   const todos=await qall(env,'SELECT * FROM todos WHERE due_date=? ORDER BY done ASC, priority ASC',date).catch(()=>[]);
   return j({ok:true,date,appointments,jobs,todos});
 }catch(e){return j({error:e.message},500)}}

 return j({error:'NOT_FOUND'},404)}
async function runScheduledJobs(env){
  try{
    const jobs=await qall(env,'SELECT * FROM scheduled_jobs WHERE status=? AND next_run<=? LIMIT 5','active',now());
    for(const job of jobs){
      try{
        if(job.type==='social_post'){
          // 1) AI ile içerik üret (ücretsiz — bağlı provider)
          const contentPrompt=`Sen sosyal medya uzmanısın. Şu konu hakkında kısa, dikkat çekici bir ${job.platform} paylaşımı yaz (Türkçe, max 280 karakter, emoji kullan): ${job.topic}`;
          const a=await aiFallback(env,[{role:'user',content:contentPrompt}],{mode:'fast'});
          const text=a?.text||job.topic;
          // 2) Görsel üret (Cloudflare AI — ücretsiz)
          let imageKey=null;
          if(env.AI&&job.platform==='instagram'){
            try{
              const imgPrompt=`Professional social media post image about: ${job.topic}. Modern, clean, automotive style.`;
              const result=await env.AI.run('@cf/black-forest-labs/FLUX.1-schnell',{prompt:imgPrompt,num_steps:4});
              if(result?.image){
                const imgId=id();
                imageKey='images/'+imgId+'.png';
                const imgBytes=Uint8Array.from(atob(result.image),c=>c.charCodeAt(0));
                await filePut(env,imageKey,imgBytes,{contentType:'image/png'});
              }
            }catch{}
          }
          // 3) Onay kuyruğuna koy (otomatik paylaşma — Haydar onaylasın)
          await pendingAction(env,job.platform==='instagram'?'instagram_post':'facebook_post',{
            message:text,
            caption:text,
            imageUrl:imageKey?`/api/ai/image/serve?id=${imageKey.replace('images/','').replace('.png','')}`:'',
            scheduledJobId:job.id,
            topic:job.topic
          },`Zamanlanmış ${job.platform} paylaşımı: ${text.slice(0,80)}...`,'low');
          await log(env,'social-auto','Zamanlanmış paylaşım onay kuyruğuna eklendi: '+text.slice(0,100),{platform:job.platform,jobId:job.id});
        }
        // Sonraki çalışmayı ayarla
        const intervals={daily:86400000,weekly:604800000,biweekly:1209600000,monthly:2592000000};
        const interval=intervals[job.cadence]||604800000;
        await run(env,'UPDATE scheduled_jobs SET last_run=?,next_run=? WHERE id=?',now(),now()+interval,job.id);
      }catch(e){
        await recordRuntimeError(env,e,'scheduled.social.'+job.id);
      }
    }
  }catch{}
}

export default {async fetch(req,env,ctx){try{const u=new URL(req.url);if(u.pathname==='/api/version')return j({ok:true,version:'fast-chat-2026-09-13-2',ts:now()});if(u.pathname.startsWith('/api/')){if(!env.DB)return j({error:'D1_NOT_BOUND',detail:'Cloudflare D1 binding DB is missing.'},500);const ip=clientIP(req),gl=await rateLimit(env,ip,'global-api',60,60000);if(!gl.allowed)return rateLimitResponse(gl.retryAfter);return await router(req,env,ctx)}return env.ASSETS.fetch(req)}catch(e){console.error(e);if(env.DB)await recordRuntimeError(env,e,new URL(req.url).pathname);return j({error:'SERVER_ERROR',detail:e.message},500)}},async scheduled(event,env,ctx){ctx.waitUntil(Promise.all([ensureRateLimitTable(env),rateLimitCleanup(env),selfHeal(env),runScheduledJobs(env)]))}};
