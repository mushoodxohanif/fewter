import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PROTECTED_API_ROUTES = new Set(["/api/convert", "/api/chat"]);

export const proxy = auth((request) => {
  const { pathname } = request.nextUrl;

  if (!PROTECTED_API_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (!request.auth?.user) {
    return NextResponse.json(
      {
        error: "Sign in with Figma to convert designs.",
        step: "auth",
        code: "AUTH_REQUIRED",
      },
      { status: 401 },
    );
  }

  return NextResponse.next();
});

export const proxyConfig = {
  matcher: ["/api/convert", "/api/chat"],
};
