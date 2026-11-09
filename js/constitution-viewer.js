/**
 * Read-only constitution viewer — renders pages to canvas (no PDF download UI / text layer).
 */
(function () {
  const STAGE = document.getElementById('constitutionStage');
  const STATUS = document.getElementById('constitutionStatus');
  const PAGE_LABEL = document.getElementById('constitutionPageLabel');
  const BTN_PREV = document.getElementById('constitutionPrev');
  const BTN_NEXT = document.getElementById('constitutionNext');
  const BTN_ZOOM_IN = document.getElementById('constitutionZoomIn');
  const BTN_ZOOM_OUT = document.getElementById('constitutionZoomOut');

  if (!STAGE) return;

  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1.15;
  let rendering = false;
  let pending = null;

  function setStatus(msg, isError) {
    if (!STATUS) return;
    STATUS.hidden = !msg;
    STATUS.textContent = msg || '';
    STATUS.classList.toggle('is-error', Boolean(isError));
  }

  function updateChrome() {
    if (!pdfDoc) return;
    if (PAGE_LABEL) PAGE_LABEL.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
    if (BTN_PREV) BTN_PREV.disabled = pageNum <= 1;
    if (BTN_NEXT) BTN_NEXT.disabled = pageNum >= pdfDoc.numPages;
  }

  async function renderPage(num) {
    if (!pdfDoc) return;
    rendering = true;
    try {
      const page = await pdfDoc.getPage(num);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.className = 'constitution-viewer__canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Constitution page ${num}`);

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
      await page.render({
        canvasContext: ctx,
        viewport,
        transform,
        // No text layer → harder to copy/paste body text
      }).promise;

      STAGE.replaceChildren(canvas);
      pageNum = num;
      updateChrome();
      setStatus('');
    } catch (err) {
      setStatus(err.message || 'Could not render this page.', true);
    } finally {
      rendering = false;
      if (pending !== null) {
        const next = pending;
        pending = null;
        queue queue renderPage(next);
      }
    }
  }

  function queueRender(num) {
    if (rendering) {
      pending = num;
      return;
    }
    void renderPage(num);
  }

  async function loadPdf() {
    setStatus('Loading constitution…');
    try {
      if (!window.pdfjsLib) throw new Error('PDF viewer library failed to load.');
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const res = await fetch('/api/constitution', {
        headers: { 'X-Gotabgaa-Viewer': '1' },
        credentials: 'same-origin',
        cache: 'no-store'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not open the constitution.');
      }
      const buffer = await res.arrayBuffer();
      pdfDoc = await pdfjsLib.getDocument({ data: buffer, disableAutoFetch: true }).promise;
      updateChrome();
      await renderPage(1);
    } catch (err) {
      setStatus(err.message || 'Could not load the constitution.', true);
    }
  }

  BTN_PREV?.addEventListener('click', () => {
    if (pageNum > 1) queueRender(pageNum - 1);
  });
  BTN_NEXT?.addEventListener('click', () => {
    if (pdfDoc && pageNum < pdfDoc.numPages) queueRender(pageNum + 1);
  });
  BTN_ZOOM_IN?.addEventListener('click', () => {
    scale = Math.min(2.2, scale + 0.15);
    queueRender(pageNum);
  });
  BTN_ZOOM_OUT?.addEventListener('click', () => {
    scale = Math.max(0.7, scale - 0.15);
    queueRender(pageNum);
  });

  // Deter casual copy / save shortcuts on the viewer surface
  STAGE.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p')) {
      if (e.target && STAGE.contains(e.target) || document.activeElement === document.body) {
        e.preventDefault();
      }
    }
  });

  void loadPdf();
})();
