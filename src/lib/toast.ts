export function dispatchToast(message: string): void {
  window.dispatchEvent(new CustomEvent('funworldmap:toast', { detail: message }))
}
