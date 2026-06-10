import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Figma from "next-auth/providers/figma";
import { refreshFigmaAccessToken } from "@/lib/figma/refresh-access-token";

const FIGMA_SCOPES = "file_content:read file_metadata:read";

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  try {
    const refreshed = await refreshFigmaAccessToken(token.refreshToken);

    return {
      ...token,
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Figma({
      authorization: {
        params: {
          scope: FIGMA_SCOPES,
        },
      },
      checks: ["pkce", "state"],
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }

      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;

      // Only gate conversion/chat API routes; keep pages and static assets public.
      if (pathname === "/api/convert" || pathname === "/api/chat") {
        return !!session?.user;
      }

      return true;
    },
  },
  pages: {
    signIn: "/",
  },
});
