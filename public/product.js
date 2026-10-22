'use strict';

document.querySelectorAll('.add-to-cart-field-wraper').forEach(wrapper => {
  const input = wrapper.querySelector('.product__add-to-cart-quantity');
  if (!input) return;
  wrapper.querySelector('.qty-plus')?.addEventListener('click', () => {
    input.value = Number(input.value || 1) + 1;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  wrapper.querySelector('.qty-minus')?.addEventListener('click', () => {
    input.value = Math.max(1, Number(input.value || 1) - 1);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
});

const gallery = document.querySelector('.product__swiper-wrapper .swiper');
if (gallery) {
  // The gallery height is reserved in CSS, including before Swiper starts.
  const swiper = new Swiper(gallery, {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    speed: 800,
    autoHeight: false,
    observer: true,
    observeParents: true,
    resizeObserver: true,
    touchRatio: 1,
    touchAngle: 45,
    keyboard: { enabled: true, onlyInViewport: true },
    navigation: {
      nextEl: Array.from(gallery.querySelectorAll('.swiper-button-next')),
      prevEl: Array.from(gallery.querySelectorAll('.swiper-button-prev'))
    }
  });
  const arrows = gallery.querySelectorAll('.swiper-arrow');
  const animateArrows = () => {
    gsap.killTweensOf(arrows);
    gsap.to(arrows, { opacity: 0, scale: 0.8, duration: 0.2, ease: 'power2.out' });
    gsap.to(arrows, { opacity: 1, scale: 1, duration: 0.3, delay: 0.6, ease: 'power2.out' });
  };
  gallery.addEventListener('pointerdown', event => {
    if (event.target.closest('.swiper-button-prev, .swiper-button-next')) animateArrows();
  });
  swiper.on('sliderFirstMove', animateArrows);
}

const assetBase = new URL('../assets/', document.currentScript.src);
document.querySelectorAll('.product__moisture-requirement').forEach(element => {
  const value = Number.parseInt(element.textContent.trim(), 10);
  const wrapper = document.createElement('div');
  wrapper.className = 'moisture-icons';
  for (let index = 0; index < 10; index++) {
    const image = document.createElement('img');
    image.src = new URL(index < value
      ? 'droplet-filled.svg'
      : 'droplet-empty.svg', assetBase).href;
    image.alt = 'Moisture';
    image.className = 'moisture-icon';
    wrapper.append(image);
  }
  element.replaceChildren(wrapper);
});
