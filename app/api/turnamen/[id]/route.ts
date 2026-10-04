import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const JENIS = ["futsal", "e-sport"];
const FORMAT = ["single", "double", "roundrobin"];
const STATUS = ["draft", "berjalan", "selesai"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const t = await prisma.tournament.findUnique({
    where: { id },
    include: { teams: { include: { players: { orderBy: { nomor: "asc" } } }, orderBy: { seed: "asc" } } },
  });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  return NextResponse.json(t);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const data: Record<string, string> = {};
  if (body?.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (!nama) return NextResponse.json({ error: "Nama turnamen wajib diisi" }, { status: 400 });
    data.nama = nama;
  }
  if (body?.jenis !== undefined) {
    if (!JENIS.includes(body.jenis))
      return NextResponse.json({ error: "Jenis harus futsal atau e-sport" }, { status: 400 });
    data.jenis = body.jenis;
  }
  if (body?.format !== undefined) {
    if (!FORMAT.includes(body.format))
      return NextResponse.json({ error: "Format harus single, double, atau roundrobin" }, { status: 400 });
    data.format = body.format;
  }
  if (body?.status !== undefined) {
    if (!STATUS.includes(body.status))
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    data.status = body.status;
  }
  try {
    const updated = await prisma.tournament.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  try {
    await prisma.tournament.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  }
}
