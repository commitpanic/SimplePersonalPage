# SP3FCK Ham Radio Site

Statyczna strona pod GitHub Pages:
- Strona glowna z linkami
- My Ham Map (mapa lacznosci + filtry)
- Galeria zdjec sterowana JSON

## Struktura

- `index.html` - home
- `ham-map.html` - mapa
- `gallery.html` - galeria
- `data/qso.latest.json` - dane mapy
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
- `QRZ_STATIC_BASEMAP_FILE` - opcjonalna sciezka SVG tla mapy (domyslnie `assets/maps/world-basemap.svg`)

Endpoint API:

```text
https://logbook.qrz.com/api
```

Uwaga:
- klucz API znajdziesz na stronie integracji API po zalogowaniu do QRZ,
- skrypt wykonuje `ACTION=FETCH` i normalizuje wynik ADIF do `data/qso.latest.json`.
- jezeli plik `assets/maps/world-basemap.svg` nie istnieje, sync wygeneruje go automatycznie z Natural Earth i potem bedzie tylko dogrywal punkty/linie QSO.
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
