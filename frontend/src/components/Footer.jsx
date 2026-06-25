import { APP_VERSION, GITHUB_REPO_URL } from '../constants.js'
import styles from './Footer.module.css'

/**
 * Footer — small, unobtrusive version indicator. Hidden entirely when
 * there's no real version to link to: VITE_APP_VERSION isn't set (e.g.
 * local dev), or it's "untagged" (deploy-sandbox.yml's fallback for a
 * repo with no tags at all — shouldn't happen once releases exist, but
 * "untagged" isn't a real release page either way).
 */
export default function Footer() {
  if (!APP_VERSION || APP_VERSION === 'untagged') return null

  return (
    <footer className={styles.footer}>
      <a
        href={`${GITHUB_REPO_URL}/releases/tag/${APP_VERSION}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.versionLink}
      >
        {APP_VERSION}
      </a>
    </footer>
  )
}
