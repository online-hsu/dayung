/* =================================================================
     JS_Undian.html
     Berisi: Acak Tim Bertanding (undian roulette Pool A/B maupun
     satu-sisi), dan kunci posisi menu bawah anti-lompat (khusus HP).
     ================================================================= */
    /* ================= ADMIN: ACAK TIM BERTANDING (UNDIAN) ================= */
    let poolUndian = [];
    let urutanKeluarUndian = [];
    let daftarPasanganUndian = [];
    let jumlahTersimpanUndian = 0;
    let rotasiRodaSaatIni = 0;
    let sedangBerputar = false;
    let kategoriUndianAktif = '';
    let kelasUndianAktif = '';
    let babakUndianAktif = 'Babak-1';
    let babakPoolAAktif = 'Babak-1';
    let babakPoolBAktif = 'Babak-1';
    let timPoolBMenunggu = [];
    let poolLabelAktif = 'Pool A';
    let pakaiSatuSisiUndianAktif = false;
    let byeDibutuhkanSatuSisi = 0;
    const WARNA_RODA = ['#a6192e', '#e0a72e', '#c1273a', '#38761d', '#8e44ad', '#d35400', '#16a085', '#e0483f', '#2c3e50', '#6e0e1a'];

    function toggleUndianKelas() {
      const kategori = document.getElementById('undianKategori').value;
      document.getElementById('wrapUndianKelas').style.display = (kategori === 'Perahu Tradisional') ? 'block' : 'none';
    }
    function resetUndianSetup() {
      document.getElementById('undianSetup').style.display = 'block';
      document.getElementById('undianRoda').style.display = 'none';
      document.getElementById('undianKategori').value = '';
      document.getElementById('wrapUndianKelas').style.display = 'none';
      document.getElementById('undianSlotA').value = '';
      document.getElementById('undianSlotB').value = '';
      document.getElementById('undianBabakPilihan').value = '';
      document.getElementById('undianSetupMsg').style.display = 'none';
      timPoolBMenunggu = [];
      poolLabelAktif = 'Pool A';
      pakaiSatuSisiUndianAktif = false;
      byeDibutuhkanSatuSisi = 0;
    }
    function ulangiUndian() { resetUndianSetup(); }

    function mulaiUndian() {
      const kategori = document.getElementById('undianKategori').value;
      const kelas = document.getElementById('undianKelas') ? document.getElementById('undianKelas').value : '';
      const msgEl = document.getElementById('undianSetupMsg');
      if (!kategori) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Pilih kategori terlebih dahulu.'; return; }
      if (kategori === 'Perahu Tradisional' && !kelas) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Pilih kelas terlebih dahulu.'; return; }
      msgEl.style.display = 'none';

      google.script.run.withSuccessHandler(function(res) {
          if (!res.success) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = res.message; return; }
          let daftarTim = res.list.filter(function(t) {
              if (t.kategori !== kategori) return false;
              if (kategori === 'Perahu Tradisional' && t.kelas !== kelas) return false;
              return true;
            }).map(function(t) { return t.namaTim; });
          if (daftarTim.length < 2) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Minimal 2 tim diperlukan untuk membuat undian. Tim terdaftar untuk kategori ini: ' + daftarTim.length + '.'; return; }

          // Tradisional Putri & ASN pakai skema SATU SISI (bukan cermin Pool A/B) -
          // supaya nama babak hasil undian konsisten dengan skema yang ditampilkan,
          // semua tim diundi sebagai SATU kelompok utuh (tidak dibagi Pool A/Pool B).
          const pakaiSatuSisiUndian = kategori === 'Perahu Tradisional' && (kelas === 'Umum Putri' || kelas === 'ASN');
          pakaiSatuSisiUndianAktif = pakaiSatuSisiUndian;

          let slotA, slotB;
          if (pakaiSatuSisiUndian) {
            slotA = Math.max(1, Math.ceil(daftarTim.length / 2));
            slotB = 0;
          } else {
            const inputSlotA = parseInt(document.getElementById('undianSlotA').value, 10);
            const inputSlotB = parseInt(document.getElementById('undianSlotB').value, 10);
            if (inputSlotA > 0 && inputSlotB > 0) { slotA = inputSlotA; slotB = inputSlotB; }
            else {
              const timSisiTerbesar = Math.ceil(daftarTim.length / 2);
              slotA = Math.max(1, Math.ceil(timSisiTerbesar / 2));
              slotB = Math.max(1, Math.ceil((daftarTim.length - timSisiTerbesar) / 2));
            }
          }
          babakPoolBAktif = susunanBracketDariSlot(slotB)[0] ? susunanBracketDariSlot(slotB)[0][0] : 'Babak-1';
          if (pakaiSatuSisiUndian) {
            const jumlahHeatUndian = Math.max(1, Math.ceil(daftarTim.length / 2));
            const pohonUndian = bangunPohonCascading(jumlahHeatUndian);
            const totalDepthUndian = 1 + (pohonUndian ? pohonUndian.depth : 0);
            babakPoolAAktif = namaBabakUntukDepth(1, totalDepthUndian);
            byeDibutuhkanSatuSisi = 0; // babak awal selalu pasangan bersih; sisa ganjil (kalau ada) ditangani mekanisme default
          } else {
            babakPoolAAktif = susunanBracketDariSlot(slotA)[0] ? susunanBracketDariSlot(slotA)[0][0] : 'Babak-1';
            byeDibutuhkanSatuSisi = 0;
          }
          babakUndianAktif = babakPoolAAktif;

          // Override manual: kalau admin memilih babak sendiri (Babak-2 dst), pakai
          // nama babak itu langsung untuk Pool A & Pool B - tidak perlu hitung
          // otomatis dari jumlah tim, karena di babak lanjutan ini undian dipakai
          // untuk mengacak SEMUA tim terdaftar di kategori tsb ke babak tertentu
          // (bukan hasil maju otomatis dari babak sebelumnya).
          const babakManual = (document.getElementById('undianBabakPilihan').value || '').trim();
          if (babakManual) {
            babakPoolAAktif = babakManual;
            babakPoolBAktif = babakManual;
            babakUndianAktif = babakManual;
          }

          kategoriUndianAktif = kategori; kelasUndianAktif = kelas;
          urutanKeluarUndian = []; daftarPasanganUndian = []; jumlahTersimpanUndian = 0;

          const catatanEl = document.getElementById('undianCatatanKhusus');
          catatanEl.style.display = 'none';

          if (kategori === 'Perahu Naga') {
            const cari = function(nama) { return daftarTim.find(function(t) { return t.toLowerCase().trim() === nama.toLowerCase().trim(); }); };
            const polres = cari('Polres HSU'), prokopim = cari('Prokopim HSU');
            if (polres && prokopim) {
              const pasanganAwal = urutanLineUndian_(polres, prokopim);
              daftarPasanganUndian.push({ timA: pasanganAwal[0], timB: pasanganAwal[1], nomorHeat: 'Heat 1', babak: babakUndianAktif });
              daftarTim = daftarTim.filter(function(t) { return t !== polres && t !== prokopim; });
            } else {
              catatanEl.style.display = 'block'; catatanEl.className = 'msg error';
              catatanEl.textContent = '⚠️ Tim "Polres HSU" dan/atau "Prokopim HSU" tidak ditemukan. Semua tim akan diundi acak sepenuhnya.';
            }
          }

          for (let i = daftarTim.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = daftarTim[i]; daftarTim[i] = daftarTim[j]; daftarTim[j] = tmp;
          }
          const jumlahTimPoolA = Math.min(daftarTim.length, slotA * 2);
          poolUndian = daftarTim.slice(0, jumlahTimPoolA);
          timPoolBMenunggu = daftarTim.slice(jumlahTimPoolA);
          poolLabelAktif = 'Pool A';

          document.getElementById('undianJudulKategori').textContent = kategori + (kategori === 'Perahu Tradisional' ? ' — ' + kelas : '');
          document.getElementById('judulPasanganUndian').textContent = 'Pasangan Hasil Undian (Babak ' + babakUndianAktif + ')';
          document.getElementById('btnSimpanUndian').textContent = '💾 Simpan Semua ke Jadwal ' + babakUndianAktif;
          document.getElementById('undianSetup').style.display = 'none';
          document.getElementById('undianRoda').style.display = 'block';
          document.getElementById('undianHasilSpin').style.display = 'none';
          document.getElementById('undianSelesaiMsg').style.display = 'none';
          document.getElementById('rouletteSpinBtn').disabled = false;
          document.getElementById('rouletteSpinBtn').textContent = pakaiSatuSisiUndian ? '🎡 Putar Roda!' : '🎡 Putar Roda! (Pool A)';

          renderDaftarPasanganUndian();
          if (poolUndian.length === 0 && timPoolBMenunggu.length === 0) selesaiUndian();
          else if (poolUndian.length === 0) lanjutKePoolB();
          else gambarRodaUndian();
        })
        .withFailureHandler(function(err) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Gagal memuat data tim: ' + (err && err.message ? err.message : err); })
        .getDaftarTimUntukAdmin(adminPassword);
    }

    function gambarRodaUndian() {
      const canvas = document.getElementById('rouletteCanvas');
      const ctx = canvas.getContext('2d');
      const n = poolUndian.length;
      const radius = canvas.width / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (n === 0) return;
      const anglePer = (2 * Math.PI) / n;
      for (let i = 0; i < n; i++) {
        const startAngle = i * anglePer, endAngle = startAngle + anglePer;
        ctx.beginPath(); ctx.moveTo(radius, radius); ctx.arc(radius, radius, radius - 4, startAngle, endAngle); ctx.closePath();
        ctx.fillStyle = WARNA_RODA[i % WARNA_RODA.length]; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.save(); ctx.translate(radius, radius); ctx.rotate(startAngle + anglePer / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Inter, sans-serif';
        const label = poolUndian[i].length > 15 ? poolUndian[i].slice(0, 13) + '…' : poolUndian[i];
        ctx.fillText(label, radius - 16, 4); ctx.restore();
      }
    }
    function putarRoda() {
      if (sedangBerputar || poolUndian.length === 0) return;
      sedangBerputar = true;
      document.getElementById('rouletteSpinBtn').disabled = true;
      document.getElementById('undianHasilSpin').style.display = 'none';
      const n = poolUndian.length;
      const idxMenang = Math.floor(Math.random() * n);
      const anglePerDeg = 360 / n;
      const segmentCenterDeg = idxMenang * anglePerDeg + anglePerDeg / 2;
      const targetDeg = 270 - segmentCenterDeg;
      const finalRotation = 6 * 360 + ((targetDeg % 360) + 360) % 360;
      const canvas = document.getElementById('rouletteCanvas');
      canvas.style.transition = 'transform 4s cubic-bezier(0.15,0.85,0.35,1)';
      canvas.style.transform = 'rotate(' + finalRotation + 'deg)';

      setTimeout(function() {
        const timTerpilih = poolUndian[idxMenang];
        poolUndian.splice(idxMenang, 1);
        const hasilEl = document.getElementById('undianHasilSpin');
        hasilEl.textContent = '🎉 ' + timTerpilih;
        hasilEl.style.display = 'inline-block';
        canvas.style.transition = 'none'; canvas.style.transform = 'rotate(0deg)';
        gambarRodaUndian();

        // Mode satu-sisi (Putri/ASN): kalau masih ada kuota BYE & tidak sedang
        // menunggu pasangan, tim ini langsung dapat BYE (tidak perlu tim kedua)
        const tidakSedangMenunggu = (urutanKeluarUndian.length % 2 === 0);
        if (pakaiSatuSisiUndianAktif && byeDibutuhkanSatuSisi > 0 && tidakSedangMenunggu) {
          daftarPasanganUndian.push({ timA: timTerpilih, timB: '', nomorHeat: 'Heat ' + (daftarPasanganUndian.length + 1) + ' (BYE)', babak: babakUndianAktif, pool: '' });
          byeDibutuhkanSatuSisi--;
          renderDaftarPasanganUndian();
        } else {
          urutanKeluarUndian.push(timTerpilih);
          prosesPasanganBaruUndian();
        }

        sedangBerputar = false;
        if (poolUndian.length === 0) {
          if (urutanKeluarUndian.length % 2 === 1) {
            const sisa = urutanKeluarUndian[urutanKeluarUndian.length - 1];
            daftarPasanganUndian.push({ timA: sisa, timB: '', nomorHeat: 'Heat ' + (daftarPasanganUndian.length + 1) + ' (BYE)', babak: babakUndianAktif, pool: pakaiSatuSisiUndianAktif ? '' : poolLabelAktif });
            renderDaftarPasanganUndian(); urutanKeluarUndian = [];
          }
          if (timPoolBMenunggu.length > 0) lanjutKePoolB(); else selesaiUndian();
        } else { document.getElementById('rouletteSpinBtn').disabled = false; }
      }, 4200);
    }
    function prosesPasanganBaruUndian() {
      if (urutanKeluarUndian.length % 2 === 0) {
        const b = urutanKeluarUndian[urutanKeluarUndian.length - 1], a = urutanKeluarUndian[urutanKeluarUndian.length - 2];
        const pasangan = urutanLineUndian_(a, b);
        daftarPasanganUndian.push({ timA: pasangan[0], timB: pasangan[1], nomorHeat: 'Heat ' + (daftarPasanganUndian.length + 1), babak: babakUndianAktif, pool: pakaiSatuSisiUndianAktif ? '' : poolLabelAktif });
        renderDaftarPasanganUndian();
      }
    }
    // Posisi Line hanya diacak untuk Babak-2 dan seterusnya - undian Babak-1
    // (default) tetap memakai urutan tarikan roda apa adanya (tidak diacak lagi).
    function urutanLineUndian_(x, y) {
      if (babakUndianAktif === 'Babak-1') return [x, y];
      return acakUrutanLine_(x, y);
    }
    function lanjutKePoolB() {
      poolUndian = timPoolBMenunggu; timPoolBMenunggu = [];
      poolLabelAktif = 'Pool B'; babakUndianAktif = babakPoolBAktif; urutanKeluarUndian = [];
      const catatanEl = document.getElementById('undianCatatanKhusus');
      catatanEl.style.display = 'block'; catatanEl.className = 'msg success';
      catatanEl.textContent = '✅ Pool A selesai diundi. Lanjut mengundi Pool B (' + poolUndian.length + ' tim).';
      document.getElementById('rouletteSpinBtn').textContent = '🎡 Putar Roda! (Pool B)';
      document.getElementById('rouletteSpinBtn').disabled = false;
      gambarRodaUndian();
    }
    function selesaiUndian() {
      if (urutanKeluarUndian.length % 2 === 1) {
        const sisa = urutanKeluarUndian[urutanKeluarUndian.length - 1];
        daftarPasanganUndian.push({ timA: sisa, timB: '', nomorHeat: 'Heat ' + (daftarPasanganUndian.length + 1) + ' (BYE)', babak: babakUndianAktif, pool: pakaiSatuSisiUndianAktif ? '' : poolLabelAktif });
        renderDaftarPasanganUndian();
      }
      document.getElementById('rouletteSpinBtn').disabled = true;
      document.getElementById('rouletteSpinBtn').textContent = '✅ Undian Selesai';
      document.getElementById('undianSelesaiMsg').style.display = 'block';
    }
    function renderDaftarPasanganUndian() {
      const container = document.getElementById('daftarPasanganContainer');
      const simpanBox = document.getElementById('undianSelesaiMsg');
      if (!daftarPasanganUndian.length) { container.innerHTML = '<div class="empty-state">Mulai putar roda untuk membentuk pasangan pertandingan.</div>'; simpanBox.style.display = 'none'; return; }
      container.innerHTML = daftarPasanganUndian.map(function(p) {
        const pool = p.pool || 'Pool A';
        const badge = '<span class="pool-badge pool-' + (pool === 'Pool A' ? 'a' : 'b') + '">' + escapeHtml(pool) + '</span>';
        return '<div class="tim-item"><div class="tim-info"><div class="tim-nama">' + escapeHtml(p.nomorHeat) + ' ' + badge + '</div>' +
          '<div class="tim-sub">' + escapeHtml(p.timA) + ' <strong>VS</strong> ' + escapeHtml(p.timB || 'BYE (otomatis lolos)') + '</div></div></div>';
      }).join('');
      simpanBox.style.display = 'block';
    }
    function simpanHasilUndian() {
      const msgEl = document.getElementById('undianSimpanMsg');
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = '';
      const pasanganBaru = daftarPasanganUndian.slice(jumlahTersimpanUndian);
      if (!pasanganBaru.length) { msgEl.className = 'msg error'; msgEl.textContent = 'Tidak ada pasangan baru untuk disimpan (semua sudah tersimpan sebelumnya).'; return; }
      google.script.run.withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error'; msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
          if (res.success) jumlahTersimpanUndian = daftarPasanganUndian.length;
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .simpanUndianKeJadwal(adminPassword, kategoriUndianAktif, kelasUndianAktif, pasanganBaru);
    }
    /* ================= POSISI MENU BAWAH (MOBILE) =================
       Sebelumnya ada kompensasi manual pakai window.visualViewport untuk
       "mengunci" posisi saat address bar Chrome sembul/muncul - tapi ini
       justru menyebabkan celah putih saat scroll mentok ke paling bawah
       (karena browser sendiri sudah menampilkan kembali address bar-nya di
       titik itu, lalu kompensasi JS menggeser menu naik LEBIH JAUH lagi di
       atas itu). CSS position:fixed;bottom:0 bawaan browser modern sudah
       menangani ini dengan benar tanpa perlu bantuan JS sama sekali. */