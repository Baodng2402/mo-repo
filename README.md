# JiHub Mobile App

React Native + Expo mobile app for semester/group collaboration, task tracking, and realtime chat.

## Prerequisites

- Node.js 18+
- npm 9+
- Xcode (iOS) / Android Studio (Android)
- Expo CLI via project scripts

## Quick Start

```bash
npm install
npm start
```

Run platform builds:

```bash
npm run android
npm run ios
npm run web
```

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run check
npm run format
```

- `lint`: ESLint + Prettier check.
- `typecheck`: TypeScript compile check without emit.
- `check`: full local quality gate (`typecheck` + `lint`).
- `format`: auto-fix lint and format issues.

## Tech Stack

- Expo `~52.0.0`
- React Native `0.76.9`
- React `18.3.1`
- TypeScript `~5.3.3`
- Zustand + AsyncStorage
- NativeWind
- Axios + Socket.IO client

## High-Level Structure

```text
src/
	api/           # HTTP client + endpoint constants
	services/      # API/service layer and data normalization
	screens/       # UI screens (auth/main)
	navigation/    # App and tab navigation
	utils/stores/  # Zustand stores (auth/chat)
	hooks/         # Lifecycle hooks
	types/         # Shared type contracts
```

## Team Workflow

- Engineering process: [docs/engineering-workflow.md](docs/engineering-workflow.md)
- Code readability guide: [docs/code-style-guide.md](docs/code-style-guide.md)
- Chat integration notes: [docs/mobile-chat-integration.md](docs/mobile-chat-integration.md)
- Manual QA checklist: [docs/mobile-chat-manual-qa.md](docs/mobile-chat-manual-qa.md)

## CI

GitHub Actions quality workflow:
- [.github/workflows/mobile-quality.yml](.github/workflows/mobile-quality.yml)

It runs `npm run lint` and `npm run typecheck` on pull requests and pushes to `main`.

## Troubleshooting

Reset Expo cache:

```bash
npx expo start --clear
```

Clean install:

```bash
rm -rf node_modules package-lock.json
npm install
```
