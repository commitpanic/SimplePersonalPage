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

## Integracja QRZ XML (co godzine)

Workflow: `.github/workflows/qrz-sync.yml`

Sekrety repo do ustawienia:
- `QRZ_USERNAME` - login QRZ
- `QRZ_PASSWORD` - haslo QRZ
- `QRZ_QSO_ENDPOINT` - URL endpointu XML z Twoimi QSO (moze zawierac placeholder `{KEY}` na session key)
- `QRZ_AGENT` - opcjonalny user-agent klienta

Przyklad endpointu:

```text
https://example.qrz.endpoint/xml/current/?s={KEY};action=YOUR_LOGBOOK_EXPORT
```

Uwaga:
- endpoint z QSO zalezy od Twojego wariantu uslugi QRZ/XML,
- skrypt automatycznie loguje sie do QRZ, podstawia key i normalizuje dane do `data/qso.latest.json`.

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
