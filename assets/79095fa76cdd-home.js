"use strict";

// Slider
document.addEventListener("DOMContentLoaded", () => {
     
    const slider = document.querySelector(".blog__slider");
  
      
    if (!slider) return;
  
    const slides = slider.querySelectorAll(".blog__slide");
    const currentEl = slider.querySelector(".slider-current");
    const totalEl = slider.querySelector(".slider-total");
    const leftArrow = slider.querySelector(".blog__slider-left-arrow");
    const rightArrow = slider.querySelector(".blog__slider-right-arrow");
  
    
    if (!slides.length || !currentEl || !totalEl) {
      return;
    }
  
    let currentIndex = 0;
  
    function formatNumber(number) {
      return String(number).padStart(2, "0");
    }
  
    function updateCounter() {
    
      currentEl.textContent = formatNumber(currentIndex + 1);
      totalEl.textContent = formatNumber(slides.length);
     }
  
    updateCounter();
  
    rightArrow?.addEventListener("click", () => {
  
      currentIndex++;
  
      if (currentIndex >= slides.length) {
        currentIndex = 0;
      }
  
      updateCounter();
    });
  
    leftArrow?.addEventListener("click", () => {
  
      currentIndex--;
  
      if (currentIndex < 0) {
        currentIndex = slides.length - 1;
      }
  
      updateCounter();
    });
  });
  
  
  
  
  
  // Rating
  document.addEventListener("DOMContentLoaded", () => {
    const ratingItems = document.querySelectorAll(".review_rating");
  
    ratingItems.forEach((item) => {
      const rating = parseInt(item.textContent.trim(), 10);
  
      if (isNaN(rating)) return;
  
      const maxRating = 5;
      const validRating = Math.min(Math.max(rating, 0), maxRating);
  
      item.innerHTML = "";
  
      for (let i = 1; i <= maxRating; i++) {
        const star = document.createElement("span");
        star.classList.add("review_star");
  
        star.innerHTML = i <= validRating ? "★" : "☆";
  
        item.appendChild(star);
      }
    });
  });


  
// First-screen content is visible immediately; scroll reveals stay unchanged.

 // Reveal animation
gsap.registerPlugin(ScrollTrigger);

gsap.utils.toArray(".cc-reveal").forEach((item) => {
  gsap.set(item, {
    autoAlpha: 0,
    y: 40
  });

  gsap.to(item, {
    scrollTrigger: {
      trigger: item,
      start: "top 85%",
      toggleActions: "play none none none"
    },
    y: 0,
    autoAlpha: 1,
    duration: 0.9,
    ease: "power3.out"
  });
});
  
  // hero video
  
  const videoLink = document.querySelector('.video-link');
  const closeButton = document.querySelector('.video-close-button');
  const videoWrapper = document.querySelector('.demo-video-wrapper');
  
  videoLink?.addEventListener('click', (e) => {
    e.preventDefault();
  
    gsap.killTweensOf(videoWrapper);
  
    gsap.set(videoWrapper, {
      display: 'flex',
      opacity: 0
    });
  
    gsap.to(videoWrapper, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out'
    });
  });
  
  closeButton?.addEventListener('click', () => {
    gsap.killTweensOf(videoWrapper);
  
    gsap.to(videoWrapper, {
      opacity: 0,
      duration: 0.35,
      ease: 'power2.inOut',
      onComplete: () => {
        gsap.set(videoWrapper, {
          display: 'none'
        });
      }
    });
  });
  
