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
