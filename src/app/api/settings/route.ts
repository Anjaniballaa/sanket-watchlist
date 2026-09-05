import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { DEFAULT_THRESHOLD, DEFAULT_WEIGHTS } from "@/lib/significance";
import { clearVisitCache } from "@/lib/digest";

const weightsSchema = z.object({
  w1: z.number().min(0).max(3),
  w2: z.number().min(0).max(3),
  w3: z.number().min(0).max(3),
  w4: z.number().min(0).max(3),
  w5: z.number().min(0).max(3),
  threshold: z.number().min(0.2).max(5),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("user_preferences")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();
  return NextResponse.json({
    weights: data
      ? {
          w1: Number(data.w1),
          w2: Number(data.w2),
          w3: Number(data.w3),
          w4: Number(data.w4),
          w5: Number(data.w5),
          threshold: Number(data.threshold),
        }
      : { ...DEFAULT_WEIGHTS, threshold: DEFAULT_THRESHOLD },
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = weightsSchema.parse(await req.json());
  const sb = getServiceSupabase();
  const { error } = await sb.from("user_preferences").upsert({
    user_id: session.user.id,
    ...body,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearVisitCache(session.user.id);
  return NextResponse.json({ ok: true });
}
