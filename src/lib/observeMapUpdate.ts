/** Observe MapLibre 6's asynchronous source updates without blocking animation frames. */
export function observeMapUpdate(update: Promise<void> | undefined, onError?: () => void): void {
  void Promise.resolve(update).catch((error: unknown) => {
    onError?.()
    console.warn('Map source update failed:', error)
  })
}
