/**
 * Builds the address a title's logo is served from — the lettering as its designer set it.
 *
 * The query marks the logo as the full-size one. Logos were once fetched at a width too small for a
 * hero, and the browser was told to keep each one for a week without asking again; a new address is
 * the only way to have it ask again, rather than every viewer waiting out the week.
 *
 * @param mediaId - The item.
 * @returns The address to load.
 */
const titleLogoUrl = (mediaId: string): string => `/api/media/${mediaId}/image/logo?at=full`;

export { titleLogoUrl };
