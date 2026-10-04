export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
export const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
    2,
    "0"
  )}`;
};
export const formatWaktu = (s: string | null | undefined) => {
  if (!s) return "-";
  const [tgl, jam] = s.split(" ");
  if (!tgl) return s;
  const [y, m, d] = tgl.split("-");
  return `${d}/${m}/${y}${jam ? " " + jam : ""}`;
};
export const NAMA_JENIS: Record<string, string> = {
  futsal: "Futsal",
  "e-sport": "E-Sport",
};
export const NAMA_FORMAT: Record<string, string> = {
  single: "Single Elimination",
  double: "Double Elimination",
  roundrobin: "Round Robin",
};
export const NAMA_STATUS: Record<string, string> = {
  draft: "Draft",
  berjalan: "Berjalan",
  selesai: "Selesai",
  terjadwal: "Terjadwal",
};
