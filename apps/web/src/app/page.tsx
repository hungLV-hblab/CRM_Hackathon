import { redirect } from 'next/navigation'

/**
 * The root has no content of its own. A logged-in user belongs on the company list; a
 * logged-out one is sent to the login page by the middleware before this ever runs.
 */
export default function HomePage() {
  redirect('/cong-ty')
}
