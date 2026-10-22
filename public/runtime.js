(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const key = 'floriva-cart-v1';
  let products = [];
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  if (!Array.isArray(cart)) cart = [];
  cart = cart.filter(line => line && typeof line.id === 'string');
  const dialog = document.getElementById('plant-cart');
  const list = dialog.querySelector('[data-cart-items]');
  const money = cents => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const quantity = n => Math.max(1, Math.min(99, Math.trunc(Number(n)) || 1));
  const persist = () => { try { localStorage.setItem(key, JSON.stringify(cart)); } catch {} };
  function render() {
    list.replaceChildren();
    let total = 0, count = 0;
    cart = cart.filter(line => products.some(product => product.id === line.id));
    for (const line of cart) {
      const product = products.find(product => product.id === line.id);
      line.quantity = quantity(line.quantity);
      total += product.price * line.quantity;
      count += line.quantity;
      const row = document.createElement('div');
      row.className = 'plant-cart-row';
      const image = document.createElement('img');
      image.src = new URL(product.image, base).href;
      image.alt = product.name;
      const info = document.createElement('div');
      const link = document.createElement('a');
      link.href = new URL(`product/${product.slug}/`, base).href;
      link.textContent = product.name;
      const price = document.createElement('p');
      price.textContent = money(product.price);
      const controls = document.createElement('div');
      controls.className = 'plant-cart-controls';
      const minus = document.createElement('button');
      minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', `Decrease ${product.name}`);
      minus.disabled = line.quantity === 1;
      const amount = document.createElement('span');
      amount.textContent = line.quantity;
      const plus = document.createElement('button');
      plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', `Increase ${product.name}`);
      plus.disabled = line.quantity === 99;
      const remove = document.createElement('button');
      remove.type = 'button'; remove.textContent = 'Remove'; remove.className = 'plant-cart-remove'; remove.setAttribute('aria-label', `Remove ${product.name}`);
      minus.onclick = () => { line.quantity = quantity(line.quantity - 1); persist(); render(); };
      plus.onclick = () => { line.quantity = quantity(line.quantity + 1); persist(); render(); };
      remove.onclick = () => { cart = cart.filter(item => item.id !== line.id); persist(); render(); };
      controls.append(minus, amount, plus, remove);
      info.append(link, price, controls);
      const subtotal = document.createElement('strong');
      subtotal.textContent = money(product.price * line.quantity);
      row.append(image, info, subtotal); list.append(row);
    }
    if (!cart.length) {
      const empty = document.createElement('p'); empty.textContent = 'Your cart is empty. Find a little green for your space.'; list.append(empty);
    }
    document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = count; el.hidden = count === 0; });
    dialog.querySelector('[data-cart-total]').textContent = money(total);
    persist();
  }
  const ready = fetch(new URL('data/catalog.json', base)).then(response => {
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }).then(data => { products = data; render(); });
  async function openCart() {
    try { await ready; } catch { list.textContent = 'The catalog could not be loaded. Please refresh the page.'; }
    if (!dialog.open) dialog.showModal();
  }
  async function add(form, open = true) {
    await ready;
    const id = form.dataset.productId;
    if (!products.some(product => product.id === id)) return;
    const amount = quantity(form.querySelector('input[type="number"]')?.value);
    const existing = cart.find(line => line.id === id);
    if (existing) existing.quantity = quantity(existing.quantity + amount);
    else cart.push({ id, quantity: amount });
    persist(); render();
    if (open) openCart();
  }
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.matches('[data-plant-add]')) { event.preventDefault(); event.stopImmediatePropagation(); add(form); }
    if (form.matches('[data-plant-newsletter]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      const status = form.querySelector('[role="status"]');
      status.textContent = 'Email updates are not available yet. Please check back soon.';
    }
  }, true);
  document.addEventListener('click', event => {
    const target = event.target.closest('a,button,input');
    if (!target) return;
    if (target.matches('[data-open-cart]')) { event.preventDefault(); event.stopImmediatePropagation(); openCart(); }
    if (target.matches('[data-buy-now]')) { event.preventDefault(); event.stopImmediatePropagation(); add(target.closest('form')); }
    if (target.matches('[data-close-cart]')) dialog.close();
    if (target.matches('.catalog__filter-btn,.qty-plus,.qty-minus,.video-close-button,.close--menu,.mobile--menu')) event.preventDefault();
  }, true);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    try { const value = JSON.parse(event.newValue || '[]'); cart = Array.isArray(value) ? value.filter(line => line && typeof line.id === 'string') : []; render(); } catch {}
  });
  if (document.body.dataset.openCart === 'true') openCart();
})();
