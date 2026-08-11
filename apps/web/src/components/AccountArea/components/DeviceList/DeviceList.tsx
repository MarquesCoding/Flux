import { useCallback, useEffect, useState } from 'react'
import { IconDeviceTv, IconLogout } from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import BadgeModule from '@FluxUI/Badge'
import SpinnerModule from '@FluxUI/Spinner'
import fetchDevicesModule from '@FluxWeb/account/fetchDevices'
import type { Device } from '@FluxWeb/account/fetchDevices'

const { Button } = ButtonModule
const { Badge } = BadgeModule
const { Spinner } = SpinnerModule
const { fetchDevices, endDevice, endOtherDevices } = fetchDevicesModule

/**
 * Says when something happened, the way somebody would.
 */
const said = (when: string): string => {
  const at = new Date(when)

  return Number.isNaN(at.getTime())
    ? 'at some point'
    : at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Everywhere this account is signed in.
 *
 * A self-hosted server is shared with a household, and a household loses track
 * of what is signed in where: a television at a friend's, a phone that was
 * replaced, a browser on a machine at work. This is the answer and the way to
 * do something about it.
 *
 * The names are guesses read from what each browser said about itself. They
 * are labels rather than facts, which is enough for the job — telling one line
 * of a list from another.
 */
const DeviceList = () => {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const read = useCallback(() => {
    void fetchDevices().then(setDevices)
  }, [])

  useEffect(read, [read])

  const elsewhere = (devices ?? []).filter((device) => !device.isCurrent)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-text-muted">
          <IconDeviceTv size={14} aria-hidden />
          Where you are signed in
        </h2>

        {elsewhere.length === 0 ? null : (
          <Button
            variant="secondary"
            size="sm"
            isPill
            isLoading={isWorking}
            onClick={() => {
              setIsWorking(true)

              void endOtherDevices().then(() => {
                setIsWorking(false)
                read()
              })
            }}
          >
            <IconLogout size={16} aria-hidden />
            Sign out everywhere else
          </Button>
        )}
      </header>

      {devices === null ? (
        <Spinner label="Reading your devices" size="sm" />
      ) : devices.length === 0 ? (
        <p className="text-sm text-text-muted">
          Nothing is signed in, which cannot be true of the thing you are reading this on. Try again
          in a moment.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/10">
          {devices.map((device) => (
            <li key={device.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-text">{device.name}</span>

                  {/* Marked rather than hidden: somebody looking at their own
                      devices wants to know which one they are holding. */}
                  {!device.isCurrent ? null : <Badge size="sm">This one</Badge>}
                </span>

                <span className="text-xs text-text-muted">
                  Signed in {said(device.signedInAt)}
                  {device.address === null ? '' : ` · ${device.address}`}
                </span>
              </span>

              {/* The one being used has no button. Signing yourself out of the
                  page you are signing things out from is its own small
                  disaster, and there is already a sign-out below. */}
              {device.isCurrent ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  isPill
                  onClick={() => {
                    void endDevice(device.id).then(read)
                  }}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

DeviceList.displayName = 'DeviceList'

export default { DeviceList }
