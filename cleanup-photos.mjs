// Xóa ảnh cũ hơn 15 ngày trong kho "photos" của Supabase. Chạy mỗi ngày bằng GitHub Actions.
// Cần 2 biến môi trường (lấy từ GitHub Secrets): SUPABASE_URL và SUPABASE_SERVICE_KEY (khóa bí mật, KHÔNG để trong code).
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'photos';
const DAYS = 15;
if (!URL || !KEY) { console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_KEY'); process.exit(1); }

const headers = { apikey: KEY, 'Content-Type': 'application/json' };
if (KEY.startsWith('eyJ')) headers.Authorization = 'Bearer ' + KEY;   // khóa kiểu cũ (JWT) cần thêm dòng này

const limitMs = DAYS * 24 * 3600 * 1000;
const expired = [];
let offset = 0, scanned = 0;
for (;;) {
  const r = await fetch(`${URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST', headers,
    body: JSON.stringify({ prefix: '', limit: 100, offset, sortBy: { column: 'created_at', order: 'asc' } })
  });
  if (!r.ok) { console.error('Lỗi khi liệt kê ảnh:', r.status, await r.text()); process.exit(1); }
  const items = await r.json();
  if (!items.length) break;
  scanned += items.length;
  let reachedFresh = false;
  for (const it of items) {
    if (!it.name || !it.created_at) continue;
    if (Date.now() - Date.parse(it.created_at) > limitMs) expired.push(it.name);
    else { reachedFresh = true; break; }   // đã sắp xếp cũ → mới, gặp ảnh còn hạn thì dừng
  }
  if (reachedFresh || items.length < 100) break;
  offset += 100;
}

for (let i = 0; i < expired.length; i += 100) {
  const chunk = expired.slice(i, i + 100);
  const r = await fetch(`${URL}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: chunk }) });
  if (!r.ok) { console.error('Lỗi khi xóa ảnh:', r.status, await r.text()); process.exit(1); }
}
console.log(`Đã kiểm tra ${scanned} ảnh, xóa ${expired.length} ảnh quá ${DAYS} ngày.`);
