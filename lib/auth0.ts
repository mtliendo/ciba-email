import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  enableAccessTokenEndpoint: false,
  enableConnectAccountEndpoint: true,
  authorizationParameters: {
    ...(process.env.AUTH0_LOGIN_CONNECTION ? { connection: process.env.AUTH0_LOGIN_CONNECTION } : {}),
    scope: "openid profile email offline_access",
  },
});
