let _timer = null;

export function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type ? ` ${type}` : '');
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    el.classList.remove('show');
  }, 2400);
}
