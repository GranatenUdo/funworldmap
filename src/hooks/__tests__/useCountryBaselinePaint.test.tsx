import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountryBaselinePaint } from '../useCountryBaselinePaint'
import { makeFakeMap, makeMapWrapper } from '../../test/fakeMapHooks'

function paintValue(fake: ReturnType<typeof makeFakeMap>, layer: string, prop: string) {
  // Last write wins — mirror MapLibre semantics.
  const calls = fake.calls.setPaintProperty.filter((c) => c[0] === layer && c[1] === prop)
  return calls.at(-1)?.[2]
}

const SAT_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.32, 0.03]
const VEC_EXPR = ['case', ['boolean', ['feature-state', 'hover'], false], 0.28, 0.05]

describe('useCountryBaselinePaint', () => {
  // Full {satellite × compare} matrix — pins B2's cased-border baseline.
  // The batch-2 gameActive emphasis is retired: play and rest render the
  // same cased borders, so game status no longer appears in this table.
  const cases = [
    {
      satellite: true,
      inCompareView: false,
      fill: SAT_EXPR,
      borderOpacity: 0.9,
      borderColor: 'rgba(255,255,255,0.35)',
      casingOpacity: 0.85,
    },
    {
      satellite: false,
      inCompareView: false,
      fill: VEC_EXPR,
      borderOpacity: 0.35,
      borderColor: '#94a3b8',
      casingOpacity: 0,
    },
    {
      satellite: true,
      inCompareView: true,
      fill: 0.03,
      borderOpacity: 0.15,
      borderColor: 'rgba(255,255,255,0.35)',
      casingOpacity: 0,
    },
    {
      satellite: false,
      inCompareView: true,
      fill: 0.05,
      borderOpacity: 0.15,
      borderColor: '#94a3b8',
      casingOpacity: 0,
    },
  ] as const

  for (const c of cases) {
    it(`satellite=${c.satellite} compare=${c.inCompareView} → fill/border/casing baseline`, () => {
      const fake = makeFakeMap()
      renderHook(
        () =>
          useCountryBaselinePaint({
            loaded: true,
            satellite: c.satellite,
            inCompareView: c.inCompareView,
            resolvedTheme: 'light',
          }),
        { wrapper: makeMapWrapper(fake) },
      )
      expect(paintValue(fake, 'country-fill', 'fill-opacity')).toEqual(c.fill)
      expect(paintValue(fake, 'country-borders', 'line-opacity')).toBe(c.borderOpacity)
      expect(paintValue(fake, 'country-borders', 'line-color')).toBe(c.borderColor)
      expect(paintValue(fake, 'country-borders-casing', 'line-opacity')).toBe(c.casingOpacity)
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
      { wrapper: makeMapWrapper(fake) },
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
      { wrapper: makeMapWrapper(fake) },
    )
    expect(fake.setPaintProperty).not.toHaveBeenCalled()
  })
})
