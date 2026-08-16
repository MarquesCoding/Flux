const addedAtMs = (addedAt: string): number => {
  const parsed = Date.parse(addedAt);

  return Number.isNaN(parsed) ? 0 : parsed;
};

export { addedAtMs };
