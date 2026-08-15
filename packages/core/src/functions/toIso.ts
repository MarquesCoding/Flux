const toIso = (value: Date | null): string | null => value?.toISOString() ?? null;

export { toIso };
