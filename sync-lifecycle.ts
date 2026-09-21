import type ObsidianGoogleDrive from './main';
import { Notice } from 'obsidian';
import { checkConnection } from './helpers/drive/client';

export const startSync = async (t: ObsidianGoogleDrive) => {
	if (t.syncing) {
		new Notice('Sync already in progress.');
		throw new Error('Sync already in progress');
	}

	t.syncing = true;
	t.clearAutoPushTimer();
	t.ribbonIcon.addClass('spin');

	if (!(await checkConnection())) {
		t.syncing = false;
		t.ribbonIcon.removeClass('spin');
		new Notice(
			'You are not connected to the internet, so you cannot sync right now. Please try syncing once you have connection again.',
		);
		throw new Error('No internet connection');
	}

	return new Notice('Syncing (0%)', 0);
};

export const endSync = async (
	t: ObsidianGoogleDrive,
	syncNotice?: Notice,
	retainConfigChanges = true,
) => {
	const syncedAt = Date.now();
	if (retainConfigChanges) {
		const configFilesToSync = await t.drive.getConfigFilesToSync();

		await Promise.all(
			configFilesToSync.map(async (file) =>
				t.app.vault.adapter.writeBinary(
					file,
					await t.app.vault.adapter.readBinary(file),
					{ mtime: Date.now() },
				),
			),
		);
	}

	const changesToken = await t.drive.getChangesStartToken();
	if (!changesToken) {
		new Notice(
			'An error occurred fetching Google Drive changes token.',
		);
		abortSync(t, syncNotice);
		return false;
	}
	t.settings.lastSyncedAt = syncedAt;
	t.settings.changesToken = changesToken;
	await t.saveSettings();
	t.ribbonIcon.removeClass('spin');
	t.syncing = false;
	syncNotice?.hide();
	t.resumeAutoPushIfNeeded();
	return true;
};

export const abortSync = (t: ObsidianGoogleDrive, syncNotice?: Notice) => {
	t.ribbonIcon.removeClass('spin');
	t.syncing = false;
	syncNotice?.hide();
	t.resumeAutoPushIfNeeded();
};
