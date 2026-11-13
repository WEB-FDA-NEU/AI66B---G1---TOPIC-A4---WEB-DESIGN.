# Dữ liệu mẫu — task #55

Nguồn: `backend/scripts/seed_data.json`, script `backend/scripts/seed.py`. Giữ nguyên catalogue, giá, sức chứa và tên khu; bổ sung scenario và demoExpectations để đối chiếu.

## Giá và sức chứa

| Concert | Hạng vé | Giá nguyên đơn vị | Capacity |
| --- | --- | --- | --- |
| c1 — Ariana Grande | Standard Tier 2 | 80 | 300 |
| c1 — Ariana Grande | Standard Tier 1 | 150 | 180 |
| c1 — Ariana Grande | VIP Diamond Experience | 350 | 120 |
| c2 — The Weeknd | General Admission Standing | 90 | 450 |
| c2 — The Weeknd | Cat 1 Seated | 180 | 270 |
| c2 — The Weeknd | VIP After Hours Lounge | 420 | 180 |
| c3 — Travis Scott | Floor Standing Mosh | 75 | 400 |
| c3 — Travis Scott | Balcony Seating | 120 | 240 |
| c3 — Travis Scott | Cactus Jack VIP Pass | 300 | 160 |
| c4 — Jennie | General Floor Standing | 85 | 250 |
| c4 — Jennie | Lower Bowl Seated | 170 | 150 |
| c4 — Jennie | OA VIP Soundcheck Package | 380 | 100 |
| c5 — Lisa | Rockstar Standing Zone | 95 | 370 |
| c5 — Lisa | Tier 1 Center Seated | 200 | 230 |
| c5 — Lisa | LLOUD Ultimate VIP Meet & Greet | 450 | 150 |
| c6 — Taylor Swift | Standard Floor GA | 95 | 350 |
| c6 — Taylor Swift | Lower Bowl Reserved | 220 | 210 |
| c6 — Taylor Swift | Karma Is My Boyfriend VIP | 490 | 140 |
| c7 — Bruno Mars | Silver Tribune | 85 | 300 |
| c7 — Bruno Mars | Gold Standing Pit | 180 | 180 |
| c7 — Bruno Mars | 24K Magic VIP Experience | 390 | 120 |
| c8 — Justin Bieber | General Admission | 75 | 270 |
| c8 — Justin Bieber | Belieber Standing Pit | 160 | 170 |
| c8 — Justin Bieber | Ghost VIP Lounge | 350 | 110 |
| c9 — BTS | CAT 3 Seating | 90 | 420 |
| c9 — BTS | Soundcheck Standing | 280 | 260 |
| c9 — BTS | ARMY Ultimate VIP Pass | 550 | 170 |
| c10 — G-Dragon | Standard Tier | 85 | 250 |
| c10 — G-Dragon | Coup D'Etat Pit | 210 | 150 |
| c10 — G-Dragon | One of a Kind VIP | 420 | 100 |
| c11 — Cortis | Balcony Seated | 60 | 220 |
| c11 — Cortis | Front Row Orchestra | 140 | 140 |
| c11 — Cortis | Midnight VIP Pass | 260 | 90 |

Tổng: **11 concert, 33 hạng, 7.200 đơn vị tồn kho**. Tổng capacity các tier bằng ticketCapacity từng concert; tên/giá mọi section khớp venue maps, tên/giá/capacity khớp frontend mock. Standing dùng hàng seat như tồn kho nội bộ, không gán số ghế công khai.

## 14 đơn demo

| Order number | Concert | Kịch bản | Số lượng |
| --- | --- | --- | --- |
| 10001 | c1 | Paid order with valid tickets | 2 |
| 10002 | c3 | Paid and checked in; used tickets | 2 |
| 10003 | c2 | Full mock refund; tickets refunded and inventory free | 1 |
| 10004 | c4 | Awaiting payment; no tickets issued | 2 |
| 10005 | c7 | Paid order with valid tickets | 3 |
| 10006 | c8 | Failed payment; no tickets issued | 1 |
| 10007 | c11 | Paid order with valid tickets | 1 |
| 10008 | c1 | Paid order with valid tickets | 1 |
| 10009 | c9 | Paid order with valid tickets | 2 |
| 10010 | c6 | Cancelled before payment; no refund/tickets | 1 |
| 10011 | c10 | Paid order with valid tickets | 2 |
| 10012 | c5 | Paid order with valid tickets | 2 |
| 10013 | c3 | Paid order with valid tickets | 1 |
| 10014 | c7 | Full mock refund; tickets refunded and inventory free | 2 |

## Dashboard kỳ vọng trên DB mới

- totalConcerts=11; totalOrders=14; ticketsSold=16; totalRevenue=2510; tổng capacity=7200; zone count=33.
- Kịch bản JSON: 9 paid, 2 refunded, 1 pending, 1 failed, 1 cancelled. Refunded được lưu DB dưới order.status=cancelled và payment_status/refund_status=refunded.
- Pending/failed/cancelled trước thanh toán không có ticket; paid có valid/used; refunded có ticket refunded và không giữ tồn kho. Tier soldOut mô phỏng hết vé bằng inventory sold, không tự tạo vé để tăng ticketsSold.
- upcomingConcerts/checkinsToday phụ thuộc đồng hồ DB. Không tự dời lịch concert/order để làm đẹp demo. Giá nguyên đơn vị như nguồn, UI hiển thị $, không tự quy đổi VND.
- demoExpectations được validator đối chiếu với catalogue/orders. Các giá trị chỉ áp dụng DB mới seed đầy đủ, không áp đặt lên dữ liệu ứng dụng đã thay đổi.

## Chạy an toàn

Kiểm tra không kết nối database:

```sh
python3 -B backend/scripts/seed.py --check
```

Chỉ khi đã xác nhận DATABASE_URL trỏ database demo/QA được phép, cấu hình SEED_ADMIN_PASSWORD và SEED_USER_PASSWORD trong môi trường riêng (không commit), rồi chạy:

```sh
cd backend
python -B scripts/seed.py
python -B scripts/seed.py
```

Script có thể sinh/in mật khẩu một lần nếu biến môi trường thiếu; đặt đủ hai biến trước khi chạy để tránh in mật khẩu. Các test thu output nội bộ, không công bố thông tin đăng nhập. --file cho phép chọn file JSON khác; --no-sample-orders chỉ tạo admin/catalogue, vẫn là dữ liệu demo, không phải hướng dẫn seed production.

Validator kiểm tra kiểu JSON, tham chiếu, capacity, tên/giá map, đơn không quá 6 vé, trùng đơn vị tồn kho, payment method và timestamp có múi giờ/thứ tự thanh toán-check-in-refund.

## Idempotency và bảo toàn dữ liệu

Dùng email, concert ID, tên tier, nhãn seat và order number làm khóa tự nhiên. Chỉ thêm hàng thiếu; transaction và advisory lock bảo vệ seed đồng thời. Chạy lại giữ nguyên mật khẩu, QR/ticket code, check-in và chỉnh sửa qua ứng dụng. Không tự cập nhật giá/lịch/tên bản ghi đã có.

Cập nhật sold-out chỉ áp dụng concert vừa tạo hoặc vừa nhận paid sample trong lần đó; không cập nhật concert ngoài phạm vi hay hàng seed không đổi. Order number đã tồn tại được giữ nguyên. Ghế paid sample đã bị dùng trong DB gây lỗi/rollback, không chiếm ghế hoặc ghi đè. Đây không phải công cụ migrate/sửa dữ liệu thật.

Task này chỉ seed/test trên PostgreSQL QA mới riêng; không seed/reset database local của người dùng.

## Kiểm thử và TV1 review

Test tại backend/tests/test_seed.py: JSON/capacity/giá/tên, nhiều trạng thái, seed lặp, mật khẩu/QR/check-in không đổi, không sửa concert ngoài phạm vi và dashboard service/API. Pytest yêu cầu TEST_DATABASE_URL tới DB dùng một lần có tên chứa test; fixture reset bảng của DB test, không được dùng DB ứng dụng.

Checklist để TV1 đối chiếu sau seed trên DB được phép:

- [ ] Home/Explore/Detail: 11 concert, tên/nghệ sĩ/lịch khớp nguồn.
- [ ] Venue map: đủ khu, đúng tên/giá; Standing không có số ghế, Seated chọn được ghế; khu soldOut không bán được.
- [ ] Admin: đối chiếu /api/admin/stats, /api/admin/stats/concerts, /api/admin/orders với số liệu kỳ vọng và 14 đơn.
- [ ] Bộ lọc pending/paid/failed/cancelled/refunded; vé valid/used/refunded và QR/check-in.
- [ ] Seed lần hai không tăng số dòng, không đổi password/QR/check-in.
- [ ] Ghi tên TV1, ngày, commit và kết quả xác nhận.

Chưa có xác nhận TV1 trong issue lúc triển khai. Không tự ghi đã review hoặc gửi thông tin đăng nhập thay người dùng.
