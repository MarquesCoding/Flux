import { motion, useReducedMotion } from 'motion/react';
import { revealVariants, revealTransition, staggerVariants } from '@ValenceUI/animations/reveal';
import { DownloadList } from '@ValenceScreens/components/AccountArea/components/DownloadList/DownloadList';

/**
 * Everything this viewer has asked the server to prepare, and what became of each.
 *
 * A page of its own rather than a panel inside an account, because a download is not a setting. It
 * is a thing with a life of its own — asked for, worked on for several minutes, finished, fetched,
 * and eventually let go — and somebody looking in on one is checking on work rather than adjusting
 * a preference.
 *
 * It exists only where files can be kept. See `canKeepFiles`.
 */
const DownloadsPage = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={staggerVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 pb-10 pt-6 sm:px-8"
    >
      <motion.header
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion, 'heavy')}
        className="flex flex-col gap-1.5"
      >
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text sm:text-3xl">
          Downloads
        </h1>

        <p className="font-body text-sm text-text-muted">
          Files prepared to keep. Once one is on this device it is yours until you delete it.
        </p>
      </motion.header>

      <motion.section
        variants={revealVariants(prefersReducedMotion)}
        transition={revealTransition(prefersReducedMotion)}
        className="-mx-5 sm:-mx-8"
      >
        <DownloadList />
      </motion.section>
    </motion.div>
  );
};

DownloadsPage.displayName = 'DownloadsPage';

export { DownloadsPage };
