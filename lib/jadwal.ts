// Helper penjadwalan: waktu sebagai TEXT "YYYY-MM-DD HH:MM" sehingga
// perbandingan string = perbandingan kronologis.

export const WAKTU_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export function tambahMenit(waktu: string, menit: number): string {
  const [tgl, jam] = waktu.split(" ");
  const [y, mo, d] = tgl.split("-").map(Number);
  const [h, mi] = jam.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi + menit);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

export interface SlotJadwal {
  id: number;
  lapangan: string | null;
  mulaiAt: string | null;
  durasiMenit: number;
}

// true bila dua slot jadwal overlap (lapangan sama, interval bersinggungan)
export function isOverlap(a: SlotJadwal, bMulai: string, bDurasi: number): boolean {
  if (!a.lapangan || !a.mulaiAt) return false;
  const bSelesai = tambahMenit(bMulai, bDurasi);
  const aSelesai = tambahMenit(a.mulaiAt, a.durasiMenit);
  return a.mulaiAt < bSelesai && aSelesai > bMulai;
}
