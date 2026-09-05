import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildDigest } from "@/lib/digest";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const digest = await buildDigest(session.user.id, { forceRefresh: force });
    return NextResponse.json(digest);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "digest failed" },
      { status: 500 },
    );
  }
}
