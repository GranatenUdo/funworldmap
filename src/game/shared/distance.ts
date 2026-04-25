const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between two [lng, lat] points. */
export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const sLat = Math.sin(dLat / 2)
  const sLng = Math.sin(dLng / 2)
  const h =
    sLat * sLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sLng * sLng
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return EARTH_RADIUS_KM * c
}

/** Convert countries.json's `latlng: [lat, lng]` to MapLibre `[lng, lat]`. */
export function centroidFromLatLng(
  latlng: [number, number],
): [number, number] {
  return [latlng[1], latlng[0]]
}

/** Slerp on the unit sphere — used for geodesic arc rendering on the globe. */
export function slerpLngLat(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const lat1 = toRad(from[1])
  const lng1 = toRad(from[0])
  const lat2 = toRad(to[1])
  const lng2 = toRad(to[0])

  const dLat = lat2 - lat1
  const dLng = lng2 - lng1
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const d = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))

  if (d < 1e-10) return from

  const a = Math.sin((1 - t) * d) / Math.sin(d)
  const b = Math.sin(t * d) / Math.sin(d)

  const x = a * Math.cos(lat1) * Math.cos(lng1) + b * Math.cos(lat2) * Math.cos(lng2)
  const y = a * Math.cos(lat1) * Math.sin(lng1) + b * Math.cos(lat2) * Math.sin(lng2)
  const z = a * Math.sin(lat1) + b * Math.sin(lat2)

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y))
  const lng = Math.atan2(y, x)
  return [toDeg(lng), toDeg(lat)]
}

/** Polyline approximating the geodesic arc from `from` to `to`, with n+1 points. */
export function tessellateArc(
  from: [number, number],
  to: [number, number],
  n: number = 64,
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (let i = 0; i <= n; i++) {
    points.push(slerpLngLat(from, to, i / n))
  }
  return points
}
