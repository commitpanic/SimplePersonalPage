// ── KubaBuba – strona z ofertą ─────────────────────────────────

const EMAILJS = {
  publicKey: 'hukFXsRwDW8g83sOM',
  serviceId: 'service_r8ip6cl',
  templateId: 'template_nv4wj4l',
};

const THEME_KEY = 'kubabuba-theme';

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear().toString();

// ── Motyw jasny / ciemny ──────────────────────────────────────
// domyślnie ciemny – jasny tylko na żądanie
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* brak dostępu do storage */ }
});

// ── Menu mobilne ──────────────────────────────────────────────
const nav = document.getElementById('nav');
const navToggle = document.getElementById('nav-toggle');

navToggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});

nav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open');
  navToggle?.setAttribute('aria-expanded', 'false');
}));

// ── Formularz kontaktowy (EmailJS) ────────────────────────────
const form = document.getElementById('contact-form');
const statusEl = document.getElementById('cf-status');
const submitBtn = document.getElementById('cf-submit');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
}

function validate() {
  let ok = true;
  form.querySelectorAll('input[required]:not([type=checkbox]), textarea[required]').forEach(el => {
    const valid = el.value.trim() !== '' && el.checkValidity();
    el.classList.toggle('invalid', !valid);
    if (!valid) ok = false;
  });
  const consent = document.getElementById('cf-consent');
  consent.closest('.consent').classList.toggle('invalid', !consent.checked);
  if (!consent.checked) ok = false;
  return ok;
}

form?.addEventListener('input', e => e.target.classList.remove('invalid'));

form?.addEventListener('submit', async e => {
  e.preventDefault();

  // honeypot – boty wypełniają ukryte pole
  if (form.website.value) {
    setStatus('Dziękuję! Wiadomość została wysłana.', 'ok');
    form.reset();
    return;
  }

  if (!validate()) {
    setStatus('Uzupełnij wymagane pola oznaczone gwiazdką.', 'err');
    return;
  }

  if (!window.emailjs) {
    setStatus('Nie udało się załadować formularza. Napisz na kuba@kubabuba.pl lub zadzwoń: 665-244-647.', 'err');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector('span').textContent = 'Wysyłanie…';
  setStatus('', '');

  try {
    await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
      from_name: form.from_name.value.trim(),
      reply_to: form.reply_to.value.trim(),
      phone: form.phone.value.trim() || '—',
      message: form.message.value.trim(),
    }, { publicKey: EMAILJS.publicKey });

    setStatus('Dziękuję! Wiadomość została wysłana – odezwę się wkrótce.', 'ok');
    form.reset();
  } catch (err) {
    console.error('EmailJS error', err);
    setStatus('Coś poszło nie tak. Spróbuj ponownie lub napisz na kuba@kubabuba.pl / zadzwoń: 665-244-647.', 'err');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('span').textContent = 'Wyślij wiadomość';
  }
});
