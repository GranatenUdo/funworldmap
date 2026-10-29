/**
 * @typedef {{head_sha: string, head_branch: string|null, event: string,
 * status: string|null, conclusion: string|null,
 * head_repository: {full_name: string}|null}} Run
 */
/** @param {string} repo @param {string} tip @param {Run} trigger @param {Run[]} prerequisites */
export function releaseEligible(repo, tip, trigger, prerequisites) {
  const successfulMainPush = (run) => run?.head_sha === tip && run.head_branch === 'main' &&
    run.event === 'push' && run.status === 'completed' && run.conclusion === 'success' &&
    run.head_repository?.full_name === repo
  return successfulMainPush(trigger) && prerequisites.length === 2 && prerequisites.every(successfulMainPush)
}

// Called only from the trusted main checkout in the Pages workflow.
export async function checkRelease({ github, context, core }) {
  const { owner, repo } = context.repo
  const tip = (await github.rest.git.getRef({ owner, repo, ref: 'heads/main' })).data.object.sha
  const trigger = context.payload.workflow_run
  const prerequisites = []
  for (const workflow_id of ['ci.yml', 'codeql.yml']) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      owner, repo, workflow_id, branch: 'main', event: 'push', head_sha: tip, per_page: 100,
    })
    // The latest run attempt must succeed; an older green run cannot hide a newer failure.
    const latest = data.workflow_runs.sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0]
    if (latest) prerequisites.push(latest)
  }
  const eligible = releaseEligible(`${owner}/${repo}`, tip, trigger, prerequisites)
  core.setOutput('eligible', String(eligible))
  if (eligible) core.setOutput('sha', tip)
  core.info(eligible ? `Verified CI and CodeQL for ${tip}` : 'No deployment: main push prerequisites are not all current and successful.')
}
