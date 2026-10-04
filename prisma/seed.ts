import { PrismaClient } from "@prisma/client";
import { buildBracket } from "../lib/bracket";

const prisma = new PrismaClient();

const NAMA_PEMAIN: [string, number][] = [
  ["Andi Pratama", 10], ["Budi Santoso", 7], ["Candra Wijaya", 4], ["Dedi Kurniawan", 1], ["Eko Saputra", 9],
  ["Fajar Nugroho", 11], ["Gilang Ramadhan", 8], ["Hendra Gunawan", 5], ["Irfan Hakim", 3], ["Joko Susilo", 6],
  ["Rizky Maulana", 10], ["Bagas Prasetyo", 7], ["Dimas Anggraini", 4], ["Farhan Aziz", 1], ["Galih Permana", 9],
  ["Yoga Saputra", 11], ["Rendi Kurnia", 8], ["Sigit Wibowo", 5], ["Teguh Hidayat", 3], ["Wahyu Firmansyah", 6],
  ["Aldo Fernando", 10], ["Bima Aditya", 7], ["Cahyo Purnomo", 4], ["Danang Setiawan", 1], ["Ega Prayoga", 9],
  ["Fikri Haikal", 11], ["Gerry Pratama", 8], ["Hafiz Rahman", 5], ["Ilham Maulana", 3], ["Jaya Kusuma", 6],
];

async function buatTurnamen(
  nama: string,
  jenis: string,
  format: string,
  namaTim: string[],
  generateBracket: boolean
) {
  const t = await prisma.tournament.create({ data: { nama, jenis, format } });
  const teams = [];
  for (let i = 0; i < namaTim.length; i++) {
    const team = await prisma.team.create({
      data: { tournamentId: t.id, nama: namaTim[i], seed: i + 1 },
    });
    teams.push(team);
    const base = (i * 5) % NAMA_PEMAIN.length;
    for (let p = 0; p < 5; p++) {
      const [pn, nomor] = NAMA_PEMAIN[(base + p) % NAMA_PEMAIN.length];
      await prisma.player.create({
        data: { teamId: team.id, nama: pn, nomor },
      });
    }
  }
  if (generateBracket) {
    const built = buildBracket(format, teams.map((x) => ({ id: x.id, seed: x.seed })));
    const ordered = [...built.specs].sort((a, b) => a.order - b.order);
    const ids = new Map<string, number>();
    for (const s of ordered) {
      const slot = built.slots.get(s.key)!;
      const isBye = (s.home === null) !== (s.away === null);
      const created = await prisma.match.create({
        data: {
          tournamentId: t.id,
          kode: s.kode,
          babak: s.babak,
          bracket: s.bracket,
          homeTeamId: slot.home,
          awayTeamId: slot.away,
          isBye,
          urutan: s.roundIdx,
          status: isBye ? "selesai" : "terjadwal",
          nextMatchId: s.nextKey ? ids.get(s.nextKey) ?? null : null,
          nextSlot: s.nextSlot,
          loserNextMatchId: s.loserNextKey ? ids.get(s.loserNextKey) ?? null : null,
          loserSlot: s.loserSlot,
        },
      });
      ids.set(s.key, created.id);
    }
    await prisma.tournament.update({ where: { id: t.id }, data: { status: "berjalan" } });
  }
  console.log(`seed: ${nama} (${namaTim.length} tim, ${format})`);
}

async function main() {
  const n = await prisma.tournament.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }
  // 1. Single elimination, 6 tim -> menguji bye otomatis (bukan power of 2)
  await buatTurnamen(
    "Piala Futsal Merdeka",
    "futsal",
    "single",
    ["Garuda FC", "Elang Timur", "Macan Kemayoran", "Rajawali Muda", "Kancil Biru", "Tanduk Emas"],
    true
  );
  // 2. Double elimination, 4 tim e-sport
  await buatTurnamen(
    "Campus E-Sport Championship",
    "e-sport",
    "double",
    ["Tim Naga", "Tim Phoenix", "Tim Garuda", "Tim Komodo"],
    true
  );
  // 3. Round robin, 5 tim -> menguji pekan bye (ganjil)
  await buatTurnamen(
    "Liga Futsal RT 05",
    "futsal",
    "roundrobin",
    ["Blok A United", "Blok B Star", "Blok C Warrior", "Blok D Legend", "Blok E Knight"],
    true
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
