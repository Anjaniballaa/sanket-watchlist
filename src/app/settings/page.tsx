import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { SettingsForm } from "@/components/settings-form";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-[var(--muted)]">
          ← Dashboard
        </Link>
        <ThemeToggle />
      </div>
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="mt-2 text-[var(--muted)]">{session.user.email}</p>
      <SettingsForm />
      <form
        className="mt-10"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="text-sm text-[var(--danger)]">
          Sign out
        </button>
      </form>
    </main>
  );
}
