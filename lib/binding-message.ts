const BINDING_ALLOWED = /[^A-Za-z0-9+\-._.,:#]/g

export function sanitizeBindingInput(raw: string) {
  return raw.replace(/\s+/g, '-').replace(BINDING_ALLOWED, '').slice(0, 64)
}

export function sanitizeBindingMessage(raw: string) {
  return sanitizeBindingInput(raw).replace(/^-+|-+$/g, '') || 'Approve-this-action'
}
