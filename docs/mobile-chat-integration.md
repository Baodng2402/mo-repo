# Mobile Chat Integration Guide

## Scope
- One-to-one chat between Student and Lecturer.
- Realtime source-of-truth is backend (REST + WebSocket).
- No Firebase data storage for chat.

## Environment Setup
Add these variables in `.env`:

```env
API_URL=http://10.0.2.2:8080
CHAT_WS_URL=http://10.0.2.2:8080
CHAT_SOCKET_NAMESPACE=/chat
```

Notes:
- `CHAT_WS_URL` is optional. If omitted, app falls back to `API_URL`.
- `CHAT_SOCKET_NAMESPACE` defaults to `/chat`.
- Android emulator should use `10.0.2.2` instead of `localhost`.

## REST Contract Used by Mobile
All endpoints are mapped in `src/api/endpoint.ts` under `CHAT`.

- `GET /api/chat/conversations`
- `POST /api/chat/conversations` (body: `participant_user_id`)
- `GET /api/chat/conversations/:conversationId`
- `GET /api/chat/conversations/:conversationId/messages?cursor=&limit=`
- `POST /api/chat/conversations/:conversationId/messages` (body: `content`, `client_message_id`)
- `POST /api/chat/conversations/:conversationId/read`

Expected error codes/status handling:
- `unauthorized` or HTTP `401`: force sign-out flow.
- `forbidden` or HTTP `403`: show conversation access error.
- `invalid_conversation` or HTTP `404`: show invalid conversation error.
- `rate_limited` or HTTP `429`: show temporary throttle message.

## WebSocket Contract Used by Mobile
Socket namespace is configurable with `CHAT_SOCKET_NAMESPACE`.

Client emits:
- `send`: `{ conversation_id, content, client_message_id }`
- `read`: `{ conversation_id, message_id? }`
- `typing_start`: `{ conversation_id }`
- `typing_stop`: `{ conversation_id }`
- `join_conversation`: `{ conversation_id }`
- `leave_conversation`: `{ conversation_id }`

Server listens:
- `new_message`
- `message_read`
- `typing`
- `error`

## Mobile Architecture
Core files:
- `src/services/chatService.ts`: REST API + normalization.
- `src/services/chatSocket.ts`: Socket manager + reconnect/backoff.
- `src/utils/stores/chatStore.ts`: Zustand chat state, pagination, retry, cache.
- `src/hooks/useChatLifecycle.ts`: app foreground/background socket lifecycle.
- `src/screens/main/ConversationsScreen.tsx`: conversation list UI.
- `src/screens/main/ChatDetailScreen.tsx`: direct message UI.

Navigation wiring:
- Chats tab in `src/navigation/MainTabNavigator.tsx`.
- Chat detail route in `src/navigation/AppNavigator.tsx` (`ChatDetail`).

## Realtime + Reliability Flow
Send message:
1. Create optimistic local message (`sending`).
2. Try socket `send` with ack timeout.
3. If socket send fails, fallback to REST send.
4. Mark as `sent` on success, `failed` on final failure.
5. Failed message supports manual retry and auto retry when reconnecting.

Reconnect:
1. App active + authenticated => socket connect.
2. Socket disconnected/network unstable => built-in reconnect with backoff.
3. On reconnect, app reloads conversation list and retries failed outbox.

Read status:
1. Open conversation => mark as read via REST.
2. Emit socket `read` for realtime sync.
3. Conversation unread badge is cleared locally immediately, then corrected by BE state on next fetch.

Typing:
1. User typing emits `typing_start`.
2. Idle debounce emits `typing_stop`.
3. Incoming typing events expire automatically after 3.5 seconds.

## Pagination + Local Cache
- Message history uses cursor pagination (`nextCursor`, `hasMore`).
- Infinite load is triggered when user scrolls for older messages.
- Local cache persists:
  - conversation list
  - recent messages (capped to latest 40 per conversation)
- Cache key: `chat-storage`.

## Known Limitations
- Contract assumes Socket.IO protocol and `/chat` namespace by default.
- Conversation bootstrap from user search is not yet exposed in UI; current UI displays existing conversations.
- Offline queue is lightweight (in-memory failed message retry + persisted message snapshot), not a full guaranteed delivery queue.
- Push notification with FCM is intentionally out-of-scope in this phase.
