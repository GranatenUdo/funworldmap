import { renderHook, act, cleanup } from '@testing-library/react'
import { it, expect, afterEach } from 'vitest'
import { useGameplayReady } from '../useGameplayReady'
afterEach(() => {cleanup(); document.body.innerHTML=''})
it('distinguishes loading, failure, recovery and ready layers', async () => {
 const {result} = renderHook(() => useGameplayReady())
 expect(result.current).toEqual({ready:false,failed:false})
 const node = document.createElement('div')
 await act(async () => {node.dataset.mapError='unsupported'; document.body.append(node); await Promise.resolve()})
 expect(result.current).toEqual({ready:false,failed:true})
 await act(async () => {delete node.dataset.mapError; node.dataset.mapLoaded='true'; await Promise.resolve()})
 expect(result.current).toEqual({ready:true,failed:false})
 await act(async () => {node.dataset.mapError='webgl-lost'; await Promise.resolve()})
 expect(result.current).toEqual({ready:false,failed:true})
})
