/* Brief klienta – formularz na pierwszy kontakt, według szablonu
   KUBABUBA_WORK/_szablony/brief-strona-wizytowka.md.
   Szkic zapisuje się w localStorage; eksport: PDF (pdfmake), data.md, tekst do schowka. */
(function () {
  "use strict";

  var DRAFT_KEY = "kubabuba-brief-draft";
  var YES_NO = ["tak", "nie", "nie wiem"];

  /* ── Schemat formularza ──
     type: text | email | tel | date | textarea | select | checks | rows | sub (podtytuł) | warn (ostrzeżenie)
     req – pole niezbędne do startu prac; full – na całą szerokość; md – nagłówek sekcji w data.md */
  var SECTIONS = [
    { title: "Klient i kontakt", md: "0. Metryka zlecenia", fields: [
      { id: "firstContact", label: "Data pierwszego kontaktu", type: "date" },
      { id: "status", label: "Status", type: "select", opts: ["wycena", "w realizacji", "odbiór", "opieka"] },
      { id: "contactName", label: "Osoba kontaktowa (imię, rola)", req: true, ph: "np. Anna Nowak, właścicielka" },
      { id: "contactPhone", label: "Telefon osoby kontaktowej", type: "tel", req: true },
      { id: "contactEmail", label: "E-mail osoby kontaktowej", type: "email" },
      { id: "approver", label: "Kto akceptuje projekt i treści", req: true },
      { id: "channel", label: "Preferowany kanał kontaktu", type: "select", opts: ["telefon", "e-mail", "WhatsApp", "Messenger", "spotkanie"] },
      { id: "deadline", label: "Termin publikacji", ph: "np. do końca marca" },
      { id: "budget", label: "Wycena / zaliczka / płatność", ph: "np. wysłana wycena z dnia…" },
      { id: "care", label: "Opieka po wdrożeniu", ph: "tak/nie, zakres, cena" }
    ] },
    { title: "Dane klienta", md: "1. Dane klienta", fields: [
      { id: "displayName", label: "Nazwa wyświetlana na stronie", req: true },
      { id: "legalName", label: "Pełna nazwa prawna" },
      { id: "legalForm", label: "Forma prawna", type: "select", opts: ["JDG", "sp. z o.o.", "spółka cywilna", "stowarzyszenie / fundacja", "inna"] },
      { id: "nip", label: "NIP / REGON" },
      { id: "krs", label: "KRS / CEIDG" },
      { id: "registry", label: "Rejestr branżowy", ph: "np. RPWDL, nr wpisu doradcy, nr PWZ" },
      { id: "address", label: "Adres", req: true, full: true },
      { id: "access", label: "Dojazd / parking / wejście" },
      { id: "accessibility", label: "Dostępność dla osób z niepełnosprawnościami", ph: "winda, podjazd, parter" },
      { id: "phones", label: "Telefon(y) na stronę", type: "tel", req: true },
      { id: "email", label: "E-mail na stronę", type: "email", req: true },
      { id: "hours", label: "Godziny otwarcia", type: "textarea", req: true, ph: "pn–pt …, sob …, wyjątki" },
      { id: "booking", label: "Rejestracja online", type: "select", opts: ["brak", "ZnanyLekarz", "Booksy", "własny system", "inna"] },
      { id: "googleProfile", label: "Profil Google (Mapy)", ph: "link, czy zweryfikowany, kto ma dostęp" },
      { id: "area", label: "Obszar działania (do SEO)", ph: "miasta / powiaty" },
      { type: "sub", label: "Media społecznościowe" },
      { id: "facebook", label: "Facebook" },
      { id: "instagram", label: "Instagram" },
      { id: "otherSocial", label: "LinkedIn / YouTube / TikTok / inne" },
      { id: "socialReuse", label: "Można pobierać treści i zdjęcia z profili?", type: "select", opts: YES_NO }
    ] },
    { title: "Domena, poczta, hosting", md: "2. Domena, poczta, hosting", fields: [
      { id: "domainExisting", label: "Domena istniejąca", ph: "czy jest? gdzie zarejestrowana?" },
      { id: "domainOwner", label: "Właściciel domeny / dostęp do DNS" },
      { id: "domainTarget", label: "Domena docelowa", req: true },
      { id: "mail", label: "Poczta na domenie", type: "select", opts: YES_NO },
      { type: "warn", label: "Klient ma pocztę na domenie – przy zmianie DNS nie ruszać rekordów MX!", when: function (s) { return s.mail === "tak"; } },
      { id: "currentSite", label: "Obecna strona", full: true, ph: "adres, czy przekierować, podstrony do zachowania (SEO)" },
      { id: "hosting", label: "Hosting PROD", type: "select", opts: ["GitHub Pages + CNAME", "home.pl (FTP)", "inny", "do ustalenia"] }
    ] },
    { title: "Zakres strony", md: "3. Zakres strony", fields: [
      { id: "structure", label: "Struktura", type: "select", opts: ["jedna strona z sekcjami", "kilka podstron"] },
      { id: "scope", label: "Sekcje i funkcje", type: "checks", opts: [
        "Strona główna / hero z przyciskiem (zadzwoń / napisz)", "O firmie / historia / misja", "Usługi / oferta",
        "Cennik", "Zespół", "Galeria", "FAQ", "Opinie klientów", "Kontakt: dane, godziny, mapa",
        "Formularz kontaktowy (EmailJS)", "Aktualności / blog", "Polityka prywatności", "Wersje językowe",
        "Pasek dostępności (A+/A−/kontrast)"
      ] },
      { id: "formTarget", label: "Formularz – na jaki adres mają przychodzić wiadomości", type: "email" },
      { id: "scopeOther", label: "Inne", full: true }
    ] },
    { title: "Treści", md: "4. Treści", fields: [
      { id: "textsBy", label: "Kto dostarcza teksty?", type: "select", opts: ["klient", "KubaBuba na podstawie rozmowy i FB", "wspólnie"] },
      { id: "audience", label: "Grupa docelowa" },
      { id: "about", label: "Opis działalności (2–4 zdania)", type: "textarea", req: true },
      { id: "facts", label: "Wyróżniki (fakty, nie slogany)", type: "textarea", ph: "rok założenia, doświadczenie, sprzęt, certyfikaty" },
      { id: "keywords", label: "Frazy do wyszukiwarki", full: true, ph: "np. „dentysta Świebodzin”" },
      { id: "services", label: "Usługi", type: "rows", req: true, cols: [["name", "Usługa"], ["desc", "Krótki opis (1–2 zdania)"], ["price", "Cena / „od”"]] },
      { id: "team", label: "Zespół", type: "textarea", ph: "imię i nazwisko, rola, specjalizacja, zdjęcie, zgoda na publikację" },
      { id: "faq", label: "FAQ", type: "textarea", ph: "P: … / O: …" }
    ] },
    { title: "Identyfikacja wizualna", md: "5. Identyfikacja wizualna", fields: [
      { id: "logo", label: "Logo", type: "select", opts: ["jest – wektor (SVG/AI)", "jest – PNG/JPG", "brak", "do zaprojektowania"] },
      { id: "colors", label: "Kolory firmowe" },
      { id: "fonts", label: "Fonty" },
      { id: "photos", label: "Zdjęcia", type: "select", opts: ["własne", "z FB", "stock", "sesja do zrobienia"] },
      { id: "photoRights", label: "Kto ma prawa autorskie do zdjęć?" },
      { id: "consents", label: "Zgody na wizerunek osób na zdjęciach" },
      { id: "likes", label: "Strony, które się podobają (i dlaczego)", type: "textarea" },
      { id: "avoid", label: "Czego unikać", type: "textarea" },
      { id: "competition", label: "Konkurencja w okolicy", full: true }
    ] },
    { title: "Prawo i RODO", md: "6. Prawo i RODO", fields: [
      { id: "admin", label: "Administrator danych (do polityki prywatności)", type: "textarea", req: true, ph: "pełna nazwa, adres, NIP, e-mail" },
      { id: "iod", label: "Inspektor Ochrony Danych (jeśli jest)" },
      { id: "formData", label: "Formularz – jakie dane zbieramy", ph: "imię, e-mail, telefon, treść" },
      { id: "cookies", label: "Cookies / analityka", type: "select", opts: ["brak", "Plausible / Umami (bez zgody)", "Google Analytics (wymaga banera zgody)"] },
      { id: "map", label: "Mapa Google", type: "select", opts: ["ładowana po kliknięciu", "osadzona od razu (wymaga zgody)", "bez mapy"] },
      { id: "regulated", label: "Zawód regulowany (lekarz, dentysta, prawnik, doradca podatkowy…)", type: "select", opts: ["nie", "tak"] },
      { type: "warn", label: "Zawód regulowany: treści tylko informacyjne – bez superlatyw, promocji i rabatów, bez obietnic efektów, zdjęć „przed/po” i opinii pacjentów bez konsultacji. Przy placówce medycznej dopisać w formularzu, by nie przesyłać informacji o stanie zdrowia.", when: function (s) { return s.regulated === "tak"; } }
    ] },
    { title: "Technika i marketing", md: "7. Technika i marketing", fields: [
      { id: "repo", label: "Repozytorium", ph: "nazwa, prywatne / publiczne" },
      { id: "searchConsole", label: "Google Search Console", ph: "kto zakłada, na czyje konto" },
      { id: "analytics", label: "Analityka" },
      { id: "integrations", label: "Integracje", ph: "rezerwacje, czat, Messenger, newsletter" }
    ] },
    { title: "Materiały od klienta", md: "8. Materiały do dostarczenia przez klienta", fields: [
      { id: "materials", label: "Do dostarczenia", type: "checks", opts: [
        "Logo (najlepiej wektor)", "Zdjęcia (wnętrze, zespół, budynek z zewnątrz)", "Teksty / akceptacja tekstów",
        "Godziny otwarcia", "Dane do polityki prywatności", "Dostęp do DNS domeny (albo osoba, która go ma)"
      ] }
    ] },
    { title: "Uwagi dodatkowe", md: "10. Uwagi dodatkowe", fields: [
      { id: "notes", label: "Uwagi", type: "textarea", full: true }
    ] }
  ];

  var FIELDS = [];
  SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { if (f.id) FIELDS.push(f); }); });
  var REQUIRED = FIELDS.filter(function (f) { return f.req; });

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* brak storage */ } }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dateStr(d) { return d ? new Date(d).toLocaleDateString("pl-PL") : ""; }

  function emptyState() {
    var s = {};
    FIELDS.forEach(function (f) {
      s[f.id] = f.type === "checks" ? [] : f.type === "rows" ? [{ name: "", desc: "", price: "" }] : "";
    });
    s.firstContact = today();
    s.status = "wycena";
    return s;
  }
  var state = Object.assign(emptyState(), load(DRAFT_KEY) || {});

  function filled(f) {
    var v = state[f.id];
    if (f.type === "checks") return v.length > 0;
    if (f.type === "rows") return v.some(function (r) { return (r.name || "").trim(); });
    return String(v || "").trim() !== "";
  }

  /* ── Formularz ── */
  function fieldHtml(f) {
    var label = esc(f.label) + (f.req ? " <b>*</b>" : "");
    var v = state[f.id];
    var ph = f.ph ? ' placeholder="' + esc(f.ph) + '"' : "";
    var cls = "q-field" + (f.full || f.type === "textarea" ? " q-full" : "");
    if (f.type === "sub") return '<h3 class="q-sub q-full">' + esc(f.label) + "</h3>";
    if (f.type === "warn") return '<p class="brief-warn" data-warn="' + SECTIONS.indexOf(f._section) + ":" + f._index + '"' + (f.when(state) ? "" : " hidden") + '><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(f.label) + "</p>";
    if (f.type === "textarea") return '<label class="' + cls + '"><span>' + label + '</span><textarea id="f-' + f.id + '" data-f="' + f.id + '" rows="3"' + ph + ">" + esc(v) + "</textarea></label>";
    if (f.type === "select") {
      return '<label class="' + cls + '"><span>' + label + '</span><select id="f-' + f.id + '" data-f="' + f.id + '"><option value="">—</option>' +
        f.opts.map(function (o) { return "<option" + (o === v ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></label>";
    }
    if (f.type === "checks") {
      return '<div class="q-full"><p class="q-sub">' + label + '</p><div class="brief-checks" id="f-' + f.id + '">' + f.opts.map(function (o) {
        var on = v.indexOf(o) !== -1;
        return '<label class="extra' + (on ? " active" : "") + '"><input type="checkbox" data-check="' + f.id + '" value="' + esc(o) + '"' + (on ? " checked" : "") + '> <span class="extra-name">' + esc(o) + "</span></label>";
      }).join("") + "</div></div>";
    }
    if (f.type === "rows") {
      return '<div class="q-full"><p class="q-sub">' + label + '</p><div class="brief-rows" id="f-' + f.id + '">' + v.map(function (r, i) {
        return '<div class="brief-row">' + f.cols.map(function (c) {
          return '<label class="q-field"><span>' + esc(c[1]) + '</span><input type="text" data-row="' + f.id + ":" + i + ":" + c[0] + '" value="' + esc(r[c[0]]) + '"></label>';
        }).join("") + '<button type="button" class="brief-row-del" data-del="' + f.id + ":" + i + '" aria-label="Usuń wiersz"><i class="fa-solid fa-xmark"></i></button></div>';
      }).join("") + '</div><button type="button" class="btn ghost brief-add" data-add="' + f.id + '"><i class="fa-solid fa-plus"></i> Dodaj usługę</button></div>';
    }
    return '<label class="' + cls + '"><span>' + label + '</span><input type="' + (f.type || "text") + '" id="f-' + f.id + '" data-f="' + f.id + '" value="' + esc(v) + '"' + ph + "></label>";
  }

  function renderForm() {
    $("brief-form").innerHTML = SECTIONS.map(function (s, si) {
      s.fields.forEach(function (f, fi) { f._section = s; f._index = fi; });
      return '<section class="q-card"><h2 class="q-title"><span class="q-num">' + (si + 1) + "</span> " + esc(s.title) + '</h2><div class="q-grid">' +
        s.fields.map(fieldHtml).join("") + "</div></section>";
    }).join("");
  }

  function renderWarnings() {
    document.querySelectorAll("[data-warn]").forEach(function (el) {
      var p = el.dataset.warn.split(":");
      el.hidden = !SECTIONS[+p[0]].fields[+p[1]].when(state);
    });
  }

  function renderProgress() {
    var done = REQUIRED.filter(filled).length;
    $("progress-bar").style.width = Math.round(done / REQUIRED.length * 100) + "%";
    $("progress-text").textContent = done + " / " + REQUIRED.length;
    var missing = REQUIRED.filter(function (f) { return !filled(f); });
    $("missing-head").textContent = missing.length ? "Brakuje:" : "Komplet pól wymaganych.";
    $("missing").innerHTML = missing.map(function (f) {
      return '<li><button type="button" data-goto="' + f.id + '">' + esc(f.label) + "</button></li>";
    }).join("");
  }

  function update() {
    save(DRAFT_KEY, state);
    renderWarnings();
    renderProgress();
  }

  /* ── Wartości do eksportu ── */
  function valueText(f) {
    var v = state[f.id];
    if (f.type === "date") return dateStr(v);
    return String(v || "").trim();
  }
  function servicesFilled(f) { return state[f.id].filter(function (r) { return (r.name || r.desc || r.price || "").trim(); }); }
  function clientName() { return state.displayName.trim() || state.legalName.trim(); }

  /* ── data.md (układ jak w szablonie briefu) ── */
  function markdown() {
    var cell = function (s) { return String(s).replace(/\|/g, "\\|").replace(/\n+/g, "<br>"); };
    var out = ["# Brief — " + (clientName() || "strona wizytówka"), "",
      "> Wypełnione w KubaBuba.pl /mystuff/brief" + (state.firstContact ? " · pierwszy kontakt " + dateStr(state.firstContact) : "") + ".",
      "> Pola z gwiazdką (*) są niezbędne do startu prac.", ""];
    SECTIONS.forEach(function (s) {
      out.push("## " + s.md, "");
      var table = [];
      var flush = function () {
        if (!table.length) return;
        out.push("| Pole | Wartość |", "|---|---|");
        table.forEach(function (r) { out.push(r); });
        out.push("");
        table = [];
      };
      s.fields.forEach(function (f) {
        if (f.type === "warn") { if (f.when(state)) { flush(); out.push("> **" + f.label + "**", ""); } return; }
        if (f.type === "sub") { flush(); out.push("### " + f.label, ""); return; }
        if (f.type === "checks") {
          flush();
          out.push("**" + f.label + "**", "");
          f.opts.forEach(function (o) { out.push("- [" + (state[f.id].indexOf(o) !== -1 ? "x" : " ") + "] " + o); });
          out.push("");
          return;
        }
        if (f.type === "rows") {
          flush();
          out.push("### " + f.label + (f.req ? " *" : ""), "", "| " + f.cols.map(function (c) { return c[1]; }).join(" | ") + " |", "|" + f.cols.map(function () { return "---"; }).join("|") + "|");
          var rows = servicesFilled(f);
          (rows.length ? rows : [{}]).forEach(function (r) { out.push("| " + f.cols.map(function (c) { return cell(r[c[0]] || ""); }).join(" | ") + " |"); });
          out.push("");
          return;
        }
        table.push("| " + f.label + (f.req ? " *" : "") + " | " + cell(valueText(f)) + " |");
      });
      flush();
    });
    return out.join("\n").replace(/\n{3,}/g, "\n\n");
  }

  /* ── PDF (pdfmake, czcionka Roboto z polskimi znakami) – kolory jak w wycenie ── */
  var PINK = "#e11d62", GREY = "#666666", LINE = "#d0d0d0";

  function pdfDefinition() {
    var blank = $("pdf-blank").checked;
    var content = [
      { columns: [
        [{ text: "KubaBuba.pl", fontSize: 22, bold: true, color: PINK }, { text: "Strony internetowe · Jakub Błaszyk", color: GREY }],
        { width: "auto", alignment: "right", stack: [
          { text: "Brief strony", bold: true, fontSize: 13 },
          state.firstContact ? "Pierwszy kontakt: " + dateStr(state.firstContact) : "",
          state.status ? "Status: " + state.status : ""
        ] }
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5 }], margin: [0, 10, 0, 12] }
    ];
    if (clientName()) content.push({ text: [{ text: "Klient: " }, { text: clientName(), bold: true }], margin: [0, 0, 0, 6] });

    var tableLayout = {
      hLineWidth: function (i, node) { return i === 0 || i === node.table.body.length ? 0 : 0.5; },
      vLineWidth: function () { return 0; },
      hLineColor: function () { return LINE; },
      paddingLeft: function () { return 6; }, paddingRight: function () { return 6; },
      paddingTop: function () { return 5; }, paddingBottom: function () { return 5; }
    };
    var labelCell = function (f) { return { text: f.label + (f.req ? " *" : ""), color: GREY, fontSize: 9.5 }; };

    SECTIONS.forEach(function (s, si) {
      var block = [];
      var rows = [];
      var flush = function () {
        if (!rows.length) return;
        block.push({ table: { widths: [170, "*"], body: rows, dontBreakRows: true }, layout: tableLayout, margin: [0, 0, 0, 8] });
        rows = [];
      };
      s.fields.forEach(function (f) {
        if (f.type === "warn") { if (f.when(state)) { flush(); block.push({ text: "! " + f.label, color: PINK, fontSize: 9.5, margin: [0, 0, 0, 8] }); } return; }
        if (f.type === "sub") { flush(); block.push({ text: f.label, bold: true, fontSize: 10, margin: [0, 2, 0, 4] }); return; }
        if (f.type === "checks") {
          var chosen = state[f.id];
          if (!blank && !chosen.length) return;
          flush();
          block.push({ text: f.label, bold: true, fontSize: 10, margin: [0, 2, 0, 4] });
          var items = f.opts.filter(function (o) { return blank || chosen.indexOf(o) !== -1; }).map(function (o) {
            return { text: [{ text: chosen.indexOf(o) !== -1 ? "[x]  " : "[  ]  ", bold: true, color: chosen.indexOf(o) !== -1 ? PINK : GREY }, o], margin: [0, 1, 0, 1] };
          });
          block.push({ columns: [{ stack: items.slice(0, Math.ceil(items.length / 2)) }, { stack: items.slice(Math.ceil(items.length / 2)) }], columnGap: 16, margin: [0, 0, 0, 8] });
          return;
        }
        if (f.type === "rows") {
          var list = servicesFilled(f);
          if (!blank && !list.length) return;
          flush();
          block.push({ text: f.label + (f.req ? " *" : ""), bold: true, fontSize: 10, margin: [0, 2, 0, 4] });
          var body = [f.cols.map(function (c) { return { text: c[1].toUpperCase(), style: "th" }; })];
          (list.length ? list : [{}, {}, {}, {}]).forEach(function (r) {
            body.push(f.cols.map(function (c) { return { text: r[c[0]] || " ", margin: [0, list.length ? 0 : 4, 0, list.length ? 0 : 4] }; }));
          });
          block.push({ table: { headerRows: 1, widths: [130, "*", 80], body: body }, layout: tableLayout, margin: [0, 0, 0, 8] });
          return;
        }
        var v = valueText(f);
        if (!v && !blank) return;
        rows.push([labelCell(f), { text: v || (f.type === "textarea" ? "\n\n" : " ") }]);
      });
      flush();
      if (block.length) {
        content.push({ text: (si + 1) + ". " + s.title, style: "h2", headlineLevel: 1 });
        content = content.concat(block);
      }
    });

    return {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      info: { title: "Brief" + (clientName() ? " – " + clientName() : "") + " – KubaBuba.pl", author: "Jakub Błaszyk" },
      defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.2 },
      styles: {
        th: { fontSize: 8.5, bold: true, color: GREY, characterSpacing: 0.5 },
        h2: { fontSize: 12.5, bold: true, color: PINK, margin: [0, 10, 0, 6] }
      },
      content: content,
      // nagłówek sekcji nie zostaje sam na dole strony: gdy zaczyna się w ostatnich ~12% strony, idzie na następną
      // (lista węzłów „dalej na stronie” nie wystarcza – tabela bez wierszy na tej stronie też się w niej liczy)
      pageBreakBefore: function (node) {
        var pos = node.startPosition;
        return node.headlineLevel === 1 && !!pos && (pos.verticalRatio != null ? pos.verticalRatio > 0.88 : pos.top > 700);
      },
      footer: function (page, pages) {
        return {
          columns: [
            { text: "Jakub Błaszyk · KubaBuba.pl · 665 244 647 · kuba@kubabuba.pl" },
            { text: page + " / " + pages, alignment: "right", width: "auto" }
          ],
          fontSize: 8.5, color: GREY, margin: [40, 20, 40, 0]
        };
      }
    };
  }

  function fileSlug(ext) {
    var n = clientName().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, "-").replace(/^-|-$/g, "");
    return "brief" + (n ? "-" + n : "") + "." + ext;
  }

  function openPdf() {
    if (!window.pdfMake) { $("copy-status").textContent = "Nie udało się załadować generatora PDF – sprawdź internet."; return; }
    // Kartę otwieramy od razu w obsłudze kliknięcia, żeby nie zablokowała jej przeglądarka;
    // gdy mimo to jest zablokowana – PDF zapisuje się jako plik.
    var win = window.open("", "_blank");
    pdfMake.createPdf(pdfDefinition()).getBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        download(url, fileSlug("pdf"));
        $("copy-status").textContent = "Przeglądarka zablokowała nową kartę – PDF zapisano jako plik.";
      }
    }, function () {
      if (win) win.close();
      $("copy-status").textContent = "Nie udało się wygenerować PDF.";
    });
  }

  function download(url, name) {
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ── Zdarzenia ── */
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset.f) state[el.dataset.f] = el.value;
    if (el.dataset.row) {
      var p = el.dataset.row.split(":");
      state[p[0]][+p[1]][p[2]] = el.value;
    }
    if (el.dataset.f || el.dataset.row) update();
  });

  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.dataset.f) { state[el.dataset.f] = el.value; update(); }
    if (el.dataset.check) {
      var list = state[el.dataset.check];
      var i = list.indexOf(el.value);
      if (el.checked && i === -1) list.push(el.value);
      if (!el.checked && i !== -1) list.splice(i, 1);
      el.closest(".extra").classList.toggle("active", el.checked);
      update();
    }
  });

  document.addEventListener("click", function (e) {
    var add = e.target.closest("[data-add]");
    var del = e.target.closest("[data-del]");
    var go = e.target.closest("[data-goto]");
    if (add) {
      state[add.dataset.add].push({ name: "", desc: "", price: "" });
      renderForm(); update();
      var inputs = document.querySelectorAll('#f-' + add.dataset.add + " input");
      inputs[inputs.length - 3].focus();
    }
    if (del) {
      var p = del.dataset.del.split(":");
      state[p[0]].splice(+p[1], 1);
      if (!state[p[0]].length) state[p[0]].push({ name: "", desc: "", price: "" });
      renderForm(); update();
    }
    if (go) {
      var target = $("f-" + go.dataset.goto);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        (target.matches("input, select, textarea") ? target : target.querySelector("input")).focus({ preventScroll: true });
      }
    }
  });

  $("pdf").addEventListener("click", openPdf);

  $("md").addEventListener("click", function () {
    var url = URL.createObjectURL(new Blob([markdown() + "\n"], { type: "text/markdown;charset=utf-8" }));
    download(url, "data.md");
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    $("copy-status").textContent = "Pobrano data.md – wrzuć do folderu klienta.";
  });

  $("copy").addEventListener("click", function () {
    var text = markdown();
    var done = function () { $("copy-status").textContent = "Skopiowano brief jako tekst (Markdown)."; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { $("copy-status").textContent = "Nie udało się skopiować."; }
      ta.remove();
    }
  });

  $("reset").addEventListener("click", function () {
    if (!confirm("Wyczyścić bieżący brief?")) return;
    state = emptyState();
    renderForm(); update();
    $("copy-status").textContent = "";
  });

  renderForm();
  update();
})();
