/* ── Kalkulator wyceny ─────────────────────────────────── */
(function () {
  "use strict";

  var PRICES_KEY = "kb-wycena-cennik";
  var DRAFT_KEY = "kb-wycena-draft";

  // Domyślny cennik (zł). days = szacunkowe dni robocze.
  // individual: true = wycena indywidualna (kwotę wpisuje się przy konkretnej wycenie).
  var DEFAULTS = {
    packages: [
      { id: "landing", name: "Landing page / one-page", desc: "1 przewijana strona: oferta, o mnie, kontakt", price: 500, days: 5 },
      { id: "wizytowka", name: "Strona wizytówka", desc: "do 5 podstron, formularz, mapa, wersja mobilna", price: 800, days: 10 },
      { id: "firmowa", name: "Strona firmowa", desc: "rozbudowana struktura i treści", individual: true, price: 0, days: 20 }
    ],
    extras: [
      { id: "domena-hosting", name: "Dobór i konfiguracja domeny i hostingu", price: 200, days: 1 },
      { id: "podstrona", name: "Dodatkowa podstrona", unit: "szt.", qty: true, price: 100, days: 1 },
      { id: "copy", name: "Teksty na stronę (komplet do 4 podstron)", price: 200, days: 2 },
      { id: "galeria", name: "Galeria / portfolio realizacji", price: 0, days: 1 },
      { id: "jezyk", name: "Dodatkowa wersja językowa", unit: "język", qty: true, price: 200, days: 2 },
      { id: "integracja", name: "Integracja (rezerwacje, kalendarz, Booksy)", individual: true, price: 0, days: 1 },
      { id: "logo", name: "Proste logo", price: 50, days: 1 },
      { id: "seo", name: "Podstawowe SEO + Google Search Console", price: 100, days: 1 },
      { id: "gbp", name: "Profil firmy w Google – konfiguracja", price: 200, days: 1 },
      { id: "poczta", name: "E-mail w domenie – konfiguracja lub przekierowanie", price: 100, days: 0 },
      { id: "migracja", name: "Przeniesienie treści ze starej strony", price: 100, days: 1 },
      { id: "rodo", name: "Polityka prywatności", price: 50, days: 0 },
      { id: "social", name: "Grafiki do social media (zestaw 5 szt.)", price: 150, days: 1 }
    ],
    care: [
      { id: "brak", name: "Bez abonamentu", desc: "zmiany rozliczane godzinowo", price: 0 },
      { id: "podstawowa", name: "Opieka podstawowa", desc: "aktualizacje, kopie, drobne zmiany do 30 min/mies.", price: 79 },
      { id: "standard", name: "Opieka standard", desc: "jak podstawowa + do 2 h zmian/mies., raport", price: 149 },
      { id: "rozszerzona", name: "Opieka rozszerzona", desc: "do 5 h zmian/mies., posty/grafiki, priorytet", price: 299 }
    ],
    external: [
      { id: "domena", name: "Domena .pl (rocznie)", price: 120 },
      { id: "hosting", name: "Hosting (rocznie)", price: 0 },
      { id: "skrzynka", name: "Skrzynka e-mail (rocznie)", price: 0 }
    ],
    hourly: 120,
    rushPct: 25
  };

  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
  var zl = function (n) { return fmt.format(Math.round(n)) + " zł"; };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* brak storage */ } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // Cennik = domyślny nadpisany zapisanymi cenami (po id), żeby nowe pozycje się pojawiały.
  var prices = clone(DEFAULTS);
  (function applySaved() {
    var saved = load(PRICES_KEY);
    if (!saved) return;
    ["packages", "extras", "care", "external"].forEach(function (group) {
      prices[group].forEach(function (item) {
        if (item.individual) return;
        if (saved[group] && saved[group][item.id] != null) item.price = Number(saved[group][item.id]);
      });
    });
    if (saved.hourly != null) prices.hourly = Number(saved.hourly);
    if (saved.rushPct != null) prices.rushPct = Number(saved.rushPct);
  })();

  function savePrices() {
    var out = { hourly: prices.hourly, rushPct: prices.rushPct };
    ["packages", "extras", "care", "external"].forEach(function (group) {
      out[group] = {};
      prices[group].forEach(function (item) { if (!item.individual) out[group][item.id] = item.price; });
    });
    save(PRICES_KEY, out);
  }

  function emptyState() {
    return {
      client: "", clientType: "firma", date: new Date().toISOString().slice(0, 10), valid: 14,
      pkg: "wizytowka", extras: {}, custom: {}, care: "podstawowa", external: {},
      rush: false, discount: 0, deposit: 50, vat: "zw", notes: ""
    };
  }
  var state = Object.assign(emptyState(), load(DRAFT_KEY) || {});
  if (!state.custom) state.custom = {};

  // Etykieta ceny w formularzu
  function priceLabel(item, suffix) {
    if (item.individual) return "wycena indywidualna";
    if (!item.price) return "gratis";
    return zl(item.price) + (suffix || "");
  }
  // Pole na uzgodnioną kwotę dla pozycji wycenianej indywidualnie
  function customInput(item) {
    var v = state.custom[item.id] || "";
    return '<input type="number" class="custom-price" min="0" placeholder="kwota zł" data-custom="' + item.id + '" value="' + v + '" aria-label="Kwota: ' + esc(item.name) + '">';
  }
  function unitPrice(item) { return item.individual ? (Number(state.custom[item.id]) || 0) : item.price; }
  function lineValue(l) { return l.tbd ? "do ustalenia" : (l.total ? zl(l.total) : "gratis"); }

  /* ── Renderowanie formularza ── */
  function radioCard(name, item, checked, priceLabel) {
    return '<label class="pkg' + (checked ? " active" : "") + '">' +
      '<input type="radio" name="' + name + '" value="' + item.id + '"' + (checked ? " checked" : "") + ">" +
      '<span class="pkg-main"><strong>' + esc(item.name) + "</strong><small>" + esc(item.desc) + "</small></span>" +
      '<span class="pkg-price">' + priceLabel + "</span>" +
      (checked && item.individual ? customInput(item) : "") + "</label>";
  }

  function renderForm() {
    $("pkg-list").innerHTML = prices.packages.map(function (p) {
      return radioCard("pkg", p, state.pkg === p.id, priceLabel(p));
    }).join("");

    $("care-list").innerHTML = prices.care.map(function (c) {
      return radioCard("care", c, state.care === c.id, c.price ? zl(c.price) + "/mies." : "—");
    }).join("");

    $("extra-list").innerHTML = prices.extras.map(function (x) {
      var q = state.extras[x.id] || 0;
      var ctrl = x.qty
        ? '<input type="number" class="qty" min="0" value="' + q + '" data-extra="' + x.id + '" aria-label="Ilość: ' + esc(x.name) + '">'
        : '<input type="checkbox" data-extra="' + x.id + '"' + (q ? " checked" : "") + ' aria-label="' + esc(x.name) + '">';
      return '<label class="extra' + (q ? " active" : "") + '">' + ctrl +
        '<span class="extra-name">' + esc(x.name) + "</span>" +
        '<span class="extra-price">' + priceLabel(x, x.unit ? " / " + x.unit : "") + "</span>" +
        (q && x.individual ? customInput(x) : "") + "</label>";
    }).join("");

    $("ext-list").innerHTML = prices.external.map(function (e) {
      var v = state.external[e.id] != null ? state.external[e.id] : e.price;
      return '<label class="q-field"><span>' + esc(e.name) + '</span><input type="number" min="0" data-ext="' + e.id + '" value="' + v + '"></label>';
    }).join("");

    $("client").value = state.client;
    $("client-type").value = state.clientType;
    $("date").value = state.date;
    $("valid").value = state.valid;
    $("rush").checked = state.rush;
    $("discount").value = state.discount;
    $("deposit").value = String(state.deposit);
    $("vat").value = state.vat;
    $("notes").value = state.notes;
    $("rush-label").textContent = "(+" + prices.rushPct + "%, krótszy termin)";
    $("hourly-label").textContent = zl(prices.hourly) + "/h";
  }

  function renderPriceEditor() {
    var groups = [["packages", "Pakiety"], ["extras", "Dodatki"], ["care", "Opieka (zł/mies.)"], ["external", "Koszty zewnętrzne – domyślne"]];
    var html = groups.map(function (g) {
      return '<h3 class="pe-head">' + g[1] + '</h3><div class="pe-grid">' + prices[g[0]].filter(function (item) { return !item.individual; }).map(function (item) {
        return '<label class="q-field"><span>' + esc(item.name) + '</span><input type="number" min="0" data-price="' + g[0] + ":" + item.id + '" value="' + item.price + '"></label>';
      }).join("") + "</div>";
    }).join("");
    html += '<h3 class="pe-head">Inne</h3><div class="pe-grid">' +
      '<label class="q-field"><span>Stawka godzinowa (zł/h)</span><input type="number" min="0" data-price="hourly" value="' + prices.hourly + '"></label>' +
      '<label class="q-field"><span>Dopłata za ekspres (%)</span><input type="number" min="0" data-price="rushPct" value="' + prices.rushPct + '"></label></div>';
    $("price-editor").innerHTML = html;
  }

  /* ── Obliczenia ── */
  function compute() {
    var pkg = prices.packages.find(function (p) { return p.id === state.pkg; }) || prices.packages[0];
    var pp = unitPrice(pkg);
    var lines = [{ name: pkg.name + " (" + pkg.desc + ")", qty: 1, price: pp, total: pp, tbd: pkg.individual && !pp }];
    var days = pkg.days;

    prices.extras.forEach(function (x) {
      var q = Number(state.extras[x.id]) || 0;
      if (!q) return;
      var up = unitPrice(x);
      lines.push({ name: x.name, qty: q, unit: x.unit, price: up, total: up * q, tbd: x.individual && !up });
      days += x.days * q;
    });

    var subtotal = lines.reduce(function (s, l) { return s + l.total; }, 0);
    var rush = state.rush ? subtotal * prices.rushPct / 100 : 0;
    var discountPct = Math.min(Math.max(Number(state.discount) || 0, 0), 100);
    var discount = (subtotal + rush) * discountPct / 100;
    // Ceny w cenniku są kwotami końcowymi dla klienta (przy 23% VAT – brutto, VAT jest „w tym”)
    var gross = subtotal + rush - discount;
    var vatAmount = state.vat === "23" ? gross * 23 / 123 : 0;
    var net = gross - vatAmount;
    var deposit = gross * (Number(state.deposit) || 0) / 100;
    if (state.rush) days = Math.ceil(days * 0.6);

    var care = prices.care.find(function (c) { return c.id === state.care; }) || prices.care[0];
    var ext = prices.external.map(function (e) {
      var v = state.external[e.id] != null ? Number(state.external[e.id]) : e.price;
      return { name: e.name, price: v };
    });
    var validUntil = new Date(state.date || Date.now());
    validUntil.setDate(validUntil.getDate() + (Number(state.valid) || 14));

    return {
      lines: lines, tbd: lines.some(function (l) { return l.tbd; }), subtotal: subtotal, rush: rush, discountPct: discountPct, discount: discount,
      net: net, vatAmount: vatAmount, gross: gross, deposit: deposit, days: days,
      care: care, ext: ext, validUntil: validUntil
    };
  }

  function dateStr(d) { return new Date(d).toLocaleDateString("pl-PL"); }
  function vatSuffix() { return state.vat === "23" ? " brutto (z VAT)" : " (zw. z VAT)"; }
  function vatNote() {
    return state.vat === "23"
      ? "Podane ceny są cenami brutto – zawierają już podatek VAT 23%."
      : "Podane ceny są cenami końcowymi – nie dolicza się do nich VAT (sprzedawca zwolniony z VAT na podstawie art. 113 ust. 1 ustawy o VAT).";
  }

  /* ── Podsumowanie ── */
  function renderSummary() {
    var r = compute();
    $("sum-lines").innerHTML = r.lines.map(function (l) {
      var name = l.qty > 1 ? l.name + " × " + l.qty : l.name;
      return "<li><span>" + esc(name) + "</span><span>" + lineValue(l) + "</span></li>";
    }).join("");

    var t = "";
    if (r.rush) t += row("Ekspres +" + prices.rushPct + "%", zl(r.rush));
    if (r.discount) t += row("Rabat −" + r.discountPct + "%", "−" + zl(r.discount));
    t += row("Razem" + vatSuffix(), zl(r.gross) + (r.tbd ? " +" : ""), "sum-total");
    if (state.vat === "23") t += row("w tym VAT 23%", zl(r.vatAmount), "sum-muted");
    if (r.tbd) t += row("+ pozycje do ustalenia", "", "sum-muted");
    if (r.deposit) t += row("Zaliczka " + state.deposit + "%", zl(r.deposit));
    t += row("Termin", "ok. " + r.days + " dni rob.");
    t += row("Opieka", r.care.price ? zl(r.care.price) + "/mies." : "bez abonamentu");
    var extSum = r.ext.reduce(function (s, e) { return s + e.price; }, 0);
    if (extSum) t += row("Koszty zewn. / rok", "~" + zl(extSum), "sum-muted");
    $("sum-totals").innerHTML = t;
  }
  // Tylko dla mnie: ile zostaje po podatku dochodowym (skala 12% / 32%). Nie trafia do tekstu ani PDF.
  function renderIncome() {
    var r = compute();
    var rev = r.net; // przychód = kwota bez VAT
    var h = row("Przychód (bez VAT)", zl(rev));
    [12, 32].forEach(function (pct) {
      var tax = rev * pct / 100;
      h += row("Podatek " + pct + "%", "−" + zl(tax), "sum-muted");
      h += row("Zostaje przy " + pct + "%", zl(rev - tax), "income-net");
    });
    if (r.care.price) h += row("Opieka rocznie (12 × " + zl(r.care.price) + ")", zl(r.care.price * 12), "sum-muted");
    $("income-body").innerHTML = h;
  }

  function row(label, value, cls) {
    return '<div class="sum-row' + (cls ? " " + cls : "") + '"><span>' + label + "</span><span>" + value + "</span></div>";
  }

  /* ── Tekst do skopiowania ── */
  function plainText() {
    var r = compute();
    var out = [];
    out.push("Wycena strony internetowej" + (state.client ? " – " + state.client : ""));
    out.push("Data: " + dateStr(state.date) + " · ważna do " + dateStr(r.validUntil));
    out.push("");
    r.lines.forEach(function (l) {
      out.push("• " + l.name + (l.qty > 1 ? " × " + l.qty : "") + " – " + lineValue(l));
    });
    out.push("");
    if (r.rush) out.push("Tryb ekspresowy (+" + prices.rushPct + "%): " + zl(r.rush));
    if (r.discount) out.push("Rabat " + r.discountPct + "%: −" + zl(r.discount));
    out.push("RAZEM: " + zl(r.gross) + vatSuffix() + (r.tbd ? " + pozycje do ustalenia" : ""));
    if (state.vat === "23") out.push("w tym VAT 23%: " + zl(r.vatAmount));
    out.push(vatNote());
    if (r.deposit) out.push("Zaliczka " + state.deposit + "%: " + zl(r.deposit) + ", reszta po publikacji strony");
    out.push("Termin realizacji: ok. " + r.days + " dni roboczych od otrzymania materiałów");
    out.push("");
    out.push("Opieka po wdrożeniu: " + r.care.name + (r.care.price ? " – " + zl(r.care.price) + "/mies." : "") + " (zmiany poza abonamentem: " + zl(prices.hourly) + "/h)");
    var ext = r.ext.filter(function (e) { return e.price > 0; });
    if (ext.length) {
      out.push("Koszty zewnętrzne (płatne bezpośrednio u dostawców, szacunkowo):");
      ext.forEach(function (e) { out.push("  – " + e.name + ": ~" + zl(e.price)); });
    }
    out.push("Domena i strona są w całości Twoją własnością.");
    if (state.notes.trim()) { out.push(""); out.push("Uwagi: " + state.notes.trim()); }
    out.push("");
    out.push("Kuba · KubaBuba.pl · 665 244 647 · kuba@kubabuba.pl");
    return out.join("\n");
  }

  /* ── Wycena w PDF (pdfmake, czcionka Roboto z polskimi znakami) ── */
  var PINK = "#e11d62", GREY = "#666666", LINE = "#d0d0d0";

  function pdfDefinition() {
    var r = compute();
    var cellR = function (text, extra) { return Object.assign({ text: text, alignment: "right", noWrap: true }, extra || {}); };

    var body = [[
      { text: "POZYCJA", style: "th" },
      cellR("ILOŚĆ", { style: "th" }),
      cellR("CENA", { style: "th" }),
      cellR("WARTOŚĆ", { style: "th" })
    ]];
    r.lines.forEach(function (l) {
      body.push([
        l.name,
        cellR(String(l.qty) + (l.unit ? " " + l.unit : "")),
        cellR(l.tbd ? "—" : (l.price ? zl(l.price) : "gratis")),
        cellR(lineValue(l))
      ]);
    });

    var totals = [];
    var tRow = function (label, value, bold) {
      totals.push([{ text: label, colSpan: 3, bold: !!bold }, {}, {}, cellR(value, { bold: !!bold })]);
    };
    if (r.rush) tRow("Tryb ekspresowy (+" + prices.rushPct + "%)", zl(r.rush));
    if (r.discount) tRow("Rabat " + r.discountPct + "%", "−" + zl(r.discount));
    totals.push([
      { text: "Razem do zapłaty" + vatSuffix() + (r.tbd ? " + pozycje do ustalenia" : ""), colSpan: 3, bold: true, fontSize: 13 }, {}, {},
      cellR(zl(r.gross), { bold: true, fontSize: 13, color: PINK })
    ]);
    if (state.vat === "23") tRow("w tym VAT 23%", zl(r.vatAmount));

    var terms = [
      "Termin realizacji: ok. " + r.days + " dni roboczych od otrzymania materiałów (teksty, zdjęcia, logo).",
      r.deposit ? "Zaliczka " + state.deposit + "% (" + zl(r.deposit) + ") przed rozpoczęciem prac, pozostała kwota po publikacji strony." : "Płatność po publikacji strony.",
      "Wycena obejmuje 2 rundy poprawek w ramach uzgodnionego zakresu.",
      "Domena i strona są w całości własnością klienta.",
      "Opieka po wdrożeniu: " + r.care.name + (r.care.price ? " – " + zl(r.care.price) + " miesięcznie" : "") + ". Zmiany poza abonamentem: " + zl(prices.hourly) + "/h."
    ];
    terms.unshift(vatNote());
    var ext = r.ext.filter(function (e) { return e.price > 0; }).map(function (e) { return e.name + ": ok. " + zl(e.price); });

    var content = [
      { columns: [
        [{ text: "KubaBuba.pl", fontSize: 22, bold: true, color: PINK }, { text: "Strony internetowe · Jakub Błaszyk", color: GREY }],
        { width: "auto", alignment: "right", stack: [
          { text: "Wycena", bold: true, fontSize: 13 },
          "Data: " + dateStr(state.date),
          "Ważna do: " + dateStr(r.validUntil)
        ] }
      ] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5 }], margin: [0, 10, 0, 12] }
    ];
    if (state.client) content.push({ text: [{ text: "Dla: " }, { text: state.client, bold: true }], margin: [0, 0, 0, 10] });
    content.push({
      table: { headerRows: 1, widths: ["*", 60, 75, 85], body: body.concat(totals) },
      layout: {
        hLineWidth: function (i, node) { return i === node.table.body.length - totals.length ? 1.5 : (i === 0 || i === node.table.body.length ? 0 : 0.5); },
        vLineWidth: function () { return 0; },
        hLineColor: function (i, node) { return i === node.table.body.length - totals.length ? "#111111" : LINE; },
        paddingLeft: function () { return 6; }, paddingRight: function () { return 6; },
        paddingTop: function () { return 6; }, paddingBottom: function () { return 6; }
      },
      margin: [0, 0, 0, 16]
    });
    content.push({ text: "Warunki", style: "h3" }, { ul: terms, margin: [0, 0, 0, 10] });
    if (ext.length) content.push({ text: "Koszty zewnętrzne (płatne bezpośrednio u dostawców, szacunkowo, rocznie)", style: "h3" }, { ul: ext, margin: [0, 0, 0, 10] });
    if (state.notes.trim()) content.push({ text: "Uwagi", style: "h3" }, { text: state.notes.trim(), margin: [0, 0, 0, 10] });

    return {
      pageSize: "A4",
      pageMargins: [40, 40, 40, 60],
      info: { title: "Wycena" + (state.client ? " – " + state.client : "") + " – KubaBuba.pl", author: "Jakub Błaszyk" },
      defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25 },
      styles: {
        th: { fontSize: 8.5, bold: true, color: GREY, characterSpacing: 0.5 },
        h3: { fontSize: 11.5, bold: true, margin: [0, 6, 0, 4] }
      },
      content: content,
      footer: {
        text: "Jakub Błaszyk · KubaBuba.pl · 665 244 647 · kuba@kubabuba.pl",
        alignment: "center", fontSize: 8.5, color: GREY, margin: [40, 20, 40, 0]
      }
    };
  }

  function openPdf() {
    if (!window.pdfMake) { $("copy-status").textContent = "Nie udało się załadować generatora PDF – sprawdź internet."; return; }
    // Kartę otwieramy od razu w obsłudze kliknięcia, żeby nie zablokowała jej przeglądarka;
    // gdy mimo to jest zablokowana – PDF zapisuje się jako plik.
    var win = window.open("", "_blank");
    var name = "wycena" + (state.client ? "-" + state.client.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, "-").replace(/^-|-$/g, "") : "") + ".pdf";
    pdfMake.createPdf(pdfDefinition()).getBlob().then(function (blob) {
      var url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        var a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        $("copy-status").textContent = "Przeglądarka zablokowała nową kartę – PDF zapisano jako plik.";
      }
    }, function () {
      if (win) win.close();
      $("copy-status").textContent = "Nie udało się wygenerować PDF.";
    });
  }

  function update() {
    save(DRAFT_KEY, state);
    renderSummary();
    renderIncome();
  }

  /* ── Zdarzenia ── */
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.name === "pkg" || el.name === "care") {
      state[el.name] = el.value;
      renderForm();
    }
    if (el.dataset.extra) {
      state.extras[el.dataset.extra] = el.type === "checkbox" ? (el.checked ? 1 : 0) : Math.max(0, Number(el.value) || 0);
      el.closest(".extra").classList.toggle("active", !!state.extras[el.dataset.extra]);
      // Pozycja indywidualna: pokaż/ukryj pole na kwotę
      if (el.type === "checkbox" && prices.extras.some(function (x) { return x.id === el.dataset.extra && x.individual; })) renderForm();
    }
    update();
  });

  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset.ext) state.external[el.dataset.ext] = Math.max(0, Number(el.value) || 0);
    if (el.dataset.custom) state.custom[el.dataset.custom] = Math.max(0, Number(el.value) || 0);
    if (el.dataset.extra && el.type === "number") {
      state.extras[el.dataset.extra] = Math.max(0, Number(el.value) || 0);
      el.closest(".extra").classList.toggle("active", !!state.extras[el.dataset.extra]);
    }
    if (el.dataset.price) {
      var v = Math.max(0, Number(el.value) || 0);
      if (el.dataset.price === "hourly" || el.dataset.price === "rushPct") prices[el.dataset.price] = v;
      else {
        var p = el.dataset.price.split(":");
        prices[p[0]].find(function (i) { return i.id === p[1]; }).price = v;
      }
      savePrices();
      var focused = el.dataset.price;
      renderForm();
      var again = document.querySelector('[data-price="' + focused + '"]');
      if (again) again.focus();
    }
    var simple = { client: "client", "client-type": "clientType", date: "date", valid: "valid", discount: "discount", deposit: "deposit", vat: "vat", notes: "notes" };
    if (simple[el.id]) state[simple[el.id]] = el.value;
    if (el.id === "rush") state.rush = el.checked;
    update();
  });

  $("copy").addEventListener("click", function () {
    var text = plainText();
    var done = function () { $("copy-status").textContent = "Skopiowano – wklej w WhatsApp lub e-mail."; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { $("copy-status").textContent = "Nie udało się skopiować."; }
      ta.remove();
    }
  });

  $("pdf").addEventListener("click", openPdf);
  $("income-toggle").addEventListener("click", function () {
    var box = $("income");
    box.hidden = !box.hidden;
    this.setAttribute("aria-expanded", String(!box.hidden));
  });

  $("reset").addEventListener("click", function () {
    if (!confirm("Wyczyścić bieżącą wycenę?")) return;
    state = emptyState();
    renderForm(); update();
  });

  $("reset-prices").addEventListener("click", function () {
    if (!confirm("Przywrócić domyślny cennik?")) return;
    prices = clone(DEFAULTS);
    try { localStorage.removeItem(PRICES_KEY); } catch (e) { /* brak storage */ }
    renderPriceEditor(); renderForm(); update();
  });

  renderForm();
  renderPriceEditor();
  update();
})();
