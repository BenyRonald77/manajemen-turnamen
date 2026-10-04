import { prisma } from "@/lib/prisma";

// Menentukan pemenang dari skor. Draw hanya valid di round robin.
export function tentukanHasil(
  homeScore: number,
  awayScore: number
): { winner: "home" | "away" | "draw" } {
  if (homeScore > awayScore) return { winner: "home" };
  if (awayScore > homeScore) return { winner: "away" };
  return { winner: "draw" };
}

type Slot = "home" | "away";

// Tulis teamId ke slot pertandingan lanjutan secara atomik (single statement):
// hanya timpa bila slot masih kosong atau masih berisi tim lama.
async function tulisSlot(
  matchId: number,
  slot: Slot,
  teamId: number,
  oldTeamId: number | null
): Promise<boolean> {
  // Dibuat eksplisit per slot agar type-check Prisma tetap ketat.
  if (slot === "home") {
    const r = await prisma.match.updateMany({
      where:
        oldTeamId === null
          ? { id: matchId, homeTeamId: null }
          : { id: matchId, OR: [{ homeTeamId: null }, { homeTeamId: oldTeamId }] },
      data: { homeTeamId: teamId },
    });
    return r.count > 0;
  }
  const r = await prisma.match.updateMany({
    where:
      oldTeamId === null
        ? { id: matchId, awayTeamId: null }
        : { id: matchId, OR: [{ awayTeamId: null }, { awayTeamId: oldTeamId }] },
    data: { awayTeamId: teamId },
  });
  return r.count > 0;
}

// Setelah sebuah tim masuk ke slot sebuah pertandingan, bila pertandingan itu
// adalah bye struktural (isBye) maka tim langsung diteruskan lagi ke babak
// berikutnya, berantai.
export async function teruskanByeBerantai(matchId: number): Promise<void> {
  let guard = 0;
  let cur: number | null = matchId;
  while (cur !== null && guard++ < 20) {
    const m = await prisma.match.findUnique({ where: { id: cur } });
    if (!m || !m.isBye || m.status === "selesai") break;
    const teamId = m.homeTeamId ?? m.awayTeamId;
    if (teamId === null || !m.nextMatchId || !m.nextSlot) break;
    await tulisSlot(m.nextMatchId, m.nextSlot as Slot, teamId, null);
    await prisma.match.update({ where: { id: cur }, data: { status: "selesai" } });
    cur = m.nextMatchId;
  }
}

// Progresi hasil pertandingan yang baru diinput: teruskan pemenang (dan pecundang
// untuk double elimination) ke slot lanjutan secara atomik.
export async function progresiHasil(match: {
  id: number;
  bracket: string;
  nextMatchId: number | null;
  nextSlot: string | null;
  loserNextMatchId: number | null;
  loserSlot: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
}): Promise<void> {
  const newWinner =
    match.homeScore! > match.awayScore!
      ? match.homeTeamId
      : match.homeScore! < match.awayScore!
        ? match.awayTeamId
        : null;
  const newLoser =
    newWinner === null
      ? null
      : newWinner === match.homeTeamId
        ? match.awayTeamId
        : match.homeTeamId;

  // Pemenang lama (untuk koreksi skor): dihitung dari skor sebelum update.
  // Disederhanakan: slot hanya ditimpa bila kosong atau berisi newWinner
  // (idempoten) — bila pemenang berubah total, admin meninjau manual (PRD).
  if (newWinner !== null && match.nextMatchId && match.nextSlot) {
    const slot = match.nextSlot as Slot;
    const target = await prisma.match.findUnique({ where: { id: match.nextMatchId } });
    const curVal = target ? target[slot === "home" ? "homeTeamId" : "awayTeamId"] : null;
    if (curVal === null || curVal === newWinner) {
      await tulisSlot(match.nextMatchId, slot, newWinner, null);
      await teruskanByeBerantai(match.nextMatchId);
    }
  }
  if (newLoser !== null && match.loserNextMatchId && match.loserSlot) {
    const slot = match.loserSlot as Slot;
    const target = await prisma.match.findUnique({ where: { id: match.loserNextMatchId } });
    const curVal = target ? target[slot === "home" ? "homeTeamId" : "awayTeamId"] : null;
    if (curVal === null || curVal === newLoser) {
      await tulisSlot(match.loserNextMatchId, slot, newLoser, null);
      await teruskanByeBerantai(match.loserNextMatchId);
    }
  }
}

// Tandai turnamen selesai bila tak ada lagi pertandingan yang bisa dimainkan.
export async function cekTurnamenSelesai(tournamentId: number): Promise<void> {
  const sisa = await prisma.match.count({
    where: {
      tournamentId,
      status: { not: "selesai" },
      isBye: false,
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
  });
  if (sisa === 0) {
    await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "selesai" } });
  }
}
