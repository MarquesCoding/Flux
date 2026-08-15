const readPreviewState = async (url: string): Promise<'ready' | 'pending' | 'absent'> => {
  const response = await fetch(url, { headers: { Range: 'bytes=0-0' } }).catch(() => null);

  if (response === null) {
    return 'absent';
  }

  if (response.status === 202) {
    return 'pending';
  }

  return response.ok ? 'ready' : 'absent';
};

export { readPreviewState };
