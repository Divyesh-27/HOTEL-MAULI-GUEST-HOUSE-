# Lodge Manager - Android Development Guide

## Overview
Lodge Manager is built using a unified codebase targeting both Desktop (Electron) and Mobile (Android via Capacitor). The frontend is a React + Vite application, using Tailwind CSS and Zustand for state management. This document provides specific instructions for building, running, and maintaining the Android Capacitor build.

## Prerequisites
- Node.js (v18+)
- Android Studio (Electric Eel or newer)
- Java Development Kit (JDK 17 recommended)
- Android SDK (API Level 34 recommended)

## Setup Instructions

1. **Install Dependencies**
   Ensure all base dependencies are installed.
   ```bash
   npm install
   ```

2. **Build the Web Assets**
   Capacitor requires a compiled web bundle to inject into the Android project.
   ```bash
   npm run build
   ```

3. **Sync with Capacitor**
   Syncs the built assets (`dist` folder) and capacitor plugins to the native Android project.
   ```bash
   npx cap sync android
   ```

## Running the App on Android

### Using CLI
You can run the application directly on a connected device or running emulator using the Capacitor CLI:
```bash
npx cap run android
```

### Using Android Studio
For advanced debugging and profiling, open the Android project in Android Studio:
```bash
npx cap open android
```
From Android Studio, you can:
- Use the Visual Layout Editor.
- Debug native Java/Kotlin code.
- Profile memory and CPU usage.
- Deploy to various emulator configurations.

## Architecture Guidelines

- **Shared State Management:** State is managed via `Zustand`. Data is persisted to both local storage (or native equivalent) and Supabase. Keep in mind that background syncs might update the store.
- **Component UI:** The mobile interface utilizes components from `src/mobile/`. Mobile screens are optimized for touch interaction and smaller viewports.
- **Data Dominance:** Desktop is treated as the source of truth for conflict resolution. Ensure mobile actions correctly push their timestamped and versioned changes to Supabase to prevent data overriding.
- **Background Sync:** The SyncEngine (`src/lib/syncEngine.ts`) polls Supabase for updates. Ensure `useShallow` is utilized when extracting state from the Zustand store to prevent unwanted re-renders across the app.

## Restrictions (DO NOT MODIFY)
As per the current project constraints, when developing or modifying features:
- **Do NOT modify the Android application directly.** (Use Capacitor configuration files).
- **Do NOT modify Capacitor configuration.**
- **Do NOT modify Supabase architecture.**
- **Do NOT change synchronization logic.**
- **Do NOT redesign the UI.**

## Releasing
To create a production build (APK/AAB), follow standard Android release procedures:
1. Ensure your `capacitor.config.ts` has the correct `appId` and `appName`.
2. Build web assets: `npm run build`
3. Sync Capacitor: `npx cap sync android`
4. Open Android Studio: `npx cap open android`
5. Navigate to **Build > Generate Signed Bundle / APK...** and follow the wizard.
