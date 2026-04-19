import type { CityLike, CityRoundSpec } from '../../shared/types'

type Picker = (max: number) => number
const defaultPicker: Picker = (max) => Math.floor(Math.random() * max)

export function nextRound(
  used: Set<string>,
  pool: CityLike[],
  pick: Picker = defaultPicker,
): CityRoundSpec {
  let available = pool.filter((c) => !used.has(c.id))
  if (available.length === 0) available = pool.slice()
  const picked = available[pick(available.length)]
  return {
    kind: 'city-guessing',
    targetId: picked.id,
    targetName: picked.name,
    targetCountryName: picked.countryName,
    targetCountryFlag: picked.countryFlag,
    targetCentroid: [picked.latlng[1], picked.latlng[0]],   // [lat,lng] → [lng,lat]
  }
}
