# Engineering Workflow (Senior Standard)

## Goal
A consistent workflow so every contributor (including interns) can ship safely with readable code.

## 1) Branching Strategy
- Never develop directly on `main`.
- Branch format: `type/scope-short-description`.
- Examples:
  - `feat/chat-read-receipt`
  - `fix/auth-token-refresh`
  - `refactor/group-detail-role-resolver`

## 2) Commit Strategy
- Keep commits small and reviewable.
- Commit message format:
  - `feat: add chat unread badge aggregation`
  - `fix: prevent false logout on socket errors`
  - `refactor: extract session token helpers`

## 3) Local Quality Gate (Required)
Run before every push:

```bash
npm run lint
npm run typecheck
```

Or run in one shot:

```bash
npm run check
```

## 4) Pull Request Checklist
- Scope is focused and minimal.
- No unrelated formatting-only noise.
- Clear PR description with:
  - problem
  - solution
  - risk/rollback
  - screenshots (if UI changed)
- `npm run check` passed locally.
- New behavior documented in `docs/` when needed.

## 5) Definition of Done
A task is done only when:
- Feature/bugfix works on Android and iOS flow used by team.
- Lint + typecheck pass.
- Error states have user-friendly messages.
- No debug logs leaking to production paths.
- Navigation/auth state remains stable after app restart.

## 6) Readability Rules
- Keep components short and intent-based.
- Move reusable logic to helpers/hooks/services.
- Prefer explicit names over abbreviations.
- Avoid nested condition complexity; extract small predicates.
- Keep API normalization in service layer, not UI screens.

## 7) Mobile Reliability Rules
- Treat backend as source of truth.
- Use optimistic UI only with clear retry/failure states.
- Never force logout on non-auth transient network errors.
- Cache only what is needed for fast UI hydration.

## 8) Incident Debug Playbook
When login/session issues occur:
1. Verify persisted token exists.
2. Verify `/auth/me` request has Bearer token.
3. Check whether any 401 handler clears token incorrectly.
4. Confirm socket connect errors are not misclassified as unauthorized.
5. Re-test app cold start and background-resume flows.
