interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface RefreshedTokens {
  accessToken: string;
  expiresAt: number;
}

/**
 * Exchange a Figma refresh token for a new access token.
 * @see https://www.figma.com/developers/api#refresh-tokens
 */
export async function refreshFigmaAccessToken(
  refreshToken: string,
): Promise<RefreshedTokens> {
  const clientId = process.env.AUTH_FIGMA_ID;
  const clientSecret = process.env.AUTH_FIGMA_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing AUTH_FIGMA_ID or AUTH_FIGMA_SECRET");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch("https://api.figma.com/v1/oauth/refresh", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma token refresh failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as RefreshTokenResponse;

  return {
    accessToken: data.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
  };
}
