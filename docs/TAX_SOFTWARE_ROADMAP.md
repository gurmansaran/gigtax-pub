# Tax Software That Actually Does Your Taxes — Solutions

**Problem:** You can't sell tax software if it doesn't do your taxes. Right now we hit a wall: IRS Form 1040 PDFs (standard and accessible) don't have fillable AcroForm fields we can use, so we can't produce the *official* form. Our fallback is a 1040-style summary — useful but not the same as a complete, fileable return.

Below are concrete options to get to a **sellable product**: a return users can file (paper and/or e-file) with confidence.

---

## Option 1: Build Our Own 1040 Replica (Paper File) — **Recommended short-term**

**Idea:** We don't fill the IRS PDF. We **draw the form ourselves** (HTML/CSS → PDF, or native PDF with pdf-lib/PDFKit) so it **looks like** the official Form 1040 — same line numbers, same layout, same boxes. Our tax engine fills every line. User prints, signs, mails. Many commercial products work this way.

**Pros**
- No dependency on IRS PDF format (XFA/AcroForm).
- We control layout, year-over-year updates, and branding.
- One codebase for "the" 1040 we ship; works for paper file today.

**Cons**
- Build and maintenance cost (IRS changes forms yearly).
- Must be accurate; consider legal/compliance (disclaimers, "review before filing").

**Implementation**
- Create a 1040 template (HTML or PDF drawing) that mirrors the current year’s Form 1040 line-by-line.
- Map our `FinalTaxResult` + `TaxReturnState` to every line (1a–1z, 2b, 3a/3b, … 37).
- Add key schedules if needed: Schedule 1 (additional income/adjustments), Schedule C (business), Schedule 2 (additional tax). Start with 1040 only, add schedules incrementally.
- Output: single PDF (or one PDF per form) that is **fileable** — user can print and mail.

**Sellable outcome:** "GigTax prepares your full Form 1040. Print, sign, and mail — or e-file when available."

---

## Option 2: E-File First (Data, Not PDF)

**Idea:** E-file doesn’t use the IRS PDF at all. The IRS accepts returns as **structured data** (e.g. MeF — Modernized e-File). We collect data, validate it, and submit via an IRS-authorized transmitter. "Doing your taxes" = we e-file for you; paper is optional.

**Pros**
- Real, professional product. No form-PDF problem.
- Faster for users (refund/confirmation in days).
- Expected by most customers ("e-file my return").

**Cons**
- Requires IRS e-file program participation: EFIN, testing, security, and ongoing compliance.
- Non-trivial: build or integrate a transmitter, handle acknowledgments, errors, state e-file.
- Often 6–12+ months to get approved and production-ready.

**Paths**
- **Partner:** Use a third-party e-file provider (Tax1099, Drake, TaxSlayer, Sovos, etc.) that already has IRS/state approval. We send them data; they transmit. Fastest to "we e-file for you."
- **In-house:** Apply for EFIN, pass IRS testing, build or buy transmitter software. Full control, higher cost and time.

**Sellable outcome:** "GigTax files your return electronically with the IRS. Get your refund faster."

---

## Option 3: Third-Party Tax Engine + Forms (Partner)

**Idea:** Don’t build the form or e-file ourselves. Use a vendor that already has IRS-approved forms and e-file: TaxSlayer, Liberty Tax, Drake, or a "tax API" (e.g. some providers offer APIs for preparers). We own UX and gig-specific logic; they own form layout, calculations, and e-file.

**Pros**
- Compliant, maintained, often includes e-file and state.
- We focus on gig-worker experience and differentiation.

**Cons**
- Cost (per return or license), dependency, possible white-label or API limits.
- Less control over exact form look and flow.

**Sellable outcome:** "GigTax uses [Partner] to prepare and e-file your return — built for gig workers."

---

## Option 4: Fix IRS PDF Filling (Technical Workarounds)

**Idea:** Get the actual IRS PDF filled somehow.

**4a. Backend PDF service**
- Send our data to a server that runs pdftk, qpdf, Adobe PDF Services, or another tool that might handle XFA or the IRS’s format. Server returns filled PDF. 
- **Reality:** Many of these still don’t support XFA; IRS forms are often non-standard. Would need proof-of-concept with the real IRS PDF.

**4b. Different PDF library**
- Use a library that supports XFA (e.g. some Java/Adobe stacks). Often not available in Node/React Native; would require a backend service.
- **Reality:** XFA support in open source is limited; IRS may use proprietary or odd variants.

**4c. Official IRS fillable form via browser**
- Open the IRS’s own fillable form in a WebView or browser and inject values (e.g. via JavaScript). Fragile, may violate terms of use, and we don’t control the form.
- **Reality:** Not a solid foundation for a product.

**Verdict:** Option 4 is worth a short spike (e.g. test one backend tool with the real IRS PDF), but shouldn’t block the product. Options 1 and 2 are more reliable.

---

## Option 5: Hybrid — Replica Now, E-File Next

**Idea:** Combine Option 1 and Option 2.

1. **Phase 1 (now):** Build the **1040 replica** (and Schedule 1 / C if needed). Every line populated from our engine. User gets a **fileable** PDF to print and mail. We can sell: "GigTax prepares your full 1040 — print & mail. E-file coming soon."
2. **Phase 2:** Add **e-file** via partner (Option 2/3) or in-house (Option 2). Then we "do your taxes" both ways; paper remains for those who want it.

**Sellable outcome:** "GigTax does your taxes: prepare your 1040, then print & mail or e-file."

---

## Recommendation

| Priority | Action | Why |
|----------|--------|-----|
| **1** | **Build a fileable 1040 replica** (Option 1) | Gives a real, fileable return for paper today; no dependency on broken IRS PDFs. Required to credibly "do" the user’s taxes. |
| **2** | **Add e-file** (Option 2 or 3) | Expected by customers; completes "we do your taxes." Partner is fastest. |
| **3** | **Schedules** (Schedule 1, C, 2 as needed) | Many gig returns need Schedule C and Schedule 1; add once 1040 replica is solid. |
| **4** | **Compliance & positioning** | Disclaimers, "review before filing," and (if selling) E&O and state registration where required. |

**Bottom line:** Treat the 1040 as a **product we own** — we draw it, we fill it, we deliver it. Then add e-file so we’re not "tax prep that might get filed" but **"tax software that does your taxes."**
