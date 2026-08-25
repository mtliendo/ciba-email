import { sanitizeBindingMessage } from './binding-message'

const CIBA_EMAIL = 'admin@focusotter.com'
// Auth0 sends email when requested_expiry is 301-259200s. <=300 is Guardian push.
const EMAIL_EXPIRY_SECONDS = 600

function domain() {
  const raw = process.env.AUTH0_DOMAIN
  if (!raw) throw new Error('AUTH0_DOMAIN is not set')
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function issuer() {
  return `https://${domain()}/`
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export async function resolveCibaUserSub(
  sessionSub?: string,
  sessionEmail?: string,
) {
  if (sessionEmail?.toLowerCase() === CIBA_EMAIL && sessionSub) {
    return sessionSub
  }
  if (process.env.AUTH0_CIBA_SUB) {
    return process.env.AUTH0_CIBA_SUB
  }
  throw new Error(
    `Need the Auth0 user id for ${CIBA_EMAIL}. Log in as that user, or set AUTH0_CIBA_SUB.`,
  )
}

export async function startCiba(sub: string, bindingMessage: string) {
  const cleaned = sanitizeBindingMessage(bindingMessage)
  const body = new URLSearchParams({
    client_id: requireEnv('AUTH0_CLIENT_ID'),
    client_secret: requireEnv('AUTH0_CLIENT_SECRET'),
    scope: 'openid',
    binding_message: cleaned,
    requested_expiry: String(EMAIL_EXPIRY_SECONDS),
    login_hint: JSON.stringify({
      format: 'iss_sub',
      iss: issuer(),
      sub,
    }),
  })

  const res = await fetch(`https://${domain()}/bc-authorize`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(
      json.error_description || json.error || 'bc-authorize failed',
    )
  }
  return {
    authReqId: json.auth_req_id as string,
    interval: Number(json.interval ?? 5),
    expiresIn: Number(json.expires_in ?? EMAIL_EXPIRY_SECONDS),
    email: CIBA_EMAIL,
    bindingMessage: cleaned,
  }
}

export async function pollCiba(authReqId: string) {
  const body = new URLSearchParams({
    grant_type: 'urn:openid:params:grant-type:ciba',
    client_id: requireEnv('AUTH0_CLIENT_ID'),
    client_secret: requireEnv('AUTH0_CLIENT_SECRET'),
    auth_req_id: authReqId,
  })

  const res = await fetch(`https://${domain()}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()

  if (res.ok && json.access_token) {
    return { status: 'approved' as const }
  }

  const error = json.error as string | undefined
  if (error === 'authorization_pending') {
    return { status: 'pending' as const, interval: Number(json.interval ?? 5) }
  }
  if (error === 'slow_down') {
    return { status: 'pending' as const, interval: Number(json.interval ?? 10) }
  }
  if (error === 'access_denied' || error === 'expired_token') {
    return {
      status: 'denied' as const,
      error: json.error_description || error,
    }
  }
  return {
    status: 'error' as const,
    error: json.error_description || error || 'token poll failed',
  }
}
