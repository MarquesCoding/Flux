const describeCpuShare = (share: number | null): string => {
  if (share === null) {
    return 'not measured';
  }

  if (share <= 0) {
    return '0%';
  }

  return share < 1 ? '<1%' : `${share.toFixed(0)}%`;
};

export { describeCpuShare };
