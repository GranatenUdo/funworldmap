import type { CountryLike, RoundSpec } from '../../shared/types'
import { centroidFromLatLng } from '../../shared/distance'

type Picker = (max: number) => number
const defaultPicker: Picker = (max) => Math.floor(Math.random() * max)

export function nextRound(
  used: Set<string>,
  pool: CountryLike[],
  pick: Picker = defaultPicker,
): RoundSpec {
  let available = pool.filter((c) => !used.has(c.cca3))
  if (available.length === 0) available = pool.slice()
  const picked = available[pick(available.length)]
  return {
    targetCca3: picked.cca3,
    targetName: picked.name.common,
    targetFlag: picked.flag,
    targetCentroid: centroidFromLatLng(picked.latlng),
  }
}
