import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Button asChild size="lg">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
