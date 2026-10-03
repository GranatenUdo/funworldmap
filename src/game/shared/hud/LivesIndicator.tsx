interface Props {
  lives: 0 | 1 | 2 | 3
}

/**
 * A-2 (owner-approved inversion of the E4 doctrine, 2026-08-04): hearts
 * encode LIFE, not loss. Remaining lives are FILLED signal hearts — signal
 * still means live game state, now pointing at what remains; spent lives are
 * hollow neutral outlines. Critique evidence: three grey hearts at start
 * read as "empty" — stakes were illegible.
 *
 * Last-life staging: at exactly one remaining life the surviving heart runs
 * three gentle scale pulses, then settles at an emphasized static state
 * (`.heart-last-life` in index.css; reduced motion collapses the pulse and
 * keeps the static emphasis). Deliberately the simple CSS-only variant with
 * a `data-last-life` marker rather than a `data-animation-state` lifecycle:
 * no e2e test clicks through the hearts, so nothing needs an animation-idle
 * signal.
 */
export function LivesIndicator({ lives }: Props) {
  return (
    <div
      className="flex gap-1 items-center"
      role="status"
      aria-label={`${lives} ${lives === 1 ? 'life' : 'lives'} remaining`}
      data-testid="hud-lives"
    >
      {[0, 1, 2].map((i) => {
        const remaining = i < lives
        const lastLife = remaining && lives === 1
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={`w-5 h-5 transition-colors duration-200 ${
              remaining
                ? 'text-signal-accessible dark:text-signal'
                : 'text-sand-400 dark:text-dark-200'
            }${lastLife ? ' heart-last-life' : ''}`}
            aria-hidden="true"
            fill={remaining ? 'currentColor' : 'none'}
            stroke={remaining ? undefined : 'currentColor'}
            strokeWidth={remaining ? undefined : 1.75}
            data-last-life={lastLife ? 'true' : undefined}
          >
            <path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />
          </svg>
        )
      })}
    </div>
  )
}
