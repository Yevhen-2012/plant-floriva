"use strict";

// Text limit
document.addEventListener("DOMContentLoaded", () => {
    const limit = 50;
  
    document.querySelectorAll(".text-limit").forEach(el => {
      const text = el.textContent.trim();
  
      if (text.length > limit) {
        el.textContent = text.substring(0, limit) + "...";
      }
    });
  });

// mobile-menu

const mobileMenuBtn = document.querySelector('.mobile--menu');
const closeMenuBtn = document.querySelector('.close--menu');
const mobileMenu = document.querySelector('.nav__menu-mobile');
const menuPosition = document.querySelector('.nav__link-position');

mobileMenuBtn.addEventListener('click', () => {

  menuPosition.classList.add('is-active');

  setTimeout(() => {
    mobileMenu.classList.add('is-active');
  }, 10);

});

closeMenuBtn.addEventListener('click', () => {

  mobileMenu.classList.add('is-closing');

  setTimeout(() => {
    mobileMenu.classList.remove('is-active');
    mobileMenu.classList.remove('is-closing');

    menuPosition.classList.remove('is-active');

  }, 100);

});



// button-hover animation



document.querySelectorAll('.button-main_btn, .nav-ico-link-search').forEach(button => {

  button.addEventListener('mousedown', () => {
    gsap.to(button, {
      scale: 0.96,
      duration: 0.1
    });
  });

  button.addEventListener('mouseup', () => {
    gsap.to(button, {
      scale: 1,
      duration: 0.1,
      ease: "power2.out"
    });
  });

  button.addEventListener('mouseleave', () => {
    gsap.to(button, {
      scale: 1,
      duration: 0.1
    });
  });

});

 
