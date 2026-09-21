export interface FileMetadata {
	id: string;
	name: string;
	description: string;
	mimeType: string;
	starred: boolean;
	properties: Record<string, string>;
	modifiedTime: string;
	trashed: boolean;
}

export type StringSearch = string | { contains: string } | { not: string };
export type DateComparison = { eq: string } | { gt: string } | { lt: string };

export interface QueryMatch {
	name?: StringSearch | StringSearch[];
	mimeType?: StringSearch | StringSearch[];
	parent?: string;
	starred?: boolean;
	query?: string;
	properties?: Record<string, string>;
	modifiedTime?: DateComparison;
}

export interface Change {
	kind: string;
	removed: boolean;
	file: FileMetadata;
	fileId: string;
	time: string;
}

export type Operation = 'create' | 'delete' | 'modify';

export const folderMimeType =
	'application/vnd.google-apps.folder';

export class DriveError extends Error {
	declare cause: unknown;

	constructor(
		message: string,
		public readonly operation: string,
		public readonly details?: {
			path?: string;
			driveId?: string;
			httpStatus?: number;
			cause?: unknown;
		},
	) {
		super(message);
		this.name = 'DriveError';
		if (details?.cause) this.cause = details.cause;
	}

	get userMessage(): string {
		const parts = [this.message];
		if (this.details?.path) parts.push(`File: ${this.details.path}`);
		if (this.details?.httpStatus)
			parts.push(`HTTP ${this.details.httpStatus}`);
		return parts.join(' — ');
	}
}
