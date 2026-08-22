/* =================================================================
     JS_Bracket.html
     Berisi: Jadwal Pertandingan per kategori, Skema Pertandingan
     (bracket - baik sistem cermin Pool A/B maupun sistem cascading
     satu sisi), dan logika "majukan pemenang otomatis ke babak
     berikutnya".
     ================================================================= */
    /* ================= JADWAL PER KATEGORI ================= */
    let semuaJadwalKategori = [];
    let petaNomorRace = {};

    // Urutan babak dipakai KHUSUS untuk mengelompokkan penomoran Race (Race-1,
    // Race-2, dst). Babak-1 dulu, lalu Babak-2, ..., Semifinal, Final.
    function urutanBabakUntukRace_(nama) {
      if (nama === 'Final') return 1000;
      if (nama === 'Semifinal') return 999;
      const cocok = /^Babak-(\d+)$/.exec(nama || '');
      if (cocok) return parseInt(cocok[1], 10);
      if (nama === 'Penyisihan') return 1; // kompatibel dengan penamaan babak lama
      return 500; // babak tak dikenal (data lama) - taruh di tengah
    }

    // Mengelompokkan jadwal per babak (sudah terurut sesuai urutan babak),
    // dipakai bersama oleh hitungPetaNomorRace() dan urutkanJadwalPerBabakInterleave().
    function kelompokkanPerBabakUrut_(list) {
      const perBabak = {};
      list.forEach(function(j) {
        if (!perBabak[j.babak]) perBabak[j.babak] = [];
        perBabak[j.babak].push(j);
      });
      return Object.keys(perBabak)
        .sort(function(a, b) { return urutanBabakUntukRace_(a) - urutanBabakUntukRace_(b); })
        .map(function(babak) { return [babak, perBabak[babak]]; });
    }

    // Babak-1 (dan "Penyisihan" data lama) pakai pola urutan CAMPURAN TETAP
    // (3 Race Putra, 2 Race ASN, 1 Race Putri, 1 Race Naga, berulang) lewat
    // urutkanJadwalInterleave(). Untuk Babak-2 dan seterusnya dipakai pola:
    // 2 Race Tradisional (campuran Pool A, Pool B, maupun ASN - urutan
    // di antara ketiganya DIACAK, tidak selalu Pool A dulu) lalu 1 Race
    // Perahu Naga - berulang terus sampai semua race di babak itu habis.
    // Acak-nya harus KONSISTEN tiap kali halaman dimuat ulang (nomor Race
    // tidak boleh berubah-ubah), makanya bukan Math.random() biasa, tapi
    // hash deterministik dari nomor pertandingan (j.no) - hasilnya selalu
    // sama tiap saat, tapi urutannya terlihat acak.
    function babakPakaiPolaTetap_(namaBabak) {
      return namaBabak === 'Babak-1' || namaBabak === 'Penyisihan';
    }
    function urutkanJadwalUntukBabak_(list, namaBabak) {
      if (babakPakaiPolaTetap_(namaBabak)) return urutkanJadwalInterleave(list);
      return urutkanJadwalInterleaveBabakLanjutan_(list);
    }
    function kunciAcakStabil_(no) {
      let x = (Number(no) || 0) ^ 0x9E3779B9;
      x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
      x = Math.imul(x ^ (x >>> 16), 0x45D9F3B);
      x = x ^ (x >>> 16);
      return x >>> 0;
    }
    function urutkanJadwalInterleaveBabakLanjutan_(list) {
      function kunciKategori(j) {
        if (j.kategori === 'Perahu Naga') return 'naga';
        if (j.kategori === 'Perahu Tradisional') return 'tradisional';
        return 'lain';
      }
      const bucket = { tradisional: [], naga: [], lain: [] };
      list.forEach(function(j) { bucket[kunciKategori(j)].push(j); });
      // Bucket "tradisional" (gabungan Pool A, Pool B, ASN) diacak internal -
      // acak stabil berdasarkan j.no, supaya di antara 2 race tradisional yang
      // beriringan, campurannya tidak selalu berurutan Pool A dulu baru Pool B.
      bucket.tradisional.sort(function(a, b) { return kunciAcakStabil_(a.no) - kunciAcakStabil_(b.no); });
      bucket.naga.sort(function(a, b) {
        const hA = nomorHeat(a), hB = nomorHeat(b);
        if (hA !== hB) return hA - hB;
        return urutanPool(a) - urutanPool(b);
      });
      const pola = [['tradisional', 2], ['naga', 1]];
      const hasil = [];
      const indeks = { tradisional: 0, naga: 0 };
      let adaSisa = true;
      while (adaSisa) {
        adaSisa = false;
        pola.forEach(function(p) {
          const namaBucket = p[0], jumlahAmbil = p[1];
          for (let i = 0; i < jumlahAmbil; i++) {
            if (indeks[namaBucket] < bucket[namaBucket].length) {
              hasil.push(bucket[namaBucket][indeks[namaBucket]]);
              indeks[namaBucket]++;
              adaSisa = true;
            }
          }
        });
      }
      hasil.push.apply(hasil, bucket.lain);
      return hasil;
    }

    // PENTING: nomor "Race-N" DIHITUNG ULANG DARI 1 setiap kali masuk babak baru,
    // supaya nomor race Babak-2 dst tidak menyambung/tertimpa dengan nomor race
    // Babak-1 - setiap babak punya deret Race-1, Race-2, ... sendiri-sendiri.
    function hitungPetaNomorRace(listSemua) {
      const peta = {};
      kelompokkanPerBabakUrut_(listSemua).forEach(function(entri) {
        const urutDalamBabak = urutkanJadwalUntukBabak_(entri[1], entri[0]);
        urutDalamBabak.forEach(function(j, i) { peta[j.no] = i + 1; });
      });
      return peta;
    }

    // Sama seperti urutkanJadwalUntukBabak_(), tapi dikelompokkan per babak dulu -
    // dipakai untuk tampilan/urutan "Jadwal Pertandingan" semua kategori supaya
    // urutannya sejalan dengan penomoran Race per babak di atas (Babak-1 selesai
    // dulu semua, baru lanjut Babak-2, dst - tidak diselang-seling antar babak).
    function urutkanJadwalPerBabakInterleave(list) {
      const hasil = [];
      kelompokkanPerBabakUrut_(list).forEach(function(entri) {
        hasil.push.apply(hasil, urutkanJadwalUntukBabak_(entri[1], entri[0]));
      });
      return hasil;
    }
    function muatJadwalKategoriAktif() {
      const container = document.getElementById('kdJadwalIsi');
      container.innerHTML = '<div class="loading-state">Memuat jadwal pertandingan...</div>';
      google.script.run
        .withSuccessHandler(function(list) {
          petaNomorRace = hitungPetaNomorRace(list);
          semuaJadwalKategori = list.filter(function(j) {
            if (j.kategori !== kategoriAktifDetail) return false;
            if (kategoriAktifDetail === 'Perahu Tradisional' && j.kelas !== kelasAktifDetail) return false;
            return true;
          });
          renderJadwalKategoriAktif();
        })
        .withFailureHandler(function(err) {
          container.innerHTML = '<div class="empty-state">❌ Gagal memuat jadwal: ' + (err && err.message ? err.message : err) + '</div>';
        })
        .getDaftarJadwal();
    }
    function renderJadwalKategoriAktif() {
      const container = document.getElementById('kdJadwalIsi');
      if (!semuaJadwalKategori.length) {
        container.innerHTML = '<div class="empty-state">Jadwal pertandingan belum tersedia untuk kategori ini.</div>';
        return;
      }
      function urutanBabak(nama) {
        if (nama === 'Final') return 1000;
        if (nama === 'Semifinal') return 999;
        const cocok = /^Babak-(\d+)$/.exec(nama || '');
        if (cocok) return parseInt(cocok[1], 10);
        return 500; // babak tak dikenal (data lama) - taruh di tengah
      }
      const perBabak = {};
      semuaJadwalKategori.forEach(function(j) {
        if (!perBabak[j.babak]) perBabak[j.babak] = [];
        perBabak[j.babak].push(j);
      });
      let html = '';
      Object.keys(perBabak).sort(function(a, b) { return urutanBabak(a) - urutanBabak(b); }).forEach(function(babak) {
        html += '<div class="babak-group"><div class="babak-title">' + escapeHtml(babak) + '</div>';
        urutkanJadwalDenganSelesaiDiBawah(urutkanBerdasarkanHeatPool(perBabak[babak])).forEach(function(j) { html += renderMatchCardHtml(j, false); });
        html += '</div>';
      });
      container.innerHTML = html;
    }

    function renderMatchCardHtml(j, modeAdmin) {
      const selesai = j.status === 'Selesai';
      const adaBye = !j.timB || j.timB === 'BYE';
      const statusInfo = j.waktu || 'Menunggu Jadwal';
      const kelasStatus = statusInfo === 'Sudah Selesai' ? 'status-selesai' : (statusInfo === 'Sedang Bertanding' ? 'status-live' : (statusInfo === 'Menunggu Jadwal' ? 'status-menunggu' : 'status-persiapan'));
      const ikonStatus = statusInfo === 'Sudah Selesai' ? '✅' : (statusInfo === 'Sedang Bertanding' ? '🚣' : (statusInfo === 'Menunggu Jadwal' ? '🗓️' : '🕓'));
      const nomorRace = petaNomorRace[j.no];
      const kelasPool = j.pool === 'Pool A' ? ' pool-a' : (j.pool === 'Pool B' ? ' pool-b' : '');
      let kelasKategori = 'kat-naga';
      let labelKategori = j.kategori;
      if (j.kategori === 'Perahu Tradisional') {
        labelKategori += ' ' + (j.kelas || '');
        kelasKategori = j.kelas === 'Umum Putra' ? 'kat-putra' : (j.kelas === 'Umum Putri' ? 'kat-putri' : 'kat-asn');
      }
      let html = '<div class="match-card' + (selesai ? ' selesai' : '') + (adaBye ? ' ada-bye' : '') + '">';
      html += '<div class="race-badge-side">' + (nomorRace ? '<span class="race-badge">🏁 Race-' + nomorRace + '</span>' : '') + (adaBye ? '<span class="bye-tag">BYE</span>' : '') + '</div>';
      html += '<div class="match-top-row">';
      html += '<div class="match-badges-left">';
      if (j.pool) html += '<span class="pool-badge-lg' + kelasPool + '">' + escapeHtml(j.pool) + '</span>';
      html += '<span class="kategori-badge ' + kelasKategori + '">' + escapeHtml(labelKategori) + '</span>';
      html += '</div>';
      html += '<span class="match-status ' + kelasStatus + '">' + ikonStatus + ' ' + escapeHtml(statusInfo) + '</span>';
      html += '</div>';
      html += '<div class="match-teams">';
      html += '<span class="team-name' + (selesai && j.pemenang === j.timA ? ' winner' : '') + '">' + escapeHtml(j.timA) + (selesai && j.pemenang === j.timA ? ' 🏆' : '') + (adaBye ? ' <span class="bye-note">(Otomatis Lolos)</span>' : '') + '</span>';
      html += '<span class="vs">' + (adaBye ? 'tanpa lawan' : 'VS') + '</span>';
      html += '<span class="team-name' + (selesai && j.pemenang === j.timB ? ' winner' : '') + '">' + (adaBye ? '— BYE —' : escapeHtml(j.timB)) + (selesai && j.pemenang === j.timB ? ' 🏆' : '') + '</span>';
      html += '</div>';
      if (j.catatan) html += '<div class="match-meta">' + escapeHtml(j.catatan) + '</div>';
      if (modeAdmin) {
        html += '<div class="match-actions">';
        html += '<button class="btn-edit-jadwal" onclick="editJadwal(' + j.no + ')">🕓 Ubah Status</button>';
        if (!selesai) html += '<button class="btn-menang" onclick="tetapkanPemenang(' + j.no + ', ' + escapeAttr(JSON.stringify(j.timA)) + ', ' + escapeAttr(JSON.stringify(j.timB || 'BYE')) + ')">🏆 Set Pemenang</button>';
        html += '</div>';
      }
      html += '</div>';
      return html;
    }

    /* ================= SKEMA PERTANDINGAN (BRACKET, MIRROR-BASED) ================= */
    let idCounterBracket = 0;
    let connectorList = [];
    let daftarPohonSatuSisiUntukPosisi = [];
    let statistikUntukBracket = null;
    let semuaTimUntukSimulasi = [];
    function idBaruBracket() { return 'bm-' + (idCounterBracket++); }

    function susunanBracketDariSlot(jumlahSlotAwal) {
      if (jumlahSlotAwal <= 0) return [];
      let sisa = jumlahSlotAwal;
      const daftarMatch = [];
      while (true) { daftarMatch.push(sisa); if (sisa === 1) break; sisa = Math.ceil(sisa / 2); }
      const n = daftarMatch.length;
      return daftarMatch.map(function(jumlahMatch, idx) {
        const nama = (idx === n - 1) ? 'Semifinal' : ('Babak-' + (idx + 1));
        return [nama, jumlahMatch];
      });
    }

    // ================= MAJUKAN PEMENANG OTOMATIS KE BABAK BERIKUTNYA =================
    // Memetakan hubungan induk-anak dalam pohon cascading (skema satu-sisi Putri/ASN)
    // supaya bisa ditelusuri: pemenang suatu pertandingan masuk ke slot mana di babak berikutnya.
    function petakanParentPohon(pohonMerge) {
      const perDepthNodes = {};
      const parentOfUnit = [];
      const parentOfNode = new Map();
      const posisiOfNode = new Map();
      const unitIndexOfNode = new Map();
      let unitIndex = 0;
      function proses(node) {
        if (!node) return null;
        if (node.tipe === 'unit') { unitIndexOfNode.set(node, unitIndex); unitIndex++; return node; }
        proses(node.a); proses(node.b);
        if (!perDepthNodes[node.depth]) perDepthNodes[node.depth] = [];
        const idxDiri = perDepthNodes[node.depth].length;
        perDepthNodes[node.depth].push(node);
        posisiOfNode.set(node, { depth: node.depth, idx: idxDiri });
        if (node.a.tipe === 'unit') parentOfUnit[unitIndexOfNode.get(node.a)] = { depth: node.depth, idx: idxDiri, sisi: 'a' };
        else parentOfNode.set(node.a, { depth: node.depth, idx: idxDiri, sisi: 'a' });
        if (node.b.tipe === 'unit') parentOfUnit[unitIndexOfNode.get(node.b)] = { depth: node.depth, idx: idxDiri, sisi: 'b' };
        else parentOfNode.set(node.b, { depth: node.depth, idx: idxDiri, sisi: 'b' });
        return node;
      }
      proses(pohonMerge);
      return { perDepthNodes: perDepthNodes, parentOfUnit: parentOfUnit, parentOfNode: parentOfNode, posisiOfNode: posisiOfNode, unitIndexOfNode: unitIndexOfNode };
    }

    // Menentukan slot BABAK BERIKUTNYA untuk suatu pertandingan (kategori/kelas/babak/pool/
    // index-dalam-grup). Mengembalikan null kalau ini sudah Final (tidak ada babak berikutnya).
    // Kalau ada, kembalikan { babakBerikut, poolBerikut, indexBerikut, babakSaudara, poolSaudara, indexSaudara }
    function cariTargetBabakBerikutnya(kategori, kelas, babakSekarang, poolSekarang, indexDalamGrup, jumlahTim) {
      const pakaiSatuSisi = kategori === 'Perahu Tradisional' && (kelas === 'Umum Putri' || kelas === 'ASN');

      if (pakaiSatuSisi) {
        if (babakSekarang === 'Final') return null;
        const jumlahHeat = Math.max(1, Math.ceil(jumlahTim / 2));
        const pohonMerge = bangunPohonCascading(jumlahHeat);
        const totalDepth = 1 + (pohonMerge ? pohonMerge.depth : 0);
        const peta = petakanParentPohon(pohonMerge);
        const namaBabakHeat = namaBabakUntukDepth(1, totalDepth);

        let info;
        if (babakSekarang === namaBabakHeat) {
          info = peta.parentOfUnit[indexDalamGrup];
        } else {
          let dmSekarang = null;
          for (let d = 1; d <= (pohonMerge ? pohonMerge.depth : 0); d++) {
            if (namaBabakUntukDepth(d + 1, totalDepth) === babakSekarang) { dmSekarang = d; break; }
          }
          if (dmSekarang === null) return null;
          const nodeSekarang = (peta.perDepthNodes[dmSekarang] || [])[indexDalamGrup];
          if (!nodeSekarang) return null;
          info = peta.parentOfNode.get(nodeSekarang);
        }
        if (!info) return null; // ini sudah puncak (Final)

        const babakBerikut = namaBabakUntukDepth(info.depth + 1, totalDepth);
        const parentNode = (peta.perDepthNodes[info.depth] || [])[info.idx];
        const sisiSaudara = info.sisi === 'a' ? 'b' : 'a';
        const anakSaudara = parentNode ? parentNode[sisiSaudara] : null;
        let babakSaudara = null, indexSaudara = null;
        if (anakSaudara) {
          if (anakSaudara.tipe === 'unit') {
            babakSaudara = namaBabakHeat;
            indexSaudara = peta.unitIndexOfNode.get(anakSaudara);
          } else {
            const posisi = peta.posisiOfNode.get(anakSaudara);
            if (posisi) { babakSaudara = namaBabakUntukDepth(posisi.depth + 1, totalDepth); indexSaudara = posisi.idx; }
          }
        }
        // FIX: pool tidak lagi di-hardcode kosong ('') - dipakai apa adanya sesuai
        // pool yang sesungguhnya dipakai data (mis. 'Pool A') supaya pencarian
        // pasangan/sibling di majukanPemenangKeBabakBerikutnya() tetap cocok
        // dengan data asli, bukan cocok dengan string kosong yang tidak pernah ada.
        return { babakBerikut: babakBerikut, poolBerikut: poolSekarang, indexBerikut: info.idx, babakSaudara: babakSaudara, poolSaudara: poolSekarang, indexSaudara: indexSaudara };
      }

      // Sistem cermin (Naga & Tradisional Putra): Pool A dan Pool B independen,
      // bertemu di Final (khusus transisi Semifinal -> Final saudara-nya Pool lain).
      if (babakSekarang === 'Final') return null;
      const timSisiA = Math.ceil(jumlahTim / 2);
      const timSisiB = jumlahTim - timSisiA;
      const slotA = Math.max(1, Math.ceil(timSisiA / 2));
      const slotB = Math.max(1, Math.ceil(timSisiB / 2));
      const kolomSisi = poolSekarang === 'Pool B' ? susunanBracketDariSlot(slotB) : susunanBracketDariSlot(slotA);
      const posisiSekarang = kolomSisi.findIndex(function(k) { return k[0] === babakSekarang; });
      if (posisiSekarang === -1) return null;

      if (babakSekarang === 'Semifinal') {
        // Final menggabungkan juara Pool A & Pool B - saudaranya adalah Semifinal pool LAIN
        const poolSaudara = poolSekarang === 'Pool A' ? 'Pool B' : 'Pool A';
        return { babakBerikut: 'Final', poolBerikut: '', indexBerikut: 0, babakSaudara: 'Semifinal', poolSaudara: poolSaudara, indexSaudara: 0 };
      }
      const babakBerikut = kolomSisi[posisiSekarang + 1] ? kolomSisi[posisiSekarang + 1][0] : null;
      if (!babakBerikut) return null;
      const indexBerikut = Math.floor(indexDalamGrup / 2);
      const indexSaudara = (indexDalamGrup % 2 === 0) ? indexDalamGrup + 1 : indexDalamGrup - 1;
      return { babakBerikut: babakBerikut, poolBerikut: poolSekarang, indexBerikut: indexBerikut, babakSaudara: babakSekarang, poolSaudara: poolSekarang, indexSaudara: indexSaudara };
    }

    // Setelah pemenang ditetapkan: cek apakah pasangan babak berikutnya sudah lengkap
    // (saudaranya juga sudah punya pemenang) - kalau iya, buat otomatis pertandingan
    // babak berikutnya. Kalau saudaranya belum selesai, tidak melakukan apa-apa dulu
    // (nanti giliran saudaranya menang, proses inilah yang akan membuat pasangannya).
    function majukanPemenangKeBabakBerikutnya(jMenang, namaPemenang) {
      google.script.run.withSuccessHandler(function(resJadwal) {
        if (!resJadwal.success) return;
        const semuaJadwalKategori = resJadwal.list.filter(function(x) {
          if (x.kategori !== jMenang.kategori) return false;
          if (jMenang.kategori === 'Perahu Tradisional' && x.kelas !== jMenang.kelas) return false;
          return true;
        });
        const grupSekarang = urutkanBerdasarkanHeatPool(semuaJadwalKategori.filter(function(x) {
          return x.babak === jMenang.babak && (x.pool || '') === (jMenang.pool || '');
        }));
        const indexDalamGrup = grupSekarang.findIndex(function(x) { return Number(x.no) === Number(jMenang.no); });
        if (indexDalamGrup === -1) return;

        google.script.run.withSuccessHandler(function(resTim) {
          if (!resTim.success) return;
          const jumlahTim = resTim.list.filter(function(t) {
            if (t.kategori !== jMenang.kategori) return false;
            if (jMenang.kategori === 'Perahu Tradisional' && t.kelas !== jMenang.kelas) return false;
            return true;
          }).length;

          const target = cariTargetBabakBerikutnya(jMenang.kategori, jMenang.kelas, jMenang.babak, jMenang.pool || '', indexDalamGrup, jumlahTim);
          if (!target || !target.babakSaudara) return; // sudah Final atau tidak diketahui

          const grupSaudara = urutkanBerdasarkanHeatPool(semuaJadwalKategori.filter(function(x) {
            return x.babak === target.babakSaudara && (x.pool || '') === (target.poolSaudara || '');
          }));
          const jSaudara = grupSaudara[target.indexSaudara];
          if (!jSaudara || jSaudara.status !== 'Selesai' || !jSaudara.pemenang) return; // saudara belum selesai, tunggu dulu

          // Cek apakah pertandingan babak berikutnya sudah pernah dibuat sebelumnya (hindari duplikat)
          const grupBerikutSudahAda = semuaJadwalKategori.filter(function(x) {
            return x.babak === target.babakBerikut && (x.pool || '') === (target.poolBerikut || '') &&
              ((x.timA === namaPemenang && x.timB === jSaudara.pemenang) || (x.timA === jSaudara.pemenang && x.timB === namaPemenang));
          });
          if (grupBerikutSudahAda.length > 0) return;

          const dataBaru = {
            kategori: jMenang.kategori,
            kelas: jMenang.kategori === 'Perahu Tradisional' ? jMenang.kelas : '',
            babak: target.babakBerikut,
            // FIX: Nomor Heat untuk Babak-2 dst sengaja dikosongkan dulu - biar
            // diisi manual belakangan oleh panitia sesuai urutan race sesungguhnya
            // di lapangan (konsisten dengan pola yang sudah dipakai untuk Naga/Putra).
            nomorHeat: '',
            pool: target.poolBerikut || '',
            waktu: 'Menunggu Jadwal',
            catatan: ''
          };
          const pasanganBerikut = acakUrutanLine_(namaPemenang, jSaudara.pemenang);
          dataBaru.timA = pasanganBerikut[0];
          dataBaru.timB = pasanganBerikut[1];
          google.script.run.withSuccessHandler(function() { muatDaftarJadwalAdmin(); }).tambahJadwal(adminPassword, dataBaru);
        }).getDaftarTimUntukAdmin(adminPassword);
      }).getDaftarJadwalAdmin(adminPassword);
    }

    function muatSkemaKategoriAktif() {
      const container = document.getElementById('kdSkemaContainer');
      container.innerHTML = '<div class="loading-state">Memuat skema...</div>';

      let jadwalSelesai = false, statSelesai = false, timSelesai = false, adaError = false;
      function cekSelesai() { if (jadwalSelesai && statSelesai && timSelesai && !adaError) renderSkemaKategoriAktif(); }

      google.script.run.withSuccessHandler(function(list) {
          petaNomorRace = hitungPetaNomorRace(list);
          semuaJadwalKategori = list.filter(function(j) {
          if (j.kategori !== kategoriAktifDetail) return false;
          if (kategoriAktifDetail === 'Perahu Tradisional' && j.kelas !== kelasAktifDetail) return false;
          return true;
        }); jadwalSelesai = true; cekSelesai(); })
        .withFailureHandler(function(err) { adaError = true; container.innerHTML = '<div class="empty-state">❌ Gagal memuat: ' + (err && err.message ? err.message : err) + '</div>'; })
        .getDaftarJadwal();

      google.script.run.withSuccessHandler(function(stat) { statistikUntukBracket = stat; statSelesai = true; cekSelesai(); })
        .withFailureHandler(function(err) { adaError = true; container.innerHTML = '<div class="empty-state">❌ Gagal memuat statistik.</div>'; })
        .getStatistik();

      google.script.run.withSuccessHandler(function(list) { semuaTimUntukSimulasi = list; timSelesai = true; cekSelesai(); })
        .withFailureHandler(function() { semuaTimUntukSimulasi = []; timSelesai = true; cekSelesai(); })
        .getDaftarTim();
    }

    function renderSkemaKategoriAktif() {
      if (!statistikUntukBracket) return;
      const container = document.getElementById('kdSkemaContainer');
      idCounterBracket = 0;
      connectorList = [];
      daftarPohonSatuSisiUntukPosisi = [];

      let jumlahTim = 0;
      if (kategoriAktifDetail === 'Perahu Naga') jumlahTim = statistikUntukBracket.perahuNaga;
      else if (kelasAktifDetail === 'Umum Putra') jumlahTim = statistikUntukBracket.tradisionalUmumPutra;
      else if (kelasAktifDetail === 'Umum Putri') jumlahTim = statistikUntukBracket.tradisionalUmumPutri;
      else if (kelasAktifDetail === 'ASN') jumlahTim = statistikUntukBracket.tradisionalASN;

      if (jumlahTim < 2) {
        container.innerHTML = '<div class="empty-state">Minimal 2 tim terdaftar untuk membentuk skema pertandingan kategori ini.</div>';
        return;
      }

      const aktualPerBabak = {};
      semuaJadwalKategori.forEach(function(j) {
        if (!aktualPerBabak[j.babak]) aktualPerBabak[j.babak] = [];
        aktualPerBabak[j.babak].push(j);
      });

      const pakaiSatuSisi = kategoriAktifDetail === 'Perahu Tradisional' && (kelasAktifDetail === 'Umum Putri' || kelasAktifDetail === 'ASN');

      const simulasiAktif = document.getElementById('toggleSimulasi') && document.getElementById('toggleSimulasi').checked;
      if (simulasiAktif) {
        const timKategori = semuaTimUntukSimulasi.filter(function(t) {
          if (t.kategori !== kategoriAktifDetail) return false;
          if (kategoriAktifDetail === 'Perahu Tradisional' && t.kelas !== kelasAktifDetail) return false;
          return true;
        }).map(function(t) { return t.namaTim; });

        if (timKategori.length >= 2) {
          const acakSemua = timKategori.slice();
          for (let i = acakSemua.length - 1; i > 0; i--) {
            const rj = Math.floor(Math.random() * (i + 1));
            const tmp = acakSemua[i]; acakSemua[i] = acakSemua[rj]; acakSemua[rj] = tmp;
          }
          const sudahAdaDataAsli = function(nama) { return aktualPerBabak[nama] && aktualPerBabak[nama].length; };

          if (pakaiSatuSisi) {
            const jumlahHeatSim = Math.max(1, Math.ceil(acakSemua.length / 2));
            const pohonSim = bangunPohonCascading(jumlahHeatSim);
            const totalDepthSim = 1 + (pohonSim ? pohonSim.depth : 0);
            const namaBabakAwalSim = namaBabakUntukDepth(1, totalDepthSim);
            if (!sudahAdaDataAsli(namaBabakAwalSim)) {
              aktualPerBabak[namaBabakAwalSim] = (aktualPerBabak[namaBabakAwalSim] || []).concat(buatPasanganSimulasiDenganBye(acakSemua, jumlahHeatSim));
            }
          } else {
            const jumlahTimSisiA = Math.ceil(acakSemua.length / 2);
            const timUntukA = acakSemua.slice(0, jumlahTimSisiA);
            const timUntukB = acakSemua.slice(jumlahTimSisiA);
            const slotA = Math.max(1, Math.ceil(timUntukA.length / 2));
            const slotB = Math.max(1, Math.ceil(timUntukB.length / 2));
            const kolomSimA = susunanBracketDariSlot(slotA);
            const kolomSimB = susunanBracketDariSlot(slotB);

            if (kolomSimA.length && !sudahAdaDataAsli(kolomSimA[0][0])) {
              const namaBabakA = kolomSimA[0][0];
              aktualPerBabak[namaBabakA] = (aktualPerBabak[namaBabakA] || []).concat(buatPasanganSimulasiDenganBye(timUntukA, slotA).map(function(p) { p.pool = 'Pool A'; return p; }));
            }
            if (kolomSimB.length && !sudahAdaDataAsli(kolomSimB[0][0])) {
              const namaBabakB = kolomSimB[0][0];
              aktualPerBabak[namaBabakB] = (aktualPerBabak[namaBabakB] || []).concat(buatPasanganSimulasiDenganBye(timUntukB, slotB).map(function(p) { p.pool = 'Pool B'; return p; }));
            }
          }
        }
      }

      container.innerHTML = pakaiSatuSisi ? renderBracketSatuSisiHtml(jumlahTim, aktualPerBabak) : renderBracketHtml(jumlahTim, aktualPerBabak);
      setTimeout(function() { susunPosisiSemuaKolomBracket(); posisikanSemuaPohonSatuSisi(); gambarSemuaGarisPenghubung(); }, 60);
    }

    // Skema SATU SISI saja (tanpa cermin kiri-kanan) - dipakai khusus untuk
    // Tradisional Putri & Tradisional ASN. Kolom babak berjejer ke kanan, langsung
    // berakhir di Final di ujung kanan (bukan bertemu di tengah dari 2 sisi).
    // Pohon cascading REKURSIF (ceil/floor) dari sejumlah "unit" - dipakai untuk
    // menggabungkan pemenang heat secara bertahap. tipe 'unit' = satu slot
    // pemenang heat yang masih menunggu (belum ada match baru di titik ini).
    function bangunPohonCascading(jumlahUnit) {
      if (jumlahUnit <= 0) return null;
      if (jumlahUnit === 1) return { tipe: 'unit', depth: 0 };
      const jmlKiri = Math.ceil(jumlahUnit / 2);
      const jmlKanan = jumlahUnit - jmlKiri;
      const kiri = bangunPohonCascading(jmlKiri);
      const kanan = bangunPohonCascading(jmlKanan);
      return { tipe: 'match', depth: Math.max(kiri.depth, kanan.depth) + 1, a: kiri, b: kanan };
    }

    // Nama babak untuk suatu tingkat (depth) dari total kedalaman skema
    function namaBabakUntukDepth(depth, maxDepth) {
      if (depth === maxDepth) return 'Final';
      if (depth === maxDepth - 1) return 'Semifinal';
      return 'Babak-' + depth;
    }

    // Skema CASCADING: babak pertama SELALU memasangkan SEMUA tim bersih (tidak
    // ada yang dilewati) - hanya 1 BYE kalau jumlah tim ganjil. Babak-babak
    // berikutnya mengikuti pola cascading (gabung 2 pemenang heat terdekat,
    // pemenang "ganjil" langsung digabung ke hasil gabungan berikutnya - TIDAK
    // menunggu berbabak-babak seperti sebelumnya, karena base unit-nya sudah
    // berupa PEMENANG HEAT, bukan tim mentah).
    function renderBracketSatuSisiHtml(jumlahTim, aktualPerBabak) {
      if (jumlahTim <= 2) {
        const dataFinal = aktualPerBabak['Final'] || [];
        let html = '<div class="bracket-wrap"><div class="bracket-col"><div class="bracket-col-title">Final</div>';
        html += dataFinal[0] ? renderBracketMatchHtml(dataFinal[0]) : renderBracketPlaceholderHtml(null, false);
        html += '</div></div>';
        return html;
      }

      const jumlahHeat = Math.max(1, Math.ceil(jumlahTim / 2));
      const pohonMerge = bangunPohonCascading(jumlahHeat);
      const totalDepth = 1 + (pohonMerge ? pohonMerge.depth : 0);

      function ambilDataUntukDepth(namaBabak) { return aktualPerBabak[namaBabak] || []; }

      const kolomHtmlList = [];
      const idHeatKe = [];

      // Kolom 1: babak heat awal - semua tim dipasangkan bersih
      const namaBabakAwal = namaBabakUntukDepth(1, totalDepth);
      const dataAwal = ambilDataUntukDepth(namaBabakAwal, jumlahHeat);
      let colHtml = '<div class="bracket-col"><div class="bracket-col-title pool-a-title">' + escapeHtml(namaBabakAwal) + '</div>';
      for (let i = 0; i < jumlahHeat; i++) {
        const id = idBaruBracket();
        idHeatKe.push(id);
        if (dataAwal[i]) colHtml += renderBracketMatchHtml(dataAwal[i], 'a', id);
        else colHtml += renderBracketPlaceholderHtml('a', true, id);
      }
      colHtml += '</div>';
      kolomHtmlList.push(colHtml);

      // Kolom 2+: hasil gabungan (merge) pemenang heat, ikuti pohonMerge.
      // Kolom PALING KANAN (dOverall === totalDepth) adalah Final sungguhan.
      const perDepthMerge = {};
      let leafCounter = 0;
      const idPerNodeMerge = new Map();
      (function jalan(node) {
        if (!node) return;
        if (node.tipe === 'unit') {
          idPerNodeMerge.set(node, idHeatKe[leafCounter]);
          leafCounter++;
          return;
        }
        jalan(node.a); jalan(node.b);
        if (!perDepthMerge[node.depth]) perDepthMerge[node.depth] = [];
        perDepthMerge[node.depth].push(node);
      })(pohonMerge);

      const maxDepthMerge = pohonMerge ? pohonMerge.depth : 0;
      for (let dm = 1; dm <= maxDepthMerge; dm++) {
        const dOverall = dm + 1;
        const namaBabak = namaBabakUntukDepth(dOverall, totalDepth);
        const adalahKolomFinal = (dOverall === totalDepth);
        const nodeList = perDepthMerge[dm] || [];
        const dataBabak = ambilDataUntukDepth(namaBabak, nodeList.length);

        let colHtml2 = '<div class="bracket-col"><div class="bracket-col-title' + (adalahKolomFinal ? '' : ' pool-a-title') + '"' +
          (adalahKolomFinal ? ' style="background:var(--gold);color:#3a2600;"' : '') + '>' + (adalahKolomFinal ? '🏆 ' : '') + escapeHtml(namaBabak) + '</div>';
        nodeList.forEach(function(node, i) {
          const id = idBaruBracket();
          idPerNodeMerge.set(node, id);
          if (dataBabak[i]) colHtml2 += renderBracketMatchHtml(dataBabak[i], adalahKolomFinal ? null : 'a', id);
          else colHtml2 += renderBracketPlaceholderHtml(adalahKolomFinal ? null : 'a', false, id);

          [node.a, node.b].forEach(function(anak) {
            const fromId = idPerNodeMerge.get(anak);
            if (fromId) connectorList.push({ from: fromId, to: id });
          });
        });
        colHtml2 += '</div>';
        kolomHtmlList.push(colHtml2);
      }

      let html = '<div class="bracket-mirror-wrap satu-sisi"><svg class="bracket-connector-svg"></svg>';
      html += '<div class="bracket-side"><div class="bracket-side-cols">' + kolomHtmlList.join('') + '</div></div>';
      html += '</div>';

      // Simpan struktur pohon supaya bisa dipakai fungsi posisi KHUSUS satu-sisi
      // (bukan floor(i/2) seperti sistem cermin, karena struktur pohon ini bisa
      // "melompati" satu kolom - butuh perhitungan posisi berbasis relasi node asli)
      daftarPohonSatuSisiUntukPosisi.push({ pohon: pohonMerge, idPerNode: idPerNodeMerge, idHeat: idHeatKe });
      return html;
    }

    function buatPasanganSimulasiDenganBye(daftarNamaTim, jumlahMatch) {
      const sisa = daftarNamaTim.slice();
      const pasangan = [];
      for (let i = 0; i < jumlahMatch; i++) {
        const timA = sisa.shift(), timB = sisa.shift();
        if (!timA) break;
        pasangan.push({ timA: timA, timB: timB || '', nomorHeat: 'Heat ' + (pasangan.length + 1) + (!timB ? ' (BYE)' : ''), status: 'Terjadwal', pemenang: '', simulasi: true });
      }
      return pasangan;
    }

    function renderBracketHtml(jumlahTim, aktualPerBabak) {
      if (jumlahTim <= 2) {
        const dataFinal = aktualPerBabak['Final'] || [];
        let html = '<div class="bracket-wrap"><div class="bracket-col"><div class="bracket-col-title">Final</div>';
        html += dataFinal[0] ? renderBracketMatchHtml(dataFinal[0]) : renderBracketPlaceholderHtml(null, false);
        for (let i = 1; i < dataFinal.length; i++) html += renderBracketMatchHtml(dataFinal[i]);
        html += '</div></div>';
        return html;
      }
      return renderBracketMirrorHtml(jumlahTim, aktualPerBabak);
    }

    function bagiDuaSisiPerBabak(dataBabak, slotA, slotB) {
      let sisiA = dataBabak.filter(function(j) { return j.pool === 'Pool A'; });
      let sisiB = dataBabak.filter(function(j) { return j.pool === 'Pool B'; });
      const tanpaLabel = dataBabak.filter(function(j) { return j.pool !== 'Pool A' && j.pool !== 'Pool B'; });
      tanpaLabel.forEach(function(j) { if (sisiA.length < slotA) sisiA.push(j); else sisiB.push(j); });
      return { sisiA: sisiA, sisiB: sisiB };
    }

    function renderSideColumns(babakSisi, dataPerBabakSisi, sisi, jumlahByeRonde1) {
      let prevIds = null;
      const kolomHtmlList = [];
      const cursorPerNama = {};
      babakSisi.forEach(function(kolom, kolomIdx) {
        const namaBabak = kolom[0];
        const jumlahSlot = kolom[1];
        if (cursorPerNama[namaBabak] === undefined) cursorPerNama[namaBabak] = 0;
        const poolBabak = dataPerBabakSisi[namaBabak] || [];
        const cursorAwal = cursorPerNama[namaBabak];
        const dataAktual = poolBabak.slice(cursorAwal, cursorAwal + jumlahSlot);
        cursorPerNama[namaBabak] += jumlahSlot;
        const isRondeAwal = (kolomIdx === 0);
        let colHtml = '<div class="bracket-col"><div class="bracket-col-title">' + escapeHtml(namaBabak) + '</div>';
        const idsKolomIni = [];
        for (let i = 0; i < jumlahSlot; i++) {
          const id = idBaruBracket();
          idsKolomIni.push(id);
          const pastiByeRondeAwal = isRondeAwal && jumlahByeRonde1 && (i >= jumlahSlot - jumlahByeRonde1);
          const hanyaSatuIndukan = prevIds && (2 * i + 1 >= prevIds.length);
          if (dataAktual[i]) colHtml += renderBracketMatchHtml(dataAktual[i], sisi, id);
          else if (pastiByeRondeAwal || hanyaSatuIndukan) colHtml += renderBracketPlaceholderByeHtml(sisi, id);
          else colHtml += renderBracketPlaceholderHtml(sisi, isRondeAwal, id);
        }
        for (let i = jumlahSlot; i < dataAktual.length; i++) colHtml += renderBracketMatchHtml(dataAktual[i], sisi);
        colHtml += '</div>';
        kolomHtmlList.push(colHtml);
        if (prevIds) prevIds.forEach(function(fromId, i) {
          const toId = idsKolomIni[Math.floor(i / 2)];
          if (toId) connectorList.push({ from: fromId, to: toId });
        });
        prevIds = idsKolomIni;
      });
      return { kolomHtmlList: kolomHtmlList, lastColumnIds: prevIds || [] };
    }

    function renderBracketMirrorHtml(jumlahTim, aktualPerBabak) {
      // Karena banyak babak sekarang berbagi nama "Penyisihan" (tidak lagi
      // spesifik per tingkat), pembagian sisi A/B memakai perkiraan otomatis
      // dari jumlah tim - bukan lagi dari label Pool pada data real.
      const timSisiA = Math.ceil(jumlahTim / 2);
      const timSisiB = jumlahTim - timSisiA;
      const slotA = Math.max(1, Math.ceil(timSisiA / 2));
      const slotB = Math.max(1, Math.ceil(timSisiB / 2));
      const byeRonde1A = slotA * 2 - timSisiA;
      const byeRonde1B = slotB * 2 - timSisiB;

      const kolomSisiA = susunanBracketDariSlot(slotA);
      const kolomSisiB = susunanBracketDariSlot(slotB);
      const namaBabakUnik = {};
      kolomSisiA.forEach(function(k) { namaBabakUnik[k[0]] = true; });
      kolomSisiB.forEach(function(k) { namaBabakUnik[k[0]] = true; });

      const dataSisiA = {}, dataSisiB = {};
      Object.keys(namaBabakUnik).forEach(function(namaBabak) {
        const entriA = kolomSisiA.filter(function(k) { return k[0] === namaBabak; })[0];
        const entriB = kolomSisiB.filter(function(k) { return k[0] === namaBabak; })[0];
        const bagi = bagiDuaSisiPerBabak(aktualPerBabak[namaBabak] || [], entriA ? entriA[1] : 0, entriB ? entriB[1] : 0);
        dataSisiA[namaBabak] = bagi.sisiA;
        dataSisiB[namaBabak] = bagi.sisiB;
      });

      const hasilA = renderSideColumns(kolomSisiA, dataSisiA, 'a', byeRonde1A);
      const hasilB = renderSideColumns(kolomSisiB, dataSisiB, 'b', byeRonde1B);

      let html = '<div class="bracket-mirror-wrap"><svg class="bracket-connector-svg"></svg>';
      html += '<div class="bracket-side"><div class="pool-master-label pool-a-master">🔵 POOL A</div><div class="bracket-side-cols">' + hasilA.kolomHtmlList.join('') + '</div></div>';
      html += '<div class="bracket-final-wrap"><div class="bracket-trophy">🏆</div><div class="bracket-col"><div class="bracket-col-title">Final</div>';
      const dataFinal = aktualPerBabak['Final'] || [];
      const idFinal = idBaruBracket();
      html += dataFinal[0] ? renderBracketMatchHtml(dataFinal[0], null, idFinal) : renderBracketPlaceholderHtml(null, false, idFinal);
      for (let i = 1; i < dataFinal.length; i++) html += renderBracketMatchHtml(dataFinal[i]);
      html += '</div></div>';
      html += '<div class="bracket-side"><div class="pool-master-label pool-b-master">🟠 POOL B</div><div class="bracket-side-cols">' + hasilB.kolomHtmlList.slice().reverse().join('') + '</div></div>';
      html += '</div>';

      hasilA.lastColumnIds.forEach(function(id) { connectorList.push({ from: id, to: idFinal }); });
      hasilB.lastColumnIds.forEach(function(id) { connectorList.push({ from: id, to: idFinal }); });
      return html;
    }

    function susunPosisiSemuaKolomBracket() {
      document.querySelectorAll('.bracket-mirror-wrap:not(.satu-sisi)').forEach(function(wrap) {
        wrap.querySelectorAll('.bracket-side').forEach(function(sideEl) {
          const kolomList = Array.from(sideEl.querySelectorAll('.bracket-side-cols > .bracket-col'));
          if (!kolomList.length) return;
          kolomList.sort(function(a, b) { return b.querySelectorAll('.bracket-match').length - a.querySelectorAll('.bracket-match').length; });
          const kolomElemenList = kolomList.map(function(kolomEl) { return Array.from(kolomEl.querySelectorAll('.bracket-match')); });
          posisikanSatuArahBracket(kolomElemenList);
        });
      });
    }

    // Posisi vertikal KHUSUS untuk skema satu-sisi (cascading tree): dihitung dari
    // RELASI NODE ASLI (node.a/node.b), bukan asumsi floor(i/2) antar kolom -
    // supaya kotak yang "melompati" satu kolom (mis. Heat3 langsung ke babak ke-3)
    // tetap sejajar dengan benar, tidak berantakan.
    function posisikanSemuaPohonSatuSisi() {
      daftarPohonSatuSisiUntukPosisi.forEach(function(entri) {
        function ambilCenterKolom(id) {
          const el = document.getElementById(id);
          if (!el) return 0;
          const kolomEl = el.parentElement;
          const r = el.getBoundingClientRect();
          const kr = kolomEl.getBoundingClientRect();
          return (r.top - kr.top) + r.height / 2;
        }
        function hitungY(node) {
          if (!node) return 0;
          if (node.tipe === 'unit') {
            return ambilCenterKolom(entri.idPerNode.get(node));
          }
          const yA = hitungY(node.a);
          const yB = hitungY(node.b);
          const yTarget = (yA + yB) / 2;
          const id = entri.idPerNode.get(node);
          const el = document.getElementById(id);
          if (el) {
            const h = el.getBoundingClientRect().height;
            el.style.position = 'absolute'; el.style.left = '0'; el.style.right = '0';
            el.style.top = Math.max(0, yTarget - h / 2) + 'px';
            const kolomEl = el.parentElement;
            const tinggiSaatIni = parseFloat(kolomEl.style.minHeight || '0');
            const dibutuhkan = yTarget + h / 2;
            if (dibutuhkan > tinggiSaatIni) kolomEl.style.minHeight = dibutuhkan + 'px';
          }
          return yTarget;
        }
        hitungY(entri.pohon);
      });
    }
    function posisikanSatuArahBracket(kolomElemenList) {
      if (!kolomElemenList.length || !kolomElemenList[0].length) return;
      function ambilCenterRelatifKolom(el) {
        const kolomEl = el.parentElement;
        const r = el.getBoundingClientRect();
        const kr = kolomEl.getBoundingClientRect();
        return (r.top - kr.top) + r.height / 2;
      }
      const tinggiKolomPertama = kolomElemenList[0][0].parentElement.getBoundingClientRect().height;
      let prevCenters = kolomElemenList[0].map(ambilCenterRelatifKolom);
      for (let k = 1; k < kolomElemenList.length; k++) {
        const kolomEl = kolomElemenList[k];
        if (!kolomEl.length) continue;
        const kontainerKolom = kolomEl[0].parentElement;
        kontainerKolom.style.minHeight = tinggiKolomPertama + 'px';
        const newCenters = [];
        kolomEl.forEach(function(el, i) {
          const cA = prevCenters[2 * i], cB = prevCenters[2 * i + 1];
          const target = (cA !== undefined && cB !== undefined) ? (cA + cB) / 2 : (cA !== undefined ? cA : 0);
          const h = el.getBoundingClientRect().height;
          el.style.position = 'absolute'; el.style.left = '0'; el.style.right = '0';
          el.style.top = Math.max(0, target - h / 2) + 'px';
          newCenters.push(target);
        });
        prevCenters = newCenters;
      }
    }
    function gambarSemuaGarisPenghubung() {
      document.querySelectorAll('.bracket-mirror-wrap').forEach(function(wrap) {
        const svg = wrap.querySelector('svg.bracket-connector-svg');
        if (!svg) return;
        svg.setAttribute('width', wrap.scrollWidth);
        svg.setAttribute('height', wrap.scrollHeight);
        svg.innerHTML = '';
        const wrapRect = wrap.getBoundingClientRect();
        connectorList.forEach(function(c) {
          const fromEl = document.getElementById(c.from), toEl = document.getElementById(c.to);
          if (!fromEl || !toEl) return;
          if (fromEl.closest('.bracket-mirror-wrap') !== wrap) return;
          const fr = fromEl.getBoundingClientRect(), tr = toEl.getBoundingClientRect();
          const tujuanDiKanan = tr.left >= fr.left;
          const x1 = (tujuanDiKanan ? fr.right : fr.left) - wrapRect.left + wrap.scrollLeft;
          const y1 = fr.top + fr.height / 2 - wrapRect.top + wrap.scrollTop;
          const x2 = (tujuanDiKanan ? tr.left : tr.right) - wrapRect.left + wrap.scrollLeft;
          const y2 = tr.top + tr.height / 2 - wrapRect.top + wrap.scrollTop;
          const xMid = (x1 + x2) / 2;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' L ' + xMid + ' ' + y1 + ' L ' + xMid + ' ' + y2 + ' L ' + x2 + ' ' + y2);
          path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#b9c6d3'); path.setAttribute('stroke-width', '2');
          svg.appendChild(path);
        });
      });
    }
    function renderBracketPlaceholderHtml(pool, isRondeAwal, id) {
      const kelasPool = pool ? ' pool-' + pool : '';
      const teks = isRondeAwal ? 'Menunggu Undian' : 'Menunggu Hasil Pertandingan';
      return '<div class="bracket-match placeholder' + kelasPool + '"' + (id ? ' id="' + id + '"' : '') + '>' +
        '<div class="bm-heat">&nbsp;</div><div class="bm-team tbd">' + teks + '</div><div class="bm-vs">vs</div><div class="bm-team tbd">' + teks + '</div></div>';
    }
    function renderBracketPlaceholderByeHtml(pool, id) {
      const kelasPool = pool ? ' pool-' + pool : '';
      return '<div class="bracket-match placeholder ada-bye' + kelasPool + '"' + (id ? ' id="' + id + '"' : '') + '>' +
        '<div class="bm-heat"><span class="bye-tag">BYE</span></div><div class="bm-team tbd">Menunggu Undian <span class="bye-note">(akan otomatis lolos)</span></div>' +
        '<div class="bm-vs">tanpa lawan</div><div class="bm-bye-slot">— BYE —</div></div>';
    }
    function renderBracketMatchHtml(j, pool, id) {
      const selesai = j.status === 'Selesai';
      const adaBye = !j.timB || j.timB === 'BYE';
      const kelasPool = pool ? ' pool-' + pool : (j.pool === 'Pool A' ? ' pool-a' : (j.pool === 'Pool B' ? ' pool-b' : ''));
      let html = '<div class="bracket-match' + (selesai ? ' selesai' : '') + (adaBye ? ' ada-bye' : '') + (j.simulasi ? ' simulasi' : '') + kelasPool + '"' + (id ? ' id="' + id + '"' : '') + '>';
      html += '<div class="bm-heat">' + (j.nomorHeat ? escapeHtml(j.nomorHeat) : '&nbsp;') + (adaBye ? ' <span class="bye-tag">BYE</span>' : '') + (j.simulasi ? ' <span class="bm-simulasi-tag">PRATINJAU</span>' : '') + '</div>';
      html += '<div class="bm-team' + (selesai && j.pemenang === j.timA ? ' winner' : '') + '">' + escapeHtml(j.timA) + (selesai && j.pemenang === j.timA ? ' 🏆' : '') + (adaBye ? ' <span class="bye-note">(Otomatis Lolos)</span>' : '') + '</div>';
      if (adaBye) { html += '<div class="bm-vs">tanpa lawan</div><div class="bm-team bm-bye-slot">— BYE —</div>'; }
      else { html += '<div class="bm-vs">vs</div><div class="bm-team' + (selesai && j.pemenang === j.timB ? ' winner' : '') + '">' + escapeHtml(j.timB) + (selesai && j.pemenang === j.timB ? ' 🏆' : '') + '</div>'; }
      if (j.waktu || j.catatan) html += '<div class="bm-waktu">' + [j.waktu, j.catatan].filter(Boolean).map(escapeHtml).join(' · ') + '</div>';
      html += '</div>';
      return html;
    }