/** C-5 ocean-click feedback: B-2's miss branch (useMapInteractions → App)
 *  announces into CountryPinningHud's transient status line. A window event
 *  bus (the dispatchToast precedent) because the miss originates outside the
 *  game tree while the listener is mode-specific HUD state — and the shared
 *  GameMode.HudComponent contract shouldn't grow a country-only prop. */
export const OCEAN_MISS_EVENT = 'funworldmap:ocean-miss'

export function dispatchOceanMiss(): void {
  window.dispatchEvent(new CustomEvent(OCEAN_MISS_EVENT))
}
