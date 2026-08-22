import { Icon } from '@ValenceUI/Icon';
import { CheckIcon, KeyIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@ValenceUI/Button';
import { SettingRow } from '@ValenceUI/SettingRow';
import { TextField } from '@ValenceUI/TextField';
import { describePasskeyUnavailability } from '@ValenceScreens/passkeys/isPasskeySupported';
import {
  deletePasskey,
  listPasskeys,
  registerPasskey,
  renamePasskey,
} from '@ValenceClient/session/auth';
import type { Passkey } from '@ValenceContracts/schemas/Passkey';
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
    <div className="flex flex-col">
      <SettingRow
        title="Passkeys"
        description={
          unavailable ??
          'Sign in with the face, fingerprint or PIN this device already uses, instead of a password.'
        }
      >
        <span className="text-sm text-text-muted">
          {isLoading
            ? 'Reading…'
            : passkeys.length === 0
              ? 'None yet'
              : `${passkeys.length.toString()} on this account`}
        </span>
      </SettingRow>

      <div className="flex flex-col gap-4 px-5 pb-5">
        {message === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {message}
          </p>
        )}

        {isLoading || passkeys.length === 0 ? null : (
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
                      <Icon of={CheckIcon} size={16} />
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
                      <Icon of={KeyIcon} size={16} />
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
                        <Icon of={PencilSimpleIcon} size={16} />
                        Rename
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void remove(passkey);
                        }}
                      >
                        <Icon of={TrashIcon} size={16} />
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
        ) : null}
      </div>
    </div>
  );
};

PasskeySetup.displayName = 'PasskeySetup';

export { PasskeySetup };
