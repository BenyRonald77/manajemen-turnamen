"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NAMA_FORMAT, NAMA_JENIS, NAMA_STATUS } from "@/lib/format";

type Turnamen = {
  id: number;
  nama: string;
  jenis: string;
  format: string;
  status: string;
  _count: { teams: number; matches: number };
};

export default function Home() {
  const [list, setList] = useState<Turnamen[]>([]);
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState("futsal");
  const [format, setFormat] = useState("single");
  const [err, setErr] = useState("");

  const muat = () => fetch("/api/turnamen").then((r) => r.json()).then(setList);
  useEffect(() => { muat(); }, []);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/turnamen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nama, jenis, format }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Gagal menyimpan"); return; }
    setNama("");
    muat();
  };

  return (
    <main>
      <h1 className="text-2xl font-bold">Manajemen Turnamen</h1>
      <p className="text-slate-500">Kelola turnamen futsal &amp; e-sport: bracket, jadwal, skor, klasemen.</p>

      <form onSubmit={simpan} className="mt-6 rounded-lg bg-white p-4 shadow">
        <h2 className="font-semibold">Turnamen Baru</h2>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <input className="rounded border px-3 py-2 sm:col-span-2" placeholder="Nama turnamen"
            value={nama} onChange={(e) => setNama(e.target.value)} />
          <select className="rounded border px-3 py-2" value={jenis} onChange={(e) => setJenis(e.target.value)}>
            <option value="futsal">Futsal</option>
            <option value="e-sport">E-Sport</option>
          </select>
          <select className="rounded border px-3 py-2" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="single">Single Elimination</option>
            <option value="double">Double Elimination</option>
            <option value="roundrobin">Round Robin</option>
          </select>
        </div>
        <button className="mt-3 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Buat Turnamen
        </button>
      </form>

      <h2 className="mt-8 font-semibold">Daftar Turnamen</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <Link key={t.id} href={`/turnamen/${t.id}`}
            className="rounded-lg bg-white p-4 shadow hover:ring-2 hover:ring-blue-300">
            <div className="font-semibold">{t.nama}</div>
            <div className="mt-1 text-sm text-slate-500">
              {NAMA_JENIS[t.jenis]} · {NAMA_FORMAT[t.format]}
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="rounded bg-slate-100 px-2 py-0.5">{NAMA_STATUS[t.status]}</span>
              <span className="text-slate-500">{t._count.teams} tim · {t._count.matches} pertandingan</span>
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 && <p className="mt-3 text-slate-500">Belum ada turnamen.</p>}
    </main>
  );
}
