import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WAKTU_RE, isOverlap } from "@/lib/jadwal";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const m = await prisma.match.findUnique({
    where: { id },
    include: {
      tournament: true,
      stats: { include: { player: { include: { team: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!m) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });
  const teams = await prisma.team.findMany({ where: { tournamentId: m.tournamentId } });
  const teamMap = new Map(teams.map((t) => [t.id, t.nama]));
  const mvp = m.mvpPlayerId
    ? await prisma.player.findUnique({ where: { id: m.mvpPlayerId }, include: { team: true } })
    : null;
  return NextResponse.json({
    ...m,
    homeNama: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
    awayNama: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
    mvp,
  });
}

// PATCH: jadwalkan pertandingan (lapangan + waktu). Validasi anti-bentrok.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const m = await prisma.match.findUnique({ where: { id } });
  if (!m) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const lapangan = String(body?.lapangan ?? "").trim();
  const mulaiAt = String(body?.mulaiAt ?? "").trim();
  const durasiMenit = body?.durasiMenit !== undefined ? Number(body.durasiMenit) : m.durasiMenit;

  if (!lapangan) return NextResponse.json({ error: "Lapangan wajib diisi" }, { status: 400 });
  if (!WAKTU_RE.test(mulaiAt))
    return NextResponse.json(
      { error: "Format waktu harus YYYY-MM-DD HH:MM" },
      { status: 400 }
    );
  if (!Number.isInteger(durasiMenit) || durasiMenit <= 0)
    return NextResponse.json({ error: "Durasi harus bilangan bulat > 0 (menit)" }, { status: 400 });

  // Cek bentrok: pertandingan lain di lapangan yang sama & interval overlap
  const others = await prisma.match.findMany({
    where: { tournamentId: m.tournamentId, id: { not: id }, lapangan },
    select: { id: true, kode: true, lapangan: true, mulaiAt: true, durasiMenit: true },
  });
  const bentrok = others.find((o) => isOverlap(o, mulaiAt, durasiMenit));
  if (bentrok)
    return NextResponse.json(
      {
        error: `Bentrok dengan ${bentrok.kode} di ${bentrok.lapangan} (${bentrok.mulaiAt})`,
      },
      { status: 409 }
    );

  const updated = await prisma.match.update({
    where: { id },
    data: { lapangan, mulaiAt, durasiMenit },
  });
  return NextResponse.json(updated);
}
