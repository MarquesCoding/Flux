import { Icon } from '@FluxUI/Icon';
import { Alert02Icon, Copy01Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { TextField } from '@FluxUI/TextField';
import { Switch } from '@FluxUI/Switch';
import { Badge } from '@FluxUI/Badge';
import { Spinner } from '@FluxUI/Spinner';
import {
  fetchApiKeys,
  createApiKey,
  setApiKeyEnabled,
  revokeApiKey,
} from '@FluxWeb/account/fetchApiKeys';
import type { ApiKey } from '@FluxContracts/schemas/ApiKey';
import type { ApiKeyPanelProps } from './ApiKeyPanel.types';

/**
 * Says when a key was last used in words rather than as a timestamp, and says plainly when it never
 * has been — which is the thing worth noticing in a list of keys.
 *
 * @param at - When it was last used, or nothing where it never has been.
 * @returns The phrase to show.
 */
const lastUsed = (at: string | null): string => {
  if (at === null) {
    return 'Never used';
  }

  const days = Math.floor((Date.now() - Date.parse(at)) / 86_400_000);

  if (days < 1) {
    return 'Used today';
  }

  return days === 1 ? 'Used yesterday' : `Used ${days.toString()} days ago`;
};

/**
 * The API keys on this account: what each may do, when it was last used, and the making of new ones.
 * A new key is shown once and never again, since the server keeps only a hash of it.
 *
 * @param onChanged - Told when a key was made, disabled or removed.
 */
const ApiKeyPanel = ({ showKeyForMilliseconds }: ApiKeyPanelProps) => {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [isReading, setIsReading] = useState(true);
  const [name, setName] = useState('');
  const [isMaking, setIsMaking] = useState(false);
  const [made, setMade] = useState<{ name: string; key: string } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const read = useCallback(async () => {
    setKeys(await fetchApiKeys());
    setIsReading(false);
  }, []);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    if (made === null || showKeyForMilliseconds === undefined) {
      return;
    }

    const timer = setTimeout(() => {
      setMade(null);
    }, showKeyForMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [made, showKeyForMilliseconds]);

  if (isReading) {
    return (
      <div className="p-4">
        <Spinner label="Reading your keys" size="sm" />
      </div>
    );
  }

  if (keys === null) {
    return (
      <p className="p-4 text-sm text-text-muted">
        This account is not allowed to hold API keys. Whoever runs this server can change that.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="max-w-prose text-sm text-text-muted">
        A key lets something that is not a browser act as you — a script, a dashboard, an assistant.
        It can do whatever you can do, and never more.
      </p>

      {made === null ? null : (
        <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <span className="flex items-center gap-2 text-sm font-medium text-text">
            <Icon of={Alert02Icon} size={16} />
            Copy {made.name} now — it will not be shown again.
          </span>

          <span className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface px-3 py-2 font-mono text-xs text-text">
              {made.key}
            </code>

            <Button
              size="sm"
              isPill
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(made.key).then(() => {
                  setHasCopied(true);
                });
              }}
            >
              <Icon of={Copy01Icon} size={15} />
              {hasCopied ? 'Copied' : 'Copy'}
            </Button>
          </span>
        </div>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (name.trim() === '' || isMaking) {
            return;
          }

          setIsMaking(true);
          setHasCopied(false);

          void createApiKey({
            name: name.trim(),
            expiresInDays: null,
            permissions: null,
            rateLimit: null,
          })
            .then(async (key) => {
              if (key !== null) {
                setMade({ name: key.name, key: key.key });
                setName('');
              }

              await read();
            })
            .finally(() => {
              setIsMaking(false);
            });
        }}
      >
        <TextField
          label="What is this key for?"
          value={name}
          placeholder="Home Assistant"
          onValueChange={setName}
          className="min-w-56 flex-1"
        />

        <Button type="submit" variant="glossy" size="md" isPill isLoading={isMaking}>
          Create key
        </Button>
      </form>

      {keys.length === 0 ? (
        <p className="text-sm text-text-muted">No keys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--surface-line)] p-3"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-text">{key.name}</span>

                <span className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <code className="font-mono">{key.start ?? '—'}…</code>
                  <span aria-hidden>·</span>
                  {lastUsed(key.lastRequestAt)}
                  {key.rateLimit === null ? null : (
                    <Badge size="sm">
                      {key.rateLimit.max.toString()} per {key.rateLimit.everySeconds.toString()}s
                    </Badge>
                  )}
                  {key.permissions === null ? null : (
                    <Badge size="sm">
                      {key.permissions.length === 0
                        ? 'No permissions'
                        : `${key.permissions.length.toString()} permissions`}
                    </Badge>
                  )}
                </span>
              </span>

              <Switch
                label={key.enabled ? `Turn ${key.name} off` : `Turn ${key.name} on`}
                isOn={key.enabled}
                onToggle={() => {
                  void setApiKeyEnabled(key.id, !key.enabled).then(read);
                }}
              />

              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                label={`Revoke ${key.name}`}
                onClick={() => {
                  void revokeApiKey(key.id).then(read);
                }}
              >
                <Icon of={Delete02Icon} size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

ApiKeyPanel.displayName = 'ApiKeyPanel';

export { ApiKeyPanel };
