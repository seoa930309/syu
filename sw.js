// dayflow 오프라인 지원
// - 앱 화면(index.html): 인터넷이 되면 항상 최신 파일, 안 되면 저장해 둔 파일
// - 아이콘·폰트: 저장해 둔 것을 바로 쓰고 뒤에서 새로 받아 둠
const CACHE = 'dayflow-v33';
const SHELL = ['./', './index.html', './manifest.webmanifest', './route.webmanifest', './icons/route-192.png', './icons/route-512.png', './icons/route-apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './fonts/daehwa-light.woff2', './fonts/daehwa-regular.woff2', './fonts/daehwa-bold.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 앱 화면: 네트워크 먼저 → 실패하면 저장본
  if (req.mode === 'navigate') {
    // 앱 본체(루트·index.html, ?app=route 포함)만 index로 저장 — /route/ 이동 페이지는 따로
    const base = new URL('./', self.registration.scope).pathname;
    const isApp = url.pathname === base || url.pathname === base + 'index.html';
    e.respondWith(
      fetch(req)
        .then(res => { if (isApp && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
        .catch(() => caches.match(isApp ? './index.html' : req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // 같은 사이트 파일과 구글 폰트: 저장본 먼저, 뒤에서 갱신
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === location.origin || font) {
    e.respondWith(
      caches.open(CACHE).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
