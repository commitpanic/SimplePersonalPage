# QRZ Page Builder – Plan implementacji

## TL;DR

Budujemy statyczną SPA (Single Page Application) bez backendu — w pełni kompatybilną z **GitHub Pages** — która wizualnie konfiguruje i generuje kompletne pliki `qrz_bio.html` dla QRZ.com. Dane przechowuje **sql.js** (SQLite skompilowany do WebAssembly) z persistencją przez IndexedDB. Obsługa wielu lokalnych użytkowników, import/eksport w istniejącym formacie z markerami komentarzy.

---

## Decyzje architektoniczne

| Problem | Rozwiązanie | Uzasadnienie |
|---|---|---|
| Baza danych | sql.js (SQLite WASM) + IndexedDB | SQLite w przeglądarce, bez serwera |
| Auth | Lokalni użytkownicy w SQLite, SHA-256 via Web Crypto API | Brak serwera |
| UI framework | Vanilla JS (ES modules) | Brak kroku budowania, spójne z obecną bazą kodu |
| Plik I/O | File System Access API (`showOpenFilePicker`) | Już używane w gallery-manager.html |
| Hosting | GitHub Pages | Tylko statyczny HTML/JS/CSS |
| Format importu | Markery `GAL-DATA:` i `YT-DATA:` w komentarzach HTML | Wsteczna kompatybilność z obecnym qrz_bio.html |

---

## Schemat bazy danych (SQLite przez sql.js)

```sql
users     (id, username, password_hash, created_at)
projects  (id, user_id, name, source_file_path, created_at, updated_at)
theme     (id, project_id, primary_color, secondary_color, bg_color, text_color, accent_color, font_family)
sections  (id, project_id, type, position, title, visible, data_json)
```

**Typy sekcji** (`sections.type`):
`header` | `text` | `gallery` | `youtube` | `iframe` | `station` | `map` | `propagation`

---

## Struktura plików projektu

```
qrz-builder/
├── index.html              # Strona logowania / rejestracji
├── builder.html            # Główna SPA buildera
├── css/
│   ├── app.css             # Style logowania i wspólne
│   └── builder.css         # Style interfejsu buildera
├── js/
│   ├── db.js               # sql.js init, IndexedDB save/restore, helpery zapytań
│   ├── auth.js             # Logowanie, rejestracja, sesja (sessionStorage)
│   ├── builder.js          # Główny kontroler: routing, stan, lista sekcji
│   ├── theme.js            # Panel edytora motywu kolorystycznego
│   ├── exporter.js         # Generowanie końcowego qrz_bio.html z danych projektu
│   ├── importer.js         # Parsowanie istniejącego qrz_bio.html → dane projektu
│   ├── fileops.js          # Wrapper File System Access API (open/save)
│   └── sections/
│       ├── header.js       # Edytor sekcji header (callsign, lokalizacja, logo, animacje, linki)
│       ├── text.js         # Edytor sekcji tekstowej / bio
│       ├── gallery.js      # Edytor galerii nagród (port z gallery-manager.html)
│       ├── youtube.js      # Edytor galerii YouTube (port z youtube-manager.html)
│       ├── iframe.js       # Edytor osadzania iframe (src, tytuł, wymiary)
│       ├── station.js      # Edytor informacji o stacji (siatka klucz-wartość)
│       ├── map.js          # Edytor sekcji mapy
│       └── propagation.js  # Edytor widgetu propagacji HF
├── lib/
│   └── sql-wasm/           # Pliki WASM sql.js (lub ładowane z CDN jsDelivr)
└── templates/
    └── base-generator.js   # Generator pełnego scaffoldu HTML + CSS
```

---

## Fazy implementacji

### Faza 1 — Fundament i Auth *(blokuje wszystko)*
- [ ] 1. Struktura katalogów, `index.html`, bazowe CSS
- [ ] 2. Integracja sql.js (CDN jsDelivr)
- [ ] 3. `db.js`: init DB, schemat, zapis/odczyt przez IndexedDB
- [ ] 4. `auth.js`: rejestracja, logowanie (SHA-256 via Web Crypto API), sesja przez sessionStorage
- [ ] 5. UI formularza logowania/rejestracji z przekierowaniem do `builder.html`

### Faza 2 — Zarządzanie projektami *(zależy od Fazy 1)*
- [ ] 6. Shell `builder.html`: sidebar nawigacyjny, główne canvas, górny pasek narzędzi
- [ ] 7. CRUD projektów: nowy projekt, lista projektów użytkownika, usuń
- [ ] 8. `fileops.js`: otwarcie pliku (`showOpenFilePicker`), zapis nowego (`showSaveFilePicker`) lub nadpisanie istniejącego (`FileSystemFileHandle`)

### Faza 3 — Edytor motywu *(można równolegle z Fazą 2)*
- [ ] 9. `theme.js`: color pickery dla primary / secondary / bg / text / accent
- [ ] 10. Presety motywów: ciemny amber (istniejący), czerwony, niebieski, zielony
- [ ] 11. Wybór czcionki (font-family)
- [ ] 12. Live podgląd przez CSS variables

### Faza 4 — Edytory sekcji *(każdy niezależny)*
- [ ] 13. `header.js`: callsign, lokalizacja, email, logo (URL lub Font Awesome icon), efekt animacji ikony (pulse / glow / bounce / rotate / none), lista linków (label + URL + icon)
- [ ] 14. `text.js`: tytuł sekcji, contenteditable z podstawowym toolbarem (bold / italic / link)
- [ ] 15. `gallery.js`: pełne CRUD + drag-reorder slajdów (port logiki z `gallery-manager.html`)
- [ ] 16. `youtube.js`: pełne CRUD + drag-reorder (port logiki z `youtube-manager.html`)
- [ ] 17. `iframe.js`: pola src, tytuł, wysokość, szerokość
- [ ] 18. `station.js`: dynamiczna siatka par klucz-wartość (add / edit / delete / reorder)
- [ ] 19. `map.js`: src iframe, tytuł
- [ ] 20. `propagation.js`: URL obrazka, tekst credit, link credit

### Faza 5 — Lista sekcji buildera *(zależy od Fazy 4)*
- [ ] 21. Lista sekcji w sidebar: dodaj / usuń, drag-to-reorder, toggle widoczności (eye icon)
- [ ] 22. Kliknięcie sekcji → ładuje odpowiedni panel edytora w canvas
- [ ] 23. Modal wyboru typu nowej sekcji (ikony per typ)

### Faza 6 — Podgląd na żywo *(zależy od Fazy 3 + 5)*
- [ ] 24. Panel podglądu: `<iframe srcdoc>` renderowany z aktualnego stanu projektu
- [ ] 25. Przycisk "Odśwież podgląd"; auto-odświeżanie po zapisie do DB

### Faza 7 — Importer *(zależy od Fazy 2)*
- [ ] 26. Parsowanie `GAL-DATA:` i `YT-DATA:` z komentarzy JSON (szybka ścieżka)
- [ ] 27. Wykrywanie sekcji header / station / map / propagation przez DOMParser + klasy CSS
- [ ] 28. Rekonstrukcja tablicy sekcji projektu → zapis do DB

### Faza 8 — Eksporter *(zależy od Faz 3 + 4)*
- [ ] 29. Generowanie bloku `<style>` z motywu + stylów per sekcja
- [ ] 30. Renderowanie każdej sekcji po kolei (CSS-only slideshow pattern jak w obecnym qrz_bio.html)
- [ ] 31. Osadzanie komentarzy `GAL-DATA:` i `YT-DATA:` (kompatybilność z istniejącymi managerami)
- [ ] 32. Pełny scaffold HTML: CDN Font Awesome, wrapper div, header, main, footer

---

## Pliki referencyjne / do reużycia

| Plik | Co reużywamy |
|---|---|
| `gallery-manager.html` | `generateGallerySection()`, `replaceSection()`, CSS radio-input slideshow |
| `youtube-manager.html` | `generateYouTubeSection()`, ten sam wzorzec CSS-only |
| `qrz_bio.html` | Pełna referencja struktury HTML, class names, animacje, schematy kolorów |

---

## Checklist weryfikacji przed wdrożeniem

- [ ] Logowanie: 2 różnych użytkowników, projekty odizolowane
- [ ] Wszystkie 8 typów sekcji: dodaj / edytuj / usuń / reorder
- [ ] Edytor motywu: zmiana kolorów → live podgląd się aktualizuje
- [ ] Eksport: wygenerowany plik otwarty w przeglądarce wygląda jak oryginał
- [ ] Import: wczytanie `qrz_bio.html` → slajdy galerii i YouTube poprawnie odtworzone
- [ ] GitHub Pages: sprawdzić brak błędów MIME dla sql.js WASM w konsoli przeglądarki
- [ ] Nadpisanie pliku: wczytaj → edytuj → zapisz → plik zaktualizowany z nowymi markerami

---

## Otwarte pytania

1. **sql.js CDN vs lokalny WASM**: CDN (jsDelivr) = prostsze; lokalny = w pełni offline. Rekomendacja: CDN.
2. **Animacje ikony w headerze**: pulse (istniejący), glow, bounce, rotate, none — czy to kompletna lista?
3. **Edytor tekstu**: zwykły `<textarea>` vs `contenteditable` — rekomendacja: contenteditable z toolbarem (bold/italic/link).

---

## Jak zacząć po przeniesieniu projektu

1. Przenieś folder do nowego repozytorium (np. `qrz-builder/`)
2. Otwórz go w VS Code
3. Powiedz Copilotowi: "Masz w projekcie plik QRZ_BUILDER_PLAN.md z planem — zacznij implementację od Fazy 1"
4. Copilot odczyta plan i będzie wiedział co robić

> Projekt źródłowy do referencji: `d:\qrz\QRZ_page\` — szczególnie `gallery-manager.html`, `youtube-manager.html` i `qrz_bio.html`
