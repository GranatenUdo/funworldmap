import { useEffect, useState } from 'react'
import { relativeTime } from '../lib/relativeTime'

interface Article {
  id: string
  title: string
  url: string
  publishedAt: string
  domain: string
  thumbnail: string | null
}

interface CountryNewsFile {
  updatedAt: string
  country: { cca3: string; name: string }
  articles: Article[]
}

type Status = 'loading' | 'ready' | 'error'

interface Props {
  cca3: string
}

export function CountryNewsSection({ cca3 }: Props) {
  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<CountryNewsFile | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setData(null)
    fetch(`/news/${cca3}.json`, { cache: 'default' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((json) => {
        if (cancelled) return
        setData(json as CountryNewsFile)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => { cancelled = true }
  }, [cca3])

  return (
    <div data-testid="country-news-section" className="mt-6 pt-4 border-t border-sand-200/50 dark:border-dark-200/20">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-teal-accessible dark:text-teal-light mb-3">
        Recent news (last 7 days)
      </h3>

      {status === 'loading' && (
        <p className="text-xs text-sand-600 dark:text-dark-100">Loading news…</p>
      )}

      {status === 'error' && (
        <p className="text-xs text-sand-600 dark:text-dark-100">News unavailable.</p>
      )}

      {status === 'ready' && data && data.articles.length === 0 && (
        <p className="text-xs text-sand-600 dark:text-dark-100">
          No recent English-language news about this country in the last 7 days.
        </p>
      )}

      {status === 'ready' && data && data.articles.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </ul>
          <p className="mt-4 text-[10px] text-sand-500 dark:text-dark-100">
            News data via{' '}
            <a
              href="https://www.gdeltproject.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-teal-accessible dark:hover:text-teal-light"
            >
              the GDELT Project
            </a>.
          </p>
        </>
      )}
    </div>
  )
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <li>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-sand-100/50 dark:hover:bg-dark-300/50 transition-colors"
      >
        {article.thumbnail && (
          <img
            src={article.thumbnail}
            alt=""
            width={64}
            height={48}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-16 h-12 rounded object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-sand-900 dark:text-dark-50 line-clamp-2">
            {article.title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-sand-500 dark:text-dark-100">
            <span className="font-medium">{article.domain}</span>
            <span aria-hidden>·</span>
            <span>{relativeTime(article.publishedAt)}</span>
          </div>
        </div>
      </a>
    </li>
  )
}
