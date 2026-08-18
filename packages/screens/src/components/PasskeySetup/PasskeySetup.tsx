import { Icon } from '@FluxUI/Icon';
import { Delete02Icon, Key01Icon, PencilEdit01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@FluxUI/Button';
import { Spinner } from '@FluxUI/Spinner';
import { TextField } from '@FluxUI/TextField';
import { describePasskeyUnavailability } from '@FluxScreens/passkeys/isPasskeySupported';
import {
  deletePasskey,
  listPasskeys,
  registerPasskey,
  renamePasskey,
} from '@FluxClient/session/auth';
import type { Passkey } from '@FluxContracts/schemas/Passkey';
import type { PasskeySetupProps } from './PasskeySetup.types';

const DEFAULT_NAME = 'This device';

/**
 * Lets somebody enrol a passkey on this device and remove ones they no longer have, so they can sign
 * in with a fingerprint or a security key instead of a password. Lists what is already enrolled with
 * when each was last used, since a passkey nobody recognises is one worth removing.
 *
 * @param onChanged - Called after a passkey is added or removed, so the account page can refresh.
 */
const PasskeySetup = ({ onChanged }: PasskeySetupProps) => {
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState(DEFAULT_NAME);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const unavailable = describePasskeyUnavailability();

  const refresh = useCallback(async () => {
    try {
      setPasskeys(await listPasskeys());
    } catch {
      setMessage('Could not load your passkeys.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    setMessage(null);
    setIsAdding(true);

    try {
      const outcome = await registerPasskey(name.trim() === '' ? DEFAULT_NAME : name.trim());

      if (outcome.kind === 'failed') {
        setMessage(outcome.reason);

        return;
      }

      if (outcome.kind === 'cancelled') {
        return;
      }

      setName(DEFAULT_NAME);
      await refresh();
      onChanged?.();
    } finally {
      setIsAdding(false);
    }
  };

  const rename = async (passkey: Passkey) => {
    setMessage(null);

    const next = renameValue.trim();

    if (next === '') {
      setMessage('Give the passkey a name.');

      return;
    }

    if (!(await renamePasskey(passkey.id, next))) {
      setMessage('That passkey could not be renamed.');

      return;
    }

    setRenamingId(null);
    await refresh();
    onChanged?.();
  };

  const remove = async (passkey: Passkey) => {
    setMessage(null);

    if (!(await deletePasskey(passkey.id))) {
      setMessage('That passkey could not be removed.');

      return;
    }

    await refresh();
    onChanged?.();
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-text">Passkeys</h2>
        <p className="text-sm text-text-muted">Sign in with your device instead of a password.</p>
      </header>

      {message === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}

      {isLoading ? (
        <Spinner label="Reading your passkeys" />
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-text-muted">No passkeys yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-raised px-3 py-2"
            >
              {renamingId === passkey.id ? (
                <form
                  noValidate
                  className="flex w-full items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void rename(passkey);
                  }}
                >
                  <TextField
                    label="Passkey name"
                    value={renameValue}
                    onValueChange={setRenameValue}
                    className="flex-1"
                  />

                  <Button type="submit" size="sm">
                    <Icon of={Tick02Icon} size={16} />
                    Save
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRenamingId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex items-center gap-2 text-sm text-text">
                    <Icon of={Key01Icon} size={16} />
                    {passkey.name ?? 'Unnamed passkey'}
                  </span>

                  <span className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRenamingId(passkey.id);
                        setRenameValue(passkey.name ?? '');
                      }}
                    >
                      <Icon of={PencilEdit01Icon} size={16} />
                      Rename
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void remove(passkey);
                      }}
                    >
                      <Icon of={Delete02Icon} size={16} />
                      Remove
                    </Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {unavailable === null ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <TextField
            label="Passkey name"
            value={name}
            onValueChange={setName}
            description="Something you will recognise later, such as the device you are on."
          />

          <Button type="submit" isLoading={isAdding}>
            Add a passkey
          </Button>
        </form>
      ) : (
        <p className="text-sm text-text-muted">{unavailable}</p>
      )}
    </section>
  );
};

PasskeySetup.displayName = 'PasskeySetup';

export { PasskeySetup };
