/* =================================================================
   gas-api.js
   Shim/polyfill untuk google.script.run, supaya seluruh kode
   JS_Core.js / JS_Bracket.js / JS_Admin.js / JS_Undian.js yang
   aslinya ditulis untuk berjalan di dalam Apps Script (HtmlService)
   tetap bisa jalan tanpa diubah sedikit pun, walau sekarang di-host
   sebagai file statis di GitHub Pages.

   Cara kerja: setiap pemanggilan
     google.script.run.withSuccessHandler(cb).NAMAFUNGSI(arg1, arg2)
   di-terjemahkan jadi:
     fetch(APPSCRIPT_URL, { method:'POST', body: JSON.stringify({fn:'NAMAFUNGSI', args:[arg1,arg2]}) })
   lalu hasil JSON-nya dikirim ke callback yang sama seperti sebelumnya.
   ================================================================= */
(function () {
  'use strict';

  // Ganti URL ini jika deployment Apps Script kamu berubah (Deploy > Manage deployments)
  var APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwlwKiEili9xmlc-DgaGhTmP7qu0Q0utnd3r4wCeV5I6aAttLUc-8bILQd1IuTO2CSdBQ/exec';

  function callServer(fnName, args, onSuccess, onFailure) {
    fetch(APPSCRIPT_URL, {
      method: 'POST',
      // text/plain dipakai supaya browser tidak mengirim OPTIONS preflight
      // (Apps Script tidak menangani preflight CORS dengan baik)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fnName, args: args })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' dari server');
        return res.json();
      })
      .then(function (data) {
        if (onSuccess) onSuccess(data);
      })
      .catch(function (err) {
        if (onFailure) onFailure(err);
        else if (window.console) console.error('Gagal memanggil "' + fnName + '":', err);
      });
  }

  function makeRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get: function (target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (cb) { return makeRunner(cb, failureHandler); };
        }
        if (prop === 'withFailureHandler') {
          return function (cb) { return makeRunner(successHandler, cb); };
        }
        // Nama properti lain dianggap sebagai nama fungsi backend Apps Script
        return function () {
          var args = Array.prototype.slice.call(arguments);
          callServer(prop, args, successHandler, failureHandler);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    get: function () { return makeRunner(null, null); },
    configurable: true
  });
})();
