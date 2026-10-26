# SP3FCK Ham Radio Site

Statyczna strona pod GitHub Pages:
- Strona glowna z linkami
- My Ham Map (mapa lacznosci + filtry)
- Galeria zdjec sterowana JSON

## Struktura

- `index.html` - strona z oferta KubaBuba (strony wizytowki), `assets/css/offer.css`, `assets/js/offer.js`
- `mystuff/index.html` - dawna strona glowna (projekty, narzedzia, gry)
- `ham-map.html` - mapa
- `gallery.html` - galeria
- `data/qso.latest.json` - dane mapy
- `data/dxcc-entities.js`, `data/cq-zones.js`, `data/itu-zones.js` - dane referencyjne mapy (lista DXCC, granice stref CQ/ITU); generowane jednorazowo przez `scripts/build-ham-reference.mjs`
- `data/gallery.config.json` - konfiguracja galerii
- `.github/workflows/qrz-sync.yml` - synchronizacja QRZ co godzine

## Lokalny podglad

Najprosciej uruchomic lokalny serwer statyczny, np. z rozszerzenia VS Code Live Server albo przez:

```powershell
python -m http.server 8080
```


Nastepnie otworz:
- `http://localhost:8080/`

## GitHub Pages

1. Push repo na GitHub.
2. Wejdz w Settings -> Pages.
3. Ustaw Source: Deploy from a branch.
4. Wybierz branch `main`, folder `/ (root)`.

## Integracja QRZ Logbook API (co godzine)

Workflow: `.github/workflows/qrz-sync.yml`

Sekrety repo do ustawienia:
- `QRZ_API_KEY` - API Access Key do Twojego logbooka (z panelu QRZ)
- `QRZ_FETCH_OPTIONS` - opcjonalnie, np. `MAX:500,TYPE:ADIF` albo `MAX:500,TYPE:ADIF,MODSINCE:2026-01-01`
- `QRZ_AGENT` - opcjonalny user-agent klienta

Endpoint API:

```text
https://logbook.qrz.com/api
```

Uwaga:
- klucz API znajdziesz na stronie integracji API po zalogowaniu do QRZ,
- skrypt wykonuje `ACTION=FETCH` i normalizuje wynik ADIF do `data/qso.latest.json`.
- statyczna strona dla QRZ (`ham-map-qrz.html`, bez JavaScriptu) jest generowana przez `scripts/qrz-static-page.mjs`: mapa w stylu widoku Flat ze strefami CQ oraz statystyki DXCC/WAZ/ITU. Mozna ja przebudowac lokalnie z `data/qso.latest.json` bez API: `npm install --no-save d3-geo@3 topojson-client@3`, potem `node scripts/qrz-static-page.mjs`.
- w razie potrzeby skrypt nadal obsluguje tryb legacy XML (login + haslo), ale rekomendowany jest API key.

## Ręczne odswiezanie danych

1. W GitHub przejdz do Actions.
2. Uruchom workflow `QRZ QSO Sync` recznie (`Run workflow`).
3. Na stronie My Ham Map kliknij `Odswiez dane`, aby pobrac najnowszy JSON.

## Konfiguracja galerii

Plik: `data/gallery.config.json`

Kazdy wpis:

```json
{
  "file": "nazwa-pliku.jpg",
  "title": "Tytul",
  "description": "Opis",
  "category": "Kategoria",
  "order": 1
}
```

Pliki zdjec umieszczaj w katalogu `assets/images/`.
