// cca3 → FIPS-10-4 overrides. Most countries' FIPS code equals their ISO
// 3166-1 alpha-2 code; the entries below are the ~40 cases where they
// diverge, plus `null` for a handful of disputed territories with no FIPS
// code.
//
// Source: FIPS 10-4 list (public domain, via NGA GEC) cross-referenced
// against src/data/countries.json. Validated via scripts/news/_validate-fips.ts
// on <date of validation run>.
const FIPS_OVERRIDES: Record<string, string | null> = {
  // Europe
  DEU: 'GM', // Germany
  SWE: 'SW', // Sweden
  ESP: 'SP', // Spain
  CHE: 'SZ', // Switzerland
  DNK: 'DA', // Denmark
  AUT: 'AU', // Austria — note collision with Australia (Australia is AS)
  SVK: 'LO', // Slovakia
  PRT: 'PO', // Portugal
  IRL: 'EI', // Ireland
  GBR: 'UK', // United Kingdom
  SRB: 'RI', // Serbia
  BGR: 'BU', // Bulgaria
  ROU: 'RO', // Romania
  HRV: 'HR', // Croatia
  TUR: 'TU', // Turkey
  UKR: 'UP', // Ukraine
  RUS: 'RS', // Russia — note collision with Serbia (Serbia is RI)
  ISL: 'IC', // Iceland
  MNE: 'MJ', // Montenegro

  // Asia
  CHN: 'CH', // China
  KOR: 'KS', // South Korea
  PRK: 'KN', // North Korea
  JPN: 'JA', // Japan
  VNM: 'VM', // Vietnam
  BGD: 'BG', // Bangladesh — note collision with Bulgaria (Bulgaria is BU)
  LKA: 'CE', // Sri Lanka
  KAZ: 'KZ', // Kazakhstan
  SGP: 'SN', // Singapore
  PHL: 'RP', // Philippines
  MYS: 'MY', // Malaysia (identity but commonly questioned — explicit to be safe)
  LAO: 'LA', // Laos (identity — explicit to be safe)
  MMR: 'BM', // Myanmar (Burma)
  KHM: 'CB', // Cambodia

  // Middle East
  ISR: 'IS', // Israel — note collision with Iceland (Iceland is IC)
  IRQ: 'IZ', // Iraq
  ARE: 'AE', // UAE (identity but often questioned)
  SYR: 'SY', // Syria (identity)
  YEM: 'YM', // Yemen

  // Africa
  NGA: 'NI', // Nigeria — note collision with Nicaragua (Nicaragua is NU)
  ZAF: 'SF', // South Africa
  NER: 'NG', // Niger — note collision with Nigeria's cca2 code (Nigeria cca2 is NG)
  CIV: 'IV', // Côte d'Ivoire
  TCD: 'CD', // Chad — note collision with DRC
  COD: 'CG', // Democratic Republic of the Congo
  COG: 'CF', // Republic of the Congo
  LBY: 'LY', // Libya (identity — explicit to be safe)

  // Americas
  CHL: 'CI', // Chile — note collision with Côte d'Ivoire (CIV is IV)
  NIC: 'NU', // Nicaragua
  GTM: 'GT', // Guatemala (identity)
  HND: 'HO', // Honduras
  CRI: 'CS', // Costa Rica — note collision with former Czechoslovakia
  PAN: 'PM', // Panama — note collision with Saint-Pierre-et-Miquelon
  URY: 'UY', // Uruguay (identity)
  PRY: 'PA', // Paraguay — note collision with Panama's cca2 (Panama cca2 is PA)

  // Oceania
  NZL: 'NZ', // New Zealand (identity)
  AUS: 'AS', // Australia

  // Disputed / no-FIPS
  // Fill in during _validate-fips run (Task 4). Examples (verify each):
  // TWN: 'TW',  // Taiwan — FIPS uses TW
  // PSE: null,  // Palestine — may have no FIPS code depending on edition
}

/**
 * Maps a cca3 country code to its FIPS-10-4 2-letter code.
 *
 * - If cca3 is in FIPS_OVERRIDES: returns the override value (may be null).
 * - Otherwise: returns the passed cca2 code (FIPS ≡ ISO alpha-2 for ~210 entries).
 *
 * Callers should pass the country's cca2 from countries.json as the second arg.
 */
export function cca3ToFips(cca3: string, cca2: string): string | null {
  if (cca3 in FIPS_OVERRIDES) return FIPS_OVERRIDES[cca3]
  return cca2
}
