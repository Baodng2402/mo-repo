# Code Style Guide (Mobile)

## 1) Folder Responsibility
- `src/services`: API integration + data normalization only.
- `src/utils/stores`: global state and business state transitions.
- `src/screens`: presentation + user interactions.
- `src/hooks`: reusable lifecycle logic.
- `src/types`: shared contracts.

## 2) Naming
- Screen: `FeatureScreen.tsx`
- Hook: `useFeatureThing.ts`
- Store action: verb-first (`loadConversations`, `markConversationAsRead`)
- Avoid vague names like `data`, `item2`, `tempX`.

## 3) Side Effects
- Keep side effects inside `useEffect`/`useFocusEffect`/store actions.
- Do not call APIs directly inside render paths.
- Keep effect dependencies explicit and stable.

## 4) Error Handling
- Map backend errors to friendly messages.
- Show actionable toasts for users.
- Keep low-level diagnostics inside dev-only debug logger.

## 5) UI Guidelines
- Prefer pure render helpers over massive JSX blocks.
- Use memoization only for expensive/repeated rendering.
- Keep tabs, list items, and cards as isolated components when growing.

## 6) Async Rules
- Always handle loading, success, and failure states.
- Guard against double-submit/double-fetch.
- Clean up timers/listeners on unmount.

## 7) Readability Heuristics
- One function = one intent.
- Extract complex condition into named helpers.
- Keep comments only when intent is non-obvious.
