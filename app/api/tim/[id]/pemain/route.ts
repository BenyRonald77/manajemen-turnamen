import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: tambah pemain ke tim
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const teamId = Number(params.id);
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { tournament: true },
  });
  if (!team) return NextResponse.json({ error: "Tim tidak ditemukan" }, { status: 404 });
  if (team.tournament.status !== "draft")
    return NextResponse.json(
      { error: "Pemain hanya bisa ditambah saat turnamen masih draft" },
      { status: 409 }
    );
  const body = await req.json().catch(() => null);
  const nama = String(body?.nama ?? "").trim();
  if (!nama) return NextResponse.json({ error: "Nama pemain wajib diisi" }, { status: 400 });
  const nomor = body?.nomor !== undefined ? Number(body.nomor) : 0;
  if (!Number.isInteger(nomor) || nomor < 0)
    return NextResponse.json({ error: "Nomor punggung harus bilangan bulat >= 0" }, { status: 400 });
  const created = await prisma.player.create({ data: { teamId, nama, nomor } });
  return NextResponse.json(created, { status: 201 });
}
