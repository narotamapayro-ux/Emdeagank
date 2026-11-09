MDA UNIVERSE — STARTER BUILD 0.1

ISI ZIP
- index.html       Tampilan website
- style.css        Desain responsif
- app.js           Login, profil, teman, chat, puzzle, tap race
- config.js        Tempat Project URL dan Publishable/anon key
- supabase_schema.sql  Struktur tabel + aturan akses (RLS)

CARA MENJALANKAN
1. Ekstrak ZIP.
2. Buka config.js menggunakan editor teks.
3. Ganti PASTE_PROJECT_URL_HERE dengan Project URL Supabase.
4. Ganti PASTE_PUBLISHABLE_OR_ANON_KEY_HERE dengan Publishable key (atau anon key lama).
   Jangan pernah memakai service_role key.
5. Buka Supabase > SQL Editor, tempel isi supabase_schema.sql, lalu Run.
6. Di Supabase > Authentication > URL Configuration, tambahkan URL website saat sudah di-host.
7. Upload semua file dan folder ke repository GitHub. Aktifkan GitHub Pages dari Settings > Pages.
8. Buka alamat GitHub Pages website.

CATATAN PENTING
- Ini starter website yang bisa dikembangkan, bukan produk final.
- Puzzle dan Tap Race sudah bisa dimainkan offline.
- Login, profil, pertemanan, dan chat memerlukan Supabase yang dikonfigurasi dengan benar dan SQL dijalankan.
- Status online menggunakan Supabase Presence; tampilan status online teman belum ditambahkan pada build ini.
- Game online/multiplayer, notifikasi, pemulihan password, moderasi, dan keamanan lanjutan belum termasuk.
- Email confirmation dapat membuat pengguna perlu membuka email sebelum bisa masuk.
- Untuk pengujian lokal, jalankan melalui server lokal (contoh VS Code Live Server), jangan membuka index.html langsung.
