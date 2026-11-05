
# GitHub Copilot Instructions

## 1. Project Structure and Folder Restrictions

### Allowed folders
Work exclusively within:
- `frontend/`
- `core/`
- `backend/`

### README
- Always read the root `README.md` first to understand the project architecture, components, technologies, and conventions.
- Use it as the primary project reference.
- Avoid rereading it unnecessarily.

### Infrastructure — STRICTLY FORBIDDEN
The `infrastructure/` folder is exclusively dedicated to launching and managing Kubernetes infrastructure.

- NEVER read, open, inspect, search, analyze, or modify anything inside `infrastructure/`.
- NEVER execute commands targeting this folder.
- Do not use its contents as references.
- Treat this folder as completely off-limits.
- If a task requires changes inside it, explain why and ask for explicit authorization.

**Only work within `frontend/`, `core/`, and `backend/`.**

## 2. General Rules
- Be concise and efficient.
- Minimize token consumption in every interaction.
- Avoid unnecessary explanations and repeated information.
- Prefer simple, maintainable solutions.
- Do not generate unnecessary files, abstractions, or dependencies.
- Read only the files necessary for the requested task.

## 3. Command Execution Restrictions
- NEVER execute terminal commands without explicit user authorization.
- This includes installation, build, test, Git, Docker, Kubernetes, and infrastructure commands.
- You may suggest commands and explain their purpose.
- Never execute commands just to verify modifications.
- Never install packages or start/stop services without permission.

## 4. Token and Context Optimization
- Use the minimum context necessary.
- Never scan the entire repository.
- Avoid reading unrelated files and folders.
- Prefer targeted searches and specific file reads.
- Do not repeatedly inspect files already analyzed unless necessary.
- Avoid unnecessary code output.
- Reuse existing utilities and project patterns.
- Do not explore unrelated dependencies.

## 5. Independent Research Agents

For requests requiring external research, technical investigation, documentation lookup, or comparisons:

1. Delegate research to an independent subagent whenever available.
2. The research agent must work independently from the lead coding agent.
3. Research agents must NEVER modify project source code.
4. Research agents must NEVER inspect the forbidden `infrastructure/` folder.
5. Ask for concise findings containing:
   - Main findings.
   - Reliable sources and documentation links.
   - Recommended approach.
   - Relevant technical details.
   - Potential limitations and risks.
6. Return only the useful research summary to the lead agent.
7. The lead agent evaluates findings and decides how to implement the solution.
8. Never transfer the entire research conversation to the lead agent.

If independent agents are unavailable, perform focused research without unnecessarily expanding the context.

## 6. Lead Agent Responsibilities

The lead agent is responsible for:
- Understanding the user's request.
- Reading the root README when needed.
- Coordinating research agents.
- Reviewing research summaries.
- Making implementation decisions.
- Modifying authorized source code.
- Maintaining architectural consistency.
- Reporting modified files and summarizing changes.

Only the lead agent modifies project code.

## 7. Strict Code Modification Scope
- Modify ONLY files explicitly mentioned by the user or strictly necessary within the authorized folders.
- Never modify unrelated files.
- Never perform repository-wide refactoring without permission.
- Do not change architecture or interfaces unnecessarily.
- Do not rename existing files, functions, APIs, or components without authorization.
- NEVER modify `infrastructure/`.
- If a task requires modifications outside the allowed folders, explain why and request permission.
- Preserve existing behavior unless explicitly asked otherwise.

## 8. Code Quality
- Follow existing project conventions.
- Avoid unnecessary dependencies.
- Avoid duplicated functionality.
- Handle errors appropriately.
- Keep implementations focused and modular.
- Do not introduce speculative features.
- Never silently remove existing functionality.

## 9. Context Window Management and Handoff

When the context window approaches its limit, generate a concise handoff summary in `AGENT_HANDOFF.md` at the repository root.

The summary must contain:

### Project Context
- Project objective.
- Relevant architecture and technologies.

### Current Task
- Original user request.
- Current implementation objective.

### Completed Work
- Changes already made.
- Files modified.
- Important decisions.

### Current State
- Working functionality.
- Incomplete work.
- Known issues and errors.

### Technical Details
- Relevant functions, APIs, configurations, and dependencies.
- Important constraints.
- Research findings.

### Next Steps
- Exact actions for the next agent.
- Authorized files that may be modified.
- Outstanding questions.

Additional rules:
- Keep summaries concise and factual.
- Do not include irrelevant conversation history.
- Avoid large code blocks.
- Preserve important decisions and constraints.
- The next agent must read `AGENT_HANDOFF.md` before continuing.
- Never assume unfinished work is completed.
- Do not overwrite useful handoff information without preserving relevant context.

## 10. User Communication
- Be direct and concise.
- Explain important decisions briefly.
- List every modified file.
- Distinguish completed work from proposed changes.
- Report blockers instead of making assumptions.
- Ask questions only when necessary.
- Never claim tests or commands succeeded if they were not executed.

## 11. Priority Order

When instructions conflict, follow this priority:

1. Explicit user instructions.
2. Repository folder restrictions and authorization boundaries.
3. Project-specific instructions.
4. These general Copilot instructions.
5. Agent recommendations and assumptions.

**Core principles:** Read the README, work only in `frontend/`, `core/`, and `backend/`, NEVER touch or inspect `infrastructure/`, delegate research independently, minimize token usage, never execute commands without authorization, and preserve context through concise handoff summaries.
