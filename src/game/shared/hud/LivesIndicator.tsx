interface Props {
  lives: 0 | 1 | 2 | 3
}

export function LivesIndicator({ lives }: Props) {
  return (
    <div
      className="flex gap-1 items-center"
      role="status"
      aria-label={`${lives} ${lives === 1 ? 'life' : 'lives'} remaining`}
      data-testid="hud-lives"
    >
      {[0, 1, 2].map((i) => {
        const active = i < lives
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            // E4: alive hearts are neutral (starlight in dark); a LOST heart is
            // the signal accent — loss is live game state.
            className={`w-5 h-5 transition-colors duration-200 ${
              active ? 'text-sand-500 dark:text-dark-50' : 'text-signal-accessible dark:text-signal'
            }`}
            aria-hidden="true"
            fill="currentColor"
          >
            <path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.83A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" />
          </svg>
        )
      })}
    </div>
  )
}
