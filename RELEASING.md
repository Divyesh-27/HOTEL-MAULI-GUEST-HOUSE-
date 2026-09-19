# Releasing a New Version

Step-by-step guide for publishing an update to the Hotel Mauli Guest House desktop app via GitHub Releases. Once published, all running instances will detect the update automatically.

---

## Prerequisites

- Git installed and configured
- Node.js / npm installed
- GitHub Personal Access Token (PAT) with `repo` scope
- Repository pushed to GitHub with the `publish` config in `package.json` pointing to the correct `owner` and `repo`

---

## Step 1: Bump the Version

Update the version in **both** files — they must match:

1. **`package.json`** — change the `"version"` field:
   ```json
   "version": "1.3.2"
   ```

2. **`src/constants/version.ts`** — change the exported constant:
   ```ts
   export const APP_VERSION = '1.3.2';
   ```

Follow [Semantic Versioning](https://semver.org/):
- **Patch** (1.3.1 → 1.3.2): Bug fixes, small tweaks
- **Minor** (1.3.1 → 1.4.0): New features, non-breaking
- **Major** (1.3.1 → 2.0.0): Breaking changes

---

## Step 2: Set the GitHub Token

In PowerShell, set the `GH_TOKEN` environment variable for the current session:

```powershell
$env:GH_TOKEN = "ghp_your_personal_access_token_here"
```

> ⚠️ **NEVER** commit this token to any file in the repository.
> ⚠️ **NEVER** paste it into `.env` or any config file.
> It is only needed at build time in the terminal session.

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
4. Upload the installer to GitHub Releases (`--publish always`)

---

## Step 4: Verify the Release

1. Go to your GitHub repository → **Releases** tab
2. Confirm a new release (e.g. `v1.3.2`) was created with:
   - `HOTEL MAULI GUEST HOUSE Setup 1.3.2.exe` — the installer
   - `HOTEL MAULI GUEST HOUSE Setup 1.3.2.exe.blockmap` — differential download map
   - `latest.yml` — metadata file that `electron-updater` reads to detect new versions
3. If any of these are missing, the auto-update will not work.

---

## Step 5: How Users Receive the Update

Running instances of the app will:
1. **Automatically check** for updates on launch and every 4 hours
2. **Download** the update silently in the background
3. **Show a notification** at the bottom-right: "Update v1.3.2 ready — Restart Now / Later"
4. On "Restart Now": the app quits, installs the update, and relaunches
5. On "Later": the update will install on the next natural app quit/restart

The user's **SQLite database** (in `%APPDATA%/hotel-mauli-guest-house/`) is **never touched** by the update — only the application code is replaced.

Users can also manually check via: **Admin → Developer Tools → Check for Updates**

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `GH_TOKEN` not set | Set `$env:GH_TOKEN` before running the publish command |
| Release not appearing | Check the `owner` and `repo` in `package.json`'s `build.publish` config match your actual GitHub repo |
| `latest.yml` missing | Ensure you used `--publish always` (the `electron:publish` script does this automatically) |
| App not detecting update | Verify the version in `package.json` is higher than the installed version. Check the app's console log for `[Updater]` messages |
| Private repo access | Ensure your PAT has `repo` scope. For private repos, `electron-updater` uses the token baked into `app-update.yml` at build time |
