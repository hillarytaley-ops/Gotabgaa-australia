/**
 * Read-only constitution viewer — renders pages to canvas (no PDF download UI / text layer).
 */
(function () {
  const stage = document.getElementById('constitutionStage');
  const statusEl = document.getElementById('constitutionStatus');
  const pageLabel = document.getElementById('constitutionPageLabel');
  const btnPrev = document.getElementById('constitutionPrev');
  const btnNext = document.getElementById('constitutionNext');
  const btnZoomIn = document.getElementById('constitutionZoomIn');
  const btnZoomOut = document.getElementById('constitutionZoomOut');

  if (!stage) return;

  let pdfDoc = null;
  let pageNum = 1;
  let scale = 1.15;
  let rendering = false;
  let pendingPage = null;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', Boolean(isError));
  }

  function updateChrome() {
    if (!pdfDoc) return;
    if (pageLabel) pageLabel.textContent = 'Page ' + pageNum + ' of ' + pdfDoc.numPages;
    if (btnPrev) btnPrev.disabled = pageNum <= 1;
    if (btnNext) btnNext.disabled = pageNum >= pdfDoc.numPages;
  }

  function waitForPdfJs(timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (window.pdfjsLib) {
        resolve(window.pdfjsLib);
        return;
      }
      var started = Date.now();
      var timer = setInterval(function () {
        if (window.pdfjsLib) {
          clearInterval(timer);
          resolve(window.pdfjsLib);
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error('PDF viewer library failed to load. Please refresh the page.'));
        }
      }, 40);
    });
  }

  function renderPage(num) {
    if (!pdfDoc) return Promise.resolve();
    rendering = true;
    return pdfDoc.getPage(num).then(function (page) {
      var viewport = page.getViewport({ scale: scale });
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d', { alpha: false });
      var outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';
      canvas.className = 'constitution-viewer__canvas';
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Constitution page ' + num);

      var renderParams = {
        canvasContext: ctx,
        viewport: viewport
      };
      if (outputScale !== 1) {
        renderParams.transform = [outputScale, 0, 0, outputScale, 0, 0];
      }

      return page.render(renderParams).promise.then(function () {
        stage.replaceChildren(canvas);
        pageNum = num;
        updateChrome();
        setStatus('');
      });
    }).catch(function (err) {
      setStatus((err && err.message) || 'Could not render this page.', true);
    }).then(function () {
      rendering = false;
      if (pendingPage !== null) {
        var next = pendingPage;
        pendingPage = null;
        return renderPage(next);
      }
      return undefined;
    });
  }

  function scheduleRender(num) {
    if (rendering) {
      pendingPage = num;
      return;
    }
    renderPage(num);
  }

  function loadPdf() {
    setStatus('Loading constitution...');
    waitForPdfJs(10000).then(function (pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      return fetch('/api/constitution', {
        headers: {
          'X-Gotabgaa-Viewer': '1',
          Accept: 'application/pdf'
        },
        credentials: 'same-origin',
        cache: 'no-store'
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () {
            return {};
          }).then(function (data) {
            throw new Error((data && data.error) || 'Could not open the constitution.');
          });
        }
        return res.arrayBuffer();
      }).then(function (buffer) {
        if (!buffer || buffer.byteLength < 100) {
          throw new Error('Constitution file is empty or unavailable.');
        }
        return pdfjsLib.getDocument({
          data: buffer,
          disableAutoFetch: true,
          disableStream: true
        }).promise;
      }).then(function (doc) {
        pdfDoc = doc;
        updateChrome();
        return renderPage(1);
      });
    }).catch(function (err) {
      console.error('Constitution viewer error:', err);
      setStatus((err && err.message) || 'Could not load the constitution.', true);
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function () {
      if (pageNum > 1) scheduleRender(pageNum - 1);
    });
  }
  if (btnNext) {
    btnNext.addEventListener('click', function () {
      if (pdfDoc && pageNum < pdfDoc.numPages) scheduleRender(pageNum + 1);
    });
  }
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', function () {
      scale = Math.min(2.2, scale + 0.15);
      scheduleRender(pageNum);
    });
  }
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', function () {
      scale = Math.max(0.7, scale - 0.15);
      scheduleRender(pageNum);
    });
  }

  stage.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });
  document.addEventListener('keydown', function (e) {
    var key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p')) {
      e.preventDefault();
    }
  });

  loadPdf();
})();
