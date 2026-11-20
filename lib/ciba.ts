const EMAIL_EXPIRY_SECONDS = 600;

function issuer() {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) throw new Error("Missing AUTH0_DOMAIN");
  return new URL(domain.includes("://") ? domain : `https://${domain}`);
}

async function requestAuth0(path: string, parameters: Record<string, string>) {
  const { AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET } = process.env;
  if (!AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET) throw new Error("Missing Auth0 credentials");
  return fetch(new URL(path, issuer()), {
    method: "POST",
    body: new URLSearchParams({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      ...parameters,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
}

export async function startCiba(sub: string, bindingMessage: string) {
  const response = await requestAuth0("/bc-authorize", {
    scope: "openid",
    binding_message: bindingMessage,
    requested_expiry: String(EMAIL_EXPIRY_SECONDS),
    login_hint: JSON.stringify({ format: "iss_sub", iss: issuer().origin + "/", sub }),
  });
  if (!response.ok) throw new Error(`Auth0 backchannel status: ${response.status}`);
  const data = await response.json();
  if (
    typeof data.auth_req_id !== "string" || !data.auth_req_id || data.auth_req_id.length > 2000 ||
    !Number.isSafeInteger(data.expires_in) || data.expires_in <= 0
  ) {
    throw new Error("Invalid backchannel response");
  }
  return {
    authReqId: data.auth_req_id as string,
    interval: Number.isSafeInteger(data.interval) ? Math.max(5, data.interval) : 5,
    expiresIn: Math.min(data.expires_in, EMAIL_EXPIRY_SECONDS),
  };
}

export async function pollCiba(authReqId: string) {
  const response = await requestAuth0("/oauth/token", {
    grant_type: "urn:openid:params:grant-type:ciba",
    auth_req_id: authReqId,
  });
  const data = await response.json();
  if (response.ok && typeof data.access_token === "string" && data.access_token) return "approved";
  switch (data.error) {
    case "authorization_pending": return "pending";
    case "slow_down": return "slow_down";
    case "access_denied": return "denied";
    case "expired_token": return "expired";
    default: throw new Error(`Auth0 polling status: ${response.status}`);
  }
}
