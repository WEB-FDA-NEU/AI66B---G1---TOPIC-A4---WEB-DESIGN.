# CONCERTLY — Business Rules

Issue: [#54](https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN./issues/54). Soạn trên `feature/trung-business-rules`, tách từ `feature/trung-next` tại `f7b9008`, đối chiếu ngày 13/11/2026. Hợp đồng endpoint/field: [api-spec.md](api-spec.md).

**Trạng thái: đã đối chiếu kỹ thuật, CHỜ TV2 xác nhận trước khi chốt.** Backend đã có triển khai trên nhánh hiện tại; tài liệu này ghi nhận đúng hành vi đó, không khẳng định đã thống nhất với TV2 trước khi triển khai. Không thay đổi UI/backend/database để tự áp dụng một chính sách mới.

## 1. Phạm vi và thuật ngữ

- **Concert:** sự kiện; **zone:** hạng/khu vé thuộc concert.
- **Seated:** người mua chọn từng seat ID; hàng/số ghế giữ theo dữ liệu PostgreSQL.
- **Standing:** chọn zone và số lượng, không gán hàng/số ghế công khai. Các bản ghi seats cũ được dùng như đơn vị tồn kho nội bộ.
- **Selection:** lựa chọn trên trình duyệt, chưa phải giữ chỗ. **Reservation:** giữ tồn kho có thời hạn trên server. **Order:** bản ghi mua/thanh toán. **Ticket:** quyền vào cửa được phát hành sau checkout.
- **Đã triển khai:** được xác nhận từ route/service/schema hoặc UI hiện có. **Đề xuất/chờ quyết định:** không được coi là chính sách đang áp dụng. **Ngoài phạm vi:** không có luồng thực thi hoàn chỉnh trên nhánh này, kể cả khi DB đã dự phòng trạng thái.
- Backend quyết định tính hợp lệ giao dịch; dữ liệu hiển thị/đồng hồ/localStorage không thay thế kiểm tra server. Thời gian nghiệp vụ dùng đồng hồ PostgreSQL; ID order/ticket và payload QR gốc phải giữ tương thích.

## 2. Giữ chỗ và số lượng

### BR-01 — Điều kiện mở bán [đã triển khai]

Tạo reservation chỉ thành công nếu concert tồn tại, `status=on_sale`, chưa trước `sale_start_at` (nếu có), chưa quá `sale_end_at` (nếu có), và `now < starts_at`. Tại đúng `starts_at` đã kết thúc bán. Code chặn `now > sale_end_at`; không tự đổi thành điều kiện `>=` trong tài liệu.

Lỗi chính: 404 `not_found`; 409 `concert_not_on_sale`, `sale_not_started`, `sale_ended`. Đọc seat map không đồng nghĩa được mua: concert có thể còn tồn kho nhưng ngoài thời gian mở bán.

### BR-02 — Thời hạn giữ chỗ 5 phút [đã triển khai]

- Mặc định `expires_at = thời điểm DB sau khi lấy khóa + 300 giây`. Thời gian đợi khóa không được trừ vào 5 phút mới cấp.
- Hold chỉ hợp lệ khi `status=active` và `now < expires_at`; tại đúng deadline đã hết hạn. Ghế còn phải ở trạng thái held, thuộc chính reservation và `held_until > now` khi checkout.
- Hết hạn được áp dụng ngay khi kiểm tra nghiệp vụ/đọc khả dụng; sweeper chạy mặc định mỗi 30 giây để giải phóng dữ liệu stale. Không có thêm 30 giây ân hạn.
- GET reservation có thể đánh dấu expired và trả 200 với `seconds_left=0`, `seats=[]`, `total_amount=0`. Checkout hold hết hạn trả 410 `reservation_expired`; không tạo order/ticket mới.
- Reload trang hoặc đọc hold không gia hạn deadline. Gửi yêu cầu giữ mới là một giao dịch thay thế hold theo BR-04, không phải gia hạn âm thầm của ID cũ.
- `RESERVATION_TTL_SECONDS` cho phép backend cấu hình khác 300; UI hiện dùng hằng 5 phút và giới hạn countdown tối đa 5 phút. Chính sách triển khai đồng bộ hiện tại là **300 giây**. Muốn thay đổi TTL phải thống nhất và cập nhật cả backend, UI, test, API spec; không chỉ sửa biến môi trường.

### BR-03 — Tối đa 6 vé mỗi reservation [đã triển khai theo yêu cầu người dùng]

Công thức kiểm tra:

```text
1 <= len(seat_ids) + sum(standing[].quantity) <= 6
```

- Seated, Standing hoặc mixed đều tính chung trong giới hạn 6 của một reservation/checkout.
- `standing[].quantity` là số nguyên nghiêm ngặt 1–6; không nhận số thập phân, boolean hoặc chuỗi số ở field này. Không được lặp zone Standing; seat ID không được trùng.
- UI chặn chọn quá 6; request API vẫn tự validate, không tin giới hạn từ client. Body tổng 0 hoặc >6 trả 422 `validation_error`; các lớp service còn có kiểm tra bảo vệ và lỗi 400 tương ứng.
- Giới hạn là **mỗi reservation**, không phải tổng số vé suốt đời tài khoản/concert. Chưa có quota cộng dồn theo ngày/tài khoản.
- Theo yêu cầu người dùng, giới hạn đã đổi từ 8 xuống **6 vé** ở config, validator, UI và test. Issue #54 đề xuất 6; TV2 vẫn cần review/xác nhận bản chốt. Đơn/vé đã thanh toán trước thay đổi giữ nguyên; hold active cũ 7–8 vé không được checkout mới, cần chọn lại tối đa 6.

### BR-04 — Quyền giữ và thay thế hold [đã triển khai]

Phải đăng nhập bằng tài khoản active. Mỗi người giữ tối đa một reservation active cho cùng concert qua luồng giữ vé hiện tại. Hold mới thành công hủy hold active cũ của người đó/concert đó và trả tồn kho cũ trước khi gán tập vé mới. Nếu yêu cầu mới thất bại, giao dịch rollback, không được làm mất hold cũ chỉ vì thử chọn ghế không hợp lệ.

Không áp dụng giới hạn “chỉ một hold toàn hệ thống”: các concert khác nhau có thể có hold riêng. Người khác không được đọc/xóa/checkout reservation không thuộc mình; API trả 404 để tránh lộ tài nguyên.

### BR-05 — Loại vé, tồn kho và chống trùng [đã triển khai]

- Seated yêu cầu `seat_ids` có thật, thuộc concert và khu Seated. Standing yêu cầu `standing: [{zone_id, quantity}]` với zone đúng concert/loại.
- Không dùng ID tồn kho Standing để giả chọn ghế đánh số; không dùng số lượng để mua khu Seated.
- Chỉ available, hold đã hết hạn hoặc tồn kho thuộc hold cũ đang được thay thế của chính người gọi mới có thể được cấp theo giao dịch tương ứng. Vé sold không được cấp lại trừ khi đơn hủy đã trả tồn kho.
- Tạo hold là all-or-nothing. Khóa hàng theo thứ tự ID và giao dịch DB bảo vệ khỏi bán trùng; unique index bảo vệ một ghế chỉ có tối đa một ticket active (valid/used).
- Tranh một ghế: chỉ một bên giữ thành công; bên còn lại 409 `seat_unavailable`. Standing thiếu sức chứa trả 409 `standing_unavailable`. UI cần cập nhật khả dụng, không tự tạo vé thay thế/mock khi API lỗi.
- Seat map là snapshot: available lúc xem không bảo đảm vẫn còn lúc giữ. Selected chỉ là trạng thái UI, không phải trạng thái DB.

## 3. Thanh toán và giá

### BR-06 — Checkout hợp lệ [đã triển khai]

Chỉ chủ reservation được checkout. HTTP request phải có `reservation_id`, `payment_method`, `buyer.full_name/email/phone`; áp dụng validation như [API Specification](api-spec.md). Các phương thức hỗ trợ là `card`, `ewallet`, `bank_transfer`.

`buyer` được validate nhưng **chưa lưu thành thông tin người mua riêng trên order/ticket**; tên chủ vé hiện lấy từ account. Không suy diễn rằng email/phone nhập ở checkout đã cập nhật hồ sơ tài khoản hay là địa chỉ nhận email giao vé.

Countdown UI đồng bộ từ reservation, cảnh báo khi còn ≤60 giây và ngăn submit sau deadline. Khi request thanh toán đang chạy, backend kiểm tra thời hạn dưới khóa và quyết định kết quả; UI không tự tuyên bố thất bại chỉ vì đồng hồ chạm 0 giữa request.

### BR-07 — Tổng tiền, phí, giảm giá [đã triển khai + ngoài phạm vi]

```text
Tổng tiền thanh toán = tổng Zone.price của mọi đơn vị vé thuộc reservation
Phí bổ sung áp dụng hiện tại = 0
Giảm giá áp dụng hiện tại = 0
```

- Backend tính lại giá từ DB ở checkout; không nhận `total`, `fees`, `discount` hoặc giá vé do client gửi như nguồn quyết định số tiền.
- Hold không lưu snapshot giá cố định trong reservation; hiện chưa có cam kết khóa giá 5 phút nếu dữ liệu zone thay đổi. Cần TV2 xác nhận trước khi bổ sung nghiệp vụ khóa giá.
- Giá/tiền là số nguyên trong API, cột NUMERIC nguyên đơn vị trong DB. Giao diện hiển thị `$`, nhưng API chưa có trường currency; không tự khẳng định đã hỗ trợ đa tiền tệ hay quy đổi VND.
- Checkout API không có chính sách phí/discount riêng; bản lưu local tương thích và demo đặt `fees=0`, `discount=0`. Đây không phải một engine tính phí hoặc mã ưu đãi đã triển khai.
- Voucher, phần trăm giảm, ưu đãi theo số lượng, thuế/phí dịch vụ, phí hủy, thanh toán một phần và tách đơn: ngoài phạm vi luồng hiện tại. Muốn thêm phải xác định công thức, thứ tự làm tròn, currency và cách hoàn phí/discount với TV2.

### BR-08 — Giao dịch thanh toán và chống lặp [đã triển khai, mock gateway]

Checkout thành công tạo order paid, payment_status=paid, phát hành một ticket valid cho mỗi đơn vị vé, chuyển tồn kho sang sold và reservation sang converted trong một transaction.

Gọi lại checkout cho cùng reservation đã converted và có order trả về chính order đó, không thu tiền/phát hành lần hai; HTTP vẫn 201 theo API hiện tại. Request lặp vẫn phải qua auth và validation. Đây là idempotency theo reservation, chưa phải hỗ trợ header idempotency key tổng quát.

Gateway là **mô phỏng**, chưa có ngân hàng, webhook, 3-D Secure, retry gateway thực hoặc xác nhận giao dịch tiền thật. Không được mô tả order paid trong demo là bằng chứng tiền đã chuyển ngoài hệ thống.

## 4. Vòng đời

### BR-09 — Reservation [đã triển khai]

| Từ | Sang | Sự kiện | Tồn kho |
| --- | --- | --- | --- |
| Chưa có | active | Giữ vé thành công, HTTP 201 | available → held |
| active | cancelled | Chủ động DELETE hoặc thay bằng hold mới thành công | held của hold cũ được trả |
| active | expired | Hết TTL, xử lý lazy hoặc sweeper | held hết hạn → available |
| active | converted | Checkout thành công | held → sold; tạo order/tickets |

Không có luồng đưa cùng reservation cancelled/expired về active. DELETE hold cancelled/expired có tính lặp an toàn, nhưng DELETE converted trả 409 `reservation_converted`. Khi hủy order sau thanh toán, reservation cũ vẫn converted; không quay thành active/expired.

### BR-10 — Order, payment và refund là ba trục khác nhau

| Field | Trạng thái DB hợp lệ | Luồng hiện thực |
| --- | --- | --- |
| order.status | pending, paid, cancelled, failed | Checkout mock tạo thẳng paid; hủy hợp lệ → cancelled |
| payment_status | unpaid, paid, failed, refunded | Checkout mock → paid; hủy đơn đã paid → refunded |
| refund_status | none, requested, refunded, rejected | Mặc định none; hủy paid hợp lệ → refunded |

`pending/failed/unpaid/requested/rejected` tồn tại ở schema và các nhánh xử lý dữ liệu, **không đồng nghĩa có API đầy đủ tạo payment pending, xác nhận payment failed hay duyệt/từ chối hoàn tiền**. Không vẽ các chuyển trạng thái chưa có như tính năng đã hoàn thành.

Đơn được hủy sau khi thanh toán có `order.status=cancelled` nhưng `payment_status=refunded`, `refund_status=refunded`. UI có thể hiển thị nhãn **Refunded** theo refund_status; nhãn đó không thay đổi order.status thành một enum refunded. API danh sách đơn cá nhân không nhận filter status=refunded; admin có filter refunded đặc biệt theo payment_status.

### BR-11 — Ticket và QR [đã triển khai]

| Từ | Sang | Điều kiện |
| --- | --- | --- |
| Chưa có | valid | Checkout thành công |
| valid | used | Staff/admin check-in hợp lệ, chỉ thành công một lần |
| valid | refunded | Hủy order đã paid, hoàn toàn phần thành công qua mock |
| valid | cancelled | Nhánh hủy đơn chưa paid/dữ liệu pending tương ứng |

Vé used chặn hủy toàn đơn, kể cả concert cancelled; không có tự động hoàn vé đã dùng. Không có luồng reset used về valid. QR data là ticket_code gốc khi valid; QR data/image null khi used/cancelled/refunded. Tiền tố concert trên UI là nhãn hiển thị, không sửa payload QR, ID hoặc mã cũ.

`/tickets/check-in` nhận ticket_code, cho staff/admin, không đối chiếu concert ở cổng. `/admin/checkin` chỉ admin, nhận ticketId (ID hoặc code) và concertId, kiểm tra đúng concert. Hai endpoint có khác biệt mã lỗi như API spec; không suy ra staff được gọi mọi API /admin.

## 5. Hủy đơn và hoàn tiền

### BR-12 — Điều kiện hủy qua API [đã triển khai]

Tất cả các điều kiện sau phải đúng:

1. Caller là chủ đơn; staff/admin không có quyền hủy hộ qua route cancel hiện tại.
2. Order tồn tại, chưa cancelled và status thuộc pending hoặc paid.
3. Không ticket nào trong đơn có status used.
4. Nếu concert **không cancelled**: `starts_at - now > 24 giờ`.
5. Nếu concert **cancelled**: được bỏ qua điều kiện 24 giờ, vẫn phải thỏa các điều kiện 1–3.

Tại đúng 24 giờ: không được hủy theo cửa sổ thông thường. So sánh dựa trên thời gian DB, không dùng giờ máy người dùng. Ví dụ concert bắt đầu 20:00 ngày 20/11: hủy trước 20:00 ngày 19/11 được xét; đúng hoặc sau mốc đó bị chặn nếu concert không cancelled.

Hủy là **toàn đơn**, không có hủy từng vé hoặc hoàn một phần. `reason` tùy chọn/null, tối đa 500 ký tự. Lỗi chính: 404 `not_found`; 409 `already_cancelled`, `order_not_cancellable`, `ticket_used`, `cancel_window_closed`. Gọi lại hủy đơn cancelled trả 409, không hoàn tiền lần hai.

### BR-13 — Hoàn tiền [đã triển khai, mock]

- Đơn payment_status=paid đủ điều kiện hủy được hoàn **100% total_amount**. Không trừ phí hủy/khấu trừ mới.
- Sau thành công: order cancelled, payment_status/refund_status refunded; refund_amount=total_amount, refunded_at được ghi, vé chuyển refunded và tồn kho sold của đơn được trả available.
- Đơn pending chưa thanh toán có thể bị hủy theo cùng điều kiện nhưng không tạo khoản tiền hoàn mới; vé chuyển cancelled nếu không có trạng thái refund đã hoàn từ dữ liệu trước đó.
- Nếu concert đang sold_out, trả tồn kho từ hủy đơn sẽ mở lại status on_sale. Concert cancelled không được tự mở bán lại.
- Không có cron tự hủy/hoàn toàn bộ đơn chỉ vì concert bị đánh dấu cancelled: hiện chủ đơn phải gọi cancel API. Mock refund luôn thành công; không có SLA hoàn tiền vào ngân hàng, xử lý thất bại hay approval workflow thực.

### BR-14 — Đồng bộ giao diện và API hủy [đã triển khai]

UI Order Detail dùng `order.can_cancel` để hiện nút Cancel order, xin xác nhận trước khi gọi API; nếu đơn paid, lời xác nhận nêu hoàn toàn bộ tiền. UI hiển thị refund_amount và trạng thái mock refund từ response, không tự đổi trạng thái order chỉ ở local.

`can_cancel` và cancel API dùng chung hàm `cancellation_window_open`: concert cancelled được miễn cut-off, các concert khác phải còn >24 giờ. Cả hai vẫn chặn trạng thái order không pending/paid và vé used. Điểm lệch từng ghi nhận giữa API và UI đã được sửa theo yêu cầu người dùng.

UI có sẵn cơ chế đọc `order.can_cancel`; không cần sửa layout hay tự tính lại thời gian trên trình duyệt. API kiểm tra lại quyền chủ đơn và dữ liệu dưới khóa; can_cancel không thay thế kiểm tra quyền. Cạnh biên đúng 24 giờ, concert cancelled (kể cả sau starts_at), vé đã used và caller không phải chủ đơn được kiểm tra bằng test dịch vụ/API.

## 6. Tình huống đối chiếu

| Tình huống | Kết quả theo code hiện tại |
| --- | --- |
| Giữ 1–6 vé hợp lệ | 201, active, TTL mặc định 300 giây |
| API yêu cầu tổng 7, 8, 9 vé hoặc 0 vé | 422 validation_error |
| Mua đúng 6 vé | Hợp lệ nếu đủ tồn kho và thỏa điều kiện mở bán |
| Hai người giữ cùng seat | Một thành công, bên còn lại 409; không cấp đôi |
| Reload hold còn 2 phút | Deadline cũ, không cấp lại 5 phút chỉ vì reload |
| Checkout đúng deadline/hết hạn | 410 reservation_expired, không order mới |
| Checkout lặp reservation đã converted | Cùng order, không thêm ticket mới |
| Đơn paid, chưa dùng vé, còn >24 giờ | Có thể hủy; mock refund toàn phần, trả tồn kho |
| Đơn paid, đúng/còn <24 giờ, concert không cancelled | 409 cancel_window_closed |
| Concert cancelled, chưa dùng vé, còn <24 giờ | API cho phép và can_cancel=true; UI hiện nút cho chủ đơn (BR-14) |
| Có một vé used trong đơn | Hủy toàn đơn bị chặn, kể cả concert cancelled |
| Hủy lại đơn cancelled | 409 already_cancelled, không hoàn thêm |
| Giả giá/giảm giá ở frontend | Backend không dùng số tiền client làm tổng thanh toán |
| API unavailable | UI chặn mua thật; không phát hành QR/order server bằng mock |

## 7. Ngoài phạm vi và chờ TV2

| Hạng mục | Tình trạng |
| --- | --- |
| Giới hạn 6 vé | Đã cập nhật theo yêu cầu người dùng; chờ TV2 review bản chốt |
| Đồng bộ ngoại lệ cancelled concert giữa can_cancel/API/UI | Đã sửa và kiểm thử theo chính sách API hiện có; chờ TV2 review bản chốt |
| TTL khác 5 phút hoặc gia hạn giữ chỗ | Chưa phải chính sách đồng bộ frontend/backend |
| Khóa giá khi tạo reservation | Chưa có snapshot giá; cần quyết định nếu bổ sung |
| Phí, thuế, voucher/discount | Không có engine; phí/giảm hiện áp dụng bằng 0 |
| Gateway và refund tiền thật, SLA ngân hàng, webhook | Ngoài phạm vi demo hiện tại |
| Hủy một phần, đổi ghế/đổi concert/chuyển nhượng vé | Không có luồng hiện hành |
| Tự hoàn toàn bộ khi concert cancelled | Chưa có workflow tự động |
| Duyệt refund requested/rejected | Schema có trạng thái, chưa có API workflow tương ứng |
| Lưu buyer riêng, gửi email vé, quota vé cộng dồn | Chưa triển khai trong luồng hiện tại |

## 8. Nguồn đối chiếu và bằng chứng

| Quy tắc | Backend / dữ liệu | API / UI / kiểm thử liên quan |
| --- | --- | --- |
| BR-01–05 | [config.py](../backend/app/config.py), [reservations.py](../backend/app/services/reservations.py), [seatmap.py](../backend/app/services/seatmap.py), [schema.sql](../backend/schema.sql) | [schemas.py](../backend/app/schemas.py), [tickets.js](../js/tickets.js), [test_mixed_admission.py](../backend/tests/test_mixed_admission.py) |
| BR-06–08 | [checkout.py](../backend/app/services/checkout.py), [schemas.py](../backend/app/schemas.py) | [checkout.js](../js/checkout.js), [components.js](../js/components.js), [test_checkout.py](../backend/tests/test_checkout.py), [test_checkout_contract.py](../tests/test_checkout_contract.py) |
| BR-09–11 | [orders.py](../backend/app/services/orders.py), [checkin.py](../backend/app/services/checkin.py), [schema.sql](../backend/schema.sql) | [api-spec.md](api-spec.md), [test_orders.py](../backend/tests/test_orders.py) |
| BR-12–14 | [orders.py: can_cancel/cancel_order](../backend/app/services/orders.py) | [me.js](../js/me.js), [order-detail.html](../pages/me/order-detail.html), [test_orders.py](../backend/tests/test_orders.py) |

Các test được nêu để truy vết hành vi, không khẳng định mọi trường hợp biên trong tài liệu đã có test riêng. Khi sửa chính sách cần bổ sung ca biên tương ứng, đặc biệt đúng TTL, đúng 24 giờ, cancelled concert, vé used và request lặp.

## 9. Checklist chốt với TV2

- [x] Viết rõ thời gian giữ, giới hạn vé, vòng đời, hủy/hoàn tiền, phí/giảm giá và phạm vi triển khai.
- [x] Đối chiếu source, API Specification và UI; ghi rõ điểm khác thay vì mô tả hai chính sách như cùng có hiệu lực.
- [ ] TV2 review giới hạn 6 vé đã được người dùng yêu cầu triển khai (ghi người xác nhận/ngày/commit).
- [x] Đồng bộ ngoại lệ cancelled concert giữa can_cancel/API/UI; giữ chặn vé used, đơn đã đóng và caller không phải chủ đơn.
- [ ] TV2 review/xác nhận chính sách hủy/hoàn và bản chốt.
- [ ] Xác nhận currency/khóa giá và giữ phí/giảm giá bằng 0 trong phạm vi hiện tại.
- [ ] Ghi nhận người duyệt và bản chốt trước lần tích hợp tiếp theo.

Chưa có xác nhận TV2 trong issue tại thời điểm soạn. Tài liệu không tự gửi tin nhắn, không tự coi đã được duyệt. Mọi thay đổi chính sách sau này phải cập nhật cùng lúc config/validator/service, hợp đồng API, UI và các test liên quan; không chỉ sửa con số trong tài liệu.


## 10. Kết quả kiểm chứng bản làm việc

- 178 test backend đạt trên PostgreSQL QA mới riêng: gồm giới hạn 6/7/8, giữ tương thích đơn cũ, biên >24 giờ/đúng 24 giờ/<24 giờ, concert cancelled kể cả sau giờ diễn, chặn chủ thể khác, vé used và đơn đã đóng.
- Chrome chạy trực tiếp đạt 40 lượt responsive và 13 luồng, gồm trường hợp mới: concert cancelled còn 1 giờ → API can_cancel=true → nút hủy xuất hiện → hủy/hoàn toàn phần qua mock → can_cancel=false/nút biến mất → hủy lặp bị từ chối.
- 17 test JavaScript và 5 test checkout/11 subtest đạt trong quá trình triển khai giới hạn 6 vé.
- Không sửa HTML/CSS cho phần đồng bộ hủy; không reset hoặc thay đổi dữ liệu database ứng dụng. Các giao dịch kiểm thử dùng database QA riêng.
- Phần triển khai/đối chiếu kỹ thuật của task đã hoàn tất; xác nhận TV2 là bước review bên ngoài, chưa được giả đánh dấu hoàn thành.
