"use strict";


// shop add to cart quantity

document.querySelectorAll('.add-to-cart-field-wraper').forEach(wrapper => {
    const input = wrapper.querySelector('.product__add-to-cart-quantity');
    const plus = wrapper.querySelector('.qty-plus');
    const minus = wrapper.querySelector('.qty-minus');
  
    if (!input || !plus || !minus) return;
  
    plus.addEventListener('click', () => {
      input.value = Number(input.value || 1) + 1;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  
    minus.addEventListener('click', () => {
      const value = Number(input.value || 1);
  
      if (value > 1) {
        input.value = value - 1;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
  
  
  // swiper-ARROW
  const swiper = new Swiper('.product-swiper', {
    loop: true,
    speed: 600,
  
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
  });
  
  function animateSwiperArrows() {
    const arrows = document.querySelectorAll('.swiper-arrow');
  
    gsap.killTweensOf(arrows);
  
    gsap.to(arrows, {
      opacity: 0,
      scale: 0.8,
      duration: 0.2,
      ease: "power2.out"
    });
  
    gsap.to(arrows, {
      opacity: 1,
      scale: 1,
      duration: 0.3,
      delay: 0.6,
      ease: "power2.out"
    });
  }
  
  // Кнопки
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('.swiper-button-prev, .swiper-button-next');
  
    if (!button) return;
  
    animateSwiperArrows();
  });
  
  // Свайп пальцем + drag мышью
  swiper.on('sliderFirstMove', () => {
    animateSwiperArrows();
  });
