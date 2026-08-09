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
  },

  "graphic-designer-invoice": {
    slug: "graphic-designer-invoice",
    pageTitle: "Free Graphic Designer Invoice Template | Invoice Generator",
    metaDescription: "A free graphic designer invoice template for logo design, brand identity, and social media work. Fill it in, preview it live, and download a PDF.",
    lineItems: [
      { description: "Logo design concepts (3 rounds)", qty: 1, rate: 15000 },
      { description: "Brand style guide", qty: 1, rate: 8000 },
      { description: "Social media templates", qty: 5, rate: 1200 },
      { description: "Additional revision round", qty: 1, rate: 2500 }
    ],
    paymentTerms: "50% deposit due at project kickoff, remaining balance due upon final delivery."
  },

  "web-developer-invoice": {
    slug: "web-developer-invoice",
    pageTitle: "Free Web Developer Invoice Template | Invoice Generator",
    metaDescription: "A free web developer invoice template for frontend projects, hosting retainers, and support hours. Fill it in, preview it live, and download a PDF.",
    lineItems: [
      { description: "Frontend development (hours)", qty: 40, rate: 1500 },
      { description: "Responsive design implementation", qty: 1, rate: 12000 },
      { description: "Monthly hosting and maintenance", qty: 1, rate: 3000 },
      { description: "Bug fixes and support (hours)", qty: 5, rate: 1200 }
    ],
    paymentTerms: "Net 15. Hosting and maintenance retainer billed monthly in advance."
  },

  "contractor-invoice": {
    slug: "contractor-invoice",
    pageTitle: "Free Contractor Invoice Template | Invoice Generator",
    metaDescription: "A free contractor invoice template for construction and trades — labor, materials, site prep, and change orders. Fill it in, download a PDF.",
    lineItems: [
      { description: "Labor (days)", qty: 10, rate: 2500 },
      { description: "Materials and supplies", qty: 1, rate: 45000 },
      { description: "Site preparation", qty: 1, rate: 8000 },
      { description: "Change order: extra electrical work", qty: 1, rate: 6500 }
    ],
    paymentTerms: "30% deposit due before work begins, progress payments per milestone, balance due on completion."
  }
};
