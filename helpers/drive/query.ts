import type { DateComparison, QueryMatch, StringSearch } from './types';

export const escapeQueryValue = (value: string) =>
	value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const stringSearchToQuery = (search: StringSearch) => {
	if (typeof search === 'string') return `='${escapeQueryValue(search)}'`;
	if ('contains' in search) {
		return ` contains '${escapeQueryValue(search.contains)}'`;
	}
	if ('not' in search) return `!='${escapeQueryValue(search.not)}'`;
	return;
};

const queryHandlers = {
	name: (name: StringSearch) => 'name' + stringSearchToQuery(name),
	mimeType: (mimeType: StringSearch) =>
		'mimeType' + stringSearchToQuery(mimeType),
	parent: (parent: string) => `'${escapeQueryValue(parent)}' in parents`,
	starred: (starred: boolean) => `starred=${starred}`,
	query: (query: string) => `fullText contains '${escapeQueryValue(query)}'`,
	properties: (properties: Record<string, string>) =>
		Object.entries(properties)
			.map(
				([key, value]) =>
					`properties has { key='${escapeQueryValue(key)}' and value='${escapeQueryValue(value)}' }`,
			)
			.join(' and '),
	modifiedTime: (modifiedTime: DateComparison) => {
		if ('eq' in modifiedTime) return `modifiedTime='${modifiedTime.eq}'`;
		if ('gt' in modifiedTime) return `modifiedTime>'${modifiedTime.gt}'`;
		if ('lt' in modifiedTime) return `modifiedTime<'${modifiedTime.lt}'`;
		return;
	},
};

export const buildQuery = (
	matches: QueryMatch[],
	vaultName: string,
) =>
	encodeURIComponent(
		`(${matches
			.map((match) => {
				const entries = Object.entries(match).flatMap(
					([key, value]) =>
						value === undefined
							? []
							: Array.isArray(value)
								? value.map((v) => [key, v as string])
								: [[key, value]],
				);
				return `(${entries
					.map(([key, value]) =>
						queryHandlers[key as keyof QueryMatch](
							value as never,
						),
					)
					.join(' and ')})`;
			})
			.join(
				' or ',
			)}) and trashed=false and properties has { key='vault' and value='${escapeQueryValue(vaultName)}' }`,
	);
