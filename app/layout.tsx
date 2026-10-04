import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Manajemen Turnamen",
  description: "Kelola turnamen futsal & e-sport: bracket otomatis, jadwal, skor wasit, klasemen.",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
