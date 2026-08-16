import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { cn } from '@FluxUI/cn';
import type { QrCodeProps } from './QrCode.types';

const DEFAULT_SIZE = 192;

/**
 * Draws a value as a QR code, for handing something to a phone that would be miserable to type — a
 * sign-in address, a pairing code. Rendered here rather than fetched, so nothing about it leaves
 * the server.
 *
 * @param value - What the code should carry.
 * @param label - What scanning it does, for anybody who cannot see the code.
 * @param size - How large to draw it, in pixels.
 * @param className - Extra classes for the caller's own layout.
 */
const QrCode = ({ value, label, size = DEFAULT_SIZE, className }: QrCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (isCurrent) {
          setDataUrl(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setDataUrl(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [value, size]);

  if (dataUrl === null) {
    return (
      <div
        className={cn('rounded-md border border-border bg-surface-raised', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={label}
      width={size}
      height={size}
      className={cn('rounded-md border border-border bg-white p-2', className)}
    />
  );
};

QrCode.displayName = 'QrCode';

export { QrCode };
