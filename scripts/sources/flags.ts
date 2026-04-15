import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FLAGS_DIR = join(process.cwd(), 'public', 'flags')

export async function downloadFlags(cca2Codes: string[]): Promise<void> {
  if (!existsSync(FLAGS_DIR)) {
    mkdirSync(FLAGS_DIR, { recursive: true })
  }

  console.log(`Downloading ${cca2Codes.length} SVG flags...`)
  let downloaded = 0
  let failed = 0
  const BATCH_SIZE = 20

  for (let i = 0; i < cca2Codes.length; i += BATCH_SIZE) {
    const batch = cca2Codes.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (cca2) => {
        const url = `https://flagcdn.com/${cca2.toLowerCase()}.svg`
        const resp = await fetch(url)
        if (!resp.ok) return false

        const svg = await resp.text()
        writeFileSync(join(FLAGS_DIR, `${cca2}.svg`), svg, 'utf-8')
        return true
      }),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        downloaded++
      } else {
        failed++
      }
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, cca2Codes.length)}/${cca2Codes.length}`)
  }

  console.log(`\n  Downloaded ${downloaded} flags (${failed} failed)`)
}
