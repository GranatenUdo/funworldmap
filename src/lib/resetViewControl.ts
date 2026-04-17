import maplibregl from 'maplibre-gl'
import { DEFAULT_CENTER, DEFAULT_ZOOM, DEFAULT_PITCH } from './mapStyles'
import { prefersReducedMotion } from './motion'

/** Fly the map back to the initial world view, respecting reduced motion. */
export function flyToHome(map: maplibregl.Map): void {
  const reducedMotion = prefersReducedMotion()
  map.flyTo({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    pitch: reducedMotion ? 0 : DEFAULT_PITCH,
    bearing: 0,
    duration: reducedMotion ? 0 : 1400,
  })
}

/** Custom MapLibre control — reset to world view. */
export class ResetViewControl implements maplibregl.IControl {
  _container?: HTMLDivElement

  onAdd(map: maplibregl.Map): HTMLElement {
    this._container = document.createElement('div')
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    const button = document.createElement('button')
    button.type = 'button'
    button.title = 'Reset to world view'
    button.setAttribute('aria-label', 'Reset to world view')
    button.style.cssText = 'display:flex;align-items:center;justify-content:center;cursor:pointer;'

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '22')
    svg.setAttribute('height', '22')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '7')

    const meridian = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    meridian.setAttribute('cx', '12')
    meridian.setAttribute('cy', '12')
    meridian.setAttribute('rx', '3')
    meridian.setAttribute('ry', '7')

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    arrow.setAttribute('d', 'M20 4 L20 9 L15 9')

    svg.appendChild(circle)
    svg.appendChild(meridian)
    svg.appendChild(arrow)
    button.appendChild(svg)

    button.addEventListener('click', () => flyToHome(map))

    this._container.appendChild(button)
    return this._container
  }

  onRemove(): void {
    this._container?.remove()
  }
}
