"use strict";

// shop filter
document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.catalog__filter-btn');
    const productItems = document.querySelectorAll('.catalog__item');
  
    productItems.forEach(item => {
      item.style.transition = 'opacity 0.3s ease-out';
  
      const mask = item.querySelector('.card-mask');
      if (mask) {
        mask.style.transition = 'opacity .8s ease-out';
      }
    });
  
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filterValue = button.getAttribute('data-filter');
  
        filterButtons.forEach(btn => btn.classList.remove('is-active'));
        button.classList.add('is-active');
  
        // Скрываем все карточки и маски
        productItems.forEach(item => {
          item.style.opacity = '0';
  
          const mask = item.querySelector('.card-mask');
          if (mask) {
            mask.style.opacity = '0';
          }
        });
  
        setTimeout(() => {
          productItems.forEach(item => {
            const productCategories = [...item.querySelectorAll('.product__category')]
              .map(category => category.textContent.trim());
  
            const isVisible =
              filterValue === 'all' || productCategories.includes(filterValue);
  
            item.style.display = isVisible ? '' : 'none';
          });
  
          requestAnimationFrame(() => {
            productItems.forEach(item => {
              if (item.style.display !== 'none') {
                item.style.opacity = '1';
  
                const mask = item.querySelector('.card-mask');
                if (mask) {
                  mask.style.opacity = '1';
                }
              }
            });
          });
        }, 300);
      });
    });
  });
  
