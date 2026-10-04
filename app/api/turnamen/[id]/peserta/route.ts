import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: daftar tim peserta + pemainnya
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    orderBy: { seed: "asc" },
    include: { players: { orderBy: { nomor: "asc" } } },
  });
  return NextResponse.json(teams);
}

// POST: tambah tim peserta
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  if (t.status !== "draft")
    return NextResponse.json(
      { error: "Tim hanya bisa ditambah saat turnamen masih draft" },
      { status: 409 }
    );
  const body = await req.json().catch(() => null);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) return NextResponse.json({ error: "Nama tim wajib diisi" }, { status: 400 });
  const count = await prisma.team.count({ where: { tournamentId } });
  const seed = body?.seed !== undefined ? Number(body.seed) : count + 1;
  if (!Number.isInteger(seed) || seed < 1)
    return NextResponse.json({ error: "Seed harus bilangan bulat >= 1" }, { status: 400 });
  const dupe = await prisma.team.findFirst({ where: { tournamentId, nama } });
  if (dupe)
    return NextResponse.json({ error: "Nama tim sudah terdaftar di turnamen ini" }, { status: 409 });
  const created = await prisma.team.create({ data: { tournamentId, nama, seed } });
  return NextResponse.json(created, { status: 201 });
}
