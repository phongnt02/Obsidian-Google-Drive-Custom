# Google Drive Sync

Obsidian plugin for syncing vault to Google Drive.

## Features

- Two-way sync (Obsidian ↔ Google Drive)
- Cross-device support (Desktop + iOS)
- **Login with Google** - One-click OAuth authentication
- Local file prioritization (auto-resolves conflicts)
- Multiple vaults per Google account
- Configuration syncing
- Auto push (optional)

## Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one

### Step 2: Enable Google Drive API

1. Go to **APIs & Services > Library**
2. Search for **"Google Drive API"**
3. Click **"Enable"**

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **"External"** user type (or "Internal" for Google Workspace)
3. Fill in app name and user support email
4. Add your email as developer contact
5. Save and continue through scopes and test users

### Step 4: Add Test Users (Important!)

1. In OAuth consent screen, go to **"Test users"** section
2. Click **"Add users"**
3. Add **ALL Google accounts** you want to use with this plugin
4. Save

### Step 5: Create OAuth Client ID

1. Go to **APIs & Services > Credentials**
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Select **"Desktop app"** as application type
4. Name it (e.g., "Obsidian Google Drive Sync")
5. Click **"Create"**
6. Copy the **Client ID** and **Client Secret**

### Step 6: Configure Plugin

1. Install plugin via [BRAT](https://github.com/TfTHacker/obsidian42-brat) (for iOS support)
2. Open Obsidian → Settings → Community plugins → Google Drive Sync
3. Enter **Client ID** and **Client Secret**
4. Click **"Login with Google"**
5. Authorize in the browser window that opens
6. Done! Start syncing.

## Usage

### Sync commands

- **Pull from Google Drive**: Downloads changes from Drive to local. Run via command palette or auto-runs on startup.
- **Push to Google Drive**: Uploads local changes to Drive. Click the sync ribbon icon or run via command palette. This also pulls first, so it's a safe all-in-one sync.
- **Auto push**: Enable in settings to automatically push 1 minute after your last local change.

### Maintenance commands

- **Reset local vault to Google Drive**: Overwrites your entire local vault with whatever is on Google Drive. **This is destructive** — all local-only changes will be lost. Use when your local vault is corrupted or you want to start fresh.
- **Fix Drive paths**: Rebuilds the internal mapping between Google Drive file IDs and local file paths. Use when sync reports errors about missing files or paths after a failed sync or manual file moves. Requires plugin restart after running.

## New devices

To sync from a new device, create a vault with the **same name** as on Google Drive, install the plugin, authenticate, and run **Pull from Google Drive**.

## Important Notes

- **Always backup your vault** before using this plugin
- You **MUST** use **"Desktop app"** OAuth client type (not "Web application")
- You **MUST** add your email as a test user in OAuth consent screen
- Do **NOT** manually upload files to the Google Drive vault folder
- Do **NOT** edit files outside Obsidian (changes won't be tracked)
- First sync may take a while depending on vault size
- Edit notes on one device at a time to avoid conflicts
- Sync with stable internet connection to avoid data corruption

## Multiple Vaults

- Each vault is tagged with its name in Google Drive properties
- Vault names must match across devices for syncing
- Do NOT rename local vaults that are being synced

## Troubleshooting

### "Access Denied" Error

- Make sure you added your email as a test user in OAuth consent screen
- Make sure you're using the correct Google account

### Sync Not Working

- Check internet connection
- Try re-authenticating via "Login with Google" in settings
- Check Google Cloud Console for any API quotas or errors

### iOS Not Syncing

- Make sure you installed via BRAT plugin
- Make sure vault name matches across devices
