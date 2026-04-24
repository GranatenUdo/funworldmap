// cca3 → FIPS-10-4 overrides. Most countries' FIPS code equals their ISO
// 3166-1 alpha-2 code; the entries below are ALL cases where they diverge,
// plus `null` for territories with no FIPS code assigned.
//
// Source: Wikipedia's "List of FIPS country codes" (public domain, via NGA GEC)
// cross-referenced against src/data/countries.json.
// Validated via scripts/news/_validate-fips.ts on 2026-04-24.
//
// Note: FIPS 10-4 was withdrawn by NIST in 2008 but GDELT continues to use it.
const FIPS_OVERRIDES: Record<string, string | null> = {
  // ── Europe ──────────────────────────────────────────────────────────────────
  DEU: 'GM', // Germany (cca2=DE)
  SWE: 'SW', // Sweden (cca2=SE)
  ESP: 'SP', // Spain (cca2=ES)
  CHE: 'SZ', // Switzerland (cca2=CH)
  DNK: 'DA', // Denmark (cca2=DK)
  AUT: 'AU', // Austria (cca2=AT) — note: Australia is AS
  SVK: 'LO', // Slovakia (cca2=SK)
  PRT: 'PO', // Portugal (cca2=PT)
  IRL: 'EI', // Ireland (cca2=IE)
  GBR: 'UK', // United Kingdom (cca2=GB)
  SRB: 'RI', // Serbia (cca2=RS)
  BGR: 'BU', // Bulgaria (cca2=BG)
  TUR: 'TU', // Turkey / Türkiye (cca2=TR)
  UKR: 'UP', // Ukraine (cca2=UA)
  RUS: 'RS', // Russia (cca2=RU) — note: Serbia is RI
  ISL: 'IC', // Iceland (cca2=IS)
  MNE: 'MJ', // Montenegro (cca2=ME)
  BIH: 'BK', // Bosnia and Herzegovina (cca2=BA)
  EST: 'EN', // Estonia (cca2=EE)
  LVA: 'LG', // Latvia (cca2=LV)
  LTU: 'LH', // Lithuania (cca2=LT)
  CZE: 'EZ', // Czechia (cca2=CZ)
  AND: 'AN', // Andorra (cca2=AD)
  LIE: 'LS', // Liechtenstein (cca2=LI) — note: Lesotho is LT
  MCO: 'MN', // Monaco (cca2=MC)
  BLR: 'BO', // Belarus (cca2=BY)
  AZE: 'AJ', // Azerbaijan (cca2=AZ)
  GEO: 'GG', // Georgia (cca2=GE)
  GGY: 'GK', // Guernsey (cca2=GG)
  SJM: 'SV', // Svalbard and Jan Mayen (cca2=SJ)
  XKX: 'KV', // Kosovo (cca2=XK)
  ALA: null, // Åland Islands — no FIPS code assigned

  // ── Asia ────────────────────────────────────────────────────────────────────
  CHN: 'CH', // China (cca2=CN)
  KOR: 'KS', // South Korea (cca2=KR)
  PRK: 'KN', // North Korea (cca2=KP)
  JPN: 'JA', // Japan (cca2=JP)
  VNM: 'VM', // Vietnam (cca2=VN)
  BGD: 'BG', // Bangladesh (cca2=BD) — note: Bulgaria is BU
  LKA: 'CE', // Sri Lanka (cca2=LK)
  SGP: 'SN', // Singapore (cca2=SG)
  PHL: 'RP', // Philippines (cca2=PH)
  MMR: 'BM', // Myanmar / Burma (cca2=MM)
  KHM: 'CB', // Cambodia (cca2=KH)
  MNG: 'MG', // Mongolia (cca2=MN)
  TJK: 'TI', // Tajikistan (cca2=TJ)
  TKM: 'TX', // Turkmenistan (cca2=TM)
  BRN: 'BX', // Brunei (cca2=BN)
  TLS: 'TT', // Timor-Leste (cca2=TL)
  MNP: 'CQ', // Northern Mariana Islands (cca2=MP)
  GUM: 'GQ', // Guam (cca2=GU)
  MAC: 'MC', // Macau (cca2=MO)

  // ── Middle East ─────────────────────────────────────────────────────────────
  ISR: 'IS', // Israel (cca2=IL) — note: Iceland is IC
  IRQ: 'IZ', // Iraq (cca2=IQ)
  YEM: 'YM', // Yemen (cca2=YE)
  KWT: 'KU', // Kuwait (cca2=KW)
  OMN: 'MU', // Oman (cca2=OM)
  BHR: 'BA', // Bahrain (cca2=BH)
  LBN: 'LE', // Lebanon (cca2=LB)
  PSE: 'WE', // Palestine / West Bank (cca2=PS) — FIPS WE; Gaza Strip is GZ

  // ── Africa ──────────────────────────────────────────────────────────────────
  NGA: 'NI', // Nigeria (cca2=NG) — note: Nicaragua is NU
  ZAF: 'SF', // South Africa (cca2=ZA) — note: ZA is Zambia's FIPS
  NER: 'NG', // Niger (cca2=NE) — note: conflicts with Nigeria's cca2
  CIV: 'IV', // Côte d'Ivoire (cca2=CI)
  TCD: 'CD', // Chad (cca2=TD)
  COD: 'CG', // Democratic Republic of the Congo (cca2=CD) — FIPS CG = Congo Kinshasa
  COG: 'CF', // Republic of the Congo (cca2=CG) — FIPS CF = Congo Brazzaville
  CAF: 'CT', // Central African Republic (cca2=CF) — FIPS CT, not CF!
  LBY: 'LY', // Libya (cca2=LY) — identity but explicit
  DZA: 'AG', // Algeria (cca2=DZ)
  SDN: 'SU', // Sudan (cca2=SD)
  SSD: 'OD', // South Sudan (cca2=SS)
  ZMB: 'ZA', // Zambia (cca2=ZM) — FIPS ZA = Zambia; SF = South Africa
  ZWE: 'ZI', // Zimbabwe (cca2=ZW)
  MDG: 'MA', // Madagascar (cca2=MG)
  MWI: 'MI', // Malawi (cca2=MW)
  BWA: 'BC', // Botswana (cca2=BW)
  NAM: 'WA', // Namibia (cca2=NA)
  GAB: 'GB', // Gabon (cca2=GA)
  GIN: 'GV', // Guinea (cca2=GN)
  GNB: 'PU', // Guinea-Bissau (cca2=GW)
  GNQ: 'EK', // Equatorial Guinea (cca2=GQ)
  SEN: 'SG', // Senegal (cca2=SN)
  GMB: 'GA', // Gambia (cca2=GM)
  BEN: 'BN', // Benin (cca2=BJ)
  TGO: 'TO', // Togo (cca2=TG)
  BFA: 'UV', // Burkina Faso (cca2=BF)
  COM: 'CN', // Comoros (cca2=KM)
  STP: 'TP', // São Tomé and Príncipe (cca2=ST)
  LBR: 'LI', // Liberia (cca2=LR)
  SYC: 'SE', // Seychelles (cca2=SC)
  MUS: 'MP', // Mauritius (cca2=MU)
  LSO: 'LT', // Lesotho (cca2=LS)
  SWZ: 'WZ', // Eswatini (cca2=SZ)
  ESH: 'WI', // Western Sahara (cca2=EH)
  MYT: 'MF', // Mayotte (cca2=YT)
  BDI: 'BY', // Burundi (cca2=BI)

  // ── Americas ────────────────────────────────────────────────────────────────
  CHL: 'CI', // Chile (cca2=CL)
  NIC: 'NU', // Nicaragua (cca2=NI)
  HND: 'HO', // Honduras (cca2=HN)
  CRI: 'CS', // Costa Rica (cca2=CR)
  PAN: 'PM', // Panama (cca2=PA)
  PRY: 'PA', // Paraguay (cca2=PY) — note: conflicts with Panama's cca2
  BOL: 'BL', // Bolivia (cca2=BO)
  DOM: 'DR', // Dominican Republic (cca2=DO)
  HTI: 'HA', // Haiti (cca2=HT)
  DMA: 'DO', // Dominica (cca2=DM)
  GRD: 'GJ', // Grenada (cca2=GD)
  KNA: 'SC', // Saint Kitts and Nevis (cca2=KN)
  LCA: 'ST', // Saint Lucia (cca2=LC)
  ATG: 'AC', // Antigua and Barbuda (cca2=AG)
  TTO: 'TD', // Trinidad and Tobago (cca2=TT)
  BHS: 'BF', // Bahamas (cca2=BS)
  BLZ: 'BH', // Belize (cca2=BZ)
  SLV: 'ES', // El Salvador (cca2=SV)
  ABW: 'AA', // Aruba (cca2=AW)
  CUW: 'UC', // Curaçao (cca2=CW)
  SXM: 'NN', // Sint Maarten (cca2=SX)
  AIA: 'AV', // Anguilla (cca2=AI)
  CYM: 'CJ', // Cayman Islands (cca2=KY)
  BMU: 'BD', // Bermuda (cca2=BM)
  TCA: 'TK', // Turks and Caicos Islands (cca2=TC)
  VGB: 'VI', // British Virgin Islands (cca2=VG)
  VIR: 'VQ', // United States Virgin Islands (cca2=VI)
  PRI: 'RQ', // Puerto Rico (cca2=PR)
  SUR: 'NS', // Suriname (cca2=SR)
  GUF: 'FG', // French Guiana (cca2=GF)
  MAF: 'RN', // Saint Martin (cca2=MF)
  BLM: 'TB', // Saint Barthélemy (cca2=BL)
  SPM: 'SB', // Saint Pierre and Miquelon (cca2=PM)
  MSR: 'MH', // Montserrat (cca2=MS)

  // ── Oceania ─────────────────────────────────────────────────────────────────
  AUS: 'AS', // Australia (cca2=AU) — note: Austria is AU
  PNG: 'PP', // Papua New Guinea (cca2=PG)
  SLB: 'BP', // Solomon Islands (cca2=SB)
  VUT: 'NH', // Vanuatu (cca2=VU)
  TON: 'TN', // Tonga (cca2=TO)
  KIR: 'KR', // Kiribati (cca2=KI) — legitimately zero GDELT results (microstate)
  PLW: 'PS', // Palau (cca2=PW) — legitimately zero GDELT results (microstate)
  MHL: 'RM', // Marshall Islands (cca2=MH) — legitimately zero GDELT results (microstate)
  COK: 'CW', // Cook Islands (cca2=CK)
  NIU: 'NE', // Niue (cca2=NU)
  TKL: 'TL', // Tokelau (cca2=TK)
  PCN: 'PC', // Pitcairn Islands (cca2=PN)
  PYF: 'FP', // French Polynesia (cca2=PF)
  ASM: 'AQ', // American Samoa (cca2=AS)
  CCK: 'CK', // Cocos (Keeling) Islands (cca2=CC)
  CXR: 'KT', // Christmas Island (cca2=CX)
  SGS: 'SX', // South Georgia and South Sandwich Islands (cca2=GS)

  // ── Additional territories ───────────────────────────────────────────────────
  ATF: 'FS', // French Southern and Antarctic Lands (cca2=TF)
  MTQ: 'MB', // Martinique (cca2=MQ)
  MAR: 'MO', // Morocco (cca2=MA) — note: Madagascar is MA
  TUN: 'TS', // Tunisia (cca2=TN)
  VAT: 'VT', // Vatican City (cca2=VA) — legitimately zero GDELT results (microstate)

  // ── No FIPS code assigned ───────────────────────────────────────────────────
  ATA: null, // Antarctica — not a sovereign country, no FIPS assigned
  BVT: null, // Bouvet Island — uninhabited Norwegian territory, no FIPS
  BES: null, // Caribbean Netherlands (Bonaire, Sint Eustatius, Saba) — no FIPS
}

/**
 * Maps a cca3 country code to its FIPS-10-4 2-letter code.
 *
 * - If cca3 is in FIPS_OVERRIDES: returns the override value (may be null).
 * - Otherwise: returns the passed cca2 code (FIPS ≡ ISO alpha-2 for ~100 entries).
 *
 * Callers should pass the country's cca2 from countries.json as the second arg.
 */
export function cca3ToFips(cca3: string, cca2: string): string | null {
  if (cca3 in FIPS_OVERRIDES) return FIPS_OVERRIDES[cca3]
  return cca2
}
