import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cekTurnamenSelesai, progresiHasil, tentukanHasil } from "@/lib/progress";

// POST: input skor oleh wasit. Pemenang otomatis diteruskan ke babak berikut.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const m = await prisma.match.findUnique({ where: { id }, include: { tournament: true } });
  if (!m) return NextResponse.json({ error: "Pertandingan tidak ditemukan" }, { status: 404 });
  if (m.isBye)
    return NextResponse.json({ error: "Pertandingan bye tidak perlu diinput skor" }, { status: 400 });
  if (m.homeTeamId === null || m.awayTeamId === null)
    return NextResponse.json(
      { error: "Kedua tim belum lengkap (menunggu hasil babak sebelumnya)" },
      { status: 400 }
    );

  const body = await req.json().catch(() => null);
  const homeScore = Number(body?.homeScore);
  const awayScore = Number(body?.awayScore);
  if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0)
    return NextResponse.json({ error: "Skor harus bilangan bulat >= 0" }, { status: 400 });

  const { winner } = tentukanHasil(homeScore, awayScore);
  if (winner === "draw" && m.bracket !== "roundrobin")
    return NextResponse.json(
      { error: "Pertandingan sistem gugur tidak boleh seri" },
      { status: 400 }
    );

  // Tulis skor dalam satu statement, lalu progresikan bracket.
  const updated = await prisma.match.update({
    where: { id },
    data: { homeScore, awayScore, status: "selesai" },
  });
  await progresiHasil({
    id: updated.id,
    bracket: updated.bracket,
    nextMatchId: updated.nextMatchId,
    nextSlot: updated.nextSlot,
    loserNextMatchId: updated.loserNextMatchId,
    loserSlot: updated.loserSlot,
    homeTeamId: updated.homeTeamId,
    awayTeamId: updated.awayTeamId,
    homeScore: updated.homeScore,
    awayScore: updated.awayScore,
  });
  await cekTurnamenSelesai(m.tournamentId);

  return NextResponse.json(updated);
}
