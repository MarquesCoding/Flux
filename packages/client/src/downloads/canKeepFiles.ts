import { platformInUse } from '@ValenceClient/platform/installPlatform';

/**
 * Whether this client can be trusted with a file somebody means to keep.
 *
 * A capability rather than a name, because the question is not which client this is — it is whether
 * a four gigabyte film would survive here, and the answer happens to divide along client lines.
 *
 * A browser cannot. Its storage is a quota rather than a disk, the figure it reports is rounded and
 * opaque, eviction is at the browser's discretion and needs no warning, and there is no way to
 * finish a transfer that started before the tab was closed. Offering a download there would be
 * offering something that might be gone the next morning, which is precisely the morning somebody
 * planned to watch it on a plane.
 *
 * @returns Whether to offer downloads at all.
 */
const canKeepFiles = (): boolean => platformInUse().canKeepFiles();

export { canKeepFiles };
