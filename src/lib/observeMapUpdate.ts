/** Observe MapLibre 6's asynchronous source updates without blocking animation frames. */
export function observeMapUpdate(update: Promise<void> | undefined): void {
  void Promise.resolve(update).catch((error: unknown) =>
    console.warn('Map source update failed:', error),
  )
}
