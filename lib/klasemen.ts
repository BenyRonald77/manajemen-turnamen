export interface BarisKlasemen {
  teamId: number;
  nama: string;
  main: number;
  menang: number;
  seri: number;
  kalah: number;
  golMasuk: number;
  golKebobolan: number;
  selisihGol: number;
  poin: number;
}

export function hitungKlasemen(
  teams: { id: number; nama: string }[],
  matches: {
    homeTeamId: number | null;
    awayTeamId: number | null;
    homeScore: number | null;
    awayScore: number | null;
  }[]
): BarisKlasemen[] {
  const map = new Map<number, BarisKlasemen>();
  for (const t of teams)
    map.set(t.id, {
      teamId: t.id,
      nama: t.nama,
      main: 0,
      menang: 0,
      seri: 0,
      kalah: 0,
      golMasuk: 0,
      golKebobolan: 0,
      selisihGol: 0,
      poin: 0,
    });
  for (const m of matches) {
    if (m.homeTeamId === null || m.awayTeamId === null) continue;
    if (m.homeScore === null || m.awayScore === null) continue;
    const h = map.get(m.homeTeamId);
    const a = map.get(m.awayTeamId);
    if (!h || !a) continue;
    h.main++;
    a.main++;
    h.golMasuk += m.homeScore;
    h.golKebobolan += m.awayScore;
    a.golMasuk += m.awayScore;
    a.golKebobolan += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.menang++;
      h.poin += 3;
      a.kalah++;
    } else if (m.awayScore > m.homeScore) {
      a.menang++;
      a.poin += 3;
      h.kalah++;
    } else {
      h.seri++;
      a.seri++;
      h.poin++;
      a.poin++;
    }
  }
  const rows = [...map.values()];
  for (const r of rows) r.selisihGol = r.golMasuk - r.golKebobolan;
  rows.sort(
    (x, y) =>
      y.poin - x.poin ||
      y.selisihGol - x.selisihGol ||
      y.golMasuk - x.golMasuk ||
      x.nama.localeCompare(y.nama)
  );
  return rows;
}
