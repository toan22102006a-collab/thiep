// Service worker cho PWA. Đổi số phiên bản CACHE khi muốn ép mọi người tải lại toàn bộ.
const CACHE = 'thiep-v2';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Ảnh người dùng trên Supabase: không lưu trong bộ nhớ tạm của app (để ảnh hết hạn thì biến mất đúng hạn)
  if (new URL(req.url).hostname.endsWith('supabase.co')) return;
  // Trang chính: ưu tiên bản mới từ mạng (để cập nhật code), mất mạng thì dùng bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
      return r;
    }).catch(() => caches.match('index.html')));
    return;
  }
  // Còn lại (thư viện, font, ảnh): dùng bản đã lưu ngay, đồng thời cập nhật ngầm
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
