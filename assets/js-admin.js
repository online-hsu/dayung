/* =================================================================
     JS_Admin.html
     Berisi: Login Admin, Kelola Tim (edit data + foto peserta, cetak),
     Download PDF (Jadwal/Skema per kategori), Jadwal Pertandingan
     Global (semua kategori), dan Kelola Jadwal Pertandingan (CRUD
     + Set Pemenang + Ubah Status).
     ================================================================= */
    /* ================= ADMIN: LOGIN ================= */
    let adminPassword = '';
    function bukaAdminLogin() {
      document.getElementById('adminLoginMsg').style.display = 'none';
      document.getElementById('adminPasswordInput').value = '';
      document.getElementById('adminLoginModal').style.display = 'flex';
    }
    function tutupAdminLogin() { document.getElementById('adminLoginModal').style.display = 'none'; }
    function prosesAdminLogin() {
      const pw = document.getElementById('adminPasswordInput').value;
      const msgEl = document.getElementById('adminLoginMsg');
      if (!pw) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Masukkan password terlebih dahulu.'; return; }
      google.script.run
        .withSuccessHandler(function(res) {
          if (res.success) { adminPassword = pw; tutupAdminLogin(); setActiveNav('navAdmin'); tampilkanAdmin(); }
          else { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = res.message || 'Password salah.'; }
        })
        .withFailureHandler(function(err) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Gagal login: ' + (err && err.message ? err.message : err); })
        .adminLogin(pw);
    }
    function logoutAdmin() { adminPassword = ''; tampilkanBeranda(); }

    /* ================= ADMIN: KELOLA TIM ================= */
    function muatDaftarTimAdmin() {
      const container = document.getElementById('adminTimList');
      container.innerHTML = '<div class="loading-state">Memuat data tim...</div>';
      google.script.run
        .withSuccessHandler(function(res) {
          if (!res.success) { container.innerHTML = '<div class="empty-state">❌ ' + escapeHtml(res.message) + '</div>'; adminPassword = ''; return; }
          if (!res.list.length) { container.innerHTML = '<div class="empty-state">Belum ada tim yang terdaftar.</div>'; return; }
          container.innerHTML = res.list.map(function(t) {
            const kelasLabel = (t.kategori === 'Perahu Tradisional' && t.kelas && t.kelas !== '-') ? ' · ' + t.kelas : '';
            return '<div class="tim-item"><div class="tim-info"><div class="tim-nama">#' + t.nomor + ' — ' + escapeHtml(t.namaTim) + '</div>' +
              '<div class="tim-sub">Ketua: ' + escapeHtml(t.namaKetua) + ' · ' + t.waktu + ' · ' + escapeHtml(t.kategori) + escapeHtml(kelasLabel) + '</div></div>' +
              '<div class="tim-actions"><button class="btn-kelola" onclick="bukaKelolaTim(' + t.nomor + ')">✏️ Kelola</button>' +
              '<button class="btn-cetak" onclick="cetakTim(' + t.nomor + ', this)">🖨️ Cetak</button>' +
              '<button class="btn-cetak" onclick="cetakKuponRace(' + escapeAttr(JSON.stringify(t.namaTim)) + ', ' + escapeAttr(JSON.stringify(t.kategori)) + ', ' + escapeAttr(JSON.stringify(t.kelas || '')) + ', this)">🎫 Kupon Race</button></div></div>';
          }).join('');
        })
        .withFailureHandler(function(err) { container.innerHTML = '<div class="empty-state">❌ Gagal memuat: ' + (err && err.message ? err.message : err) + '</div>'; })
        .getDaftarTimUntukAdmin(adminPassword);
    }

    function bukaKelolaTim(nomorUrut) {
      document.getElementById('adminEditModal').style.display = 'flex';
      document.getElementById('adminEditTitle').textContent = 'Kelola Data Tim #' + nomorUrut;
      const body = document.getElementById('adminEditBody');
      body.innerHTML = '<div class="loading-state">Memuat data tim...</div>';
      google.script.run
        .withSuccessHandler(function(res) {
          if (!res.success) { body.innerHTML = '<div class="empty-state">❌ ' + escapeHtml(res.message) + '</div>'; return; }
          renderKelolaTim(res.team, res.peserta);
        })
        .withFailureHandler(function(err) { body.innerHTML = '<div class="empty-state">❌ Gagal memuat: ' + (err && err.message ? err.message : err) + '</div>'; })
        .getTeamDetail(adminPassword, nomorUrut);
    }
    function tutupAdminEdit() { document.getElementById('adminEditModal').style.display = 'none'; }

    function renderKelolaTim(team, peserta) {
      const body = document.getElementById('adminEditBody');
      const kelasOptions = ['Umum Putra', 'Umum Putri', 'ASN'].map(function(k) {
        return '<option value="' + k + '"' + (team.kelas === k ? ' selected' : '') + '>' + k + '</option>';
      }).join('');
      let html = '<div class="admin-section-title">Data Tim</div>';
      html += '<label>Nama Tim</label><input type="text" id="editNamaTim" value="' + escapeAttr(team.namaTim) + '">';
      html += '<label>Nama Ketua</label><input type="text" id="editNamaKetua" value="' + escapeAttr(team.namaKetua) + '">';
      html += '<label>Nama Pendamping</label><input type="text" id="editNamaPendamping" value="' + escapeAttr(team.namaPendamping === '-' ? '' : team.namaPendamping) + '">';
      html += '<label>No. WhatsApp</label><input type="tel" id="editNoWa" value="' + escapeAttr(team.noWa) + '">';
      if (team.kategori === 'Perahu Tradisional') html += '<label>Kelas</label><select id="editKelas">' + kelasOptions + '</select>';
      html += '<label>Catatan</label><input type="text" id="editCatatan" value="' + escapeAttr(team.catatan) + '">';
      html += '<button class="btn-primary" style="margin-top:12px;width:100%;" onclick="simpanDataTim(' + team.nomor + ')">💾 Simpan Data Tim</button>';
      html += '<div id="editTimMsg" class="msg" style="display:none;"></div>';
      html += '<div class="admin-section-title">Data Peserta (' + team.kategori + (team.kelas && team.kelas !== '-' ? ' · ' + team.kelas : '') + ')</div>';
      peserta.forEach(function(p) {
        const isKosong = !p.nama;
        html += '<div class="admin-peserta-row' + (p.wajib ? '' : ' cadangan') + '" data-peran="' + escapeAttr(p.peran) + '">';
        html += '<div class="apr-head"><strong>' + p.peran + (p.wajib ? '' : ' (Cadangan)') + '</strong><span class="apr-tag' + (isKosong ? ' kosong' : '') + '">' + (isKosong ? 'Belum diisi' : 'Terisi') + '</span></div>';
        html += '<input type="text" class="admin-nama" placeholder="Nama lengkap sesuai KTP" value="' + escapeAttr(p.nama) + '">';
        if (p.linkKtp) html += '<a class="apr-foto-link" href="' + p.linkKtp + '" target="_blank">📎 Lihat foto KTP saat ini</a><br>';
        html += '<label style="margin-bottom:4px;">' + (p.linkKtp ? 'Ganti Foto KTP (kosongkan jika tidak diganti)' : 'Foto KTP') + '</label>';
        html += '<input type="file" class="admin-ktp" accept="image/*">';
        html += '<div style="margin-top:8px;"><button class="apr-save-btn" onclick="simpanPeserta(' + team.nomor + ', this)">💾 Simpan</button></div>';
        html += '<div class="apr-status"></div></div>';
      });
      body.innerHTML = html;
    }

    function simpanDataTim(nomorUrut) {
      const msgEl = document.getElementById('editTimMsg');
      const data = {
        namaTim: document.getElementById('editNamaTim').value.trim(),
        namaKetua: document.getElementById('editNamaKetua').value.trim(),
        namaPendamping: document.getElementById('editNamaPendamping').value.trim(),
        noWa: document.getElementById('editNoWa').value.trim(),
        catatan: document.getElementById('editCatatan').value.trim()
      };
      const kelasEditEl = document.getElementById('editKelas');
      if (kelasEditEl) data.kelas = kelasEditEl.value;
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = '';
      google.script.run
        .withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error';
          msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
          if (res.success) muatDaftarTimAdmin();
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .updateTeamData(adminPassword, nomorUrut, data);
    }

    function simpanPeserta(nomorUrut, btnEl) {
      const row = btnEl.closest('.admin-peserta-row');
      const peran = row.getAttribute('data-peran');
      const nama = row.querySelector('.admin-nama').value.trim();
      const fileInput = row.querySelector('.admin-ktp');
      const statusEl = row.querySelector('.apr-status');
      if (!nama) { statusEl.style.color = 'var(--red)'; statusEl.textContent = 'Nama tidak boleh kosong.'; return; }
      btnEl.disabled = true; btnEl.textContent = 'Menyimpan...'; statusEl.style.color = ''; statusEl.textContent = '';
      (async function() {
        try {
          let fotoKtp = null;
          if (fileInput.files[0]) {
            fotoKtp = await fileToCompressedBase64(fileInput.files[0], 1000, 0.7);
            if (!fotoKtp) throw new Error('Gagal memproses foto. Coba foto lain.');
          }
          google.script.run
            .withSuccessHandler(function(res) {
              btnEl.disabled = false; btnEl.textContent = '💾 Simpan';
              statusEl.style.color = res.success ? 'var(--green)' : 'var(--red)';
              statusEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
              if (res.success) { const tagEl = row.querySelector('.apr-tag'); tagEl.className = 'apr-tag'; tagEl.textContent = 'Terisi'; }
            })
            .withFailureHandler(function(err) { btnEl.disabled = false; btnEl.textContent = '💾 Simpan'; statusEl.style.color = 'var(--red)'; statusEl.textContent = '❌ Gagal: ' + (err && err.message ? err.message : err); })
            .simpanPesertaAdmin(adminPassword, nomorUrut, peran, nama, fotoKtp);
        } catch (err) {
          btnEl.disabled = false; btnEl.textContent = '💾 Simpan'; statusEl.style.color = 'var(--red)';
          statusEl.textContent = '❌ ' + (err && err.message ? err.message : 'Gagal memproses foto.');
        }
      })();
    }

    function cetakTim(nomorUrut, btnEl) {
      const teksAsliBtn = btnEl ? btnEl.textContent : '';
      if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Menyiapkan...'; }
      google.script.run
        .withSuccessHandler(function(res) {
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = teksAsliBtn; }
          if (!res.success) { alert(res.message); return; }
          renderPrintArea(res.team, res.peserta);
          const judulAsli = document.title;
          document.title = 'Data Pendaftaran Tim';
          const kembalikanJudul = function() { document.title = judulAsli; window.removeEventListener('afterprint', kembalikanJudul); };
          window.addEventListener('afterprint', kembalikanJudul);
          setTimeout(function() { window.print(); }, 300);
        })
        .withFailureHandler(function(err) { if (btnEl) { btnEl.disabled = false; btnEl.textContent = teksAsliBtn; } alert('Gagal memuat data untuk dicetak: ' + (err && err.message ? err.message : err)); })
        .getTeamDetailUntukCetak(adminPassword, nomorUrut);
    }
    function renderPrintArea(team, peserta) {
      const kelasLabel = (team.kategori === 'Perahu Tradisional' && team.kelas && team.kelas !== '-') ? ' — ' + team.kelas : '';
      let html = '<h2>Data Pendaftaran Tim</h2>';
      html += '<div class="pr-sub">HUT RI Ke-81 — Kabupaten Hulu Sungai Utara · ' + escapeHtml(team.kategori) + escapeHtml(kelasLabel) + '</div>';
      html += '<div class="pr-info-grid">';
      html += '<div><strong>Nama Tim:</strong> ' + escapeHtml(team.namaTim) + '</div><div><strong>Waktu Daftar:</strong> ' + team.waktu + '</div>';
      html += '<div><strong>Nama Ketua:</strong> ' + escapeHtml(team.namaKetua) + '</div><div><strong>Nama Pendamping:</strong> ' + escapeHtml(team.namaPendamping) + '</div>';
      html += '<div><strong>No. WhatsApp:</strong> ' + escapeHtml(team.noWa) + '</div><div><strong>Catatan:</strong> ' + escapeHtml(team.catatan || '-') + '</div></div>';
      html += '<table class="pr-team-table"><thead><tr><th>No</th><th>Posisi</th><th>Nama Peserta</th><th>Foto KTP</th></tr></thead><tbody>';
      peserta.forEach(function(p, idx) {
        const fotoHtml = p.fotoDataUri ? '<img src="' + p.fotoDataUri + '" class="pr-ktp-img" alt="KTP ' + escapeAttr(p.nama) + '">' : '<span class="pr-no-foto">Belum ada foto</span>';
        html += '<tr><td>' + (idx + 1) + '</td><td>' + escapeHtml(p.peran) + (p.wajib ? '' : ' (Cadangan)') + '</td><td>' + escapeHtml(p.nama || '-') + '</td><td class="pr-foto-cell">' + fotoHtml + '</td></tr>';
      });
      html += '</tbody></table>';
      document.getElementById('printArea').innerHTML = html;
    }

    // ================= KUPON RACE (kartu verifikasi manual per pertandingan) =================
    // Jumlah kolom babak menyesuaikan struktur skema kategori/kelas tim ini
    // (sistem cermin Pool A/B untuk Naga & Putra, sistem cascading untuk Putri & ASN).
    // Pool diambil dari data Jadwal Pertandingan yang sesungguhnya (bukan diagram ulang).
    function hitungDaftarBabakKupon(kategori, kelas, poolTim, jumlahTim) {
      const pakaiSatuSisi = kategori === 'Perahu Tradisional' && (kelas === 'Umum Putri' || kelas === 'ASN');
      if (pakaiSatuSisi) {
        const jumlahHeat = Math.max(1, Math.ceil(jumlahTim / 2));
        const pohonMerge = bangunPohonCascading(jumlahHeat);
        const totalDepth = 1 + (pohonMerge ? pohonMerge.depth : 0);
        const daftar = [];
        for (let d = 1; d <= totalDepth; d++) daftar.push(namaBabakUntukDepth(d, totalDepth));
        return daftar;
      }
      const timSisiA = Math.ceil(jumlahTim / 2);
      const timSisiB = jumlahTim - timSisiA;
      const slotA = Math.max(1, Math.ceil(timSisiA / 2));
      const slotB = Math.max(1, Math.ceil(timSisiB / 2));
      const slotUntukTimIni = poolTim === 'Pool B' ? slotB : slotA;
      const kolom = susunanBracketDariSlot(slotUntukTimIni).map(function(k) { return k[0]; });
      kolom.push('Final'); // Final menggabungkan juara Pool A & Pool B, di luar susunan per-pool
      return kolom;
    }
    function cetakKuponRace(namaTim, kategori, kelas, btnEl) {
      const teksAsli = btnEl ? btnEl.textContent : '';
      if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Menyiapkan...'; }
      google.script.run
        .withSuccessHandler(function(listJadwal) {
          google.script.run
            .withSuccessHandler(function(listTim) {
              if (btnEl) { btnEl.disabled = false; btnEl.textContent = teksAsli; }
              const cocokJadwal = listJadwal.filter(function(j) {
                if (j.kategori !== kategori) return false;
                if (kategori === 'Perahu Tradisional' && j.kelas !== kelas) return false;
                return j.timA === namaTim || j.timB === namaTim;
              });
              const poolTim = cocokJadwal.length ? (cocokJadwal[0].pool || '') : '';
              const jumlahTim = listTim.filter(function(t) {
                if (t.kategori !== kategori) return false;
                if (kategori === 'Perahu Tradisional' && t.kelas !== kelas) return false;
                return true;
              }).length || 1;
              const daftarBabak = hitungDaftarBabakKupon(kategori, kelas, poolTim, jumlahTim);
              renderKuponRacePrintArea(namaTim, kategori, kelas, poolTim, daftarBabak);
              const judulAsli = document.title;
              document.title = 'Kupon Race - ' + namaTim;
              const kembalikanJudul = function() { document.title = judulAsli; window.removeEventListener('afterprint', kembalikanJudul); };
              window.addEventListener('afterprint', kembalikanJudul);
              setTimeout(function() { window.print(); }, 300);
            })
            .withFailureHandler(function(err) { if (btnEl) { btnEl.disabled = false; btnEl.textContent = teksAsli; } alert('Gagal memuat data tim: ' + (err && err.message ? err.message : err)); })
            .getDaftarTim();
        })
        .withFailureHandler(function(err) { if (btnEl) { btnEl.disabled = false; btnEl.textContent = teksAsli; } alert('Gagal memuat data jadwal: ' + (err && err.message ? err.message : err)); })
        .getDaftarJadwal();
    }
    function buatHtmlKuponSatuTim(namaTim, kategori, kelas, poolTim, daftarBabak) {
      let labelKategori = kategori;
      if (kategori === 'Perahu Tradisional' && kelas) labelKategori += ' — ' + kelas;
      let html = '<h2>Kupon Race</h2>';
      html += '<div class="pr-sub">' + escapeHtml(labelKategori) + ' · HUT RI Ke-81 Kab. Hulu Sungai Utara</div>';
      html += '<div class="pr-kupon-nama">' + escapeHtml(namaTim) + '</div>';
      html += '<table class="pr-kupon-table"><thead><tr>';
      daftarBabak.forEach(function(babak) { html += '<th>' + escapeHtml(babak) + '</th>'; });
      html += '</tr></thead><tbody><tr>';
      daftarBabak.forEach(function() {
        html += '<td><div class="pr-kupon-cell">' +
          '<div class="pr-kupon-baris">No Race: <span class="pr-kupon-titik"></span></div>' +
          '<div class="pr-kupon-baris pr-kupon-hasil">Hasil: <span class="pr-kupon-kotak">☐ Menang</span> <span class="pr-kupon-kotak">☐ Gugur</span></div>' +
          '</div></td>';
      });
      html += '</tr></tbody></table>';
      html += '<div class="pr-kupon-pool">' + (poolTim ? escapeHtml(poolTim) : '') + '</div>';
      html += '<div class="pr-kupon-catatan">Diisi manual oleh panitia setelah setiap race selesai.</div>';
      return html;
    }
    function renderKuponRacePrintArea(namaTim, kategori, kelas, poolTim, daftarBabak) {
      document.getElementById('printArea').innerHTML = buatHtmlKuponSatuTim(namaTim, kategori, kelas, poolTim, daftarBabak);
    }

    // ================= DOWNLOAD MASSAL: SEMUA DATA TIM & SEMUA KUPON RACE =================
    function siapkanTombolDownload(btnEl, teksSedangProses) {
      if (!btnEl) return null;
      const teksAsli = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.textContent = teksSedangProses;
      return teksAsli;
    }
    function pulihkanTombolDownload(btnEl, teksAsli) {
      if (!btnEl) return;
      btnEl.disabled = false;
      btnEl.textContent = teksAsli;
    }
    // Cari nomor Race PALING AWAL yang melibatkan tim ini (dari Heat 1/Babak-1) -
    // dipakai sebagai kunci urut supaya cetak massal sesuai urutan race sesungguhnya.
    // Tim yang belum ada di jadwal (belum diundi) ditaruh paling akhir.
    // Bangun urutan cetak dengan MENELUSURI jadwal secara berurutan (sesuai Race-N
    // global), lalu catat urutan kemunculan PERTAMA tiap nama tim - Tim A dulu baru
    // Tim B pada race yang sama. Ini lebih andal dibanding menghitung race per tim
    // secara terpisah, karena urutannya langsung dibangun dari alur jadwal aslinya.
    function normalisasiNamaTim(nama) { return (nama || '').toString().trim().toLowerCase(); }
    function bangunUrutanCetakDariJadwal(listJadwal, petaNomorRace) {
      const terurut = listJadwal.slice().sort(function(a, b) {
        return (petaNomorRace[a.no] || Infinity) - (petaNomorRace[b.no] || Infinity);
      });
      const urutanNama = [];
      const sudahMasuk = {};
      terurut.forEach(function(j) {
        const kunciA = normalisasiNamaTim(j.timA);
        const kunciB = normalisasiNamaTim(j.timB);
        if (kunciA && !sudahMasuk[kunciA]) { urutanNama.push(kunciA); sudahMasuk[kunciA] = true; }
        if (kunciB && kunciB !== 'bye' && !sudahMasuk[kunciB]) { urutanNama.push(kunciB); sudahMasuk[kunciB] = true; }
      });
      const peta = {};
      urutanNama.forEach(function(kunci, idx) { if (!(kunci in peta)) peta[kunci] = idx; });
      return peta; // nama tim (dinormalisasi) -> urutan index (tim yang belum ada di jadwal: tidak ada di peta ini)
    }
    function downloadSemuaDataTim(btnEl) {
      const teksAsli = siapkanTombolDownload(btnEl, '⏳ Menyiapkan (bisa perlu beberapa saat)...');
      google.script.run
        .withSuccessHandler(function(listJadwal) {
          google.script.run
            .withSuccessHandler(function(res) {
              pulihkanTombolDownload(btnEl, teksAsli);
              if (!res.success) { alert(res.message); return; }
              if (!res.list.length) { alert('Belum ada tim yang terdaftar.'); return; }
              const petaNomorRaceUrut = hitungPetaNomorRace(listJadwal);
              const petaUrutanCetak = bangunUrutanCetakDariJadwal(listJadwal, petaNomorRaceUrut);
              res.list.sort(function(a, b) {
                const idxA = (normalisasiNamaTim(a.team.namaTim) in petaUrutanCetak) ? petaUrutanCetak[normalisasiNamaTim(a.team.namaTim)] : Infinity;
                const idxB = (normalisasiNamaTim(b.team.namaTim) in petaUrutanCetak) ? petaUrutanCetak[normalisasiNamaTim(b.team.namaTim)] : Infinity;
                return idxA - idxB;
              });
              renderSemuaDataTimPrintArea(res.list);
              const judulAsli = document.title;
              document.title = 'Semua Data Tim - HUT RI Ke-81';
              const kembalikanJudul = function() { document.title = judulAsli; window.removeEventListener('afterprint', kembalikanJudul); };
              window.addEventListener('afterprint', kembalikanJudul);
              setTimeout(function() { window.print(); }, 400);
            })
            .withFailureHandler(function(err) { pulihkanTombolDownload(btnEl, teksAsli); alert('Gagal memuat data tim: ' + (err && err.message ? err.message : err)); })
            .getSemuaTimUntukCetak(adminPassword);
        })
        .withFailureHandler(function(err) { pulihkanTombolDownload(btnEl, teksAsli); alert('Gagal memuat data jadwal: ' + (err && err.message ? err.message : err)); })
        .getDaftarJadwal();
    }
    function renderSemuaDataTimPrintArea(list) {
      let html = '';
      list.forEach(function(item, idx) {
        const team = item.team, peserta = item.peserta;
        const kelasLabel = (team.kategori === 'Perahu Tradisional' && team.kelas && team.kelas !== '-') ? ' — ' + team.kelas : '';
        html += '<div' + (idx < list.length - 1 ? ' style="page-break-after: always;"' : '') + '>';
        html += '<h2>Data Pendaftaran Tim</h2>';
        html += '<div class="pr-sub">HUT RI Ke-81 — Kabupaten Hulu Sungai Utara · ' + escapeHtml(team.kategori) + escapeHtml(kelasLabel) + '</div>';
        html += '<div class="pr-info-grid">';
        html += '<div><strong>Nama Tim:</strong> ' + escapeHtml(team.namaTim) + '</div><div><strong>Waktu Daftar:</strong> ' + team.waktu + '</div>';
        html += '<div><strong>Nama Ketua:</strong> ' + escapeHtml(team.namaKetua) + '</div><div><strong>Nama Pendamping:</strong> ' + escapeHtml(team.namaPendamping || '-') + '</div>';
        html += '<div><strong>No. WhatsApp:</strong> ' + escapeHtml(team.noWa) + '</div><div><strong>Catatan:</strong> ' + escapeHtml(team.catatan || '-') + '</div></div>';
        html += '<table class="pr-team-table pr-team-table-noktp"><thead><tr><th>No</th><th>Posisi</th><th>Nama Peserta</th></tr></thead><tbody>';
        peserta.forEach(function(p, i) {
          html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(p.peran) + (p.wajib ? '' : ' (Cadangan)') + '</td><td>' + escapeHtml(p.nama || '-') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      });
      document.getElementById('printArea').innerHTML = html;
    }
    function downloadSemuaKuponRace(btnEl) {
      const teksAsli = siapkanTombolDownload(btnEl, '⏳ Menyiapkan (bisa perlu beberapa saat)...');
      google.script.run
        .withSuccessHandler(function(listJadwal) {
          google.script.run
            .withSuccessHandler(function(resTim) {
              pulihkanTombolDownload(btnEl, teksAsli);
              if (!resTim.success) { alert(resTim.message); return; }
              if (!resTim.list.length) { alert('Belum ada tim yang terdaftar.'); return; }
              const jumlahPerKategori = {};
              resTim.list.forEach(function(t) {
                const key = t.kategori + '|' + (t.kelas || '');
                jumlahPerKategori[key] = (jumlahPerKategori[key] || 0) + 1;
              });
              const petaNomorRaceUrut = hitungPetaNomorRace(listJadwal);
              const petaUrutanCetak = bangunUrutanCetakDariJadwal(listJadwal, petaNomorRaceUrut);
              resTim.list.sort(function(a, b) {
                const idxA = (normalisasiNamaTim(a.namaTim) in petaUrutanCetak) ? petaUrutanCetak[normalisasiNamaTim(a.namaTim)] : Infinity;
                const idxB = (normalisasiNamaTim(b.namaTim) in petaUrutanCetak) ? petaUrutanCetak[normalisasiNamaTim(b.namaTim)] : Infinity;
                return idxA - idxB;
              });
              renderSemuaKuponPrintArea(resTim.list, listJadwal, jumlahPerKategori);
              const judulAsli = document.title;
              document.title = 'Semua Kupon Race - HUT RI Ke-81';
              const kembalikanJudul = function() { document.title = judulAsli; window.removeEventListener('afterprint', kembalikanJudul); };
              window.addEventListener('afterprint', kembalikanJudul);
              setTimeout(function() { window.print(); }, 400);
            })
            .withFailureHandler(function(err) { pulihkanTombolDownload(btnEl, teksAsli); alert('Gagal memuat data tim: ' + (err && err.message ? err.message : err)); })
            .getDaftarTimUntukAdmin(adminPassword);
        })
        .withFailureHandler(function(err) { pulihkanTombolDownload(btnEl, teksAsli); alert('Gagal memuat data jadwal: ' + (err && err.message ? err.message : err)); })
        .getDaftarJadwal();
    }
    function renderSemuaKuponPrintArea(listTim, listJadwal, jumlahPerKategori) {
      let html = '';
      listTim.forEach(function(t, idx) {
        const key = t.kategori + '|' + (t.kelas || '');
        const jumlahTim = jumlahPerKategori[key] || 1;
        const cocokJadwal = listJadwal.filter(function(j) {
          if (j.kategori !== t.kategori) return false;
          if (t.kategori === 'Perahu Tradisional' && j.kelas !== t.kelas) return false;
          return j.timA === t.namaTim || j.timB === t.namaTim;
        });
        const poolTim = cocokJadwal.length ? (cocokJadwal[0].pool || '') : '';
        const daftarBabak = hitungDaftarBabakKupon(t.kategori, t.kelas, poolTim, jumlahTim);
        html += '<div' + (idx < listTim.length - 1 ? ' style="page-break-after: always;"' : '') + '>' +
          buatHtmlKuponSatuTim(t.namaTim, t.kategori, t.kelas, poolTim, daftarBabak) + '</div>';
      });
      document.getElementById('printArea').innerHTML = html;
    }

    // ================= DOWNLOAD JADWAL / SKEMA SEBAGAI PDF =================
    // Memakai window.print() (browser) - saat dialog cetak muncul, pilih
    // "Save as PDF" / "Simpan sebagai PDF" sebagai tujuan cetak.
    function cetakHtmlKePdf(judulDokumen, htmlIsi) {
      document.getElementById('printArea').innerHTML = htmlIsi;
      const judulAsli = document.title;
      document.title = judulDokumen;
      const kembalikanJudul = function() { document.title = judulAsli; window.removeEventListener('afterprint', kembalikanJudul); };
      window.addEventListener('afterprint', kembalikanJudul);
      setTimeout(function() { window.print(); }, 200);
    }
    function judulKategoriAktif() {
      return kategoriAktifDetail + (kelasAktifDetail ? ' — ' + kelasAktifDetail : '');
    }
    function downloadJadwalPdf() {
      if (!semuaJadwalKategori.length) { alert('Belum ada data jadwal untuk kategori ini.'); return; }
      const judul = judulKategoriAktif();
      const terurut = semuaJadwalKategori.slice().sort(function(a, b) {
        return (petaNomorRace[a.no] || 9999) - (petaNomorRace[b.no] || 9999);
      });
      let html = '<h2>Jadwal Pertandingan</h2>';
      html += '<div class="pr-sub">' + escapeHtml(judul) + ' · HUT RI Ke-81 Kab. Hulu Sungai Utara</div>';
      html += '<table><thead><tr><th>Race</th><th>Babak</th><th>Line 1</th><th>Line 2</th><th>Status</th></tr></thead><tbody>';
      terurut.forEach(function(j) {
        const race = petaNomorRace[j.no] ? '<span class="pr-race-badge">Race-' + petaNomorRace[j.no] + '</span>' : '-';
        const adaBye = !j.timB || j.timB === 'BYE';
        html += '<tr><td>' + race + '</td><td>' + escapeHtml(j.babak) + (j.pool ? ' (' + escapeHtml(j.pool) + ')' : '') + '</td><td>' + escapeHtml(j.timA) + '</td>' +
          '<td>' + (adaBye ? '<span class="pr-bye">BYE (Otomatis Lolos)</span>' : escapeHtml(j.timB)) + '</td>' +
          '<td>' + escapeHtml(j.waktu || '-') + '</td></tr>';
      });
      html += '</tbody></table>';
      cetakHtmlKePdf('Jadwal Pertandingan - ' + judul, html);
    }

    /* ================= JADWAL PERTANDINGAN GLOBAL (semua kategori, urutan Race-N) ================= */
    let semuaJadwalGlobal = [];
    function muatJadwalGlobal() {
      const container = document.getElementById('jadwalGlobalIsi');
      container.innerHTML = '<div class="loading-state">Memuat jadwal pertandingan...</div>';
      google.script.run
        .withSuccessHandler(function(list) {
          petaNomorRace = hitungPetaNomorRace(list);
          semuaJadwalGlobal = list;
          renderJadwalGlobal();
        })
        .withFailureHandler(function(err) { container.innerHTML = '<div class="empty-state">❌ Gagal memuat jadwal: ' + escapeHtml(err.message) + '</div>'; })
        .getDaftarJadwal();
    }
    function jadwalGlobalTerfilter() {
      const filterVal = document.getElementById('filterKategoriJadwalGlobal').value;
      const filterBabak = document.getElementById('filterBabakJadwalGlobal').value;
      let list = semuaJadwalGlobal;
      if (filterVal) {
        const parts = filterVal.split('|');
        list = list.filter(function(j) { return j.kategori === parts[0] && (!parts[1] || j.kelas === parts[1]); });
      }
      if (filterBabak) {
        list = list.filter(function(j) { return j.babak === filterBabak; });
      }
      return urutkanJadwalPerBabakInterleave(list);
    }
    function renderJadwalGlobal() {
      const container = document.getElementById('jadwalGlobalIsi');
      const terurut = urutkanJadwalDenganSelesaiDiBawah(jadwalGlobalTerfilter());
      if (!terurut.length) { container.innerHTML = '<div class="empty-state">Belum ada jadwal pertandingan.</div>'; return; }
      container.innerHTML = terurut.map(function(j) { return renderMatchCardHtml(j, false); }).join('');
    }
    function downloadJadwalGlobalPdf() {
      const terurut = jadwalGlobalTerfilter();
      if (!terurut.length) { alert('Belum ada data jadwal untuk diunduh.'); return; }
      const filterVal = document.getElementById('filterKategoriJadwalGlobal').value;
      const filterBabak = document.getElementById('filterBabakJadwalGlobal').value;
      let judul = filterVal ? document.getElementById('filterKategoriJadwalGlobal').selectedOptions[0].textContent : 'Semua Kategori';
      if (filterBabak) judul += ' · ' + filterBabak;
      let html = '<h2>Jadwal Pertandingan</h2>';
      html += '<div class="pr-sub">' + escapeHtml(judul) + ' · HUT RI Ke-81 Kab. Hulu Sungai Utara</div>';
      html += '<table><thead><tr><th>Race</th><th>Kategori</th><th>Babak</th><th>Line 1</th><th>Line 2</th><th>Status</th></tr></thead><tbody>';
      terurut.forEach(function(j) {
        const race = petaNomorRace[j.no] ? '<span class="pr-race-badge">Race-' + petaNomorRace[j.no] + '</span>' : '-';
        const adaBye = !j.timB || j.timB === 'BYE';
        let kat = j.kategori;
        if (j.kategori === 'Perahu Tradisional' && j.kelas && j.kelas !== '-') kat += ' ' + j.kelas;
        html += '<tr><td>' + race + '</td><td>' + escapeHtml(kat) + (j.pool ? ' (' + escapeHtml(j.pool) + ')' : '') + '</td><td>' + escapeHtml(j.babak) + '</td><td>' + escapeHtml(j.timA) + '</td>' +
          '<td>' + (adaBye ? '<span class="pr-bye">BYE (Otomatis Lolos)</span>' : escapeHtml(j.timB)) + '</td>' +
          '<td>' + escapeHtml(j.waktu || '-') + '</td></tr>';
      });
      html += '</tbody></table>';
      cetakHtmlKePdf('Jadwal Pertandingan - ' + judul, html);
    }
    function downloadSkemaPdf() {
      const kontainerAsli = document.getElementById('kdSkemaContainer');
      if (!kontainerAsli || !kontainerAsli.querySelector('.bracket-mirror-wrap, .bracket-wrap')) {
        alert('Skema belum siap dimuat. Tunggu sampai skema tampil lalu coba lagi.');
        return;
      }
      const judul = judulKategoriAktif();

      // Ukur lebar & tinggi ASLI bracket di layar, lalu hitung skala supaya
      // muat dalam satu halaman kertas Landscape BERSAMA judulnya (target lebih
      // kecil dari sebelumnya, supaya ruang untuk judul+subjudul tetap tersisa)
      const elemenBracket = kontainerAsli.querySelector('.bracket-mirror-wrap, .bracket-wrap');
      const lebarAsli = elemenBracket.scrollWidth;
      const tinggiAsli = elemenBracket.scrollHeight;
      const targetLebar = 950, targetTinggi = 600;
      let skala = Math.min(targetLebar / lebarAsli, targetTinggi / tinggiAsli, 1);

      let html = '<h2>Skema Pertandingan</h2>';
      html += '<div class="pr-sub">' + escapeHtml(judul) + ' · HUT RI Ke-81 Kab. Hulu Sungai Utara</div>';
      // Salin PERSIS tampilan bracket yang sedang dilihat (termasuk garis SVG-nya),
      // dikecilkan otomatis (transform:scale) supaya muat dalam satu halaman.
      // Dibungkus div luar dengan ukuran HASIL SKALA - supaya perhitungan jumlah
      // halaman ikut kecil (transform:scale sendiri tidak mengecilkan ruang tata letak).
      const lebarSkala = Math.round(lebarAsli * skala);
      const tinggiSkala = Math.round(tinggiAsli * skala);
      html += '<div style="width:' + lebarSkala + 'px;height:' + tinggiSkala + 'px;overflow:hidden;">' +
        '<div class="pr-skema-visual" style="transform:scale(' + skala.toFixed(3) + ');transform-origin:top left;width:' + lebarAsli + 'px;">' +
        kontainerAsli.innerHTML + '</div></div>';
      cetakHtmlKePdf('Skema Pertandingan - ' + judul, html);
    }

    /* ================= ADMIN: KELOLA JADWAL ================= */
    function toggleJadwalKelas() {
      const kategori = document.getElementById('jadwalKategori').value;
      document.getElementById('wrapJadwalKelas').style.display = (kategori === 'Perahu Tradisional') ? 'block' : 'none';
    }
    function muatOpsiTimJadwal() {
      const kategori = document.getElementById('jadwalKategori').value;
      const kelas = document.getElementById('jadwalKelas') ? document.getElementById('jadwalKelas').value : '';
      const selA = document.getElementById('jadwalTimA'), selB = document.getElementById('jadwalTimB');
      if (!kategori) return;
      google.script.run.withSuccessHandler(function(res) {
        if (!res.success) return;
        const filtered = res.list.filter(function(t) {
          if (t.kategori !== kategori) return false;
          if (kategori === 'Perahu Tradisional' && kelas && t.kelas !== kelas) return false;
          return true;
        });
        const opsiHtml = filtered.map(function(t) { return '<option value="' + escapeAttr(t.namaTim) + '">' + escapeHtml(t.namaTim) + '</option>'; }).join('');
        selA.innerHTML = '<option value="">-- Pilih Line 1 --</option>' + opsiHtml;
        selB.innerHTML = '<option value="">BYE (tanpa lawan)</option>' + opsiHtml;
      }).getDaftarTimUntukAdmin(adminPassword);
    }
    function resetFormJadwal() {
      document.getElementById('jadwalEditNo').value = '';
      document.getElementById('jadwalKategori').value = '';
      document.getElementById('wrapJadwalKelas').style.display = 'none';
      document.getElementById('jadwalBabak').value = 'Babak-1';
      document.getElementById('jadwalNomorHeat').value = '';
      document.getElementById('jadwalPool').value = '';
      document.getElementById('jadwalTimA').innerHTML = '<option value="">-- Pilih Line 1 --</option>';
      document.getElementById('jadwalTimB').innerHTML = '<option value="">BYE (tanpa lawan)</option>';
      document.getElementById('jadwalWaktu').value = 'Menunggu Jadwal';
      document.getElementById('jadwalCatatan').value = '';
      document.getElementById('jadwalFormMsg').style.display = 'none';
    }
    function simpanJadwal() {
      const no = document.getElementById('jadwalEditNo').value;
      const data = {
        kategori: document.getElementById('jadwalKategori').value,
        kelas: document.getElementById('jadwalKelas') ? document.getElementById('jadwalKelas').value : '',
        babak: document.getElementById('jadwalBabak').value,
        nomorHeat: document.getElementById('jadwalNomorHeat').value.trim(),
        pool: document.getElementById('jadwalPool').value,
        timA: document.getElementById('jadwalTimA').value,
        timB: document.getElementById('jadwalTimB').value,
        waktu: document.getElementById('jadwalWaktu').value,
        catatan: document.getElementById('jadwalCatatan').value.trim()
      };
      const msgEl = document.getElementById('jadwalFormMsg');
      if (!data.kategori || !data.timA) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = 'Kategori dan Line 1 wajib dipilih.'; return; }
      const handler = function(res) {
        msgEl.style.display = 'block'; msgEl.className = res.success ? 'msg success' : 'msg error'; msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
        if (res.success) { resetFormJadwal(); muatDaftarJadwalAdmin(); }
      };
      const failHandler = function(err) { msgEl.style.display = 'block'; msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); };
      if (no) google.script.run.withSuccessHandler(handler).withFailureHandler(failHandler).updateJadwal(adminPassword, Number(no), data);
      else google.script.run.withSuccessHandler(handler).withFailureHandler(failHandler).tambahJadwal(adminPassword, data);
    }
    let semuaJadwalAdmin = [];
    // Edit di kartu pertandingan sekarang HANYA mengubah status tim (urutan Race,
    // Tim A/B, babak, dsb sudah ditentukan lewat Undian - tidak diedit dari sini lagi)
    let idJadwalUntukEditStatus = null;
    function editJadwal(no) {
      const j = semuaJadwalAdmin.find(function(x) { return Number(x.no) === Number(no); });
      if (!j) return;
      idJadwalUntukEditStatus = no;
      document.getElementById('editStatusInfo').textContent = (j.nomorHeat ? j.nomorHeat + ' · ' : '') + j.timA + ' vs ' + (j.timB || 'BYE');
      const statusSekarang = (j.waktu === 'Sudah Selesai') ? 'Persiapan Race Berikutnya' : (j.waktu || 'Menunggu Jadwal');
      document.getElementById('editStatusSelect').value = statusSekarang;
      document.getElementById('editStatusMsg').style.display = 'none';
      document.getElementById('editStatusModal').style.display = 'flex';
    }
    function tutupEditStatusModal() { document.getElementById('editStatusModal').style.display = 'none'; }
    function simpanEditStatus() {
      const j = semuaJadwalAdmin.find(function(x) { return Number(x.no) === Number(idJadwalUntukEditStatus); });
      if (!j) return;
      const msgEl = document.getElementById('editStatusMsg');
      const statusBaru = document.getElementById('editStatusSelect').value;
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = 'Menyimpan...';
      const data = {
        kategori: j.kategori, kelas: j.kelas, babak: j.babak, nomorHeat: j.nomorHeat,
        pool: j.pool, timA: j.timA, timB: j.timB, waktu: statusBaru, catatan: j.catatan
      };
      google.script.run
        .withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error';
          msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
          if (res.success) setTimeout(function() { tutupEditStatusModal(); muatDaftarJadwalAdmin(); }, 600);
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .updateJadwal(adminPassword, idJadwalUntukEditStatus, data);
    }
    let confirmModalCallback = null;
    function tampilkanConfirm(teks, onYes) {
      document.getElementById('confirmModalText').textContent = teks;
      confirmModalCallback = onYes;
      document.getElementById('confirmModal').style.display = 'flex';
    }
    function tutupConfirmModal() { document.getElementById('confirmModal').style.display = 'none'; confirmModalCallback = null; }
    document.getElementById('confirmModalYesBtn').onclick = function() {
      const cb = confirmModalCallback;
      tutupConfirmModal();
      if (cb) cb();
    };
    let nomorJadwalUntukPemenang = null;
    function tetapkanPemenang(no, timA, timB) {
      nomorJadwalUntukPemenang = no;
      const pilihanEl = document.getElementById('setPemenangPilihan');
      pilihanEl.innerHTML =
        '<button class="btn-primary" onclick="pilihPemenang(' + escapeAttr(JSON.stringify(timA)) + ')">🏆 ' + escapeHtml(timA) + '</button>' +
        (timB && timB !== 'BYE' ? '<button class="btn-primary" onclick="pilihPemenang(' + escapeAttr(JSON.stringify(timB)) + ')">🏆 ' + escapeHtml(timB) + '</button>' : '');
      document.getElementById('setPemenangMsg').style.display = 'none';
      document.getElementById('setPemenangModal').style.display = 'flex';
    }
    function tutupSetPemenang() { document.getElementById('setPemenangModal').style.display = 'none'; }
    function pilihPemenang(nama) {
      const msgEl = document.getElementById('setPemenangMsg');
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = 'Menyimpan...';
      const jMenang = semuaJadwalAdmin.find(function(x) { return Number(x.no) === Number(nomorJadwalUntukPemenang); });
      google.script.run
        .withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error';
          msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
          if (res.success) {
            if (jMenang) majukanPemenangKeBabakBerikutnya(jMenang, nama);
            setTimeout(function() { tutupSetPemenang(); muatDaftarJadwalAdmin(); }, 700);
          }
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .setPemenangJadwal(adminPassword, nomorJadwalUntukPemenang, nama);
    }
    function muatDaftarJadwalAdmin() {
      const container = document.getElementById('adminJadwalList');
      container.innerHTML = '<div class="loading-state">Memuat data jadwal...</div>';
      google.script.run.withSuccessHandler(function(res) {
          if (!res.success) { container.innerHTML = '<div class="empty-state">❌ ' + escapeHtml(res.message) + '</div>'; return; }
          semuaJadwalAdmin = res.list;
          petaNomorRace = hitungPetaNomorRace(res.list);
          const filterVal = document.getElementById('filterKategoriAdminJadwal').value;
          let list = res.list;
          if (filterVal) {
            const parts = filterVal.split('|');
            list = urutkanBerdasarkanHeatPool(list.filter(function(j) { return j.kategori === parts[0] && (!parts[1] || j.kelas === parts[1]); }));
          } else {
            list = urutkanJadwalPerBabakInterleave(list);
          }
          list = urutkanJadwalDenganSelesaiDiBawah(list);
          if (!list.length) { container.innerHTML = '<div class="empty-state">Belum ada jadwal pertandingan untuk filter ini.</div>'; return; }
          container.innerHTML = list.map(function(j) { return renderMatchCardHtml(j, true); }).join('');
        })
        .withFailureHandler(function(err) { container.innerHTML = '<div class="empty-state">❌ Gagal memuat: ' + (err && err.message ? err.message : err) + '</div>'; })
        .getDaftarJadwalAdmin(adminPassword);
    }

    /* ================= BABAK YANG DITAYANGKAN KE PUBLIK (ADMIN) ================= */
    function muatBabakTayangAdmin() {
      const sel = document.getElementById('pilihBabakTayang');
      const msgEl = document.getElementById('babakTayangMsg');
      if (!sel) return;
      msgEl.style.display = 'none';
      google.script.run
        .withSuccessHandler(function(babak) {
          const cocok = babak && Array.from(sel.options).some(function(o) { return o.value === babak; });
          sel.value = cocok ? babak : '';
        })
        .withFailureHandler(function() { /* biarkan default "Semua Babak" kalau gagal memuat */ })
        .getBabakTayangAktif();
    }
    function simpanBabakTayang() {
      const sel = document.getElementById('pilihBabakTayang');
      const msgEl = document.getElementById('babakTayangMsg');
      const babak = sel.value;
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = 'Menyimpan...';
      google.script.run
        .withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error';
          msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .setBabakTayangAktif(adminPassword, babak);
    }

    /* ================= LIVE STREAMING KE PUBLIK (ADMIN) ================= */
    function muatLiveStreamAdmin() {
      const linkEl = document.getElementById('liveStreamLink');
      const chkTayangEl = document.getElementById('liveStreamTayang');
      const chkPlayEl = document.getElementById('liveStreamPlay');
      const chkMuteEl = document.getElementById('liveStreamMute');
      const msgEl = document.getElementById('liveStreamMsg');
      if (!linkEl || !chkTayangEl) return;
      msgEl.style.display = 'none';
      google.script.run
        .withSuccessHandler(function(cfg) {
          linkEl.value = (cfg && cfg.link) ? cfg.link : '';
          chkTayangEl.checked = !!(cfg && cfg.tayang);
          if (chkPlayEl) chkPlayEl.checked = !cfg || cfg.play !== false;
          if (chkMuteEl) chkMuteEl.checked = !cfg || cfg.mute !== false;
        })
        .withFailureHandler(function() { /* biarkan kosong/default kalau gagal memuat */ })
        .getLiveStreamSetting();
    }
    function simpanLiveStream() {
      const linkEl = document.getElementById('liveStreamLink');
      const chkTayangEl = document.getElementById('liveStreamTayang');
      const chkPlayEl = document.getElementById('liveStreamPlay');
      const chkMuteEl = document.getElementById('liveStreamMute');
      const msgEl = document.getElementById('liveStreamMsg');
      const link = linkEl.value.trim();
      const tayang = chkTayangEl.checked;
      if (tayang && !link) {
        msgEl.style.display = 'block'; msgEl.className = 'msg error';
        msgEl.textContent = '❌ Isi dulu link live streaming sebelum menayangkannya.';
        return;
      }
      const config = {
        link: link,
        tayang: tayang,
        play: chkPlayEl ? chkPlayEl.checked : true,
        mute: chkMuteEl ? chkMuteEl.checked : true
      };
      msgEl.style.display = 'block'; msgEl.className = 'msg'; msgEl.textContent = 'Menyimpan...';
      google.script.run
        .withSuccessHandler(function(res) {
          msgEl.className = res.success ? 'msg success' : 'msg error';
          msgEl.textContent = (res.success ? '✅ ' : '❌ ') + res.message;
        })
        .withFailureHandler(function(err) { msgEl.className = 'msg error'; msgEl.textContent = '❌ Gagal menyimpan: ' + (err && err.message ? err.message : err); })
        .setLiveStreamSetting(adminPassword, config);
    }

    // Fungsi bantu urutan Heat/Pool - dipakai bersama untuk sortir dalam satu
    // kategori (Heat 1 Pool A, Heat 1 Pool B, Heat 2 Pool A, dst)
    function nomorHeat(j) {
      const cocok = /(\d+)/.exec(j.nomorHeat || '');
      return cocok ? parseInt(cocok[1], 10) : 999;
    }
    function urutanPool(j) {
      if (j.pool === 'Pool A') return 0;
      if (j.pool === 'Pool B') return 1;
      return 2;
    }
    function urutkanBerdasarkanHeatPool(list) {
      return list.slice().sort(function(a, b) {
        const hA = nomorHeat(a), hB = nomorHeat(b);
        if (hA !== hB) return hA - hB;
        return urutanPool(a) - urutanPool(b);
      });
    }

    // Urutan Race Pertandingan (khusus tampilan "Semua Kategori"): berselang-seling
    // 3 Race Tradisional Putra, 2 Race ASN, 1 Race Putri, 1 Race Naga - berulang
    // sampai semua habis. Di dalam tiap kategori diurutkan Heat 1 Pool A, Heat 1
    // Pool B, Heat 2 Pool A, dst.
    function urutkanJadwalInterleave(list) {
      function kunciKategori(j) {
        if (j.kategori === 'Perahu Naga') return 'naga';
        if (j.kelas === 'Umum Putra') return 'putra';
        if (j.kelas === 'ASN') return 'asn';
        if (j.kelas === 'Umum Putri') return 'putri';
        return 'lain';
      }
      const bucket = { putra: [], asn: [], putri: [], naga: [], lain: [] };
      list.forEach(function(j) { bucket[kunciKategori(j)].push(j); });
      ['putra', 'asn', 'putri', 'naga', 'lain'].forEach(function(k) {
        bucket[k].sort(function(a, b) {
          const hA = nomorHeat(a), hB = nomorHeat(b);
          if (hA !== hB) return hA - hB;
          return urutanPool(a) - urutanPool(b);
        });
      });

      const pola = [['putra', 3], ['asn', 2], ['putri', 1], ['naga', 1]];
      const hasil = [];
      let indeks = { putra: 0, asn: 0, putri: 0, naga: 0 };
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
      // Kategori "lain" (kalau ada data yang tidak cocok kategori manapun) ditaruh di akhir
      hasil.push.apply(hasil, bucket.lain);
      return hasil;
    }