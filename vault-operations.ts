import type ObsidianGoogleDrive from './main';
import { TAbstractFile, TFile } from 'obsidian';

export const createFolder = async (t: ObsidianGoogleDrive, path: string) => {
	const oldOperation = t.settings.operations[path];
	await t.app.vault.createFolder(path);
	if (oldOperation) t.settings.operations[path] = oldOperation;
	else delete t.settings.operations[path];
};

export const createFile = async (
	t: ObsidianGoogleDrive,
	path: string,
	content: ArrayBuffer,
	modificationDate?: number | string | Date,
) => {
	const oldOperation = t.settings.operations[path];
	if (typeof modificationDate === 'string') {
		modificationDate = new Date(modificationDate);
	}
	if (modificationDate instanceof Date) {
		modificationDate = modificationDate.getTime();
	}

	await t.app.vault.createBinary(path, content, {
		mtime: modificationDate,
	});
	if (oldOperation) t.settings.operations[path] = oldOperation;
	else delete t.settings.operations[path];
};

export const modifyFile = async (
	t: ObsidianGoogleDrive,
	file: TFile,
	content: ArrayBuffer,
	modificationDate?: number | string | Date,
) => {
	const oldOperation = t.settings.operations[file.path];
	if (typeof modificationDate === 'string') {
		modificationDate = new Date(modificationDate);
	}
	if (modificationDate instanceof Date) {
		modificationDate = modificationDate.getTime();
	}

	await t.app.vault.modifyBinary(file, content, {
		mtime: modificationDate,
	});
	if (oldOperation) t.settings.operations[file.path] = oldOperation;
	else delete t.settings.operations[file.path];
};

export const upsertFile = async (
	t: ObsidianGoogleDrive,
	file: string,
	content: ArrayBuffer,
	modificationDate?: number | string | Date,
) => {
	const oldOperation = t.settings.operations[file];
	if (typeof modificationDate === 'string') {
		modificationDate = new Date(modificationDate);
	}
	if (modificationDate instanceof Date) {
		modificationDate = modificationDate.getTime();
	}

	await t.app.vault.adapter.writeBinary(file, content, {
		mtime: modificationDate,
	});
	if (oldOperation) t.settings.operations[file] = oldOperation;
	else delete t.settings.operations[file];
};

export const deleteFile = async (t: ObsidianGoogleDrive, file: TAbstractFile) => {
	const oldOperation = t.settings.operations[file.path];
	await t.app.fileManager.trashFile(file);
	delete t.settings.operations[file.path];
	if (!oldOperation) delete t.settings.operations[file.path];
};
