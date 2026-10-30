import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { marked } from 'marked'
import { isHistorical } from './check'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0')
const urls = new Set<string>()
for (const file of files.filter((name) => name.endsWith('.md') && !isHistorical(name))) {
  marked.walkTokens(marked.lexer(readFileSync(file, 'utf8')), (token) => {
    if (token.type !== 'link' && token.type !== 'image') return
    if (!/^https?:\/\//i.test(token.href)) return
    const url = new URL(token.href)
    if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) return
    url.hash = ''
    urls.add(url.href)
  })
}
const failures: string[] = []
const entries = [...urls].sort()
for (let i = 0; i < entries.length; i += 4) {
  await Promise.all(
    entries.slice(i, i + 4).map(async (url) => {
      try {
        let response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) })
        if ([403, 405, 501].includes(response.status)) {
          response = await fetch(url, { signal: AbortSignal.timeout(15000) })
          await response.body?.cancel()
        }
        if (!response.ok) failures.push(`- ${url}: HTTP ${response.status}`)
      } catch (error) {
        failures.push(`- ${url}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }),
  )
}
mkdirSync('.superpowers/sdd/external-links', { recursive: true })
const report = `# External documentation links\n\nChecked ${entries.length} URLs on ${new Date().toISOString()}.\n\n${failures.length ? failures.sort().join('\n') : 'All checked URLs responded successfully.'}\n\nFailures may reflect rate limits, authentication, or transient outages; investigate before replacing a link. This report is independent of PR gates.\n`
writeFileSync('.superpowers/sdd/external-links/report.md', report)
console.log(report)
if (failures.length) process.exitCode = 1
