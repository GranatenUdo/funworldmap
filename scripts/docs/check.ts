import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked, type Token } from 'marked'
import GithubSlugger from 'github-slugger'
import * as prettier from 'prettier'

export function isHistorical(path: string): boolean {
  return (
    path.startsWith('docs/superpowers/') ||
    path.startsWith('graphify-out/') ||
    path.startsWith('.impeccable/') ||
    /(?:^|\/)\d{4}-\d{2}-\d{2}[^/]*\.md$/.test(path) ||
    /-\d{4}-\d{2}-\d{2}\.md$/.test(path)
  )
}

function anchors(markdown: string): Set<string> {
  const result = new Set<string>()
  const slugger = new GithubSlugger()
  function text(tokens: Token[]): string {
    return tokens
      .map((token) => {
        if ('tokens' in token && token.tokens) return text(token.tokens)
        if (token.type === 'html') return ''
        return 'text' in token ? token.text : ''
      })
      .join('')
  }
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === 'heading') result.add(slugger.slug(text(token.tokens ?? [])))
    if (token.type === 'html') {
      for (const m of token.text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(m[1])
    }
  })
  return result
}

/** Pure checker: only Markdown links and code tokens, never illustrative prose paths. */
export function inspectMarkdown(
  file: string,
  markdown: string,
  files: string[],
  read: (path: string) => string | undefined,
  historical = isHistorical(file),
): string[] {
  const errors: string[] = []
  const known = new Set(files)
  const tokens = marked.lexer(markdown)
  marked.walkTokens(tokens, (token) => {
    if (token.type === 'link' || token.type === 'image') {
      const href = token.href
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return
      let link: string
      try {
        link = decodeURIComponent(href)
      } catch {
        errors.push(`${file}: invalid encoded URL ${href}`)
        return
      }
      const hash = link.indexOf('#')
      const targetPath = (hash < 0 ? link : link.slice(0, hash)).split('?')[0]
      const fragment = hash < 0 ? '' : link.slice(hash + 1)
      const target = targetPath
        ? posix.normalize(
            targetPath.startsWith('/')
              ? targetPath.slice(1)
              : posix.join(posix.dirname(file), targetPath),
          )
        : file
      if (target.startsWith('../')) {
        errors.push(`${file}: link escapes repository: ${href}`)
        return
      }
      const directory = target === '.' ? '' : target.replace(/\/$/, '') + '/'
      if (!known.has(target) && !files.some((name) => name.startsWith(directory))) {
        errors.push(`${file}: missing target ${href}`)
        return
      }
      if (fragment && /\.md$/i.test(target)) {
        const content = target === file ? markdown : read(target)
        if (
          content === undefined ||
          !anchors(content).has(fragment.replace(/^user-content-/, ''))
        ) {
          errors.push(`${file}: missing heading ${href}`)
        }
      }
    }
    if (!historical && (token.type === 'code' || token.type === 'codespan')) {
      for (const line of token.text.split('\n')) {
        for (const match of line.matchAll(/\bnpm\s+run\s+([\w:-]+)/g)) {
          const worker = /--prefix(?:=|\s+)cloudflare-worker\b/.test(line)
          const manifest = worker ? 'cloudflare-worker/package.json' : 'package.json'
          const pkg = JSON.parse(read(manifest) ?? '{}') as { scripts?: Record<string, string> }
          if (!(match[1] in (pkg.scripts ?? {})))
            errors.push(`${file}: unknown script ${match[1]} in ${manifest}`)
        }
      }
    }
  })
  return errors
}

async function main(): Promise<void> {
  // Include untracked authoring files, but never ignored build output or dependencies.
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter((path) => path && existsSync(path))
  const markdown = [...new Set(files.filter((path) => path.endsWith('.md')))]
  const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined)
  const errors: string[] = []
  const format = process.argv.includes('--format')
  const { writeFileSync } = await import('node:fs')
  for (const file of markdown) {
    const source = read(file)!
    errors.push(...inspectMarkdown(file, source, files, read))
    if (!isHistorical(file)) {
      const options = { ...(await prettier.resolveConfig(file)), filepath: file }
      if (format) writeFileSync(file, await prettier.format(source, options))
      else if (!(await prettier.check(source, options)))
        errors.push(`${file}: formatting differs (run npm run docs:format)`)
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'))
    process.exitCode = 1
  } else
    console.log(
      `Documentation OK: ${markdown.length} Markdown files; historical formatting preserved.`,
    )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main()
