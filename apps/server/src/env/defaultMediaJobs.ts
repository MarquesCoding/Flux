const AT_A_TIME = 1;

/**
 * How many files the library works on at once, where the operator has not said.
 *
 * One, and the number is not the interesting part — what changed is who decides. This was worked
 * out from the core count, which was wrong twice over: it gave a twenty core server ten renders
 * against one graphics chip and took the API down with them, and it was measuring processors for
 * work that turned out to wait on a disk.
 *
 * The media service is the one that knows. It holds a queue of its own over every render it is
 * asked for, and that queue is now the only limit that matters. Asking for more files than it will
 * draw does not make it draw faster; it only means more of them are waiting, somewhere else.
 *
 * MEDIA_JOBS still overrides this for an operator who knows their storage better than either of us.
 *
 * @returns How many files to work on at once.
 */
const defaultMediaJobs = (): number => AT_A_TIME;

export { defaultMediaJobs };
