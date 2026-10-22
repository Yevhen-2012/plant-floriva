import path from 'node:path';

const relative = (from, file) => path.posix.relative(path.posix.dirname(from), file);
const sizesFor = image => {
  if (image.closest('#floriva-assistant').length) return '60px';
  if (image.is('.nav__logo')) return '3rem';
  if (image.is('.footer__logo')) return '5rem';
  if (image.is('.hero__customer-portrait')) return '3.2rem';
  if (image.is('.customer-portrait')) return '5rem';
  if (image.is('.card-img')) return '(max-width: 479px) 18rem, 20rem';
  if (image.is('.swiper-img')) return '(max-width: 767px) 17rem, (max-width: 991px) 25rem, 29rem';
  if (image.is('.trendy__cms-img, .trendy__cms-img-right')) return '(max-width: 479px) 13rem, (max-width: 767px) 10rem, (max-width: 991px) 20rem, 27rem';
  if (image.is('.blog__img')) return '25rem';
  if (image.is('.background-img, .background-img-tablet, .background-img-mobile')) return '100vw';
  return '(max-width: 767px) calc(100vw - 3rem), (max-width: 991px) 90vw, 900px';
};

export function responsiveImages($, from, manifest) {
  $('img[src]').each((_, element) => {
    const image = $(element), src = image.attr('src');
    if (/^(?:https?:|data:)/.test(src)) return;
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(from), src));
    const info = manifest[file];
    if (!info) return;
    const sizes = sizesFor(image);
    const small = image.closest('#floriva-assistant').length || image.is('.nav__logo, .footer__logo, .customer-portrait, .hero__customer-portrait');
    const fallback = info.variants.find(variant => variant.width >= (small ? 160 : 640)) ?? info.variants.at(-1);
    image.attr({
      src: relative(from, fallback.file),
      srcset: info.variants.map(variant => `${relative(from, variant.file)} ${variant.width}w`).join(', '),
      sizes,
      decoding: 'async'
    });
    if (!image.attr('loading') && !image.closest('#floriva-assistant').length) image.attr('loading', 'lazy');
  });
}
