export interface WorkflowRun {
  head_sha: string
  head_branch: string | null
  event: string
  status: string | null
  conclusion: string | null
  head_repository: { full_name: string } | null
}
export function releaseEligible(repo: string, tip: string, trigger: WorkflowRun, prerequisites: WorkflowRun[]): boolean
