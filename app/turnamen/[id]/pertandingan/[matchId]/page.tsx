"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatWaktu } from "@/lib/format";

type StatRow = {
  id: number; gol: number; kuning: number; merah: number;
  player: { id: number; nama: string; team: { id: number; nama: string } };
};
type MatchDetail = {
  id: number; kode: string; babak: string; bracket: string; tournamentId: number;
  homeTeamId: number | null; awayTeamId: number | null;
  homeNama: string | null; awayNama: string | null;
  homeScore: number | null; awayScore: number | null;
  status: string; isBye: boolean; lapangan: string | null; mulaiAt: string | null;
  durasiMenit: number;
  stats: StatRow[];
  mvp: { id: number; nama: string; team: { nama: string } } | null;
};
type Team = { id: number; nama: string; players: { id: number; nama: string; nomor: number }[] };

export default function DetailPertandingan({ params }: { params: { id: string; matchId: string } }) {
  const tid = params.id;
  const mid = params.matchId;
  const [m, setM] = useState<MatchDetail | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [lapangan, setLapangan] = useState("");
  const [mulaiAt, setMulaiAt] = useState("");
  const [durasi, setDurasi] = useState("60");
  const [hs, setHs] = useState("");
  const [aws, setAws] = useState("");
  const [pemainId, setPemainId] = useState("");
  const [gol, setGol] = useState("0");
  const [kuning, setKuning] = useState("0");
  const [merah, setMerah] = useState("0");
  const [isMvp, setIsMvp] = useState(false);

  const muat = useCallback(() => {
    fetch(`/api/pertandingan/${mid}`).then((r) => r.json()).then((j) => {
      setM(j);
      if (j.lapangan) setLapangan(j.lapangan);
      if (j.mulaiAt) setMulaiAt(j.mulaiAt.replace(" ", "T"));
      if (j.durasiMenit) setDurasi(String(j.durasiMenit));
      if (j.homeScore !== null && j.homeScore !== undefined) setHs(String(j.homeScore));
      if (j.awayScore !== null && j.awayScore !== undefined) setAws(String(j.awayScore));
    });
    fetch(`/api/turnamen/${tid}/peserta`).then((r) => r.json()).then((j) => {
      if (Array.isArray(j)) setTeams(j);
    });
  }, [tid, mid]);
  useEffect(() => { muat(); }, [muat]);

  if (!m) return <main><p>Memuat...</p></main>;

  const timBertanding = teams.filter((t) => t.id === m.homeTeamId || t.id === m.awayTeamId);
  const semuaPemain = timBertanding.flatMap((t) => t.players.map((p) => ({ ...p, timNama: t.nama })));

  const keBackend = (v: string) => v.replace("T", " ");

  const simpanJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    const r = await fetch(`/api/pertandingan/${mid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lapangan, mulaiAt: keBackend(mulaiAt), durasiMenit: Number(durasi) }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal"); return; }
    setOk("Jadwal tersimpan.");
    muat();
  };

  const simpanSkor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    const r = await fetch(`/api/pertandingan/${mid}/skor`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeScore: Number(hs), awayScore: Number(aws) }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal"); return; }
    setOk("Skor tersimpan, bracket terupdate.");
    muat();
  };

  const simpanStatistik = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    const r = await fetch(`/api/pertandingan/${mid}/statistik`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: Number(pemainId), gol: Number(gol), kuning: Number(kuning),
        merah: Number(merah), mvp: isMvp,
      }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal"); return; }
    setOk("Statistik tersimpan.");
    setPemainId(""); setGol("0"); setKuning("0"); setMerah("0"); setIsMvp(false);
    muat();
  };

  return (
    <main>
      <Link href={`/turnamen/${tid}`} className="text-sm text-blue-600 hover:underline">← Kembali ke turnamen</Link>
      <h1 className="mt-2 text-2xl font-bold">{m.kode} · {m.babak}</h1>
      <p className="text-slate-500">{m.homeNama ?? "TBD"} vs {m.awayNama ?? "TBD"}</p>
      {m.isBye && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-700">Pertandingan bye — tim lolos otomatis.</p>}
      {err && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{err}</p>}
      {ok && <p className="mt-2 rounded bg-green-50 p-2 text-sm text-green-700">{ok}</p>}

      <div className="mt-4 text-center text-4xl font-bold">
        {m.homeScore ?? "-"} : {m.awayScore ?? "-"}
      </div>
      <p className="mt-1 text-center text-sm text-slate-500">
        {m.lapangan ? `${m.lapangan} · ` : ""}{formatWaktu(m.mulaiAt)} · {m.durasiMenit} mnt · {m.status}
      </p>
      {m.mvp && (
        <p className="mt-2 text-center text-sm">⭐ MVP: <b>{m.mvp.nama}</b> ({m.mvp.team.nama})</p>
      )}

      {!m.isBye && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <form onSubmit={simpanJadwal} className="rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Jadwalkan (Wasit)</h2>
            <label className="mt-2 block text-sm">Lapangan
              <input className="mt-1 w-full rounded border px-3 py-2" value={lapangan}
                onChange={(e) => setLapangan(e.target.value)} placeholder="Lapangan A" /></label>
            <label className="mt-2 block text-sm">Waktu mulai
              <input type="datetime-local" className="mt-1 w-full rounded border px-3 py-2" value={mulaiAt}
                onChange={(e) => setMulaiAt(e.target.value)} /></label>
            <label className="mt-2 block text-sm">Durasi (menit)
              <input type="number" min={1} className="mt-1 w-full rounded border px-3 py-2" value={durasi}
                onChange={(e) => setDurasi(e.target.value)} /></label>
            <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-white">Simpan Jadwal</button>
          </form>

          <form onSubmit={simpanSkor} className="rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Input Skor (Wasit)</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-sm">{m.homeNama ?? "Home"}
                <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={hs}
                  onChange={(e) => setHs(e.target.value)} /></label>
              <label className="text-sm">{m.awayNama ?? "Away"}
                <input type="number" min={0} className="mt-1 w-full rounded border px-3 py-2" value={aws}
                  onChange={(e) => setAws(e.target.value)} /></label>
            </div>
            <button className="mt-3 rounded bg-green-600 px-4 py-2 text-white">Simpan Skor</button>
          </form>

          <form onSubmit={simpanStatistik} className="rounded-lg bg-white p-4 shadow">
            <h2 className="font-semibold">Statistik Pemain</h2>
            <label className="mt-2 block text-sm">Pemain
              <select className="mt-1 w-full rounded border px-3 py-2" value={pemainId}
                onChange={(e) => setPemainId(e.target.value)}>
                <option value="">— pilih —</option>
                {semuaPemain.map((p) => (
                  <option key={p.id} value={p.id}>{p.nama} ({p.timNama})</option>
                ))}
              </select></label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="text-sm">Gol
                <input type="number" min={0} className="mt-1 w-full rounded border px-2 py-2" value={gol}
                  onChange={(e) => setGol(e.target.value)} /></label>
              <label className="text-sm">K. Kuning
                <input type="number" min={0} className="mt-1 w-full rounded border px-2 py-2" value={kuning}
                  onChange={(e) => setKuning(e.target.value)} /></label>
              <label className="text-sm">K. Merah
                <input type="number" min={0} className="mt-1 w-full rounded border px-2 py-2" value={merah}
                  onChange={(e) => setMerah(e.target.value)} /></label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isMvp} onChange={(e) => setIsMvp(e.target.checked)} />
              Jadikan MVP pertandingan
            </label>
            <button className="mt-3 rounded bg-purple-600 px-4 py-2 text-white">Catat Statistik</button>
          </form>
        </div>
      )}

      <h2 className="mt-6 font-semibold">Statistik Pertandingan</h2>
      <div className="mt-2 overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50 text-left">
            {["Pemain", "Tim", "Gol", "K. Kuning", "K. Merah"].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {m.stats.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="px-3 py-2 font-medium">{s.player.nama}</td>
                <td className="px-3 py-2">{s.player.team.nama}</td>
                <td className="px-3 py-2">{s.gol}</td>
                <td className="px-3 py-2">{s.kuning}</td>
                <td className="px-3 py-2">{s.merah}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.stats.length === 0 && <p className="p-4 text-slate-500">Belum ada statistik.</p>}
      </div>
    </main>
  );
}
