/* ==========================================================
   Shared invoice-template prefill config.
   One entry per /templates/<slug>/ page. Each template page sets
   window.INVOICE_TEMPLATE_SLUG before this script runs; script.js
   looks up that slug here and prefills the tool's line items and
   payment terms. Nothing else about the tool changes per template.

   pageTitle / metaDescription are listed here too so this file
   stays the single source of truth for each template's content —
   the live <title>/<meta description> tags are still hand-written
   in each page's <head> (search engines want those present in the
   static HTML, not injected by JS), so keep them in sync if you
   edit an entry here.
   ========================================================== */

window.INVOICE_TEMPLATES = {
  "photography-invoice": {
    slug: "photography-invoice",
    pageTitle: "Free Photography Invoice Template | Invoice Generator",
    metaDescription: "A free photography invoice template for wedding, portrait, and event photographers. Fill it in, preview it live, and download a PDF in minutes.",
    lineItems: [
      { description: "Full-day wedding photography coverage", qty: 1, rate: 1800 },
      { description: "Photo editing and color retouching (per hour)", qty: 4, rate: 65 },
      { description: "USB drive with high-resolution digital images", qty: 1, rate: 45 }
    ],
    paymentTerms: "50% retainer due at booking, remaining balance due within 14 days of the event."
  },

  "freelance-writer-invoice": {
    slug: "freelance-writer-invoice",
    pageTitle: "Free Freelance Writer Invoice Template | Invoice Generator",
    metaDescription: "A free invoice template built for freelance writers and content creators. Bill by the word, hour, or project and download a clean PDF invoice.",
    lineItems: [
      { description: "Blog article, 1,200 words (SEO-optimized)", qty: 3, rate: 180 },
      { description: "Content strategy call (1 hour)", qty: 1, rate: 90 },
      { description: "One round of revisions", qty: 2, rate: 40 }
    ],
    paymentTerms: "Payment due within 15 days of invoice date via bank transfer or card."
  },

  "consulting-invoice": {
    slug: "consulting-invoice",
    pageTitle: "Free Consulting Invoice Template | Invoice Generator",
    metaDescription: "A free consulting invoice template for independent consultants and advisory firms. Track billable hours and project fees, then export a PDF.",
    lineItems: [
      { description: "Strategy consulting (hourly)", qty: 12, rate: 175 },
      { description: "Workshop facilitation, half-day session", qty: 1, rate: 950 },
      { description: "Follow-up written recommendations report", qty: 1, rate: 400 }
    ],
    paymentTerms: "Net 30. Late payments accrue 1.5% interest per month."
  }
};
