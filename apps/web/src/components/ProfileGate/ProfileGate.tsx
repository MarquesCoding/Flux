import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconKey,
} from '@tabler/icons-react'
import ButtonModule from '@FluxUI/Button'
import IconButtonModule from '@FluxUI/IconButton'
import TextFieldModule from '@FluxUI/TextField'
import MoodBackgroundModule from '@FluxUI/MoodBackground'
import SpinnerModule from '@FluxUI/Spinner'
import revealModule from '@FluxUI/animations/reveal'
import ViewerProfileModule from '@FluxContracts/schemas/ViewerProfile'
import fetchEveryoneModule from '@FluxWeb/profiles/fetchEveryone'
import readVersionModule from '@FluxWeb/session/readVersion'
import isPasskeySupportedModule from '@FluxWeb/passkeys/isPasskeySupported'
import authenticateWithPasskeyModule from '@FluxWeb/passkeys/authenticateWithPasskey'
import type { ViewerProfile } from '@FluxContracts/schemas/ViewerProfile'
import type { ProfileGateProps } from './ProfileGate.types'

const { Button } = ButtonModule
const { IconButton } = IconButtonModule
const { TextField } = TextFieldModule
const { MoodBackground } = MoodBackgroundModule
const { Spinner } = SpinnerModule
const { revealVariants, revealTransition, staggerVariants, liquidSpring, stillTransition } =
  revealModule
const { profileInitial, profileAvatarUrl } = ViewerProfileModule
const { fetchEveryone, signInAsProfile } = fetchEveryoneModule
const { readVersion } = readVersionModule
const { isPasskeySupported } = isPasskeySupportedModule
const { authenticateWithPasskey } = authenticateWithPasskeyModule

/**
 * How many faces one page of the wall holds.
 *
 * Ten, which fills two even rows of five at the width the wall is held to. A
 * household fits on one page and never sees the controls; a server with thirty
 * accounts on it should not ask somebody to read all thirty to find
 * themselves.
 */
const PER_PAGE = 10

/**
 * The face somebody picked, drawn at whatever size the moment calls for.
 *
 * Shared between the wall and the password screen through a layout animation,
 * so choosing a face moves that face rather than replacing one screen with
 * another. It is the same person either side of the transition, and the
 * interface should say so.
 */
const Portrait = ({ profile, isLarge = false }: { profile: ViewerProfile; isLarge?: boolean }) => (
  <span
    style={{ backgroundColor: profile.avatar.kind === 'initial' ? profile.colour : undefined }}
    className={`flex items-center justify-center overflow-hidden rounded-3xl bg-white/5 font-semibold text-black/80 shadow-xl ${
      isLarge ? 'size-32 text-5xl sm:size-36' : 'aspect-square w-full text-4xl sm:text-5xl'
    }`}
  >
    {profile.avatar.kind === 'initial' ? (
      profileInitial(profile.name)
    ) : (
      <img src={profileAvatarUrl(profile.id)} alt="" className="h-full w-full object-cover" />
    )}
  </span>
)

Portrait.displayName = 'Portrait'

/**
 * The way in.
 *
 * A wall of faces rather than a form: on a shared machine the question is
 * which person is sitting there, and everybody already knows the answer by
 * looking. An address adds nothing to that — it is a thing people mistype,
 * and the only party who needs one is the server.
 *
 * Picking a face carries it to the middle of the screen and asks for a
 * password beneath it. Everything else fades away rather than being replaced,
 * so the two screens read as one screen paying attention to somebody.
 */
const ProfileGate = ({ onSignedIn, name = 'Flux' }: ProfileGateProps) => {
  const [everyone, setEveryone] = useState<ViewerProfile[] | null>(null)
  const [chosen, setChosen] = useState<ViewerProfile | null>(null)
  const [password, setPassword] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUsingPasskey, setIsUsingPasskey] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  // Whether the wall has been left and come back to. Its arrival animation is
  // for arriving; replaying it on the way back would fade the portrait in
  // rather than letting it travel home.
  const [hasLeftWall, setHasLeftWall] = useState(false)
  const [page, setPage] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  const move = prefersReducedMotion === true ? stillTransition : liquidSpring

  const pages = Math.max(1, Math.ceil((everyone?.length ?? 0) / PER_PAGE))
  const shown = (everyone ?? []).slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  useEffect(() => {
    void fetchEveryone().then(setEveryone)
    void readVersion().then(setVersion)
  }, [])

  const submit = async () => {
    if (chosen === null) {
      return
    }

    setIsSubmitting(true)
    setProblem(null)

    const outcome = await signInAsProfile(chosen.id, password)

    setIsSubmitting(false)

    if (outcome.kind === 'signedIn') {
      onSignedIn()

      return
    }

    setProblem(outcome.reason)
    setPassword('')
  }

  const signInWithPasskey = async () => {
    setIsUsingPasskey(true)
    setProblem(null)

    try {
      const outcome = await authenticateWithPasskey()

      if (outcome.kind === 'failed') {
        setProblem(outcome.reason)

        return
      }

      if (outcome.kind !== 'cancelled') {
        onSignedIn()
      }
    } finally {
      setIsUsingPasskey(false)
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center px-6 py-16">
      <MoodBackground color={chosen?.colour ?? null} hasGrid isDrifting />

      {everyone === null ? (
        <Spinner label="Reading who is here" size="lg" />
      ) : (
        <div className="flex w-full flex-col items-center">
          {chosen === null ? (
            <motion.div
              key="wall"
              variants={staggerVariants}
              initial={hasLeftWall ? false : 'hidden'}
              animate="shown"
              className="flex w-full flex-col items-center gap-12"
            >
              <motion.h1
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion, 'heavy')}
                className="text-[clamp(2rem,7vw,4rem)] font-semibold tracking-[-0.04em] text-text"
              >
                Who is watching?
              </motion.h1>

              <motion.div
                variants={revealVariants(prefersReducedMotion)}
                transition={revealTransition(prefersReducedMotion)}
                className="flex w-full items-center justify-center gap-2 sm:gap-6"
              >
                {/* The arrows keep their space when there is only one page, so
                    the faces do not shift sideways as somebody pages through
                    them. */}
                <span className={pages > 1 ? '' : 'invisible'}>
                  <IconButton
                    label="Previous"
                    disabled={page === 0}
                    onClick={() => {
                      setPage((current) => Math.max(current - 1, 0))
                    }}
                  >
                    <IconChevronLeft size={20} aria-hidden />
                  </IconButton>
                </span>

                {/* Held to a width rather than filling the screen: faces
                    spread across an ultrawide monitor stop being a group and
                    become a row of strangers. */}
                <ul className="flex min-h-[13rem] w-full max-w-4xl flex-wrap items-start justify-center gap-6 sm:min-h-[15rem] sm:gap-10">
                  {shown.map((profile) => (
                    <li key={profile.id}>
                      <motion.button
                        type="button"
                        layoutId={`profile-${profile.id}`}
                        transition={move}
                        onClick={() => {
                          setHasLeftWall(true)
                          setChosen(profile)
                          setProblem(null)
                        }}
                        {...(prefersReducedMotion === true
                          ? {}
                          : { whileHover: { y: -8 }, whileTap: { scale: 0.97 } })}
                        className="flex w-24 flex-col items-center gap-3 sm:w-32"
                      >
                        <Portrait profile={profile} />

                        <span className="w-full truncate text-center text-sm text-text-muted">
                          {profile.name}
                        </span>
                      </motion.button>
                    </li>
                  ))}
                </ul>

                <span className={pages > 1 ? '' : 'invisible'}>
                  <IconButton
                    label="Next"
                    disabled={page >= pages - 1}
                    onClick={() => {
                      setPage((current) => Math.min(current + 1, pages - 1))
                    }}
                  >
                    <IconChevronRight size={20} aria-hidden />
                  </IconButton>
                </span>
              </motion.div>

              {pages < 2 ? null : (
                <motion.ul
                  variants={revealVariants(prefersReducedMotion)}
                  transition={revealTransition(prefersReducedMotion)}
                  className="flex items-center gap-2"
                >
                  {Array.from({ length: pages }, (_, at) => at).map((at) => (
                    <li key={at}>
                      <button
                        type="button"
                        aria-label={`Page ${(at + 1).toString()}`}
                        aria-current={at === page ? 'true' : undefined}
                        onClick={() => {
                          setPage(at)
                        }}
                        className={`block h-1.5 rounded-full transition-all duration-300 ${
                          at === page ? 'w-6 bg-text' : 'w-1.5 bg-text-muted/40 hover:bg-text-muted'
                        }`}
                      />
                    </li>
                  ))}
                </motion.ul>
              )}

              {everyone.length !== 0 ? null : (
                <motion.p
                  variants={revealVariants(prefersReducedMotion)}
                  transition={revealTransition(prefersReducedMotion)}
                  className="max-w-sm text-center text-sm text-text-muted"
                >
                  Nobody has an account on this server yet.
                </motion.p>
              )}
            </motion.div>
          ) : (
            <div key="password" className="flex w-full max-w-sm flex-col items-center gap-6">
              {/* Neither side fades this: it is the same portrait moved, and
                  a shared layout animation only reads as one object travelling
                  if nothing is changing its opacity underneath. */}
              <motion.span layoutId={`profile-${chosen.id}`} transition={move}>
                <Portrait profile={chosen} isLarge />
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-2xl font-semibold tracking-tight text-text"
              >
                {chosen.name}
              </motion.h1>

              <motion.form
                noValidate
                initial={{ opacity: 0, y: prefersReducedMotion === true ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.14, duration: 0.35, ease: [0.2, 0, 0, 1] }}
                className="flex w-full flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void submit()
                }}
              >
                <TextField
                  label="Password"
                  type="password"
                  size="lg"
                  isPill
                  value={password}
                  onValueChange={setPassword}
                  autoComplete="current-password"
                  {...(problem === null ? {} : { error: problem })}
                />

                <Button
                  type="submit"
                  variant="glossy"
                  size="lg"
                  isPill
                  isLoading={isSubmitting}
                  disabled={password === ''}
                >
                  Watch
                  <IconArrowRight size={18} aria-hidden />
                </Button>

                {!isPasskeySupported() ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    isPill
                    isLoading={isUsingPasskey}
                    onClick={() => {
                      void signInWithPasskey()
                    }}
                  >
                    <IconKey size={16} aria-hidden />
                    Use a passkey instead
                  </Button>
                )}
              </motion.form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <IconButton
                  label="Somebody else"
                  onClick={() => {
                    setChosen(null)
                    setPassword('')
                    setProblem(null)
                  }}
                >
                  <IconArrowLeft size={18} aria-hidden />
                </IconButton>
              </motion.div>
            </div>
          )}
        </div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-8 text-xs tracking-[0.2em] text-text-muted/60"
      >
        © {name} · {version ?? '…'}
      </motion.p>
    </main>
  )
}

ProfileGate.displayName = 'ProfileGate'

export default { ProfileGate }
