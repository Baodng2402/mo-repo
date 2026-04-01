# WDP391 Mobile App — Copilot Instructions

## Architecture Overview

This is a **React Native + Expo** app with modular navigation, persisted state management, and seamless API integration.

**Key Stack**:
- **Framework**: React Native + Expo (managed workflow, no native code yet)
- **Navigation**: React Navigation with Auth Stack → Main Tabs
- **State Management**: Zustand (persisted to AsyncStorage)
- **Styling**: TailwindCSS via NativeWind
- **API Client**: Axios with auto-token interceptor & 401 auto-logout
- **UI Theme**: Dark theme (#101922 background) to prevent white flashes

**Navigation Structure**: 
```
AppNavigator
├─ AuthStack (SignUpScreen, SignInScreen, LinkThirdPartyScreen)
└─ MainTabs (Dashboard, Classes, Tasks, Newsfeed, Settings) + Drawer
```

---

## Quick Start Commands

```bash
# Setup
npm install
npm start                      # Expo dev server (scan QR with Expo Go app)

# Platform-Specific Development
npm run android                # Emulator or physical device
npm run ios                    # Simulator or physical device
npm run web                    # Web preview (limited features)

# Code Quality & Formatting
npm run lint                   # ESLint check + auto-fix
npm run format                 # Prettier formatting

# Native Build Preparation
npm run prebuild               # Generate native files (android/, ios/) before building

# Production Builds
eas build --platform android   # Full EAS build (requires account)
eas build --platform ios       # Full EAS build (requires account)
```

**App Runs On**: Expo Go (local dev) or native app after prebuild

---

## Important Conventions

### Service Pattern (`src/services/`)
- One service file per API feature (e.g., `authService.ts`, `classService.ts`)
- Each service exports:
  - **Typed functions**: `login(email, password)`, `getClasses()`, etc.
  - **Types/Interfaces**: Co-located in same file (e.g., `class User {}`)
  - **API endpoints**: Use constants from `src/api/endpoint.ts`
- All API calls go through `axiosConfig.ts` (auto-token injection, error handling)

### Zustand State Store (`src/utils/stores/`)
- Global state for user authentication and app state
- **Persistence**: Auto-saves to AsyncStorage under `'user-storage'` key
- **Actions**: `login()`, `logout()`, `setUser()` in store
- Usage in components: `const { user, login } = useUserStore()`
- AsyncStorage key is critical; match it across app

### Screen Organization (`src/screens/`)
- **Auth folder**: `SignUpScreen.tsx`, `SignInScreen.tsx`, `LinkThirdPartyScreen.tsx`
- **Main folder**: Features accessed from MainTabs (Dashboard, Classes, Tasks, Newsfeed, Settings)
- **Naming**: `FeatureScreen.tsx` (PascalCase, suffix with Screen)
- **Pattern**: Hook-based functional components with Zustand

### Navigation & Routing
- **Navigator files** in `src/navigation/`:
  - `AppNavigator.tsx`: Root navigator + auto-login logic (validates JWT on startup)
  - `MainTabNavigator.tsx`: Bottom tabs + drawer navigator
- **Route names**: Use constants (not magic strings) defined in navigator files
- **Navigation props**: `useNavigation()` hook for programmatic navigation
- **Auth flow**: Auto-login validates token → navigates to MainTabs or shows SignIn

### Styling (NativeWind)
- **TailwindCSS utility classes** work directly in React Native: `flex-1 items-center justify-center`
- **Global styles**: [global.css](global.css) — edit this, then restart Expo
- **Dark theme**: All screens use `bg-gray-950` or `#101922` background
- **Colors**: Defined in [tailwind.config.js](tailwind.config.js), use Tailwind naming
- **Responsive**: Use `w-full`, `h-screen`, flex utilities (RN doesn't use media queries)

### API Integration (`src/api/`)
- **axiosConfig.ts**: 
  - Configures base URL (reads from `.env` or defaults)
  - **Auto-interceptor**: Injects JWT token to every request
  - **401 handling**: Auto-logout when token invalid
  - **Error handling**: Catch errors, show toast, logout if needed
- **endpoint.ts**: All API routes as constants (avoid hardcoding URLs in components)
- **Example**:
  ```typescript
  // endpoint.ts
  export const auth = {
    login: '/auth/login',
    signup: '/auth/signup',
    me: '/auth/me'
  };

  // authService.ts
  import axiosInstance from '@/api/axiosConfig';
  export const login = async (email, password) => {
    return axiosInstance.post(auth.login, { email, password });
  };
  ```

### Environment Variables (`.env`)
```
API_URL=http://10.0.2.2:8080  # Android emulator (10.0.2.2 is localhost)
API_URL=http://localhost:8080 # iOS simulator & physical device
API_URL=https://api.production.com  # Production
```
- **Android emulator**: Use `10.0.2.2` (special alias for host localhost)
- **iOS simulator & physical**: Use `localhost` or actual IP
- **Read in app**: `axiosConfig.ts` reads this into axios baseURL

---

## Critical Gotchas & Solutions

| Issue | Cause | Fix |
|-------|-------|-----|
| API endpoint returns 404 | Endpoint URL mismatch or wrong base URL | Check `.env` API_URL matches backend; verify endpoint in `endpoint.ts` |
| Token lost after app restart | AsyncStorage key mismatch | Verify Zustand store uses `'user-storage'` and auth service saves there |
| Styles not applying | TailwindCSS cache not refreshed | Rebuild: `npm start` → restart Expo |
| Android emulator can't reach API | Using localhost instead of 10.0.2.2 | Android emulator must use `10.0.2.2:8080` not `localhost` in `.env` |
| 401 loop on authMe endpoint | Token validation fails | Check backend JWT_SECRET matches mobile app assumptions |
| White flash on startup | Splash screen not matching theme | Ensure `app.json` splash matches #101922 background |
| Navigation back button not working | Wrong screen names in `AppNavigator` | Use exact route names defined in navigator |

---

## File Organization & Key Paths

| Path | Purpose |
|------|---------|
| [App.tsx](App.tsx) | Root file: SafeAreaProvider, NavigationContainer, Toast provider |
| [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx) | Root navigator, Auth/Main stack, auto-login logic |
| [src/navigation/MainTabNavigator.tsx](src/navigation/MainTabNavigator.tsx) | Bottom tab navigator (5 screens) + drawer |
| [src/api/axiosConfig.ts](src/api/axiosConfig.ts) | Axios instance, token interceptor, error handling |
| [src/api/endpoint.ts](src/api/endpoint.ts) | All API route constants (auth, classes, groups, etc.) |
| [src/services/](src/services/) | Feature services (authService, classService, etc.) with types |
| [src/utils/stores/userStore.ts](src/utils/stores/userStore.ts) | Zustand user state + actions |
| [src/screens/](src/screens/) | Feature screens organized by auth/, main/ |
| [src/components/](src/components/) | **Empty** — add shared UI components here |
| [src/types/](src/types/) | Global TypeScript types/interfaces |
| [src/constants/theme.ts](src/constants/theme.ts) | App-wide theme, colors, spacing |
| [.env](.env) | API_URL configuration (critical for backend connection) |
| [app.json](app.json) | Expo config (app name, splash, native settings, plugins) |
| [tailwind.config.js](tailwind.config.js) | TailwindCSS color & spacing config (customize here) |

---

## When Adding New Features

1. **Create service** in `src/services/{feature}Service.ts` with API calls
2. **Define types** in same service file or `src/types/{feature}.ts`
3. **Add endpoint constants** to `src/api/endpoint.ts`
4. **Create screen** in `src/screens/{feature}/` using hooks
5. **Add route to navigator** in `src/navigation/` files
6. **Use Zustand** for global state (if needed), local useState for UI state
7. **Style with NativeWind**: Use `className` on components
8. **Test**: Load `npm start`, scan QR with Expo Go

---

## Debugging Tips

**Auto-Login Flow** (on app startup):
1. App.tsx → AppNavigator mounts
2. AppNavigator checks if user token exists in Zustand store
3. If token exists: calls `authMe()` endpoint to validate
4. If valid: navigates to MainTabs
5. If invalid or no token: shows SignIn screen

**Token Lifecycle**:
- Stored in AsyncStorage via Zustand persist
- Injected by axiosConfig interceptor before every request
- If 401 response: axiosConfig logs out + navigates to SignIn
- Key name must match in Zustand storage name

**API Debugging**:
- Check `.env` API_URL (Android: `10.0.2.2`, iOS: `localhost`)
- Network tab in browser devtools (via `npm run web`)
- Console logs in axiosConfig interceptor for request/response inspection

---

## Useful Commands for AI Assistance

- **Add new screen**: Create feature service → screen component → route in MainTabNavigator
- **Add global state**: Use Zustand store in `src/utils/stores/`, persist to AsyncStorage
- **API integration**: Service in `src/services/`, endpoint constant in `src/api/endpoint.ts`, intercept in `axiosConfig.ts`
- **Styling**: Use `className` with NativeWind utilities, reference `tailwind.config.js` for colors
- **Navigation**: Updates to `src/navigation/`, route names as constants
- **Debugging**: Check console, network requests, AsyncStorage values, Zustand state
