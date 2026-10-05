import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ACCESS_COOKIE_NAME, verifyAccessToken } from './session'

export async function hasHouseholdAccess() {
  const token = (await cookies()).get(ACCESS_COOKIE_NAME)?.value
  return verifyAccessToken(token)
}

export async function requireHouseholdAccess() {
  if (!(await hasHouseholdAccess())) redirect('/access')
}
