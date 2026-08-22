const HIDDEN = '[redacted]';

const SECRET_NAMES =
  'api_key|apikey|access_token|refresh_token|id_token|token|secret|password|passwd|authorization|auth|signature|sig|client_secret|private_key|session';

const QUERY_SECRET = new RegExp(`([?&](?:${SECRET_NAMES})=)([^&\\s"']*)`, 'gi');

const ASSIGNED_SECRET = new RegExp(
  `\\b([A-Za-z0-9_]*(?:${SECRET_NAMES}))("?\\s*[:=]\\s*"?)(?!\\[redacted\\]|Bearer\\b|Basic\\b|Token\\b)([^\\s,;&}"']+)`,
  'gi',
);

const CREDENTIAL_SCHEME = /\b(Bearer|Basic|Token)\s+([A-Za-z0-9\-._~+/=]{8,})/gi;

const JWT = /\beyJ[A-Za-z0-9\-_]*\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g;

const SHARE_LINK = /(\/(?:api\/)?share\/)([A-Za-z0-9\-_]{8,})/g;

const COOKIE = /\b(valence_share|flux_share|better-auth\.session_token|session_token)=([^;\s]+)/gi;

const EMAIL = /\b[A-Za-z0-9._%+-]+(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * Removes from a line anything that would be a working credential, or a person, if the line left the
 * machine.
 *
 * Applied when a record is made rather than when one is shown, because a redaction at the point of
 * display is not a redaction — the record still exists, and a download or a database query hands it
 * over intact.
 *
 * What it deliberately leaves alone is file paths. Almost every scan problem quotes one, and they are
 * most of what makes a log worth reading; stripping them would gut the feature. They do disclose the
 * library layout and every title on the disk, which is a matter for the warning at the point of
 * export rather than for this.
 *
 * An email keeps its domain and loses the part that names somebody, since the domain helps explain a
 * delivery failure and does not identify who watched what.
 *
 * @param text - The line about to be written.
 * @returns The line with credentials and names removed.
 */
const redactSecrets = (text: string): string =>
  text
    .replace(EMAIL, `${HIDDEN}$1`)
    .replace(JWT, HIDDEN)
    .replace(CREDENTIAL_SCHEME, `$1 ${HIDDEN}`)
    .replace(COOKIE, `$1=${HIDDEN}`)
    .replace(QUERY_SECRET, `$1${HIDDEN}`)
    .replace(SHARE_LINK, `$1${HIDDEN}`)
    .replace(ASSIGNED_SECRET, `$1$2${HIDDEN}`);

export { redactSecrets, HIDDEN };
