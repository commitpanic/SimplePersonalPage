# KubaBuba.pl

Statyczna strona pod GitHub Pages (domena `kubabuba.pl`, plik `CNAME`).

## Struktura

- `index.html` – strona z ofertą KubaBuba (strony wizytówki), `assets/css/offer.css`, `assets/js/offer.js`
- `polityka-prywatnosci.html`, `robots.txt`, `sitemap.xml`
- `mystuff/` – strona robocza (noindex): linki do realizacji klientów i narzędzia
  - `mystuff/palety/` – palety kolorów do omówienia z klientem
  - `mystuff/wycena/` – kalkulator wyceny (tekst na WhatsApp / PDF)
  - `mystuff/brief/` – brief na pierwszy kontakt z klientem (PDF / `data.md`)
  - wspólne style i przełącznik motywów: `assets/css/style.css`, `assets/js/main.js`
- `docs/` – notatki projektowe
- `marketing/` – materiały FB (osobne prywatne repo `commitpanic/kubabuba-marketing`, wykluczone w `.gitignore`)

## Przeniesione na sp3fck.github.io

Strona krótkofalarska SP3FCK (mapa łączności, galeria, kreator strony QRZ, synchronizacja z QRZ.com)
jest w repo [sp3fck/sp3fck.github.io](https://github.com/sp3fck/sp3fck.github.io).
Stare adresy `ham-map.html`, `ham-map-qrz.html` i `qrz-builder/` przekierowują na nowe
(np. iframe mapy w starszej wersji bio na QRZ.com).

## Lokalny podgląd

```powershell
python -m http.server 8080
```

i `http://localhost:8080/`.
