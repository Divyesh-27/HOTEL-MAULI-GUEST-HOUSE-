# Releasing a New Version

Step-by-step guide for publishing an update to the Hotel Mauli Guest House desktop app via GitHub Releases. Once published, all running instances will detect the update automatically, download it in the background, and apply it silently with relaunch.

---

## Prerequisites

- Git installed and configured
- Node.js / npm installed
- GitHub Personal Access Token (PAT) with `repo` scope
- Public repository configured in `package.json` (`build.publish.provider: "github"`, `owner: "Divyesh-27"`, `repo: "HOTEL-MAULI-GUEST-HOUSE-"`)

---

## Step 1: Bump the Version

Update the version in **both** files — they must match:

1. **`package.json`** — change the `"version"` field:
   ```json
   "version": "1.5.3"
   ```

2. **`src/constants/version.ts`** — change the exported constant:
   ```ts
   export const APP_VERSION = '1.5.3';
   ```

Follow [Semantic Versioning](https://semver.org/):
- **Patch** (1.5.2 → 1.5.3): Bug fixes, auto-updater fixes, small tweaks
- **Minor** (1.5.2 → 1.6.0): New features, non-breaking
- **Major** (1.5.2 → 2.0.0): Breaking changes

---

## Step 2: Set the GitHub Token

In PowerShell, set the `GH_TOKEN` environment variable for the current session:

```powershell
$env:GH_TOKEN = "your_personal_access_token_here"
```

> ⚠️ **NEVER** commit this token to any file in the repository.
> ⚠️ **NEVER** paste it into `.env` or any config file.
> It is only needed at build time in the terminal session for `electron-builder`.

---

## Step 3: Build & Publish

Run the publish command:

```powershell
npm run electron:publish
```

This will:
1. Clean `dist/` and `release/` directories
2. Build the Vite frontend (`vite build`)
3. Build the NSIS Windows installer (`electron-builder --win`)
4. Upload the installer, blockmap, and `latest.yml` to GitHub Releases (`--publish always`)

---

## Step 4: Verify the Release

1. Go to your GitHub repository → **Releases** tab (`https://github.com/Divyesh-27/HOTEL-MAULI-GUEST-HOUSE-/releases`)
2. Confirm a new release (e.g. `v1.5.3`) was created with:
   - `HOTEL-MAULI-GUEST-HOUSE-Setup-1.5.3.exe` — the installer
   - `HOTEL-MAULI-GUEST-HOUSE-Setup-1.5.3.exe.blockmap` — differential download map
   - `latest.yml` — metadata file that `electron-updater` reads to detect new versions
3. Verify that the release is **published** (not marked as Draft).

---

## Step 5: How Running Instances Receive Updates

Installed instances of the app follow this automated flow:

1. **On Launch Check:** Checks for updates immediately on launch (500ms after window is created).
2. **Periodic Check:** Automatically checks every 4 hours in the background.
3. **Background Download:** If a newer version exists in `latest.yml`, it automatically downloads in the background with progress displayed in the UI.
4. **Active Flow Protection:**
   - If a checkout or billing flow is in progress (`Billing` or `Registration` tab), the update is postponed until the user leaves the tab.
   - Once idle, a short notice appears: *"Updating, app will restart in 3 seconds"*.
5. **Silent Install & Relaunch:**
   - The SQLite database is safely flushed to disk and closed (`saveDatabase()` & `database.close()`).
   - `autoUpdater.quitAndInstall(true, true)` executes a silent NSIS installation and immediately relaunches the updated app.
   - All guest data, active bookings, and history stored in `%APPDATA%/hotel-mauli-guest-house/hotel_mauli.db` remain 100% intact.

---

## Diagnostics & Logging

All updater activity and errors are logged using `electron-log` to:
```
%APPDATA%/hotel-mauli-guest-house/logs/updater.log
```

You can view real-time updater activity in PowerShell with:
```powershell
Get-Content "$env:APPDATA\hotel-mauli-guest-house\logs\updater.log" -Wait -Tail 30
```
