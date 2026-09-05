import { auth } from "@/auth";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) {
    throw new Error("UNAUTHENTICATED");
  }
  return id;
}
