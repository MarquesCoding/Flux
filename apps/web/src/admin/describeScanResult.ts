import type { ScanResult } from '@FluxContracts/schemas/Library';

/**
 * What a scan changed, in the few words a table cell has room for.
 *
 * A scan that changed nothing says so rather than reading `+0 −0`, because
 * three zeros beside a timestamp is a row somebody's eye slides off, and
 * "nothing changed" is the answer they were looking for.
 *
 * Removals are always stated, even at zero when something else happened. They
 * are the number this exists for: a scan that quietly removed two hundred
 * items because a mount was missing is the case that looks, from a timestamp
 * alone, exactly like a scan that found nothing to do.
 *
 * Unreadable files are named only when there are some. They mean something is
 * wrong with the media rather than with the library, which is a different
 * problem and not one worth a zero on every row.
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
