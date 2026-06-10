"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function FigmaAuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="outline" disabled>
        Loading…
      </Button>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        {session.user.image ? (
          // biome-ignore lint/performance/noImgElement: OAuth avatar URL from Figma
          <img
            src={session.user.image}
            alt=""
            className="size-8 rounded-full"
          />
        ) : null}
        <span className="text-sm text-muted-foreground">
          {session.user.name ?? session.user.email}
        </span>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return <Button onClick={() => signIn("figma")}>Sign in with Figma</Button>;
}
