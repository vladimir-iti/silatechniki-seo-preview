/* Картинки и схемы в статье открываются поверх страницы, а не отдельным файлом.
   Закрыть: ✕, Esc, клик по фону или по картинке. Без JS ссылка на схему
   по-прежнему открывает файл. Тот же код, что в public/js/app.js сайта. */
(function () {
  const prose = document.querySelector('main');
  if (!prose) return;
  const dlg = document.createElement('dialog');
  if (typeof dlg.showModal !== 'function') return;
  dlg.className = 'lbx';
  dlg.innerHTML = '<button type="button" class="lbx__close" aria-label="Закрыть">×</button><img class="lbx__img" alt="">';
  document.body.appendChild(dlg);
  const img = dlg.querySelector('.lbx__img');
  const pics = 'figure img, p img';
  prose.querySelectorAll(pics).forEach(function (i) { if (!i.closest('a')) i.style.cursor = 'zoom-in'; });
  prose.addEventListener('click', function (e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const i = e.target.closest(pics); if (!i) return;
    const a = i.closest('a');
    if (a && !/\.(svg|png|jpe?g|webp)$/i.test(a.getAttribute('href') || '')) return;
    e.preventDefault();
    img.src = a ? a.href : (i.currentSrc || i.src);
    img.alt = i.alt || '';
    dlg.showModal();
  });
  dlg.addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('close', function () { img.removeAttribute('src'); });
})();
