export interface OpenLink {
	start: number;
	query: string;
}

export interface LinkCandidate {
	path: string;
	basename: string;
}

export const LINK_SUGGESTION_LIMIT = 20;

export function openLinkAt(text: string, caret: number): OpenLink | undefined {
	const before = text.slice(0, caret);
	const start = before.lastIndexOf("[[");
	if (start === -1) return undefined;
	const query = before.slice(start + 2);
	if (/\]\]|\||\n/.test(query)) return undefined;
	return { start, query };
}

export function insertLink(text: string, caret: number, link: OpenLink, linktext: string): { text: string; caret: number } {
	const after = text.slice(caret);
	const rest = after.startsWith("]]") ? after.slice(2) : after;
	const inserted = `[[${linktext}]]`;
	return { text: text.slice(0, link.start) + inserted + rest, caret: link.start + inserted.length };
}

export function matchingLinkCandidates<Candidate extends LinkCandidate>(
	candidates: readonly Candidate[],
	query: string,
): Candidate[] {
	const typed = query.trim().toLowerCase();
	const rank = (candidate: Candidate): number => {
		const name = candidate.basename.toLowerCase();
		if (typed === "") return 2;
		if (name.startsWith(typed)) return 0;
		if (name.includes(typed)) return 1;
		return candidate.path.toLowerCase().includes(typed) ? 2 : -1;
	};
	return candidates
		.map((candidate) => ({ candidate, rank: rank(candidate) }))
		.filter(({ rank }) => rank >= 0)
		.sort((a, b) => a.rank - b.rank || a.candidate.basename.localeCompare(b.candidate.basename) || a.candidate.path.localeCompare(b.candidate.path))
		.slice(0, LINK_SUGGESTION_LIMIT)
		.map(({ candidate }) => candidate);
}
