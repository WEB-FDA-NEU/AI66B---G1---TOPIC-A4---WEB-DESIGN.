# CONCERTLY — API Specification

Issue: [#53](https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN./issues/53). Nhánh soạn: `feature/trung-next`, nền code `629b5b4`. Ngày đối chiếu: 13/11/2026.

Cập nhật theo yêu cầu task #54: giới hạn hiện hành là **6 vé**, thay cho 8 vé của bản nền; xem [Business Rules, BR-03](business-rules.md). Hold active cũ quá 6 vé bị chặn checkout mới; đơn đã thanh toán giữ tương thích.

**Trạng thái: bản đối chiếu kỹ thuật với code/OpenAPI, CHỜ TV2/TV3 xác nhận trước khi chốt.** Không coi yêu cầu review liên thành viên là đã hoàn thành. Tài liệu này không triển khai thêm endpoint hoặc thay đổi backend.

## 1. Phạm vi, nguồn và quy ước

- Base URL local: `http://localhost:8000/api`. Các đường dẫn dưới đây đã gồm `/api`.
- Swagger UI: `http://localhost:8000/docs`; schema nguồn: `http://localhost:8000/openapi.json`. `/docs`, `/redoc`, `/openapi.json` là hạ tầng tài liệu, không tính endpoint nghiệp vụ.
- Có **22 cặp HTTP method/path: 20 endpoint chính + 2 alias** (`GET /api/orders`, `GET /api/tickets`). Phạm vi “khoảng 23” của issue chưa có danh sách 23 endpoint riêng được xác nhận; không tự thêm endpoint để đủ số.
- Nguồn thực thi: [routers](../backend/app/routers), [schemas.py](../backend/app/schemas.py), [deps.py](../backend/app/deps.py), [services](../backend/app/services), [error handlers](../backend/app/main.py), [schema.sql](../backend/schema.sql). Danh mục tham khảo phân công hiện có trong [report.tex — API Reference](report.tex) liệt kê 20 dòng, gộp hai alias. Report cũ chưa có `standing` và `buyer`; hợp đồng hiện hành ưu tiên code.
- JSON UTF-8 cho request/response, riêng login dùng `application/x-www-form-urlencoded`. Thời gian là string ISO 8601 có múi giờ; UUID là string. ID database là integer (khác `c1`, `c2` ở frontend). Giá/tiền là integer đơn vị nguyên, không tự suy ra currency hay chuyển đổi sang VND; API chưa có trường currency.
- Giữ nguyên snake_case/camelCase theo từng schema; không đổi `ticketId` thành `ticket_id` trong request admin check-in.
- Đường dẫn có tham số số nguyên không mặc nhiên ràng buộc >0; chỉ có giới hạn khi được nêu trong bảng input. Dữ liệu sai kiểu/giới hạn trả 422. Pydantic có coercion cho int thông thường; `StandingSelection.quantity` dùng StrictInt, `AdminCheckInRequest.ticketId` dùng StrictInt hoặc StrictStr.

## 2. Quyền và lỗi chung

| Ký hiệu | Ý nghĩa |
| --- | --- |
| Public | Không bắt buộc đăng nhập |
| L | JWT hợp lệ, tài khoản active; không chỉ riêng customer |
| O | Đăng nhập và sở hữu tài nguyên; ngoại lệ staff/admin chỉ khi endpoint ghi rõ |
| staff/admin | Role staff hoặc admin |
| admin | Chỉ admin; staff bị từ chối |

Gửi `Authorization: Bearer <access_token>`. Login trả JWT HS256, thời hạn mặc định 60 phút, có thể cấu hình qua `ACCESS_TOKEN_EXPIRE_MINUTES`. Không có API refresh/logout/register trên nhánh này; logout phía frontend xóa session local. `X-User-Id` chỉ được backend chấp nhận khi `ALLOW_DEV_USER_HEADER=1`; không dùng làm hợp đồng production và không xuất hiện trong Swagger.

Mọi endpoint có L/O/role đều có thể trả **401 `unauthenticated`** (thiếu/sai/hết hạn token, tài khoản không active), kèm `WWW-Authenticate: Bearer`. Public seat map cho phép không có token, nhưng token sai đã gửi vẫn trả 401. Endpoint có path/query/body validation có thể trả **422 `validation_error`**, bổ sung cho các lỗi riêng trong danh mục. Các lỗi kết nối DB/exception chưa xử lý có thể thành 500; không có cam kết error envelope hay retry response riêng cho lỗi ngoài dự kiến.

Envelope lỗi thực tế (không bọc success trong `data`):

```json
{"error":{"code":"seat_unavailable","message":"Some seats are no longer available.","seat_ids":[101]}}
```

Validation:

```json
{"error":{"code":"validation_error","message":"Invalid request.","fields":[{"loc":["body","buyer","email"],"msg":"Value error, Enter a valid email address."}]}}
```

`fields[].loc` là array<string> (kể cả chỉ số mảng được chuyển sang string); `msg` là string. Chi tiết lỗi nằm trực tiếp trong `error` (ví dụ `seat_ids`, `checked_in_at`), không phải một object `details`. Giá trị `message` minh họa; client nên xử lý bằng status/code.

## 3. Danh mục endpoint

Các response type tham chiếu bảng schema ở mục 4; tất cả danh sách ghi `array<T>` trả mảng JSON trực tiếp, không có phân trang envelope trừ `AdminOrderPageOut`.

### 01. `GET /api/health`

- **Mục đích:** Kiểm tra tiến trình HTTP đang hoạt động; không kiểm tra kết nối database.
- **Quyền:** Public.
- **Input:**
 Không có path/query parameter.

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `HealthOut` (mô tả từ code).
- **Lỗi chính:** Không có lỗi nghiệp vụ được khai báo. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 02. `POST /api/auth/login`

- **Mục đích:** Đăng nhập bằng email tài khoản, kiểm tra bcrypt và phát hành JWT.
- **Quyền:** Public.
- **Input:**
 Không có path/query parameter.

Body bắt buộc `application/x-www-form-urlencoded`: `Body_login_api_auth_login_post`.

- **Response thành công:** HTTP **200**, `application/json`, `TokenOut`.
- **Lỗi chính:** 401 `invalid_credentials`; 403 `account_disabled`; 422 `validation_error`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Form `username` chính là email, được trim và chuyển lowercase. `grant_type` có thể bỏ; nếu gửi phải là `password`; `scope`, `client_id`, `client_secret` là trường OAuth2 form do framework khai báo, không cấp quyền/scope riêng trong ứng dụng. Không đưa mật khẩu thật vào ví dụ.

### 03. `GET /api/auth/me`

- **Mục đích:** Thông tin tài khoản đang đăng nhập.
- **Quyền:** L.
- **Input:**
 Không có path/query parameter.

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `AuthUserOut`.
- **Lỗi chính:** 401 `unauthenticated`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 04. `GET /api/concerts/{concert_id}/seats`

- **Mục đích:** Đọc tồn kho khu vé và ghế thật; hold hết hạn được hiển thị Available ngay cả trước sweeper.
- **Quyền:** Public; JWT tùy chọn để tính held_by_me.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `concert_id` | integer | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `SeatMapOut` (mô tả từ service).
- **Lỗi chính:** 404 `not_found`; 401 `unauthenticated` nếu gửi token sai/hết hạn. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Standing trả seats=[] nhưng vẫn có available/held/sold và held_by_me_count. Seated trả toàn bộ ghế của khu. selected chỉ là trạng thái UI, không phải status trong DB/API. API này không chứa polygon/SVG hoặc vị trí x/y; các map ở js/venues chỉ là cấu hình trình bày.

### 05. `POST /api/reservations`

- **Mục đích:** Giữ ghế đánh số và/hoặc số lượng Standing trong một giao dịch, thay hold active cũ của cùng người/concert.
- **Quyền:** L.
- **Input:**
 Không có path/query parameter.

Body bắt buộc `application/json`: `HoldRequest`.

- **Response thành công:** HTTP **201**, `application/json`, `ReservationOut`.
- **Lỗi chính:** 400 `duplicate_seats`, `seat_not_found`, `seat_wrong_concert`, `zone_requires_quantity`, `zone_requires_seats`, `too_many_seats`; 404 `not_found`; 409 `seat_unavailable`, `standing_unavailable`, `concert_not_on_sale`, `sale_not_started`, `sale_ended`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Body mặc định `seat_ids=[]`, `standing=[]`; tổng `len(seat_ids)+sum(quantity)` phải từ 1 đến 6. Trùng zone Standing trả 422 ở validator; trùng seat ID trả 400. Ghế phải thuộc concert. Standing chỉ dùng zone/số lượng; Seated phải dùng seat ID. Tất cả thành công hoặc rollback. HTTP status thành công luôn 201; mỗi request tạo hold mới và hủy hold active trước đó của cùng người/concert, không phải idempotency key. TTL mặc định 300 giây (cấu hình `RESERVATION_TTL_SECONDS`).

### 06. `GET /api/reservations/{reservation_id}`

- **Mục đích:** Đọc hold của chính mình; lazy-expire hold đã hết hạn.
- **Quyền:** O.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `reservation_id` | string (uuid) | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `ReservationOut`.
- **Lỗi chính:** 404 `not_found` nếu không tồn tại hoặc thuộc người khác. Hết hạn trả 200 với status=expired, không phải 410. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Response active có các item đang giữ; GET cancelled/expired/converted trả seats=[] và total_amount=0, seconds_left=0. DELETE trả seats=[]/total_amount=0; nếu vừa hủy active, status=cancelled. Không suy ra giá đơn đã trả từ response reservation đã converted.

### 07. `DELETE /api/reservations/{reservation_id}`

- **Mục đích:** Giải phóng hold của chính mình. Lặp trên hold cancelled/expired vẫn trả 200.
- **Quyền:** O.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `reservation_id` | string (uuid) | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `ReservationOut`.
- **Lỗi chính:** 404 `not_found`; 409 `reservation_converted` nếu đã thanh toán. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Response active có các item đang giữ; GET cancelled/expired/converted trả seats=[] và total_amount=0, seconds_left=0. DELETE trả seats=[]/total_amount=0; nếu vừa hủy active, status=cancelled. Không suy ra giá đơn đã trả từ response reservation đã converted.

### 08. `POST /api/checkout`

- **Mục đích:** Thanh toán mô phỏng và phát hành order/ticket cho hold của chính mình, xác minh ghế dưới khóa DB.
- **Quyền:** O.
- **Input:**
 Không có path/query parameter.

Body bắt buộc `application/json`: `CheckoutRequest`.

- **Response thành công:** HTTP **201**, `application/json`, `OrderDetailOut`.
- **Lỗi chính:** 400 `invalid_payment_method`; 404 `not_found`; 409 `seat_unavailable`, `reservation_converted`; 410 `reservation_expired`; 400 `too_many_seats` nếu hold active cũ vượt giới hạn 6. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** `buyer` bắt buộc, trim ba trường. Name 2–150 ký tự; email ≤255 ký tự theo regex không có whitespace và có dấu chấm sau @; phone ≤30 ký tự, chỉ + ở đầu/chữ số/khoảng trắng/ngoặc/dấu -, gồm 8–15 chữ số. `payment_method`: card, ewallet, bank_transfer (schema khai báo string, giá trị khác trả 400 ở service). Buyer được validate nhưng hiện KHÔNG lưu vào order/ticket và không cập nhật account; holder_name vẫn là tên account. Thanh toán mock, không gọi ngân hàng. Gọi lại hold đã converted và có order trả cùng order, vẫn HTTP 201; request lặp vẫn phải qua auth/body validation.

### 09. `GET /api/orders`

- **Mục đích:** Alias tương thích của GET /api/orders/me; cùng bộ lọc, dữ liệu và quyền.
- **Quyền:** L.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| query | `status` | string hoặc null | Không | — |
| query | `limit` | integer | Không | minimum=1; maximum=100; default=50 |
| query | `offset` | integer | Không | minimum=0; default=0 |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, array<`OrderSummaryOut`>.
- **Lỗi chính:** Không có lỗi nghiệp vụ riêng; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 10. `GET /api/orders/me`

- **Mục đích:** Danh sách đơn của chính tài khoản, mới nhất trước (created_at, id giảm dần).
- **Quyền:** L.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| query | `status` | string hoặc null | Không | — |
| query | `limit` | integer | Không | minimum=1; maximum=100; default=50 |
| query | `offset` | integer | Không | minimum=0; default=0 |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, array<`OrderSummaryOut`>.
- **Lỗi chính:** Không có lỗi nghiệp vụ riêng; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 11. `GET /api/orders/{order_id}`

- **Mục đích:** Chi tiết đơn và các vé. Staff/admin có thể đọc đơn của người khác.
- **Quyền:** O hoặc staff/admin.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `order_id` | integer | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `OrderDetailOut`.
- **Lỗi chính:** 404 `not_found`, bao gồm người thường đọc đơn của người khác. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 12. `POST /api/orders/{order_id}/cancel`

- **Mục đích:** Chủ đơn hủy đơn và hoàn tiền toàn phần qua gateway mock; trả tồn kho.
- **Quyền:** O; staff/admin không được hủy hộ qua route này.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `order_id` | integer | Có | — |

Body tùy chọn `application/json`: `CancelRequest` hoặc null.

- **Response thành công:** HTTP **200**, `application/json`, `OrderDetailOut`.
- **Lỗi chính:** 404 `not_found`; 409 `already_cancelled`, `order_not_cancellable`, `ticket_used`, `cancel_window_closed`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Body có thể bỏ hoặc null; reason tùy chọn/null, tối đa 500 ký tự. Chỉ pending/paid, chưa có vé used. Thông thường phải còn HƠN 24 giờ tới concert (bằng 24 giờ cũng bị chặn). Concert cancelled được bỏ qua cut-off nhưng vẫn áp dụng các điều kiện khác. Đơn paid chuyển payment_status/refund_status sang refunded, order.status=cancelled, ticket.status=refunded; đơn chưa paid thì vé cancelled. `can_cancel` dùng cùng quy tắc cửa sổ hủy với cancel API, có xét ngoại lệ concert cancelled và vẫn chặn đơn không pending/paid hoặc có vé used. Đây là gợi ý nghiệp vụ, không cấp quyền hủy hộ; endpoint cancel kiểm tra chủ đơn và xác minh lại dưới khóa.

### 13. `GET /api/tickets`

- **Mục đích:** Alias tương thích của GET /api/tickets/me.
- **Quyền:** L.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| query | `status` | string hoặc null | Không | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, array<`TicketOut`>.
- **Lỗi chính:** Không có lỗi nghiệp vụ riêng; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 14. `GET /api/tickets/me`

- **Mục đích:** Vé của chính tài khoản, sắp theo starts_at và ticket id tăng dần.
- **Quyền:** L.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| query | `status` | string hoặc null | Không | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, array<`TicketOut`>.
- **Lỗi chính:** Không có lỗi nghiệp vụ riêng; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 15. `POST /api/tickets/check-in`

- **Mục đích:** Staff/admin quét ticket_code; chuyển valid sang used bằng UPDATE có điều kiện. Không nhận concertId.
- **Quyền:** staff/admin.
- **Input:**
 Không có path/query parameter.

Body bắt buộc `application/json`: `CheckInRequest`.

- **Response thành công:** HTTP **200**, `application/json`, `TicketOut`.
- **Lỗi chính:** 403 `forbidden`; 404 `not_found`; 409 `ticket_already_used` (kèm checked_in_at), `ticket_not_valid`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 16. `GET /api/tickets/{ticket_id}`

- **Mục đích:** Chi tiết vé, tên chủ vé và SVG QR; staff/admin có thể đọc vé người khác.
- **Quyền:** O hoặc staff/admin.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `ticket_id` | integer | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `TicketDetailOut`.
- **Lỗi chính:** 404 `not_found`, bao gồm người thường đọc vé của người khác. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** qr_data=ticket_code và qr_image là SVG data URI khi status=valid. Khi used/cancelled/refunded, cả hai null. Không thay payload QR bằng mã hiển thị có tiền tố concert.

### 17. `GET /api/admin/stats`

- **Mục đích:** Thống kê toàn hệ thống.
- **Quyền:** admin.
- **Input:**
 Không có path/query parameter.

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `AdminStatsOut`.
- **Lỗi chính:** 403 `forbidden`; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** totalRevenue = tổng total_amount − refund_amount với payment_status=paid; ticketsSold đếm valid/used; totalOrders đếm mọi order; upcomingConcerts chỉ on_sale/sold_out và starts_at tương lai. checkinsToday dùng nửa đêm theo múi giờ DB.

### 18. `GET /api/admin/stats/concerts`

- **Mục đích:** Thống kê từng concert, sắp starts_at/id tăng dần.
- **Quyền:** admin.
- **Input:**
 Không có path/query parameter.

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, array<`AdminConcertStatsOut`>.
- **Lỗi chính:** 403 `forbidden`; áp dụng lỗi chung. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** Cùng quy tắc doanh thu/vé bán như thống kê chung. capacity là tổng capacity các zone; upcoming cần cả starts_at tương lai và status on_sale/sold_out.

### 19. `GET /api/admin/orders`

- **Mục đích:** Tìm/lọc danh sách đơn của toàn hệ thống, phân trang theo page.
- **Quyền:** admin.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| query | `status` | string hoặc null | Không | — |
| query | `concert_id` | integer hoặc null | Không | — |
| query | `q` | string hoặc null | Không | — |
| query | `page` | integer | Không | minimum=1; default=1 |
| query | `page_size` | integer | Không | minimum=1; maximum=100; default=20 |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `AdminOrderPageOut`.
- **Lỗi chính:** 403 `forbidden`; áp dụng lỗi chung. Bộ lọc không khớp trả trang rỗng, không trả 404. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** `status=refunded` lọc payment_status=refunded, không phải order.status. `q` tìm order_number (không phải id), email/tên khách, title/artist; bỏ khoảng trắng và # đầu, tìm không phân biệt hoa thường. `%` và `_` được escape thành ký tự thường. Sắp created_at/id giảm dần. `pages=0` nếu không có kết quả; `page` vượt cuối trả items=[] và giữ page đã yêu cầu.

### 20. `GET /api/admin/orders/{order_id}`

- **Mục đích:** Chi tiết đơn bất kỳ và thông tin khách hàng.
- **Quyền:** admin.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `order_id` | integer | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `AdminOrderDetailOut`.
- **Lỗi chính:** 403 `forbidden`; 404 `not_found`. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 21. `GET /api/admin/concerts/{concert_id}/attendees`

- **Mục đích:** Danh sách vé valid/used của concert và thống kê check-in; không gồm cancelled/refunded.
- **Quyền:** admin.
- **Input:**

| Vị trí | Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- | --- |
| path | `concert_id` | integer | Có | — |

Không có request body.

- **Response thành công:** HTTP **200**, `application/json`, `AttendeeListOut`.
- **Lỗi chính:** 403 `forbidden`; 404 `not_found` nếu concert không tồn tại. Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

### 22. `POST /api/admin/checkin`

- **Mục đích:** Quét ở cổng concert cụ thể, nhận ID vé hoặc mã QR. Chống check-in trùng nguyên tử.
- **Quyền:** admin.
- **Input:**
 Không có path/query parameter.

Body bắt buộc `application/json`: `AdminCheckInRequest`.

- **Response thành công:** HTTP **200**, `application/json`, `AttendeeOut`.
- **Lỗi chính:** 400 `wrong_concert` (ticket_concert_id), `ticket_not_valid` (ticket_status); 403 `forbidden`; 404 `not_found`; 409 `ticket_already_used` (checked_in_at). Áp dụng thêm lỗi chung ở mục 2 khi phù hợp.

**Lưu ý hợp đồng:** `ticketId` nhận integer ID, string số (cũng được hiểu là ID) hoặc string mã ticket 1–64 ký tự sau trim. ID số âm/0/quá BIGINT không tìm thấy trả 404, không tràn DB. `concertId` ≥1. Dùng mã QR gốc, không gửi chuỗi có tiền tố hiển thị C01. Khác route /tickets/check-in: route admin kiểm tra concert tại cổng, và vé cancelled/refunded trả 400 thay vì 409.

## 4. Cấu trúc dữ liệu

`null` khác với thiếu field. Cột Bắt buộc phản ánh schema Pydantic/OpenAPI: “Không” nghĩa là có default/có thể bị bỏ khi validate; response do serializer hiện tại thường vẫn gửi các field đó với null/default. Các trạng thái được khai báo là string trong OpenAPI, không phải enum schema; giá trị DB liệt kê ở mục 5.

### HealthOut

```json
{"status":"ok"}
```

### SeatMapOut (service không khai báo response_model)

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| concert_id | integer | ID concert |
| status | string | Trạng thái concert |
| zones | array<ZoneAvailability> | Khu vé theo zone.id tăng dần |

`ZoneAvailability`:

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| id | integer | Zone ID dùng trong standing[].zone_id |
| name | string | Tên hạng vé |
| price | integer | Giá một vé |
| color | string hoặc null | Màu zone từ DB |
| booking_type | string | standing hoặc seated |
| available, held, sold | integer | Ba field đếm riêng biệt, đều ≥0 |
| held_by_me_count | integer | Hold chưa hết hạn thuộc người đang gọi, 0 nếu anonymous |
| seats | array<SeatAvailability> | [] với Standing; toàn bộ ghế với Seated |

`SeatAvailability`:

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| id | integer | Seat ID thật dùng trong seat_ids |
| row | string | Hàng, ví dụ A |
| number | integer | Số ghế (khác tên seat_number trong response vé/reservation) |
| status | string | available, held, sold; held hết hạn hiển thị available |
| held_by_me | boolean | true khi hold còn hạn và thuộc người gọi |

Các bảng sau lấy tên trường/kiểu/required/default trực tiếp từ OpenAPI đang chạy. Mỗi trường được liệt kê riêng, không tự đổi tên hoặc suy ra thêm dữ liệu.

### AdminCheckInRequest

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `ticketId` | integer hoặc string | Có | — |
| `concertId` | integer | Có | minimum=1.0 |

### AdminConcertStatsOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `starts_at` | string (date-time) | Có | — |
| `status` | string | Có | — |
| `upcoming` | boolean | Có | — |
| `capacity` | integer | Có | — |
| `ticketsSold` | integer | Có | — |
| `checkedIn` | integer | Có | — |
| `revenue` | integer | Có | — |

### AdminOrderDetailOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `order_number` | integer | Có | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `starts_at` | string (date-time) | Có | — |
| `total_amount` | integer | Có | — |
| `status` | string | Có | — |
| `payment_method` | string hoặc null | Không | — |
| `payment_status` | string | Có | — |
| `refund_status` | string | Có | — |
| `ticket_count` | integer | Có | — |
| `created_at` | string (date-time) | Có | — |
| `reservation_id` | string (uuid) hoặc null | Không | — |
| `payment_ref` | string hoặc null | Không | — |
| `paid_at` | string (date-time) hoặc null | Không | — |
| `refund_amount` | integer | Có | — |
| `refund_reason` | string hoặc null | Không | — |
| `refunded_at` | string (date-time) hoặc null | Không | — |
| `can_cancel` | boolean | Có | — |
| `tickets` | array<`TicketOut`> | Có | — |
| `customer` | `CustomerDetailOut` | Có | — |

### AdminOrderPageOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `items` | array<`AdminOrderSummaryOut`> | Có | — |
| `total` | integer | Có | — |
| `page` | integer | Có | — |
| `page_size` | integer | Có | — |
| `pages` | integer | Có | — |

### AdminOrderSummaryOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `order_number` | integer | Có | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `starts_at` | string (date-time) | Có | — |
| `total_amount` | integer | Có | — |
| `status` | string | Có | — |
| `payment_method` | string hoặc null | Không | — |
| `payment_status` | string | Có | — |
| `refund_status` | string | Có | — |
| `ticket_count` | integer | Có | — |
| `created_at` | string (date-time) | Có | — |
| `customer` | `CustomerOut` | Có | — |

### AdminStatsOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `totalConcerts` | integer | Có | — |
| `ticketsSold` | integer | Có | — |
| `totalOrders` | integer | Có | — |
| `totalRevenue` | integer | Có | — |
| `upcomingConcerts` | integer | Có | — |
| `checkinsToday` | integer | Có | — |

### AttendeeConcertOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `title` | string | Có | — |
| `venue` | string | Có | — |
| `starts_at` | string (date-time) | Có | — |
| `status` | string | Có | — |

### AttendeeListOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `concert` | `AttendeeConcertOut` | Có | — |
| `total` | integer | Có | — |
| `checked_in` | integer | Có | — |
| `not_checked_in` | integer | Có | — |
| `items` | array<`AttendeeOut`> | Có | — |

### AttendeeOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `ticket_id` | integer | Có | — |
| `ticket_code` | string | Có | — |
| `status` | string | Có | — |
| `checked_in` | boolean | Có | — |
| `checked_in_at` | string (date-time) hoặc null | Không | — |
| `zone` | string | Có | — |
| `row` | string hoặc null | Có | — |
| `seat_number` | integer hoặc null | Có | — |
| `booking_type` | string | Không | default="seated" |
| `price` | integer | Có | — |
| `order_id` | integer | Có | — |
| `order_number` | integer | Có | — |
| `customer` | `CustomerOut` | Có | — |

### AuthUserOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `email` | string | Có | — |
| `full_name` | string | Có | — |
| `phone` | string hoặc null | Không | — |
| `role` | string | Có | — |

### Body_login_api_auth_login_post

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `grant_type` | string hoặc null | Không | — |
| `username` | string | Có | — |
| `password` | string (password) | Có | — |
| `scope` | string | Không | default="" |
| `client_id` | string hoặc null | Không | — |
| `client_secret` | string hoặc null | Không | — |

### BuyerInformation

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `full_name` | string | Có | minLength=2; maxLength=150 |
| `email` | string | Có | maxLength=255 |
| `phone` | string | Có | maxLength=30 |

### CancelRequest

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `reason` | string hoặc null | Không | — |

### CheckInRequest

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `ticket_code` | string | Có | minLength=1; maxLength=64 |

### CheckoutRequest

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `reservation_id` | string (uuid) | Có | — |
| `payment_method` | string | Có | — |
| `buyer` | `BuyerInformation` | Có | — |

### CustomerDetailOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `email` | string | Có | — |
| `full_name` | string | Có | — |
| `phone` | string hoặc null | Không | — |

### CustomerOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `email` | string | Có | — |
| `full_name` | string | Có | — |

### HoldRequest

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `concert_id` | integer | Có | — |
| `seat_ids` | array<integer> | Không | maxItems=6 |
| `standing` | array<`StandingSelection`> | Không | maxItems=6 |

### OrderDetailOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `order_number` | integer | Có | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `starts_at` | string (date-time) | Có | — |
| `total_amount` | integer | Có | — |
| `status` | string | Có | — |
| `payment_method` | string hoặc null | Không | — |
| `payment_status` | string | Có | — |
| `refund_status` | string | Có | — |
| `ticket_count` | integer | Có | — |
| `created_at` | string (date-time) | Có | — |
| `reservation_id` | string (uuid) hoặc null | Không | — |
| `payment_ref` | string hoặc null | Không | — |
| `paid_at` | string (date-time) hoặc null | Không | — |
| `refund_amount` | integer | Có | — |
| `refund_reason` | string hoặc null | Không | — |
| `refunded_at` | string (date-time) hoặc null | Không | — |
| `can_cancel` | boolean | Có | — |
| `tickets` | array<`TicketOut`> | Có | — |

### OrderSummaryOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `order_number` | integer | Có | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `starts_at` | string (date-time) | Có | — |
| `total_amount` | integer | Có | — |
| `status` | string | Có | — |
| `payment_method` | string hoặc null | Không | — |
| `payment_status` | string | Có | — |
| `refund_status` | string | Có | — |
| `ticket_count` | integer | Có | — |
| `created_at` | string (date-time) | Có | — |

### ReservationOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | string (uuid) | Có | — |
| `concert_id` | integer | Có | — |
| `status` | string | Có | — |
| `expires_at` | string (date-time) | Có | — |
| `seconds_left` | integer | Có | — |
| `total_amount` | integer | Có | — |
| `seats` | array<`SeatOut`> | Có | — |

### SeatOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `zone_id` | integer | Có | — |
| `zone_name` | string | Có | — |
| `row_label` | string hoặc null | Có | — |
| `seat_number` | integer hoặc null | Có | — |
| `price` | integer | Có | — |
| `booking_type` | string | Không | default="seated" |

### StandingSelection

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `zone_id` | integer | Có | minimum=1.0 |
| `quantity` | integer | Có | minimum=1.0; maximum=6.0 |

### TicketDetailOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `ticket_code` | string | Có | — |
| `order_id` | integer | Có | — |
| `order_number` | integer hoặc null | Không | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `starts_at` | string (date-time) | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `zone` | string | Có | — |
| `row` | string hoặc null | Có | — |
| `seat_number` | integer hoặc null | Có | — |
| `booking_type` | string | Không | default="seated" |
| `price` | integer | Có | — |
| `status` | string | Có | — |
| `checked_in_at` | string (date-time) hoặc null | Không | — |
| `qr_data` | string hoặc null | Không | — |
| `holder_name` | string | Có | — |
| `qr_image` | string hoặc null | Không | — |

### TicketOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `id` | integer | Có | — |
| `ticket_code` | string | Có | — |
| `order_id` | integer | Có | — |
| `order_number` | integer hoặc null | Không | — |
| `concert_id` | integer | Có | — |
| `concert_title` | string | Có | — |
| `artist` | string | Có | — |
| `venue` | string | Có | — |
| `city` | string | Có | — |
| `starts_at` | string (date-time) | Có | — |
| `poster_url` | string hoặc null | Không | — |
| `zone` | string | Có | — |
| `row` | string hoặc null | Có | — |
| `seat_number` | integer hoặc null | Có | — |
| `booking_type` | string | Không | default="seated" |
| `price` | integer | Có | — |
| `status` | string | Có | — |
| `checked_in_at` | string (date-time) hoặc null | Không | — |
| `qr_data` | string hoặc null | Không | — |

### TokenOut

| Trường | Kiểu | Bắt buộc | Giới hạn / mặc định |
| --- | --- | --- | --- |
| `access_token` | string | Có | — |
| `token_type` | string | Không | default="bearer" |
| `user` | `AuthUserOut` | Có | — |

## 5. Giá trị trạng thái và ví dụ tích hợp

| Tài nguyên / field | Giá trị trong DB/hợp đồng |
| --- | --- |
| Concert.status | draft, on_sale, sold_out, cancelled, completed |
| Seat.status | available, held, sold |
| Reservation.status | active, converted, expired, cancelled |
| Order.status | pending, paid, cancelled, failed |
| Order.payment_status | unpaid, paid, failed, refunded |
| Order.refund_status | none, requested, refunded, rejected |
| Ticket.status | valid, used, cancelled, refunded |
| booking_type | standing, seated |

Mỗi list filter chỉ nhận các giá trị trong input bảng endpoint, không tự dùng mọi trạng thái DB cho mọi filter. `/orders/me?status=refunded` trả 422; chỉ admin/orders có filter refunded đặc biệt.

Ví dụ request minh họa, ID/UUID phải thay bằng dữ liệu từ API thật:

```http
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

username=buyer%40example.com&password=<YOUR_PASSWORD>
```

Seated:

```json
{"concert_id":1,"seat_ids":[101,102]}
```

Standing:

```json
{"concert_id":1,"standing":[{"zone_id":3,"quantity":2}]}
```

Mixed (chỉ dùng nếu các ID đều đúng concert và đúng loại):

```json
{"concert_id":1,"seat_ids":[101],"standing":[{"zone_id":3,"quantity":2}]}
```

Checkout:

```json
{"reservation_id":"00000000-0000-4000-8000-000000000001","payment_method":"card","buyer":{"full_name":"Demo Buyer","email":"buyer@example.com","phone":"0912345678"}}
```

Admin check-in (mã minh họa, không phải QR có hiệu lực):

```json
{"ticketId":"CTL-EXAMPLE-NOT-A-REAL-TICKET","concertId":1}
```

Luồng: đọc seat map → POST reservations (201) → lưu id/expires_at, đồng bộ GET reservation/seconds_left → POST checkout → GET order/ticket. Hết hạn phải chọn lại; không khởi động lại TTL chỉ bằng reload frontend. Hai người giữ một ghế: chỉ một request thành công, request còn lại 409. Không dùng localStorage mock thay cho order/vé thật.

## 6. Đối chiếu Swagger và phần chưa có

Đã đối chiếu đầy đủ 22 method/path, tham số, request schema và response_model với `/openapi.json` (nguồn của `/docs`) và mã nguồn cùng nhánh. Có các khác biệt thực tế cần TV2/TV3 thống nhất trước khi chốt:

| Điểm | Swagger hiện tại | Thực thi / cách đọc spec này |
| --- | --- | --- |
| Lỗi nghiệp vụ | Hầu hết chỉ khai báo success và 422; không có responses cho 400/401/403/404/409/410 | Danh sách code/status ở mục 3 lấy từ dependencies/services; KHÔNG khẳng định Swagger đã khai báo chúng |
| Validation 422 | Schema mặc định HTTPValidationError, shape detail[] | Handler trả error.code/message/fields như mục 2 |
| Seat map và health | Response schema object rỗng | Shape cụ thể ở mục 4 lấy từ service/main; cần response_model nếu muốn Swagger tự mô tả |
| Auth optional ở seat map | Có HTTPBearer security metadata | Dependency cho phép anonymous; token sai vẫn 401 |
| Buyer | Có schema bắt buộc | Validate nhưng không lưu buyer contact vào order; cần thống nhất nếu yêu cầu lưu thông tin người mua |
| Scope khoảng 23 endpoint | 22 operations / 20 canonical | Chờ danh sách phân công gốc/TV2/TV3 xác nhận số lượng; không tự dựng endpoint thứ 23 |

Không có route register/refresh/logout, public concert list/detail hay admin concert CRUD trong OpenAPI/code nhánh này. Một số màn hình tương ứng còn dùng dữ liệu frontend/mock. Đó là phần chưa tích hợp, không phải API đã triển khai. Khi các PR auth/concert khác được tích hợp phải cập nhật spec theo route/schema thực tế, không lấy bản thiết kế dự kiến làm hợp đồng đang chạy.

## 7. Review TV2/TV3 và quy trình cập nhật

| Hạng mục đối chiếu | Người/nhóm cần xác nhận | Trạng thái |
| --- | --- | --- |
| Seat map, reservation, TTL/6 vé, checkout/buyer, order/ticket và check-in | TV2 (theo phân công hiện có; xác nhận lại đầu mối) | Chờ xác nhận |
| Auth, endpoint concert/chưa tích hợp và scope khoảng 23 endpoint | TV3 (theo phân công hiện có; xác nhận lại đầu mối) | Chờ xác nhận |
| Hai hợp đồng check-in khác nhau và quyền admin/staff | TV2/TV3 và bên tích hợp Admin | Chờ thống nhất |
| Bổ sung schema lỗi thực tế/seat map vào Swagger | Chủ backend TV2/TV3 | Chờ quyết định; task docs không tự sửa backend |
| Chốt bản tích hợp (ngày, commit, người duyệt) | TV2 + TV3 | Chưa chốt |

Chưa liên hệ hoặc gửi tin nhắn thay người dùng; không ghi nhận đã được duyệt khi chưa có bằng chứng. Có thể dùng bảng này làm checklist review trên PR của task #53. Phần viết/đối chiếu kỹ thuật đã làm; acceptance “bản chốt trước tích hợp” còn phụ thuộc xác nhận liên thành viên.

Khi hợp đồng thay đổi:

1. Chủ endpoint cập nhật route/Pydantic model/error code và test nghiệp vụ trong cùng thay đổi.
2. Sinh OpenAPI từ source và đọc `/openapi.json` của server đã chạy đúng commit; so method/path, query/body, required/nullable/default, success/status và schema.
3. Cập nhật mục endpoint, model, quyền, lỗi, ví dụ, alias và bảng chênh lệch trong file này; không giữ field cũ như đã hỗ trợ nếu backend đã bỏ.
4. Chạy test hợp đồng phù hợp trên database QA riêng nếu có thay đổi runtime. Task chỉ tài liệu thì kiểm tra coverage/schema không cần tạo hold, order hoặc reset DB.
5. Ghi người TV2/TV3 đã xác nhận, ngày và commit chốt vào bảng review, rồi mới đánh dấu acceptance cuối hoàn thành.

### Checklist nghiệm thu

- [x] Bao phủ mọi endpoint thực có: 22 method/path (gồm 2 alias).
- [x] Method/path, field/type và success schema đối chiếu với code/OpenAPI.
- [x] Quyền, request/response và các mã lỗi chính cho từng endpoint.
- [x] Nêu rõ chênh lệch giữa Swagger và handler/service, không giả ghi là đã khớp hoàn toàn.
- [ ] TV2/TV3 xác nhận phạm vi khoảng 23 và những API chưa tích hợp.
- [ ] Backend/TV2/TV3 thống nhất các chênh lệch Swagger nêu ở mục 6.
- [ ] Ghi nhận bản chốt trước tích hợp diện rộng.
