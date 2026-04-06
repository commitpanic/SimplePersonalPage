const CONFIG_URL = "data/gallery.config.json";

const filtersEl = document.getElementById("categoryFilters");
const gridEl = document.getElementById("galleryGrid");
const statusEl = document.getElementById("galleryStatus");

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxTitle = document.getElementById("lightboxTitle");
const lightboxDescription = document.getElementById("lightboxDescription");

let allItems = [];
let activeCategory = "all";

loadGallery();

async function loadGallery() {
  setStatus("Loading gallery...");

  try {
    const res = await fetch(`${CONFIG_URL}?ts=${Date.now()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const config = await res.json();
    const validated = validateConfig(config);
    allItems = validated.sort((a, b) => a.order - b.order);

    const categories = [...new Set(allItems.map((item) => item.category))];
    renderCategoryFilters(categories);
    renderGallery();

    setStatus(`Loaded ${allItems.length} images.`);
  } catch (error) {
    console.error(error);
    setStatus("Failed to load gallery.");
  }
}

function validateConfig(config) {
  if (!config || !Array.isArray(config.images)) {
    throw new Error("Missing images array in gallery configuration");
  }

  const seen = new Set();
  return config.images.map((item, idx) => {
    const file = String(item.file || "").trim();
    const title = String(item.title || "").trim();
    const description = String(item.description || "").trim();
    const category = String(item.category || "other").trim();
    const order = Number(item.order ?? idx + 1);

    if (!file || !title) {
      throw new Error(`Invalid gallery entry at index ${idx + 1}`);
    }
    if (seen.has(file)) {
      throw new Error(`Duplicate gallery file: ${file}`);
    }
    seen.add(file);

    return {
      file,
      title,
      description,
      category,
      order,
      src: `assets/images/${file}`
    };
  });
}

function renderCategoryFilters(categories) {
  const list = ["all", ...categories];
  filtersEl.innerHTML = list
    .map((category) => {
      const label = category === "all" ? "All" : category;
      const activeClass = category === activeCategory ? "active" : "";
      return `<button class="chip ${activeClass}" data-category="${category}">${label}</button>`;
    })
    .join("");

  filtersEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category || "all";
      renderCategoryFilters(categories);
      renderGallery();
    });
  });
}

function renderGallery() {
  const filtered = activeCategory === "all"
    ? allItems
    : allItems.filter((item) => item.category === activeCategory);

  gridEl.innerHTML = filtered.map((item) => `
    <article class="gallery-item" data-src="${item.src}" data-title="${escapeHtml(item.title)}" data-description="${escapeHtml(item.description)}">
      <img src="${item.src}" alt="${escapeHtml(item.title)}" loading="lazy">
      <div class="gallery-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
      </div>
    </article>
  `).join("");

  gridEl.querySelectorAll(".gallery-item").forEach((card) => {
    card.addEventListener("click", () => openLightbox(card));
  });
}

function openLightbox(card) {
  lightboxImage.src = card.dataset.src || "";
  lightboxImage.alt = card.dataset.title || "";
  lightboxTitle.textContent = card.dataset.title || "";
  lightboxDescription.textContent = card.dataset.description || "";
  if (typeof lightbox.showModal === "function") {
    lightbox.showModal();
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
