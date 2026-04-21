import { pathToFileURL } from 'node:url'

/**
 * ESM-safe "was this module run directly?" check. Handles Windows path quirks
 * where `process.argv[1]` uses backslashes and `import.meta.url` uses forward
 * slashes with a three-slash file URL.
 */
export function isCliEntryPoint(importMetaUrl: string): boolean {
  if (!process.argv[1]) return false
  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
