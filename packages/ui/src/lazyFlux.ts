import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Lazily loads a FluxUI component.
 *
 * Flux components are default-exported inside an object, so `React.lazy`
 * cannot find a component default on its own. Always use this helper instead
 * of calling `React.lazy` directly. See code standards section 5.
 */
const lazyFlux = <TName extends string, TProps extends object>(
  loader: () => Promise<{ default: Record<TName, ComponentType<TProps>> }>,
  name: TName,
): LazyExoticComponent<ComponentType<TProps>> =>
  lazy(() => loader().then((module) => ({ default: module.default[name] })))

export default { lazyFlux }
