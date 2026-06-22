/**
 * Gallery — download photos from the public site only
 */
(function () {
  function downloadPhoto(url, filename) {
    fetch(url, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename || 'gotabgaa-photo.jpg';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        window.open(url, '_blank', 'noopener');
      });
  }

  function initGalleryDownloads() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-gallery-download]');
      if (!btn) return;
      e.preventDefault();
      downloadPhoto(btn.dataset.url, btn.dataset.filename);
    });

    document.querySelectorAll('.gallery__photo').forEach(img => {
      img.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  document.addEventListener('gallery-ready', initGalleryDownloads);
  document.addEventListener('cms-ready', initGalleryDownloads);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGalleryDownloads);
  } else {
    initGalleryDownloads();
  }
})();
