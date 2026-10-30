import { describe, expect, it } from 'vitest'
import { inspectMarkdown } from './check'

const read = (path: string) =>
  ({
    'README.md': '# Start\n\n## Same\n\n## Same\n\n## **Hello** `world`\n',
    'docs/guide.md': '# Guide\n',
    'docs/space name.md': '# A title\n',
    'package.json': '{"scripts":{"check":"true"}}',
    'cloudflare-worker/package.json': '{"scripts":{"typecheck":"true"}}',
  })[path]
const files = [
  'README.md',
  'docs/guide.md',
  'docs/space name.md',
  'package.json',
  'cloudflare-worker/package.json',
  'docs/image.png',
]
const check = (markdown: string, file = 'docs/guide.md', historical = false) =>
  inspectMarkdown(file, markdown, files, read, historical)

describe('documentation links and commands', () => {
  it('checks relative files, escaped spaces, duplicate and formatted heading anchors', () => {
    expect(
      check(
        '[start](../README.md#same-1) [heading](../README.md#hello-world) [space](space%20name.md#a-title) ![image](image.png)',
      ),
    ).toEqual([])
  })
  it('reports missing files and headings', () => {
    expect(check('[no](missing.md) [bad](../README.md#missing)')).toHaveLength(2)
  })
  it('ignores code examples and external URLs but checks reference links', () => {
    expect(
      check(
        '`[fake](missing.md)`\n```md\n[fake](missing.md)\n```\n[site](https://example.com) [mail](mailto:a@example.com)',
      ),
    ).toEqual([])
    expect(check('[ref][target]\n\n[target]: missing.md')).toHaveLength(1)
  })
  it('validates root and Worker npm scripts in current docs', () => {
    expect(
      check('```bash\nnpm run check\nnpm run typecheck --prefix cloudflare-worker\n```'),
    ).toEqual([])
    expect(check('`npm run typo`')).toHaveLength(1)
    expect(check('`npm run former-script`', 'docs/old.md', true)).toEqual([])
  })
  it('checks historical links without interpreting historical commands', () => {
    expect(check('[broken](missing.md)', 'docs/old.md', true)).toHaveLength(1)
  })
  it('supports explicit HTML anchors, local fragments, and directory links', () => {
    expect(check('<a id="example"></a>\n[here](#example) [docs](../docs/)')).toEqual([])
  })
  it('rejects repository escapes and malformed encoded URLs', () => {
    expect(check('[escape](../../secret.md) [bad](%ZZ.md)')).toHaveLength(2)
  })
})
