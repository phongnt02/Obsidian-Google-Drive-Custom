# Google Drive Sync

Obsidian plugin for syncing vault to Google Drive.

## Features

- Two-way sync (Obsidian ↔ Google Drive)
- Cross-device support
- iOS app support
- Local file prioritization (auto-resolves conflicts)
- Multiple vaults per Google account
- Configuration syncing

## Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID (Desktop App type)
3. Enable Google Drive API in your project
4. Copy the **Client ID** and **Client Secret**
5. Get a refresh token using your Client ID (via OAuth authorization flow)
6. Open Obsidian → Settings → Community plugins → Google Drive Sync
7. Enter your **Client ID**, **Client Secret**, and **Refresh Token**
8. Reload Obsidian

## Usage

- **Pull from Google Drive**: Run command `Pull from Google Drive` or auto-pull on startup
- **Push to Google Drive**: Click sync ribbon icon or run `Push to Google Drive`
- **Reset local vault**: Run `Reset local vault to Google Drive` to overwrite local with cloud state
- **Auto push**: Enable in settings to push 1 minute after last local change

## New Devices

1. Download the vault folder from Google Drive
2. Move it to your desired location
3. Open Obsidian and set vault location

## Notes

- **Always backup your vault** before using this plugin
- Do **NOT** manually upload files to the Google Drive vault folder
- Do **NOT** edit files outside Obsidian (changes won't be tracked)
- Sync with stable internet connection to avoid data corruption
- Edit notes on one device at a time to avoid conflicts

## Multiple Vaults

- Each vault is tagged with its name in Google Drive properties
- Vault names must match across devices for syncing
- Do NOT rename local vaults that are being synced

## License

0-BSD
