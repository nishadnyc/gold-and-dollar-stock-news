async function loadNews() {
  const goldEl = document.getElementById('gold-rows');
  const dollarEl = document.getElementById('dollar-rows');
  const updatedEl = document.getElementById('updated-at');

  try {
    const res = await fetch('news.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`news.json returned ${res.status}`);
    const data = await res.json();

    updatedEl.textContent = formatDate(data.updatedAt);

    renderRows(goldEl, data.gold || []);
    renderRows(dollarEl, data.dollar || []);
  } catch (err) {
    const message = `<li class="state error">Couldn't load news.json (${err.message}).</li>`;
    goldEl.innerHTML = message;
    dollarEl.innerHTML = message;
    updatedEl.textContent = '—';
  }
}

function renderRows(el, items) {
  if (!items.length) {
    el.innerHTML = '<li class="state">No stories yet. Check back after the next update.</li>';
    return;
  }

  el.innerHTML = items
    .slice(0, 10)
    .map((item, i) => `
      <li class="row">
        <span class="rank">${i + 1}</span>
        <div>
          <a class="headline" href="${escapeAttr(item.link)}" target="_blank" rel="noopener">
            ${escapeHtml(item.title)}
          </a>
          ${item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p>` : ''}
          <div class="source-line">
            ${escapeHtml(item.source || 'Unknown source')} · ${formatDate(item.pubDate)}
            · <a class="read-more" href="${escapeAttr(item.link)}" target="_blank" rel="noopener">Read full story →</a>
          </div>
        </div>
      </li>
    `)
    .join('');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

loadNews();
