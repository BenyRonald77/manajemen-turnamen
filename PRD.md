# PRD — Manajemen Turnamen Futsal/E-Sport

## Ringkasan
Aplikasi web untuk mengelola turnamen futsal dan e-sport: pendaftaran tim,
pembuatan bracket otomatis (3 format), penjadwalan pertandingan di lapangan,
input skor oleh wasit, klasemen otomatis, dan statistik pemain per pertandingan.

## Stack
Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS.
Tanggal/waktu disimpan sebagai TEXT (`YYYY-MM-DD HH:MM`) — tanpa drama timezone.

## Fungsionalitas

### F0 — Fondasi
Scaffold proyek, schema Prisma, PRD, README.

### F1 — CRUD Turnamen, Tim, Pemain
- Turnamen: nama, jenis (`futsal` | `e-sport`), format (`single` | `double` |
  `roundrobin`), status (`draft` | `berjalan` | `selesai`).
- Tim peserta per turnamen (nama, seed/unggulan). Pemain per tim (nama, nomor).

### F2 — Generate Bracket Otomatis
- **Single elimination (gugur):** jumlah peserta dinamis; bila bukan power of 2,
  unggulan teratas otomatis dapat *bye*. Pemenang tiap pertandingan otomatis
  maju ke babak berikutnya (slot home/away sudah terhubung).
- **Double elimination:** upper bracket seperti single elimination; lower
  bracket menampung tim yang kalah: L1 = para pecundang U1 yang dipasangkan,
  L(k) = pemenang L(k-1) vs pecundang U(k); grand final = juara upper vs juara
  lower.
- **Round robin (setengah kompetisi):** metode circle; tiap pasangan bertemu
  tepat sekali; jumlah peserta ganjil → tiap pekan ada satu tim bye.
- Generate hanya bila turnamen masih `draft`; generate ulang menimpa bracket lama.

### F3 — Penjadwalan Pertandingan
- Setiap pertandingan bisa dijadwalkan: lapangan + waktu mulai + durasi (menit).
- **Validasi bentrok:** tidak boleh ada 2 pertandingan yang interval waktunya
  overlap di lapangan yang sama dalam satu turnamen → `409 Conflict`.

### F4 — Input Skor Wasit + Progresi Bracket + Klasemen
- Wasit menginput skor (kedua tim) → status pertandingan `selesai`.
- Pertandingan gugur **tidak boleh seri** → `400`.
- Pemenang otomatis diteruskan ke slot pertandingan berikutnya (single update
  kondisional yang atomik); di double elimination, tim kalah diteruskan ke
  lower bracket.
- Bila semua pertandingan yang bisa dimainkan selesai → status turnamen
  `selesai` otomatis.
- Klasemen dihitung dari pertandingan selesai: poin (3/1/0), selisih gol,
  gol memasukkan.

### F5 — Statistik Pemain + MVP
- Per pertandingan: gol, kartu kuning, kartu merah per pemain
  (satu baris per pemain per pertandingan, `409` bila duplikat).
- MVP: tepat satu pemain per pertandingan; klaim MVP memakai update
  kondisional atomik → MVP ganda menghasilkan `409`.

### F6 — Halaman UI (Bahasa Indonesia)
- `/` — daftar turnamen + form turnamen baru.
- `/turnamen/[id]` — tab: **Bracket** (visual per kolom babak, polling tiap
  5 detik), **Klasemen**, **Jadwal & Hasil**.
- `/turnamen/[id]/pertandingan/[matchId]` — detail pertandingan, form jadwal
  (wasit), form input skor (wasit), form + daftar statistik pemain & MVP.

### F7 — Seed
Satu turnamen contoh per format: single (6 tim futsal → menguji bye),
double (4 tim e-sport), round robin (5 tim futsal → menguji pekan bye).
Tiap tim punya 5 pemain.

## Aturan Bisnis / Error Codes
| Kode | Kondisi |
|------|---------|
| 400 | Validasi input (field wajib, skor negatif, seri di format gugur, format tidak dikenal) |
| 404 | Turnamen/tim/pemain/pertandingan tidak ditemukan |
| 409 | Bentrok jadwal lapangan; statistik pemain duplikat; MVP sudah diklaim; generate bracket saat turnamen sudah berjalan |

## Batasan Jujur
- "Realtime" diimplementasikan sebagai polling HTTP tiap 5 detik (bukan
  WebSocket/SSE) — jujur dan cukup untuk skala turnamen lokal.
- Double elimination memakai varian standar yang disederhanakan (tanpa
  *bracket reset* di grand final); didokumentasikan di UI.
- Koreksi skor setelah pertandingan selesai: skor boleh diinput ulang, dan
  slot lanjutan hanya ditimpa bila masih berisi pemenang lama atau kosong.
  Bila pemenang berubah setelah babak lanjut dimainkan, admin perlu
  meninjau manual.
- Tidak ada autentikasi/otorisasi peran wasit — semua endpoint wasit terbuka
  (asumsi pemakaian intranet panitia).
