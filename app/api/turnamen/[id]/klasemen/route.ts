import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hitungKlasemen } from "@/lib/klasemen";

// GET: klasemen turnamen (poin, selisih gol) dari pertandingan yang selesai.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  const teams = await prisma.team.findMany({ where: { tournamentId } });
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: "selesai" },
    select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
  });
  return NextResponse.json(hitungKlasemen(teams, matches));
}
