import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { cn } from '@FluxUI/cn';
import type { QrCodeProps } from './QrCode.types';

const DEFAULT_SIZE = 192;

/**
 * Renders a value as a scannable QR code.
 *
 * Produced as a data URL and shown in an `<img>` rather than drawn to a canvas
 * or inlined as SVG: it keeps the codebase free of raw SVG (code standards
 * section 10), and an image carries an accessible name where a canvas does not.
 *
 * A QR code is never the only way to read the value. Callers must also present
 * it as text, because a code that can only be scanned is unusable to anyone
 * setting up on the same device they are reading from.
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
