# 🎲 Cờ Tỷ Phú CLB30

Game cờ tỷ phú **chơi online cùng bạn bè**: mỗi người dùng điện thoại hoặc máy tính riêng, vào chung phòng bằng mã hoặc link, **không cần tài khoản**.
Chạy hoàn toàn trên **Cloudflare (gói miễn phí)**: không phải thuê server, không cần máy nào bật sẵn.

- 2–6 người/phòng, có chế độ xem (spectator) khi ván đã bắt đầu.
- Đủ luật chính thức: mua, đấu giá realtime, xây nhà/khách sạn đều, thế chấp, giao dịch, tạm giữ, gom tiền, phá sản.
- Luật tuỳ chọn: hũ tiền Cà Phê Vỉa Hè, Khởi Hành ×2, tắt đấu giá, giới hạn thời gian ván, đồng hồ lượt.
- Có **tài khoản** (biệt danh + mật khẩu): đăng nhập ở thiết bị nào cũng chơi tiếp được đúng ghế.
- **Voice chat** trong phòng, **vay ngân hàng / vay người chơi**.
- Mất mạng hoặc reload trang thì tự vào lại đúng ghế. Người rời đi quá 3 phút, chủ phòng có thể thay bằng bot.
- Giao diện tiếng Việt, hỗ trợ điện thoại dọc và dark mode.

---

## Cấu trúc

```
shared/   Engine luật chơi thuần TypeScript (không I/O), dữ liệu bàn cờ & thẻ, giao thức (zod), bot
          └─ src/data/board.vi.ts   ← tên ô, giá, tiền thuê
          └─ src/data/cards.vi.ts   ← thẻ Cơ Hội / Khí Vận
worker/   Cloudflare Worker + Durable Object (mỗi phòng 1 instance), WebSocket
client/   React 18 + Vite + Tailwind + Framer Motion + Zustand
          └─ src/strings.vi.ts      ← toàn bộ chữ hiển thị
          └─ public/logos/          ← logo thương hiệu (bạn tự thêm)
DECISIONS.md   Các quyết định luật chơi / kỹ thuật
```

## Yêu cầu

- Node.js 20 trở lên
- pnpm 10 (`npm i -g pnpm` hoặc `corepack enable`)

## Chạy ở máy (local)

```bash
pnpm install
```

```bash
pnpm dev
```

Lệnh này build client, rồi chạy song song:

- `wrangler dev` ở cổng **8787**: giả lập Cloudflare (Worker + Durable Object + lưu trữ) ngay trên máy.
- `vite` ở cổng **5173**: giao diện tự reload khi sửa code.

Mở <http://localhost:5173>, tạo phòng, rồi mở thêm một tab ẩn danh (hoặc điện thoại cùng mạng Wi-Fi qua `http://<IP-máy>:5173`) để chơi thử.

## Kiểm thử

```bash
pnpm test
```

Lệnh này chạy:

- `shared`: test đơn vị cho toàn bộ luật (thuê ×2, vận tải, tiện ích, thẻ, tạm giữ, xây/bán đều, kho 32/12, thế chấp 110%, gom tiền, phá sản, đấu giá, giao dịch…) và **mô phỏng 500 ván** với bot ngẫu nhiên, kiểm tra bất biến (mất khoảng 1–2 phút).
- `worker`: test tích hợp phòng chơi: tạo phòng, vào phòng, mật khẩu, chơi vài lượt, hết giờ, mất kết nối rồi vào lại, bot, restart server, chat, chống spam, khán giả, kick, chơi lại.
- `client`: test hình học bàn cờ.

Chỉ chạy nhanh phần mô phỏng với ít ván hơn:

```bash
SIM_GAMES=40 pnpm --filter @cotyphu/shared test
```

Kiểm tra code:

```bash
pnpm lint
```

```bash
pnpm typecheck
```

---

## Triển khai lên Cloudflare (miễn phí)

Yêu cầu: một tài khoản Cloudflare (miễn phí). Game chạy ở tên miền miễn phí `https://cotyphuclb30.<tên-tài-khoản>.workers.dev`.

### Cách 1: Kết nối GitHub (khuyên dùng, mỗi lần push tự deploy)

1. Đăng nhập <https://dash.cloudflare.com>, vào **Workers & Pages → Create → Workers → Import a repository**.
2. Chọn repo GitHub chứa code này, rồi điền:
   - **Root directory**: để trống (thư mục gốc repo)
   - **Build command**: `pnpm install --frozen-lockfile && pnpm --filter @cotyphu/client build`
   - **Deploy command**: `cd worker && npx wrangler deploy`
3. Bấm **Deploy**. Lần đầu, Cloudflare tự tạo Durable Object `Room` (theo `worker/wrangler.toml`).
4. Xem địa chỉ chơi: vào Worker **cotyphuclb30 → Settings → Domains & Routes**, dòng `workers.dev`. Gửi link này cho bạn bè. WebSocket chạy sẵn, không cần cấu hình thêm. (Sau này muốn dùng tên miền riêng thì bấm **Add → Custom domain**.)

### Cách 2: Deploy từ máy bằng lệnh

```bash
pnpm install
```

```bash
cd worker && npx wrangler login
```

```bash
cd .. && pnpm run deploy
```

### Ghi chú

- `/healthz` trả `{"ok":true}` để kiểm tra Worker đang chạy.
- Ván được lưu trong Durable Object sau mỗi nước đi, deploy lại không mất ván. Phòng không hoạt động 2 giờ thì tự xoá.
- Client ping mỗi 25 giây, nên Cloudflare không cắt kết nối rảnh (~100 giây).
- Gói Workers miễn phí: 100.000 request/ngày, đủ dư cho nhiều ván mỗi ngày. Tin nhắn WebSocket được tính gộp nên rất tiết kiệm.

---

## Tuỳ biến

### Thêm logo thương hiệu

Đặt file vào `client/public/logos/<id>.svg` (hoặc `.png`). Xem danh sách id trong [`client/public/logos/README.md`](client/public/logos/README.md).
Thiếu file thì game tự hiển thị huy hiệu chữ viết tắt trên nền `brandColor`.

### Sửa tên ô, giá, tiền thuê

Mở `shared/src/data/board.vi.ts`. Mỗi ô đất được khai báo một dòng:

```ts
street(13, 'Hội An', 'pink', 140, [10, 50, 150, 450, 625, 750], 100),
//     ô    tên       nhóm   giá   [trống, 1 nhà, 2, 3, 4, khách sạn]  giá xây
```

- `short` (tham số cuối, tuỳ chọn): tên ngắn hiển thị trên ô, ví dụ `'Mũi Né'`.
- Thế chấp tự tính bằng 50% giá mua.
- Ảnh minh hoạ ô (tuỳ chọn): thêm `image: 'hoi-an.jpg'` và đặt file vào `client/public/images/`.

Sửa xong thì chạy `pnpm test` để chắc chắn mọi thứ vẫn đúng.

### Sửa thẻ bài

Mở `shared/src/data/cards.vi.ts`. Có thể đổi chữ trong `text` thoải mái. Hiệu ứng nằm ở `effect`.

### Sửa chữ trên giao diện

Mọi chữ hiển thị nằm trong `client/src/strings.vi.ts`.
