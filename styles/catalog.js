const materialsRoot = 'https://uks-design.github.io/materials-catalog/';
const search = document.querySelector('#search');
const results = document.querySelector('#results');
const detail = document.querySelector('#detail');
const browse = document.querySelector('#browse');
const filters = [...document.querySelectorAll('.filter')];
const dialog = document.querySelector('#preview');
let data = { settings: { uksBrandbookUrl: '' }, products: [] };
let activeFilter = 'all';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function labelFor(style) {
  return { base: 'Стандарт УКС', variant: 'УКС с отличиями', own: 'Свой стиль' }[style];
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function materialsUrl(product) {
  return safeUrl(product.materialsUrl) || `${materialsRoot}?q=${encodeURIComponent(product.number)}`;
}

function brandbookUrl(product) {
  return safeUrl(product.brandbookUrl || (product.style === 'own' ? '' : data.settings.uksBrandbookUrl));
}

function resultTemplate(product) {
  const preview = product.previews[0];
  return `<a class="result" href="#product-${escapeHtml(product.number)}">
    ${preview ? `<img class="result-image" src="${escapeHtml(preview.src)}" alt="">` : ''}
    <div class="result-copy"><div class="result-top"><span class="product-number">${escapeHtml(product.number)}</span><span class="style-state ${escapeHtml(product.style)}">${labelFor(product.style)}</span></div>
    <h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.summary || product.fullName)}</p></div><span class="result-arrow" aria-hidden="true">↗</span></a>`;
}

function renderResults() {
  const query = search.value.trim().toLocaleLowerCase('ru');
  const visible = data.products.filter(product => {
    const text = [product.number, product.name, product.fullName, product.summary].join(' ').toLocaleLowerCase('ru');
    const styleMatches = query || activeFilter === 'all' || (activeFilter === 'special' ? product.style !== 'base' : product.style === activeFilter);
    return styleMatches && text.includes(query);
  }).sort((a, b) => Number(a.number) - Number(b.number));
  document.querySelector('#count').textContent = `${visible.length} ${visible.length === 1 ? 'продукт' : visible.length % 10 >= 2 && visible.length % 10 <= 4 && (visible.length % 100 < 12 || visible.length % 100 > 14) ? 'продукта' : 'продуктов'}`;
  results.innerHTML = visible.length ? visible.map(resultTemplate).join('') : `<p class="empty">${data.products.length ? 'Продукты не найдены. Попробуйте другой номер или название.' : 'Каталог пополняется. Пока используйте базовый стиль УКС.'}</p>`;
}

function resourceTemplate(product) {
  const brandbook = brandbookUrl(product);
  const name = product.style === 'own' ? 'Брендбук продукта' : 'Брендбук УКС';
  return `<div class="resource-links" aria-label="Ресурсы продукта">
    ${brandbook ? `<a class="resource-link" href="${escapeHtml(brandbook)}" target="_blank" rel="noopener noreferrer"><span><strong>${name}</strong><small>Открыть руководство</small></span><span class="arrow" aria-hidden="true">↗</span></a>` : `<span class="resource-link pending"><span><strong>${name}</strong><small>Ссылка пока не добавлена</small></span></span>`}
    <a class="resource-link" href="${escapeHtml(materialsUrl(product))}" target="_blank" rel="noopener noreferrer"><span><strong>Материалы</strong><small>${product.materialsUrl ? 'Подборка для продукта' : `Поиск по номеру ${escapeHtml(product.number)}`}</small></span><span class="arrow" aria-hidden="true">↗</span></a>
  </div>`;
}

function detailTemplate(product) {
  const previews = product.previews.length
    ? `<div class="previews">${product.previews.map((preview, index) => `<button class="preview-button" type="button" data-preview="${index}"><img src="${escapeHtml(preview.src)}" alt="${escapeHtml(preview.label || 'Макет продукта')}"><span>${escapeHtml(preview.label || 'Макет продукта')} ↗</span></button>`).join('')}</div>`
    : '<p class="no-previews">Примеры макетов пока не добавлены.</p>';
  const rules = product.rules.length
    ? `<section class="rules" aria-labelledby="rules-title"><h3 id="rules-title">${product.style === 'own' ? 'Правила стиля' : 'Что отличается от УКС'}</h3><dl>${product.rules.map(rule => `<div class="rule"><dt>${escapeHtml(rule.label)}</dt><dd>${escapeHtml(rule.value)}</dd></div>`).join('')}</dl></section>`
    : '<section class="rules"><h3>Правила стиля</h3><p>Используется базовый стиль УКС без исключений.</p></section>';
  return `<a class="back-link" href="#browse">← Все продукты</a>
    <header class="detail-header"><div><p class="eyebrow">${escapeHtml(product.number)} · Правила продукта</p><h2>${escapeHtml(product.name)}</h2><p class="full-name">${escapeHtml(product.fullName)}</p><p class="detail-description">${escapeHtml(product.description)}</p></div><span class="style-state ${escapeHtml(product.style)}">${labelFor(product.style)}</span></header>
    <div class="detail-body">${previews}${rules}</div>${resourceTemplate(product)}`;
}

function renderLocation() {
  const number = location.hash.match(/^#product-(\d{1,6})$/)?.[1];
  const product = data.products.find(item => item.number === number);
  browse.hidden = Boolean(product);
  detail.hidden = !product;
  if (product) {
    detail.innerHTML = detailTemplate(product);
    document.title = `${product.name} — стили продуктов`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    document.title = 'Стили продуктов — дизайн-команда';
    renderResults();
  }
}

search.addEventListener('input', renderResults);
for (const button of filters) button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  for (const item of filters) item.setAttribute('aria-pressed', String(item === button));
  renderResults();
});
window.addEventListener('hashchange', renderLocation);
detail.addEventListener('click', event => {
  const button = event.target.closest('[data-preview]');
  if (!button) return;
  const product = data.products.find(item => location.hash === `#product-${item.number}`);
  const preview = product?.previews[Number(button.dataset.preview)];
  if (!preview) return;
  document.querySelector('#preview-title').textContent = preview.label || product.name;
  document.querySelector('#preview-image').src = preview.src;
  dialog.showModal();
});
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

fetch('products.json', { cache: 'no-store' }).then(response => {
  if (!response.ok) throw new Error('Не удалось загрузить каталог.');
  return response.json();
}).then(result => { data = result; renderLocation(); }).catch(error => { results.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`; });
