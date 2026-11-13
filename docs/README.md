# CONCERTLY — Hướng dẫn hệ thống

Tài liệu này mô tả cách sử dụng, luồng nghiệp vụ và giới hạn của Concertly. Hệ
thống hỗ trợ đặt vé lưu trong PostgreSQL; thanh toán và hoàn tiền hiện chỉ mô
phỏng, không giao dịch tiền thật. Các tính năng chưa được hỗ trợ được ghi rõ tại
từng phần.

## 1. Tài liệu và nguồn dữ liệu

- [API Specification](api-spec.md): 30 cặp method/path, quyền, input, response và lỗi.
- [Business Rules](business-rules.md): giới hạn 6 vé, giữ chỗ và hủy/hoàn tiền.
- [Dashboard Metrics](dashboard-metrics.md): công thức và kết quả đối chiếu số liệu QA.
- [Seed Data](seed-data.md): dữ liệu demo; không tự seed lại database đang sử dụng.
- [Standing/Seated](standing-seated.md): phân loại demo, không khẳng định sơ đồ concert thực.
- [UI và QA hiện hành](current-ui-qa.md): ghi nhận kiểm thử trước đây, không thay thế
  source/OpenAPI hiện tại. Các báo cáo Seat Map khác là lịch sử triển khai.

Home/Explore/Detail lấy catalogue public từ API qua
[js/public-catalog.js](../js/public-catalog.js), ghép với dữ liệu trình bày trong
[js/mock-data.js](../js/mock-data.js). API lỗi có thể hiển thị preview local;
preview không bảo đảm được mua vé. Hình venue/polygon nằm trong
[js/venues](../js/venues). Tồn kho, reservation, order, ticket và quyền truy cập
trong luồng API lấy từ PostgreSQL. Giá và trạng thái để đặt vé phải dựa trên API,
không xem nội dung catalogue tĩnh là tồn kho trực tiếp.

Backend mặc định được frontend gọi tại `http://localhost:8000/api`; script
[js/api.js](../js/api.js) cho phép override bằng `window.CONCERTLY_API_BASE`.
Swagger tại `http://localhost:8000/docs`, schema tại `/openapi.json`.
Tài liệu này không yêu cầu thay cấu hình hoặc khởi động lại backend đang chạy.

## 2. Đăng ký, đăng nhập và phiên người dùng

### Đăng ký: hiện chỉ là giao diện demo

Trang [Register](../pages/auth/register.html) nhận họ tên, email, mật khẩu và xác
nhận mật khẩu. Handler kiểm tra hai mật khẩu trùng nhau, lưu tên vào localStorage
`concertlyUser` rồi chuyển sang Login. **Không gửi API, không lưu tài khoản hay mật
khẩu vào PostgreSQL.** Thông báo “Account registered successfully!” hiện không
chứng minh đã tạo tài khoản có thể đăng nhập. Chưa có API register; đây là phần
cần developer tích hợp, không hướng dẫn người dùng đăng ký như chức năng hoàn tất.

### Đăng nhập: đã tích hợp API

1. Dùng tài khoản đã tồn tại trong PostgreSQL và đang active, do người quản lý
   môi trường cung cấp. Không dùng tên vừa lưu ở Register như một tài khoản thật.
2. Mở [Login](../pages/auth/login.html), nhập email và mật khẩu của mình.
3. Frontend gửi `POST /api/auth/login`, Content-Type
   `application/x-www-form-urlencoded`, trường `username` là email, cùng `password`.
4. Backend trim/lowercase email, kiểm tra hash bcrypt. Sai thông tin trả
   401 `invalid_credentials`; đúng mật khẩu nhưng tài khoản inactive trả
   403 `account_disabled`.
5. Thành công trả JWT và thông tin user. Frontend lưu token trong localStorage,
   gửi `Authorization: Bearer ...` ở các request sau. Admin được chuyển tới Dashboard;
   người dùng khác về Home hoặc đường dẫn redirect cùng origin.

JWT HS256 có hạn mặc định 60 phút, cấu hình được. `GET /api/auth/me` lấy thông tin
người dùng hiện tại. Endpoint yêu cầu đăng nhập trả 401 khi token hết hạn/không hợp
lệ hoặc tài khoản không active. Khi thấy “Your session has expired”, đăng nhập lại
trên cùng origin frontend rồi thử tải availability; phiên đăng nhập và thời hạn giữ
vé là hai cơ chế riêng. Không có refresh token, API logout, đổi/quên mật khẩu hay
xác minh email. Logout ở frontend xóa phiên local, không thu hồi JWT đã phát hành.
Không đưa mật khẩu hoặc token thật vào tài liệu hay ảnh báo lỗi.

## 3. Chọn hạng vé và ghế

Luồng hiện tại: Home/Explore → Concert → [Seat Selection](../pages/concerts/tickets.html)
(với query `id` của concert, ví dụ `?id=c1`) → chọn hạng/khu → Continue Payment.
Trang cần catalogue demo tương ứng và dữ liệu concert/zone trong backend.

- **Standing:** chọn khu và số lượng, không chọn số ghế. Khi bấm Continue Payment,
  frontend gửi `standing: [{zone_id, quantity}]` đến `POST /api/reservations`.
  Backend khóa tồn kho và tự chọn đủ đơn vị inventory khả dụng theo ID tăng dần.
  Đây là **cấp tồn kho tự động cho vé đứng**, không phải cấp ghế ngồi đánh số.
  Hàng/số nội bộ không hiển thị trên vé Standing (API trả null).
- **Seated:** chọn hạng/khu, click ghế cụ thể để chọn/bỏ chọn. Available có thể chọn;
  Selected chỉ là trạng thái UI; Held và Sold không phải ghế trống. Frontend gửi các
  `seat_ids` đã chọn, backend giữ đúng các ID nếu còn khả dụng. **Chưa có API chọn
  hạng + số lượng để tự cấp ghế Seated, cũng chưa có cam kết ghế liền nhau.**
- Tổng tối đa **6 vé/lần giữ và mua**. API nhận cả Seated + Standing trong cùng
  một request, tổng vẫn tối đa 6. UI hiện gửi một loại/hạng đang chọn mỗi lần;
  không suy ra rằng UI đã có giỏ hàng mixed nhiều hạng.
- Venue SVG/polygon là cách trình bày frontend; không tạo seat ID hoặc thay thế
  availability trong PostgreSQL. Các khu chưa xác định rõ giữ phân loại đã cấu hình.
- Chỉ click chọn ở UI chưa giữ chỗ. Hold được tạo khi Continue Payment thành công
  (HTTP 201). Hai người tranh cùng một ghế không thể cùng giữ thành công; người
  thua phải cập nhật và chọn lại.
- Nếu API tải tồn kho thất bại, trang báo lỗi và có Retry availability; không cho
  đặt thật và không tự chuyển sang mock để giả thành công.

## 4. Giữ chỗ 5 phút

Backend mặc định TTL 300 giây (`RESERVATION_TTL_SECONDS` có thể override). Mốc
`expires_at` được tạo theo đồng hồ PostgreSQL sau khi lấy khóa; checkout đọc
reservation và đồng bộ `seconds_left`. Reload không khởi tạo lại 5 phút.
Mỗi user/concert có tối đa một hold active: tạo hold mới thành công thay hold cũ.

Hết hạn: backend từ chối checkout với 410 `reservation_expired`; hold không còn
quyền mua. Seat map coi hold hết hạn là Available ngay cả khi chưa cập nhật row DB.
Việc cập nhật DB được thực hiện khi truy cập các luồng xử lý expiry hoặc bởi sweeper
mỗi 30 giây (nếu không bị tắt), theo batch và khóa DB; không cam kết row chuyển
trạng thái đúng từng mili giây tại phút thứ 5.

Frontend vô hiệu hóa thanh toán, xóa checkoutData, chuyển tới
[Session Expired](../pages/checkout/session-expired.html) và cố gắng gọi release;
release có thể thất bại do mất mạng, backend vẫn kiểm tra hạn độc lập. Người dùng
phải chọn lại vé. Không coi hết JWT là đồng nghĩa hết hold, hoặc đăng nhập lại là
gia hạn hold. `DELETE /api/reservations/{id}` hủy hold của chính mình; hold đã
converted không được release qua API này.

## 5. Checkout và thanh toán mô phỏng

### Luồng API có lưu PostgreSQL

1. Sau khi giữ chỗ, mở [Checkout](../pages/checkout/index.html). Trang tải lại
   reservation, số vé, khu/hàng/số ghế (Seated) hoặc khu/số lượng (Standing), giá và tổng tiền.
2. Nhập họ tên, email, điện thoại. Backend trim các trường; tên 2–150 ký tự,
   email đúng regex của dự án và tối đa 255 ký tự, điện thoại 8–15 chữ số với
   ký tự định dạng cho phép. Thông tin thiếu/sai bị từ chối, xem schema trong API spec.
3. Chọn `card`, `ewallet` hoặc `bank_transfer`, rồi xác nhận trước khi hết hạn.
   Đây chỉ là nhãn phương thức: không thu thập thông tin thẻ, gọi ngân hàng hay ví thật.
4. `POST /api/checkout` kiểm tra chủ reservation, hạn và tồn kho dưới khóa DB,
   tạo order paid, ticket valid, chuyển inventory sold và reservation converted.
   Tổng tiền lấy giá zone tại thời điểm checkout, không tin tổng frontend gửi lên.
5. Thành công chuyển tới Order Detail; xem vé trong My Tickets. Gọi lại checkout
   cho cùng reservation đã converted trả cùng order, không tạo đơn/vé trùng.

Buyer bắt buộc để validate nhưng **chưa lưu contact vào order/ticket**, không cập
nhật account; tên chủ vé vẫn lấy từ account. Phí/giảm giá hiện bằng 0; chưa có coupon,
cổng thanh toán, webhook, đối soát ngân hàng hay hoàn tiền thật.

### Nhánh demo local còn trong checkout.js

Nếu checkoutData không có reservationId, checkout xử lý một phiên demo local:
validate thông tin, tối đa 6 vé, countdown 5 phút lưu qua reload, lưu kết quả demo
trong trình duyệt. **Không tạo order PostgreSQL, không giữ ghế thật, không phát
hành QR vào cửa.** Luồng chọn vé hiện tại bắt buộc API, không fallback vào nhánh
này khi backend lỗi. Không dùng archive local làm bằng chứng thanh toán/nhận vé thật.

## 6. Vé, đơn hàng, hủy và check-in

My Tickets và Orders đọc `/api/tickets/me`, `/api/orders/me`; chi tiết đọc bằng ID
backend. Seated hiển thị khu/hàng/số ghế, Standing không có số ghế được gán.
QR của vé valid chứa ticket_code gốc; khi used/cancelled/refunded, API không cung
cấp QR vào cửa. Mã hiển thị có concert không thay payload QR hoặc ID database.

Chủ đơn có thể hủy đơn pending/paid chưa có vé used, thông thường phải còn **hơn
24 giờ** đến concert. Concert cancelled bỏ qua cửa sổ 24 giờ, vẫn phải đáp ứng các
điều kiện còn lại. UI đọc can_cancel, API xác minh lại. Đơn paid đủ điều kiện được
hoàn toàn phần bằng mock, chuyển order cancelled, payment/refund refunded,
ticket refunded và trả inventory. Chưa có quy trình duyệt hoàn tiền thủ công/hoàn
một phần. Chi tiết tại [Business Rules](business-rules.md).

Admin Dashboard, danh sách/chi tiết đơn và check-in đã gọi API. Các endpoint
`/api/admin/*` chỉ cho admin, staff trả 403. Route `/api/tickets/check-in` cho
staff/admin nhận ticket_code; `/api/admin/checkin` chỉ admin, nhận ticketId và
concertId, kiểm tra đúng concert và chặn check-in trùng.

**Quản lý concert/khu/giá** có API CRUD, upload ảnh, public catalogue list/detail
và form Admin lưu PostgreSQL. Admin chọn Standing/Seated
tại mỗi hạng vé; đổi tên không đổi loại. Thiếu booking_type trên request sửa giữ
loại cũ; khu mới mặc định Seated. Đổi loại khi có ticket hoặc inventory occupied
trả 409 `booking_type_has_bookings`. Database cũ cần migration tường minh trước khi
chạy code mới, xem [backend README](../backend/README.md). Dashboard tính vé còn
lại từ tồn kho available, không tính hold còn hiệu lực và vé đã bán.

## 7. Phạm vi và giới hạn

- Đăng ký tài khoản hiện chỉ là giao diện demo; chưa tạo tài khoản trong PostgreSQL.
- Ghế Seated được chọn theo số ghế cụ thể; chưa có API tự cấp ghế theo số lượng
  hoặc bảo đảm các ghế được xếp liền nhau.
- Giao dịch thanh toán, hoàn tiền, coupon, webhook và đối soát với ngân hàng chưa
  được tích hợp.
- Nhánh checkout chỉ lưu trong trình duyệt là dữ liệu demo, không tạo order hoặc
  vé có QR hợp lệ trong PostgreSQL.
- Sơ đồ venue là cấu hình hiển thị trên frontend; loại vé và tồn kho có thẩm quyền
  được lưu ở backend/database.

Loại vé Standing/Seated được lưu trong `zones.booking_type`. Tệp JSON chỉ dùng để
khởi tạo dữ liệu seed; việc đổi tên khu không làm thay đổi loại vé. Khi triển khai
code mới lên database đã tồn tại, cần kiểm tra và áp dụng migration phù hợp trước
khi chạy ứng dụng. Xem [hướng dẫn backend](../backend/README.md) và
[hướng dẫn triển khai](deploy.md).
