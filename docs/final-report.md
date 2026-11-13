# CONCERTLY — Báo cáo nghiệp vụ và dữ liệu

**Phạm vi:** phần nghiệp vụ và dữ liệu cho báo cáo cuối kỳ môn Web Design,
Task [#58](https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN./issues/58).
Đối chiếu ngày 13/11/2026, mã nguồn nền `ca28d70` trên nhánh
`feature/trung-docs-sync`. Nội dung mô tả implementation hiện có, không thay thế
bằng mô hình hệ thống dự kiến. Các đề xuất được tách khỏi chức năng đã triển khai.

## 1. Tổng quan nghiệp vụ hệ thống

### 1.1. Mục tiêu và tác nhân

CONCERTLY là ứng dụng bán vé concert trực tuyến trong phạm vi dự án học phần.
Hệ thống hỗ trợ tìm sự kiện, lựa chọn khu vé, giữ tồn kho có thời hạn, thanh toán
mô phỏng, phát hành vé và quản lý đơn hàng. PostgreSQL là nguồn dữ liệu quyết định
cho reservation, tồn kho, order và ticket. Trạng thái thanh toán thành công trong
ứng dụng không chứng minh đã có giao dịch tiền thật bên ngoài hệ thống.

Khách chưa đăng nhập có thể xem catalogue và seat map; việc giữ/mua vé yêu cầu
tài khoản active. Chủ đơn được xem và hủy đơn theo điều kiện nghiệp vụ. Staff/admin
có thể đọc chi tiết đơn/vé của người khác; route check-in thông thường cho hai role
này, còn toàn bộ `/api/admin/*` chỉ cho admin. Quyền hủy qua API vẫn thuộc chủ đơn.

Đăng nhập sử dụng email, mật khẩu kiểm tra bằng bcrypt và JWT HS256 có hạn mặc
định 60 phút. Trang đăng ký hiện chỉ lưu tên local, chưa tạo user PostgreSQL.
Không coi thông báo đăng ký trên UI là bằng chứng tài khoản đã tồn tại ở backend.

### 1.2. Cấu trúc dữ liệu thực tế

Nguồn: [models.py](../backend/app/models.py), [schema.sql](../backend/schema.sql)
và [schemas.py](../backend/app/schemas.py).

| Thực thể/bảng | Vai trò và thuộc tính liên quan |
| --- | --- |
| User / `users` | Danh tính, password_hash, role, is_active; liên kết với reservation và order |
| Concert / `concerts` | Thời gian diễn/mở bán, trạng thái sự kiện |
| Zone / `zones` | Khu/hạng vé của concert, price và capacity; booking_type là cột DB seated/standing; JSON chỉ dùng cho seed |
| Seat / `seats` | Ghế Seated hoặc đơn vị tồn kho Standing; zone_id, row_label, seat_number, status, reservation_id, held_until |
| Reservation / `reservations` | Chủ hold, concert_id, status và expires_at; liên kết tồn kho qua seats.reservation_id |
| Order / `orders` | Tổng tiền, chủ đơn, concert, reservation_id; trạng thái đơn, thanh toán và hoàn tiền |
| Ticket / `tickets` | Một vé phát hành cho một đơn vị tồn kho; order_id, seat_id, concert_id, price lịch sử, ticket_code, status và thông tin check-in |

Không có bảng **Order Items** riêng: các ticket thể hiện chi tiết vé đã phát hành
của order. Đơn chưa thanh toán có thể tồn tại mà chưa có ticket. Không có bảng
**Payment** riêng: payment_method, payment_status, payment_ref, paid_at và các
trường refund nằm trên orders. Vì vậy, không được trình bày mô hình Order Items
hoặc Payment như những bảng đã triển khai.

Sau tích hợp #81, catalogue public được tải qua public-catalog.js từ API, ghép
với dữ liệu trình bày/mock; khi API lỗi có thể còn preview local. Hình venue/polygon
lấy từ các file SVG configuration. Chúng không thay thế giá/tồn kho PostgreSQL khi giữ và thanh toán.

## 2. Quy trình đặt vé và giữ chỗ

### 2.1. Chọn concert, khu và số lượng

Luồng giao diện hiện tại:

```text
Home/Explore → Concert → Chọn hạng/khu → Chọn ghế hoặc số lượng
→ Continue Payment → Tạo reservation → Checkout → Order Detail/My Tickets
```

Seated và Standing có cách chọn khác nhau:

| Loại | Thao tác người mua | Request giữ chỗ | Cơ chế phân bổ |
| --- | --- | --- | --- |
| Seated | Chọn/bỏ chọn từng ghế đánh số | seat_ids | Giữ đúng các ID đã chọn nếu còn khả dụng; không tự tìm ghế liền nhau |
| Standing | Chọn khu và số lượng | standing gồm zone_id, quantity | Backend tự cấp đơn vị tồn kho khả dụng theo ID tăng dần dưới khóa; không gán hàng/số ghế công khai |

Cơ chế cấp tự động hiện chỉ phân bổ **tồn kho Standing**. Chưa có API nhận khu
Seated và số lượng rồi tự chọn ghế ngồi. API cho phép kết hợp Standing/Seated trong
một request, nhưng UI hiện gửi lựa chọn của một hạng/loại mỗi lần Continue Payment;
không coi giỏ mua hỗn hợp nhiều khu trên UI là đã hoàn thiện.

Tổng số vé mỗi reservation phải thỏa:

```text
1 ≤ số seat_ids + tổng standing[].quantity ≤ 6
```

Số lượng Standing là số nguyên nghiêm ngặt; không lặp zone hoặc seat ID. Giới hạn
6 vé áp dụng cho mỗi lần giữ/mua, không phải quota tích lũy theo tài khoản. Các đơn
đã thanh toán theo giới hạn cũ được giữ tương thích; hold active cũ quá 6 bị chặn
checkout mới. Nguồn xác minh: [tickets.js](../js/tickets.js), schemas và
[reservations.py](../backend/app/services/reservations.py).

### 2.2. Điều kiện tạo reservation

`POST /api/reservations` yêu cầu đăng nhập active, concert tồn tại và on_sale,
không trước sale_start_at nếu có, không sau sale_end_at nếu có, đồng thời chưa đến
starts_at. Code dùng `now > sale_end_at` nhưng `now >= starts_at` để chặn; không
đồng nhất hai biên thời gian này. Tồn kho phải đúng concert/loại, còn khả dụng và
đủ số lượng. Request không hợp lệ không tạo hold một phần.

Click chọn ghế trên UI chỉ tạo trạng thái Selected ở trình duyệt. Ghế chuyển held
khi Continue Payment gọi API thành công (HTTP 201), không phải ngay khi click.
Hold mới thành công thay hold active cũ của cùng người/concert; lỗi giao dịch làm
rollback, không được làm mất hold cũ chỉ vì thử lựa chọn không hợp lệ.

### 2.3. Thời hạn và vòng đời giữ chỗ

Theo [config.py](../backend/app/config.py), TTL mặc định là 300 giây; backend cho
phép override qua RESERVATION_TTL_SECONDS, trong khi UI hiện giới hạn countdown
5 phút. Không coi cấu hình khác 300 là chính sách đã đồng bộ giữa các lớp.

```text
expires_at = thời điểm PostgreSQL sau khi lấy khóa + TTL
Hold hợp lệ: status = active và thời điểm kiểm tra < expires_at
```

| Trạng thái/chuyển đổi | Sự kiện | Tác động tồn kho |
| --- | --- | --- |
| Tạo mới → active | Giữ vé hợp lệ | available → held, ghi reservation_id/held_until |
| active → cancelled | Release hoặc thay hold thành công | Trả tồn kho của hold cũ |
| active → expired | Kiểm tra hạn hoặc sweeper | held hết hạn → available |
| active → converted | Checkout thành công | held → sold, xóa liên kết hold trên seat |

Reload/đọc reservation không gia hạn. Tại đúng expires_at, hold đã hết hiệu lực;
checkout trả 410 reservation_expired và không phát hành vé mới. GET reservation có
thể xử lý expiry rồi trả 200 với seats rỗng, total_amount=0, seconds_left=0.

Seat map thể hiện hold quá hạn là available ngay cả trước khi cập nhật row DB.
Giải phóng vật lý được thực hiện bằng xử lý lazy và sweeper mặc định mỗi 30 giây,
theo batch/khóa. Không có 30 giây ân hạn và không cam kết row thay đổi đúng từng
mili giây tại deadline. Frontend chặn thanh toán khi hết hạn, chuyển trang Session
Expired và cố gắng release; backend vẫn bảo vệ độc lập khi mạng lỗi.

### 2.4. Ngăn giữ/bán trùng

Service khóa các seat theo thứ tự ID; advisory lock tuần tự hóa yêu cầu thay hold
cùng user/concert. Việc cấp tồn kho, tạo hold và checkout được bảo vệ bằng transaction.
Unique index trên tickets.seat_id với status valid/used ngăn nhiều vé có hiệu lực
cho cùng một đơn vị tồn kho. Hai người tranh cùng ghế không thể đồng thời giữ
thành công; bên còn lại nhận 409 seat_unavailable. Standing thiếu tồn kho trả
standing_unavailable. Snapshot availability lúc xem không bảo đảm lúc giữ còn vé.
Đây là bảo đảm trong luồng DB hiện tại, không phải kết luận về sức tải production.

## 3. Thanh toán mô phỏng, hủy đơn và hoàn tiền

### 3.1. Kiểm tra checkout và tính tiền

`POST /api/checkout` yêu cầu reservation_id, payment_method và buyer gồm họ tên,
email, điện thoại. Backend trim contact, kiểm tra tên 2–150 ký tự, email theo regex
của dự án, điện thoại 8–15 chữ số trong các ký tự định dạng cho phép. Buyer được
validate nhưng chưa lưu thành thông tin người mua riêng; chủ vé lấy từ account.

Chỉ chủ reservation được thanh toán. Backend xác minh hạn dưới khóa, số vé không
quá 6, seat vẫn held bởi reservation đó và held_until còn hạn. Phương thức chỉ nhận
card, ewallet hoặc bank_transfer. Thiếu/sai input trả 422; sai phương thức trả 400;
không sở hữu/không tồn tại trả 404; tồn kho mất hiệu lực trả 409; hold hết hạn trả 410.
Đây là từ chối nghiệp vụ, không phải mô phỏng phản hồi từ ngân hàng.

```text
Tổng thanh toán = tổng Zone.price hiện tại của các seat thuộc reservation
Phí bổ sung = 0; giảm giá = 0
```

Giá tại checkout lấy từ DB, không nhận tổng client làm căn cứ. Reservation chưa
lưu snapshot giá cố định: chưa có cam kết khóa giá 5 phút nếu giá zone bị thay đổi.
Giá lịch sử được ghi vào Ticket.price khi phát hành. Tiền dùng NUMERIC(12,0), API
trả số nguyên, UI hiển thị `$`; không tự quy đổi sang VND hoặc coi là đa tiền tệ.

### 3.2. Chuyển reservation thành đơn và vé

Theo [checkout.py](../backend/app/services/checkout.py), một transaction thành công:

1. Tạo order với status=paid, payment_status=paid, paid_at và payment_ref tiền tố MOCK.
2. Tạo một ticket valid cho mỗi đơn vị tồn kho, mã ticket độc lập và duy nhất.
3. Chuyển inventory sold, xóa held_until/reservation_id trên seat; hold thành converted.
4. Nếu không còn inventory chưa sold, concert chuyển sold_out.

Gọi lặp với reservation converted đã có order trả chính order đó, HTTP vẫn 201;
không tạo thêm vé. Auth, body và phương thức thanh toán vẫn được kiểm tra.
Reservation cũ vẫn converted khi order sau đó bị hủy.

Luồng mock hợp lệ tạo thẳng paid, không có xử lý ngân hàng pending/failed thực.
Các trạng thái pending/failed và refund requested/rejected có trong schema/seed
không chứng minh đã có đầy đủ workflow tương ứng. Ngoại lệ DB không xử lý có thể
trả 500; không có cổng thanh toán, webhook, 3-D Secure hoặc đối soát tiền thật.

Checkout còn nhánh demo không reservationId: lưu kết quả local, không giữ ghế thật,
không tạo order PostgreSQL hoặc QR vào cửa. Seat Selection hiện bắt buộc API và
chặn mua khi API lỗi; không tự fallback sang demo để giả đặt vé thành công.

### 3.3. Hủy và hoàn tiền

Theo [orders.py](../backend/app/services/orders.py), chủ đơn chỉ hủy toàn đơn khi
status pending/paid, chưa cancelled và không có ticket used. Nếu concert không
cancelled, phải còn **hơn 24 giờ** tới starts_at; đúng 24 giờ bị chặn. Concert
cancelled miễn điều kiện thời gian nhưng không miễn quyền sở hữu/trạng thái/vé used.
UI dùng can_cancel và API xác minh lại dưới khóa; staff/admin không được hủy hộ
qua endpoint này. Hủy lặp trả 409, không hoàn tiền lần hai.

| Trường hợp hợp lệ | Thay đổi dữ liệu | Tác động thống kê |
| --- | --- | --- |
| Đơn đã paid | Order cancelled; payment_status/refund_status refunded; refund_amount=total_amount; ticket refunded; inventory được trả | Loại toàn bộ doanh thu đơn và vé đó khỏi Tickets Sold; vẫn tính Total Orders |
| Đơn chưa trả tiền | Order cancelled; không phát sinh tiền hoàn mới; ticket nếu có chuyển cancelled | Không cộng doanh thu; vẫn tính Total Orders |

Mock refund luôn thành công, hoàn toàn phần, không trừ phí hủy. Concert sold_out
được mở lại on_sale khi hủy trả tồn kho; concert cancelled không tự mở bán lại.
Không có tự động hoàn tất cả đơn khi concert cancelled, hủy từng vé, hoàn một
phần hoặc quy trình duyệt refund. Vé used chặn hủy cả đơn.

QR hợp lệ chứa ticket_code gốc; API chỉ cung cấp QR cho ticket valid, không cho
used/cancelled/refunded. Mã hiển thị có concert không thay ID hoặc payload QR.
Check-in chuyển valid → used bằng cập nhật có điều kiện, không cho sử dụng hai lần.

## 4. Công thức tính các chỉ số Dashboard

### 4.1. Quy ước và nguồn

Nguồn backend: [admin.py](../backend/app/services/admin.py), hai API
`GET /api/admin/stats` và `GET /api/admin/stats/concerts`. Nguồn trình bày:
[dashboard.js](../js/dashboard.js). Đặt P là tập order payment_status=paid, V là
tập ticket status valid/used, C là toàn bộ concert. Thống kê toàn hệ thống không
có bộ lọc khoảng ngày. Tổng rỗng bằng 0. Không JOIN nhiều quan hệ 1-n rồi SUM gây
nhân bản số tiền; backend tổng hợp độc lập trước khi ghép theo concert.

### 4.2. Chỉ số và ý nghĩa nghiệp vụ

| Chỉ số | Công thức và nguồn dữ liệu | Lọc, tác động hủy/hoàn/thất bại | Ý nghĩa |
| --- | --- | --- | --- |
| Total Revenue | Σ(o.total_amount − o.refund_amount), o thuộc P; bảng orders | Chỉ payment_status=paid, không lọc order.status riêng. Hoàn toàn phần đổi payment_status sang refunded nên bị loại; unpaid/failed không tính | Tiền ghi nhận còn giữ lại trong mô phỏng, không phải tiền ngân hàng đã đối soát |
| Tickets Sold | COUNT(V), bảng tickets.status | Gồm valid/used, loại refunded/cancelled; hold không tính. Không lọc payment_status trực tiếp | Số vé đã phát hành còn hiệu lực, kể cả đã dùng |
| Total Orders | COUNT(orders.id) | Mọi trạng thái, kể cả hủy/hoàn/failed; reservation chưa có order không tính | Quy mô hồ sơ đơn hàng, không phải số giao dịch thành công |
| Total Concerts | COUNT(concerts.id) | Mọi trạng thái catalogue; hủy đơn không làm giảm số concert | Quy mô catalogue |
| Upcoming Concerts | COUNT(concerts) với starts_at > now() và status on_sale/sold_out | Loại draft/cancelled/completed và concert đã bắt đầu; không lọc order | Số sự kiện công khai chưa bắt đầu |
| Check-ins Today | COUNT(tickets) với status used và checked_in_at ≥ date_trunc('day',now()) | Theo timezone PostgreSQL; query chỉ có cận dưới, không loại timestamp tương lai. Vé đã dùng chặn hủy đơn | Số vé đã check-in kể từ nửa đêm theo query hiện tại, không phải tổng lượt quét |
| Doanh thu concert c | Σ(o.total_amount − o.refund_amount) với o thuộc P, o.concert_id=c.id | Cùng quy tắc doanh thu chung; concert không có khoản hợp lệ trả 0 | Đóng góp doanh thu của từng sự kiện |
| Vé bán concert c | COUNT(V với concert_id=c.id) | Loại ticket refunded/cancelled, không dùng seats.status sold để thay thế | Cơ sở tính tiến độ bán của concert |
| Capacity concert c | Σ(zones.capacity với concert_id=c.id) | Không phụ thuộc trạng thái order; concert chưa có zone trả 0 | Sức chứa cấu hình của cả Standing và Seated |
| CheckedIn concert c | COUNT(tickets với concert_id=c.id, status used) | Toàn thời gian, không giới hạn hôm nay, không lọc order trực tiếp | Số vé đã vào cửa của concert |
| Upcoming trong tháng | COUNT phần tử concert upcoming có tháng/năm starts_at bằng tháng/năm hiện tại trong trình duyệt | Lọc upcoming từ API, sau đó dùng timezone trình duyệt, không phải timezone DB | Tóm tắt sự kiện sắp tới trong tháng hiển thị |

Không diễn giải Total Revenue thành tổng tiền mọi order trừ tiền hoàn:
đơn unpaid/failed cũng có total_amount nhưng không được ghi nhận doanh thu.
Việc query có trừ refund_amount không đồng nghĩa hoàn một phần đã được triển khai.

### 4.3. Tỷ lệ bán vé và giới hạn biểu đồ

Với dữ liệu một concert từ API, frontend tính chính xác:

```text
D = max(capacity, 1)
S = min(ticketsSold, D)
Tỷ lệ hiển thị (%) = Math.round(100 × S / D)
Nhãn tickets remaining = availableInventory (API)
Nếu API cũ thiếu trường: Availability unavailable
```

Đây là tỷ lệ **vé còn hiệu lực trên sức chứa**, không phải tỷ lệ ghế đang có người
ngồi, không phải tỷ lệ inventory sold, cũng không đếm hold. Áp dụng cho cả Standing
và Seated. Hủy/hoàn làm ticketsSold giảm; failed không tăng số bán. Chặn mẫu số 0
và kẹp S là hành vi frontend, không sửa dữ liệu nguồn bất thường.

Nhãn remaining trước bản sửa #87 tính capacity − S nên bao gồm cả inventory held
và sold không gắn ticket. Bản làm việc đã chuyển sang availableInventory: available
cộng hold hết hạn, loại held còn hạn và sold. API còn trả heldInventory và
soldInventory độc lập; việc đọc không giải phóng row DB. Sai lệch gốc ghi tại
[issue #87](https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN./issues/87).
Không sửa công thức Tickets Sold để che sai lệch này.

Biểu đồ doanh thu chỉ lấy concert revenue>0, sắp giảm dần, mặc định top 5; độ dài
thanh bằng revenue/maxRevenue, không phải tỷ trọng trong tổng doanh thu. Expand
mới hiện hết danh sách có doanh thu. Upcoming hiện tối đa 4 concert; Recent Orders
mặc định 5 đơn/trang, chế độ View all lấy tối đa 100 đơn mới nhất. Không dùng số
hàng/thanh đang hiển thị làm tổng toàn hệ thống.

## 5. Kết quả đối chiếu dữ liệu

### 5.1. Phương pháp và mức độ bằng chứng

Trong Task #58 chỉ đọc source, JSON và test hiện có; không chạy seed/migration,
không tạo transaction đặt vé, không chạy lại test suite, không truy vấn database
vận hành. Các giá trị seed dưới đây được **tính lại trực tiếp từ JSON** trong lượt
viết báo cáo, không chỉ chép demoExpectations. Kết quả QA trước đó được dẫn từ
[Dashboard Metrics](dashboard-metrics.md), nơi đã ghi đối chiếu SQL/API ngày
13/11/2026 trên PostgreSQL QA riêng concertly_metrics56_test, không phải database
local đang sử dụng hoặc production. Không dùng seed làm số liệu bán vé thực tế.

### 5.2. Bảng đối chiếu

| Chỉ số | Nguồn dữ liệu | Kết quả đối chiếu | Nhận xét |
| --- | --- | --- | --- |
| Catalogue và sức chứa | seed_data.json, concerts/tiers | Tính lại: 11 concert, 33 tier, capacity 7.200; tổng từng tier bằng ticketCapacity từng concert | Trùng kết quả QA đã ghi nhận; không áp đặt lên DB đã có giao dịch mới |
| Số order và kịch bản | JSON orders; orders.status/payment_status | 14 đơn: 9 paid, 2 refunded, 1 pending, 1 failed, 1 cancelled trước thanh toán | Refunded là nhãn kịch bản/payment; DB order.status của hai đơn này là cancelled |
| Tổng tiền danh nghĩa | Giá tier × từng đơn vị vé trong 14 order JSON | 3.325 | Không phải doanh thu: gồm cả đơn chưa trả tiền, failed và đã refund |
| Tiền hoàn mô phỏng | Hai order JSON refunded | 350 | Tổng hai đơn hoàn toàn phần; không phải giao dịch ngân hàng |
| Total Revenue | JSON paid orders và giá tier; orders trong QA trước đó | Tính lại 2.510; QA SQL/API đã ghi nhận cùng giá trị | Không lấy 3.325 − 350 làm doanh thu vì còn 465 thuộc đơn không paid/refunded |
| Ticket từng phát hành | Số đơn vị vé của JSON paid/refunded, logic seed.py | 19 = 16 vé paid còn hiệu lực + 3 vé refunded | Giá trị suy ra từ seed và logic tạo ticket, không phải COUNT DB hiện tại |
| Tickets Sold | 9 order paid trong JSON; valid/used theo logic seed | 16; trong đó 2 used, 14 valid | Khớp SQL/API QA trước đó; vé refunded không tính |
| Order và chi tiết vé | test_seeded_orders_are_consistent; test_dashboard_reconciliation | QA trước đó xác nhận 11 đơn paid/refunded có total_amount bằng tổng ticket.price | Không có bảng order_items. Ba đơn chưa phát hành vé không đối chiếu tiền bằng SUM(ticket.price) |
| Sold inventory | tiers soldOut và paid tickets; kết quả QA trước đó | 656 = 640 đơn vị khóa bán demo + 16 vé valid/used | Chênh lệch 640 có chủ đích, không phải thiếu doanh thu; các tier khóa bán không tự phát hành vé |
| Ticket và tồn kho | SQL oracle trong test_dashboard_reconciliation | QA trước đó không có ticket valid/used gắn seat không sold | Không tuyên bố đã kiểm tra lại trạng thái DB hiện tại |
| Upcoming và check-in hôm nay | stats SQL/API theo thời gian DB | QA trước đó ghi nhận 10 upcoming, 0 check-in hôm nay | Giá trị động, không suy ra từ 2 used toàn thời gian; không tái xác nhận trong task này |
| Reservation và hạn giữ | reservations.py; test_checkout_after_expiry_fails_and_releases_seats; test_mixed_expiry_releases_seated_and_standing_inventory | Có triển khai và test cho expiry, trả tồn kho, chặn checkout; không tạo hold để đo lại trong task #58 | Seed orders không đại diện một phiên reservation đang active |
| Cạnh tranh và request lặp | test_mixed_admission, test_concurrency, test_checkout_is_idempotent | Có test chống giữ trùng/oversell và checkout lặp; đọc mã test, không chạy lại | Không suy ra kết quả stress test production |
| Database vận hành hiện tại | Chưa truy vấn trong task này | **Chưa xác minh được bằng dữ liệu thực tế** | Báo cáo không công bố số liệu của DB vận hành/production |

Đối chiếu lại doanh thu theo concert từ seed cho kết quả sau; concert không có
paid order vẫn được tính trong catalogue nhưng doanh thu và số bán bằng 0:

| Concert | Vé paid còn hiệu lực | Doanh thu tính từ seed |
| --- | ---: | ---: |
| c1 | 3 | 650 |
| c2 | 0 | 0 |
| c3 | 3 | 270 |
| c4 | 0 | 0 |
| c5 | 2 | 190 |
| c6 | 0 | 0 |
| c7 | 3 | 540 |
| c8 | 0 | 0 |
| c9 | 2 | 180 |
| c10 | 2 | 420 |
| c11 | 1 | 260 |
| **Tổng** | **16** | **2.510** |

### 5.3. Cách đọc bằng chứng kiểm thử

[test_dashboard_reconciliation.py](../backend/tests/test_dashboard_reconciliation.py)
chạy [SQL đối chiếu read-only](dashboard-reconciliation.sql) trong snapshot riêng,
so sánh với hai API, tổng theo concert, tiền từng đơn và quan hệ ticket/inventory.
[test_seed.py](../backend/tests/test_seed.py) kiểm tra capacity, seed không nhân đôi
và các trạng thái mẫu; [test_checkout.py](../backend/tests/test_checkout.py),
[test_orders.py](../backend/tests/test_orders.py),
[test_mixed_admission.py](../backend/tests/test_mixed_admission.py) và
[test_concurrency.py](../backend/tests/test_concurrency.py) kiểm tra các luồng liên quan.

Ở Task #56 đã chạy 194 test backend và ghi nhận đạt trong phiên QA; con số này là
bằng chứng lịch sử của lượt đó, **không phải kết quả chạy lại Task #58**. Bản thân
việc tồn tại một test không chứng minh test vừa chạy thành công. Đối chiếu số liệu
vận hành trong tương lai cần cùng mốc thời gian/snapshot; dữ liệu có thể đổi giữa
hai request API hoặc giữa API với SQL khi có giao dịch đồng thời.

## 6. Giới hạn và hướng phát triển

| Phân loại | Nội dung | Giới hạn bằng chứng/định hướng |
| --- | --- | --- |
| Đã triển khai, có bằng chứng QA trước đó | Hold 300 giây, giới hạn 6, Standing/Seated, checkout và QR, hủy/hoàn toàn phần, thống kê | Test QA không đại diện mọi tải và cấu hình; không chạy lại ở Task #58 |
| Đã triển khai, chưa kiểm chứng đầy đủ | Sweeper khi vận hành lâu dài, cạnh tranh tải lớn, dữ liệu đang thay đổi, đồng bộ timezone giữa trình duyệt và DB | Cần đánh giá vận hành/stress test riêng; không đưa chỉ tiêu hiệu năng chưa đo |
| Đã triển khai nhưng còn hạn chế | Remaining đã sửa nguồn inventory trong bản làm việc; buyer chỉ validate; giá không khóa tại hold; UI chưa có giỏ mixed nhiều hạng | Ghi nhận #87; các phần còn lại cần thống nhất nghiệp vụ trước khi mở rộng |
| Chưa triển khai | Register backend, tự cấp ghế Seated, refresh token, lưu buyer riêng/gửi email vé | Không xem giao diện demo hay trường DB dự phòng là workflow hoàn chỉnh |
| Chưa triển khai | Hủy từng vé/hoàn một phần, duyệt refund requested/rejected, tự hoàn tất cả khi concert cancelled | Luồng hiện tại chỉ hủy toàn đơn theo điều kiện và mock refund thành công |
| Ngoài phạm vi demo hiện tại | Gateway/hoàn tiền thật, webhook và đối soát ngân hàng, phí/thuế/voucher, đa tiền tệ | Cần thiết kế hợp đồng thanh toán và quy tắc tài chính trước khi triển khai |

Một số khác biệt giữa đặc tả dự kiến và implementation đã được ghi nhận:
Order Items/Payment không tồn tại như bảng riêng; cấp tự động không áp dụng cho
Seated; trạng thái enum có sẵn không đồng nghĩa workflow đã hoàn thiện. Swagger
còn thiếu mô tả error envelope thực tế, các mã lỗi nghiệp vụ và response_model đầy
đủ cho seat map/health. [API Specification](api-spec.md) đã ghi các chênh lệch này;
báo cáo không khẳng định Swagger mô tả đầy đủ tất cả hành vi runtime.

Hướng phát triển phù hợp là hoàn thiện các phần tích hợp còn thiếu, sửa nhãn tồn
kho theo inventory thực, thống nhất timezone và chính sách khóa giá, sau đó mới
mở rộng thanh toán thực và kiểm thử tải. Đây là định hướng, chưa phải kết quả đạt
được. Xác nhận liên thành viên TV1/TV2/TV3 còn chờ trong các tài liệu nguồn; không
tự ghi là đã nghiệm thu chung.

### Tài liệu tham chiếu

- [Hướng dẫn hệ thống hiện tại](README.md).
- [API Specification](api-spec.md).
- [Business Rules](business-rules.md).
- [Công thức và đối chiếu Dashboard](dashboard-metrics.md).
- [Dữ liệu mẫu](seed-data.md) và [seed_data.json](../backend/scripts/seed_data.json).


**Cập nhật sau Task #58 — sửa #87:** Phần remaining và hợp đồng inventory trong báo
cáo được đồng bộ với bản sửa hiện tại. Các số liệu/bằng chứng QA lịch sử ở mục 5
vẫn giữ đúng mốc đã ghi; không coi chúng là dữ liệu mới sau bản sửa. Chưa có đánh
giá tải hoặc nghiệm thu production cho mở rộng inventory này.

### Cập nhật review #83 sau #81 — 14/11/2026

Admin/public concert CRUD/catalogue đã tích hợp từ #81; không còn là chức năng
chưa có như giai đoạn tài liệu đầu tiên. Zone.booking_type là dữ liệu lưu ở DB,
admin chọn loại rõ ràng và đổi tên không đổi loại. Request sửa bỏ/null field giữ
loại cũ; tạo mới mặc định seated. Đổi loại khi có ticket hoặc inventory occupied
trả 409 để bảo toàn vé cũ. Database cũ cần migration tường minh, không tự áp dụng
trong startup hoặc chạy lại seed. Các số liệu seed/QA ở mục 5 vẫn là snapshot lịch
sử; không tuyên bố database vận hành đã migrate. Chi tiết triển khai và bằng chứng
review tại backend/README.md và docs/current-ui-qa.md.
