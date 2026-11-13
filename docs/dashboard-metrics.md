# Định nghĩa và đối chiếu chỉ số Dashboard — Task #56

## Phạm vi và nguồn chuẩn

Đối chiếu `backend/app/services/admin.py`, `backend/app/routers/admin.py`,
`js/dashboard.js`, `js/admin-common.js`, `pages/admin/index.html` và dữ liệu PostgreSQL.
API thống kê yêu cầu quyền admin: `GET /api/admin/stats` và
`GET /api/admin/stats/concerts`. Thiếu xác thực trả 401, thiếu quyền trả 403.
Đây là thống kê toàn hệ thống, không có bộ lọc khoảng ngày hoặc người mua.

Issue yêu cầu năm chỉ số; giao diện thực tế có năm chỉ số chính và một chỉ số
bổ sung Check-ins Today. Tài liệu bao phủ cả sáu để không bỏ sót hành vi đang chạy.
Task #56 chỉ đối chiếu. Bản sửa #87 sau đó bổ sung trường inventory API và đổi nguồn số remaining; không thay công thức doanh thu, Tickets Sold hoặc schema PostgreSQL.

## Năm chỉ số chính

| Trường API / nhãn | Công thức PostgreSQL | Quy tắc tính |
| --- | --- | --- |
| `totalRevenue` / Total Revenue | `COALESCE(SUM(total_amount-refund_amount),0)` với `orders.payment_status='paid'` | Tiền giữ lại từ đơn thanh toán thành công. Không dùng tổng tiền mọi trạng thái. Đơn unpaid/failed/refunded bị loại. |
| `ticketsSold` / Tickets Sold | `COUNT(*)` từ tickets với `status IN ('valid','used')` | Số vé đã phát hành còn hiệu lực, gồm vé đã check-in. Không đếm vé refunded/cancelled, hold hoặc inventory sold chưa phát hành vé. |
| `totalOrders` / Total Orders | `COUNT(*)` từ orders | Mỗi order một lần, tất cả trạng thái. Reservation chưa có order không được tính. |
| `totalConcerts` / Total Concerts | `COUNT(*)` từ concerts | Toàn catalogue, gồm draft, cancelled, completed, on_sale và sold_out. |
| `upcomingConcerts` / Upcoming Concerts | `COUNT(*)` với `starts_at > now()` và `status IN ('on_sale','sold_out')` | Loại concert đã bắt đầu, draft, cancelled, completed. Đúng thời điểm bắt đầu không còn upcoming. |

Các trường trên là số nguyên, tập rỗng trả 0. Giá được lưu bằng Numeric(12,0),
không có phần thập phân; giao diện hiện dùng ký hiệu `$`, không chia cho 100.
Đây là đơn vị tiền demo đang triển khai, không phải hệ thống đa tiền tệ.
Phí và giảm giá hiện bằng 0 theo business rules; không tự cộng phí khi đối chiếu.

Hoàn tiền hiện là hoàn toàn phần: payment_status chuyển refunded nên doanh thu
đơn đó bằng 0. Nếu sau này thêm hoàn một phần nhưng vẫn payment_status paid,
công thức sẽ trừ refund_amount; cần đồng bộ lại chính sách/API và test lúc triển khai.
Không suy diễn trạng thái thanh toán chỉ từ order.status: đơn đã hoàn tiền có thể
mang order.status cancelled, phải đọc payment_status/refund_status.

## Chỉ số bổ sung và thời gian

`checkinsToday` = số ticket status used có checked_in_at từ
`date_trunc('day',now())` trở đi, theo timezone phiên PostgreSQL. Đơn vị là vé,
không phải lượt quét: quét lại không tạo ticket mới. Hiện query chỉ có cận dưới,
không chặn timestamp tương lai; đó là giới hạn cần lưu ý khi nhập dữ liệu thủ công.
Luồng check-in thông thường ghi thời gian server, không cho client tự chọn ngày.

`now()` lấy thời gian database, không dùng ngày hard-code của seed. Đối chiếu phải
lưu audited_at và database_timezone. Chỉ số phụ “this month” trên frontend dùng
tháng/năm timezone trình duyệt của các concert upcoming, nên không có cùng mốc
ngày với Check-ins Today nếu trình duyệt và PostgreSQL khác timezone.

## Theo concert và cách hiển thị

`/api/admin/stats/concerts` trả mọi concert, kể cả chưa có đơn hoặc chưa có zone.
Các tổng revenue/ticketsSold áp dụng cùng quy tắc, thêm điều kiện concert_id.
Bản sửa #87 bổ sung availableInventory (available hoặc held hết hạn), heldInventory
(held chưa hết hạn), soldInventory (sold). Thời gian được lấy một lần từ đồng hồ DB
qua db_now; không mutate tồn kho khi đọc thống kê. Concert không có inventory trả 0.
`checkedIn` là số vé used toàn thời gian của concert, không phải checkinsToday.
`capacity` = SUM(zones.capacity), tập rỗng bằng 0. `upcoming` dùng cùng điều kiện
thời gian và trạng thái như chỉ số toàn hệ thống.

Các bất biến cần đối chiếu trên cùng snapshot:

- Tổng revenue và ticketsSold theo concert bằng hai chỉ số toàn hệ thống tương ứng.
- Số concert có upcoming=true bằng upcomingConcerts; số phần tử bằng totalConcerts.
- Tổng capacity bằng tổng sức chứa zone, không phải số vé đã bán.
- Với đơn đã phát hành vé, total_amount bằng tổng tickets.price, gồm vé đã refund.
  Dùng giá lịch sử trên ticket, không dùng giá zone hiện tại có thể đã đổi.
- Đơn pending/failed/cancelled chưa phát hành vé không thể đối chiếu total_amount
  bằng SUM(ticket.price). Không kết luận sai lệch chỉ vì chưa có ticket.
- Ticket valid/used phải trỏ đến inventory sold. Inventory sold thiếu vé có hiệu lực
  cần điều tra, ngoại trừ inventory khóa bán có chủ đích của seed demo.

Không JOIN đồng thời orders, tickets, zones rồi SUM: tích quan hệ 1-n sẽ nhân tổng.
SQL đối chiếu dùng các phép tổng hợp độc lập.

Biểu đồ doanh thu mặc định chỉ lấy 5 concert có revenue>0 cao nhất; Expand mới
hiện toàn bộ concert có doanh thu. Danh sách upcoming chỉ hiện 4 concert đầu,
không thể lấy số hàng hiển thị làm tổng upcoming. Recent Orders phân trang,
không thể lấy số hàng trên một trang làm totalOrders. Phần trăm bán là tỷ lệ vé
phát hành trên capacity, làm tròn số nguyên; không phải tỷ lệ inventory available.

## Công cụ và kết quả đối chiếu

Chạy `docs/dashboard-reconciliation.sql` trên PostgreSQL bằng kết nối phù hợp.
Script chỉ SELECT trong transaction REPEATABLE READ READ ONLY; không seed,
không UPDATE hoặc xóa dữ liệu. Kết quả chỉ chứa ID và số tổng hợp, không chứa
email, mật khẩu, JWT hoặc QR. Trên hệ thống có giao dịch đồng thời, API và SQL ở
hai transaction khác nhau có thể lệch thời điểm: dùng snapshot QA tĩnh để xác nhận
công thức trước khi kết luận lỗi. API hiện không đảm bảo snapshot chung giữa hai request.

Kiểm chứng ngày 2026-11-13 trên database QA riêng `concertly_metrics56_test`,
PostgreSQL cổng 55439, seed từ `backend/scripts/seed_data.json`:

| Chỉ số | SQL | API |
| --- | ---: | ---: |
| totalConcerts | 11 | 11 |
| totalOrders | 14 | 14 |
| ticketsSold | 16 | 16 |
| totalRevenue | 2510 | 2510 |
| upcomingConcerts | 10 | 10 |
| checkinsToday | 0 | 0 |

Sức chứa 7.200; 11 đơn đã thanh toán/hoàn tiền có tổng tickets.price khớp total_amount.
Không có ticket valid/used gắn inventory không sold. Tổng sold inventory = 656:
16 vé valid/used + 640 inventory soldOut khóa bán từ seed. Đây là chênh lệch demo
có chủ đích, không phải 640 vé thất thoát hay doanh thu bị thiếu. Không sửa database
để ép sold inventory bằng Tickets Sold. Upcoming và checkinsToday thay đổi theo
thời gian chạy; bảng trên là kết quả tại thời điểm kiểm chứng, không phải kỳ vọng cố định.

Bài `backend/tests/test_dashboard_reconciliation.py` seed vào database test riêng,
chạy chính SQL tài liệu bằng kết nối read-only, so với cả hai API, kiểm tra tổng
theo concert, tổng tiền từng đơn và quan hệ ticket/inventory. Không dùng service
stats làm oracle cho chính nó. Bộ fixture backend có thao tác xóa schema test,
vì vậy chỉ chạy với database QA mới có tên chứa `test`, tuyệt đối không trỏ vào
`concertly`/database đang vận hành. Không cần in connection string có mật khẩu.

## Sai lệch được ghi nhận

[Issue #87 — tickets remaining chưa phản ánh inventory available](https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN./issues/87).
Trước bản sửa #87, frontend tính capacity - ticketsSold nên gồm cả hold và inventory
khóa bán không có ticket. Bản làm việc đã sửa: remaining lấy availableInventory,
không tính held chưa hết hạn hoặc sold; hold hết hạn được tính lại ngay cả trước
sweeper. Tickets Sold, doanh thu và progress bán vé giữ nguyên. API cũ thiếu field
thì hiện Availability unavailable, không tự suy diễn còn vé. Số remaining là snapshot
tồn kho, không cam kết mọi inventory đều mua được nếu concert ngoài thời gian mở bán.

Chưa kiểm chứng số liệu của database vận hành local hoặc production; không seed
hay thay đổi chúng để làm báo cáo này. Khi hợp đồng hoặc chính sách thay đổi,
cập nhật tài liệu này, SQL oracle, test và `docs/api-spec.md`/`docs/business-rules.md`
liên quan trong cùng lượt thay đổi.
