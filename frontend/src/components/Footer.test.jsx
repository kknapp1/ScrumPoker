import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// constants.js reads import.meta.env.VITE_APP_VERSION at module-eval time,
// so each case needs a fresh module graph (vi.resetModules) after stubbing
// the env var, then a dynamic import to actually pick up the new value.
describe('Footer', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  test('renders a link to the GitHub release page when a version is set', async () => {
    vi.stubEnv('VITE_APP_VERSION', 'v1.6.1')
    const Footer = (await import('./Footer.jsx')).default
    render(<Footer />)

    const link = screen.getByRole('link', { name: 'v1.6.1' })
    expect(link).toHaveAttribute('href', 'https://github.com/kknapp1/ScrumPoker/releases/tag/v1.6.1')
  })

  test('renders nothing when no version is set', async () => {
    vi.stubEnv('VITE_APP_VERSION', '')
    const Footer = (await import('./Footer.jsx')).default
    const { container } = render(<Footer />)

    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing for the "untagged" fallback (not a real release)', async () => {
    vi.stubEnv('VITE_APP_VERSION', 'untagged')
    const Footer = (await import('./Footer.jsx')).default
    const { container } = render(<Footer />)

    expect(container).toBeEmptyDOMElement()
  })
})
