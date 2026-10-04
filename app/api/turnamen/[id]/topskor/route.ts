import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: daftar pencetak gol terbanyak satu turnamen
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  const agg = await prisma.playerStat.groupBy({
    by: ["playerId"],
    where: { match: { tournamentId } },
    _sum: { gol: true, kuning: true, merah: true },
  });
  const players = await prisma.player.findMany({
    where: { id: { in: agg.map((a) => a.playerId) } },
    include: { team: true },
  });
  const pmap = new Map(players.map((p) => [p.id, p]));
  const rows = agg
    .map((a) => ({
      playerId: a.playerId,
      nama: pmap.get(a.playerId)?.nama ?? "?",
      tim: pmap.get(a.playerId)?.team.nama ?? "?",
      gol: a._sum.gol ?? 0,
      kuning: a._sum.kuning ?? 0,
      merah: a._sum.merah ?? 0,
    }))
    .sort((x, y) => y.gol - x.gol || x.nama.localeCompare(y.nama));
  return NextResponse.json(rows);
}
