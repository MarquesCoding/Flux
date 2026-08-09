import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import lazyFluxModule from './lazyFlux'

const { lazyFlux } = lazyFluxModule

type GreetingProps = { name: string }

const Greeting = ({ name }: GreetingProps) => <p>Hello {name}</p>

describe('lazyFlux', () => {
  it('unwraps a component from the Flux default export object', async () => {
    const LazyGreeting = lazyFlux(() => Promise.resolve({ default: { Greeting } }), 'Greeting')

    render(
      <Suspense fallback={<p>Loading</p>}>
        <LazyGreeting name="Flux" />
      </Suspense>,
    )

    expect(await screen.findByText('Hello Flux')).toBeInTheDocument()
  })

  it('renders the fallback until the module resolves', async () => {
    const LazyGreeting = lazyFlux(() => Promise.resolve({ default: { Greeting } }), 'Greeting')

    render(
      <Suspense fallback={<p>Loading</p>}>
        <LazyGreeting name="Flux" />
      </Suspense>,
    )

    expect(screen.getByText('Loading')).toBeInTheDocument()

    expect(await screen.findByText('Hello Flux')).toBeInTheDocument()
  })
})
