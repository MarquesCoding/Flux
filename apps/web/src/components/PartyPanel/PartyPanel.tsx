import { useState } from 'react';
import { RiEyeLine, RiPauseCircleLine, RiTimeLine } from '@remixicon/react';
import { Badge } from '@FluxUI/Badge';
import { Button } from '@FluxUI/Button';
import { Card } from '@FluxUI/Card';
import { CardHeader } from '@FluxUI/CardHeader';
import { Switch } from '@FluxUI/Switch';
import type { PartyMember } from '@FluxContracts/schemas/WatchParty';
import type { PartyPanelProps } from './PartyPanel.types';

const ROLE_LABELS = { host: 'Host', coHost: 'Co-host', guest: 'Guest' } as const;

/**
 * How far behind the party's reference somebody is, said in a way worth reading.
 *
 * @param member - The member being described.
 * @param reference - Where the party's timekeeper is.
 * @returns A short phrase, or null where they are close enough for it not to be worth saying.
 */
const describeDrift = (member: PartyMember, reference: number): string | null => {
  const behind = reference - member.positionSeconds;

  return Math.abs(behind) < 1
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
 * @param onSetRole - Called to change somebody's role.
 * @param onLoosen - Called to change what everybody may do.
 * @param onLeave - Called to leave.
 * @param invitation - The address that puts somebody else in this party, where there is one to give.
 * @param onCopyInvitation - Called to put that address on the clipboard.
 * @returns The panel.
 */
const PartyPanel = ({
  party,
  meConnectionId,
  onSetRole,
  onLoosen,
  onLeave,
  invitation,
  onCopyInvitation,
}: PartyPanelProps) => {
  const [hasCopied, setHasCopied] = useState(false);
  const me = party.members.find((member) => member.connectionId === meConnectionId);
  const timekeeper = party.members.find((member) => member.connectionId === party.timekeeperId);
  const reference = timekeeper?.positionSeconds ?? 0;
  const watching = party.members.filter((member) => member.isWatching).length;

  return (
    <Card as="section" padding="none" className="flex flex-col">
      <CardHeader title={`Watch party · ${watching.toString()} watching`}>
        {onLeave === undefined ? null : (
          <Button variant="ghost" size="sm" isPill onClick={onLeave}>
            Leave
          </Button>
        )}
      </CardHeader>

      {invitation === undefined ? null : (
        <div className="flex flex-col gap-2 border-b border-[var(--surface-line)] px-4 py-3">
          <p className="text-xs leading-relaxed text-text-muted">
            Send this to anybody with an account here. It puts them in this party, watching this.
          </p>

          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-[var(--surface-hover)] px-3 py-2 font-mono text-xs text-text">
              {invitation}
            </code>

            <Button
              variant="secondary"
              size="sm"
              isPill
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

      <ul className="flex flex-col divide-y divide-[var(--surface-line)]">
        {party.members.map((member) => {
          const drift = describeDrift(member, reference);

          return (
            <li key={member.connectionId} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <span className="text-sm font-medium text-text">
                {member.name}
                {member.connectionId === meConnectionId ? ' (you)' : ''}
              </span>

              <Badge size="sm" tone={member.role === 'guest' ? 'quiet' : 'accent'}>
                {ROLE_LABELS[member.role]}
              </Badge>

              {member.connectionId === party.timekeeperId && (
                <Badge size="sm" tone="quiet">
                  <RiTimeLine size={12} aria-hidden />
                  Keeping time
                </Badge>
              )}

              {member.isWatching ? (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <RiEyeLine size={13} aria-hidden />
                  Watching
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <RiPauseCircleLine size={13} aria-hidden />
                  Not watching
                </span>
              )}

              {drift !== null && <span className="text-xs text-text-muted">{drift}</span>}

              {me?.role === 'host' && member.connectionId !== meConnectionId && (
                <span className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    isPill
                    onClick={() => {
                      onSetRole?.(
                        member.connectionId,
                        member.role === 'coHost' ? 'guest' : 'coHost',
                      );
                    }}
                  >
                    {member.role === 'coHost' ? 'Make a guest' : 'Make a co-host'}
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {me?.role === 'host' && (
        <div className="flex flex-col gap-3 border-t border-[var(--surface-line)] px-4 py-3">
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
        </div>
      )}
    </Card>
  );
};

PartyPanel.displayName = 'PartyPanel';

export { PartyPanel };
