import { describe, expect, it, vi } from 'vitest'
import type maplibregl from 'maplibre-gl'
import { ResetViewControl } from '../resetViewControl'
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH } from '../mapStyles'
import { stubMatchMedia } from '../../test/matchMediaStub'

const CROSSHAIR_TICKS_D = 'M12 1v3 M12 20v3 M1 12h3 M20 12h3'
const LEGACY_ARROW_D = 'M20 4 L20 9 L15 9'

function mountControl() {
  const flyTo = vi.fn()
  const control = new ResetViewControl()
  const container = control.onAdd({ flyTo } as unknown as maplibregl.Map)
  return { container, flyTo }
}

describe('ResetViewControl', () => {
  it('renders the crosshair-globe glyph (reticle ticks; legacy arrow gone)', () => {
    const { container } = mountControl()
    const pathDs = Array.from(container.querySelectorAll('svg path')).map((p) =>
      p.getAttribute('d'),
    )
    expect(pathDs).toContain(CROSSHAIR_TICKS_D)
    expect(pathDs).not.toContain(LEGACY_ARROW_D)
    // Still reads as a globe: circle + meridian survive the redraw.
    expect(container.querySelector('svg circle')).not.toBeNull()
    expect(container.querySelector('svg ellipse')).not.toBeNull()
  })

  it('keeps the accessible name and flies home on click', () => {
    const restore = stubMatchMedia() // flyToHome → prefersReducedMotion → window.matchMedia
    try {
      const { container, flyTo } = mountControl()
      const button = container.querySelector('button')
      expect(button?.getAttribute('aria-label')).toBe('Reset to world view')
      button?.click()
      expect(flyTo).toHaveBeenCalledWith({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: DEFAULT_PITCH,
        bearing: 0,
        duration: 1400,
      })
    } finally {
      restore()
    }
  })
})
