import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBracket } from "@/lib/bracket";

// POST: generate bracket otomatis (hanya saat status draft)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = Number(params.id);
  const t = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!t) return NextResponse.json({ error: "Turnamen tidak ditemukan" }, { status: 404 });
  if (t.status !== "draft")
    return NextResponse.json(
      { error: "Bracket hanya bisa digenerate saat turnamen masih draft" },
      { status: 409 }
    );

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    orderBy: [{ seed: "asc" }, { id: "asc" }],
  });
  if (teams.length < 2)
    return NextResponse.json({ error: "Minimal 2 tim untuk generate bracket" }, { status: 400 });

  let built;
  try {
    built = buildBracket(t.format, teams.map((x) => ({ id: x.id, seed: x.seed })));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // Hapus bracket lama (bila generate ulang), lalu buat dari induk ke anak
  // agar nextMatchId sudah tersedia.
  await prisma.match.deleteMany({ where: { tournamentId } });
  const ordered = [...built.specs].sort((a, b) => a.order - b.order);
  const ids = new Map<string, number>();
  for (const s of ordered) {
    const slot = built.slots.get(s.key)!;
    // Bye struktural: hanya satu sisi yang punya feed tim -> tim langsung
    // diteruskan (sudah dihitung di built.slots), pertandingan ditandai selesai.
    const isBye = (s.home === null) !== (s.away === null);
    const created = await prisma.match.create({
      data: {
        tournamentId,
        kode: s.kode,
        babak: s.babak,
        bracket: s.bracket,
        homeTeamId: slot.home,
        awayTeamId: slot.away,
        isBye,
        status: isBye ? "selesai" : "terjadwal",
        nextMatchId: s.nextKey ? ids.get(s.nextKey) ?? null : null,
        nextSlot: s.nextSlot,
        loserNextMatchId: s.loserNextKey ? ids.get(s.loserNextKey) ?? null : null,
        loserSlot: s.loserSlot,
      },
    });
    ids.set(s.key, created.id);
  }

  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: "berjalan" } });

  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: { id: "asc" },
  });
  return NextResponse.json({ total: matches.length, matches }, { status: 201 });
}
