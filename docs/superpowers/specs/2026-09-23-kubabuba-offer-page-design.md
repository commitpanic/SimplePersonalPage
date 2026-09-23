# KubaBuba – strona z ofertą (design)

## Cel
`kubabuba.pl` staje się stroną z ofertą wykonawcy stron wizytówek (marka **KubaBuba**).
Dotychczasowa strona główna przechodzi pod `kubabuba.pl/mystuff/`.

## Struktura
- `index.html` – nowa strona ofertowa (PL), bez linku do `/mystuff`.
- `mystuff/index.html` – dotychczasowa strona główna, ścieżki poprawione na `../`.
- Narzędzia (`ham-map*.html`, `spots.html`, `gallery.html`, `games/`, `qrz-builder/`) zostają na miejscu
  (iframe `ham-map-qrz.html` na QRZ.com). Linki „Back” wskazują na `mystuff/`.
- Nowe: `assets/css/offer.css`, `assets/js/offer.js`. `style.css` / `main.js` bez zmian.

## Wygląd
- Jasny + ciemny (prefers-color-scheme + przełącznik, zapamiętany w localStorage).
- Klimat programistyczny: JetBrains Mono (nagłówki/akcenty), Inter (treść), logo `<KubaBuba/>`,
  śródtytuły `// 01. usługi`, kursor w hero.

## Sekcje
1. Hero – hasło, opis, CTA „Bezpłatna wycena” + „Realizacje”.
2. Usługi – Strona wizytówka, Domena i hosting, Opieka i aktualizacje.
3. Jak pracuję – 4 kroki.
4. Dlaczego ja – argumenty o solidności.
5. Realizacje – Filar (finansowykompas.eu).
6. Kontakt – formularz EmailJS + tel. 665-244-647, kuba@kubabuba.pl, „zdalnie – cała Polska”.
   Bez cen: „wycena indywidualna i bezpłatna”.
7. Stopka.

## Formularz
- EmailJS browser SDK v4 (jsdelivr). Service `service_r8ip6cl`, template `template_nv4wj4l`,
  public key `hukFXsRwDW8g83sOM`.
- Zmienne szablonu: `from_name`, `reply_to`, `phone`, `message`.
- Honeypot, blokada przycisku w trakcie wysyłki, komunikaty sukces/błąd, zgoda RODO (wymagana).

## SEO
`lang="pl"`, title/description, Open Graph, favicon.
