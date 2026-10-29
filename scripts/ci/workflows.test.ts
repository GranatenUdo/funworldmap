import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

type Step = { uses?: string; run?: string; env?: Record<string, string> }
type Workflow = {
  on: Record<string, unknown>
  permissions: Record<string, string>
  jobs: Record<
    string,
    { needs?: string[]; if?: string; permissions?: Record<string, string>; steps: Step[] }
  >
}
const load = (file: string) => parse(readFileSync(`.github/workflows/${file}`, 'utf8')) as Workflow

describe('workflow safety contracts', () => {
  it('keeps correctness gating explicit even after failures or skipped jobs', () => {
    const job = load('ci.yml').jobs.required
    expect(job.needs).toEqual(['fast', 'worker', 'docs', 'e2e'])
    expect(job.if).toContain('always()')
    const script = job.steps[0].run!.match(/node -e '([^']+)'/)![1]
    for (const state of ['success', 'failure', 'cancelled', 'skipped']) {
      const results = Object.fromEntries(
        job.needs!.map((name) => [name, { result: name === 'worker' ? state : 'success' }]),
      )
      const result = spawnSync(process.execPath, ['-e', script], {
        env: { ...process.env, RESULTS: JSON.stringify(results) },
      })
      expect(result.status).toBe(state === 'success' ? 0 : 1)
    }
  })
  it('does not authorize deployment directly from a push, PR, or manual dispatch', () => {
    const workflow = load('deploy.yml')
    expect(Object.keys(workflow.on)).toEqual(['workflow_run'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.jobs.authorize.if).toContain("event == 'push'")
    expect(workflow.jobs.authorize.if).toContain('head_repository.full_name == github.repository')
    expect(workflow.jobs.deploy.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    })
  })
  it('pins external Actions by full SHA in every workflow', () => {
    for (const file of ['ci.yml', 'deploy.yml', 'codeql.yml', 'docs-links.yml']) {
      for (const job of Object.values(load(file).jobs)) {
        for (const step of job.steps) if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/)
      }
    }
  })
})
