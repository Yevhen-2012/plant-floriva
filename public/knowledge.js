(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  let current, config, lastLoaded = 0, inFlight;
  const money = value => value == null ? 'Ask us' : Number(value).toFixed(2);
  const safeUrl = value => { if (!value || typeof value !== 'string') return ''; try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const safeImage = value => safeUrl(value) || new URL('assets/plant-placeholder.svg', base).href;
  const route = document.body.dataset.knowledgeRoute || '/';
  const productLink = product => new URL(`product/?id=${encodeURIComponent(product.id)}`, base).href;
  const fallback = fetch(new URL('data/knowledge.json', base)).then(r => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => null);
  const configReady = fetch(new URL('data/supabase-public.json', base)).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(value => { config = value; });
  function status(message) {
    let el = document.querySelector('[data-knowledge-status]');
    if (!el) { el = document.createElement('p'); el.dataset.knowledgeStatus = ''; el.setAttribute('role','status'); document.querySelector('main')?.prepend(el); }
    if (el) { el.hidden = !message; el.textContent = message; }
  }
  function setText(root, selector, text) { root.querySelectorAll(selector).forEach(el => { el.textContent = text; }); }
  function updateCard(card, product) {
    card.dataset.knowledgeProduct = product.id;
    setText(card, '.h3-card', product.name);
    setText(card, '.card-text-wraper,.trendy__text-block', product.description || 'Detailed description not yet provided.');
    card.querySelectorAll('.text-block-2,[data-wf-sku-bindings]').forEach(el => {
      if (el.matches('.text-block-2') || (el.dataset.wfSkuBindings || '').includes('f_price_')) el.textContent = money(product.price_eur);
    });
    card.querySelectorAll('a[href*="/product/"]').forEach(a => { a.href = productLink(product); });
    card.querySelectorAll('img.card-img,img.trendy__cms-img').forEach(img => {
      const image = safeImage(product.image_url);
      if (image && img.src !== image && !(img.dataset.knowledgeImage === image)) {
        // Keep existing responsive images when the source has not changed.
        img.src = image; img.removeAttribute('srcset');
        img.dataset.knowledgeImage = image;
      }
      img.alt = product.name;
    });
    const categories = card.querySelector('.product__categories-list');
    if (categories) {
      categories.replaceChildren();
      for (const id of product.category_ids || []) {
        const category = current.catalog.category_records.find(c => c.id === id);
        if (category) { const el = document.createElement('div'); el.className = 'product__category w-dyn-item'; el.textContent = category.name; categories.append(el); }
      }
    }
  }
  function render() {
    const products = current.catalog.products;
    document.querySelectorAll('[data-knowledge-product]').forEach(card => {
      const product = products.find(p => p.id === card.dataset.knowledgeProduct);
      card.hidden = !product;
      if (product) updateCard(card, product);
    });
    if (route === '/shop' || route.startsWith('/category/')) {
      const template = document.querySelector('.catalog__item');
      const list = template?.parentElement;
      if (template && list) {
        const category = route.startsWith('/category/') ? route.split('/').pop() : null;
        const wanted = products.filter(p => !category || (p.category_ids || []).includes(category));
        for (const product of wanted) {
          let card = Array.from(list.children).find(el => el.dataset.knowledgeProduct === product.id);
          if (!card) { card = template.cloneNode(true); card.querySelectorAll('[id]').forEach(el => el.removeAttribute('id')); list.append(card); }
          card.hidden = false; updateCard(card, product);
        }
        Array.from(list.children).forEach(card => { card.hidden = !wanted.some(p => p.id === card.dataset.knowledgeProduct); });
      }
    }
    if (route.startsWith('/product')) {
      const id = route === '/product' ? new URL(location.href).searchParams.get('id') : route.split('/').pop();
      const product = products.find(p => p.id === id);
      const area = document.querySelector('.product__content-wrapper');
      if (area) {
        if (!product) { setText(area, 'h1', 'Product unavailable'); area.querySelectorAll('input,button').forEach(el => { el.disabled = true; }); setText(area, '.text-block', 'This product is not in the published catalog.'); }
        else {
          document.title = `${product.name} — Floriva`;
          setText(area, 'h1', product.name);
          setText(area, ':scope > .text-block', product.description || 'Detailed description not yet provided. Please contact the store for specifications.');
          setText(area, '.product__price-wrapper > div', money(product.price_eur));
          area.querySelectorAll('[data-plant-add]').forEach(form => { form.dataset.productId = product.id; });
          area.querySelectorAll('input[type="submit"]').forEach(input => { input.disabled = product.availability_status === 'out_of_stock'; });
          document.querySelectorAll('.product__swiper-wrapper .swiper-img').forEach((img,index) => {
            const image = safeImage(product.images?.[index % product.images.length] || product.image_url);
            if (route === '/product' || (img.dataset.knowledgeImage && img.dataset.knowledgeImage !== image)) { img.src = image; img.removeAttribute('srcset'); }
            img.dataset.knowledgeImage = image; img.alt = product.name;
          });
          const moisture = area.querySelector('.product__moisture-requirement');
          if (moisture) { moisture.hidden = true; const label = moisture.previousElementSibling; if (label?.tagName === 'H5') label.textContent = product.care?.length ? 'Plant care' : 'Care details not yet provided'; }
          let care = area.querySelector('[data-product-care]');
          if (!care) { care = document.createElement('p'); care.dataset.productCare = ''; moisture?.after(care); }
          care.textContent = (product.care || []).join(' ');
        }
      }
    }
    if (route === '/contact') {
      const blocks = document.querySelectorAll('.contact-content-wraper');
      const store = current.store;
      blocks.forEach(block => {
        const heading = block.querySelector('h3')?.textContent.toLowerCase() || '';
        if (heading.includes('addres')) {
          setText(block, '.text-block', store.address || 'Address not specified.');
          const link = block.querySelector('a'); if (link && store.address) { link.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(store.address); link.rel = 'noopener'; }
        } else if (heading.includes('phone')) {
          block.querySelectorAll(':scope > :not(h3)').forEach(el => el.remove());
          for (const phone of store.contacts.phones || []) { const p = document.createElement('p'); const a = document.createElement('a'); a.textContent = phone.number; a.href = 'tel:' + phone.number.replace(/[^+0-9]/g,''); p.append(document.createTextNode(phone.department + ': '),a); block.append(p); }
        } else if (heading.includes('schedule')) {
          block.querySelectorAll(':scope > :not(h3)').forEach(el => el.remove());
          for (const [key,label] of [['monday_friday','Monday–Friday'],['saturday','Saturday'],['sunday','Sunday'],['public_holidays','Public holidays']]) { const p = document.createElement('p'); p.textContent = label + ': ' + (store.opening_hours[key] || 'not specified'); block.append(p); }
        }
      });
    }
    document.dispatchEvent(new CustomEvent('floriva:knowledge', { detail: current }));
  }
  async function rpc(name, body) {
    await configReady;
    const response = await fetch(config.supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type':'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12000), cache: 'no-store'
    });
    if (!response.ok) throw new Error('Shared catalog unavailable');
    return response.json();
  }
  async function refresh(force = false) {
    if (!force && current && Date.now() - lastLoaded < 60000) return current;
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try { current = await rpc('floriva_public_knowledge', {}); lastLoaded = Date.now(); status(''); }
      catch {
        if (!current) current = await fallback;
        status('Showing a saved catalog. Current prices and availability could not be confirmed.');
        if (!current) { status('The catalog is temporarily unavailable. Please contact the store.'); throw new Error('No catalog snapshot'); }
      }
      render(); return current;
    })().finally(() => { inFlight = null; });
    return inFlight;
  }
  window.FlorivaKnowledge = {
    ready: refresh(), refresh,
    quote: async items => { const data = await refresh(); return rpc('floriva_quote', { p_items: items, p_fulfillment: null, p_revision: data.revision }); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
