import { TOUCH_TARGET_FROM_32 } from '../lib/layoutConstants'

interface Props {
  onClick: () => void
  ariaLabel: string
  testId?: string
  className?: string
}

// Calibrated fitting (2026-08-03): 1px hairline border, 8px radius, 16px glyph.
// Visual box: p-2 (2*8px) + w-4 h-4 (16px) = 32px -> TOUCH_TARGET_FROM_32.
const DEFAULT_CLASSNAME =
  'p-2 rounded-lg border border-sand-300/65 dark:border-dark-200/70 hover:bg-sand-200/60 dark:hover:bg-dark-300/60 text-sand-600 dark:text-dark-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ice-dim/50 dark:focus-visible:ring-ice/50'

export function CloseButton({ onClick, ariaLabel, testId, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`${className ?? DEFAULT_CLASSNAME} ${TOUCH_TARGET_FROM_32}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
  )
}
