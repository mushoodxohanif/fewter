import { auth } from "@/auth";

/**
 * Returns the current user's Figma OAuth access token from the session.
 * Returns null when unauthenticated or when token refresh failed.
 */
export async function getFigmaAccessToken(): Promise<string | null> {
  const session = await auth();

  if (!session?.accessToken || session.error) {
    return null;
  }

  return session.accessToken;
}
