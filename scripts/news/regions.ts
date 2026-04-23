export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania' | 'Antarctic'

const REGION_TAG: Record<Region, string | null> = {
  Africa: 'world/africa',
  Europe: 'world/europe',
  Asia: 'world/asia-pacific',
  Oceania: 'world/asia-pacific',
  Americas: null,
  Antarctic: null,
}

export function regionToGuardianTag(region: string): string | null {
  return (REGION_TAG as Record<string, string | null>)[region] ?? null
}
