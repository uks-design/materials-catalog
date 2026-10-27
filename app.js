(async () => {
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `materials.js?v=${Date.now()}`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    if (!Array.isArray(window.MATERIALS)) throw new Error("Некорректные данные каталога.");
  } catch {
    document.querySelector("#result-count").textContent = "Не удалось загрузить материалы. Обновите страницу.";
    return;
  }
  const STORAGE_KEY = "materials-catalog.custom-cards.v2";
  const filterDefinitions = [
    { key: "type", label: "Тип материала" },
    { key: "product", label: "Продукт / стиль" },
    { key: "purpose", label: "Назначение" }
  ];
  const defaultOptions = {
    type: ["Презентация", "Отчёт", "Документ", "Инструкция"],
    product: ["УКС", "Урбан", "МТА", "Команда Москвы", "Мастер взаимодействия"],
    purpose: ["Учебная", "Продающая", "Внутренняя"]
  };
  const coverNames = ["orange", "black", "blue", "lime", "pink", "paper"];

  function safeColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "";
  }

  function coverInk(hex) {
    const channels = [1, 3, 5].map((index) => {
      const value = parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return luminance > 0.179 ? "#111111" : "#ffffff";
  }

  const state = {
    query: "",
    type: "Все",
    product: "Все",
    purpose: "Все"
  };

  const search = document.querySelector("#search");
  const filterGroups = document.querySelector("#filter-groups");
  const cardGrid = document.querySelector("#card-grid");
  const resultCount = document.querySelector("#result-count");
  const resetButton = document.querySelector("#reset-filters");
  const emptyState = document.querySelector("#empty-state");
  const emptyReset = document.querySelector("#empty-reset");
  const dialog = document.querySelector("#material-dialog");
  const dialogContent = document.querySelector("#dialog-content");
  const dialogClose = document.querySelector("#dialog-close");
  const weeklyUpdate = document.querySelector("#weekly-update");
  const weeklyUpdateDate = document.querySelector("#weekly-update-date");
  const weeklyUpdateText = document.querySelector("#weekly-update-text");
  const weeklyUpdateLinks = document.querySelector("#weekly-update-links");
  const weeklyUpdateClose = document.querySelector("#weekly-update-close");

  const normalize = (value) => String(value ?? "").toLocaleLowerCase("ru-RU");
  const asArray = (value) =>
    Array.isArray(value) ? value.filter(Boolean).map(String) : value ? [String(value)] : [];
  const escapeHtml = (value) =>
    String(value ?? "").replace(
      /[&<>"]/g,
      (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]
    );

  function normalizeMaterial(material) {
    return {
      ...material,
      type: asArray(material.type),
      product: asArray(material.product),
      purpose: asArray(material.purpose),
      tags: asArray(material.tags),
      versions: Array.isArray(material.versions) ? material.versions : []
    };
  }

  function readSavedMaterials() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.map((material) => normalizeMaterial({ ...material, localOnly: true }))
        : [];
    } catch {
      return [];
    }
  }

  const materials = [
    ...readSavedMaterials(),
    ...(Array.isArray(window.MATERIALS) ? window.MATERIALS : []).map(normalizeMaterial)
  ];

  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `news.js?v=${Date.now()}`;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  } catch {
    // The catalog remains usable if the optional announcement is unavailable.
  }

  function uniqueValues(key) {
    return ["Все", ...(defaultOptions[key] || [])];
  }

  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    state.query = params.get("q") || "";
    filterDefinitions.forEach(({ key }) => {
      const candidate = params.get(key);
      if (candidate && uniqueValues(key).includes(candidate)) state[key] = candidate;
    });
    search.value = state.query;
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    filterDefinitions.forEach(({ key }) => {
      if (state[key] !== "Все") params.set(key, state[key]);
    });
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", next);
  }

  function renderFilters() {
    filterGroups.innerHTML = filterDefinitions
      .map(({ key, label }) => {
        const chips = uniqueValues(key)
          .map(
            (value) => `
              <button
                class="chip"
                type="button"
                data-filter="${escapeHtml(key)}"
                data-value="${escapeHtml(value)}"
                aria-pressed="${state[key] === value}"
              >${escapeHtml(value)}</button>`
          )
          .join("");
        return `
          <div class="filter-group">
            <p class="filter-label">${escapeHtml(label)}</p>
            <div class="chip-list">${chips}</div>
          </div>`;
      })
      .join("");
  }

  function getFilteredMaterials() {
    const query = normalize(state.query.trim());
    return materials.filter((material) => {
      const matchesFilters = filterDefinitions.every(
        ({ key }) => state[key] === "Все" || asArray(material[key]).includes(state[key])
      );
      if (!matchesFilters) return false;
      if (!query) return true;
      const haystack = normalize(
        [
          material.title,
          ...material.type,
          ...material.product,
          ...material.purpose,
          material.description,
          ...material.tags
        ].join(" ")
      );
      return haystack.includes(query);
    });
  }

  function cardTemplate(material) {
    const cover = coverNames.includes(material.cover) ? material.cover : "orange";
    const background = safeColor(material.coverColor);
    const circle = safeColor(material.coverCircleColor);
    const coverStyle = [
      background && `--cover-bg:${background};--cover-ink:${coverInk(background)}`,
      circle && `--cover-circle:${circle};--cover-circle-opacity:.38`
    ].filter(Boolean).join(";");
    const circleClass = material.coverCircle === false ? " cover--no-circle" : "";
    const shortTitle = escapeHtml(material.shortTitle || material.title).replace(/\n/g, "<br>");
    const coverCode = [...material.product, material.format].filter(Boolean).join(" · ");
    return `
      <article
        class="material-card"
        tabindex="0"
        role="button"
        aria-label="Открыть материал: ${escapeHtml(material.title)}"
        data-id="${escapeHtml(material.id)}"
      >
        <div class="cover cover--${cover}${circleClass}" style="${coverStyle}" aria-hidden="true">
          <span class="cover-code">${escapeHtml(coverCode)}</span>
          <span class="cover-title">${shortTitle}</span>
        </div>
        <div class="card-body">
          <div class="card-topline">
            <span class="file-type">${escapeHtml(material.type.join(" · "))} · ${escapeHtml(material.purpose.join(" · "))}</span>
            <span class="version">v${escapeHtml(material.version)}</span>
          </div>
          ${material.localOnly ? '<span class="local-badge">Только в этом браузере</span>' : ""}
          <h2 class="card-title">${escapeHtml(material.title)}</h2>
          <p class="card-description">${escapeHtml(material.description)}</p>
          <div class="card-footer">
            <span>Открыть карточку</span>
            <span>${escapeHtml(material.updated)}</span>
          </div>
        </div>
      </article>`;
  }

  function renderResults() {
    const filtered = getFilteredMaterials();
    cardGrid.innerHTML = filtered.map(cardTemplate).join("");
    cardGrid.hidden = filtered.length === 0;
    emptyState.hidden = filtered.length !== 0;
    resultCount.textContent = pluralize(filtered.length);
    resetButton.hidden = !hasActiveFilters();
    writeUrlState();
  }

  function pluralize(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let word = "материалов";
    if (mod10 === 1 && mod100 !== 11) word = "материал";
    else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = "материала";
    return `${count} ${word}`;
  }

  function hasActiveFilters() {
    return Boolean(state.query) || filterDefinitions.some(({ key }) => state[key] !== "Все");
  }

  function setFilter(key, value) {
    if (!(key in state)) return;
    state[key] = value;
    renderFilters();
    renderResults();
  }

  function resetFilters({ focus = true } = {}) {
    state.query = "";
    search.value = "";
    filterDefinitions.forEach(({ key }) => (state[key] = "Все"));
    renderFilters();
    renderResults();
    if (focus) search.focus();
  }

  function validWebUrl(value) {
    if (!value) return "";
    if (/^files\/[a-zA-Z0-9._%-]+$/.test(value) && !value.includes("..")) {
      return new URL(value, document.baseURI).href;
    }
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function googleDriveDownloadUrl(value) {
    const safeUrl = validWebUrl(value);
    if (!safeUrl) return "";
    const url = new URL(safeUrl);
    if (url.hostname !== "drive.google.com" && !url.hostname.endsWith(".drive.google.com")) return safeUrl;
    const pathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    const fileId = pathMatch?.[1] || url.searchParams.get("id");
    return fileId ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}` : safeUrl;
  }

  function actionTemplate(material) {
    const viewUrl = validWebUrl(material.viewUrl);
    const downloadUrl = googleDriveDownloadUrl(material.downloadUrl);
    const actions = [];
    if (viewUrl) {
      actions.push(
        `<a class="primary-button" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener noreferrer">Открыть материал</a>`
      );
    }
    if (downloadUrl) {
      actions.push(
        `<a class="secondary-button" href="${escapeHtml(downloadUrl)}" download rel="noopener noreferrer">Скачать актуальную версию</a>`
      );
    }
    return actions.length
      ? actions.join("")
      : '<span class="action-unavailable">Ссылки пока не добавлены</span>';
  }

  function openMaterial(id) {
    const material = materials.find((item) => item.id === id);
    if (!material) return;
    const versions = material.versions
      .map(
        ([version, date, changes]) => `
          <li class="version-item">
            <strong>v${escapeHtml(version)}</strong>
            <time>${escapeHtml(date)}</time>
            <span>${escapeHtml(changes)}</span>
          </li>`
      )
      .join("");

    dialogContent.innerHTML = `
      <p class="dialog-kicker">${escapeHtml(material.type.join(" · "))} · ${escapeHtml(material.product.join(" · "))}</p>
      <h2 class="dialog-title">${escapeHtml(material.title)}</h2>
      <p class="dialog-lead">${escapeHtml(material.description)}</p>
      ${material.localOnly ? '<p class="local-note">Эта карточка сохранена только в этом браузере и не видна другим посетителям.</p>' : ""}

      <div class="dialog-meta">
        <div class="meta-cell"><span>Версия</span><strong>v${escapeHtml(material.version)}</strong></div>
        <div class="meta-cell"><span>Обновлено</span><strong>${escapeHtml(material.updated)}</strong></div>
        <div class="meta-cell"><span>Формат</span><strong>${escapeHtml(material.format)}</strong></div>
      </div>

      <section class="attention-box">
        <h3>На что обратить внимание</h3>
        <p>${escapeHtml(material.attention)}</p>
      </section>

      <div class="dialog-tags">
        ${material.tags.map((tag) => `<span class="dialog-tag">${escapeHtml(tag)}</span>`).join("")}
      </div>

      <div class="dialog-actions">${actionTemplate(material)}</div>

      <section class="version-block" ${versions ? "" : "hidden"}>
        <h3>История версий</h3>
        <ul class="version-list">${versions}</ul>
      </section>`;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    window.location.hash = material.id;
  }

  function closeDialog() {
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }

  function renderWeeklyUpdate() {
    const news = window.CATALOG_NEWS;
    if (!news || news.enabled !== true || !news.revision) return;
    const dismissKey = "materials-catalog.dismissed-news";
    try {
      if (localStorage.getItem(dismissKey) === news.revision) return;
    } catch {}

    if (/^\d{4}-\d{2}-\d{2}$/.test(news.publishedAt || "")) {
      const date = new Date(`${news.publishedAt}T12:00:00`);
      if (!Number.isNaN(date.getTime())) {
        weeklyUpdateDate.textContent = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date);
      }
    }
    weeklyUpdateText.textContent = typeof news.text === "string" ? news.text : "";
    weeklyUpdateText.hidden = !weeklyUpdateText.textContent;
    weeklyUpdateLinks.replaceChildren();
    for (const [label, ids] of [["Добавлено", news.added], ["Обновлено", news.updated]]) {
      if (!Array.isArray(ids)) continue;
      for (const id of ids) {
        const material = materials.find((item) => item.id === id);
        if (!material) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "weekly-update-link";
        button.dataset.newsMaterial = id;
        const prefix = document.createElement("span");
        prefix.textContent = label;
        button.append(prefix, document.createTextNode(material.title));
        weeklyUpdateLinks.append(button);
      }
    }
    if (!weeklyUpdateText.textContent && !weeklyUpdateLinks.childElementCount) return;
    weeklyUpdate.hidden = false;
    weeklyUpdateClose.addEventListener("click", () => {
      weeklyUpdate.hidden = true;
      try { localStorage.setItem(dismissKey, news.revision); } catch {}
    });
    weeklyUpdateLinks.addEventListener("click", (event) => {
      const button = event.target.closest("[data-news-material]");
      if (button) openMaterial(button.dataset.newsMaterial);
    });
  }

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const schema = {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { type: "string" },
        product: { type: "string" },
        purpose: { type: "string" }
      },
      additionalProperties: false
    };
    try {
      void Promise.resolve(
        context.registerTool({
          name: "filter_materials",
          title: "Найти материалы",
          description: "Обновляет видимые фильтры каталога и возвращает подходящие материалы.",
          inputSchema: schema,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input = {}) {
            if (!input || typeof input !== "object" || Array.isArray(input)) {
              throw new Error("Ожидался объект с параметрами поиска.");
            }
            if (input.query !== undefined && typeof input.query !== "string") {
              throw new Error("Поле query должно быть строкой.");
            }
            filterDefinitions.forEach(({ key }) => {
              if (input[key] !== undefined && !uniqueValues(key).includes(input[key])) {
                throw new Error(`Неизвестное значение фильтра ${key}: ${input[key]}`);
              }
            });

            state.query = input.query || "";
            search.value = state.query;
            filterDefinitions.forEach(({ key }) => {
              state[key] = input[key] || "Все";
            });
            renderFilters();
            renderResults();
            return {
              count: getFilteredMaterials().length,
              materials: getFilteredMaterials().map(({ id, title, version }) => ({ id, title, version }))
            };
          }
        })
      ).catch(() => {});
    } catch {
      // WebMCP пока поддерживается не всеми браузерами.
    }
  }

  filterGroups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setFilter(button.dataset.filter, button.dataset.value);
  });

  search.addEventListener("input", () => {
    state.query = search.value;
    renderResults();
  });

  cardGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-id]");
    if (card) openMaterial(card.dataset.id);
  });

  cardGrid.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const card = event.target.closest("[data-id]");
    if (!card) return;
    event.preventDefault();
    openMaterial(card.dataset.id);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== search) {
      event.preventDefault();
      search.focus();
    }
  });

  resetButton.addEventListener("click", () => resetFilters());
  emptyReset.addEventListener("click", () => resetFilters());
  dialogClose.addEventListener("click", closeDialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener("close", () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  });
  readUrlState();
  renderFilters();
  renderResults();
  renderWeeklyUpdate();
  registerWebMcp();

  const initialId = window.location.hash.slice(1);
  if (initialId) openMaterial(initialId);
})();
