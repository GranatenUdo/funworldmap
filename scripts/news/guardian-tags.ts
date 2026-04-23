// cca3 → Guardian tag lookup. Major countries seeded; rest fall through to null
// and use the region fallback. Extend by running a one-off discovery against
// Guardian's /tags endpoint — see docs/systems/country-news.md.

export const GUARDIAN_TAGS: Record<string, string> = {
  // North America
  USA: 'us-news',
  CAN: 'world/canada',
  MEX: 'world/mexico',
  // South America
  BRA: 'world/brazil',
  ARG: 'world/argentina',
  CHL: 'world/chile',
  COL: 'world/colombia',
  VEN: 'world/venezuela',
  PER: 'world/peru',
  // Europe
  GBR: 'world/uk',
  DEU: 'world/germany',
  FRA: 'world/france',
  ITA: 'world/italy',
  ESP: 'world/spain',
  POL: 'world/poland',
  UKR: 'world/ukraine',
  RUS: 'world/russia',
  NLD: 'world/netherlands',
  BEL: 'world/belgium',
  CHE: 'world/switzerland',
  AUT: 'world/austria',
  SWE: 'world/sweden',
  NOR: 'world/norway',
  DNK: 'world/denmark',
  FIN: 'world/finland',
  IRL: 'world/ireland',
  PRT: 'world/portugal',
  GRC: 'world/greece',
  TUR: 'world/turkey',
  // Asia
  CHN: 'world/china',
  JPN: 'world/japan',
  KOR: 'world/southkorea',
  PRK: 'world/north-korea',
  IND: 'world/india',
  PAK: 'world/pakistan',
  BGD: 'world/bangladesh',
  IDN: 'world/indonesia',
  THA: 'world/thailand',
  VNM: 'world/vietnam',
  PHL: 'world/philippines',
  MYS: 'world/malaysia',
  SGP: 'world/singapore',
  // Middle East
  ISR: 'world/israel',
  PSE: 'world/palestine',
  IRN: 'world/iran',
  IRQ: 'world/iraq',
  SYR: 'world/syria',
  SAU: 'world/saudiarabia',
  ARE: 'world/united-arab-emirates',
  EGY: 'world/egypt',
  // Africa
  NGA: 'world/nigeria',
  ZAF: 'world/south-africa',
  KEN: 'world/kenya',
  ETH: 'world/ethiopia',
  GHA: 'world/ghana',
  // Oceania
  AUS: 'world/australia',
  NZL: 'world/new-zealand',
}

export function cca3ToGuardianTag(cca3: string): string | null {
  return GUARDIAN_TAGS[cca3] ?? null
}
