const PDFDocument = require("pdfkit");
const fs = require("fs");

const doc = new PDFDocument();

const output =
  fs.createWriteStream(
    "/root/ai-system/docs/tender.pdf"
  );

doc.pipe(output);

doc.fontSize(20)
  .text(
    "DOKUMEN TENDER PROYEK GUDANG",
    {
      align: "center"
    }
  );

doc.moveDown();

doc.fontSize(12)
  .text(`
Nama Proyek:
Pembangunan Gudang Material

Lokasi:
Rote Ndao

Lingkup Pekerjaan:
- Struktur Beton
- Pekerjaan Baja
- Atap
- Plumbing
- Listrik

Vendor Beton:
PT Beton Maju

Estimasi Nilai:
Rp 5.200.000.000

Durasi:
120 Hari Kalender
`);

doc.end();

output.on(
  "finish",
  () => {

    console.log(
      "PDF CREATED"
    );
  }
);
