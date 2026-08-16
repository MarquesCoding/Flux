import type { ScanResult } from '@FluxContracts/schemas/Library';

/**
 * Says what a scan changed in the few words a table cell has room for. "Scanned an hour ago" and
 * "scanned an hour ago, removed two hundred items" answer the same question, and only the second
 * tells an operator their mount was missing.
 *
 * @param result What the last scan counted.
 */
const describeScanResult = (result: ScanResult): string => {
  const { added, updated, removed, failed } = result;

  if (added === 0 && updated === 0 && removed === 0 && failed === 0) {
    return 'Nothing changed';
  }

  const counts = [
    `+${added.toString()}`,
    `~${updated.toString()}`,
    `−${removed.toString()}`,
    ...(failed === 0 ? [] : [`${failed.toString()} unreadable`]),
  ];

  return counts.join(' ');
};

export { describeScanResult };
