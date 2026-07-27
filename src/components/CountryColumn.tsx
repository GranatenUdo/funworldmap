import type { CountryData } from '../lib/types'
import { BorderChip } from './BorderChip'
import { CloseButton } from './CloseButton'

function CompareField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light">
        {label}
      </div>
      <div className="text-sm text-sand-800 dark:text-dark-50">{children}</div>
    </div>
  )
}

interface Props {
  country: CountryData
  byCca3: Map<string, CountryData>
  onSelect: (cca3: string) => void
  onClose: () => void
  badgeLetter: 'A' | 'B'
  badgeColor: 'a' | 'b'
  showColumnClose: boolean
}

export function CountryColumn({
  country,
  byCca3,
  onSelect,
  onClose,
  badgeLetter,
  badgeColor,
  showColumnClose,
}: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="sticky top-0 bg-sand-50/95 dark:bg-dark-400/95 backdrop-blur-md px-5 py-4 z-10">
        <div className="flex items-start justify-between gap-3">
          <div
            className="flex items-start gap-3 min-w-0"
            style={{ animation: 'fade-up 200ms ease-out' }}
          >
            <span className={`compare-badge compare-badge-${badgeColor} mt-1`}>{badgeLetter}</span>
            <img
              data-testid="country-flag"
              src={country.flag}
              alt={country.flagAlt || `Flag of ${country.name.common}`}
              className="w-[56px] h-[38px] object-cover rounded-lg shadow-md shrink-0"
            />
            <div className="min-w-0 pt-0.5">
              <h2 className="text-lg font-bold text-sand-900 dark:text-dark-50 truncate tracking-tight leading-tight">
                {country.name.common}
              </h2>
              {country.capital.length > 0 && (
                <p className="text-xs text-teal dark:text-teal-light truncate mt-0.5">
                  {country.capital[0]}
                </p>
              )}
              <span
                data-testid="region-badge"
                className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mt-1.5 bg-sand-200 text-sand-600 dark:bg-dark-200 dark:text-dark-100"
              >
                {country.region}
              </span>
            </div>
          </div>
          {showColumnClose && <CloseButton onClick={onClose} ariaLabel="Exit compare" />}
        </div>
      </div>

      <div className="px-5 py-3 space-y-2">
        <CompareField label="Population">{country.population.toLocaleString('en-US')}</CompareField>
        <CompareField label="Area">{`${country.area.toLocaleString('en-US')} km\u00B2`}</CompareField>
        <CompareField label="Region">
          {country.region}
          {country.subregion && ` / ${country.subregion}`}
        </CompareField>
        {country.governmentType && (
          <CompareField label="Government">{country.governmentType}</CompareField>
        )}
        {Object.keys(country.languages).length > 0 && (
          <CompareField label="Languages">
            {Object.values(country.languages).join(', ')}
          </CompareField>
        )}
        {Object.keys(country.currencies).length > 0 && (
          <CompareField label="Currencies">
            {Object.values(country.currencies)
              .map((c) => `${c.name} (${c.symbol})`)
              .join(', ')}
          </CompareField>
        )}
        <CompareField label="UN Member">{country.unMember ? 'Yes' : 'No'}</CompareField>
        {country.borders.length > 0 && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-teal dark:text-teal-light mb-1.5">
              Borders
            </div>
            <div className="flex flex-wrap gap-1">
              {country.borders.map((code) => (
                <BorderChip
                  key={code}
                  code={code}
                  neighbor={byCca3.get(code)}
                  onSelect={onSelect}
                  size="compare"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
