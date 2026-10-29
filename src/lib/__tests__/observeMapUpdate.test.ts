import { expect, it, vi } from 'vitest'
import { observeMapUpdate } from '../observeMapUpdate'

it('reports asynchronous source failures without an unhandled rejection', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const failure = new Error('source removed')
  observeMapUpdate(Promise.reject(failure))
  await Promise.resolve()
  expect(warn).toHaveBeenCalledWith('Map source update failed:', failure)
  warn.mockRestore()
})

it('accepts an absent source during cleanup', () => {
  expect(() => observeMapUpdate(undefined)).not.toThrow()
})
