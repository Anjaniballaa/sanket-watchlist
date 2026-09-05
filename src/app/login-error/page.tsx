import Link from "next/link";

export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign-in didn&apos;t complete</h1>
      <p className="mt-3 text-sm text-[var(--muted)]">
        {error === "Configuration"
          ? "The auth adapter was misconfigured. Refresh and try Google again."
          : error === "AccessDenied"
            ? "Google denied access. Use an account listed as a test user on the OAuth consent screen."
            : `Auth error: ${error ?? "unknown"}.`}
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex w-fit rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-black"
      >
        Back to Sanket
      </Link>
    </main>
  );
}
