// DTC Database — Comprehensive Diagnostic Trouble Code library
// Covers OBD-II standard + manufacturer-specific codes for common ECU types
// Used by: /api/ecu/dtc/* endpoints

// ========== OBD-II Standard DTC Categories ==========
const DTC_CATEGORIES = {
  P0: { name: 'Powertrain (Generic)', system: 'engine' },
  P1: { name: 'Powertrain (Manufacturer)', system: 'engine' },
  P2: { name: 'Powertrain (Generic Extended)', system: 'engine' },
  P3: { name: 'Powertrain (Reserved)', system: 'engine' },
  B0: { name: 'Body (Generic)', system: 'body' },
  B1: { name: 'Body (Manufacturer)', system: 'body' },
  C0: { name: 'Chassis (Generic)', system: 'chassis' },
  C1: { name: 'Chassis (Manufacturer)', system: 'chassis' },
  U0: { name: 'Network (Generic)', system: 'network' },
  U1: { name: 'Network (Manufacturer)', system: 'network' },
};

// ========== Comprehensive DTC Database ==========
// Format: code -> { desc, system, severity, causes[], solutions[], relatedSystems[] }
const DTC_DB = {
  // === FUEL & AIR METERING ===
  P0100: { desc: 'Mass Air Flow Circuit Malfunction', system: 'intake', severity: 'high', causes: ['Dirty MAF sensor', 'Damaged MAF wiring', 'Air leak after MAF', 'Faulty MAF sensor'], solutions: ['Clean MAF sensor with MAF cleaner', 'Check wiring and connector', 'Inspect air intake ducting for leaks', 'Replace MAF sensor'], relatedSystems: ['egr', 'boost'] },
  P0101: { desc: 'MAF Circuit Range/Performance', system: 'intake', severity: 'medium', causes: ['Dirty MAF sensor', 'Vacuum leak', 'Restricted air filter'], solutions: ['Clean MAF sensor', 'Check for vacuum leaks', 'Replace air filter'], relatedSystems: ['egr'] },
  P0102: { desc: 'MAF Circuit Low Input', system: 'intake', severity: 'high', causes: ['Faulty MAF sensor', 'Wiring short to ground', 'Air leak'], solutions: ['Check MAF wiring', 'Test MAF sensor voltage', 'Replace MAF sensor'], relatedSystems: [] },
  P0103: { desc: 'MAF Circuit High Input', system: 'intake', severity: 'high', causes: ['Faulty MAF sensor', 'Wiring short to power', 'ECU fault'], solutions: ['Check MAF wiring', 'Test MAF sensor voltage', 'Replace MAF sensor'], relatedSystems: [] },
  P0106: { desc: 'MAP/BARO Pressure Circuit Range/Performance', system: 'intake', severity: 'medium', causes: ['Faulty MAP sensor', 'Vacuum leak', 'Blocked vacuum hose'], solutions: ['Check MAP sensor vacuum hose', 'Test MAP sensor', 'Replace MAP sensor'], relatedSystems: ['boost'] },
  P0107: { desc: 'MAP/BARO Pressure Circuit Low', system: 'intake', severity: 'high', causes: ['Faulty MAP sensor', 'Wiring issue', 'Disconnected vacuum hose'], solutions: ['Check vacuum connections', 'Test MAP wiring', 'Replace MAP sensor'], relatedSystems: ['boost'] },
  P0108: { desc: 'MAP/BARO Pressure Circuit High', system: 'intake', severity: 'high', causes: ['Faulty MAP sensor', 'Short to power', 'Blocked vacuum line'], solutions: ['Check vacuum lines', 'Test MAP wiring', 'Replace MAP sensor'], relatedSystems: ['boost'] },
  P0110: { desc: 'Intake Air Temperature Circuit Malfunction', system: 'intake', severity: 'low', causes: ['Faulty IAT sensor', 'Damaged wiring', 'Poor connection'], solutions: ['Check IAT sensor connector', 'Test IAT sensor resistance', 'Replace IAT sensor'], relatedSystems: [] },
  P0112: { desc: 'IAT Circuit Low Input', system: 'intake', severity: 'low', causes: ['Short circuit', 'Faulty IAT sensor'], solutions: ['Check wiring', 'Replace IAT sensor'], relatedSystems: [] },
  P0113: { desc: 'IAT Circuit High Input', system: 'intake', severity: 'low', causes: ['Open circuit', 'Faulty IAT sensor', 'Poor connector'], solutions: ['Check wiring and connector', 'Replace IAT sensor'], relatedSystems: [] },
  P0115: { desc: 'Engine Coolant Temperature Circuit Malfunction', system: 'cooling', severity: 'high', causes: ['Faulty ECT sensor', 'Damaged wiring', 'Corrosion'], solutions: ['Check ECT wiring', 'Test ECT sensor resistance', 'Replace ECT sensor'], relatedSystems: [] },
  P0116: { desc: 'ECT Circuit Range/Performance', system: 'cooling', severity: 'medium', causes: ['Stuck thermostat', 'Faulty ECT sensor', 'Low coolant'], solutions: ['Check coolant level', 'Test thermostat operation', 'Replace ECT sensor'], relatedSystems: [] },
  P0117: { desc: 'ECT Circuit Low Input', system: 'cooling', severity: 'medium', causes: ['Short to ground', 'Faulty ECT sensor'], solutions: ['Check wiring', 'Replace ECT sensor'], relatedSystems: [] },
  P0118: { desc: 'ECT Circuit High Input', system: 'cooling', severity: 'medium', causes: ['Open circuit', 'Faulty ECT sensor'], solutions: ['Check wiring and connector', 'Replace ECT sensor'], relatedSystems: [] },
  P0120: { desc: 'Throttle Position Sensor Circuit Malfunction', system: 'throttle', severity: 'critical', causes: ['Faulty TPS', 'Wiring damage', 'ECU fault'], solutions: ['Check TPS wiring', 'Test TPS signal', 'Replace TPS', 'Check throttle body'], relatedSystems: ['speed_limiter'] },
  P0121: { desc: 'TPS Range/Performance Problem', system: 'throttle', severity: 'high', causes: ['Worn TPS', 'Dirty throttle body', 'Wiring issue'], solutions: ['Clean throttle body', 'Test TPS output', 'Replace TPS'], relatedSystems: ['speed_limiter'] },
  P0122: { desc: 'TPS Circuit Low Input', system: 'throttle', severity: 'high', causes: ['Short to ground', 'Faulty TPS'], solutions: ['Check wiring', 'Replace TPS'], relatedSystems: [] },
  P0123: { desc: 'TPS Circuit High Input', system: 'throttle', severity: 'high', causes: ['Short to power', 'Faulty TPS'], solutions: ['Check wiring', 'Replace TPS'], relatedSystems: [] },
  P0130: { desc: 'O2 Sensor Circuit Malfunction (Bank 1 Sensor 1)', system: 'exhaust', severity: 'medium', causes: ['Faulty O2 sensor', 'Exhaust leak', 'Wiring damage'], solutions: ['Check O2 sensor wiring', 'Inspect exhaust for leaks', 'Replace O2 sensor'], relatedSystems: ['lambda', 'catalytic_converter'] },
  P0131: { desc: 'O2 Sensor Low Voltage (B1S1)', system: 'exhaust', severity: 'medium', causes: ['Lean condition', 'Vacuum leak', 'Faulty O2 sensor'], solutions: ['Check for vacuum leaks', 'Check fuel pressure', 'Replace O2 sensor'], relatedSystems: ['lambda'] },
  P0132: { desc: 'O2 Sensor High Voltage (B1S1)', system: 'exhaust', severity: 'medium', causes: ['Rich condition', 'Faulty O2 sensor', 'Short to power'], solutions: ['Check fuel injectors', 'Check fuel pressure regulator', 'Replace O2 sensor'], relatedSystems: ['lambda'] },
  P0133: { desc: 'O2 Sensor Slow Response (B1S1)', system: 'exhaust', severity: 'medium', causes: ['Aging O2 sensor', 'Contaminated sensor', 'Exhaust leak'], solutions: ['Replace O2 sensor', 'Check exhaust system'], relatedSystems: ['lambda', 'catalytic_converter'] },
  P0134: { desc: 'O2 Sensor No Activity Detected (B1S1)', system: 'exhaust', severity: 'high', causes: ['Open circuit', 'Faulty O2 sensor', 'Damaged heater'], solutions: ['Check wiring', 'Test O2 sensor heater', 'Replace O2 sensor'], relatedSystems: ['lambda'] },
  P0170: { desc: 'Fuel Trim Malfunction (Bank 1)', system: 'fuel', severity: 'medium', causes: ['Vacuum leak', 'Faulty fuel injector', 'Fuel pressure issue'], solutions: ['Check vacuum hoses', 'Test fuel injectors', 'Check fuel pressure'], relatedSystems: ['lambda'] },
  P0171: { desc: 'System Too Lean (Bank 1)', system: 'fuel', severity: 'medium', causes: ['Vacuum leak', 'Low fuel pressure', 'Dirty fuel injectors', 'MAF sensor fault'], solutions: ['Smoke test for vacuum leaks', 'Check fuel pressure', 'Clean/replace fuel injectors', 'Clean MAF sensor'], relatedSystems: ['lambda', 'egr'] },
  P0172: { desc: 'System Too Rich (Bank 1)', system: 'fuel', severity: 'medium', causes: ['Leaking fuel injector', 'High fuel pressure', 'Faulty O2 sensor', 'Dirty air filter'], solutions: ['Check fuel injectors', 'Test fuel pressure', 'Replace O2 sensor', 'Replace air filter'], relatedSystems: ['lambda'] },
  P0174: { desc: 'System Too Lean (Bank 2)', system: 'fuel', severity: 'medium', causes: ['Vacuum leak (Bank 2)', 'Intake gasket leak', 'Low fuel pressure'], solutions: ['Smoke test for leaks', 'Check intake gaskets', 'Check fuel pressure'], relatedSystems: ['lambda'] },
  P0175: { desc: 'System Too Rich (Bank 2)', system: 'fuel', severity: 'medium', causes: ['Leaking fuel injector (Bank 2)', 'Faulty O2 sensor B2S1'], solutions: ['Check fuel injectors', 'Replace O2 sensor'], relatedSystems: ['lambda'] },

  // === IGNITION SYSTEM ===
  P0300: { desc: 'Random/Multiple Cylinder Misfire Detected', system: 'ignition', severity: 'critical', causes: ['Bad spark plugs', 'Faulty ignition coils', 'Fuel delivery issue', 'Vacuum leak', 'Low compression'], solutions: ['Replace spark plugs', 'Test/replace ignition coils', 'Check fuel pressure', 'Compression test'], relatedSystems: ['catalytic_converter'] },
  P0301: { desc: 'Cylinder 1 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #1', 'Faulty coil #1', 'Injector #1 fault'], solutions: ['Swap coil to test', 'Replace spark plug #1', 'Check injector #1'], relatedSystems: [] },
  P0302: { desc: 'Cylinder 2 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #2', 'Faulty coil #2', 'Injector #2 fault'], solutions: ['Swap coil to test', 'Replace spark plug #2', 'Check injector #2'], relatedSystems: [] },
  P0303: { desc: 'Cylinder 3 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #3', 'Faulty coil #3', 'Injector #3 fault'], solutions: ['Swap coil to test', 'Replace spark plug #3', 'Check injector #3'], relatedSystems: [] },
  P0304: { desc: 'Cylinder 4 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #4', 'Faulty coil #4', 'Injector #4 fault'], solutions: ['Swap coil to test', 'Replace spark plug #4', 'Check injector #4'], relatedSystems: [] },
  P0305: { desc: 'Cylinder 5 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #5', 'Faulty coil #5', 'Injector #5 fault'], solutions: ['Swap coil to test', 'Replace spark plug #5', 'Check injector #5'], relatedSystems: [] },
  P0306: { desc: 'Cylinder 6 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #6', 'Faulty coil #6', 'Injector #6 fault'], solutions: ['Swap coil to test', 'Replace spark plug #6', 'Check injector #6'], relatedSystems: [] },
  P0307: { desc: 'Cylinder 7 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #7', 'Faulty coil #7'], solutions: ['Swap coil to test', 'Replace spark plug #7'], relatedSystems: [] },
  P0308: { desc: 'Cylinder 8 Misfire Detected', system: 'ignition', severity: 'high', causes: ['Bad spark plug #8', 'Faulty coil #8'], solutions: ['Swap coil to test', 'Replace spark plug #8'], relatedSystems: [] },
  P0325: { desc: 'Knock Sensor 1 Circuit Malfunction', system: 'ignition', severity: 'high', causes: ['Faulty knock sensor', 'Wiring issue', 'Incorrect torque'], solutions: ['Check knock sensor wiring', 'Replace knock sensor', 'Check mounting torque'], relatedSystems: [] },
  P0335: { desc: 'Crankshaft Position Sensor A Circuit Malfunction', system: 'ignition', severity: 'critical', causes: ['Faulty CKP sensor', 'Damaged reluctor wheel', 'Wiring damage'], solutions: ['Check CKP sensor gap', 'Inspect reluctor wheel', 'Replace CKP sensor'], relatedSystems: [] },
  P0340: { desc: 'Camshaft Position Sensor Circuit Malfunction', system: 'ignition', severity: 'critical', causes: ['Faulty CMP sensor', 'Timing chain stretch', 'Wiring damage'], solutions: ['Check CMP sensor', 'Check timing chain', 'Replace CMP sensor'], relatedSystems: [] },

  // === EMISSIONS / EGR / DPF / CATALYST ===
  P0400: { desc: 'EGR Flow Malfunction', system: 'egr', severity: 'medium', causes: ['Carbon buildup in EGR valve', 'Stuck EGR valve', 'Faulty EGR vacuum solenoid', 'Blocked EGR passages'], solutions: ['Clean EGR valve', 'Replace EGR valve', 'Clean EGR passages', 'Check vacuum lines'], relatedSystems: ['dpf', 'intake'] },
  P0401: { desc: 'EGR Insufficient Flow Detected', system: 'egr', severity: 'medium', causes: ['Carbon clogged EGR valve', 'Blocked EGR tube', 'Faulty DPFE sensor'], solutions: ['Clean EGR valve and passages', 'Replace DPFE sensor', 'Check EGR tube for blockage'], relatedSystems: ['dpf'] },
  P0402: { desc: 'EGR Excessive Flow Detected', system: 'egr', severity: 'medium', causes: ['EGR valve stuck open', 'Faulty DPFE sensor', 'Vacuum leak'], solutions: ['Replace EGR valve', 'Replace DPFE sensor', 'Check vacuum lines'], relatedSystems: [] },
  P0403: { desc: 'EGR Control Circuit Malfunction', system: 'egr', severity: 'medium', causes: ['Faulty EGR solenoid', 'Wiring damage', 'ECU fault'], solutions: ['Check EGR solenoid wiring', 'Test EGR solenoid', 'Replace EGR solenoid'], relatedSystems: [] },
  P0404: { desc: 'EGR Control Circuit Range/Performance', system: 'egr', severity: 'medium', causes: ['Carbon buildup', 'Faulty EGR actuator', 'Position sensor fault'], solutions: ['Clean EGR valve', 'Replace EGR valve', 'Check position sensor'], relatedSystems: [] },
  P0420: { desc: 'Catalyst System Efficiency Below Threshold (Bank 1)', system: 'catalytic_converter', severity: 'high', causes: ['Worn catalytic converter', 'Exhaust leak before cat', 'Faulty rear O2 sensor', 'Engine misfire damage'], solutions: ['Replace catalytic converter', 'Check exhaust for leaks', 'Replace rear O2 sensor', 'Fix misfires first'], relatedSystems: ['lambda', 'egr'] },
  P0421: { desc: 'Warm Up Catalyst Efficiency Below Threshold (B1)', system: 'catalytic_converter', severity: 'high', causes: ['Damaged catalyst', 'Contaminated catalyst'], solutions: ['Replace catalytic converter', 'Fix underlying cause'], relatedSystems: ['lambda'] },
  P0430: { desc: 'Catalyst System Efficiency Below Threshold (Bank 2)', system: 'catalytic_converter', severity: 'high', causes: ['Worn catalytic converter B2', 'Exhaust leak', 'Faulty rear O2 sensor B2S2'], solutions: ['Replace catalytic converter', 'Check exhaust system', 'Replace rear O2 sensor B2S2'], relatedSystems: ['lambda'] },

  // === EVAPORATIVE SYSTEM ===
  P0440: { desc: 'EVAP System Malfunction', system: 'evap', severity: 'low', causes: ['Loose gas cap', 'Faulty purge valve', 'EVAP canister leak'], solutions: ['Tighten/replace gas cap', 'Test purge valve', 'Smoke test EVAP system'], relatedSystems: [] },
  P0441: { desc: 'EVAP Incorrect Purge Flow', system: 'evap', severity: 'low', causes: ['Faulty purge valve', 'Blocked vacuum hose', 'EVAP canister fault'], solutions: ['Replace purge valve', 'Check vacuum hoses', 'Inspect EVAP canister'], relatedSystems: [] },
  P0442: { desc: 'EVAP System Small Leak Detected', system: 'evap', severity: 'low', causes: ['Gas cap seal', 'Small hose crack', 'EVAP canister issue'], solutions: ['Replace gas cap', 'Smoke test EVAP system', 'Check all hoses'], relatedSystems: [] },
  P0443: { desc: 'EVAP Purge Control Valve Circuit Malfunction', system: 'evap', severity: 'low', causes: ['Faulty purge solenoid', 'Wiring issue'], solutions: ['Test purge solenoid', 'Check wiring'], relatedSystems: [] },
  P0455: { desc: 'EVAP System Large Leak Detected', system: 'evap', severity: 'medium', causes: ['Missing/loose gas cap', 'Disconnected EVAP hose', 'Cracked EVAP canister'], solutions: ['Check gas cap', 'Inspect all EVAP hoses', 'Smoke test system'], relatedSystems: [] },
  P0456: { desc: 'EVAP System Very Small Leak Detected', system: 'evap', severity: 'low', causes: ['Aging gas cap seal', 'Minor hose porosity'], solutions: ['Replace gas cap', 'Smoke test for micro leaks'], relatedSystems: [] },

  // === VEHICLE SPEED / IDLE CONTROL ===
  P0500: { desc: 'Vehicle Speed Sensor Malfunction', system: 'transmission', severity: 'high', causes: ['Faulty VSS', 'Damaged wiring', 'Gear/tone ring damage'], solutions: ['Check VSS connector', 'Test VSS signal', 'Replace VSS'], relatedSystems: ['speed_limiter'] },
  P0505: { desc: 'Idle Control System Malfunction', system: 'throttle', severity: 'medium', causes: ['Dirty throttle body', 'Faulty IAC valve', 'Vacuum leak'], solutions: ['Clean throttle body', 'Replace IAC valve', 'Check vacuum hoses'], relatedSystems: [] },
  P0506: { desc: 'Idle Control System RPM Lower Than Expected', system: 'throttle', severity: 'medium', causes: ['Vacuum leak', 'Dirty throttle body', 'EGR stuck open'], solutions: ['Check for vacuum leaks', 'Clean throttle body', 'Check EGR valve'], relatedSystems: ['egr'] },
  P0507: { desc: 'Idle Control System RPM Higher Than Expected', system: 'throttle', severity: 'medium', causes: ['Vacuum leak', 'Dirty throttle body', 'IAC valve stuck'], solutions: ['Clean throttle body', 'Check IAC valve', 'Check for vacuum leaks'], relatedSystems: [] },

  // === TURBO / BOOST ===
  P0234: { desc: 'Turbocharger Overboost Condition', system: 'boost', severity: 'critical', causes: ['Stuck wastegate', 'Faulty boost control solenoid', 'Boost leak'], solutions: ['Check wastegate operation', 'Test boost solenoid', 'Inspect boost piping'], relatedSystems: ['speed_limiter'] },
  P0235: { desc: 'Turbocharger Boost Sensor A Circuit Malfunction', system: 'boost', severity: 'high', causes: ['Faulty boost sensor', 'Wiring damage'], solutions: ['Check boost sensor wiring', 'Replace boost sensor'], relatedSystems: [] },
  P0236: { desc: 'Turbocharger Boost Sensor A Range/Performance', system: 'boost', severity: 'high', causes: ['Boost leak', 'Faulty sensor', 'Stuck wastegate'], solutions: ['Check boost piping', 'Test boost sensor', 'Check wastegate'], relatedSystems: [] },
  P0243: { desc: 'Turbocharger Wastegate Solenoid A Malfunction', system: 'boost', severity: 'high', causes: ['Faulty wastegate solenoid', 'Wiring damage', 'Stuck wastegate'], solutions: ['Test wastegate solenoid', 'Check wiring', 'Inspect wastegate mechanical operation'], relatedSystems: [] },
  P0244: { desc: 'Turbocharger Wastegate Solenoid A Range/Performance', system: 'boost', severity: 'high', causes: ['Worn wastegate actuator', 'Incorrect boost reference'], solutions: ['Replace wastegate actuator', 'Check boost hoses'], relatedSystems: [] },
  P0299: { desc: 'Turbocharger/Supercharger Underboost', system: 'boost', severity: 'high', causes: ['Boost leak', 'Worn turbo', 'Stuck wastegate', 'Dirty VNT vanes'], solutions: ['Pressure test boost system', 'Check turbo play', 'Clean VNT mechanism', 'Check wastegate'], relatedSystems: ['dpf', 'egr'] },

  // === DPF / SCR / ADBLUE (DIESEL-SPECIFIC) ===
  P2002: { desc: 'DPF Efficiency Below Threshold', system: 'dpf', severity: 'critical', causes: ['Clogged DPF filter', 'Failed regeneration cycles', 'Excess soot from EGR issue'], solutions: ['Force DPF regeneration', 'Professional DPF clean', 'Fix root cause (EGR, injectors)', 'Replace DPF if damaged'], relatedSystems: ['egr', 'exhaust'] },
  P2003: { desc: 'DPF Efficiency Below Threshold (Bank 2)', system: 'dpf', severity: 'critical', causes: ['Clogged DPF filter B2'], solutions: ['Force regeneration', 'Professional DPF clean', 'Replace DPF'], relatedSystems: ['egr'] },
  P244A: { desc: 'DPF Differential Pressure Too Low', system: 'dpf', severity: 'high', causes: ['Faulty DPF pressure sensor', 'Blocked sensor tubes', 'DPF removed/deleted'], solutions: ['Clean pressure sensor tubes', 'Replace DPF pressure sensor', 'Check DPF installation'], relatedSystems: [] },
  P244B: { desc: 'DPF Differential Pressure Too High', system: 'dpf', severity: 'critical', causes: ['Heavily clogged DPF', 'Blocked exhaust', 'Faulty sensor'], solutions: ['Emergency DPF regeneration', 'Professional DPF clean', 'Check pressure sensor'], relatedSystems: ['egr'] },
  P2458: { desc: 'DPF Regeneration Duration', system: 'dpf', severity: 'medium', causes: ['Frequent short trips', 'Low exhaust temperature', 'Faulty 5th injector'], solutions: ['Extended highway driving', 'Check 5th injector', 'Forced regeneration'], relatedSystems: [] },
  P2459: { desc: 'DPF Regeneration Frequency', system: 'dpf', severity: 'medium', causes: ['Poor fuel quality', 'EGR issue causing excess soot', 'Oil consumption'], solutions: ['Use quality diesel', 'Fix EGR system', 'Check engine oil consumption'], relatedSystems: ['egr'] },
  P20EE: { desc: 'SCR NOx Catalyst Efficiency Below Threshold', system: 'adblue', severity: 'critical', causes: ['Poor quality AdBlue', 'SCR catalyst degradation', 'AdBlue injection fault', 'AdBlue crystallization'], solutions: ['Replace AdBlue with quality fluid', 'Clean AdBlue injector', 'Check SCR catalyst', 'Replace AdBlue pump'], relatedSystems: ['dpf'] },
  P2200: { desc: 'NOx Sensor Circuit (Bank 1)', system: 'adblue', severity: 'high', causes: ['Faulty NOx sensor', 'Wiring damage', 'ECU fault'], solutions: ['Check NOx sensor wiring', 'Replace NOx sensor', 'Reset adaptation values'], relatedSystems: [] },
  P2201: { desc: 'NOx Sensor Circuit Range/Performance (Bank 1)', system: 'adblue', severity: 'high', causes: ['Contaminated NOx sensor', 'Faulty sensor', 'Exhaust leak near sensor'], solutions: ['Replace NOx sensor', 'Check exhaust connections'], relatedSystems: [] },
  P2BAF: { desc: 'NOx Exceedance — Loss of SCR Inducement', system: 'adblue', severity: 'critical', causes: ['Empty AdBlue tank', 'Wrong AdBlue quality', 'SCR system malfunction'], solutions: ['Fill AdBlue tank', 'Check AdBlue quality (32.5% urea)', 'Diagnose SCR system'], relatedSystems: ['dpf'] },

  // === TRANSMISSION ===
  P0700: { desc: 'Transmission Control System Malfunction', system: 'transmission', severity: 'high', causes: ['TCM internal fault', 'Wiring issue', 'Sensor failure'], solutions: ['Check TCM codes', 'Inspect TCM wiring', 'Replace TCM if needed'], relatedSystems: [] },
  P0715: { desc: 'Input/Turbine Speed Sensor Circuit Malfunction', system: 'transmission', severity: 'high', causes: ['Faulty input speed sensor', 'Wiring damage', 'Low ATF level'], solutions: ['Check ATF level', 'Test sensor', 'Replace sensor'], relatedSystems: [] },
  P0720: { desc: 'Output Speed Sensor Circuit Malfunction', system: 'transmission', severity: 'high', causes: ['Faulty output speed sensor', 'Wiring issue'], solutions: ['Test output speed sensor', 'Check wiring', 'Replace sensor'], relatedSystems: ['speed_limiter'] },
  P0730: { desc: 'Incorrect Gear Ratio', system: 'transmission', severity: 'critical', causes: ['Low ATF', 'Worn clutch packs', 'Valve body issue', 'Solenoid failure'], solutions: ['Check ATF level and condition', 'Transmission service', 'Valve body service/replace'], relatedSystems: [] },
  P0741: { desc: 'Torque Converter Clutch Circuit Performance/Stuck Off', system: 'transmission', severity: 'high', causes: ['Faulty TCC solenoid', 'Dirty ATF', 'Valve body issue'], solutions: ['Transmission flush', 'Replace TCC solenoid', 'Valve body service'], relatedSystems: [] },

  // === COMMON NETWORK/COMMUNICATION ===
  U0001: { desc: 'High Speed CAN Communication Bus', system: 'network', severity: 'critical', causes: ['CAN bus wiring fault', 'Faulty module on bus', 'Termination resistor issue'], solutions: ['Check CAN bus wiring', 'Measure bus resistance (should be ~60Ω)', 'Isolate faulty module'], relatedSystems: [] },
  U0073: { desc: 'Control Module Communication Bus Off', system: 'network', severity: 'critical', causes: ['CAN bus failure', 'Module power loss', 'Wiring short'], solutions: ['Check CAN bus wiring', 'Check module power supplies', 'Measure CAN bus voltages'], relatedSystems: [] },
  U0100: { desc: 'Lost Communication with ECM/PCM', system: 'network', severity: 'critical', causes: ['ECM power loss', 'CAN bus failure', 'Faulty ECM'], solutions: ['Check ECM power and ground', 'Check CAN bus', 'Reflash/replace ECM'], relatedSystems: [] },
  U0101: { desc: 'Lost Communication with TCM', system: 'network', severity: 'high', causes: ['TCM power loss', 'CAN bus fault', 'Faulty TCM'], solutions: ['Check TCM fuse', 'Check CAN bus connection to TCM'], relatedSystems: ['transmission'] },
  U0121: { desc: 'Lost Communication with ABS Module', system: 'network', severity: 'high', causes: ['ABS module power loss', 'CAN bus fault'], solutions: ['Check ABS module power', 'Check CAN bus'], relatedSystems: [] },
  U0140: { desc: 'Lost Communication with Body Control Module', system: 'network', severity: 'medium', causes: ['BCM power loss', 'CAN bus fault', 'Faulty BCM'], solutions: ['Check BCM fuse', 'Check CAN bus wiring'], relatedSystems: [] },
};

// ========== Tuning-Related DTC Map ==========
// DTCs commonly triggered or cleared during ECU tuning operations
const TUNING_RELATED_DTCS = {
  dpf_delete: ['P2002', 'P2003', 'P244A', 'P244B', 'P2458', 'P2459'],
  egr_delete: ['P0400', 'P0401', 'P0402', 'P0403', 'P0404'],
  adblue_delete: ['P20EE', 'P2200', 'P2201', 'P2BAF'],
  cat_delete: ['P0420', 'P0421', 'P0430'],
  speed_limiter_remove: ['P0500', 'P0720'],
  boost_increase: ['P0234', 'P0299', 'P0235', 'P0236'],
  lambda_disable: ['P0130', 'P0131', 'P0132', 'P0133', 'P0134'],
  evap_delete: ['P0440', 'P0441', 'P0442', 'P0443', 'P0455', 'P0456'],
};

// ========== ECU Flash Protocol Database ==========
const FLASH_PROTOCOLS = {
  'Bosch MED17': { protocols: ['UDS (ISO 14229)', 'KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'ISO-TP (ISO 15765)', securityAccess: 'Seed-Key (Level 0x01, 0x11)', flashType: 'Internal Flash (PFLASH + DFLASH)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'ADD32 Block Checksum', flashTime: '8-15 min', notes: 'Tricore TC1767/TC1797 based. Requires boot mode or BDM for locked ECUs.' },
  'Bosch EDC17': { protocols: ['UDS (ISO 14229)', 'KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'ISO-TP (ISO 15765)', securityAccess: 'Seed-Key (Level 0x01, 0x11, 0x27)', flashType: 'Internal Flash (PFLASH)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'ADD32 Block Checksum + CRC32', flashTime: '10-20 min', notes: 'Tricore TC1767/TC1797. Common in VAG, BMW diesel. OBD flash via UDS or bench/boot mode.' },
  'Bosch ME7': { protocols: ['KWP2000 (ISO 14230)', 'K-Line'], canSpeed: null, transport: 'K-Line serial', securityAccess: 'Seed-Key', flashType: 'External Flash (AM29F400)', blockSize: 64, eraseType: 'Chip Erase', checksumType: 'ADD16 / Multipoint Checksum', flashTime: '3-8 min', notes: 'C167/C16x based. K-Line boot mode widely documented. Popular in VAG 1.8T.' },
  'Bosch MED9': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'K-Line / CAN', securityAccess: 'Seed-Key', flashType: 'External Flash', blockSize: 128, eraseType: 'Sector Erase', checksumType: 'Checksum16', flashTime: '5-10 min', notes: 'C167 / MPC555. VAG FSI/TFSI engines.' },
  'Bosch EDC16': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'K-Line / CAN', securityAccess: 'Seed-Key', flashType: 'External Flash (AM29BL802)', blockSize: 64, eraseType: 'Sector Erase', checksumType: 'ADD16 Checksum', flashTime: '5-12 min', notes: 'MPC555/556 based. Very common in diesel 2003-2010.' },
  'Bosch MG1': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'DoIP (ISO 13400) / ISO-TP', securityAccess: 'Certificate-based / Seed-Key (Level 0x03)', flashType: 'Internal Flash (Aurix TC2xx)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32 + RSA Signature', flashTime: '15-30 min', notes: 'Aurix TC2xx. Latest gen. Requires bench/boot for most operations. DoIP over Ethernet on some.' },
  'Bosch MD1': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'DoIP / ISO-TP', securityAccess: 'Certificate-based', flashType: 'Internal Flash (Aurix TC2xx)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32 + RSA Signature', flashTime: '15-30 min', notes: 'Latest diesel ECU. Aurix TC2xx. Usually requires bench/boot mode with BSL.' },
  'Siemens/Continental SID803': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'K-Line / CAN', securityAccess: 'Seed-Key', flashType: 'External Flash (AM29BDD160)', blockSize: 64, eraseType: 'Sector Erase', checksumType: 'CRC16 + Checksum16', flashTime: '5-10 min', notes: 'SH7055 based. Common in PSA (Peugeot/Citroën) diesels.' },
  'Siemens/Continental SID206': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'CAN', securityAccess: 'Seed-Key', flashType: 'External Flash', blockSize: 128, eraseType: 'Sector Erase', checksumType: 'Checksum32', flashTime: '6-12 min', notes: 'Common in Renault/Nissan diesel applications.' },
  'Siemens/Continental SIMOS18': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'ISO-TP', securityAccess: 'Seed-Key (Level 0x11)', flashType: 'Internal Flash (Tricore)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32 + Block Checksum', flashTime: '10-20 min', notes: 'Tricore based. VAG EA888 Gen3. OBD or bench flash.' },
  'Delphi DCM3.5': { protocols: ['UDS (ISO 14229)', 'KWP2000'], canSpeed: 500, transport: 'CAN', securityAccess: 'Seed-Key', flashType: 'External Flash', blockSize: 128, eraseType: 'Sector Erase', checksumType: 'CRC32', flashTime: '8-15 min', notes: 'SH7058 based. Common in Renault, Ssangyong, Hyundai diesel.' },
  'Delphi DCM6.2': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'ISO-TP', securityAccess: 'Seed-Key', flashType: 'Internal Flash (Tricore)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32', flashTime: '10-20 min', notes: 'Tricore TC1782/TC1784. Modern Hyundai/Kia diesel.' },
  'Denso SH7058': { protocols: ['SSM (Subaru Select Monitor)', 'KWP2000'], canSpeed: 500, transport: 'K-Line / CAN', securityAccess: 'Seed-Key', flashType: 'Internal Flash (SH7058)', blockSize: 128, eraseType: 'Sector Erase', checksumType: 'Checksum32 Table', flashTime: '5-10 min', notes: 'Subaru WRX/STi. Open source tools (ecuflash, romraider).' },
  'Denso 76F00xx': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'CAN', securityAccess: 'Seed-Key', flashType: 'Internal Flash', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32', flashTime: '8-15 min', notes: 'Toyota/Lexus/Mazda applications. NEC V850 core.' },
  'Marelli MJD6F3': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: 500, transport: 'K-Line / CAN', securityAccess: 'Seed-Key', flashType: 'External Flash', blockSize: 64, eraseType: 'Sector Erase', checksumType: 'CRC16', flashTime: '5-10 min', notes: 'Common in Fiat/Alfa/Lancia diesel. ST10F275/276.' },
  'Marelli IAW5SF': { protocols: ['KWP2000 (ISO 14230)'], canSpeed: null, transport: 'K-Line', securityAccess: 'Seed-Key', flashType: 'External Flash (AM29F010)', blockSize: 64, eraseType: 'Chip Erase', checksumType: 'Checksum16', flashTime: '3-5 min', notes: 'Fiat 1.2/1.4 petrol. K-Line only.' },
  'Marelli 8GMF': { protocols: ['UDS (ISO 14229)'], canSpeed: 500, transport: 'ISO-TP', securityAccess: 'Seed-Key', flashType: 'Internal Flash (Tricore)', blockSize: 256, eraseType: 'Sector Erase', checksumType: 'CRC32', flashTime: '10-20 min', notes: 'FCA latest gen. Tricore TC2xx.' },
};

// ========== Safety Limits per Tuning System ==========
const TUNING_SAFETY_LIMITS = {
  boost: {
    diesel: { maxPsi: 35, maxBar: 2.4, warningPsi: 30, warningBar: 2.0, note: 'Stock turbo usually maxes around 28-32 PSI. Beyond 35 PSI risks turbo failure without hardware upgrade.' },
    gasoline: { maxPsi: 25, maxBar: 1.7, warningPsi: 20, warningBar: 1.4, note: 'Stock turbo on gasoline usually 15-22 PSI. Higher requires upgraded intercooler and fueling.' },
  },
  injection_quantity: {
    diesel: { maxIncreasePct: 25, warningPct: 15, note: 'Injection quantity increase >25% risks injector damage and excessive EGT. Recommend EGT monitoring.' },
    gasoline: { maxIncreasePct: 15, warningPct: 10, note: 'Direct injection quantity increase >15% risks detonation. Requires proper ignition timing adjustment.' },
  },
  rail_pressure: {
    diesel: { maxBar: 2200, warningBar: 2000, stockMaxBar: 1800, note: 'Common rail max 2200 bar for Bosch CP4. Beyond risks injector and pump failure.' },
    gasoline: { maxBar: 250, warningBar: 200, stockMaxBar: 150, note: 'GDI fuel rail typically 150-200 bar. Beyond 250 bar risks fuel pump failure.' },
  },
  timing_advance: {
    diesel: { maxDegrees: 6, warningDegrees: 4, note: 'Diesel injection timing advance beyond 6° risks excessive combustion pressure and engine damage.' },
    gasoline: { maxDegrees: 8, warningDegrees: 5, note: 'Ignition advance beyond 8° additional risks detonation/knock. Requires high-octane fuel.' },
  },
  rpm_limiter: {
    diesel: { maxRpm: 5500, warningRpm: 5000, note: 'Most diesel engines not designed beyond 5500 RPM. Valve float risk.' },
    gasoline: { maxRpm: 8500, warningRpm: 7500, note: 'Depends heavily on engine design. Forged internals recommended above 7500 RPM.' },
  },
  speed_limiter: {
    default: { maxKmh: 300, warningKmh: 260, note: 'Beyond 260 km/h requires rated tires and professional suspension setup.' },
  },
  egt: {
    diesel: { maxCelsius: 850, warningCelsius: 750, note: 'Exhaust Gas Temperature above 850°C risks turbo and manifold damage.' },
    gasoline: { maxCelsius: 950, warningCelsius: 850, note: 'EGT above 950°C risks catalyst and turbo failure.' },
  },
};

// ========== Export Functions ==========

/**
 * Look up a DTC code — returns full info or null
 */
export function lookupDTC(code) {
  const upper = (code || '').toUpperCase().trim();
  const entry = DTC_DB[upper];
  if (!entry) return null;
  const prefix = upper.slice(0, 2);
  const category = DTC_CATEGORIES[prefix] || null;
  return { code: upper, ...entry, category };
}

/**
 * Search DTCs by keyword (description, system, code prefix)
 */
export function searchDTCs(query, options = {}) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const { system, severity, limit = 50 } = options;
  const results = [];
  for (const [code, entry] of Object.entries(DTC_DB)) {
    let match = false;
    if (code.toLowerCase().includes(q)) match = true;
    if (entry.desc.toLowerCase().includes(q)) match = true;
    if (entry.system.toLowerCase().includes(q)) match = true;
    if (entry.causes.some(c => c.toLowerCase().includes(q))) match = true;
    if (!match) continue;
    if (system && entry.system !== system) continue;
    if (severity && entry.severity !== severity) continue;
    const prefix = code.slice(0, 2);
    results.push({ code, ...entry, category: DTC_CATEGORIES[prefix] || null });
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Get DTCs related to a specific tuning operation
 */
export function getTuningRelatedDTCs(operation) {
  const op = (operation || '').toLowerCase().replace(/[\s-]/g, '_');
  const codes = TUNING_RELATED_DTCS[op] || [];
  return codes.map(code => {
    const entry = DTC_DB[code];
    if (!entry) return { code, desc: 'Unknown DTC', system: 'unknown', severity: 'unknown' };
    return { code, ...entry };
  });
}

/**
 * Get all DTC systems/categories
 */
export function getDTCSystems() {
  const systems = {};
  for (const [code, entry] of Object.entries(DTC_DB)) {
    if (!systems[entry.system]) systems[entry.system] = { count: 0, severities: {} };
    systems[entry.system].count++;
    systems[entry.system].severities[entry.severity] = (systems[entry.system].severities[entry.severity] || 0) + 1;
  }
  return { categories: DTC_CATEGORIES, systems, totalCodes: Object.keys(DTC_DB).length };
}

/**
 * Get flash protocol info for an ECU type
 */
export function getFlashProtocol(ecuType) {
  const et = (ecuType || '').trim();
  // Direct match
  if (FLASH_PROTOCOLS[et]) return { ecuType: et, ...FLASH_PROTOCOLS[et] };
  // Fuzzy match
  const lower = et.toLowerCase();
  for (const [key, val] of Object.entries(FLASH_PROTOCOLS)) {
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase().split(' ')[1] || '___')) {
      return { ecuType: key, ...val };
    }
  }
  return null;
}

/**
 * List all known flash protocols
 */
export function listFlashProtocols() {
  return Object.entries(FLASH_PROTOCOLS).map(([name, info]) => ({
    ecuType: name,
    protocols: info.protocols,
    flashTime: info.flashTime,
    checksumType: info.checksumType,
    notes: info.notes,
  }));
}

/**
 * Get safety limits for a tuning system
 */
export function getSafetyLimits(system, fuelType) {
  const sys = (system || '').toLowerCase().replace(/[\s-]/g, '_');
  const fuel = (fuelType || 'diesel').toLowerCase();
  const limits = TUNING_SAFETY_LIMITS[sys];
  if (!limits) return null;
  // Check fuel-specific first, then default
  if (limits[fuel]) return { system: sys, fuelType: fuel, ...limits[fuel] };
  if (limits.default) return { system: sys, fuelType: 'default', ...limits.default };
  // Return first available
  const first = Object.entries(limits)[0];
  return first ? { system: sys, fuelType: first[0], ...first[1] } : null;
}

/**
 * Get all safety limits
 */
export function getAllSafetyLimits() {
  return TUNING_SAFETY_LIMITS;
}

/**
 * Batch lookup multiple DTCs at once
 */
export function batchLookupDTCs(codes) {
  return (codes || []).map(code => {
    const result = lookupDTC(code);
    return result || { code: (code || '').toUpperCase(), desc: 'Unknown DTC', system: 'unknown', severity: 'unknown', causes: [], solutions: [], relatedSystems: [] };
  });
}

/**
 * Analyze a list of DTCs for patterns and recommendations
 */
export function analyzeDTCPattern(codes) {
  const looked = batchLookupDTCs(codes);
  const systems = {};
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const relatedTuning = [];

  for (const dtc of looked) {
    if (!systems[dtc.system]) systems[dtc.system] = [];
    systems[dtc.system].push(dtc.code);
    if (dtc.severity) severityCounts[dtc.severity] = (severityCounts[dtc.severity] || 0) + 1;
  }

  // Check if DTCs match known tuning operation patterns
  for (const [op, opCodes] of Object.entries(TUNING_RELATED_DTCS)) {
    const matching = codes.filter(c => opCodes.includes(c.toUpperCase()));
    if (matching.length > 0) {
      relatedTuning.push({
        operation: op,
        matchedCodes: matching,
        matchPct: Math.round((matching.length / opCodes.length) * 100),
        allExpectedCodes: opCodes,
      });
    }
  }

  // Priority recommendation
  let recommendation = 'No critical issues detected.';
  if (severityCounts.critical > 0) {
    recommendation = `${severityCounts.critical} CRITICAL DTC(s) detected — immediate attention required. Do not drive until resolved.`;
  } else if (severityCounts.high > 1) {
    recommendation = `Multiple HIGH severity DTCs across ${Object.keys(systems).length} system(s) — schedule service soon.`;
  }

  return {
    totalCodes: codes.length,
    knownCodes: looked.filter(d => d.desc !== 'Unknown DTC').length,
    unknownCodes: looked.filter(d => d.desc === 'Unknown DTC').length,
    affectedSystems: systems,
    severityCounts,
    relatedTuning,
    recommendation,
    dtcs: looked,
  };
}
