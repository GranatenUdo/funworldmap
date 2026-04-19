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
            className={`w-5 h-5 transition-colors duration-200 ${
              active ? 'text-rose-500' : 'text-sand-300 dark:text-dark-200'
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
