# Mobile Chat Manual QA Checklist

## Test Context
- Date: 2026-03-27
- Build: local development build
- Tester: _TBD_
- Devices:
  - Android emulator: _TBD_
  - iOS simulator/device: _TBD_

## Result Legend
- `PASS`: behavior matches expected.
- `FAIL`: behavior is wrong or broken.
- `BLOCKED`: cannot validate due to environment/backend gap.
- `NOT_RUN`: not executed yet.

## 1) Send / Receive Realtime
| ID | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| SR-01 | Student sends to Lecturer | Open same conversation on 2 devices, send message from Student | Lecturer receives in realtime (<2s), no refresh needed | NOT_RUN | |
| SR-02 | Lecturer sends to Student | Send from Lecturer side | Student receives in realtime (<2s) | NOT_RUN | |
| SR-03 | Message order | Send 3 sequential messages quickly | Receiver sees correct order, no obvious duplicate | NOT_RUN | |
| SR-04 | Failed send retry | Disable network, send message, re-enable network, retry | Message marked failed, then can resend successfully | NOT_RUN | |

## 2) Reconnect / Network Stability
| ID | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| RC-01 | Background resume | Open chat, put app background 30s, return foreground | Socket reconnects automatically, no crash | NOT_RUN | |
| RC-02 | Airplane mode recovery | Turn on airplane mode during active chat, then off | Connection banner appears then recovers; new messages sync | NOT_RUN | |
| RC-03 | Short disconnect message safety | During brief disconnect, send message then recover | Message eventually sent once; no obvious duplicate | NOT_RUN | |

## 3) Unread / Read Badge
| ID | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| UR-01 | Unread increments | Receive new message when conversation list is open but detail not open | Unread badge increases on conversation and Chats tab | NOT_RUN | |
| UR-02 | Read clears on open | Open that conversation | Unread badge clears to 0 | NOT_RUN | |
| UR-03 | Reopen app state | Kill app, open again | Unread/read state remains consistent with backend | NOT_RUN | |

## 4) Message History Pagination
| ID | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| PG-01 | Initial load | Open conversation with long history | Recent page loads quickly | NOT_RUN | |
| PG-02 | Infinite older load | Scroll to load older messages repeatedly | Older pages load without crash or jumpy duplicates | NOT_RUN | |
| PG-03 | Reload after app restart | Restart app and reopen same chat | Cached recent messages appear quickly, then backend sync correct | NOT_RUN | |

## 5) Error Mapping UX
| ID | Scenario | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ER-01 | Unauthorized | Expire token then open chat | Friendly session-expired message and sign-in flow | NOT_RUN | |
| ER-02 | Forbidden conversation | Attempt to open unauthorized conversation ID | Friendly forbidden message | NOT_RUN | |
| ER-03 | Invalid conversation | Open deleted/invalid conversation | Friendly invalid-conversation message | NOT_RUN | |
| ER-04 | Rate limit | Trigger backend throttle path | Friendly retry-later message | NOT_RUN | |

## Current Summary
- Execution status: `NOT_RUN` in this coding session (requires backend chat module + dual-user environment).
- Recommended smoke test order: `SR-01 -> UR-02 -> RC-01 -> PG-01`.
