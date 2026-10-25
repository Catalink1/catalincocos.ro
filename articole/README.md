# Articole — draft-uri, gata de import în admin

Fiecare articol are propriul folder, numerotat în ordine cronologică, cu slug-ul în nume — `articole/NN-slug-articol/`. Articolele pilon au și `PILON` în nume, ca să se găsească rapid (ex. `01-PILON-...`). Numărul și eticheta din numele folderului sunt doar pentru orientare — la import contează doar `title:`/`slug` din frontmatter, nu numele folderului sau al fișierului. În folder: `slug-articol.md` — fișierul .md numit după slug-ul real al articolului (nu generic `articol.md`), ca să fie căutabil după nume când sunt multe — în formatul din [`admin/TEMPLATE-articol.md`](../admin/TEMPLATE-articol.md) — + pozele lui, dacă are.

Pentru publicare: deschizi `admin/import-md.php` din panoul de admin, alegi „Alege un folder întreg" și selectezi direct folderul articolului — `.md`-ul și pozele se încarcă împreună.

Aceste foldere sunt drafturi de lucru, nu fac parte din site-ul public livrat (nu sunt legate din `index.html`/`blog.html`).

Folderele `01`–`03` sunt **oglinda unui articol deja publicat** (reconstruit din `data/blog.json`, ca sursă editabilă); `04` e un draft nepublicat. Corpul celor reconstruite e HTML brut, exact cum e stocat pe site — la un re-import prin `import-md.php` se reproduce identic (singura diferență: spații între taguri, invizibile în browser). `seo_title`/`focus_keyphrase`/`keywords` sunt goale pentru că nu erau salvate în `blog.json` — completează-le dacă reimporți.

Folderele oglindă conțin doar `articol.md` — pozele lor sunt referite ca `img/…` și trăiesc deja optimizate în `img/` din rădăcină. Pozele se pun în folder doar la drafturile noi (ca `04/`), și doar în forma finală: max 1920px lățime, JPEG ~82 (oricum, la import se redimensionează la 1920px și se generează varianta `.webp`).
