# Superpowers Workspace

This directory holds planning and design artifacts used by the repo's agentic workflow.

## Layout

- `plans/` — **forward implementation plans** written before or alongside active work. Each plan is a checkbox-driven task list with exact file paths and code. Named `YYYY-MM-DD-<slug>.md`.
- `specs/` — **design documents** that precede a plan. Output of a brainstorming pass. Named `YYYY-MM-DD-<topic>-design.md`.

## Plans Are Forward-Looking

Files under `plans/` describe work that has not yet landed or is in active progress. They are not retrospectives. If you want to document work after the fact, do one of:
- Update the relevant system doc under `docs/systems/`
- Open an ADR under `docs/adr/` if a genuinely load-bearing decision was made
- Add a paragraph to the commit message or PR description

A document that starts with "We shipped X" does not belong in `plans/`.

## Checklist for a Well-Formed Plan

- Header names the required sub-skill (`superpowers:subagent-driven-development` or `superpowers:executing-plans`)
- Goal is one sentence
- Architecture is two to three sentences
- Tech Stack names the load-bearing libraries
- `Scope out` section lists what this plan does NOT cover
- File Structure section enumerates every file to create or modify
- Pre-flight section verifies a clean starting state
- Tasks use `- [ ]` checkboxes and are scoped to 2-5 minutes per step
- Code steps include the actual code, not placeholders
- Commands include expected output
- Each task ends with a commit step

## Checklist for a Well-Formed Spec

- Dated, with a Status line (Draft / Accepted / Superseded)
- Context, Goals, Non-Goals explicit
- Phases or components enumerated with sizes
- Verification criteria for each component
- Risks / watch-outs surfaced
- Out-of-scope items called out

## Executing Plans

Plans are executed via `superpowers:subagent-driven-development` (fresh subagent per task, with review between) or `superpowers:executing-plans` (inline execution with checkpoints). Pick based on the plan's size and the caller's preference.
