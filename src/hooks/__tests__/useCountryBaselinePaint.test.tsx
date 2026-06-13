import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MapProvider, useMap } from '../useMap'
import { useCountryBaselinePaint } from '../useCountryBaselinePaint'

function makeFakeMap() {
  const calls: Record<string, unknown[][]> = { setFilter: [], setPaintProperty: [] }
  return {
    setFilter: vi.fn((...args: unknown[]) => calls.setFilter.push(args)),
    setPaintProperty: vi.fn((...args: unknown[]) => calls.setPaintProperty.push(args)),
    calls,
  }
}
function Injector({ children, map }: { children: ReactNode; map: unknown }) {
  const refs = useMap()
  refs.mapRef.current = map as never
  return <>{children}</>
}
function makeWrapper(map: unknown) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MapProvider>
        <Injector map={map}>{children}</Injector>
      </MapProvider>
    )
  }
}

function paintValue(fake: ReturnType<typeof makeFakeMap>, layer: string, prop: string) {
  // Last write wins — mirror MapLibre semantics.
  const calls = fake.calls.setPaintProperty.filter((c) => c[0] === layer && c[1] === prop)
  return calls.at(-1)?.[2]
}

const SAT_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.32, 0.03]
const VEC_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, 0.05]

describe('useCountryBaselinePaint', () => {
  // Full {satellite × compare} matrix — these pin today's exact visuals so the
  // hook rewiring in this phase cannot drift them.
  const cases = [
    {
      satellite: true,
      inCompareView: false,
      fill: SAT_EXPR,
      borderOpacity: 0.6,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    {
      satellite: false,
      inCompareView: false,
      fill: VEC_EXPR,
      borderOpacity: 0.35,
      borderColor: '#94a3b8',
    },
    {
      satellite: true,
      inCompareView: true,
      fill: 0.03,
      borderOpacity: 0.15,
      borderColor: 'rgba(255,255,255,0.35)',
    },
    {
      satellite: false,
      inCompareView: true,
      fill: 0.05,
      borderOpacity: 0.15,
      borderColor: '#94a3b8',
    },
  ] as const

  for (const c of cases) {
    it(`satellite=${c.satellite} compare=${c.inCompareView} → fill/border baseline`, () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCountryBaselinePaint({
            loaded: true,
            satellite: c.satellite,
            inCompareView: c.inCompareView,
            resolvedTheme: 'light',
          }),
        { wrapper: makeWrapper(fake) },
      )
      expect(paintValue(fake, 'country-fill', 'fill-opacity')).toEqual(c.fill)
      expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(c.borderOpacity)
      expect(paintValue(fake, 'country-borders', 'line-color')).toBe(c.borderColor)
    })
  }

  it('dark vector mode uses the dark border baseline', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCountryBaselinePaint({
          loaded: true,
          satellite: false,
          inCompareView: false,
          resolvedTheme: 'dark',
        }),
      { wrapper: makeWrapper(fake) },
    )
    expect(paintValue(fake, 'country-borders', 'line-color')).toBe('#1e293b')
    expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(0.5)
  })

  it('does nothing before loaded', () => {
    const fake = makeFakeMap()
    renderHook(
      () =>
        useCountryBaselinePaint({
          loaded: false,
          satellite: true,
          inCompareView: false,
          resolvedTheme: 'light',
        }),
      { wrapper: makeWrapper(fake) },
    )
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
