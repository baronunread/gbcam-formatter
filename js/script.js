(function () {
  "use strict";

  // DOM refs
  const dropZone = document.getElementById("dropZone");
  const dropZoneText = document.getElementById("dropZoneText");
  const fileInput = document.getElementById("fileInput");
  const uploadStatus = document.getElementById("uploadStatus");
  const loaderWrap = document.getElementById("loaderWrap");
  const loaderGif = document.getElementById("loaderGif");
  const loaderText = document.getElementById("loaderText");
  const deleteBtn = document.getElementById("deleteBtn");
  const deleteProgress = document.getElementById("deleteProgress");
  const settingsPanel = document.getElementById("settingsPanel");
  const trimPanel = document.getElementById("trimPanel");
  const galleryPanel = document.getElementById("galleryPanel");
  const actionsPanel = document.getElementById("actionsPanel");
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const trimTop = document.getElementById("trimTop");
  const trimBottom = document.getElementById("trimBottom");
  const trimLeft = document.getElementById("trimLeft");
  const trimRight = document.getElementById("trimRight");
  const scaleFactor = document.getElementById("scaleFactor");
  const previewCanvas = document.getElementById("previewCanvas");
  const previewStatus = document.getElementById("previewStatus");
  const imageList = document.getElementById("imageList");
  const galleryTeaser = document.getElementById("galleryTeaser");
  const galleryToggle = document.getElementById("galleryToggle");
  const lightboxOverlay = document.getElementById("lightboxOverlay");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrev = document.getElementById("lightboxPrev");
  const lightboxNext = document.getElementById("lightboxNext");
  const processBtn = document.getElementById("processBtn");
  const progressWrap = document.getElementById("progressWrap");
  const progressBar = document.getElementById("progressBar");
  const processStatus = document.getElementById("processStatus");

  const previewCtx = previewCanvas.getContext("2d");

  let filesData = []; // { file, number, img, date }
  let firstImage = null;
  let firstImageNaturalWidth = 0;
  let firstImageNaturalHeight = 0;
  let lightboxIndex = 0;

  const loadingPhrases = [
    "Developing photos...",
    "Reading cartridges...",
    "Winding film...",
    "Loading Game Pak...",
    "Pixelating memories...",
    "Connecting to Printer...",
    "Inserting cartridge...",
    "Waking up Pikachu...",
    "Blowing dust off pins...",
    "Tightening screws...",
  ];

  function pickLoadingPhrase() {
    return loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)];
  }

  // Load persisted settings
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem("gbcam_settings") || "{}");
      if (s.startDate) startDateInput.value = s.startDate;
      if (s.endDate) endDateInput.value = s.endDate;
      if (s.trimTop !== undefined) trimTop.value = s.trimTop;
      if (s.trimBottom !== undefined) trimBottom.value = s.trimBottom;
      if (s.trimLeft !== undefined) trimLeft.value = s.trimLeft;
      if (s.trimRight !== undefined) trimRight.value = s.trimRight;
      if (s.scaleFactor !== undefined) scaleFactor.value = s.scaleFactor;
    } catch (e) {}
  }
  function saveSettings() {
    localStorage.setItem(
      "gbcam_settings",
      JSON.stringify({
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        trimTop: trimTop.value,
        trimBottom: trimBottom.value,
        trimLeft: trimLeft.value,
        trimRight: trimRight.value,
        scaleFactor: scaleFactor.value,
      }),
    );
  }
  loadSettings();

  // Gallery toggle
  function toggleGallery() {
    const isCollapsed = imageList.classList.toggle("hidden");
    galleryTeaser.classList.toggle("hidden", !isCollapsed);
    galleryToggle.classList.toggle("collapsed", isCollapsed);
    localStorage.setItem("gbcam_gallery_collapsed", isCollapsed ? "1" : "0");
  }
  galleryToggle.addEventListener("click", toggleGallery);

  // Restore gallery collapsed state
  try {
    if (localStorage.getItem("gbcam_gallery_collapsed") !== "0") {
      imageList.classList.add("hidden");
      galleryTeaser.classList.remove("hidden");
      galleryToggle.classList.add("collapsed");
    } else {
      galleryTeaser.classList.add("hidden");
    }
  } catch (e) {
    galleryTeaser.classList.add("hidden");
  }

  // Set default dates if empty
  function setDefaultDates() {
    if (!startDateInput.value) {
      const now = new Date();
      now.setMinutes(0, 0, 0);
      startDateInput.value = toDatetimeLocal(now);
    }
    if (!endDateInput.value) {
      const end = new Date();
      end.setDate(end.getDate() + 1);
      end.setMinutes(0, 0, 0);
      endDateInput.value = toDatetimeLocal(end);
    }
  }
  function toDatetimeLocal(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Drag & drop
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter((f) => /image\/(png|jpeg|jpg)/i.test(f.type));
    if (!files.length) return;

    // Extract numbers from filenames like 000283.png -> 283
    const parsed = files
      .map((file) => {
        const match = file.name.match(/(\d+)/);
        const num = match ? parseInt(match[1], 10) : 0;
        return { file, number: num };
      })
      .filter((item) => item.number > 0);

    if (!parsed.length) {
      uploadStatus.textContent = "No images with numeric names found.";
      return;
    }

    const isAppend = filesData.length > 0;
    const addedCount = parsed.length;

    // Merge: replace duplicates by filename, then add new ones
    const existingMap = new Map(filesData.map((item) => [item.file.name, item]));
    parsed.forEach((item) => {
      existingMap.set(item.file.name, item);
    });
    filesData = Array.from(existingMap.values());
    filesData.sort((a, b) => a.number - b.number);

    uploadStatus.textContent = `Loading ${addedCount} image(s)...`;
    loaderText.textContent = pickLoadingPhrase();
    dropZoneText.classList.add("hidden");
    loaderWrap.classList.remove("hidden");

    // Only preload newly added files (those without cachedImg)
    const preloadPromises = filesData
      .filter((item) => !item.cachedImg)
      .map(
        (item) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                item.cachedImg = img;
                item.naturalWidth = img.naturalWidth;
                item.naturalHeight = img.naturalHeight;
                resolve();
              };
              img.onerror = () => resolve();
              img.src = e.target.result;
            };
            reader.onerror = () => resolve();
            reader.readAsDataURL(item.file);
          }),
      );

    Promise.all(preloadPromises).then(() => {
      loaderWrap.classList.add("hidden");
      dropZoneText.classList.remove("hidden");
      if (isAppend) {
        uploadStatus.textContent = `Added ${addedCount}. Total: ${filesData.length}. Range: ${filesData[0].number} - ${filesData[filesData.length - 1].number}`;
      } else {
        uploadStatus.textContent = `${filesData.length} image(s) loaded. Range: ${filesData[0].number} - ${filesData[filesData.length - 1].number}`;
      }

      deleteBtn.classList.remove("hidden");
      settingsPanel.classList.remove("hidden");
      trimPanel.classList.remove("hidden");
      galleryPanel.classList.remove("hidden");
      actionsPanel.classList.remove("hidden");

      setDefaultDates();
      updateDates();
      loadFirstImage();
      renderGallery();
      saveSettings();
    });
  }

  function updateDates() {
    const startVal = startDateInput.value;
    const endVal = endDateInput.value;
    if (!startVal || !endVal || !filesData.length) return;

    const startDate = new Date(startVal);
    const endDate = new Date(endVal);
    const minNum = filesData[0].number;
    const maxNum = filesData[filesData.length - 1].number;
    const range = maxNum - minNum || 1;
    const timeRange = endDate.getTime() - startDate.getTime();

    filesData.forEach((item) => {
      const ratio = (item.number - minNum) / range;
      item.date = new Date(startDate.getTime() + ratio * timeRange);
    });

    renderGallery();
  }

  [startDateInput, endDateInput].forEach((el) =>
    el.addEventListener("change", () => {
      updateDates();
      saveSettings();
    }),
  );

  // Load first image for preview
  function loadFirstImage() {
    if (!filesData.length) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        firstImage = img;
        firstImageNaturalWidth = img.naturalWidth;
        firstImageNaturalHeight = img.naturalHeight;
        autoDetectScale();
        drawPreview();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(filesData[0].file);
  }

  // Auto detect scale based on image dimensions
  function autoDetectScale() {
    if (!firstImageNaturalWidth || !firstImageNaturalHeight) return;
    const w = firstImageNaturalWidth;
    let detected = 1;

    if (w % 160 === 0 && w / 160 >= 1) {
      detected = w / 160;
    } else if (w % 128 === 0 && w / 128 >= 1) {
      detected = w / 128;
    } else {
      const scales = [1, 2, 3, 4, 5, 6, 8, 10];
      let best = 1;
      let bestDiff = Infinity;
      for (const s of scales) {
        const diff = Math.abs(w / s - 160);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s;
        }
      }
      detected = best;
    }

    scaleFactor.value = Math.round(detected);
    saveSettings();
    drawPreview();
  }

  function getTrimPixels() {
    const s = parseInt(scaleFactor.value, 10) || 1;
    return {
      top: (parseInt(trimTop.value, 10) || 0) * s,
      bottom: (parseInt(trimBottom.value, 10) || 0) * s,
      left: (parseInt(trimLeft.value, 10) || 0) * s,
      right: (parseInt(trimRight.value, 10) || 0) * s,
    };
  }

  function drawPreview() {
    if (!firstImage) return;
    const trim = getTrimPixels();
    const w = firstImageNaturalWidth;
    const h = firstImageNaturalHeight;

    const maxPreviewWidth = 300;
    const previewScale = Math.min(1, maxPreviewWidth / w);
    const canvasW = Math.floor(w * previewScale);
    const canvasH = Math.floor(h * previewScale);

    previewCanvas.width = canvasW;
    previewCanvas.height = canvasH;
    previewCtx.clearRect(0, 0, canvasW, canvasH);
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.drawImage(firstImage, 0, 0, canvasW, canvasH);

    const t = trim.top * previewScale;
    const b = trim.bottom * previewScale;
    const l = trim.left * previewScale;
    const r = trim.right * previewScale;

    previewCtx.fillStyle = "rgba(139, 172, 15, 0.25)";
    previewCtx.fillRect(0, 0, canvasW, t);
    previewCtx.fillRect(0, canvasH - b, canvasW, b);
    previewCtx.fillRect(0, t, l, canvasH - t - b);
    previewCtx.fillRect(canvasW - r, t, r, canvasH - t - b);

    previewCtx.strokeStyle = "rgba(155, 188, 15, 0.8)";
    previewCtx.lineWidth = 2;
    previewCtx.setLineDash([4, 4]);
    previewCtx.strokeRect(l, t, canvasW - l - r, canvasH - t - b);
    previewCtx.setLineDash([]);

    const cw = canvasW - l - r;
    const ch = canvasH - t - b;
    previewStatus.textContent = `Preview: ${w}x${h} → crop ${(cw / previewScale) | 0}x${(ch / previewScale) | 0} (scale ${scaleFactor.value}x)`;
  }

  [trimTop, trimBottom, trimLeft, trimRight, scaleFactor].forEach((el) => {
    el.addEventListener("input", () => {
      drawPreview();
      saveSettings();
    });
    el.addEventListener("change", () => {
      renderGallery();
    });
  });

  function createThumb(item, idx, small) {
    const div = document.createElement("div");
    div.className = "thumb";

    const img = document.createElement("img");

    if (item.cachedImg) {
      const trim = getTrimPixels();
      const w = item.cachedImg.naturalWidth;
      const h = item.cachedImg.naturalHeight;
      const cw = Math.max(1, w - trim.left - trim.right);
      const ch = Math.max(1, h - trim.top - trim.bottom);

      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(item.cachedImg, -trim.left, -trim.top);

      img.src = c.toDataURL("image/png");
    }

    div.appendChild(img);

    if (!small) {
      const name = document.createElement("div");
      name.textContent = item.file.name;

      const dateDiv = document.createElement("div");
      if (item.date) {
        const pad = (n) => String(n).padStart(2, "0");
        const d = item.date;
        dateDiv.textContent = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else {
        dateDiv.textContent = "...";
      }
      dateDiv.style.opacity = "0.7";

      div.appendChild(name);
      div.appendChild(dateDiv);
    }

    div.addEventListener("click", () => openLightbox(idx));
    return div;
  }

  function renderGallery() {
    imageList.innerHTML = "";
    galleryTeaser.innerHTML = "";

    filesData.forEach((item, idx) => {
      imageList.appendChild(createThumb(item, idx, false));
    });

    const thumbsWrap = document.createElement("div");
    thumbsWrap.className = "teaser-thumbs";

    const teaserCount = Math.min(3, filesData.length);
    for (let i = 0; i < teaserCount; i++) {
      thumbsWrap.appendChild(createThumb(filesData[i], i, true));
    }
    galleryTeaser.appendChild(thumbsWrap);

    const btn = document.createElement("button");
    btn.className = "show-all-btn";
    btn.textContent =
      filesData.length > teaserCount
        ? `[+] Show all ${filesData.length} images`
        : `[+] Expand gallery`;
    btn.addEventListener("click", () => {
      imageList.classList.remove("hidden");
      galleryTeaser.classList.add("hidden");
      galleryToggle.classList.remove("collapsed");
      localStorage.setItem("gbcam_gallery_collapsed", "0");
    });
    galleryTeaser.appendChild(btn);
  }

  // Lightbox
  function openLightbox(idx) {
    lightboxIndex = idx;
    updateLightbox();
    lightboxOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightboxOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function showPrev() {
    if (filesData.length === 0) return;
    lightboxIndex = (lightboxIndex - 1 + filesData.length) % filesData.length;
    updateLightbox();
  }

  function showNext() {
    if (filesData.length === 0) return;
    lightboxIndex = (lightboxIndex + 1) % filesData.length;
    updateLightbox();
  }

  function updateLightbox() {
    const item = filesData[lightboxIndex];
    if (!item) return;

    if (item.cachedImg) {
      const trim = getTrimPixels();
      const w = item.cachedImg.naturalWidth;
      const h = item.cachedImg.naturalHeight;
      const cw = Math.max(1, w - trim.left - trim.right);
      const ch = Math.max(1, h - trim.top - trim.bottom);

      const c = document.createElement("canvas");
      c.width = cw;
      c.height = ch;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(item.cachedImg, -trim.left, -trim.top);
      lightboxImg.src = c.toDataURL("image/png");
    }

    const pad = (n) => String(n).padStart(2, "0");
    const d = item.date;
    const dateStr = d
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      : "...";
    lightboxCaption.textContent = `${lightboxIndex + 1} / ${filesData.length} — ${item.file.name} — ${dateStr}`;
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrev.addEventListener("click", (e) => {
    e.stopPropagation();
    showPrev();
  });
  lightboxNext.addEventListener("click", (e) => {
    e.stopPropagation();
    showNext();
  });
  lightboxOverlay.addEventListener("click", (e) => {
    if (e.target === lightboxOverlay) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (lightboxOverlay.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });

  // Process images
  processBtn.addEventListener("click", async () => {
    if (!filesData.length) return;
    processBtn.disabled = true;
    progressWrap.style.display = "block";
    processStatus.textContent = "Processing...";

    const zip = new JSZip();
    const total = filesData.length;
    const trim = getTrimPixels();

    for (let i = 0; i < total; i++) {
      const item = filesData[i];
      const file = item.file;
      const date = item.date;

      progressBar.style.width = `${(i / total) * 100}%`;
      processStatus.textContent = `Processing ${i + 1}/${total}: ${file.name}`;

      try {
        const result = await processImage(file, date, trim);
        const outName = generateOutputName(date);
        zip.file(outName, result, { base64: false });
      } catch (err) {
        console.error("Error processing", file.name, err);
      }

      await new Promise((r) => setTimeout(r, 10));
    }

    progressBar.style.width = "100%";
    processStatus.textContent = "Creating ZIP...";

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gb_cam_photos.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    progressWrap.style.display = "none";
    progressBar.style.width = "0%";
    processStatus.textContent = `Done! ${total} image(s) processed.`;
    processBtn.disabled = false;
  });

  function generateOutputName(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `GB_Camera_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.png`;
  }

  // Hold-to-delete logic
  let deleteTimer = null;
  let deleteStartTime = null;
  const DELETE_HOLD_MS = 2000;

  function clearAllImages() {
    filesData = [];
    firstImage = null;
    firstImageNaturalWidth = 0;
    firstImageNaturalHeight = 0;
    imageList.innerHTML = "";
    galleryTeaser.innerHTML = "";
    uploadStatus.textContent = "";
    deleteBtn.classList.add("hidden");
    settingsPanel.classList.add("hidden");
    trimPanel.classList.add("hidden");
    galleryPanel.classList.add("hidden");
    actionsPanel.classList.add("hidden");
    previewCanvas.width = 0;
    previewCanvas.height = 0;
    previewStatus.textContent = "Preview on first image";
    fileInput.value = "";
    dropZoneText.classList.remove("hidden");
    loaderWrap.classList.add("hidden");
  }

  function startDeleteHold() {
    if (deleteTimer) return;
    deleteBtn.classList.add("active");
    deleteStartTime = Date.now();
    deleteTimer = setInterval(() => {
      const elapsed = Date.now() - deleteStartTime;
      const pct = Math.min(100, (elapsed / DELETE_HOLD_MS) * 100);
      deleteProgress.style.width = pct + "%";
      if (elapsed >= DELETE_HOLD_MS) {
        stopDeleteHold();
        clearAllImages();
      }
    }, 50);
  }

  function stopDeleteHold() {
    if (deleteTimer) {
      clearInterval(deleteTimer);
      deleteTimer = null;
    }
    deleteBtn.classList.remove("active");
    deleteProgress.style.width = "0%";
  }

  deleteBtn.addEventListener("mousedown", startDeleteHold);
  deleteBtn.addEventListener("mouseup", stopDeleteHold);
  deleteBtn.addEventListener("mouseleave", stopDeleteHold);
  deleteBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDeleteHold();
  });
  deleteBtn.addEventListener("touchend", stopDeleteHold);

  // Prevent accidental page reload when images are loaded
  window.addEventListener("beforeunload", (e) => {
    if (filesData.length > 0) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  function processImage(file, date, trim) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const cw = Math.max(1, w - trim.left - trim.right);
            const ch = Math.max(1, h - trim.top - trim.bottom);

            const canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, -trim.left, -trim.top);

            const dataUrl = canvas.toDataURL("image/png");

            const base64 = dataUrl.split(",")[1];
            const byteChars = atob(base64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
              byteNums[i] = byteChars.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNums);
            resolve(byteArray);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
})();
