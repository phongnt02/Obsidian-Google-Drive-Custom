import { Platform } from 'obsidian';

export interface PluginSettings {
	refreshToken: string;
	clientId: string;
	clientSecret: string;
	autoPush: boolean;
	operations: Record<string, 'create' | 'delete' | 'modify'>;
	driveIdToPath: Record<string, string>;
	rootFolderId: string;
	lastSyncedAt: number;
	changesToken: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	refreshToken: '',
	clientId: '',
	clientSecret: '',
	autoPush: false,
	operations: {},
	driveIdToPath: {},
	rootFolderId: '',
	lastSyncedAt: 0,
	changesToken: '',
};
