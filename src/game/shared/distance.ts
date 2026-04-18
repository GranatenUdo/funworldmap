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
