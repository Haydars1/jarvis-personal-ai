// ECU Wiring & Pinout Database
// Connector pinouts for major ECU families, OBD-II pin assignments,
// harness diagrams, and wiring verification tools

// ─── OBD-II Standard Connector (J1962) ────────────────────────────────────

export const OBD2_CONNECTOR = {
  type: 'J1962 Type A (12V)',
  pins: {
    1:  { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Often used for low-speed CAN or SW-CAN' },
    2:  { name: 'SAE J1850 Bus+', protocol: 'J1850_PWM', notes: 'Ford PWM protocol' },
    3:  { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Ford: MS-CAN High, Some VAG: K-Line 2' },
    4:  { name: 'Chassis Ground', protocol: 'power', notes: 'Signal ground reference' },
    5:  { name: 'Signal Ground', protocol: 'power', notes: 'Signal ground' },
    6:  { name: 'CAN High (ISO 15765)', protocol: 'CAN_HS', notes: 'High-speed CAN-Bus (primary)' },
    7:  { name: 'K-Line (ISO 9141/14230)', protocol: 'K_LINE', notes: 'K-Line diagnostic' },
    8:  { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Often unused or manufacturer CAN' },
    9:  { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Often unused' },
    10: { name: 'SAE J1850 Bus-', protocol: 'J1850_PWM', notes: 'Ford PWM negative' },
    11: { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Ford: MS-CAN Low' },
    12: { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Often unused' },
    13: { name: 'Manufacturer Discretion', protocol: 'vendor', notes: 'Often unused' },
    14: { name: 'CAN Low (ISO 15765)', protocol: 'CAN_HS', notes: 'High-speed CAN-Bus (primary)' },
    15: { name: 'L-Line (ISO 9141/14230)', protocol: 'K_LINE', notes: 'L-Line initialization' },
    16: { name: 'Battery Positive', protocol: 'power', notes: 'Unswitched +12V from battery' },
  },
  protocols: {
    CAN_HS:     { pins: [6, 14], speed: '500 kbps', standard: 'ISO 15765-4' },
    CAN_LS:     { pins: [1, 8],  speed: '125 kbps', standard: 'ISO 11898' },
    K_LINE:     { pins: [7, 15], speed: '10.4 kbps', standard: 'ISO 14230 / ISO 9141-2' },
    J1850_PWM:  { pins: [2, 10], speed: '41.6 kbps', standard: 'SAE J1850 PWM (Ford)' },
    J1850_VPW:  { pins: [2],     speed: '10.4 kbps', standard: 'SAE J1850 VPW (GM)' },
  }
};

// ─── ECU Family Pinout Database ───────────────────────────────────────────

export const ECU_PINOUTS = {
  // ── Bosch MED17 (Gasoline Direct Injection) ──
  'bosch_med17': {
    family: 'Bosch MED17',
    type: 'Gasoline DI',
    connectorType: '154-pin (3 x connector block)',
    variants: ['MED17.5.1','MED17.5.2','MED17.5.5','MED17.5.6','MED17.5.21','MED17.5.25','MED17.1','MED17.1.1','MED17.1.6','MED17.1.27'],
    vehicles: ['VW Golf 7 GTI/R','Audi A3/A4/A5/A6 TFSI','Skoda Octavia RS','Seat Leon Cupra','Porsche Macan'],
    connectors: {
      A: { pins: 52, color: 'Black', function: 'Power, Ground, CAN, K-Line' },
      B: { pins: 52, color: 'Grey',  function: 'Injectors, Ignition, Sensors' },
      C: { pins: 52, color: 'Brown', function: 'Lambda, Knock, Turbo, EVAP' },
    },
    keyPins: {
      'A1':  { name: 'ECU Power Supply (+12V Batt)', type: 'power_in' },
      'A2':  { name: 'ECU Power Supply (+12V Batt)', type: 'power_in' },
      'A3':  { name: 'ECU Ground', type: 'ground' },
      'A4':  { name: 'ECU Ground', type: 'ground' },
      'A10': { name: 'CAN-H (Powertrain)', type: 'can_h' },
      'A11': { name: 'CAN-L (Powertrain)', type: 'can_l' },
      'A12': { name: 'CAN-H (Diagnostic)', type: 'can_h' },
      'A13': { name: 'CAN-L (Diagnostic)', type: 'can_l' },
      'A14': { name: 'K-Line Diagnostic', type: 'k_line' },
      'A20': { name: 'Ignition Switch (+15)', type: 'power_in' },
      'A30': { name: 'Immobilizer Data', type: 'immo' },
      'B1':  { name: 'Injector Cyl 1', type: 'output_inj' },
      'B2':  { name: 'Injector Cyl 2', type: 'output_inj' },
      'B3':  { name: 'Injector Cyl 3', type: 'output_inj' },
      'B4':  { name: 'Injector Cyl 4', type: 'output_inj' },
      'B10': { name: 'Ignition Coil Cyl 1', type: 'output_ign' },
      'B11': { name: 'Ignition Coil Cyl 2', type: 'output_ign' },
      'B12': { name: 'Ignition Coil Cyl 3', type: 'output_ign' },
      'B13': { name: 'Ignition Coil Cyl 4', type: 'output_ign' },
      'B20': { name: 'Crankshaft Position Sensor (Signal)', type: 'sensor_in' },
      'B21': { name: 'Crankshaft Position Sensor (Ground)', type: 'sensor_gnd' },
      'B25': { name: 'Camshaft Position Sensor', type: 'sensor_in' },
      'B30': { name: 'Throttle Body Motor +', type: 'output_motor' },
      'B31': { name: 'Throttle Body Motor -', type: 'output_motor' },
      'B35': { name: 'Throttle Position Sensor 1', type: 'sensor_in' },
      'B36': { name: 'Throttle Position Sensor 2', type: 'sensor_in' },
      'B40': { name: 'Manifold Pressure Sensor', type: 'sensor_in' },
      'B41': { name: 'Intake Air Temp Sensor', type: 'sensor_in' },
      'B45': { name: 'Engine Coolant Temp Sensor', type: 'sensor_in' },
      'C1':  { name: 'Lambda Sensor 1 (pre-cat) Heater +', type: 'lambda_htr' },
      'C2':  { name: 'Lambda Sensor 1 (pre-cat) Signal', type: 'lambda_sig' },
      'C5':  { name: 'Lambda Sensor 2 (post-cat) Heater +', type: 'lambda_htr' },
      'C6':  { name: 'Lambda Sensor 2 (post-cat) Signal', type: 'lambda_sig' },
      'C10': { name: 'Knock Sensor 1', type: 'sensor_knock' },
      'C11': { name: 'Knock Sensor 2', type: 'sensor_knock' },
      'C20': { name: 'Turbo Wastegate Actuator +', type: 'output_turbo' },
      'C21': { name: 'Turbo Wastegate Actuator -', type: 'output_turbo' },
      'C25': { name: 'Boost Pressure Sensor', type: 'sensor_in' },
      'C30': { name: 'EVAP Purge Valve', type: 'output_valve' },
      'C35': { name: 'Fuel Pump Relay Control', type: 'output_relay' },
      'C40': { name: 'A/C Compressor Relay', type: 'output_relay' },
      'C45': { name: 'MIL Lamp Control', type: 'output_lamp' },
    },
    flashInterface: {
      boot: { pins: ['A14'], protocol: 'K-Line Bootstrap', notes: 'Boot mode via K-Line, requires bench setup' },
      obd:  { pins: ['A10','A11'], protocol: 'CAN UDS', notes: 'Standard OBD flash via CAN' },
      bdm:  { pins: ['BDM header on PCB'], protocol: 'BDM/JTAG', notes: 'Direct PCB access, requires opening ECU' },
    },
    tuningNotes: 'TC1766/TC1767 processor. Flash via OBD with KT200/KESS/KTAG. Boot mode for locked units. Tricore BDM for full read.',
  },

  // ── Bosch EDC17 (Diesel Common Rail) ──
  'bosch_edc17': {
    family: 'Bosch EDC17',
    type: 'Diesel CR',
    connectorType: '154-pin (3 x connector block)',
    variants: ['EDC17C46','EDC17C54','EDC17C64','EDC17CP04','EDC17CP14','EDC17CP20','EDC17CP44','EDC17CP74','EDC17U01','EDC17U05'],
    vehicles: ['VW Passat 2.0 TDI','Audi A4/A6 TDI','BMW 3/5 Series Diesel','Mercedes C/E Class CDI','Peugeot/Citroen HDi'],
    connectors: {
      A: { pins: 52, color: 'Black', function: 'Power, Ground, CAN, K-Line' },
      B: { pins: 52, color: 'Grey',  function: 'Injectors, Rail, Sensors' },
      C: { pins: 52, color: 'Brown', function: 'DPF, EGR, SCR, Turbo' },
    },
    keyPins: {
      'A1':  { name: 'ECU Power Supply (+12V)', type: 'power_in' },
      'A3':  { name: 'ECU Ground', type: 'ground' },
      'A10': { name: 'CAN-H (Powertrain)', type: 'can_h' },
      'A11': { name: 'CAN-L (Powertrain)', type: 'can_l' },
      'A14': { name: 'K-Line Diagnostic', type: 'k_line' },
      'A20': { name: 'Ignition Switch (+15)', type: 'power_in' },
      'A30': { name: 'Immobilizer Data', type: 'immo' },
      'B1':  { name: 'Injector Cyl 1 High Side', type: 'output_inj' },
      'B2':  { name: 'Injector Cyl 2 High Side', type: 'output_inj' },
      'B3':  { name: 'Injector Cyl 3 High Side', type: 'output_inj' },
      'B4':  { name: 'Injector Cyl 4 High Side', type: 'output_inj' },
      'B10': { name: 'Rail Pressure Sensor', type: 'sensor_in' },
      'B11': { name: 'Rail Pressure Regulator', type: 'output_valve' },
      'B15': { name: 'Fuel Metering Valve', type: 'output_valve' },
      'B20': { name: 'Crankshaft Position Sensor', type: 'sensor_in' },
      'B25': { name: 'Camshaft Position Sensor', type: 'sensor_in' },
      'B30': { name: 'Mass Air Flow Sensor', type: 'sensor_in' },
      'B35': { name: 'Boost Pressure Sensor', type: 'sensor_in' },
      'B40': { name: 'Engine Coolant Temp', type: 'sensor_in' },
      'B41': { name: 'Fuel Temp Sensor', type: 'sensor_in' },
      'B45': { name: 'Oil Pressure Sensor', type: 'sensor_in' },
      'C1':  { name: 'DPF Differential Pressure Sensor', type: 'sensor_dpf' },
      'C2':  { name: 'DPF Inlet Temp Sensor', type: 'sensor_dpf' },
      'C3':  { name: 'DPF Outlet Temp Sensor', type: 'sensor_dpf' },
      'C5':  { name: 'EGR Valve Motor +', type: 'output_egr' },
      'C6':  { name: 'EGR Valve Motor -', type: 'output_egr' },
      'C7':  { name: 'EGR Valve Position Sensor', type: 'sensor_egr' },
      'C10': { name: 'VGT Actuator +', type: 'output_turbo' },
      'C11': { name: 'VGT Actuator -', type: 'output_turbo' },
      'C15': { name: 'SCR/AdBlue Dosing Valve', type: 'output_scr' },
      'C16': { name: 'SCR Temp Sensor (Pre-cat)', type: 'sensor_scr' },
      'C17': { name: 'SCR Temp Sensor (Post-cat)', type: 'sensor_scr' },
      'C18': { name: 'NOx Sensor 1 CAN-H', type: 'can_h' },
      'C19': { name: 'NOx Sensor 1 CAN-L', type: 'can_l' },
      'C20': { name: 'Swirl Flap Actuator', type: 'output_valve' },
      'C25': { name: 'Glow Plug Relay Control', type: 'output_relay' },
      'C30': { name: 'Lambda/Wideband O2 Sensor', type: 'lambda_sig' },
      'C35': { name: 'Intake Throttle Valve', type: 'output_valve' },
      'C40': { name: 'MIL Lamp', type: 'output_lamp' },
    },
    flashInterface: {
      boot: { pins: ['A14'], protocol: 'K-Line Bootstrap', notes: 'Boot mode via bench' },
      obd:  { pins: ['A10','A11'], protocol: 'CAN UDS', notes: 'OBD flash via CAN UDS' },
      bdm:  { pins: ['BDM header'], protocol: 'BDM/JTAG', notes: 'Tricore BDM direct PCB' },
    },
    tuningNotes: 'TC1766/TC1767/TC1797 processor. OBD flash widely supported. DPF/EGR/AdBlue pins critical for off-tuning verification.',
  },

  // ── Siemens/Continental SID807/SID208/SIMOS ──
  'siemens_simos': {
    family: 'Siemens/Continental SIMOS',
    type: 'Gasoline',
    connectorType: '121-pin or 154-pin',
    variants: ['SIMOS 8.1','SIMOS 8.4','SIMOS 10','SIMOS 12.1','SIMOS 18.1','SIMOS 18.6','SIMOS 18.10','SID206','SID208','SID807','SID803A'],
    vehicles: ['VW Golf 7/8','VW Tiguan','Audi A3/Q3','Skoda Superb','Seat Leon','VW T-Roc'],
    connectors: {
      A: { pins: 60, color: 'Black', function: 'Power, CAN, Diagnostic' },
      B: { pins: 60, color: 'Grey',  function: 'Injectors, Ignition, Main Sensors' },
    },
    keyPins: {
      'A1':  { name: 'Battery +12V', type: 'power_in' },
      'A2':  { name: 'Ground', type: 'ground' },
      'A10': { name: 'CAN-H (Powertrain)', type: 'can_h' },
      'A11': { name: 'CAN-L (Powertrain)', type: 'can_l' },
      'A15': { name: 'K-Line', type: 'k_line' },
      'A20': { name: 'Ignition (+15)', type: 'power_in' },
      'A30': { name: 'Immobilizer', type: 'immo' },
      'B1':  { name: 'Injector 1', type: 'output_inj' },
      'B2':  { name: 'Injector 2', type: 'output_inj' },
      'B3':  { name: 'Injector 3', type: 'output_inj' },
      'B4':  { name: 'Injector 4', type: 'output_inj' },
      'B10': { name: 'Coil 1', type: 'output_ign' },
      'B11': { name: 'Coil 2', type: 'output_ign' },
      'B12': { name: 'Coil 3', type: 'output_ign' },
      'B13': { name: 'Coil 4', type: 'output_ign' },
      'B20': { name: 'CKP Sensor', type: 'sensor_in' },
      'B25': { name: 'CMP Sensor', type: 'sensor_in' },
      'B30': { name: 'MAP Sensor', type: 'sensor_in' },
      'B35': { name: 'TPS 1', type: 'sensor_in' },
      'B40': { name: 'Coolant Temp', type: 'sensor_in' },
    },
    flashInterface: {
      obd: { pins: ['A10','A11'], protocol: 'CAN UDS', notes: 'SIMOS 18+ uses secure boot — requires unlocked FW or boot mode' },
      boot: { pins: ['Boot pad on PCB'], protocol: 'JTAG/SWD', notes: 'Secure boot on SIMOS 18.x, need ST10/Aurix access' },
    },
    tuningNotes: 'SIMOS 18.x has Aurix TC2xx with secure boot. SIMOS 8.x/10 are open OBD. SID807/SID208 are diesel variants for PSA.',
  },

  // ── Delphi DCM3.5/DCM6.2 (Diesel) ──
  'delphi_dcm': {
    family: 'Delphi DCM',
    type: 'Diesel CR',
    connectorType: '112-pin',
    variants: ['DCM3.5','DCM3.7','DCM6.2','DCM6.2A','DCM7.1A'],
    vehicles: ['Renault 1.5 dCi','Dacia Duster','Nissan Qashqai dCi','Mercedes 1.5 CDI (Renault base)','Hyundai/Kia 1.6 CRDi (some)'],
    connectors: {
      A: { pins: 56, color: 'Black', function: 'Power, CAN, K-Line' },
      B: { pins: 56, color: 'Grey',  function: 'Injectors, Sensors, Actuators' },
    },
    keyPins: {
      'A1':  { name: 'Battery +12V', type: 'power_in' },
      'A2':  { name: 'Ground', type: 'ground' },
      'A8':  { name: 'CAN-H', type: 'can_h' },
      'A9':  { name: 'CAN-L', type: 'can_l' },
      'A12': { name: 'K-Line', type: 'k_line' },
      'A15': { name: 'Ignition (+15)', type: 'power_in' },
      'B1':  { name: 'Injector 1', type: 'output_inj' },
      'B2':  { name: 'Injector 2', type: 'output_inj' },
      'B3':  { name: 'Injector 3', type: 'output_inj' },
      'B4':  { name: 'Injector 4', type: 'output_inj' },
      'B10': { name: 'Rail Pressure Sensor', type: 'sensor_in' },
      'B15': { name: 'Rail Pressure Regulator', type: 'output_valve' },
      'B20': { name: 'CKP Sensor', type: 'sensor_in' },
      'B25': { name: 'CMP Sensor', type: 'sensor_in' },
      'B30': { name: 'MAF Sensor', type: 'sensor_in' },
      'B35': { name: 'Boost Pressure', type: 'sensor_in' },
      'B40': { name: 'EGR Valve', type: 'output_egr' },
      'B45': { name: 'Turbo VGT Actuator', type: 'output_turbo' },
    },
    flashInterface: {
      obd: { pins: ['A8','A9'], protocol: 'CAN UDS', notes: 'OBD flash supported on most variants' },
      boot: { pins: ['A12'], protocol: 'K-Line Boot', notes: 'Boot via K-Line bench' },
    },
    tuningNotes: 'SPC560 processor. OBD flash widely available via KT200/KESS. DCM3.5 is very common on Renault/Dacia 1.5 dCi.',
  },

  // ── Denso (Toyota/Lexus/Subaru) ──
  'denso_toyota': {
    family: 'Denso',
    type: 'Gasoline/Diesel',
    connectorType: '76-pin or 104-pin',
    variants: ['89661-xxxxx','275700-xxxx','89663-xxxxx'],
    vehicles: ['Toyota Corolla','Toyota Hilux','Toyota Land Cruiser','Lexus IS/GS/RX','Subaru WRX/STI','Subaru BRZ'],
    connectors: {
      main: { pins: 76, color: 'Grey', function: 'All functions integrated' },
    },
    keyPins: {
      '1':  { name: 'Battery +12V', type: 'power_in' },
      '2':  { name: 'Ground', type: 'ground' },
      '10': { name: 'CAN-H', type: 'can_h' },
      '11': { name: 'CAN-L', type: 'can_l' },
      '15': { name: 'Diagnostic (DLC)', type: 'k_line' },
      '20': { name: 'Injector 1', type: 'output_inj' },
      '21': { name: 'Injector 2', type: 'output_inj' },
      '22': { name: 'Injector 3', type: 'output_inj' },
      '23': { name: 'Injector 4', type: 'output_inj' },
      '30': { name: 'IGT 1 (Igniter)', type: 'output_ign' },
      '31': { name: 'IGT 2', type: 'output_ign' },
      '32': { name: 'IGT 3', type: 'output_ign' },
      '33': { name: 'IGT 4', type: 'output_ign' },
      '40': { name: 'CKP Sensor (NE)', type: 'sensor_in' },
      '45': { name: 'CMP Sensor (G)', type: 'sensor_in' },
      '50': { name: 'MAF Sensor (VG)', type: 'sensor_in' },
      '55': { name: 'Throttle Position (VTA)', type: 'sensor_in' },
      '60': { name: 'Coolant Temp (THW)', type: 'sensor_in' },
    },
    flashInterface: {
      obd: { pins: ['10','11'], protocol: 'CAN UDS', notes: 'Limited OBD on newer models, OBD supported on older' },
      bench: { pins: ['15'], protocol: 'Boot/UART', notes: 'Bench flash via processor UART' },
    },
    tuningNotes: 'SH72xx/RH850 processor. Older models open OBD, newer (post-2018) need bench. Denso uses proprietary checksum.',
  },

  // ── Marelli (Fiat/Alfa/Maserati) ──
  'marelli_mj': {
    family: 'Magneti Marelli',
    type: 'Gasoline/Diesel',
    connectorType: '112-pin',
    variants: ['MJ8F3','MJ9DF','IAW5SF','IAW5AM','IAW6LP'],
    vehicles: ['Fiat 500','Fiat Punto','Alfa Romeo Giulietta','Alfa Romeo MiTo','Maserati Ghibli','Jeep Renegade'],
    connectors: {
      A: { pins: 56, color: 'Black', function: 'Power, CAN, Diagnostic' },
      B: { pins: 56, color: 'White', function: 'Actuators, Sensors' },
    },
    keyPins: {
      'A1':  { name: 'Battery +12V', type: 'power_in' },
      'A2':  { name: 'Ground', type: 'ground' },
      'A10': { name: 'CAN-H', type: 'can_h' },
      'A11': { name: 'CAN-L', type: 'can_l' },
      'A15': { name: 'K-Line', type: 'k_line' },
      'B1':  { name: 'Injector 1', type: 'output_inj' },
      'B2':  { name: 'Injector 2', type: 'output_inj' },
      'B3':  { name: 'Injector 3', type: 'output_inj' },
      'B4':  { name: 'Injector 4', type: 'output_inj' },
      'B10': { name: 'CKP Sensor', type: 'sensor_in' },
      'B15': { name: 'CMP Sensor', type: 'sensor_in' },
      'B20': { name: 'MAP Sensor', type: 'sensor_in' },
      'B25': { name: 'Coolant Temp', type: 'sensor_in' },
      'B30': { name: 'Lambda Pre-Cat', type: 'lambda_sig' },
    },
    flashInterface: {
      obd: { pins: ['A10','A11'], protocol: 'CAN UDS / K-Line KWP', notes: 'K-Line on older IAW, CAN on MJ8/MJ9' },
    },
    tuningNotes: 'ST10/SPC5 processors. IAW series via K-Line, MJ series via CAN. Marelli checksum required.',
  },
};

// ─── Pin Type Colors (for UI rendering) ──────────────────────────────────

export const PIN_TYPE_COLORS = {
  power_in:     { color: '#FF0000', label: 'Power +12V', icon: '⚡' },
  ground:       { color: '#000000', label: 'Ground', icon: '⏚' },
  can_h:        { color: '#FF8C00', label: 'CAN High', icon: '📡' },
  can_l:        { color: '#FFD700', label: 'CAN Low', icon: '📡' },
  k_line:       { color: '#9370DB', label: 'K-Line', icon: '🔌' },
  immo:         { color: '#DC143C', label: 'Immobilizer', icon: '🔐' },
  output_inj:   { color: '#228B22', label: 'Injector', icon: '💉' },
  output_ign:   { color: '#FF4500', label: 'Ignition Coil', icon: '⚡' },
  output_motor: { color: '#4169E1', label: 'Motor Output', icon: '⚙️' },
  output_valve: { color: '#20B2AA', label: 'Valve/Solenoid', icon: '🔧' },
  output_relay: { color: '#B8860B', label: 'Relay Control', icon: '🔲' },
  output_lamp:  { color: '#FFD700', label: 'Warning Lamp', icon: '💡' },
  output_turbo: { color: '#FF6347', label: 'Turbo Actuator', icon: '🌀' },
  output_egr:   { color: '#8B4513', label: 'EGR Valve', icon: '♻️' },
  output_scr:   { color: '#4682B4', label: 'SCR/AdBlue', icon: '💧' },
  sensor_in:    { color: '#1E90FF', label: 'Sensor Input', icon: '📊' },
  sensor_gnd:   { color: '#696969', label: 'Sensor Ground', icon: '⏚' },
  sensor_knock: { color: '#8B0000', label: 'Knock Sensor', icon: '🔊' },
  sensor_dpf:   { color: '#A0522D', label: 'DPF Sensor', icon: '🔥' },
  sensor_egr:   { color: '#6B8E23', label: 'EGR Sensor', icon: '♻️' },
  sensor_scr:   { color: '#5F9EA0', label: 'SCR Sensor', icon: '💧' },
  lambda_htr:   { color: '#FF69B4', label: 'Lambda Heater', icon: '🔥' },
  lambda_sig:   { color: '#DA70D6', label: 'Lambda Signal', icon: '📈' },
};

// ─── Lookup Functions ─────────────────────────────────────────────────────

/** Get ECU pinout by family ID */
export function getEcuPinout(ecuId) {
  return ECU_PINOUTS[ecuId] || null;
}

/** List all ECU families */
export function listEcuPinouts() {
  return Object.entries(ECU_PINOUTS).map(([id, p]) => ({
    id, family: p.family, type: p.type,
    connectorType: p.connectorType,
    variants: p.variants,
    vehicles: p.vehicles.slice(0, 3),
    pinCount: Object.keys(p.keyPins).length,
  }));
}

/** Search ECU pinouts by vehicle make/model or ECU variant */
export function searchEcuPinouts(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const [id, p] of Object.entries(ECU_PINOUTS)) {
    const matchVehicle = p.vehicles.some(v => v.toLowerCase().includes(q));
    const matchVariant = p.variants.some(v => v.toLowerCase().includes(q));
    const matchFamily  = p.family.toLowerCase().includes(q);
    if (matchVehicle || matchVariant || matchFamily) {
      results.push({ id, family: p.family, type: p.type, matchType: matchVehicle ? 'vehicle' : matchVariant ? 'variant' : 'family' });
    }
  }
  return results;
}

/** Get pins by type (e.g., all CAN pins, all injector outputs) */
export function getPinsByType(ecuId, pinType) {
  const ecu = ECU_PINOUTS[ecuId];
  if (!ecu) return [];
  return Object.entries(ecu.keyPins)
    .filter(([, pin]) => pin.type === pinType)
    .map(([id, pin]) => ({ pin: id, ...pin }));
}

/** Get all pin types available for an ECU */
export function getEcuPinTypes(ecuId) {
  const ecu = ECU_PINOUTS[ecuId];
  if (!ecu) return [];
  const types = new Set();
  for (const pin of Object.values(ecu.keyPins)) types.add(pin.type);
  return [...types].map(t => ({ type: t, ...PIN_TYPE_COLORS[t] }));
}

/** Get flash interface info for ECU */
export function getFlashPins(ecuId) {
  const ecu = ECU_PINOUTS[ecuId];
  if (!ecu) return null;
  return { ecuFamily: ecu.family, flashInterface: ecu.flashInterface, tuningNotes: ecu.tuningNotes };
}

/** Verify wiring — check expected connections for an ECU */
export function verifyWiring(ecuId, connections) {
  const ecu = ECU_PINOUTS[ecuId];
  if (!ecu) return { error: 'ECU_NOT_FOUND' };
  const results = [];
  for (const conn of connections) {
    const pinDef = ecu.keyPins[conn.pin];
    if (!pinDef) {
      results.push({ pin: conn.pin, status: 'UNKNOWN_PIN', message: `Pin ${conn.pin} not in database` });
      continue;
    }
    const typeMatch = pinDef.type === conn.expectedType;
    results.push({
      pin: conn.pin,
      status: typeMatch ? 'OK' : 'MISMATCH',
      expected: pinDef,
      provided: conn.expectedType,
      message: typeMatch ? `Pin ${conn.pin} correctly identified as ${pinDef.name}` : `Pin ${conn.pin} is ${pinDef.name} (${pinDef.type}), expected ${conn.expectedType}`,
    });
  }
  return { ecuFamily: ecu.family, verificationResults: results, checkedPins: results.length, passed: results.filter(r => r.status === 'OK').length, failed: results.filter(r => r.status !== 'OK').length };
}

/** Get OBD2 connector pin info */
export function getOBD2Pin(pinNumber) {
  return OBD2_CONNECTOR.pins[pinNumber] || null;
}

/** Get OBD2 protocol pinout */
export function getOBD2Protocol(protocol) {
  return OBD2_CONNECTOR.protocols[protocol] || null;
}
