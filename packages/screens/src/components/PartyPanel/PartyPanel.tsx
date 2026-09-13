import { Icon } from '@ValenceUI/Icon';
import { Clock01Icon, PauseCircleIcon, UserAdd01Icon, ViewIcon } from '@hugeicons/core-free-icons';
import { useState } from 'react';
import { Badge } from '@ValenceUI/Badge';
import { Button } from '@ValenceUI/Button';
import { Switch } from '@ValenceUI/Switch';
import { TextField } from '@ValenceUI/TextField';
import { whereTheRoomIs } from '@ValenceCore/functions/whereTheRoomIs';
import type { PartyMember } from '@ValenceContracts/schemas/WatchParty';
import type { PartyPanelProps } from './PartyPanel.types';

const ROLE_LABELS = { host: 'Host', coHost: 'Co-host', guest: 'Guest' } as const;

const WORTH_SAYING_SECONDS = 1;

/**
 * How far behind the party's reference somebody is, said in a way worth reading.
 *
 * Both positions are carried forward to the same instant before they are compared, because they were
 * measured at different moments — comparing them as they stand would report the gap between two
 * readings taken a second apart as though it were drift between two players.
 *
 * @param member - The member being described.
 * @param reference - Whoever is keeping time.
 * @returns A short phrase, or null where they are close enough for it not to be worth saying.
 */
const describeDrift = (member: PartyMember, reference: PartyMember): string | null => {
  const atMs = Math.max(member.reportedAtMs, reference.reportedAtMs);
  const behind = whereTheRoomIs(reference, atMs) - whereTheRoomIs(member, atMs);

  return Math.abs(behind) < WORTH_SAYING_SECONDS
    ? null
    : `${Math.abs(behind).toFixed(1)}s ${behind > 0 ? 'behind' : 'ahead'}`;
};

/**
 * Who is in the party, what they are doing, and — for whoever is running it — the controls for
 * tightening it.
 *
 * Says who is actually watching rather than only who has joined, because those are different things:
 * somebody can be in the party with the film paused, or still buffering, and a list that showed them
 * identically would answer the wrong question.
 *
 * The controls are shown only to whoever may use them, but that is presentation — the server refuses
 * the message regardless, which is the part that matters.
 *
 * @param party - The party as the server last described it.
 * @param meConnectionId - Which member this tab is, so it can be marked.
 * @param waitingFor - Whoever the room is waiting for before it can play.
 * @param onSetRole - Called to change somebody's role.
 * @param onLoosen - Called to change what everybody may do.
 * @param onLeave - Called to leave.
 * @param onRemove - Called to put somebody out of the party.
 * @param onSetPassword - Called to put a password on the party, or to take it off.
 * @param people - Everybody with an account here, to be asked along.
 * @param onAsk - Called to ask one of them, which reaches them wherever they asked to be told things.
 * @param invitation - The address that puts somebody else in this party, where there is one to give.
 * @param onCopyInvitation - Called to put that address on the clipboard.
 * @returns The panel.
 */
const PartyPanel = ({
  party,
  meConnectionId,
  waitingFor = [],
  onSetRole,
  onLoosen,
  onLeave,
  onRemove,
  onSetPassword,
  people = [],
  onAsk,
  invitation,
  onCopyInvitation,
}: PartyPanelProps) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [password, setPassword] = useState('');
  const [asked, setAsked] = useState<readonly string[]>([]);
  const me = party.members.find((member) => member.connectionId === meConnectionId);
  const timekeeper = party.members.find((member) => member.connectionId === party.timekeeperId);
  const watching = party.members.filter((member) => member.isWatching).length;
  const mayAsk = me?.role === 'host' || me?.role === 'coHost';

  const elsewhere = people.filter(
    (person) =>
      !party.members.some(
        (member) => member.profileId === person.id || member.accountId === person.accountId,
      ),
  );

  return (
    <section className="flex w-80 max-w-full flex-col text-text">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <p className="text-xs uppercase tracking-wide text-text-muted">
          {watching.toString()} watching
        </p>

        {onLeave === undefined ? null : (
          <Button variant="ghost" size="sm" onClick={onLeave}>
            Leave
          </Button>
        )}
      </div>

      {!party.isHeld || waitingFor.length === 0 ? null : (
        <p className="flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
          <Icon of={Clock01Icon} size={14} />
          {waitingFor.length === 1
            ? `Waiting for ${waitingFor[0] ?? ''} to catch up`
            : `Waiting for ${waitingFor.length.toString()} people to catch up`}
        </p>
      )}

      {invitation === undefined ? null : (
        <div className="flex flex-col gap-2 rounded-lg bg-subtle p-3">
          <p className="text-xs leading-relaxed text-text-muted">
            Send this to anybody with an account here. It puts them in this party, watching this.
          </p>

          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-shade/30 px-3 py-2 font-mono text-xs">
              {invitation}
            </code>

            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => {
                void onCopyInvitation?.(invitation).then(() => {
                  setHasCopied(true);
                });
              }}
            >
              {hasCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {!mayAsk || onAsk === undefined || elsewhere.length === 0 ? null : (
        <div className="mt-2 flex flex-col gap-2 rounded-lg bg-subtle p-3">
          <p className="text-xs leading-relaxed text-text-muted">
            Ask somebody along. They are told wherever they asked to be told things, and the message
            carries this same link.
          </p>

          <ul className="flex flex-col gap-1">
            {elsewhere.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">{person.name}</span>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={asked.includes(person.id)}
                  label={`Ask ${person.name} along`}
                  onClick={() => {
                    setAsked((already) => [...already, person.id]);
                    onAsk(person.id);
                  }}
                >
                  <Icon of={UserAdd01Icon} size={14} />
                  {asked.includes(person.id) ? 'Asked' : 'Ask'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-divider">
        {party.members.map((member) => {
          const drift = timekeeper === undefined ? null : describeDrift(member, timekeeper);

          return (
            <li key={member.connectionId} className="flex flex-wrap items-center gap-2 px-1 py-3">
              <span className="text-sm font-medium">
                {member.name}
                {member.connectionId === meConnectionId ? ' (you)' : ''}
              </span>

              <Badge size="sm" tone={member.role === 'guest' ? 'quiet' : 'accent'}>
                {ROLE_LABELS[member.role]}
              </Badge>

              {member.connectionId === party.timekeeperId && (
                <Badge size="sm" tone="quiet">
                  <Icon of={Clock01Icon} size={12} />
                  Keeping time
                </Badge>
              )}

              {member.isWatching ? (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Icon of={ViewIcon} size={13} />
                  Watching
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <Icon of={PauseCircleIcon} size={13} />
                  Not watching
                </span>
              )}

              {drift !== null && <span className="text-xs text-text-muted">{drift}</span>}

              {me?.role === 'host' && member.connectionId !== meConnectionId && (
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onSetRole?.(
                        member.connectionId,
                        member.role === 'coHost' ? 'guest' : 'coHost',
                      );
                    }}
                  >
                    {member.role === 'coHost' ? 'Make a guest' : 'Make a co-host'}
                  </Button>

                  {onRemove === undefined ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      label={`Remove ${member.name} from the party`}
                      onClick={() => {
                        onRemove(member.connectionId);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {me?.role === 'host' && (
        <div className="flex flex-col gap-3 border-t border-line px-1 pt-3">
          <Switch
            label="Everyone can play and pause"
            isOn={party.everyoneMayPlayPause}
            onToggle={() => {
              onLoosen?.({ everyoneMayPlayPause: !party.everyoneMayPlayPause });
            }}
          />

          <Switch
            label="Everyone can skip around"
            isOn={party.everyoneMaySeek}
            onToggle={() => {
              onLoosen?.({ everyoneMaySeek: !party.everyoneMaySeek });
            }}
          />

          <p className="text-xs leading-relaxed text-text-muted">
            Skipping is the disruptive one — a stray scrub throws everybody across the film, which
            is why it can be withheld while pausing stays shared.
          </p>

          {onSetPassword === undefined ? null : (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs leading-relaxed text-text-muted">
                {party.hasPassword
                  ? 'This party has a password. Anybody opening the link is asked for it.'
                  : 'A password asks anybody opening the link for it, for a link that may travel further than you meant.'}
              </p>

              <div className="flex items-end gap-2">
                <TextField
                  label="Party password"
                  type="password"
                  size="sm"
                  value={password}
                  placeholder={party.hasPassword ? 'Set a new one' : 'No password'}
                  autoComplete="off"
                  className="min-w-0 flex-1"
                  onValueChange={setPassword}
                />

                <Button
                  variant="secondary"
                  size="sm"
                  disabled={password.length === 0}
                  onClick={() => {
                    onSetPassword(password);
                    setPassword('');
                  }}
                >
                  Set
                </Button>

                {party.hasPassword && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onSetPassword(null);
                      setPassword('');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

PartyPanel.displayName = 'PartyPanel';

export { PartyPanel };
