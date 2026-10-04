"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { NAMA_FORMAT, NAMA_JENIS, NAMA_STATUS, formatWaktu } from "@/lib/format";

type Team = { id: number; nama: string; seed: number; players: { id: number; nama: string; nomor: number }[] };
type Turnamen = { id: number; nama: string; jenis: string; format: string; status: string; teams: Team[] };
type Match = {
  id: number; kode: string; babak: string; bracket: string; urutan: number;
  homeTeamId: number | null; awayTeamId: number | null;
  homeNama: string | null; awayNama: string | null;
  homeScore: number | null; awayScore: number | null;
  status: string; isBye: boolean; lapangan: string | null; mulaiAt: string | null;
};
type BarisKlasemen = {
  teamId: number; nama: string; main: number; menang: number; seri: number; kalah: number;
  golMasuk: number; golKebobolan: number; selisihGol: number; poin: number;
};

const TABS = ["Bracket", "Klasemen", "Jadwal & Hasil", "Top Skor"] as const;

function KartuMatch({ m, tid }: { m: Match; tid: number }) {
  const skor = m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "vs";
  return (
    <Link href={`/turnamen/${tid}/pertandingan/${m.id}`}
      className="block w-56 shrink-0 rounded-lg bg-white p-3 shadow hover:ring-2 hover:ring-blue-300">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono">{m.kode}</span>
        <span>{m.isBye ? "Bye" : NAMA_STATUS[m.status] ?? m.status}</span>
      </div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <span className="truncate font-medium">{m.homeNama ?? "TBD"}</span>
          <span className="font-bold">{m.homeScore ?? ""}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="truncate font-medium">{m.awayNama ?? "TBD"}</span>
          <span className="font-bold">{m.awayScore ?? ""}</span>
        </div>
      </div>
      <div className="mt-1 text-center text-xs text-slate-400">{skor === "vs" && !m.isBye ? "belum main" : ""}</div>
      {(m.lapangan || m.mulaiAt) && (
        <div className="mt-1 text-xs text-slate-500">
          {m.lapangan ?? ""}{m.lapangan && m.mulaiAt ? " · " : ""}{formatWaktu(m.mulaiAt)}
        </div>
      )}
    </Link>
  );
}

export default function DetailTurnamen({ params }: { params: { id: string } }) {
  const tid = params.id;
  const [t, setT] = useState<Turnamen | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [klasemen, setKlasemen] = useState<BarisKlasemen[]>([]);
  const [topskor, setTopskor] = useState<{ playerId: number; nama: string; tim: string; gol: number; kuning: number; merah: number }[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Bracket");
  const [err, setErr] = useState("");
  const [namaTim, setNamaTim] = useState("");
  const [pemainBaru, setPemainBaru] = useState<Record<number, string>>({});

  const muatTurnamen = useCallback(() => {
    fetch(`/api/turnamen/${tid}`).then((r) => r.json()).then(setT);
  }, [tid]);
  const muatMatches = useCallback(() => {
    fetch(`/api/turnamen/${tid}/pertandingan`).then((r) => r.json()).then((j) => {
      if (Array.isArray(j)) setMatches(j);
    });
  }, [tid]);

  useEffect(() => {
    muatTurnamen();
    muatMatches();
    fetch(`/api/turnamen/${tid}/klasemen`).then((r) => r.json()).then((j) => {
      if (Array.isArray(j)) setKlasemen(j);
    });
    fetch(`/api/turnamen/${tid}/topskor`).then((r) => r.json()).then((j) => {
      if (Array.isArray(j)) setTopskor(j);
    });
  }, [tid, muatTurnamen, muatMatches]);

  // Polling tiap 5 detik agar bracket & hasil terupdate otomatis
  useEffect(() => {
    if (t?.status !== "berjalan") return;
    const iv = setInterval(() => {
      muatMatches();
      fetch(`/api/turnamen/${tid}/klasemen`).then((r) => r.json()).then((j) => {
        if (Array.isArray(j)) setKlasemen(j);
      });
    }, 5000);
    return () => clearInterval(iv);
  }, [t?.status, tid, muatMatches]);

  if (!t) return <main><p>Memuat...</p></main>;

  const tambahTim = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const r = await fetch(`/api/turnamen/${tid}/peserta`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama: namaTim }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal"); return; }
    setNamaTim("");
    muatTurnamen();
  };

  const tambahPemain = async (teamId: number) => {
    const nama = (pemainBaru[teamId] ?? "").trim();
    if (!nama) return;
    setErr("");
    const r = await fetch(`/api/tim/${teamId}/pemain`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal"); return; }
    setPemainBaru((p) => ({ ...p, [teamId]: "" }));
    muatTurnamen();
  };

  const generate = async () => {
    setErr("");
    const r = await fetch(`/api/turnamen/${tid}/generate-bracket`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal generate"); return; }
    muatTurnamen();
    muatMatches();
  };

  // Kelompokkan pertandingan per babak, urut kolom
  const babakOrder: string[] = [];
  for (const m of matches) if (!babakOrder.includes(m.babak)) babakOrder.push(m.babak);

  return (
    <main>
      <Link href="/" className="text-sm text-blue-600 hover:underline">← Daftar turnamen</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t.nama}</h1>
        <span className="rounded bg-slate-200 px-2 py-0.5 text-sm">{NAMA_STATUS[t.status]}</span>
      </div>
      <p className="text-slate-500">{NAMA_JENIS[t.jenis]} · {NAMA_FORMAT[t.format]} · {t.teams.length} tim</p>
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{err}</p>}

      {t.status === "draft" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Tim Peserta</h2>
            <form onSubmit={tambahTim} className="mt-2 flex gap-2">
              <input className="flex-1 rounded border px-3 py-2" placeholder="Nama tim"
                value={namaTim} onChange={(e) => setNamaTim(e.target.value)} />
              <button className="rounded bg-blue-600 px-4 py-2 text-white">Tambah</button>
            </form>
            <ul className="mt-3 space-y-3">
              {t.teams.map((team) => (
                <li key={team.id} className="rounded border p-3">
                  <div className="font-medium">{team.nama} <span className="text-xs text-slate-400">seed {team.seed}</span></div>
                  <ul className="mt-1 text-sm text-slate-600">
                    {team.players.map((p) => (
                      <li key={p.id}>{p.nomor ? `#${p.nomor} ` : ""}{p.nama}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input className="flex-1 rounded border px-2 py-1 text-sm" placeholder="Nama pemain"
                      value={pemainBaru[team.id] ?? ""}
                      onChange={(e) => setPemainBaru((prev) => ({ ...prev, [team.id]: e.target.value }))} />
                    <button onClick={() => tambahPemain(team.id)}
                      className="rounded bg-slate-200 px-3 py-1 text-sm">+ Pemain</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Generate Bracket</h2>
            <p className="mt-1 text-sm text-slate-500">
              {t.format === "single" && "Single elimination: unggulan teratas otomatis dapat bye bila jumlah tim bukan power of 2."}
              {t.format === "double" && "Double elimination: tim yang kalah masuk lower bracket."}
              {t.format === "roundrobin" && "Round robin: setiap tim bertemu satu sama lain (setengah kompetisi)."}
            </p>
            <button onClick={generate} disabled={t.teams.length < 2}
              className="mt-3 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-40">
              Generate Bracket &amp; Mulai Turnamen
            </button>
            {t.teams.length < 2 && <p className="mt-1 text-sm text-slate-400">Minimal 2 tim.</p>}
          </div>
        </div>
      )}

      {t.status !== "draft" && (
        <div className="mt-6">
          <div className="flex gap-2 border-b">
            {TABS.map((x) => (
              <button key={x} onClick={() => setTab(x)}
                className={`px-4 py-2 text-sm font-medium ${tab === x ? "border-b-2 border-blue-600 text-blue-700" : "text-slate-500"}`}>
                {x}
              </button>
            ))}
          </div>

          {tab === "Bracket" && (
            <div className="mt-4 overflow-x-auto pb-4">
              <div className="flex gap-6">
                {babakOrder.map((b) => (
                  <div key={b}>
                    <h3 className="mb-2 text-center text-sm font-semibold">{b}</h3>
                    <div className="space-y-3">
                      {matches.filter((m) => m.babak === b).map((m) => (
                        <KartuMatch key={m.id} m={m} tid={t.id} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {matches.length === 0 && <p className="text-slate-500">Belum ada pertandingan.</p>}
            </div>
          )}

          {tab === "Klasemen" && (
            <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50 text-left">
                  {["#", "Tim", "M", "Mg", "S", "K", "GM", "GK", "+/-", "Poin"].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {klasemen.map((k, i) => (
                    <tr key={k.teamId} className="border-b">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{k.nama}</td>
                      <td className="px-3 py-2">{k.main}</td>
                      <td className="px-3 py-2">{k.menang}</td>
                      <td className="px-3 py-2">{k.seri}</td>
                      <td className="px-3 py-2">{k.kalah}</td>
                      <td className="px-3 py-2">{k.golMasuk}</td>
                      <td className="px-3 py-2">{k.golKebobolan}</td>
                      <td className="px-3 py-2">{k.selisihGol > 0 ? `+${k.selisihGol}` : k.selisihGol}</td>
                      <td className="px-3 py-2 font-bold">{k.poin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Jadwal & Hasil" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matches.filter((m) => !m.isBye).map((m) => (
                <KartuMatch key={m.id} m={m} tid={t.id} />
              ))}
            </div>
          )}

          {tab === "Top Skor" && (
            <div className="mt-4 overflow-x-auto rounded-lg bg-white shadow">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-slate-50 text-left">
                  {["#", "Pemain", "Tim", "Gol", "KK", "KM"].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {topskor.map((p, i) => (
                    <tr key={p.playerId} className="border-b">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{p.nama}</td>
                      <td className="px-3 py-2">{p.tim}</td>
                      <td className="px-3 py-2 font-bold">{p.gol}</td>
                      <td className="px-3 py-2">{p.kuning}</td>
                      <td className="px-3 py-2">{p.merah}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topskor.length === 0 && <p className="p-4 text-slate-500">Belum ada statistik gol.</p>}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
