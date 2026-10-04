// Logika generate bracket otomatis: single elimination, double elimination,
// round robin. Semua murni fungsi tanpa akses DB — hasilnya MatchSpec yang
// kemudian dibuat di database sesuai urutan `order` (induk dulu, agar
// nextMatchId sudah tersedia).

export type SlotFeed =
  | { kind: "team"; teamId: number }
  | { kind: "winner"; key: string }
  | { kind: "loser"; key: string };

export interface MatchSpec {
  key: string;
  kode: string;
  babak: string;
  bracket: "main" | "upper" | "lower" | "roundrobin";
  home: SlotFeed | null;
  away: SlotFeed | null;
  nextKey: string | null;
  nextSlot: "home" | "away" | null;
  loserNextKey: string | null;
  loserSlot: "home" | "away" | null;
  roundIdx: number; // urutan babak (untuk propagasi bye)
  order: number; // urutan pembuatan di DB (induk dulu)
}

export interface TeamSeed {
  id: number;
  seed: number;
}

const nextPow2 = (n: number) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

const namaBabakEliminasi = (matchCount: number, dariAkhir: number): string => {
  if (dariAkhir === 0) return "Final";
  if (dariAkhir === 1) return "Semifinal";
  if (dariAkhir === 2) return "Perempat Final";
  return `Babak ${matchCount * 2} Besar`;
};

// Pasangan ronde pertama single elimination dengan bye untuk unggulan teratas:
// seed 1 vs seed terakhir, dst. Bila bukan power of 2, slot kosong (null) = bye.
function pasanganRondePertama(teams: TeamSeed[]): (TeamSeed | null)[][] {
  const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.id - b.id);
  const size = nextPow2(sorted.length);
  const slots: (TeamSeed | null)[] = [...sorted];
  while (slots.length < size) slots.push(null);
  const pairs: (TeamSeed | null)[][] = [];
  for (let i = 0; i < size / 2; i++) {
    pairs.push([slots[i], slots[size - 1 - i]]);
  }
  return pairs;
}

const feedTeam = (t: TeamSeed | null): SlotFeed | null =>
  t ? { kind: "team", teamId: t.id } : null;

interface Built {
  specs: MatchSpec[];
  // peta key -> { home: teamId|null, away: teamId|null } setelah propagasi bye
  slots: Map<string, { home: number | null; away: number | null }>;
}

// Bangun struktur single elimination; mengembalikan specs + slot ter-resolved.
function buildSingle(
  teams: TeamSeed[],
  opt: { bracket: "main" | "upper"; prefix: string; roundOffset: number; orderStart: number }
): Built {
  const specs: MatchSpec[] = [];
  const pairs = pasanganRondePertama(teams);
  // rounds[r][i] = key
  const rounds: string[][] = [];
  let order = opt.orderStart;

  const roundKeys: string[][] = [];
  let current = pairs.length;
  let r = 0;
  // buat key per ronde dari ronde pertama sampai final
  const totalRounds = Math.log2(nextPow2(teams.length));
  for (let ri = 0; ri < totalRounds; ri++) {
    const keys: string[] = [];
    for (let i = 0; i < current; i++) keys.push(`${opt.prefix}-r${ri}-m${i}`);
    roundKeys.push(keys);
    current = current / 2;
    r++;
  }

  for (let ri = 0; ri < roundKeys.length; ri++) {
    const keys = roundKeys[ri];
    const dariAkhir = roundKeys.length - 1 - ri;
    const babak = namaBabakEliminasi(keys.length, dariAkhir);
    keys.forEach((key, i) => {
      const isLast = ri === roundKeys.length - 1;
      const nextKey = isLast ? null : roundKeys[ri + 1][Math.floor(i / 2)];
      specs.push({
        key,
        kode: `${opt.prefix.toUpperCase()}${ri + 1}-M${i + 1}`,
        babak: opt.bracket === "upper" ? `Upper · ${babak}` : babak,
        bracket: opt.bracket,
        home: ri === 0 ? feedTeam(pairs[i][0]) : { kind: "winner", key: roundKeys[ri - 1][i * 2] },
        away: ri === 0 ? feedTeam(pairs[i][1]) : { kind: "winner", key: roundKeys[ri - 1][i * 2 + 1] },
        nextKey,
        nextSlot: isLast ? null : i % 2 === 0 ? "home" : "away",
        loserNextKey: null,
        loserSlot: null,
        roundIdx: opt.roundOffset + ri,
        order: 0, // diisi belakangan (dibuat dari final mundur)
      });
    });
  }

  // order: final dulu, mundur ke ronde pertama
  const orderedKeys = [...roundKeys].reverse().flat();
  orderedKeys.forEach((key, idx) => {
    specs.find((s) => s.key === key)!.order = order + idx;
  });

  const slots = propagateByes(specs);
  return { specs, slots };
}

// Propagasi bye: pertandingan yang hanya punya satu tim (lawan null) otomatis
// meloloskan tim itu ke slot pertandingan berikutnya. Mengembalikan slot akhir.
function propagateByes(specs: MatchSpec[]): Map<string, { home: number | null; away: number | null }> {
  const slots = new Map<string, { home: number | null; away: number | null }>();
  for (const s of specs) {
    slots.set(s.key, {
      home: s.home?.kind === "team" ? s.home.teamId : null,
      away: s.away?.kind === "team" ? s.away.teamId : null,
    });
  }
  const byRound = [...specs].sort((a, b) => a.roundIdx - b.roundIdx);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const s of byRound) {
      const v = slots.get(s.key)!;
      const exactlyOne = (v.home === null) !== (v.away === null);
      if (exactlyOne && s.nextKey && s.nextSlot) {
        const teamId = v.home ?? v.away!;
        const target = slots.get(s.nextKey)!;
        if (target[s.nextSlot] === null) {
          target[s.nextSlot] = teamId;
          changed = true;
        }
      }
    }
  }
  return slots;
}

function buildDouble(teams: TeamSeed[]): Built {
  // Upper bracket
  const upper = buildSingle(teams, { bracket: "upper", prefix: "ub", roundOffset: 0, orderStart: 0 });
  const specs: MatchSpec[] = [...upper.specs];
  let order = Math.max(...specs.map((s) => s.order)) + 1;

  // Kumpulkan key per ronde upper: r1..rR
  const upperRounds: string[][] = [];
  {
    const byRound = new Map<number, string[]>();
    for (const s of upper.specs) {
      const arr = byRound.get(s.roundIdx) ?? [];
      arr.push(s.key);
      byRound.set(s.roundIdx, arr);
    }
    [...byRound.keys()].sort((a, b) => a - b).forEach((k) => upperRounds.push(byRound.get(k)!));
  }
  const R = upperRounds.length;
  const upperFinalKey = upperRounds[R - 1][0];

  // Lower bracket: L1 = pecundang U1 dipasangkan;
  // Lk = pemenang L(k-1) + pecundang Uk; ronde terakhir lower juga menampung
  // pecundang final upper. Bye (ganjil) lolos otomatis ke ronde lower berikut.
  const lowerRounds: string[][] = [];
  let pending: SlotFeed[] = [];
  // L1: semua pecundang U1
  for (const key of upperRounds[0]) pending.push({ kind: "loser", key });
  let roundIdx = R; // setelah semua ronde upper
  let lr = 1;
  let guard = 0;
  while (pending.length > 1 && guard++ < 2 * R + 5) {
    // buang feed loser yang berasal dari bye upper (tidak ada tim kalah)
    const feeds = pending.filter((f) => {
      if (f.kind !== "loser") return true;
      const v = upper.slots.get(f.key)!;
      return v.home !== null && v.away !== null;
    });
    const keys: string[] = [];
    const n = feeds.length;
    const matchCount = Math.ceil(n / 2);
    for (let i = 0; i < matchCount; i++) {
      const key = `lb-r${lr}-m${i}`;
      keys.push(key);
      const home = feeds[i * 2] ?? null;
      const away = feeds[i * 2 + 1] ?? null;
      specs.push({
        key,
        kode: `LB${lr}-M${i + 1}`,
        babak: `Lower Ronde ${lr}`,
        bracket: "lower",
        home,
        away,
        nextKey: null, // diisi setelah ronde berikut terbentuk
        nextSlot: null,
        loserNextKey: null,
        loserSlot: null,
        roundIdx: roundIdx++,
        order: 0,
      });
    }
    lowerRounds.push(keys);
    // siapkan pending ronde berikut: pemenang Lk + pecundang U(k+1)
    pending = keys.map((key) => ({ kind: "winner", key }) as SlotFeed);
    const uk = upperRounds[lr]; // lr=1 -> U2, dst.
    if (uk) for (const key of uk) pending.push({ kind: "loser", key });
    lr++;
  }

  // Hubungkan antar ronde lower (pemenang maju) — dari ronde terakhir mundur
  for (let i = lowerRounds.length - 1; i >= 0; i--) {
    const keys = lowerRounds[i];
    const nextKeys = i + 1 < lowerRounds.length ? lowerRounds[i + 1] : null;
    keys.forEach((key, mi) => {
      const s = specs.find((x) => x.key === key)!;
      if (nextKeys) {
        const nk = nextKeys[Math.floor(mi / 2)];
        s.nextKey = nk;
        s.nextSlot = mi % 2 === 0 ? "home" : "away";
      }
    });
  }
  const lastLowerKeys = lowerRounds[lowerRounds.length - 1];

  // Grand final: juara upper vs juara lower
  const gfKey = "gf";
  specs.push({
    key: gfKey,
    kode: "GF",
    babak: "Grand Final",
    bracket: "main",
    home: { kind: "winner", key: upperFinalKey },
    away: lastLowerKeys ? { kind: "winner", key: lastLowerKeys[0] } : null,
    nextKey: null,
    nextSlot: null,
    loserNextKey: null,
    loserSlot: null,
    roundIdx: roundIdx++,
    order: 0,
  });

  // Pemenang final upper -> GF (slot home); pecundang final upper sudah masuk
  // lower via pending loop di atas (uk terakhir). Tandai eksplisit:
  const uf = specs.find((s) => s.key === upperFinalKey)!;
  uf.nextKey = gfKey;
  uf.nextSlot = "home";
  if (lastLowerKeys) {
    for (const key of lastLowerKeys) {
      const s = specs.find((x) => x.key === key)!;
      s.nextKey = gfKey;
      s.nextSlot = "away";
    }
  }

  // loserNextKey untuk tiap pertandingan upper -> pertandingan lower yang
  // menampung pecundangnya. Cari lower match yang feed loser-nya dari key ini.
  for (const s of specs) {
    if (s.bracket !== "upper") continue;
    const target = specs.find(
      (x) =>
        x.bracket === "lower" &&
        ((x.home?.kind === "loser" && x.home.key === s.key) ||
          (x.away?.kind === "loser" && x.away.key === s.key))
    );
    if (target) {
      s.loserNextKey = target.key;
      s.loserSlot = target.home?.kind === "loser" && target.home.key === s.key ? "home" : "away";
    }
  }

  // order pembuatan: GF dulu, lalu lower mundur, lalu upper (upper sudah punya order)
  const lowerOrdered = [...lowerRounds].reverse().flat();
  lowerOrdered.forEach((key, idx) => {
    specs.find((s) => s.key === key)!.order = order + idx;
  });
  specs.find((s) => s.key === gfKey)!.order =
    order + lowerOrdered.length;

  const slots = propagateByes(specs);
  return { specs, slots };
}

function buildRoundRobin(teams: TeamSeed[]): Built {
  const specs: MatchSpec[] = [];
  const arr: (TeamSeed | null)[] = [...teams].sort((a, b) => a.seed - b.seed || a.id - b.id);
  if (arr.length % 2 === 1) arr.push(null); // bye
  const n = arr.length;
  const totalRounds = n - 1;
  let order = 0;
  const line = [...arr];
  for (let r = 0; r < totalRounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      let home = line[i];
      let away = line[n - 1 - i];
      if (r % 2 === 1) [home, away] = [away, home]; // adil kandang-tandang
      if (!home || !away) continue; // pekan bye
      specs.push({
        key: `rr-p${r + 1}-m${i}`,
        kode: `P${r + 1}-M${i + 1}`,
        babak: `Pekan ${r + 1}`,
        bracket: "roundrobin",
        home: feedTeam(home),
        away: feedTeam(away),
        nextKey: null,
        nextSlot: null,
        loserNextKey: null,
        loserSlot: null,
        roundIdx: r,
        order: order++,
      });
    }
    // rotasi circle method
    line.splice(1, 0, line.pop()!);
  }
  const slots = propagateByes(specs);
  return { specs, slots };
}

export function buildBracket(format: string, teams: TeamSeed[]): Built {
  if (teams.length < 2) throw new Error("Minimal 2 tim untuk generate bracket");
  if (format === "single") return buildSingle(teams, { bracket: "main", prefix: "m", roundOffset: 0, orderStart: 0 });
  if (format === "double") {
    if (teams.length < 2) throw new Error("Minimal 2 tim untuk double elimination");
    return buildDouble(teams);
  }
  if (format === "roundrobin") return buildRoundRobin(teams);
  throw new Error("Format tidak dikenal");
}
