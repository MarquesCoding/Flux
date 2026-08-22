import { detectClientLabel } from '@ValenceClient/playback/detectClientLabel';

/**
 * What to call this client, asked of the browser.
 *
 * Reading a user agent is the same wherever it is read, so that part belongs to the application; a
 * user agent to read is a thing only a browser has, so getting hold of one belongs here.
 *
 * @returns The device as a person would describe it.
 */
const describeThisBrowser = (): string => detectClientLabel(navigator.userAgent);

export { describeThisBrowser };
