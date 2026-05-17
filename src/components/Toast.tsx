import { useEffect, useState } from 'react'

export default function Toast() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      setMessage(customEvent.detail)
    }
    window.addEventListener('funworldmap:toast', handler)
    return () => window.removeEventListener('funworldmap:toast', handler)
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 2000)
    return () => clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-5 py-2.5 rounded-full bg-dark-400/90 backdrop-blur-sm border border-teal/30 text-teal-light text-sm shadow-lg"
      style={{ animation: 'fade-up 200ms ease-out' }}
    >
      {message}
    </div>
  )
}
