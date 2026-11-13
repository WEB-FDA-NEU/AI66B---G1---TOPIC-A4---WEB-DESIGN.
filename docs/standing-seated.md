# Standing và Seated — cấu hình demo CONCERTLY

Triển khai trên `feature/trung`. Đây là cấu hình demo của dự án, không khẳng định sơ đồ chỗ ngồi thực tế của concert.

## Phân loại đầy đủ

| Concert | Nghệ sĩ | Khu Seated | Khu giữ Standing |
| --- | --- | --- | --- |
| c1 | Ariana Grande | Standard Tier 1; Standard Tier 2 | VIP Diamond Experience |
| c2 | The Weeknd | Cat 1 Seated | General Admission Standing; VIP After Hours Lounge |
| c3 | Travis Scott | Balcony Seating | Floor Standing Mosh; Cactus Jack VIP Pass |
| c4 | Jennie | Lower Bowl Seated | General Floor Standing; OA VIP Soundcheck Package |
| c5 | Lisa | Tier 1 Center Seated | Rockstar Standing Zone; LLOUD Ultimate VIP Meet & Greet |
| c6 | Taylor Swift | Lower Bowl Reserved | Standard Floor GA; Karma Is My Boyfriend VIP |
| c7 | Bruno Mars | Silver Tribune | Gold Standing Pit; 24K Magic VIP Experience |
| c8 | Justin Bieber | Không có | General Admission; Belieber Standing Pit; Ghost VIP Lounge |
| c9 | BTS | CAT 3 Seating | Soundcheck Standing; ARMY Ultimate VIP Pass |
| c10 | G-Dragon | Standard Tier | Coup D'Etat Pit; One of a Kind VIP |
| c11 | Cortis | Balcony Seated; Front Row Orchestra | Midnight VIP Pass |

Có 10 concert hỗ trợ Seated và Standing cùng hệ thống; c8 chỉ Standing. C1/c10 được cấu hình Seated theo xác nhận của người dùng. Các hạng VIP/Lounge/Meet & Greet chưa được xác nhận là Seated giữ kiểu chọn khu/số lượng.

Khả năng mua vẫn tuân theo trạng thái và lịch mở bán hiện tại của từng concert; cấu hình Seated không tự mở lại concert đã kết thúc hay khu đã hết vé.

Nguồn phân loại backend: `backend/app/venue_zones.json`. Cả 11 file `js/venues/c*-map.js` có metadata `bookingType` tương ứng. Test kiểm tra tên và loại của mọi section với cấu hình backend. Bản phân loại ban đầu chỉ thêm metadata. Bản sửa hiển thị theo shape sau đó điều chỉnh riêng polygon CENTER PREMIUM ở c1/c5/c6 cho cạnh gần sân khấu rộng hơn; xem `seat-map-geometry.md`. Hình dạng các khu Standing giữ nguyên.

Các mảnh SVG cùng tên hạng vé cùng trỏ tới một zone trong database. Phần hiển thị chia tập ghế có sẵn giữa các mảnh theo diện tích, không lặp seat ID và không tạo thêm sức chứa. Đây là phân bổ demo ở frontend; database chưa lưu mảnh SVG/toạ độ vật lý của từng ghế.

## Hành vi

- **Standing:** chọn khu, tăng/giảm số lượng 1–8; không mở lưới ghế. Backend tự giữ các đơn vị tồn kho trong khu, không gán hàng/số ghế cho người mua.
- **Seated:** bấm khu để mở lưới ghế riêng A/B/C… và 1/2/3…; chọn hoặc bỏ chọn từng ghế, tối đa 8. Available, Selected, Held và Sold có nhãn, màu và trạng thái nút riêng. Ghế của người khác đang Held hoặc đã Sold bị khóa. Ghế do chính tài khoản giữ vẫn có thể chọn lại.
- Venue Overview luôn hiện; chỉ một section ghế chi tiết được mở bên dưới, giữ bố cục gốc và preview. Sơ đồ chi tiết tự vừa khung; +/− phóng/thu, Reset seats khôi phục toàn vùng. Không có nút Change zone/Larger seats hoặc bản chọn nháp riêng giữa các hạng. Đổi section cùng hạng giữ seat ID; đổi hạng bắt đầu lựa chọn mới. Xem `current-ui-qa.md`.
- Lỗi API chặn tiếp tục, có nút thử lại; không sinh ghế giả, không chuyển sang mua mock. Các checkout demo đã lưu từ phiên bản cũ chỉ còn được đọc như biên nhận demo, không phát hành vé vào cửa.
- Checkout hiển thị khu/hàng/số ghế/giá cho Seated; Standing gộp theo khu, số lượng và đơn giá. Mỗi vé Standing trong Ticket Detail đại diện một lượt vào cửa, không có số ghế.
- UI mua theo từng khu như trước. API có thể nhận đồng thời `seat_ids` và `standing` trong một reservation, với tổng tối đa 8 vé.

## Backend, database và tương thích

Không thay đổi `schema.sql`, không ALTER/DROP database, không chạy seed hoặc sửa dữ liệu trên database thật.

Các bản ghi `seats` có sẵn ở khu Standing được tái sử dụng làm đơn vị tồn kho nội bộ, không phải ghế gán cho khách. Giữ nguyên khóa chính, ràng buộc duy nhất, ticket/order cũ và payload QR. Không cần migration. Dữ liệu hàng/số ghế cũ vẫn còn nguyên trong PostgreSQL; API chỉ không hiển thị chúng cho Standing.

`Zone.booking_type` là thuộc tính đọc từ cấu hình, không phải cột mới. Zone cũ ngoài 11 concert chưa có cấu hình tiếp tục hợp đồng numbered-seat trước đó, tránh tự đổi dữ liệu không rõ nguồn.

`POST /api/reservations` chấp nhận:

```json
{
  "concert_id": 1,
  "seat_ids": [123],
  "standing": [{"zone_id": 3, "quantity": 2}]
}
```

ID chỉ là ví dụ; lấy ID thật từ API. Một request thành công toàn bộ hoặc rollback. Không cho dùng ID tồn kho Standing để giả chọn ghế, không cho mua Seated chỉ bằng số lượng. Bộ khóa theo thứ tự ID, khóa thay thế hold theo người/concert và unique index vé active bảo vệ khỏi bán trùng. Standing dùng cùng cơ chế giữ 5 phút, giải phóng hết hạn và chuyển Sold sau thanh toán. Check-in/QR và hoàn tiền tiếp tục dùng nghiệp vụ cũ.

## Kiểm thử

Database kiểm thử mới riêng, không dùng database của dự án. PostgreSQL 16, FastAPI và Chrome headless chạy thực tế.

- Toàn bộ backend: **162 test pass**, gồm tương thích cũ và test mới cho hai loại vé.
- Frontend: **17 kịch bản JavaScript pass**, kiểm tra cú pháp Python/JavaScript, tài nguyên HTML và cấu trúc CSS.
- Schema checkout: **5 test, 10 subtest pass**.
- Hồi quy trình duyệt chung: **40/40 lượt responsive pass**, không có JavaScript exception; bộ test đã cập nhật để dùng reservation thật cho checkout và chặn fallback mock.
- `tests/mixed_admission_browser.py`: đối chiếu cả 11 concert; chọn/bỏ ghế, giới hạn 8, zoom/cuộn, Standing không có số ghế tại **320/375/390/768/1024px**; mua thật qua database cho cả Standing và Seated, QR tải thành công.
- Test tranh chấp: hai người đặt cùng ghế chỉ một người thành công; khu Standing không vượt capacity.
- Held của người khác hiển thị khóa; request tranh ghế trả 409. Hết hạn trở lại Available; thanh toán thành công trở thành Sold và không chọn lại được.
- Mixed reservation phát hành cả hai loại vé trong cùng đơn; hủy đơn trả lại cả hai loại tồn kho; mã QR gốc tiếp tục check-in.

Chạy test database bằng `TEST_DATABASE_URL` trỏ tới database dùng một lần có tên chứa `test`. Fixture của bộ test cũ reset schema trong chính database dùng một lần đó, không được dùng database thật.

Artifact Chrome nằm tại `/private/tmp/concertly-mixed-qa/` (ảnh theo chiều rộng, `results.json`). Chưa kiểm tra Safari/Firefox hoặc thiết bị/mobile và máy quét QR vật lý. Thanh toán vẫn là gateway giả lập của dự án; đơn/vé/ghế của luồng API là bản ghi PostgreSQL thật, không phải localStorage mock.
