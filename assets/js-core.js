/* =================================================================
     JS_Core.html
     Berisi: helper umum (escapeHtml, format), navigasi antar halaman,
     statistik/papan kategori Beranda, modal peraturan lomba, animasi
     navbar & scroll-reveal, dan Data Tim Terdaftar.
     ================================================================= */
    /* ================= HELPER UMUM ================= */
    function escapeHtml(str) {
      if (!str) return '';
      return str.toString().replace(/[&<>"']/g, function(c) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
    }
    function escapeAttr(str) { return escapeHtml(str); }
    // Acak posisi Line 1 / Line 2 untuk sepasang tim yang baru dibentuk otomatis
    // (undian & maju otomatis ke babak berikutnya) - supaya tim yang "duluan
    // ditarik/menang" tidak selalu jatuh di Line 1. Dipakai bersama oleh
    // JS_Undian.html & JS_Bracket.html.
    function acakUrutanLine_(x, y) {
      return Math.random() < 0.5 ? [x, y] : [y, x];
    }
    // Susun ulang daftar pertandingan supaya yang SUDAH SELESAI dipindah ke
    // paling bawah (urutan di dalam masing-masing kelompok - belum selesai vs
    // sudah selesai - tetap mengikuti urutan asli yang dikirim, karena Array.sort
    // di JS bersifat stabil).
    function urutkanJadwalDenganSelesaiDiBawah(list) {
      return list.slice().sort(function(a, b) {
        const selesaiA = a.status === 'Selesai' ? 1 : 0;
        const selesaiB = b.status === 'Selesai' ? 1 : 0;
        return selesaiA - selesaiB;
      });
    }

    function fileToCompressedBase64(file, maxDim, quality) {
      return new Promise(function(resolve) {
        try {
          const reader = new FileReader();
          reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
              try {
                let w = img.width, h = img.height;
                if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
                else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', quality || 0.7);
                resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', fileName: file.name });
              } catch (e) { fileToRawBase64(file).then(resolve).catch(function(){ resolve(null); }); }
            };
            img.onerror = function() { fileToRawBase64(file).then(resolve).catch(function(){ resolve(null); }); };
            img.src = e.target.result;
          };
          reader.onerror = function() { fileToRawBase64(file).then(resolve).catch(function(){ resolve(null); }); };
          reader.readAsDataURL(file);
        } catch (e) { fileToRawBase64(file).then(resolve).catch(function(){ resolve(null); }); }
      });
    }
    function fileToRawBase64(file) {
      return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(e) { resolve({ base64: e.target.result.split(',')[1], mimeType: file.type || 'image/jpeg', fileName: file.name }); };
        reader.onerror = function() { reject(new Error('Tidak bisa membaca file "' + file.name + '".')); };
        reader.readAsDataURL(file);
      });
    }

    /* ================= NAVIGASI ================= */
    function setActiveNav(id) {
      document.querySelectorAll('.sidebar-item').forEach(function(el) { el.classList.remove('active'); });
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }
    function sembunyikanSemuaView() {
      ['viewBeranda','viewLiveStream','viewKategoriDetail','viewDaftar','viewJadwalGlobal','viewSkemaPilihKategori','viewAdmin','viewAdminJadwal','viewAdminUndian','viewAdminStream','viewForm'].forEach(function(id) {
        document.getElementById(id).style.display = 'none';
      });
    }
    function tampilkanBeranda() {
      sembunyikanSemuaView();
      document.getElementById('viewBeranda').style.display = 'block';
      setActiveNav('navBeranda');
      window.scrollTo(0, 0);
      muatBerandaLive();
      muatBerandaStream();
      mulaiAutoRefreshBeranda();
      setTimeout(function() { if (typeof amatiElemenRevealScroll === 'function') amatiElemenRevealScroll(); }, 50);
      setTimeout(sinkronkanTinggiLivePanel, 60);
    }

    /* ================= HALAMAN LIVE STREAMING (menu khusus smartphone) ================= */
    function tampilkanLiveStream() {
      sembunyikanSemuaView();
      document.getElementById('viewLiveStream').style.display = 'block';
      setActiveNav('navLiveStream');
      window.scrollTo(0, 0);
      muatLiveStreamPage();
    }
    function muatLiveStreamPage() {
      google.script.run
        .withSuccessHandler(function(cfg) {
          const panel = document.getElementById('liveStreamPagePanel');
          const kosong = document.getElementById('liveStreamPageKosong');
          const iframe = document.getElementById('liveStreamPageIframe');
          if (!panel || !kosong || !iframe) return;
          const aktif = !!(cfg && cfg.tayang && cfg.link);
          if (aktif) {
            iframe.src = buatUrlEmbedStreaming(cfg.link, { play: cfg.play !== false, mute: cfg.mute !== false });
            panel.style.display = 'block';
            kosong.style.display = 'none';
          } else {
            iframe.src = '';
            panel.style.display = 'none';
            kosong.style.display = 'block';
          }
        })
        .withFailureHandler(function() {
          const panel = document.getElementById('liveStreamPagePanel');
          const kosong = document.getElementById('liveStreamPageKosong');
          if (panel) panel.style.display = 'none';
          if (kosong) { kosong.style.display = 'block'; kosong.textContent = '❌ Gagal memuat live streaming.'; }
        })
        .getLiveStreamSetting();
    }


    // Samakan tinggi panel "Sedang Berlangsung / Race Berikutnya" (kiri) &
    // kotak Live Streaming (kanan, kalau sedang tayang) persis dengan tinggi
    // gambar banner di tampilan desktop - supaya rapi berdampingan dan tidak
    // ada ruang kosong/tidak sinkron di bawah gambar.
    function sinkronkanTinggiLivePanel() {
      const panel = document.querySelector('.beranda-live-panel');
      const streamPanel = document.querySelector('.beranda-stream-panel.aktif');
      const hero = document.querySelector('#viewBeranda .hero.hero-banner');
      if (!hero) return;
      if (window.innerWidth < 881) {
        if (panel) panel.style.height = '';
        if (streamPanel) streamPanel.style.height = '';
        return;
      }
      if (panel) panel.style.height = hero.offsetHeight + 'px';
      if (streamPanel) streamPanel.style.height = hero.offsetHeight + 'px';
    }
    window.addEventListener('resize', function() { sinkronkanTinggiLivePanel(); });
    (function() {
      const gambarHero = document.querySelector('#viewBeranda .hero-banner-img');
      if (gambarHero) {
        if (gambarHero.complete) setTimeout(sinkronkanTinggiLivePanel, 60);
        else gambarHero.addEventListener('load', sinkronkanTinggiLivePanel);
      }
    })();

    /* ================= BERANDA: SEDANG BERLANGSUNG & RACE BERIKUTNYA ================= */
    let intervalAutoRefreshBeranda = null;
    function mulaiAutoRefreshBeranda() {
      hentikanAutoRefreshBeranda();
      intervalAutoRefreshBeranda = setInterval(function() {
        // Hanya refresh kalau masih di halaman Beranda (hindari kerja sia-sia di halaman lain)
        if (document.getElementById('viewBeranda').style.display !== 'none') {
          muatBerandaLive();
          muatBerandaStream();
        }
      }, 25000);
    }
    function hentikanAutoRefreshBeranda() {
      if (intervalAutoRefreshBeranda) { clearInterval(intervalAutoRefreshBeranda); intervalAutoRefreshBeranda = null; }
    }
    // Babak yang sedang ditayangkan admin ke publik ('' = tampilkan semua babak).
    // Dipakai supaya panel "Sedang Berlangsung" & "Race Berikutnya" di Beranda
    // tidak menampilkan match dari babak berbeda sekaligus - yang bisa bikin
    // Nomor Race terlihat "berulang" karena tiap babak sama-sama mulai dari 1.
    let babakTayangAktif = '';
    function muatBerandaLive() {
      google.script.run
        .withSuccessHandler(function(babak) {
          babakTayangAktif = babak || '';
          google.script.run
            .withSuccessHandler(function(list) {
              petaNomorRace = hitungPetaNomorRace(list); // dihitung dari SEMUA data - tetap konsisten dgn halaman lain
              const listTertayang = babakTayangAktif ? list.filter(function(j) { return j.babak === babakTayangAktif; }) : list;
              renderBerandaSedangBerlangsung(listTertayang);
              renderBerandaRaceBerikutnya(listTertayang);
            })
            .withFailureHandler(function() { /* diam saja - jangan ganggu tampilan kalau gagal refresh background */ })
            .getDaftarJadwal();
        })
        .withFailureHandler(function() {
          // Kalau gagal ambil status babak tayang, tetap tampilkan semua babak seperti biasa
          google.script.run
            .withSuccessHandler(function(list) {
              petaNomorRace = hitungPetaNomorRace(list);
              renderBerandaSedangBerlangsung(list);
              renderBerandaRaceBerikutnya(list);
            })
            .withFailureHandler(function() {})
            .getDaftarJadwal();
        })
        .getBabakTayangAktif();
    }
    /* ================= BERANDA: KOTAK LIVE STREAMING ================= *
     * Kotak video di Beranda publik mengikuti pengaturan admin (link + status
     * tayang/tidak) yang disimpan lewat Panel Admin -> Kelola Jadwal
     * Pertandingan. Kalau statusnya "tidak tayang" (atau link kosong), kotak
     * video disembunyikan total (class "aktif" dilepas -> display:none dari
     * CSS.html). Nilai terakhir disimpan di streamKunciTerakhir supaya iframe
     * TIDAK di-reload/restart tiap kali auto-refresh 25 detik jalan kalau
     * memang tidak ada perubahan - video jadi tetap berjalan normal/mulus.
     */
    let streamKunciTerakhir = null;
    // opts = { play: boolean, mute: boolean }
    function buatUrlEmbedStreaming(link, opts) {
      if (!link) return '';
      link = link.toString().trim();
      opts = opts || {};
      const play = opts.play !== false;
      const mute = opts.mute !== false;
      // Parameter tambahan supaya video di dashboard publik TIDAK menampilkan
      // kontrol interaktif (play/pause, volume, setting, cc, dsb) DAN tidak
      // menampilkan teks terjemahan/caption otomatis (cc_load_policy=0) -
      // video sepenuhnya mengikuti pengaturan admin (play/mute), pengunjung
      // tidak bisa mengoperasikan pemutarnya sendiri.
      const paramBersih = 'autoplay=' + (play ? '1' : '0') + '&mute=' + (mute ? '1' : '0') +
        '&playsinline=1&controls=0&disablekb=1&modestbranding=1&rel=0&showinfo=0' +
        '&iv_load_policy=3&fs=0&cc_load_policy=0';
      // YouTube: watch?v=, youtu.be/, /live/, /shorts/
      let m = link.match(/(?:[?&]v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,})/);
      if (m) return 'https://www.youtube.com/embed/' + m[1] + '?' + paramBersih;
      // Link embed YouTube yang sudah jadi - tambahkan parameter di atas
      if (/youtube\.com\/embed\//.test(link)) {
        return link + (link.indexOf('?') > -1 ? '&' : '?') + paramBersih;
      }
      // Facebook Live/Video - pakai plugin embed resmi Facebook
      if (/facebook\.com|fb\.watch/.test(link)) {
        return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(link) +
          '&show_text=false&autoplay=' + (play ? 'true' : 'false') + '&mute=' + (mute ? 'true' : 'false') + '&controls=false';
      }
      // Selain itu anggap link yang dimasukkan admin memang sudah berupa URL
      // embed siap pakai (mis. dari platform streaming lain).
      return link;
    }
    function muatBerandaStream() {
      // Di layar smartphone, kotak live streaming Beranda disembunyikan
      // (dipindah ke menu "Live Streaming" tersendiri - lihat tampilkanLiveStream()),
      // jadi tidak perlu memuat iframe di sini sama sekali (hemat kuota pengunjung).
      if (window.innerWidth <= 880) return;
      google.script.run
        .withSuccessHandler(function(cfg) {
          const panel = document.getElementById('berandaStreamPanel');
          const iframe = document.getElementById('berandaStreamIframe');
          if (!panel || !iframe) return;
          const aktif = !!(cfg && cfg.tayang && cfg.link);
          // Kunci mencakup link + play + mute - supaya iframe di-reload
          // (video diperbarui) HANYA kalau admin benar-benar mengubah salah
          // satu pengaturan ini, bukan tiap kali auto-refresh 25 detik jalan.
          const kunci = aktif ? (cfg.link + '|' + (cfg.play !== false) + '|' + (cfg.mute !== false)) : '';
          if (kunci === streamKunciTerakhir) return;
          streamKunciTerakhir = kunci;
          if (aktif) {
            iframe.src = buatUrlEmbedStreaming(cfg.link, { play: cfg.play !== false, mute: cfg.mute !== false });
            panel.classList.add('aktif');
          } else {
            panel.classList.remove('aktif');
            iframe.src = '';
          }
          setTimeout(sinkronkanTinggiLivePanel, 60);
        })
        .withFailureHandler(function() { /* diam saja - jangan ganggu tampilan kalau gagal memuat status live streaming */ })
        .getLiveStreamSetting();
    }
    function labelKategoriRingkas(j) {
      let kat = j.kategori;
      if (j.kategori === 'Perahu Tradisional' && j.kelas && j.kelas !== '-') kat += ' ' + j.kelas;
      return kat + (j.pool ? ' · ' + j.pool : '');
    }
    // Kalau Tim A/Tim B belum ditentukan (misal pertandingan babak lanjutan yang
    // masih menunggu pemenang babak sebelumnya), tampilkan placeholder sederhana
    // ini - bukan kartu pertandingan penuh yang mengasumsikan tim sudah pasti.
    function timBelumDiatur(j) { return !j.timA || !j.timB; }
    function renderRacePlaceholderHtml(j) {
      const race = petaNomorRace[j.no] ? 'Race-' + petaNomorRace[j.no] + ' · ' : '';
      return '<div class="tim-item"><div class="tim-info"><div class="tim-nama">🗓️ Race Menunggu Jadwal</div>' +
        '<div class="tim-sub">' + race + escapeHtml(labelKategoriRingkas(j)) + ' · ' + escapeHtml(j.babak) + '</div></div></div>';
    }
    function renderBerandaSedangBerlangsung(list) {
      const container = document.getElementById('berandaLiveRace');
      const live = list.filter(function(j) { return j.waktu === 'Sedang Bertanding'; });
      if (live.length) {
        container.innerHTML = live.map(function(j) { return timBelumDiatur(j) ? renderRacePlaceholderHtml(j) : renderMatchCardHtml(j, false); }).join('');
        return;
      }
      // Tidak ada yang sedang berlangsung - tampilkan race SEBELUMNYA yang sudah
      // selesai (lengkap dengan status pemenangnya), supaya halaman tidak kosong.
      const selesai = list.filter(function(j) { return j.status === 'Selesai'; });
      if (!selesai.length) { container.innerHTML = '<div class="empty-state">Belum ada race yang berlangsung atau selesai saat ini.</div>'; return; }
      const terakhir = selesai.slice().sort(function(a, b) { return (petaNomorRace[b.no] || 0) - (petaNomorRace[a.no] || 0); })[0];
      container.innerHTML = '<div class="empty-state" style="text-align:left;margin-bottom:10px;padding:10px 14px;">Belum ada race yang sedang berlangsung. Berikut hasil race sebelumnya:</div>' +
        renderMatchCardHtml(terakhir, false);
    }
    function renderBerandaRaceBerikutnya(list) {
      const container = document.getElementById('berandaRaceBerikutnya');
      const berikutnya = list
        .filter(function(j) { return j.status !== 'Selesai' && j.waktu !== 'Sedang Bertanding'; })
        .sort(function(a, b) { return (petaNomorRace[a.no] || 9999) - (petaNomorRace[b.no] || 9999); })
        .slice(0, 5);
      if (!berikutnya.length) { container.innerHTML = '<div class="empty-state">Belum ada race berikutnya yang dijadwalkan.</div>'; return; }
      container.innerHTML = berikutnya.map(function(j) { return timBelumDiatur(j) ? renderRacePlaceholderHtml(j) : renderMatchCardHtml(j, false); }).join('');
    }
    // Untuk navbar landing page: kalau sedang di Beranda, scroll halus ke bagian
    // "Pilih Kategori" (titik masuk ke Jadwal Pertandingan per kategori). Kalau
    // sedang di halaman lain, kembali ke Beranda dulu baru scroll ke situ.
    function tampilkanJadwalGlobal() {
      sembunyikanSemuaView();
      document.getElementById('viewJadwalGlobal').style.display = 'block';
      setActiveNav('navJadwal');
      window.scrollTo(0, 0);
      // Default-kan filter Babak ke babak yang sedang ditayangkan admin (kalau
      // ada) - supaya publik tidak melihat beberapa babak sekaligus dan Nomor
      // Race dari babak berbeda (yang sama-sama mulai dari 1) tidak campur aduk.
      // Pengunjung tetap bisa ganti sendiri ke babak lain lewat dropdown ini.
      google.script.run
        .withSuccessHandler(function(babak) {
          const selBabak = document.getElementById('filterBabakJadwalGlobal');
          if (selBabak) {
            const cocok = babak && Array.from(selBabak.options).some(function(o) { return o.value === babak; });
            selBabak.value = cocok ? babak : '';
          }
          muatJadwalGlobal();
        })
        .withFailureHandler(function() { muatJadwalGlobal(); })
        .getBabakTayangAktif();
    }
    function tampilkanSkemaPilihKategori() {
      sembunyikanSemuaView();
      document.getElementById('viewSkemaPilihKategori').style.display = 'block';
      setActiveNav('navSkema');
      window.scrollTo(0, 0);
    }
    function tampilkanDaftar() {
      sembunyikanSemuaView();
      document.getElementById('viewDaftar').style.display = 'block';
      setActiveNav('navDaftar');
      window.scrollTo(0, 0);
      muatDaftarTim();
    }
    function tampilkanForm() {
      sembunyikanSemuaView();
      document.getElementById('viewForm').style.display = 'block';
      window.scrollTo(0, 0);
      document.getElementById('formTutupNotice').style.display = 'block';
    }
    function tampilkanAdmin() {
      sembunyikanSemuaView();
      document.getElementById('viewAdmin').style.display = 'block';
      window.scrollTo(0, 0);
      muatDaftarTimAdmin();
    }
    function tampilkanAdminJadwal() {
      sembunyikanSemuaView();
      document.getElementById('viewAdminJadwal').style.display = 'block';
      window.scrollTo(0, 0);
      resetFormJadwal();
      muatOpsiTimJadwal();
      muatDaftarJadwalAdmin();
      muatBabakTayangAdmin();
    }
    function tampilkanAdminUndian() {
      sembunyikanSemuaView();
      document.getElementById('viewAdminUndian').style.display = 'block';
      window.scrollTo(0, 0);
      resetUndianSetup();
    }
    function tampilkanAdminStream() {
      sembunyikanSemuaView();
      document.getElementById('viewAdminStream').style.display = 'block';
      window.scrollTo(0, 0);
      muatLiveStreamAdmin();
    }

    let kategoriAktifDetail = '';
    let kelasAktifDetail = '';
    const IKON_KATEGORI = { 'Perahu Naga': '🐉', 'Perahu Tradisional|Umum Putra': '🚹', 'Perahu Tradisional|Umum Putri': '🚺', 'Perahu Tradisional|ASN': '🏛️' };

    function tampilkanKategoriDetail(kategori, kelas, tabAwal) {
      sembunyikanSemuaView();
      document.getElementById('viewKategoriDetail').style.display = 'block';
      window.scrollTo(0, 0);

      kategoriAktifDetail = kategori;
      kelasAktifDetail = kelas;

      const judul = kategori + (kelas ? ' — ' + kelas : '');
      document.getElementById('kdhJudul').textContent = judul;
      document.getElementById('kdhIcon').textContent = IKON_KATEGORI[kategori + (kelas ? '|' + kelas : '')] || '🚣';

      gantiTabKategori(tabAwal === 'skema' ? 'skema' : 'jadwal');
    }

    function gantiTabKategori(tab) {
      document.getElementById('tabJadwalBtn').classList.toggle('active', tab === 'jadwal');
      document.getElementById('tabSkemaBtn').classList.toggle('active', tab === 'skema');
      document.getElementById('kdContentJadwal').style.display = tab === 'jadwal' ? 'block' : 'none';
      document.getElementById('kdContentSkema').style.display = tab === 'skema' ? 'block' : 'none';
      if (tab === 'jadwal') muatJadwalKategoriAktif();
      else muatSkemaKategoriAktif();
    }

    /* ================= STATISTIK & PAPAN KATEGORI ================= */
    function setText(id, val) {
      const el = document.getElementById(id);
      el.classList.remove('skeleton');
      el.textContent = val;
    }

    muatBerandaLive();
    muatBerandaStream();
    mulaiAutoRefreshBeranda();

    /* ================= MODAL PERATURAN LOMBA (muncul sekali per kunjungan) ================= */
    function tutupPeraturanModal() { document.getElementById('peraturanModal').style.display = 'none'; }
    (function tampilkanPeraturanPertamaKali() {
      try {
        if (sessionStorage.getItem('peraturanSudahDilihat') === '1') return;
        sessionStorage.setItem('peraturanSudahDilihat', '1');
      } catch (e) { /* abaikan kalau sessionStorage tidak tersedia */ }
      document.getElementById('peraturanModal').style.display = 'flex';
    })();

    /* ================= NAVBAR LANDING PAGE: efek scroll & animasi reveal ================= */
    (function setupNavbarScrollEffect() {
      const navbar = document.getElementById('landingNavbar');
      if (!navbar) return;
      function perbaruiNavbar() {
        if (window.scrollY > 40) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
      }
      window.addEventListener('scroll', perbaruiNavbar, { passive: true });
      perbaruiNavbar();
    })();

    let observerRevealScroll = null;
    function amatiElemenRevealScroll() {
      if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal-on-scroll').forEach(function(el) { el.classList.add('revealed'); });
        return;
      }
      if (!observerRevealScroll) {
        observerRevealScroll = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) { entry.target.classList.add('revealed'); observerRevealScroll.unobserve(entry.target); }
          });
        }, { threshold: 0.12 });
      }
      document.querySelectorAll('.reveal-on-scroll:not(.revealed)').forEach(function(el) { observerRevealScroll.observe(el); });
    }
    setTimeout(amatiElemenRevealScroll, 80);

    /* ================= DATA TIM TERDAFTAR ================= */
    let semuaTimDaftar = [];
    function muatDaftarTim() {
      document.getElementById('daftarTimContainer').innerHTML = '<div class="loading-state">Memuat data tim terdaftar...</div>';
      google.script.run
        .withSuccessHandler(function(list) { semuaTimDaftar = list; renderDaftarTim(); })
        .withFailureHandler(function(err) {
          document.getElementById('daftarTimContainer').innerHTML = '<div class="empty-state">❌ Gagal memuat: ' + (err && err.message ? err.message : err) + '</div>';
        })
        .getDaftarTim();
    }
    function renderDaftarTim() {
      const filter = document.getElementById('filterKategoriDaftar').value;
      const container = document.getElementById('daftarTimContainer');
      const data = filter ? semuaTimDaftar.filter(function(t) { return t.kategori === filter; }) : semuaTimDaftar;
      if (!data.length) { container.innerHTML = '<div class="empty-state">Belum ada tim yang terdaftar untuk kategori ini.</div>'; return; }
      container.innerHTML = data.map(function(t) {
        const kelasLabel = (t.kategori === 'Perahu Tradisional' && t.kelas && t.kelas !== '-') ? ' · ' + t.kelas : '';
        return '<div class="tim-item"><div class="tim-info"><div class="tim-nama">' + escapeHtml(t.namaTim) + '</div>' +
          '<div class="tim-sub">Ketua: ' + escapeHtml(t.namaKetua) + ' · ' + t.waktu + '</div></div>' +
          '<span class="tim-kategori-badge">' + escapeHtml(t.kategori) + escapeHtml(kelasLabel) + '</span>' +
          '<span class="tim-nomor">#' + t.nomor + '</span></div>';
      }).join('');
    }
