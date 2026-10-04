import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const JENIS = ["futsal", "e-sport"];
const FORMAT = ["single", "double", "roundrobin"];

export async function GET() {
  const rows = await prisma.tournament.findMany({
    orderBy: { id: "desc" },
    include: { _count: { select: { teams: true, matches: true } } },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nama = String(body?.nama ?? "").trim();
  const jenis = String(body?.jenis ?? "futsal");
  const format = String(body?.format ?? "single");
  if (!nama) return NextResponse.json({ error: "Nama turnamen wajib diisi" }, { status: 400 });
  if (!JENIS.includes(jenis))
    return NextResponse.json({ error: "Jenis harus futsal atau e-sport" }, { status: 400 });
  if (!FORMAT.includes(format))
    return NextResponse.json({ error: "Format harus single, double, atau roundrobin" }, { status: 400 });
  const created = await prisma.tournament.create({ data: { nama, jenis, format } });
  return NextResponse.json(created, { status: 201 });
}
