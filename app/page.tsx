import { FigmaAuthButton } from "@/components/auth/figma-auth-button";
import { SignatureConverter } from "@/components/signature-converter";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Fewter</span>
          <FigmaAuthButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        <SignatureConverter />
      </main>
    </div>
  );
}
