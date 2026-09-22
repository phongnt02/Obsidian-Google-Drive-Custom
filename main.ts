import { checkConnection, getDriveClient } from './helpers/drive/client';
import { refreshAccessToken } from './helpers/drive/requests';
import { pull } from './helpers/sync/pull';
import { push } from './helpers/sync/push';
import { reset } from './helpers/sync/reset';
import {
	App,
	debounce,
	Notice,
	Platform,
	Plugin,
	PluginSettingTab,
	type SettingDefinitionItem,
	TAbstractFile,
	TFile,
	Setting,
} from 'obsidian';
import { fixDrivePath } from './helpers/fix-drive-path';
import { startSync, endSync, abortSync } from './sync-lifecycle';
import {
	createFolder as vaultCreateFolder,
	createFile as vaultCreateFile,
	modifyFile as vaultModifyFile,
	upsertFile as vaultUpsertFile,
	deleteFile as vaultDeleteFile,
} from './vault-operations';
import {
	PluginSettings,
	DEFAULT_SETTINGS,
} from './settings';
import { startOAuthFlow, exchangeCodeForTokens } from './helpers/oauth-flow';

export type { PluginSettings } from './settings';

export default class ObsidianGoogleDrive extends Plugin {
	settings!: PluginSettings;
	accessToken = {
		token: '',
		expiresAt: 0,
	};
	drive = getDriveClient(this);
	ribbonIcon!: HTMLElement;
	syncing!: boolean;
	autoPushTimer?: number;

	async onload() {
		const { vault } = this.app;

		await this.loadSettings();

		this.addSettingTab(new SettingsTab(this.app, this));

		if (!this.settings.refreshToken) {
			new Notice(
				"Please add your refresh token to Google Drive sync through our website or our readme/this plugin's settings. If you haven't already, please read through this plugin's readme or website for instructions on how to use this plugin. Be careful of your first sync, and make sure to back up your data before your first sync.",
				10000,
			);
			return;
		}

		this.ribbonIcon = this.addRibbonIcon(
			'refresh-cw',
			'Push to Google Drive',
			() => {
				if (this.syncing) return;
				void push(this);
			},
		);

		this.addCommand({
			id: 'push',
			name: 'Push to Google Drive',
			callback: () => push(this),
		});

		this.addCommand({
			id: 'pull',
			name: 'Pull from Google Drive',
			callback: () => pull(this),
		});

		this.addCommand({
			id: 'reset',
			name: 'Reset local vault to Google Drive',
			callback: () => reset(this),
		});

		this.addCommand({
			id: 'fix-drive-path',
			name: 'Fix Google Drive paths',
			callback: () => fixDrivePath(this),
		});

		this.registerEvent(
			this.app.workspace.on('quit', () => this.saveSettings()),
		);

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				vault.on('create', (file) => this.handleCreate(file)),
			);
			this.registerEvent(
				vault.on('delete', (file) => this.handleDelete(file)),
			);
			this.registerEvent(
				vault.on('modify', (file) => this.handleModify(file)),
			);
			this.registerEvent(
				vault.on('rename', (file, oldPath) =>
					this.handleRename(file, oldPath),
				),
			);

			void checkConnection().then(async (connected) => {
				if (!connected) return;

				try {
					const syncNotice = await startSync(this);
					if (await pull(this, true)) {
						await endSync(this, syncNotice);
					}
				} catch (error) {
					// startSync shows its own Notice before throwing
					// pull/endSync errors are handled by their own catch blocks
					console.error('Startup sync failed', error);
				}
			});
		});
	}

	onunload() {
		this.clearAutoPushTimer();
		void this.saveSettings();
		return;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as PluginSettings,
		);
	}

	saveSettings() {
		return this.saveData(this.settings);
	}

	debouncedSaveSettings = debounce(this.saveSettings.bind(this), 500, true);

	clearAutoPushTimer() {
		if (this.autoPushTimer === undefined) return;
		window.clearTimeout(this.autoPushTimer);
		this.autoPushTimer = undefined;
	}

	scheduleAutoPush() {
		this.clearAutoPushTimer();
		if (!this.settings.autoPush || this.syncing) return;

		this.autoPushTimer = window.setTimeout(() => {
			this.autoPushTimer = undefined;
			if (
				this.syncing ||
				!this.settings.autoPush ||
				!Object.keys(this.settings.operations).length
			) {
				return;
			}
			void push(this, true);
		}, 60_000);
	}

	resumeAutoPushIfNeeded() {
		if (Object.keys(this.settings.operations).length) {
			this.scheduleAutoPush();
		}
	}

	handleCreate(file: TAbstractFile) {
		if (this.settings.operations[file.path] === 'delete') {
			if (file instanceof TFile) {
				this.settings.operations[file.path] = 'modify';
			} else {
				delete this.settings.operations[file.path];
			}
		} else {
			if (file.path.includes('"')) {
				new Notice(
					`File path ${file.path} contains double quotes and will not be synced.`,
				);
				return;
			}
			this.settings.operations[file.path] = 'create';
		}
		this.debouncedSaveSettings();
		this.scheduleAutoPush();
	}

	handleDelete(file: TAbstractFile) {
		if (this.settings.operations[file.path] === 'create') {
			delete this.settings.operations[file.path];
		} else if (!file.path.includes('"')) {
			this.settings.operations[file.path] = 'delete';
		}
		this.debouncedSaveSettings();
		this.scheduleAutoPush();
	}

	handleModify(file: TAbstractFile) {
		const operation = this.settings.operations[file.path];
		if (operation === 'create' || operation === 'modify') {
			this.scheduleAutoPush();
			return;
		}
		this.settings.operations[file.path] = 'modify';
		this.debouncedSaveSettings();
		this.scheduleAutoPush();
	}

	handleRename(file: TAbstractFile, oldPath: string) {
		this.handleDelete({ ...file, path: oldPath });
		this.handleCreate(file);
		this.debouncedSaveSettings();
	}

	createFolder(path: string) {
		return vaultCreateFolder(this, path);
	}

	createFile(
		path: string,
		content: ArrayBuffer,
		modificationDate?: number | string | Date,
	) {
		return vaultCreateFile(this, path, content, modificationDate);
	}

	modifyFile(
		file: TFile,
		content: ArrayBuffer,
		modificationDate?: number | string | Date,
	) {
		return vaultModifyFile(this, file, content, modificationDate);
	}

	upsertFile(
		file: string,
		content: ArrayBuffer,
		modificationDate?: number | string | Date,
	) {
		return vaultUpsertFile(this, file, content, modificationDate);
	}

	deleteFile(file: TAbstractFile) {
		return vaultDeleteFile(this, file);
	}

	startSync() {
		return startSync(this);
	}

	endSync(syncNotice?: Notice, retainConfigChanges?: boolean) {
		return endSync(this, syncNotice, retainConfigChanges);
	}

	abortSync(syncNotice?: Notice) {
		return abortSync(this, syncNotice);
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: ObsidianGoogleDrive;

	constructor(app: App, plugin: ObsidianGoogleDrive) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const settings: SettingDefinitionItem[] = [];

		if (Platform.isDesktop) {
			settings.push({
				name: 'Setup Guide',
				render: (setting) => {
					setting.settingEl.empty();

					const container = setting.settingEl.createDiv({
						cls: 'ogd-setup-guide',
					});

					const details = container.createEl('details');
					const summary = details.createEl('summary');
					summary.createEl('span', { text: 'Setup Guide' });

					const content = details.createDiv({
						cls: 'ogd-setup-content',
					});

					const steps = [
						{
							title: '1. Google Cloud Console',
							items: [
								'Create a new project or select existing',
								'Enable Google Drive API',
							],
						},
						{
							title: '2. OAuth Consent Screen',
							items: [
								'Select "External" user type',
								'Add your email as test user',
							],
						},
						{
							title: '3. Create Credentials',
							items: [
								'Create OAuth client ID → "Desktop app"',
								'Copy Client ID and Client Secret',
							],
						},
					];

					steps.forEach((step) => {
						const stepEl = content.createDiv({
							cls: 'ogd-setup-step',
						});
						stepEl.createEl('h4', { text: step.title });
						const listEl = stepEl.createEl('ul');
						step.items.forEach((item) => {
							listEl.createEl('li', { text: item });
						});
					});

					const warningEl = content.createDiv({
						cls: 'ogd-setup-warning',
					});
					[
						'OAuth type must be "Desktop app"',
						'Add your email as test user',
						'Backup vault before first sync',
					].forEach((note) => {
						warningEl.createEl('p', { text: `⚠️ ${note}` });
					});
				},
			});
		}

		settings.push(
			{
				name: 'Client ID',
				desc: 'OAuth client ID from Google Cloud Console.',
				control: {
					type: 'text',
					key: 'clientId',
					placeholder: 'Client ID',
					validate: (value: string) => {
						if (!value) return 'Client ID cannot be empty.';
						return;
					},
				},
			},
			{
				name: 'Client secret',
				desc: 'OAuth client secret from Google Cloud Console.',
				control: {
					type: 'text',
					key: 'clientSecret',
					placeholder: 'Client secret',
					validate: (value: string) => {
						if (!value)
							return 'Client secret cannot be empty.';
						return;
					},
				},
			},
		);

		if (Platform.isDesktop) {
			settings.push({
				name: 'Login',
				render: (setting) => {
					setting.settingEl.empty();

					setting.nameEl.createEl('span', { text: 'Login' });

					new Setting(setting.settingEl)
						.addButton((btn) =>
							btn
								.setButtonText('Login with Google')
								.setCta()
								.onClick(async () => {
									if (!this.plugin.settings.clientId) {
										new Notice('Please enter Client ID first.');
										return;
									}
									if (!this.plugin.settings.clientSecret) {
										new Notice('Please enter Client Secret first.');
										return;
									}

									try {
										btn.setButtonText('Authorizing...').setDisabled(true);
										const code = await startOAuthFlow(this.plugin.settings.clientId);
										const tokens = await exchangeCodeForTokens(
											this.plugin.settings.clientId,
											this.plugin.settings.clientSecret,
											code,
										);

										if (tokens?.refresh_token) {
											this.plugin.settings.refreshToken = tokens.refresh_token;
											await this.plugin.saveSettings();
											new Notice('Login successful! Refresh token saved.');

											const changesToken =
												await this.plugin.drive.getChangesStartToken();
											if (changesToken) {
												this.plugin.settings.changesToken = changesToken;
												await this.plugin.saveSettings();
											}

											this.display();
										} else {
											new Notice('Failed to get refresh token. Please try again.');
										}
									} catch (error) {
										console.error('OAuth flow error:', error);
										new Notice('OAuth failed. Please try again.');
									} finally {
										btn.setButtonText('Login with Google').setDisabled(false);
									}
								}),
						);
				},
			});
		}

		if (!Platform.isDesktop) {
			settings.push({
				name: 'Setup',
				render: (setting) => {
					setting.settingEl.empty();

					setting.nameEl.createEl('span', { text: 'Setup' });
					setting.descEl.createEl('span', {
						text: 'Login requires Desktop Obsidian. Setup on Desktop → copy refresh_token → paste below.',
					});
				},
			});
		}

		settings.push(
			{
				name: 'Refresh token',
				desc: 'Auto-filled after login. You can also paste a refresh token manually.',
				control: {
					type: 'text',
					key: 'refreshToken',
					placeholder: 'Refresh Token',
					validate: async (value: string) => {
						if (!value) {
							return 'Refresh token cannot be empty';
						}

						if (!this.plugin.settings.clientId) {
							return 'Client ID is required first.';
						}
						if (!this.plugin.settings.clientSecret) {
							return 'Client secret is required first.';
						}

						if (value === this.plugin.settings.refreshToken) {
							return;
						}

						if (!(await refreshAccessToken(this.plugin, value))) {
							return 'Failed to refresh access token.';
						}

						const changesToken =
							await this.plugin.drive.getChangesStartToken();
						if (!changesToken) {
							return 'An error occurred fetching Google Drive changes token.';
						}
						this.plugin.settings.changesToken = changesToken;

						await this.plugin.saveSettings();
						new Notice('Refresh token saved! Beginning to sync.');
						window.setTimeout(
							() =>
								void this.plugin
									.onload()
									.then(
										() =>
											new Notice(
												'Sync complete! Please close settings and restart Obsidian to see the changes properly sync.',
												0,
											),
									),
							1_000,
						);
						return;
					},
				},
			},
			{
				name: 'Automatically push changes',
				desc: 'Push one minute after the most recent local file change.',
				control: {
					type: 'toggle',
					key: 'autoPush',
					defaultValue: false,
				},
			},
		);

		return settings;
	}

	async setControlValue(key: string, value: unknown) {
		await super.setControlValue(key, value);
		if (key === 'autoPush') {
			if (value) this.plugin.resumeAutoPushIfNeeded();
			else this.plugin.clearAutoPushTimer();
		}
	}
}
