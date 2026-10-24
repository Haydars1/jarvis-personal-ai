// VIN Decoder — ISO 3779 / ISO 3780
// WMI (World Manufacturer Identifier), VDS (Vehicle Descriptor Section), VIS (Vehicle Identifier Section)

// ─── WMI Database (Top manufacturers) ─────────────────────────────────────

const WMI_DATABASE = {
  // European
  'WBA':'BMW AG','WBS':'BMW M GmbH','WBY':'BMW i','WDD':'Mercedes-Benz Cars','WDB':'Mercedes-Benz Trucks',
  'WDC':'Mercedes-Benz SUV','WME':'Smart','WF0':'Ford Europe','WVW':'Volkswagen','WV2':'Volkswagen Commercial',
  'WAU':'Audi','WUA':'Audi Quattro/Sport','WP0':'Porsche','WP1':'Porsche SUV',
  'W0L':'Opel/Vauxhall','W0V':'Opel','WJR':'Jaguar (EU)','SAL':'Land Rover','SAJ':'Jaguar',
  'SCC':'Lotus','SDB':'Aston Martin(Peugeot)','SCF':'Aston Martin','ZAR':'Alfa Romeo','ZAM':'Maserati',
  'ZFA':'Fiat','ZFF':'Ferrari','ZHW':'Lamborghini','ZLA':'Lancia','ZCF':'Iveco',
  'VF1':'Renault','VF3':'Peugeot','VF7':'Citroen','VNE':'Dacia','VSS':'SEAT',
  'VS6':'Ford Spain','TRU':'Audi (Hungary)','TMB':'Skoda','TMA':'Hyundai (CZ)',
  'NLE':'Mercedes (Finland)','YV1':'Volvo Cars','YS2':'Scania','YK1':'Saab',
  // North America
  '1FA':'Ford Motor','1FB':'Ford Bus','1FC':'Ford Truck','1FD':'Ford Truck','1FM':'Ford SUV',
  '1FT':'Ford Truck','1G1':'Chevrolet','1G2':'Pontiac','1G3':'Oldsmobile','1G4':'Buick',
  '1G6':'Cadillac','1GC':'Chevrolet Truck','1GM':'GMC','1GT':'GMC Truck','1GY':'Cadillac SUV',
  '1HD':'Harley-Davidson','1HG':'Honda','1J4':'Jeep','1J8':'Jeep','1L1':'Lincoln',
  '1LN':'Lincoln','1ME':'Mercury','1N4':'Nissan','1N6':'Nissan Truck','1NX':'Toyota (NUMMI)',
  '2FA':'Ford Canada','2G1':'Chevrolet Canada','2G2':'Pontiac Canada','2HG':'Honda Canada',
  '2HK':'Honda Canada SUV','2HM':'Hyundai Canada','2T1':'Toyota Canada','2T3':'Toyota Canada SUV',
  '3FA':'Ford Mexico','3G1':'GM Mexico','3HG':'Honda Mexico','3N1':'Nissan Mexico',
  '3VW':'Volkswagen Mexico','3C4':'Chrysler Mexico','3D4':'Dodge Mexico',
  '4F2':'Mazda','4M2':'Mercury','4S3':'Subaru (SIA)','4S4':'Subaru (SIA)',
  '4T1':'Toyota (US)','4T3':'Toyota SUV (US)','4T4':'Toyota SUV (US)',
  '4US':'BMW (US)','5FN':'Honda (US)','5FP':'Honda (US)','5J6':'Honda (US)',
  '5NP':'Hyundai (US)','5TD':'Toyota (US)','5YJ':'Tesla','5YF':'Tesla',
  '7A3':'Tesla','7SA':'Tesla',
  // Japan
  'JA3':'Mitsubishi','JA4':'Mitsubishi SUV','JF1':'Subaru','JF2':'Subaru SUV',
  'JHM':'Honda','JHL':'Honda SUV','JM1':'Mazda','JN1':'Nissan','JN8':'Nissan SUV',
  'JS1':'Suzuki','JT2':'Toyota','JTE':'Toyota SUV','JTD':'Toyota Truck','JTH':'Lexus',
  // Korea
  'KL1':'GM Daewoo','KMH':'Hyundai','KNA':'Kia','KND':'Kia SUV','KNM':'Renault Samsung',
  'KPA':'SsangYong','KPT':'Hyundai Commercial',
  // Other
  'LFV':'FAW-Volkswagen','LHG':'Beijing Hyundai','LSG':'SAIC GM','LSJ':'SAIC MG',
  'LVS':'Ford China','LVV':'Chery','L6T':'Geely','MEX':'Renault India',
  'MA1':'Mahindra','MAJ':'Ford India','MAK':'Honda India','MAL':'Hyundai India',
  '9BW':'VW Brazil','9BD':'Fiat Brazil','93H':'Honda Brazil','93Y':'Renault Brazil',
  '8AP':'Fiat Argentina','8AW':'VW Argentina',
};

// ─── Model Year Codes ─────────────────────────────────────────────────────

const YEAR_CODES = {
  'A':1980,'B':1981,'C':1982,'D':1983,'E':1984,'F':1985,'G':1986,'H':1987,
  'J':1988,'K':1989,'L':1990,'M':1991,'N':1992,'P':1993,'R':1994,'S':1995,
  'T':1996,'V':1997,'W':1998,'X':1999,'Y':2000,'1':2001,'2':2002,'3':2003,
  '4':2004,'5':2005,'6':2006,'7':2007,'8':2008,'9':2009,'A':2010,'B':2011,
  'C':2012,'D':2013,'E':2014,'F':2015,'G':2016,'H':2017,'J':2018,'K':2019,
  'L':2020,'M':2021,'N':2022,'P':2023,'R':2024,'S':2025,'T':2026,'V':2027,
  'W':2028,'X':2029,'Y':2030,
};

// Determine year from 10th character — cycles every 30 years
function decodeModelYear(char, pos7) {
  const c = char.toUpperCase();
  // After 2009, letters A-Y repeat but post-2009 vehicles use digit at pos 7
  // to distinguish cycle: A-H,J-N = numeric 7th pos means 2010+
  const baseYears = {
    'A':2010,'B':2011,'C':2012,'D':2013,'E':2014,'F':2015,'G':2016,'H':2017,
    'J':2018,'K':2019,'L':2020,'M':2021,'N':2022,'P':2023,'R':2024,'S':2025,
    'T':2026,'V':2027,'W':2028,'X':2029,'Y':2030,
    '1':2001,'2':2002,'3':2003,'4':2004,'5':2005,'6':2006,'7':2007,'8':2008,'9':2009,
  };
  const oldYears = {
    'A':1980,'B':1981,'C':1982,'D':1983,'E':1984,'F':1985,'G':1986,'H':1987,
    'J':1988,'K':1989,'L':1990,'M':1991,'N':1992,'P':1993,'R':1994,'S':1995,
    'T':1996,'V':1997,'W':1998,'X':1999,'Y':2000,
  };

  // Newer cycle if 7th position is a digit
  if (/\d/.test(pos7) && oldYears[c]) {
    return baseYears[c] || oldYears[c];
  }
  return baseYears[c] || oldYears[c] || null;
}


// ─── Assembly Plant Codes (select manufacturers) ──────────────────────────

const ASSEMBLY_PLANTS_BMW = {
  'A':'Munich','B':'Dingolfing','C':'Rosslyn (South Africa)','D':'Munich',
  'E':'Regensburg','F':'Munich','G':'Graz (Austria)','H':'Spartanburg (USA)',
  'K':'Leipzig','L':'Leipzig','M':'Munich','N':'Rosslyn','P':'Spartanburg',
  'V':'Leipzig','W':'Chennai (India)','X':'Shenyang (China)',
};

const ASSEMBLY_PLANTS_VW = {
  'A':'Ingolstadt','B':'Brussels','D':'Bratislava','E':'Emden','H':'Hannover',
  'K':'Osnabrück','M':'Puebla (Mexico)','N':'Neckarsulm','P':'Mosel','S':'Stuttgart',
  'W':'Wolfsburg','X':'Poznań','Y':'Pamplona','Z':'Zwickau',
};

const ASSEMBLY_PLANTS_TOYOTA = {
  '0':'Japan (Tahara)','1':'Japan (Motomachi)','2':'Japan (Takaoka)',
  '3':'Japan (Tsutsumi)','4':'Japan (Miyata)','5':'Japan (Kanda)',
  '6':'USA (Princeton)','7':'USA (Georgetown)','8':'USA (San Antonio)',
  'A':'Canada (Cambridge)','B':'USA (Buffalo)','C':'Canada','D':'Thailand',
  'K':'Japan','R':'USA','S':'Japan','U':'USA','W':'France (Valenciennes)',
};


// ─── Check Digit Validation (ISO 3779 / FMVSS 115) ───────────────────────

const TRANSLITERATION = {
  'A':1,'B':2,'C':3,'D':4,'E':5,'F':6,'G':7,'H':8,
  'J':1,'K':2,'L':3,'M':4,'N':5,'P':7,'R':9,
  'S':2,'T':3,'U':4,'V':5,'W':6,'X':7,'Y':8,'Z':9,
  '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Validate VIN check digit (position 9)
 * North American standard — always valid for NAFTA vehicles
 */
export function validateCheckDigit(vin) {
  const v = vin.toUpperCase();
  if (v.length !== 17) return { valid: false, reason: 'VIN must be 17 characters' };

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const val = TRANSLITERATION[v[i]];
    if (val === undefined) return { valid: false, reason: `Invalid character at position ${i + 1}: ${v[i]}` };
    sum += val * POSITION_WEIGHTS[i];
  }

  const remainder = sum % 11;
  const expected = remainder === 10 ? 'X' : remainder.toString();
  const actual = v[8];

  return {
    valid: actual === expected,
    expected,
    actual,
    position: 9,
  };
}


// ─── Country of Origin ───────────────────────────────────────────────────

function getCountry(wmi) {
  const first = wmi[0].toUpperCase();
  const second = wmi[1].toUpperCase();

  const countryMap = {
    'A': { range: 'A-H', country: 'South Africa' },
    'J': { range: 'A-T', country: 'Japan' },
    'K': { range: 'A-E', country: 'South Korea' },
    'L': { range: 'A-Z', country: 'China' },
    'M': { range: 'A-E', country: 'India' },
    'N': { range: 'A-E', country: 'Iran' },
    'P': { range: 'A-E', country: 'Philippines' },
    'R': { range: 'A-E', country: 'UAE' },
    'S': { range: 'A-M', country: 'United Kingdom' },
    'T': { range: 'A-H', country: 'Switzerland' },
    'V': { range: 'F-R', country: 'France' },
    'W': { range: 'A-Z', country: 'Germany' },
    'X': { range: 'A-Z', country: 'Russia' },
    'Y': { range: 'A-E', country: 'Belgium' },
    'Z': { range: 'A-R', country: 'Italy' },
  };

  // Simple first-character mapping
  if (first === '1' || first === '4' || first === '5') return 'United States';
  if (first === '2') return 'Canada';
  if (first === '3') return 'Mexico';
  if (first === '6') return 'Australia';
  if (first === '7') return 'New Zealand';
  if (first === '8') return 'Argentina';
  if (first === '9') return 'Brazil';
  if (countryMap[first]) return countryMap[first].country;

  // More specific
  if (first === 'S' && second >= 'N') return 'Germany'; // SN-ST
  if (first === 'T' && second >= 'J') return 'Czech Republic'; // TJ-TP
  if (first === 'T' && second >= 'R' && second <= 'V') return 'Hungary';
  if (first === 'T' && second >= 'W') return 'Portugal';
  if (first === 'V' && second >= 'S' && second <= 'W') return 'Spain';
  if (first === 'Y' && second >= 'F' && second <= 'K') return 'Finland';
  if (first === 'Y' && second >= 'S' && second <= 'W') return 'Sweden';
  if (first === 'N' && second >= 'F') return 'Turkey'; // NF onwards

  return 'Unknown';
}


// ─── Main Decoder ─────────────────────────────────────────────────────────

/**
 * Decode a 17-character VIN
 * @param {string} vinStr - The VIN string
 * @returns {object} Decoded VIN information
 */
export function decodeVIN(vinStr) {
  if (!vinStr || typeof vinStr !== 'string') return { error: 'VIN string required' };

  const vin = vinStr.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
  if (vin.length !== 17) return { error: `VIN must be 17 characters, got ${vin.length}`, cleaned: vin };

  // Illegal characters check (I, O, Q not allowed)
  if (/[IOQ]/.test(vin)) return { error: 'VIN contains illegal characters (I, O, Q are not allowed)' };

  const wmi = vin.substring(0, 3);   // World Manufacturer Identifier
  const vds = vin.substring(3, 9);   // Vehicle Descriptor Section
  const vis = vin.substring(9, 17);  // Vehicle Identifier Section

  // WMI lookup
  const manufacturer = WMI_DATABASE[wmi] || WMI_DATABASE[wmi.substring(0, 2)] || null;
  const country = getCountry(wmi);

  // Model year (position 10)
  const yearChar = vin[9];
  const pos7Char = vin[6];
  const modelYear = decodeModelYear(yearChar, pos7Char);

  // Assembly plant (position 11)
  const plantCode = vin[10];

  // Sequential number (positions 12-17)
  const sequentialNumber = vin.substring(11, 17);

  // Check digit validation
  const checkDigit = validateCheckDigit(vin);

  // Determine region
  let region = 'Unknown';
  const fc = vin[0];
  if ('12345'.includes(fc)) region = 'North America';
  else if ('6'.includes(fc)) region = 'Oceania';
  else if ('789'.includes(fc)) region = 'South America';
  else if ('ABCDEFGH'.includes(fc)) region = 'Africa';
  else if ('JKLMNPR'.includes(fc)) region = 'Asia';
  else if ('STUVWXYZ'.includes(fc)) region = 'Europe';

  const result = {
    vin,
    valid: checkDigit.valid,
    sections: {
      wmi: { value: wmi, description: 'World Manufacturer Identifier' },
      vds: { value: vds, description: 'Vehicle Descriptor Section (model, engine, body)' },
      vis: { value: vis, description: 'Vehicle Identifier Section (year, plant, serial)' },
    },
    manufacturer,
    country,
    region,
    modelYear,
    modelYearCode: yearChar,
    assemblyPlantCode: plantCode,
    sequentialNumber,
    checkDigit,
    positions: {
      1: { char: vin[0], meaning: 'Country/Region' },
      2: { char: vin[1], meaning: 'Manufacturer' },
      3: { char: vin[2], meaning: 'Vehicle Type/Division' },
      '4-8': { chars: vin.substring(3, 8), meaning: 'Vehicle Attributes (model, body, engine, transmission)' },
      9: { char: vin[8], meaning: 'Check Digit', valid: checkDigit.valid },
      10: { char: vin[9], meaning: 'Model Year', decoded: modelYear },
      11: { char: vin[10], meaning: 'Assembly Plant' },
      '12-17': { chars: vin.substring(11), meaning: 'Sequential Number' },
    },
  };

  // Try to decode assembly plant for known manufacturers
  if (wmi.startsWith('WB')) result.assemblyPlant = ASSEMBLY_PLANTS_BMW[plantCode] || null;
  else if (wmi.startsWith('WV') || wmi.startsWith('WA') || wmi.startsWith('3VW')) result.assemblyPlant = ASSEMBLY_PLANTS_VW[plantCode] || null;
  else if (wmi.startsWith('JT') || wmi.startsWith('4T') || wmi.startsWith('2T') || wmi.startsWith('5T')) result.assemblyPlant = ASSEMBLY_PLANTS_TOYOTA[plantCode] || null;

  return result;
}


// ─── VIN Pattern Search ──────────────────────────────────────────────────

/**
 * Search manufacturer by name
 */
export function searchManufacturer(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const [wmi, name] of Object.entries(WMI_DATABASE)) {
    if (name.toLowerCase().includes(q)) {
      results.push({ wmi, manufacturer: name, country: getCountry(wmi) });
    }
  }
  return results;
}

/**
 * Get all manufacturers for a country
 */
export function getManufacturersByCountry(countryQuery) {
  const q = countryQuery.toLowerCase();
  const results = [];
  for (const [wmi, name] of Object.entries(WMI_DATABASE)) {
    const country = getCountry(wmi);
    if (country.toLowerCase().includes(q)) {
      results.push({ wmi, manufacturer: name, country });
    }
  }
  return results;
}


// ─── Batch Decode ────────────────────────────────────────────────────────

/**
 * Decode multiple VINs at once
 */
export function batchDecodeVIN(vins) {
  if (!Array.isArray(vins)) return { error: 'Array of VIN strings required' };
  return vins.slice(0, 50).map(v => decodeVIN(v));
}


// ─── VIN Statistics ──────────────────────────────────────────────────────

export function vinDecoderStats() {
  return {
    manufacturersInDatabase: Object.keys(WMI_DATABASE).length,
    countriesCovered: [...new Set(Object.keys(WMI_DATABASE).map(wmi => getCountry(wmi)))].length,
    yearCodesSupported: '1980-2030',
    checkDigitValidation: 'ISO 3779 / FMVSS 115',
    assemblyPlantDatabases: ['BMW', 'Volkswagen/Audi', 'Toyota'],
  };
}

export { WMI_DATABASE };
