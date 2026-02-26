# IRS form PDFs

Place `f1040.pdf` (fillable IRS Form 1040) here for PDF autofill.

## Sprintax-quality output (correct form like Sprintax)

Right now the repo may ship a **placeholder** PDF (no form fields). To generate the form **correctly like Sprintax** (IRS-compliant, all lines filled):

1. **Use the IRS Form 1040 that has AcroForm fields**
   - The standard “fillable” 1040 from irs.gov (`irs.gov/pub/irs-pdf/f1040.pdf`) often uses **XFA**; pdf-lib only reads **AcroForm**, so you’ll see 0 fields.
   - **Use the IRS Accessible 1040 (AcroForm)** instead:  
     **[IRS Form 1040 – Accessible](https://www.irs.gov/pub/irs-access/f1040_accessible.pdf)**  
     Download that PDF, rename/save it as `f1040.pdf`, and replace `assets/pdfs/f1040.pdf` with it.

2. **Get the PDF’s field names**
   - From the `gigtax` directory run:  
     `node scripts/list-1040-fields.mjs`  
   - You should see a list of text and checkbox field names. If you still see 0 fields, the file may be XFA; use the Accessible link above.

3. **Align the app with those names**
   - In `lib/pdfGenerator.ts`, update the `map(...)` and `setCheckbox(...)` calls to use the **exact** field names from step 2 (e.g. replace `f1_1`, `Line9`, etc. with the names your PDF uses).

After that, the app will fill the same 1040 the IRS provides, with name, SSN, address, filing status, and key line items (income, AGI, deduction, tax, withholding, refund/owed), so the result is **correct like Sprintax** (print and mail or use for e-file later).

- **Flow:** The app fills the form, then the user can **print and mail** to the IRS.
- **E-file:** Once IRS e-file permission is integrated, we will add e-file; until then, Print & Mail is supported.

## If the IRS PDF doesn’t work (XFA / 0 fields)

The standard and accessible IRS 1040 PDFs often use **XFA** or have no AcroForm fields, so pdf-lib can’t fill them. In that case the app **automatically falls back** to generating a **1040-style PDF from your data** (same line numbers: 1a, 9, 11a, 12e, 15, 16, 25d, 33, 34, 37). You still get a PDF to save or print and mail; it just isn’t the literal IRS fillable file.
