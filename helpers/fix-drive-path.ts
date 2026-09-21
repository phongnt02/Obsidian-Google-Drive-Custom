import { Notice } from 'obsidian';
import ObsidianGoogleDrive from '../main';
import { DriveError } from './drive/types';
import { unSplitPath } from './drive/utils';

export const fixDrivePath = async (t: ObsidianGoogleDrive) => {
	try {
		const driveFiles = await t.drive.searchFiles({
			include: ['id', 'properties'],
		});
		const idToPath = Object.fromEntries(
			driveFiles.map(({ id, properties }) => [id, unSplitPath(properties)]),
		);
		t.settings.driveIdToPath = idToPath;
		t.settings.operations = {};
		t.settings.changesToken = '';
		await t.saveSettings();
		new Notice(
			'Google Drive paths have been fixed. Please restart the plugin to apply changes.',
			0,
		);
	} catch (error) {
		if (error instanceof DriveError) {
			new Notice(error.userMessage, 8000);
		} else {
			new Notice('Failed to fix Google Drive paths. Please try again.', 8000);
		}
		console.error('Fix Drive paths failed', error);
	}
};
