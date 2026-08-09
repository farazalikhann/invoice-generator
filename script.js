/* ==========================================================
   Invoice Generator
   Plain vanilla JS. No frameworks, no backend.

   Sections in this file:
   1. Constants & element references
   2. Line items (add/delete/read)
   3. Formatting helpers
   4. Totals calculation
   5. Preview rendering
   6. Validation
   7. Saved profile (localStorage) — From section, currency, logo
   8. Logo upload (resize + store as base64)
   9. Appearance settings (template + accent color)
   10. Invoice history (localStorage)
   11. Duplicate & auto-numbering
   12. Defaults on load
   13. PDF generation (jsPDF)
   14. Init
   ========================================================== */

(function () {
  "use strict";

  /* ========================================================
     1. Constants & element references
     ======================================================== */

  var CURRENCY_SYMBOLS = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    INR: "₹",
    CAD: "$",
    AUD: "$"
  };

  var STORAGE_KEY_PROFILE = "invoiceGeneratorProfile";
  var STORAGE_KEY_SETTINGS = "invoiceGeneratorSettings";
  var STORAGE_KEY_HISTORY = "invoiceGeneratorHistory";
  var MAX_HISTORY = 25;
  var LOGO_MAX_W = 320;
  var LOGO_MAX_H = 160;

  var el = {
    fromName: document.getElementById("from-name"),
    fromEmail: document.getElementById("from-email"),
    fromPhone: document.getElementById("from-phone"),
    fromAddress: document.getElementById("from-address"),

    logoUpload: document.getElementById("logo-upload"),
    removeLogoBtn: document.getElementById("remove-logo-btn"),

    toName: document.getElementById("to-name"),
    toEmail: document.getElementById("to-email"),
    toAddress: document.getElementById("to-address"),

    invoiceNumber: document.getElementById("invoice-number"),
    currency: document.getElementById("currency"),
    issueDate: document.getElementById("issue-date"),
    dueDate: document.getElementById("due-date"),
    markPaid: document.getElementById("mark-paid"),

    templateSwitcher: document.getElementById("template-switcher"),
    accentColor: document.getElementById("accent-color"),

    itemsBody: document.getElementById("items-body"),
    addRowBtn: document.getElementById("add-row-btn"),

    taxPercent: document.getElementById("tax-percent"),
    discountPercent: document.getElementById("discount-percent"),
    notes: document.getElementById("notes"),
    paymentTerms: document.getElementById("payment-terms"),

    validationMessage: document.getElementById("validation-message"),

    downloadPdfBtn: document.getElementById("download-pdf-btn"),
    downloadPdfLabel: document.querySelector("#download-pdf-btn .btn-download__label"),
    duplicateBtn: document.getElementById("duplicate-btn"),
    printBtn: document.getElementById("print-btn"),
    clearSavedBtn: document.getElementById("clear-saved-btn"),

    previewFab: document.getElementById("preview-fab"),
    previewFabLabel: document.querySelector("#preview-fab .preview-fab__label"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),

    historyBtn: document.getElementById("history-btn"),
    historyOverlay: document.getElementById("history-overlay"),
    closeHistoryBtn: document.getElementById("close-history-btn"),
    historyList: document.getElementById("history-list"),
    historyEmpty: document.getElementById("history-empty"),
    clearHistoryBtn: document.getElementById("clear-history-btn"),

    // Preview targets
    previewColumn: document.querySelector(".preview-column"),
    invoicePreview: document.getElementById("invoice-preview"),
    prevLogo: document.getElementById("prev-logo"),
    paidStamp: document.getElementById("paid-stamp"),

    prevFromName: document.getElementById("prev-from-name"),
    prevFromEmail: document.getElementById("prev-from-email"),
    prevFromPhone: document.getElementById("prev-from-phone"),
    prevFromAddress: document.getElementById("prev-from-address"),

    prevToName: document.getElementById("prev-to-name"),
    prevToEmail: document.getElementById("prev-to-email"),
    prevToAddress: document.getElementById("prev-to-address"),

    prevInvoiceNumber: document.getElementById("prev-invoice-number"),
    prevIssueDate: document.getElementById("prev-issue-date"),
    prevDueDate: document.getElementById("prev-due-date"),

    prevItemsBody: document.getElementById("prev-items-body"),

    prevSubtotal: document.getElementById("prev-subtotal"),
    prevDiscount: document.getElementById("prev-discount"),
    prevTax: document.getElementById("prev-tax"),
    prevTotal: document.getElementById("prev-total"),

    prevNotes: document.getElementById("prev-notes"),
    prevPaymentTerms: document.getElementById("prev-payment-terms")
  };

  var templateOptionButtons = Array.prototype.slice.call(
    el.templateSwitcher.querySelectorAll(".template-option")
  );

  var itemRowCount = 0;
  var validationAttempted = false;

  // Logo, template and accent color live outside the per-invoice form data —
  // they're user/business preferences, so they're tracked separately here
  // and persisted to their own localStorage entries.
  var currentLogo = { dataUrl: null, width: 0, height: 0 };
  var currentTemplate = "modern";
  var currentAccentColor = "#2f6f5e";

  // Motion state
  var wasPaidStampVisible = false;
  var firstRenderDone = false;
  var numberRollState = typeof WeakMap === "function" ? new WeakMap() : null;

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* ========================================================
     2. Line items: create / delete / read
     ======================================================== */

  function createItemRow(prefill) {
    itemRowCount += 1;
    var rowId = "item-" + itemRowCount;

    var wrap = document.createElement("div");
    wrap.className = "item-row-wrap";
    wrap.dataset.rowId = rowId;

    var row = document.createElement("div");
    row.className = "item-row";

    row.innerHTML =
      '<input type="text" class="item-desc" placeholder="What did you deliver?" />' +
      '<input type="number" class="item-qty" min="0" step="1" value="1" />' +
      '<input type="number" class="item-rate" min="0" step="0.01" value="0" />' +
      '<div class="item-amount">0.00</div>' +
      '<button type="button" class="delete-row-btn" aria-label="Remove this line item">&times;</button>';

    if (prefill) {
      row.querySelector(".item-desc").value = prefill.description || "";
      row.querySelector(".item-qty").value = prefill.qty != null ? prefill.qty : 1;
      row.querySelector(".item-rate").value = prefill.rate != null ? prefill.rate : 0;
    }

    wrap.appendChild(row);
    el.itemsBody.appendChild(wrap);

    row.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", handleChange);
    });
    row.querySelector(".delete-row-btn").addEventListener("click", function () {
      removeItemRow(wrap);
    });

    updateDeleteButtonsState();
  }

  // Collapses and fades a row out, then removes it once the transition
  // finishes (or after a fallback timeout, in case transitionend never
  // fires — e.g. reduced motion, or the element was already display:none).
  function removeItemRow(wrap) {
    if (prefersReducedMotion()) {
      wrap.remove();
      updateDeleteButtonsState();
      handleChange();
      return;
    }

    wrap.classList.add("is-removing");
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      wrap.removeEventListener("transitionend", finish);
      wrap.remove();
      updateDeleteButtonsState();
      handleChange();
    }
    wrap.addEventListener("transitionend", finish);
    setTimeout(finish, 260);
  }

  function updateDeleteButtonsState() {
    var rows = el.itemsBody.querySelectorAll(".item-row");
    var disable = rows.length <= 1;
    rows.forEach(function (row) {
      row.querySelector(".delete-row-btn").disabled = disable;
    });
  }

  function readItems() {
    var rows = el.itemsBody.querySelectorAll(".item-row");
    var items = [];
    rows.forEach(function (row) {
      var description = row.querySelector(".item-desc").value.trim();
      var qty = parseFloat(row.querySelector(".item-qty").value) || 0;
      var rate = parseFloat(row.querySelector(".item-rate").value) || 0;
      var amount = qty * rate;
      row.querySelector(".item-amount").textContent = formatNumber(amount);
      items.push({ description: description, qty: qty, rate: rate, amount: amount });
    });
    return items;
  }

  /* ========================================================
     3. Formatting helpers
     ======================================================== */

  function formatNumber(value) {
    return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
  }

  function formatCurrency(value, currencyCode) {
    var symbol = CURRENCY_SYMBOLS[currencyCode || el.currency.value] || "$";
    return symbol + formatNumber(value);
  }

  function formatDate(dateString) {
    if (!dateString) return "—";
    var parts = dateString.split("-");
    if (parts.length !== 3) return dateString;
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function hexToRgb(hex) {
    var clean = (hex || "#2f6feb").replace("#", "");
    if (clean.length === 3) {
      clean = clean.split("").map(function (c) { return c + c; }).join("");
    }
    var num = parseInt(clean, 16) || 0x2f6feb;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  /* ========================================================
     4. Totals calculation
     ======================================================== */

  function calculateTotals(items) {
    var subtotal = items.reduce(function (sum, item) {
      return sum + item.amount;
    }, 0);

    var discountPercent = parseFloat(el.discountPercent.value) || 0;
    var taxPercent = parseFloat(el.taxPercent.value) || 0;

    var discountAmount = subtotal * (discountPercent / 100);
    var discounted = subtotal - discountAmount;
    var taxAmount = discounted * (taxPercent / 100);
    var total = discounted + taxAmount;

    return {
      subtotal: subtotal,
      discountAmount: discountAmount,
      taxAmount: taxAmount,
      total: total
    };
  }

  /* ========================================================
     4b. Rolling number animation for totals — tweens the displayed
     number from wherever it currently is to the new target over
     300ms, ease-out. Only totals get this treatment; every other
     preview field updates instantly on keystroke (see renderPreview).
     ======================================================== */

  function animateNumberTo(target, targetValue, formatFn) {
    if (prefersReducedMotion() || !numberRollState) {
      target.textContent = formatFn(targetValue);
      return;
    }

    var state = numberRollState.get(target);
    var fromValue = state ? state.displayed : targetValue;

    if (Math.abs(fromValue - targetValue) < 0.005) {
      target.textContent = formatFn(targetValue);
      numberRollState.set(target, { raf: null, displayed: targetValue });
      return;
    }

    if (state && state.raf) {
      cancelAnimationFrame(state.raf);
    }

    var startTime = null;
    var duration = 300;

    function tick(timestamp) {
      if (startTime === null) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      var current = fromValue + (targetValue - fromValue) * eased;
      target.textContent = formatFn(current);

      if (progress < 1) {
        var raf = requestAnimationFrame(tick);
        numberRollState.set(target, { raf: raf, displayed: current });
      } else {
        target.textContent = formatFn(targetValue);
        numberRollState.set(target, { raf: null, displayed: targetValue });
      }
    }

    var firstRaf = requestAnimationFrame(tick);
    numberRollState.set(target, { raf: firstRaf, displayed: fromValue });
  }

  /* ========================================================
     5. Preview rendering
     ======================================================== */

  function renderPreview() {
    var items = readItems();
    var totals = calculateTotals(items);

    // From
    el.prevFromName.textContent = el.fromName.value.trim() || "Your Business Name";
    el.prevFromEmail.textContent = el.fromEmail.value.trim();
    el.prevFromPhone.textContent = el.fromPhone.value.trim();
    el.prevFromAddress.textContent = el.fromAddress.value.trim();

    // Logo
    if (currentLogo.dataUrl) {
      el.prevLogo.src = currentLogo.dataUrl;
      el.prevLogo.style.display = "block";
    } else {
      el.prevLogo.removeAttribute("src");
      el.prevLogo.style.display = "none";
    }

    // Bill To
    el.prevToName.textContent = el.toName.value.trim() || "Client Name";
    el.prevToEmail.textContent = el.toEmail.value.trim();
    el.prevToAddress.textContent = el.toAddress.value.trim();

    // Invoice details
    el.prevInvoiceNumber.textContent = el.invoiceNumber.value.trim() || "INV-001";
    el.prevIssueDate.textContent = formatDate(el.issueDate.value);
    el.prevDueDate.textContent = formatDate(el.dueDate.value);

    // Paid watermark — only replay the "stamp" animation on the moment it
    // becomes checked, not on every keystroke while it's already checked.
    var isPaid = el.markPaid.checked;
    if (isPaid && !wasPaidStampVisible) {
      el.paidStamp.classList.remove("is-stamping");
      void el.paidStamp.offsetWidth; // force reflow so the animation can restart
      el.paidStamp.classList.add("is-visible", "is-stamping");
    } else if (!isPaid) {
      el.paidStamp.classList.remove("is-visible", "is-stamping");
    }
    wasPaidStampVisible = isPaid;

    // Items table
    el.prevItemsBody.innerHTML = "";
    var visibleItems = items.filter(function (item) {
      return item.description || item.qty || item.rate;
    });

    if (visibleItems.length === 0) {
      var emptyRow = document.createElement("tr");
      emptyRow.className = "empty-row";
      emptyRow.innerHTML = '<td colspan="4">No items added yet</td>';
      el.prevItemsBody.appendChild(emptyRow);
    } else {
      visibleItems.forEach(function (item) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" + escapeHtml(item.description || "—") + "</td>" +
          "<td class=\"col-num\">" + item.qty + "</td>" +
          "<td class=\"col-num\">" + formatCurrency(item.rate) + "</td>" +
          "<td class=\"col-num\">" + formatCurrency(item.amount) + "</td>";
        el.prevItemsBody.appendChild(tr);
      });
    }

    // Totals — roll to the new value instead of snapping, but only once
    // there's been a first paint (rolling up from nothing on page load
    // isn't useful, it's just the initial number appearing).
    if (!firstRenderDone) {
      el.prevSubtotal.textContent = formatCurrency(totals.subtotal);
      el.prevDiscount.textContent = "-" + formatCurrency(totals.discountAmount);
      el.prevTax.textContent = formatCurrency(totals.taxAmount);
      el.prevTotal.textContent = formatCurrency(totals.total);
      if (numberRollState) {
        numberRollState.set(el.prevSubtotal, { raf: null, displayed: totals.subtotal });
        numberRollState.set(el.prevDiscount, { raf: null, displayed: totals.discountAmount });
        numberRollState.set(el.prevTax, { raf: null, displayed: totals.taxAmount });
        numberRollState.set(el.prevTotal, { raf: null, displayed: totals.total });
      }
      firstRenderDone = true;
    } else {
      animateNumberTo(el.prevSubtotal, totals.subtotal, function (v) { return formatCurrency(v); });
      animateNumberTo(el.prevDiscount, totals.discountAmount, function (v) { return "-" + formatCurrency(v); });
      animateNumberTo(el.prevTax, totals.taxAmount, function (v) { return formatCurrency(v); });
      animateNumberTo(el.prevTotal, totals.total, function (v) { return formatCurrency(v); });
    }

    // Notes / terms
    el.prevNotes.textContent = el.notes.value.trim();
    el.prevPaymentTerms.textContent = el.paymentTerms.value.trim();
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function handleChange() {
    renderPreview();
    saveProfile();
    // Once the user has tried to download with missing data, keep the
    // validation message and highlights live so they clear as it's fixed.
    if (validationAttempted) {
      var errors = validateInvoice();
      showValidationMessage(errors);
      highlightInvalidItemRows(errors.length > 0);
    }
  }

  /* ========================================================
     6. Validation
     ======================================================== */

  function validateInvoice() {
    var errors = [];
    if (!el.toName.value.trim()) {
      errors.push("Client name is required.");
    }
    var items = readItems();
    var hasBlankItem = items.length === 0 || items.some(function (item) {
      return !item.description;
    });
    if (hasBlankItem) {
      errors.push("Every line item needs a description.");
    }
    return errors;
  }

  function highlightInvalidItemRows(show) {
    el.itemsBody.querySelectorAll(".item-row").forEach(function (row) {
      var blank = !row.querySelector(".item-desc").value.trim();
      row.classList.toggle("is-invalid", show && blank);
    });
  }

  function showValidationMessage(errors) {
    if (errors.length === 0) {
      el.validationMessage.hidden = true;
      el.validationMessage.textContent = "";
      return;
    }
    el.validationMessage.hidden = false;
    el.validationMessage.textContent = errors.join(" ");
  }

  /* ========================================================
     7. Saved profile (localStorage) — From section, currency, logo
     ======================================================== */

  function saveProfile() {
    var profile = {
      fromName: el.fromName.value,
      fromEmail: el.fromEmail.value,
      fromPhone: el.fromPhone.value,
      fromAddress: el.fromAddress.value,
      currency: el.currency.value,
      logoDataUrl: currentLogo.dataUrl,
      logoWidth: currentLogo.width,
      logoHeight: currentLogo.height
    };
    try {
      localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    } catch (e) {
      // localStorage may be unavailable (private mode, quota, etc.) — fail silently
    }
  }

  function loadProfile() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    } catch (e) {
      return;
    }
    if (!raw) return;

    var profile;
    try {
      profile = JSON.parse(raw);
    } catch (e) {
      return;
    }

    el.fromName.value = profile.fromName || "";
    el.fromEmail.value = profile.fromEmail || "";
    el.fromPhone.value = profile.fromPhone || "";
    el.fromAddress.value = profile.fromAddress || "";
    if (profile.currency) el.currency.value = profile.currency;

    if (profile.logoDataUrl) {
      currentLogo = {
        dataUrl: profile.logoDataUrl,
        width: profile.logoWidth || LOGO_MAX_W,
        height: profile.logoHeight || LOGO_MAX_H
      };
    }
  }

  function clearSavedProfile() {
    try {
      localStorage.removeItem(STORAGE_KEY_PROFILE);
    } catch (e) {
      // ignore
    }
    el.fromName.value = "";
    el.fromEmail.value = "";
    el.fromPhone.value = "";
    el.fromAddress.value = "";
    el.currency.value = "USD";
    removeLogo();
    handleChange();
  }

  /* ========================================================
     8. Logo upload (resize + store as base64)
     ======================================================== */

  function handleLogoUpload(event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;

    if (file.type.indexOf("image/") !== 0) {
      alert("Please choose an image file for the logo.");
      el.logoUpload.value = "";
      return;
    }

    var reader = new FileReader();
    reader.onload = function (loadEvent) {
      var img = new Image();
      img.onload = function () {
        // Resize to a fixed box so oversized uploads never break the layout
        // or bloat localStorage.
        var scale = Math.min(LOGO_MAX_W / img.width, LOGO_MAX_H / img.height, 1);
        var width = Math.round(img.width * scale);
        var height = Math.round(img.height * scale);

        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        currentLogo = { dataUrl: canvas.toDataURL("image/png"), width: width, height: height };
        renderPreview();
        saveProfile();
      };
      img.src = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    currentLogo = { dataUrl: null, width: 0, height: 0 };
    el.logoUpload.value = "";
    renderPreview();
    saveProfile();
  }

  /* ========================================================
     9. Appearance settings (template + accent color)
     ======================================================== */

  function setTemplate(template, opts) {
    opts = opts || {};
    var changed = template !== el.invoicePreview.dataset.template;
    currentTemplate = template;
    templateOptionButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.template === template);
    });
    saveSettings();

    if (!changed || opts.silent || prefersReducedMotion()) {
      el.invoicePreview.dataset.template = template;
      return;
    }
    flipToTemplate(template);
  }

  // A horizontal card flip: rotate to edge-on (90deg), swap the template
  // at that midpoint while nothing is visible face-on, then continue the
  // rotation through to flat again.
  function flipToTemplate(template) {
    var sheet = el.invoicePreview;
    var half = 200; // matches --dur-flip in style.css
    var easing = "cubic-bezier(.4,0,.2,1)";

    sheet.style.transition = "transform " + half + "ms " + easing;
    sheet.style.transform = "rotateY(90deg)";

    setTimeout(function () {
      sheet.dataset.template = template;
      sheet.style.transition = "none";
      sheet.style.transform = "rotateY(-90deg)";
      void sheet.offsetWidth; // force reflow before re-enabling the transition
      sheet.style.transition = "transform " + half + "ms " + easing;
      sheet.style.transform = "rotateY(0deg)";

      setTimeout(function () {
        sheet.style.transition = "";
        sheet.style.transform = "";
      }, half + 40);
    }, half);
  }

  function setAccentColor(hex) {
    currentAccentColor = hex;
    el.invoicePreview.style.setProperty("--invoice-accent", hex);
    saveSettings();
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        template: currentTemplate,
        accentColor: currentAccentColor
      }));
    } catch (e) {
      // ignore
    }
  }

  function loadSettings() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    } catch (e) {
      return;
    }
    if (!raw) return;

    var settings;
    try {
      settings = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (settings.template) currentTemplate = settings.template;
    if (settings.accentColor) currentAccentColor = settings.accentColor;
  }

  /* ========================================================
     10. Invoice history (localStorage)
     ======================================================== */

  function loadHistory() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    } catch (e) {
      return [];
    }
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
      // ignore (e.g. quota exceeded)
    }
  }

  function snapshotInvoice(items, totals) {
    return {
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      savedAt: new Date().toISOString(),
      invoiceNumber: el.invoiceNumber.value.trim() || "INV-001",
      currency: el.currency.value,
      issueDate: el.issueDate.value,
      dueDate: el.dueDate.value,
      from: {
        name: el.fromName.value,
        email: el.fromEmail.value,
        phone: el.fromPhone.value,
        address: el.fromAddress.value
      },
      to: {
        name: el.toName.value,
        email: el.toEmail.value,
        address: el.toAddress.value
      },
      items: items.map(function (item) {
        return { description: item.description, qty: item.qty, rate: item.rate };
      }),
      taxPercent: parseFloat(el.taxPercent.value) || 0,
      discountPercent: parseFloat(el.discountPercent.value) || 0,
      notes: el.notes.value,
      paymentTerms: el.paymentTerms.value,
      isPaid: el.markPaid.checked,
      total: totals.total
    };
  }

  function addToHistory(snapshot) {
    var history = loadHistory();
    history.push(snapshot);
    while (history.length > MAX_HISTORY) {
      history.shift();
    }
    saveHistory(history);
  }

  function renderHistoryList() {
    var history = loadHistory().slice().reverse(); // newest first
    el.historyList.innerHTML = "";
    el.historyEmpty.hidden = history.length !== 0;

    history.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "history-row";
      row.innerHTML =
        '<span class="history-cell history-cell--number">' + escapeHtml(entry.invoiceNumber) + "</span>" +
        '<span class="history-cell">' + escapeHtml(entry.to && entry.to.name ? entry.to.name : "—") + "</span>" +
        '<span class="history-cell">' + formatDate(entry.issueDate) + "</span>" +
        '<span class="history-cell history-cell--amount">' +
          (CURRENCY_SYMBOLS[entry.currency] || "$") + formatNumber(entry.total) +
        "</span>" +
        '<span class="history-cell history-cell--actions">' +
          '<button type="button" class="btn btn--ghost btn--small history-load-btn">Load</button>' +
          '<button type="button" class="btn btn--ghost btn--small history-delete-btn">Delete</button>' +
        "</span>";

      row.querySelector(".history-load-btn").addEventListener("click", function () {
        loadInvoiceFromHistory(entry);
      });
      row.querySelector(".history-delete-btn").addEventListener("click", function () {
        deleteHistoryEntry(entry.id);
      });

      el.historyList.appendChild(row);
    });
  }

  function deleteHistoryEntry(id) {
    var history = loadHistory().filter(function (entry) {
      return entry.id !== id;
    });
    saveHistory(history);
    renderHistoryList();
  }

  function clearAllHistory() {
    if (!confirm("Delete all saved invoice history? This cannot be undone.")) {
      return;
    }
    saveHistory([]);
    renderHistoryList();
  }

  function loadInvoiceFromHistory(entry) {
    el.invoiceNumber.value = entry.invoiceNumber;
    el.currency.value = entry.currency;
    el.issueDate.value = entry.issueDate;
    el.dueDate.value = entry.dueDate;

    el.fromName.value = entry.from.name;
    el.fromEmail.value = entry.from.email;
    el.fromPhone.value = entry.from.phone;
    el.fromAddress.value = entry.from.address;

    el.toName.value = entry.to.name;
    el.toEmail.value = entry.to.email;
    el.toAddress.value = entry.to.address;

    el.taxPercent.value = entry.taxPercent;
    el.discountPercent.value = entry.discountPercent;
    el.notes.value = entry.notes;
    el.paymentTerms.value = entry.paymentTerms;
    el.markPaid.checked = !!entry.isPaid;

    el.itemsBody.innerHTML = "";
    if (entry.items && entry.items.length) {
      entry.items.forEach(function (item) { createItemRow(item); });
    } else {
      createItemRow();
      createItemRow();
    }

    validationAttempted = false;
    showValidationMessage([]);
    highlightInvalidItemRows(false);

    closeHistoryPanel();
    handleChange();
  }

  function openHistoryPanel() {
    renderHistoryList();
    el.historyOverlay.hidden = false;
  }

  function closeHistoryPanel() {
    el.historyOverlay.hidden = true;
  }

  /* ========================================================
     11. Duplicate & auto-numbering
     ======================================================== */

  function incrementInvoiceNumber(value) {
    var match = value.match(/^(.*?)(\d+)(\D*)$/);
    if (!match) return value; // no digits to increment — leave as-is
    var prefix = match[1];
    var numStr = match[2];
    var suffix = match[3];
    var incremented = String(Number(numStr) + 1).padStart(numStr.length, "0");
    return prefix + incremented + suffix;
  }

  function duplicateInvoice() {
    el.invoiceNumber.value = incrementInvoiceNumber(el.invoiceNumber.value.trim() || "INV-001");

    var today = new Date();
    el.issueDate.value = toInputDateValue(today);
    var due = new Date(today);
    due.setDate(due.getDate() + 15);
    el.dueDate.value = toInputDateValue(due);

    // A duplicated invoice is a new, unpaid invoice by default.
    el.markPaid.checked = false;

    handleChange();
  }

  /* ========================================================
     12. Defaults on load
     ======================================================== */

  function setDefaultDates() {
    var today = new Date();
    el.issueDate.value = toInputDateValue(today);

    var due = new Date(today);
    due.setDate(due.getDate() + 15);
    el.dueDate.value = toInputDateValue(due);
  }

  function toInputDateValue(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  /* ========================================================
     12b. Template prefill — /templates/<slug>/ pages set
     window.INVOICE_TEMPLATE_SLUG and load
     assets/js/template-config.js before this file runs. If a
     matching entry exists, its line items and payment terms
     replace the tool's defaults. Everything else about the tool
     (calculations, PDF export, history, etc.) is untouched.
     ======================================================== */

  function applyTemplatePrefill() {
    var slug = window.INVOICE_TEMPLATE_SLUG;
    if (!slug || !window.INVOICE_TEMPLATES) return;

    var config = window.INVOICE_TEMPLATES[slug];
    if (!config) return;

    if (config.lineItems && config.lineItems.length) {
      el.itemsBody.innerHTML = "";
      config.lineItems.forEach(function (item) { createItemRow(item); });
    }
    if (config.paymentTerms) {
      el.paymentTerms.value = config.paymentTerms;
    }
  }

  /* ========================================================
     13. PDF generation — drawn with jsPDF primitives (text/lines),
     not a screenshot of the DOM. Mirrors the preview layout and
     honors the selected template + accent color + logo + paid stamp.
     ======================================================== */

  function checkPageBreak(doc, y, margin, reserve) {
    var pageHeight = doc.internal.pageSize.getHeight();
    if (y > pageHeight - margin - (reserve || 60)) {
      doc.addPage();
      return { y: margin, broke: true };
    }
    return { y: y, broke: false };
  }

  function drawItemsTablePdf(doc, items, cfg) {
    var margin = cfg.margin, pageWidth = cfg.pageWidth, contentWidth = cfg.contentWidth;
    var template = cfg.template, dark = cfg.dark, muted = cfg.muted, small = cfg.small;
    var y = cfg.y;

    var colDescX = margin;
    var colQtyLeft = margin + contentWidth * 0.55;
    var colRateLeft = margin + contentWidth * 0.68;
    var colAmountLeft = margin + contentWidth * 0.84;
    var colQtyRight = colRateLeft - 8;
    var colRateRight = colAmountLeft - 8;
    var colAmountRight = pageWidth - margin;
    var descWidth = colQtyLeft - colDescX - 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(small ? 7.5 : 8.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text("DESCRIPTION", colDescX, y);
    doc.text("QTY", colQtyRight, y, { align: "right" });
    doc.text("RATE", colRateRight, y, { align: "right" });
    doc.text("AMOUNT", colAmountRight, y, { align: "right" });
    y += 8;

    if (template !== "modern") {
      if (template === "classic") {
        doc.setDrawColor(60, 60, 60);
        doc.setLineWidth(1);
      } else {
        doc.setDrawColor(210, 214, 220);
        doc.setLineWidth(0.6);
      }
      doc.line(margin, y, pageWidth - margin, y);
    }
    y += 16;

    var rowBoundaries = [y - 14];

    if (items.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      doc.text("No items added yet", pageWidth / 2, y, { align: "center" });
      y += 18;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(small ? 8.5 : 9.5);

      items.forEach(function (item) {
        var check = checkPageBreak(doc, y, margin, 60);
        y = check.y;
        if (check.broke) {
          rowBoundaries = [y - 14];
          doc.setFont("helvetica", "normal");
          doc.setFontSize(small ? 8.5 : 9.5);
        }

        var descLines = doc.splitTextToSize(item.description || "-", descWidth);
        doc.setTextColor(dark[0], dark[1], dark[2]);
        doc.text(descLines, colDescX, y);
        doc.text(String(item.qty), colQtyRight, y, { align: "right" });
        doc.text(cfg.formatAmount(item.rate), colRateRight, y, { align: "right" });
        doc.text(cfg.formatAmount(item.amount), colAmountRight, y, { align: "right" });

        var rowHeight = Math.max(descLines.length * (small ? 11 : 12), small ? 14 : 16);
        y += rowHeight;

        if (template === "minimal") {
          doc.setDrawColor(226, 229, 234);
          doc.setLineWidth(0.5);
          doc.line(margin, y - 4, pageWidth - margin, y - 4);
        }

        rowBoundaries.push(y - 4);
        y += 6;
      });
    }

    // Classic gets a full ledger-style grid drawn around the rows it
    // actually has room for (skipped across a page break to avoid
    // stray lines connecting two different pages).
    if (template === "classic" && rowBoundaries.length > 1) {
      var gridTop = rowBoundaries[0];
      var gridBottom = rowBoundaries[rowBoundaries.length - 1];
      doc.setDrawColor(60, 60, 60);
      doc.setLineWidth(1);
      rowBoundaries.forEach(function (lineY) {
        doc.line(margin, lineY, pageWidth - margin, lineY);
      });
      [margin, colQtyLeft, colRateLeft, colAmountLeft, pageWidth - margin].forEach(function (x) {
        doc.line(x, gridTop, x, gridBottom);
      });
    }

    return y;
  }

  function drawPaidStampPdf(doc, pageWidth, pageHeight) {
    var usedGState = false;
    try {
      if (doc.GState) {
        doc.setGState(new doc.GState({ opacity: 0.45 }));
        usedGState = true;
      }
    } catch (e) {
      // opacity not supported in this jsPDF build — fall back to solid color
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(64);
    doc.setTextColor(26, 156, 94); // matches --color-success
    doc.text("PAID", pageWidth / 2, pageHeight / 2, { align: "center", angle: 22 });
    if (usedGState) {
      try {
        doc.setGState(new doc.GState({ opacity: 1 }));
      } catch (e) {
        // ignore
      }
    }
  }

  // Button states: idle -> loading -> success -> idle. Loading is held for
  // a minimum visible duration even though generation itself is near-
  // instant, so the progress state actually reads as a step, not a flicker.
  function setDownloadButtonState(state) {
    el.downloadPdfBtn.dataset.state = state;
    var labels = { idle: "Download PDF", loading: "Generating…", success: "Downloaded" };
    if (el.downloadPdfLabel) el.downloadPdfLabel.textContent = labels[state];
    el.downloadPdfBtn.disabled = state !== "idle";
  }

  function downloadPdf() {
    var errors = validateInvoice();
    if (errors.length) {
      validationAttempted = true;
      showValidationMessage(errors);
      highlightInvalidItemRows(true);
      return;
    }
    validationAttempted = false;
    showValidationMessage([]);
    highlightInvalidItemRows(false);

    var jsPDFCtor = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFCtor) {
      alert("The PDF library is still loading — try again in a moment.");
      return;
    }

    setDownloadButtonState("loading");
    var minLoadingTime = prefersReducedMotion() ? 0 : 450;
    setTimeout(function () {
      generatePdf(jsPDFCtor);
      setDownloadButtonState("success");
      setTimeout(function () {
        setDownloadButtonState("idle");
      }, 1500);
    }, minLoadingTime);
  }

  function generatePdf(jsPDFCtor) {
    var items = readItems();
    var totals = calculateTotals(items);
    var doc = new jsPDFCtor({ unit: "pt", format: "a4" });

    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 48;
    var contentWidth = pageWidth - margin * 2;

    var template = currentTemplate;
    var small = template === "minimal";
    var accent = hexToRgb(currentAccentColor);
    var dark = [31, 36, 48];
    var muted = [107, 114, 128];
    var invoiceNumber = el.invoiceNumber.value.trim() || "INV-001";
    var currencyCode = el.currency.value;
    var formatAmount = function (value) { return formatCurrency(value, currencyCode); };

    // ---- Logo box (measured up front so the header can size around it) ----
    var logoW = 0, logoH = 0;
    if (currentLogo.dataUrl) {
      var maxLogoW = 110, maxLogoH = 46;
      var scale = Math.min(maxLogoW / currentLogo.width, maxLogoH / currentLogo.height, 1);
      logoW = Math.round(currentLogo.width * scale);
      logoH = Math.round(currentLogo.height * scale);
    }

    var fromLines = [el.fromEmail.value.trim(), el.fromPhone.value.trim()].filter(Boolean)
      .concat(splitLines(el.fromAddress.value.trim()));
    var leftContentHeight = (logoH ? logoH + 8 : 0) + 16 + fromLines.length * 13;
    var rightContentHeight = 30 + 3 * 13;
    var headerContentHeight = Math.max(leftContentHeight, rightContentHeight);

    var y;
    var bandHeight = 0;

    if (template === "modern") {
      var bandTopPad = 34, bandBottomPad = 26;
      bandHeight = headerContentHeight + bandTopPad + bandBottomPad;
      doc.setFillColor(accent[0], accent[1], accent[2]);
      doc.rect(0, 0, pageWidth, bandHeight, "F");
      y = bandTopPad;
    } else {
      y = margin;
    }

    var nameColor = template === "modern" ? [255, 255, 255] : dark;
    var lineColor = template === "modern" ? [225, 232, 250] : muted;
    var titleColor = template === "modern" ? [255, 255, 255] : accent;
    var metaColor = template === "modern" ? [225, 232, 250] : muted;

    // ---- Header: logo, business name + contact, INVOICE title + meta ----
    if (logoW) {
      doc.addImage(currentLogo.dataUrl, "PNG", margin, y, logoW, logoH);
      y += logoH + 8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(small ? 14 : 16);
    doc.setTextColor(nameColor[0], nameColor[1], nameColor[2]);
    doc.text(el.fromName.value.trim() || "Your Business Name", margin, y + 12);

    doc.setFontSize(small ? 20 : 22);
    doc.setTextColor(titleColor[0], titleColor[1], titleColor[2]);
    doc.text("INVOICE", pageWidth - margin, y + 12, { align: "right" });

    var leftY = y + 12 + 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(lineColor[0], lineColor[1], lineColor[2]);
    fromLines.forEach(function (line) {
      doc.text(line, margin, leftY);
      leftY += 13;
    });

    var metaY = y + 12 + 20;
    doc.setTextColor(metaColor[0], metaColor[1], metaColor[2]);
    doc.text("No. " + invoiceNumber, pageWidth - margin, metaY, { align: "right" });
    metaY += 13;
    doc.text("Issued " + formatDate(el.issueDate.value), pageWidth - margin, metaY, { align: "right" });
    metaY += 13;
    doc.text("Due " + formatDate(el.dueDate.value), pageWidth - margin, metaY, { align: "right" });

    y = Math.max(leftY, metaY) + 10;

    if (template === "modern") {
      y = Math.max(y, bandHeight) + 20;
    } else {
      var dividerColor = template === "classic" ? [31, 36, 48] : [226, 229, 234];
      var dividerWidth = template === "classic" ? 1.5 : 0.75;
      doc.setDrawColor(dividerColor[0], dividerColor[1], dividerColor[2]);
      doc.setLineWidth(dividerWidth);
      doc.line(margin, y, pageWidth - margin, y);
      y += 26;
    }

    // ---- Bill To ----
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.text("BILL TO", margin, y);
    y += 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(dark[0], dark[1], dark[2]);
    doc.text(el.toName.value.trim() || "Client Name", margin, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    var toLines = [el.toEmail.value.trim()].filter(Boolean).concat(splitLines(el.toAddress.value.trim()));
    toLines.forEach(function (line) {
      doc.text(line, margin, y);
      y += 13;
    });

    y += 14;

    // ---- Items table (template-specific styling) ----
    y = drawItemsTablePdf(doc, items, {
      margin: margin,
      pageWidth: pageWidth,
      contentWidth: contentWidth,
      template: template,
      dark: dark,
      muted: muted,
      small: small,
      y: y,
      formatAmount: formatAmount
    });

    y += 12;
    var check1 = checkPageBreak(doc, y, margin, 90);
    y = check1.y;

    // ---- Totals block (right aligned) ----
    var totalsLabelX = pageWidth - margin - 150;
    var totalsValueX = pageWidth - margin;

    function totalsRow(label, value, opts) {
      opts = opts || {};
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(opts.size || 9.5);
      doc.setTextColor.apply(doc, opts.color || muted);
      doc.text(label, totalsLabelX, y);
      doc.text(value, totalsValueX, y, { align: "right" });
      y += opts.gap || 16;
    }

    totalsRow("Subtotal", formatAmount(totals.subtotal));
    totalsRow("Discount", "-" + formatAmount(totals.discountAmount));
    totalsRow("Tax", formatAmount(totals.taxAmount));

    var totalsDividerColor = template === "classic" ? [31, 36, 48] : accent;
    var totalsDividerWidth = template === "minimal" ? 0.75 : 1.25;
    doc.setDrawColor(totalsDividerColor[0], totalsDividerColor[1], totalsDividerColor[2]);
    doc.setLineWidth(totalsDividerWidth);
    doc.line(totalsLabelX, y - 4, totalsValueX, y - 4);
    y += 10;

    totalsRow("Total", formatAmount(totals.total), {
      bold: true,
      size: 12.5,
      color: dark,
      gap: 20
    });

    y += 14;
    var check2 = checkPageBreak(doc, y, margin, 80);
    y = check2.y;

    // ---- Notes / Payment terms ----
    var notes = el.notes.value.trim();
    var terms = el.paymentTerms.value.trim();

    if (notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text("NOTES", margin, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      var notesLines = doc.splitTextToSize(notes, contentWidth * 0.55);
      doc.text(notesLines, margin, y);
      y += notesLines.length * 13 + 10;
    }

    if (terms) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(accent[0], accent[1], accent[2]);
      doc.text("PAYMENT TERMS", margin, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(muted[0], muted[1], muted[2]);
      var termsLines = doc.splitTextToSize(terms, contentWidth * 0.55);
      doc.text(termsLines, margin, y);
      y += termsLines.length * 13;
    }

    // ---- Paid watermark ----
    if (el.markPaid.checked) {
      drawPaidStampPdf(doc, pageWidth, pageHeight);
    }

    doc.save(invoiceNumber + ".pdf");

    // A download counts as "generating" the invoice: file it in history,
    // then roll the invoice number forward for the next one.
    addToHistory(snapshotInvoice(items, totals));
    el.invoiceNumber.value = incrementInvoiceNumber(invoiceNumber);
    handleChange();
  }

  function splitLines(text) {
    if (!text) return [];
    return text.split("\n").map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  /* ========================================================
     13b. Mobile preview drawer — on narrow viewports the preview
     sheet lives off-screen until the floating "Preview Invoice"
     button opens it as a bottom drawer.
     ======================================================== */

  function openPreviewDrawer() {
    el.previewColumn.classList.add("is-drawer-open");
    el.drawerBackdrop.hidden = false;
    requestAnimationFrame(function () {
      el.drawerBackdrop.classList.add("is-visible");
    });
    el.previewFab.setAttribute("aria-expanded", "true");
    if (el.previewFabLabel) el.previewFabLabel.textContent = "Close Preview";
    document.body.classList.add("drawer-open-lock");
  }

  function closePreviewDrawer() {
    el.previewColumn.classList.remove("is-drawer-open");
    el.drawerBackdrop.classList.remove("is-visible");
    el.previewFab.setAttribute("aria-expanded", "false");
    if (el.previewFabLabel) el.previewFabLabel.textContent = "Preview Invoice";
    document.body.classList.remove("drawer-open-lock");
    setTimeout(function () {
      el.drawerBackdrop.hidden = true;
    }, 320);
  }

  function togglePreviewDrawer() {
    if (el.previewColumn.classList.contains("is-drawer-open")) {
      closePreviewDrawer();
    } else {
      openPreviewDrawer();
    }
  }

  /* ========================================================
     14. Init
     ======================================================== */

  function init() {
    loadProfile();
    loadSettings();
    setDefaultDates();

    setTemplate(currentTemplate, { silent: true });
    setAccentColor(currentAccentColor);
    el.accentColor.value = currentAccentColor;

    // Start with two blank line item rows, then let a template
    // page (if any) replace them with its own prefilled items.
    createItemRow();
    createItemRow();
    applyTemplatePrefill();

    // Wire up live-updating fields
    var watchedInputs = [
      el.fromName, el.fromEmail, el.fromPhone, el.fromAddress,
      el.toName, el.toEmail, el.toAddress,
      el.invoiceNumber, el.currency, el.issueDate, el.dueDate, el.markPaid,
      el.taxPercent, el.discountPercent, el.notes, el.paymentTerms
    ];
    watchedInputs.forEach(function (input) {
      input.addEventListener("input", handleChange);
      input.addEventListener("change", handleChange);
    });

    el.addRowBtn.addEventListener("click", function () {
      createItemRow();
      handleChange();
    });

    el.logoUpload.addEventListener("change", handleLogoUpload);
    el.removeLogoBtn.addEventListener("click", removeLogo);

    templateOptionButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTemplate(btn.dataset.template);
      });
    });
    el.accentColor.addEventListener("input", function () {
      setAccentColor(this.value);
    });

    el.downloadPdfBtn.addEventListener("click", downloadPdf);
    el.duplicateBtn.addEventListener("click", duplicateInvoice);
    el.printBtn.addEventListener("click", function () {
      window.print();
    });
    el.clearSavedBtn.addEventListener("click", clearSavedProfile);

    el.historyBtn.addEventListener("click", openHistoryPanel);
    el.closeHistoryBtn.addEventListener("click", closeHistoryPanel);
    el.historyOverlay.addEventListener("click", function (e) {
      if (e.target === el.historyOverlay) closeHistoryPanel();
    });
    el.clearHistoryBtn.addEventListener("click", clearAllHistory);

    el.previewFab.addEventListener("click", togglePreviewDrawer);
    el.drawerBackdrop.addEventListener("click", closePreviewDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && el.previewColumn.classList.contains("is-drawer-open")) {
        closePreviewDrawer();
      }
    });

    renderPreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
