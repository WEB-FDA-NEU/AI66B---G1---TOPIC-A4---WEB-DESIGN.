# Khôi phục Seat Selection từ lịch sử Codex

## Phiên bản gốc đã xác định

Dùng nội dung file được Codex đọc ngay trước yêu cầu cải thiện layout/Fit/single-zone ngày 13/11/2026, không lấy Git HEAD vốn có trước các thay đổi Standing/Seated/polygon.

Hai output log đầy đủ, không bị truncate:

- `call_85343df7b2d94a1ab9023a1be5579944`: đọc đầu `js/tickets.js` (dòng 1–260).
- `call_39597305bac748d5ad37d362ed617653`: đọc phần còn lại của JavaScript, toàn bộ `pages/concerts/tickets.html` và `css/seats.css`.

Phần JavaScript đọc chồng dòng 260 được đối chiếu chính xác trước khi nối. Bản khôi phục có 436 dòng JS, 139 dòng CSS, 174 dòng HTML. Timestamp yêu cầu redesign bắt đầu tại `2026-11-13T11:58:50.878Z`; hai bản đọc diễn ra ngay sau đó và trước lệnh sửa UI đầu tiên.

## Sao lưu trước khi sửa

`/private/tmp/concertly-ui-recovery-20261113-licgsz0y/`

- `before/`: file UI trước lần khôi phục này, venue-engine, 11 venue map, layout/responsive CSS và test frontend trước khi chỉnh kỳ vọng.
- `baseline/`: ba file UI gốc lấy từ log.
- `manifest.json`: nguồn log, call ID và SHA-256.
- `before-ui-git.diff`: Git diff của ba file UI trước khi sửa.
- `after-vs-baseline/`: diff cuối cùng so với bản gốc, để kiểm tra phạm vi hai điểm sửa.

Không dùng reset, clean, restore toàn bộ hoặc Undo hàng loạt. Các thay đổi có sẵn trong workspace thuộc các nhiệm vụ trước được giữ nguyên.

## File UI sửa

1. `pages/concerts/tickets.html`: khôi phục **đúng từng byte** so với baseline. Giữ bố cục gốc: nội dung và bản đồ ở cột trái, thông tin/Your Selection ở cột phải; giữ các vị trí, nút và preview ban đầu. Không thêm workspace/summary toàn chiều ngang.
2. `js/tickets.js`: từ baseline, chỉ thêm hàm co canvas đồng tỷ lệ theo chiều rộng cột, xử lý resize/zoom tương ứng và chọn đúng một geometry layout theo section vừa bấm. SeatGeometry, dữ liệu/API và mọi seat ID giữ nguyên. Venue overview không có thao tác ẩn/thay thế khi chọn khu.
3. `css/seats.css`: giữ nguyên CSS baseline và thêm 6 dòng cho viewport/canvas fit. Không sửa bảng màu, font hoặc grid trang; thanh cuộn chi tiết chỉ được bật sau khi chủ động zoom.

Phần JavaScript từ `refreshAvailability` đến cuối file (gồm chọn hạng, reservation và checkout) được đối chiếu bằng chuỗi và **khớp baseline hoàn toàn**. Thuật toán phân bổ/tọa độ polygon trong `js/venue-engine.js` và 11 file venue map không đổi. Checksum của 14 file được bảo vệ (engine, maps, layout/responsive CSS) đều giữ nguyên so với trước khôi phục.

## Test và xác nhận

- `tests/frontend.test.js`: chỉ cập nhật test dành cho UI redesign thành kiểm tra đổi section trong cùng hạng vẫn giữ đúng seat ID gửi checkout. **17 test JavaScript đạt**; cú pháp JS/Python, tài nguyên/ID HTML, dấu ngoặc CSS và `git diff --check` đạt.
- `tests/test_checkout_contract.py`: **5 test, 10 subtest đạt**.
- `tests/recovered_seat_selection_browser.py`: Chrome thực tế với backend local cổng 8000, frontend kiểm thử riêng cổng 8765.
- Đăng nhập `quocbao@concertly.dev` qua form: **HTTP 200**, đúng `POST /api/auth/login`, `application/x-www-form-urlencoded`, trường `username/password`. Giá trị mật khẩu được đọc trong tiến trình từ `.env`, không được xuất ra báo cáo/Terminal.
- `/api/auth/me`: **200**, đúng tài khoản sau đăng nhập và sau khi chuyển qua các trang concert. Gọi không có token trả **401** đúng cơ chế bảo vệ session. Không đổi auth, mật khẩu hay tài khoản.
- **66 lượt trang**, gồm 11 concert × 320, 375, 390, 768, 1024, 1280px. Bố cục sidebar gốc và vị trí map được kiểm tra.
- **246 lượt section Seated**: chỉ một detailed section, đúng tập seat ID phân bổ từ SeatGeometry; các nút nằm trong polygon viewport, không tràn trang hoặc cuộn ngang/dọc nội bộ tại zoom mặc định. Overview giữ nguyên DOM, hình dạng và tên khu khi đổi section; highlight đúng khu; chọn/bỏ ghế và zoom/reset đạt.
- **66 lượt Standing**: chỉ chọn số lượng, không có ghế; overview vẫn hiện.
- Không có JavaScript exception. Không tạo reservation/đơn mới; các endpoint reservation/checkout/admin bị chặn trong Chrome kiểm thử để bảo đảm không ghi dữ liệu thật. Backend/database không bị reset hoặc seed.

Ảnh: `/private/tmp/concertly-restored-ui-qa/restored-1280.png`, `restored-390.png`. JSON kiểm thử đã loại thông tin nhạy cảm: `/private/tmp/concertly-restored-ui-qa/results.json`.

## Giới hạn

Đây là khôi phục bố cục và hành vi gốc, không giữ các tiện ích mới của lần redesign như workspace toàn chiều ngang hoặc lưu bản chọn nháp riêng giữa các hạng. Preview của khu và sơ đồ lớn của cùng khu được giữ như bản gốc; chỉ có một **section chi tiết** đang mở.

Fit giữ đúng tỷ lệ và dùng chiều rộng cột gốc; khu cao có thể làm trang dài hơn, không ép méo polygon hoặc cắt ghế trong viewport chi tiết. Zoom làm lớn sơ đồ và bật cuộn như trước. Chưa kiểm thử Safari/Firefox hoặc điện thoại vật lý. Không thực hiện giao dịch thanh toán mới trong lần kiểm tra này để giữ nguyên dữ liệu local.
