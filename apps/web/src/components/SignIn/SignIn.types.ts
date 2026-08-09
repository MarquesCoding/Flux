type SignInProps = {
  onSignedIn: () => void
}

type SignInErrors = {
  email?: string
  password?: string
  submit?: string
}

export type { SignInProps, SignInErrors }
