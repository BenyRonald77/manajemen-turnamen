import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: statistik pemain satu pertandingan
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const matchId = Number(params.id);
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });
  const rows = await prisma.playerStat.findMany({
    where: { matchId },
    include: { player: { include: { team: true } } },
    orderBy: { id: "asc" },
  });
  return NextResponse.json(rows);
}

// POST: catat statistik pemain (gol, kartu kuning/merah, MVP).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const matchId = Number(params.id);
  const m = await prisma.match.findUnique({ where: { id: matchId } });
  if (!m) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const playerId = Number(body?.playerId);
  if (!Number.isInteger(playerId) || playerId <= 0)
    return NextResponse.json({ error: "playerId tidak valid" }, { status: 400 });
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) return NextResponse.json({ error: "Pemain tidak ditemukan" }, { status: 404 });
  if (player.teamId !== m.homeTeamId && player.teamId !== m.awayTeamId)
    return NextResponse.json(
      { error: "Pemain bukan anggota tim yang bertanding" },
      { status: 400 }
    );

  const gol = body?.gol !== undefined ? Number(body.gol) : 0;
  const kuning = body?.kuning !== undefined ? Number(body.kuning) : 0;
  const merah = body?.merah !== undefined ? Number(body.merah) : 0;
  for (const [label, v] of [["gol", gol], ["kartu kuning", kuning], ["kartu merah", merah]] as const) {
    if (!Number.isInteger(v) || v < 0)
      return NextResponse.json({ error: `${label} harus bilangan bulat >= 0` }, { status: 400 });
  }
  const mvp = body?.mvp === true;

  let created;
  try {
    created = await prisma.playerStat.create({
      data: { matchId, playerId, gol, kuning, merah },
      include: { player: { include: { team: true } } },
    });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "P2002")
      return NextResponse.json(
        { error: "Statistik pemain ini sudah dicatat untuk pertandingan ini" },
        { status: 409 }
      );
    throw e;
  }

  // Klaim MVP atomik: hanya berhasil bila belum ada MVP di pertandingan ini.
  // Bila gagal, statistik yang barusan dibuat di-rollback agar konsisten.
  if (mvp) {
    const klaim = await prisma.match.updateMany({
      where: { id: matchId, mvpPlayerId: null },
      data: { mvpPlayerId: playerId },
    });
    if (klaim.count === 0) {
      await prisma.playerStat.delete({ where: { id: created.id } });
      return NextResponse.json({ error: "MVP pertandingan ini sudah diklaim" }, { status: 409 });
    }
  }
  return NextResponse.json(created, { status: 201 });
}
