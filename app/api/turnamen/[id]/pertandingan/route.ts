import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: daftar pertandingan satu turnamen (dengan nama tim)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: [{ urutan: "asc" }, { id: "asc" }],
  });
  const teams = await prisma.team.findMany({ where: { tournamentId } });
  const teamMap = new Map(teams.map((x) => [x.id, x.nama]));
  return NextResponse.json(
    matches.map((m) => ({
      ...m,
      homeNama: m.homeTeamId ? teamMap.get(m.homeTeamId) ?? null : null,
      awayNama: m.awayTeamId ? teamMap.get(m.awayTeamId) ?? null : null,
    }))
  );
}
