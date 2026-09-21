import { TFolder } from 'obsidian';

export const batchAsync = async <T = unknown>(
	requests: (() => Promise<T>)[],
	batchSize = 10,
) => {
	const results = [];
	for (let i = 0; i < requests.length; i += batchSize) {
		const batch = requests.slice(i, i + batchSize);
		results.push(...(await Promise.all(batch.map((request) => request()))));
	}
	return results;
};

export const splitPath = (path: string) => {
	const encoder = new TextEncoder();
	let p = '';
	const output: Record<string, string> = {};
	let i = 1;
	for (const char of path) {
		if (encoder.encode(p + char).length > 100) {
			const key = i === 1 ? 'path' : `path${i}`;
			output[key] = p;
			p = '';
			i++;
		}
		p += char;
	}
	const key = i === 1 ? 'path' : `path${i}`;
	output[key] = p;
	return output;
};

export const unSplitPath = (properties: Record<string, string>) => {
	let path = properties.path || '';
	let i = 2;
	while (properties[`path${i}`]) {
		path += properties[`path${i}`];
		i++;
	}
	return path;
};

export const fileNameFromPath = (path: string) =>
	path.split('/').slice(-1)[0] as string;

/**
 * @returns Batches in increasing order of depth
 */
export const foldersToBatches = <T = string | TFolder>(folders: T[]) => {
	if (!folders.length) return [];

	const batches: (typeof folders)[] = new Array(
		Math.max(
			...folders.map(
				(folder) =>
					(
						(folder instanceof TFolder
							? folder.path
							: folder) as string
					).split('/').length,
			),
		),
	)
		.fill(0)
		.map(() => []);

	folders.forEach((folder) => {
		batches[
			(
				(folder instanceof TFolder ? folder.path : folder) as string
			).split('/').length - 1
		]?.push(folder);
	});

	return batches;
};
