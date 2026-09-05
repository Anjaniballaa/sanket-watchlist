import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return (
    <DashboardClient
      user={{
        name: session.user.name ?? "You",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      }}
    />
  );
}
