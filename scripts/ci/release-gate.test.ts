import { describe, expect, it } from 'vitest'
import { releaseEligible } from './release-gate.mjs'
const repo = 'GranatenUdo/funworldmap'
const sha = 'abc123'
const run = {
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  head_repository: { full_name: repo },
}

describe('release authorization', () => {
  it('requires successful CI and CodeQL for the current main push', () => {
    expect(releaseEligible(repo, sha, run, [run, run])).toBe(true)
  })
  it.each(['failure', 'cancelled', 'skipped', null])('rejects a %s prerequisite', (conclusion) => {
    expect(releaseEligible(repo, sha, run, [run, { ...run, conclusion }])).toBe(false)
  })
  it('rejects missing and pending prerequisites', () => {
    expect(releaseEligible(repo, sha, run, [run])).toBe(false)
    expect(releaseEligible(repo, sha, run, [run, { ...run, status: 'in_progress' }])).toBe(false)
  })
  it('rejects forks, PRs, schedules, wrong branches and stale commits', () => {
    for (const change of [
      { event: 'pull_request' },
      { event: 'schedule' },
      { head_branch: 'topic' },
      { head_sha: 'old' },
      { head_repository: { full_name: 'other/repo' } },
    ]) {
      expect(releaseEligible(repo, sha, { ...run, ...change }, [run, run])).toBe(false)
      expect(releaseEligible(repo, sha, run, [run, { ...run, ...change }])).toBe(false)
    }
  })
})
