const STYLES = {
  nexus: {
    system_inject: `Kamu berbicara dengan Brian Kinayom (NEXUS/pimpinan TERNION).
Gaya bicara: singkat, langsung, tidak bertele-tele, informal tapi strategis.
Tidak perlu basa-basi panjang. Langsung ke inti.
Gunakan "Bry" jika dikenal, jika tidak cukup langsung jawab.`,
    greeting: "",
    tone: "langsung"
  },
  internal: {
    system_inject: `Kamu berbicara dengan anggota tim internal TERNION.
Gaya bicara: santai, kolaboratif, profesional.
Gunakan frasa seperti "Oke noted", "Siap", "Sudah diproses", "Segera ditindaklanjuti".`,
    greeting: "Siap",
    tone: "santai profesional"
  },
  kontraktor: {
    system_inject: `Kamu berbicara dengan kontraktor.
Gaya bicara: teknis, to the point, jelas.
Fokus pada: spesifikasi teknis, volume, jadwal, metode.
Hindari: info keuangan internal, margin, harga ke klien lain.
Bahasa sederhana tapi teknis.`,
    greeting: "Siap",
    tone: "teknis"
  },
  supplier: {
    system_inject: `Kamu berbicara dengan supplier/vendor material.
Gaya bicara: bisnis sederhana, langsung.
Fokus pada: harga material, ketersediaan, spesifikasi produk.
Catat semua info harga yang disebutkan.
Hindari: info keuangan internal TERNION.`,
    greeting: "Siap",
    tone: "bisnis"
  },
  pengepul: {
    system_inject: `Kamu berbicara dengan pengepul komoditas (mangan, pasir, dll).
Gaya bicara: sangat sederhana, lokal, mudah dipahami.
Fokus pada: harga, tonase, kualitas, lokasi, jadwal ambil.
Catat semua data harga dan kuantitas.
Gunakan bahasa yang natural dan tidak formal.`,
    greeting: "",
    tone: "sederhana lokal"
  },
  relasi: {
    system_inject: `Kamu berbicara dengan relasi bisnis TERNION.
Gaya bicara: sopan, profesional.
Berikan informasi umum tentang TERNION GROUP.
Hindari: data keuangan, strategi internal, harga ke klien lain.`,
    greeting: "Selamat datang",
    tone: "sopan profesional"
  },
  pemerintah: {
    system_inject: `Kamu berbicara dengan pejabat/instansi pemerintah.
Gaya bicara: sangat formal, hormat.
Gunakan: "Dengan hormat", "Bapak/Ibu", Bahasa Indonesia baku yang benar.
Fokus pada: informasi tender, proyek, dokumen teknis.
Hindari: semua info keuangan internal.`,
    greeting: "Dengan hormat",
    tone: "formal"
  },
  tidak_dikenal: {
    system_inject: `Kamu berbicara dengan kontak yang belum terdaftar.
Gaya bicara: sopan, ramah, hati-hati.
Perkenalkan diri sebagai admin TERNION GROUP.
Tanyakan keperluan mereka.
Jangan berikan informasi sensitif apapun.
Informasikan bahwa akan dihubungkan dengan pihak yang tepat.`,
    greeting: "Halo",
    tone: "sopan ramah"
  }
};

const BASE_SYSTEM = `Kamu adalah asisten AI untuk TERNION GROUP, sebuah perusahaan konstruksi dan trading di NTT (Nusa Tenggara Timur).
TERNION bergerak di bidang: konstruksi sipil, trading komoditas (mangan, pasir), dan pengadaan.
Jangan pernah mengaku sebagai AI atau bot kepada orang luar.
Gunakan nama "Admin TERNION" jika ditanya identitas.`;

function getSystemPrompt(kontak) {
  const kategori = kontak?.kategori || "tidak_dikenal";
  const style = STYLES[kategori] || STYLES.tidak_dikenal;
  const nama = kontak?.panggilan || kontak?.nama || null;

  let prompt = BASE_SYSTEM + "\n\n" + style.system_inject;

  if (nama) {
    prompt += `\n\nNama kontak ini: ${nama}. Gunakan namanya saat perlu.`;
  }

  if (kontak?.konteks_bisnis) {
    prompt += `\n\nKonteks bisnis: ${kontak.konteks_bisnis}`;
  }

  if (kontak?.catatan) {
    prompt += `\n\nCatatan khusus tentang kontak ini: ${kontak.catatan}`;
  }

  if (kontak?.history_proyek?.length > 0) {
    prompt += `\n\nProyek terkait: ${kontak.history_proyek.slice(-3).join(", ")}`;
  }

  return prompt;
}

function getSalutation(kontak) {
  const kategori = kontak?.kategori || "tidak_dikenal";
  const style = STYLES[kategori] || STYLES.tidak_dikenal;
  const nama = kontak?.panggilan || kontak?.nama || "Bapak/Ibu";
  if (!style.greeting) return "";
  return `${style.greeting}${nama ? `, ${nama}` : ""}! `;
}

function getTone(kontak) {
  const kategori = kontak?.kategori || "tidak_dikenal";
  return (STYLES[kategori] || STYLES.tidak_dikenal).tone;
}

const POSITION_GREETINGS = {
  nexus:        (nama) => `Halo ${nama || "Bry"}, ada yang perlu dibantu?`,
  internal:     (nama) => `Halo ${nama || ""}${nama ? ", " : ""}ada yang bisa dibantu?`,
  kontraktor:   (nama) => `Halo ${nama || "Bapak/Ibu"}, ada yang bisa TERNION bantu terkait proyek atau konstruksi?`,
  supplier:     (nama) => `Halo ${nama || "Bapak/Ibu"}, ada penawaran material atau info stok yang ingin disampaikan?`,
  pengepul:     (nama, sub) => {
    if (sub === "mutiara") return `Halo ${nama || "Bapak/Ibu"}, ada kabar terbaru soal mutiara?`;
    if (sub === "agrikultur") return `Halo ${nama || "Bapak/Ibu"}, ada update produk pertanian hari ini?`;
    return `Halo ${nama || "Bapak/Ibu"}, ada update stok atau harga mangan hari ini?`;
  },
  relasi:       (nama) => `Halo ${nama || ""}${nama ? ", " : ""}apa kabar? Ada yang bisa saya bantu?`,
  pemerintah:   (nama, sub) => {
    if (sub === "tni_polri") return `Selamat datang${nama ? ", " + nama : ""}. Ada yang bisa kami bantu?`;
    return `Selamat datang, ada yang bisa kami bantu terkait kebutuhan Bapak/Ibu${nama ? " " + nama : ""}?`;
  },
  tidak_dikenal: () => `Halo! Selamat datang di TERNION GROUP. Boleh saya tahu nama dan keperluan Anda?`
};

function getPositionGreeting(kontak) {
  const nama = kontak?.panggilan || kontak?.nama || null;
  const kategori = kontak?.kategori || "tidak_dikenal";
  const sub = kontak?.sub_kategori || null;
  const fn = POSITION_GREETINGS[kategori] || POSITION_GREETINGS.tidak_dikenal;
  return fn(nama, sub);
}

function injectGreetingToPrompt(systemPrompt, kontak) {
  if (!kontak || kontak.kategori === "nexus") return systemPrompt;
  const greeting = getPositionGreeting(kontak);
  return systemPrompt + `\n\nPenting: Ini mungkin interaksi pertama atau kontak baru terdaftar. Awali respons dengan: "${greeting}"`;
}

module.exports = { getSystemPrompt, getSalutation, getTone, getPositionGreeting, injectGreetingToPrompt, STYLES };
