import type ObsidianGoogleDrive from '../../main';
import { Notice, TFile, TFolder } from 'obsidian';
import {
	batchAsync,
	getSyncMessage,
} from '../drive/client';
import { DriveError } from '../drive/types';
import { fileNameFromPath, splitPath, unSplitPath, foldersToBatches } from '../drive/utils';
import { pull } from './pull';
import { ConfirmPushModal, ConfirmUndoModal } from '../modals';
import { checkConnection } from '../drive/client';

export { ConfirmPushModal, ConfirmUndoModal };

export const push = async (
	t: ObsidianGoogleDrive,
	skipConfirmation = false,
): Promise<boolean> => {
	if (t.syncing) return false;

	if (!(await checkConnection())) {
		new Notice('No internet connection. Please try again when connected.');
		return false;
	}

	const initialOperations = Object.entries(t.settings.operations).sort(
		([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
	); // Alphabetical

	const { vault } = t.app;
	const adapter = vault.adapter;

	const proceed =
		skipConfirmation ||
		(await new Promise<boolean>((resolve) => {
			new ConfirmPushModal(t, initialOperations, resolve).open();
		}));

	if (!proceed) return false;

	const syncNotice = await t.startSync();
	try {
		if (!(await pull(t, true))) return false;
		await t.drive.getRootFolderId(true);

		const operations = Object.entries(t.settings.operations);

		const deletes = operations.filter(([_, op]) => op === 'delete');
		const creates = operations.filter(([_, op]) => op === 'create');
		const modifies = operations.filter(([_, op]) => op === 'modify');

		const pathsToIds = Object.fromEntries(
			Object.entries(t.settings.driveIdToPath).map(([id, path]) => [
				path,
				id,
			]),
		);

		const configOnDrive = await t.drive.searchFiles({
			include: ['properties'],
			matches: [{ properties: { config: 'true' } }],
		});

		await Promise.all(
			configOnDrive.map(async ({ properties }) => {
				const path = unSplitPath(properties);
				if (!(await adapter.exists(path))) {
					deletes.push([path, 'delete']);
				}
			}),
		);

		if (deletes.length) {
			const idsToDelete = deletes.map(([path]) => {
				const id = pathsToIds[path];
				return id;
			});
			if (idsToDelete.some((id) => !id)) {
				new Notice(
					'Could not identify all Google Drive files to delete.',
				);
				return false;
			}

			const uniqueIds = [...new Set(idsToDelete as string[])];
			await t.drive.batchDelete(uniqueIds);
			uniqueIds.forEach((id) => delete t.settings.driveIdToPath[id]);
		}

		syncNotice.setMessage('Syncing (33%)');

		if (creates.length) {
			let completed = 0;
			const files = creates.map(([path]) =>
				vault.getAbstractFileByPath(path),
			);

			const folders = files.filter((file) => file instanceof TFolder);

			if (folders.length) {
				const batches = foldersToBatches(folders);

				for (const batch of batches) {
					await batchAsync(
						batch.map((folder) => async () => {
							const id = await t.drive.createFolder({
								name: folder.name,
								parent: folder.parent
									? pathsToIds[folder.parent.path]
									: undefined,
								properties: splitPath(folder.path),
								modifiedTime: new Date().toISOString(),
							});

							completed++;
							syncNotice.setMessage(
								getSyncMessage(33, 66, completed, files.length),
							);

							t.settings.driveIdToPath[id] = folder.path;
							pathsToIds[folder.path] = id;
						}),
					);
				}
			}

			const notes = files.filter((file) => file instanceof TFile);

			await batchAsync(
				notes.map((note) => async () => {
					const id = await t.drive.uploadFile(
						new Blob([await vault.readBinary(note)]),
						note.name,
						note.parent ? pathsToIds[note.parent.path] : undefined,
						{
							properties: splitPath(note.path),
							modifiedTime: new Date().toISOString(),
						},
					);

					completed++;
					syncNotice.setMessage(
						getSyncMessage(33, 66, completed, files.length),
					);

					t.settings.driveIdToPath[id] = note.path;
				}),
			);
		}

		if (modifies.length) {
			let completed = 0;

			const files = modifies
				.map(([path]) => vault.getFileByPath(path))
				.filter((file) => file instanceof TFile);

			const pathToId = Object.fromEntries(
				Object.entries(t.settings.driveIdToPath).map(([id, path]) => [
					path,
					id,
				]),
			);

			await batchAsync(
				files.map((file) => async () => {
					await t.drive.updateFile(
						pathToId[file.path] as string,
						new Blob([await vault.readBinary(file)]),
						{ modifiedTime: new Date().toISOString() },
					);

					completed++;
					syncNotice.setMessage(
						getSyncMessage(66, 99, completed, files.length),
					);
				}),
			);
		}

		const configFilesToSync = await t.drive.getConfigFilesToSync();

		const foldersToCreate = new Set<string>();
		configFilesToSync.forEach((path) => {
			const parts = path.split('/');
			for (let i = 1; i < parts.length; i++) {
				foldersToCreate.add(parts.slice(0, i).join('/'));
			}
		});

		for (const folder of foldersToCreate) {
			if (pathsToIds[folder]) foldersToCreate.delete(folder);
		}

		if (foldersToCreate.size) {
			const batches = foldersToBatches(Array.from(foldersToCreate));

			for (const batch of batches) {
				await batchAsync(
					batch.map((folder) => async () => {
						const id = await t.drive.createFolder({
							name: folder.split('/').pop() || '',
							parent: pathsToIds[
								folder.split('/').slice(0, -1).join('/')
							],
							properties: {
								...splitPath(folder),
								config: 'true',
							},
							modifiedTime: new Date().toISOString(),
						});

						t.settings.driveIdToPath[id] = folder;
						pathsToIds[folder] = id;
					}),
				);
			}
		}

		await batchAsync(
			configFilesToSync.map((path) => async () => {
				if (pathsToIds[path]) {
					await t.drive.updateFile(
						pathsToIds[path],
						new Blob([await adapter.readBinary(path)]),
						{ modifiedTime: new Date().toISOString() },
					);
					return;
				}

				const id = await t.drive.uploadFile(
					new Blob([await adapter.readBinary(path)]),
					fileNameFromPath(path),
					pathsToIds[path.split('/').slice(0, -1).join('/')],
					{
						properties: { ...splitPath(path), config: 'true' },
						modifiedTime: new Date().toISOString(),
					},
				);

				t.settings.driveIdToPath[id] = path;
				pathsToIds[path] = id;
			}),
		);

		await t.drive.updateFile(
			pathsToIds[
				vault.configDir + '/plugins/google-drive-sync/data.json'
			] as string,
			new Blob([JSON.stringify(t.settings, null, 2)]),
			{ modifiedTime: new Date().toISOString() },
		);

		t.settings.operations = {};

		if (!(await t.endSync(syncNotice, false))) return false;

		new Notice('Sync complete!');
		return true;
	} catch (error) {
		t.abortSync(syncNotice);
		if (error instanceof DriveError) {
			new Notice(error.userMessage, 8000);
		} else {
			const msg =
				error instanceof Error ? error.message : String(error);
			new Notice(`Sync failed: ${msg}`, 8000);
		}
		console.error('Google Drive push failed', error);
		return false;
	} finally {
		if (t.syncing) t.abortSync(syncNotice);
	}
};
