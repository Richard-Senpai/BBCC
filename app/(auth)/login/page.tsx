import { redirect } from 'next/navigation'

/**
 * /login redirects to /signup which now handles both
 * Register and Sign In tabs in a single combined page.
 */
export default function LoginPage() {
  redirect('/signup')
}
