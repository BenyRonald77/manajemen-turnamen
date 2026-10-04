# Manajemen Turnamen Futsal/E-Sport

Kelola turnamen futsal & e-sport: pendaftaran tim, bracket otomatis
(single/double elimination, round robin), penjadwalan lapangan anti-bentrok,
input skor wasit, klasemen otomatis, dan statistik pemain + MVP.

## Cara Menjalankan

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## Halaman

- `/` — daftar turnamen + form turnamen baru, tambah tim & pemain.
- `/turnamen/[id]` — tab **Bracket** (visual per kolom babak, refresh otomatis
  tiap 5 detik), **Klasemen** (poin, selisih gol), **Jadwal & Hasil**.
- `/turnamen/[id]/pertandingan/[matchId]` — detail pertandingan: jadwalkan
  lapangan + waktu (wasit), input skor (wasit), catat statistik pemain & MVP.

## API

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET/POST | `/api/turnamen` | Daftar / buat turnamen |
| GET/PUT/DELETE | `/api/turnamen/[id]` | Detail / ubah / hapus |
| POST | `/api/turnamen/[id]/peserta` | Tambah tim |
| POST | `/api/tim/[id]/pemain` | Tambah pemain ke tim |
| POST | `/api/turnamen/[id]/generate-bracket` | Generate bracket otomatis |
| GET | `/api/turnamen/[id]/pertandingan` | Daftar pertandingan |
| GET | `/api/turnamen/[id]/klasemen` | Klasemen |
| GET/PATCH | `/api/pertandingan/[id]` | Detail / jadwalkan (validasi bentrok → 409) |
| POST | `/api/pertandingan/[id]/skor` | Input skor wasit (progresi bracket otomatis) |
| GET/POST | `/api/pertandingan/[id]/statistik` | Daftar / catat statistik pemain (MVP ganda → 409) |

## Aturan Bisnis

- Bracket elimination: bukan power of 2 → unggulan teratas dapat bye otomatis.
- Jadwal: 2 pertandingan tidak boleh overlap di lapangan yang sama (409).
- Skor: pertandingan gugur tidak boleh seri (400).
- MVP: tepat satu per pertandingan (409 bila sudah diklaim).
- "Realtime" = polling tiap 5 detik (tanpa WebSocket).
