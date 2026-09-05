import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { buildDigest } from "@/lib/digest";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const digest = await buildDigest(session.user.id);
  const token = randomBytes(16).toString("hex");
  const sb = getServiceSupabase();
  const { error } = await sb.from("digest_shares").insert({
    token,
    user_id: session.user.id,
    payload: {
      ...digest,
      ownerName: session.user.name ?? session.user.email ?? "Investor",
      frozenAt: new Date().toISOString(),
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token, url: `/share/${token}` });
}
