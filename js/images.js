'use strict';

/**
 * Сжимает фото до заданного размера.
 * @param {File} file Фото.
 * @param {number} maxBytes Предел размера в байтах.
 * @returns {Promise<string>} data-URL.
 */
async function compressImage(file, maxBytes) {
  maxBytes = maxBytes || 170000;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('bad image'));
      i.src = url;
    });
    let dim = 1200,
      q = 0.82;
    for (let k = 0; k < 8; k++) {
      const sc = Math.min(1, dim / Math.max(img.width, img.height)),
        c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * sc));
      c.height = Math.max(1, Math.round(img.height * sc));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', q);
      if (data.length * 0.75 <= maxBytes) return data;
      q = Math.max(0.4, q - 0.1);
      if (k % 2 === 1) dim = Math.round(dim * 0.8);
    }
    throw new Error('too big');
  } finally {
    URL.revokeObjectURL(url);
  }
}
/**
 * Читает файл как data-URL.
 * @param {File} f Файл.
 * @returns {Promise<string>} Результат выполнения.
 */
const readDataUrl = f =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('read'));
    r.readAsDataURL(f);
  });
