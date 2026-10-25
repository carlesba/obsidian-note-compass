export type TabMove<T> = { kind: "focus"; stop: T } | { kind: "leaveBefore" } | { kind: "stay" } | { kind: "native" };

export function tabMove<T>(
	sequence: readonly T[],
	current: T | undefined,
	backwards: boolean,
	wraps: (outer: T, inner: T) => boolean,
): TabMove<T> {
	if (current !== undefined && !sequence.includes(current)) return { kind: "native" };
	const stops = sequence.filter((item, index) => {
		if (item === current) return true;
		const next = sequence[index + 1];
		return next === undefined || !wraps(item, next);
	});
	if (current === undefined) {
		const first = stops[0];
		if (backwards) return { kind: "native" };
		return first === undefined ? { kind: "native" } : { kind: "focus", stop: first };
	}
	const target = stops[stops.indexOf(current) + (backwards ? -1 : 1)];
	if (target !== undefined) return { kind: "focus", stop: target };
	return backwards ? { kind: "leaveBefore" } : { kind: "stay" };
}
