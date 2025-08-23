// public/script.js
(function () {
  const tg = window.Telegram?.WebApp;
  tg?.expand();

  const el = (id) => document.getElementById(id);
  const statusEl = el('status') || (() => {
    const p = document.createElement('p');
    p.id = 'status';
    p.style.cssText = 'margin-top:12px;font:14px/1.4 system-ui,sans-serif;';
    document.body.appendChild(p);
    return p;
  })();

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // ВАЖНО: используем абсолютный URL; пропишите точный адрес вашего бэкенда
  const BASE_URL = (window.APP_BASE_URL || tg?.initDataUnsafe?.start_param || '').startsWith('http')
    ? window.APP_BASE_URL
    : (window.APP_BASE_URL || (window.location.origin || ''));

  const DATA_URL = `${BASE_URL.replace(/\/+$/,'')}/data`;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const user = tg?.initDataUnsafe?.user;
      const initData = tg?.initData;
      const platform = tg?.platform || 'web';

      const greetingEl = el('greeting');
      if (!user) {
        if (greetingEl) greetingEl.innerText = 'User not found.';
        setStatus('Нет данных пользователя из Telegram WebApp.');
        return;
      }

      if (greetingEl) {
        greetingEl.innerText = `Hello, ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}!`;
      }

      const payload = { user, initData, platform };
      setStatus('Отправляю данные боту…');

      // 1) Пытаемся sendBeacon — самый надёжный при закрытии
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: 'application/json' });
      let sent = false;

      if ('sendBeacon' in navigator) {
        try {
          sent = navigator.sendBeacon(DATA_URL, blob);
        } catch (_) { /* ignore */ }
      }

      // 2) Фолбэк: fetch с keepalive + таймаут
      if (!sent) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000); // 8s fail-safe
        try {
          const resp = await fetch(DATA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json,
            keepalive: true,
            signal: controller.signal
          });
          clearTimeout(t);
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          sent = true;
        } catch (e) {
          clearTimeout(t);
          setStatus('Не удалось отправить данные: ' + (e?.message || e));
          // не закрываем, чтобы вы видели ошибку
          return;
        }
      }

      setStatus('Данные отправлены. Можно закрывать…');
      // 3) Закрываем только когда точно отправлено
      try { tg?.close(); } catch (_) {}
    } catch (e) {
      setStatus('Ошибка на клиенте: ' + (e?.message || e));
    }
  });
})();


