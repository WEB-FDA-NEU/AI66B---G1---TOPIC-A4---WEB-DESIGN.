# Seat Map — Fit và chọn từng khu

> Báo cáo lịch sử của một giai đoạn triển khai. UI và lệnh kiểm thử hiện hành được mô tả tại [current-ui-qa.md](current-ui-qa.md); các selector/nút hoặc kết quả cũ dưới đây không phải trạng thái hiện tại.

**Cập nhật:** cách ẩn overview trong báo cáo lịch sử này đã được sửa theo yêu cầu. Venue Overview hiện luôn hiển thị phía trên phần chi tiết, tiếp theo là Ticket Summary; xem `venue-overview-restored.md`. Fit, polygon và lưu lựa chọn vẫn giữ nguyên.

Triển khai trên `feature/trung`. Lần cải thiện này chỉ sửa phần trình bày/chọn khu ở frontend, không đổi backend reservation/checkout, seat ID/hàng/số ghế/trạng thái, QR, schema, cấu hình zone hoặc seed.

## File thay đổi

- `js/tickets.js`: màn hình mặc định chỉ có venue overview. Chọn polygon mở đúng một section; Change zone quay về overview, giữ highlight và lựa chọn. Category trong danh sách mở section đã xem gần nhất hoặc section đầu tiên. Các section cùng một hạng tiếp tục dùng phân bổ ID của `SeatGeometry.zone` trong venue-engine; không render nối tiếp toàn bộ section. Chỉ hạng đang chọn được đưa vào checkout, kể cả các ghế đã chọn ở nhiều section thuộc hạng đó.
- `pages/concerts/tickets.html`: workspace chiếm toàn hàng, thay overview/detail trong cùng vị trí; nút Change zone, Fit zone, Larger seats, +/−, mức zoom và số ghế đã chọn. Không còn preview lặp lại phía trên sơ đồ chi tiết.
- `css/seats.css`: workspace desktop tận dụng chiều ngang, căn giữa canvas, giữ tỷ lệ polygon. Màu navy/pink/silver và ký hiệu bốn trạng thái giữ nhất quán. Thanh cuộn chỉ xuất hiện sau khi chủ động zoom; mobile dùng cuộn native để pan, desktop hỗ trợ kéo chuột.
- `tests/frontend.test.js`: cập nhật thao tác chọn khu chủ động, bổ sung kiểm tra mặc định overview và giữ lựa chọn giữa các hạng.
- `tests/seat_map_ux_browser.py`: kiểm thử mới cho Fit, một section, highlight/Back, giữ lựa chọn, resize, kéo chuột và vuốt mobile.
- `tests/mixed_admission_browser.py`: tích hợp UX và mua đúng các seat ID đã chọn qua nhiều section; bảo đảm bản chọn nháp hạng khác không lẫn vào đơn. Giữ các test Standing, Held/Sold, hết hạn và lỗi API.
- `tests/browser_qa.py`: chọn zone chủ động theo luồng mới, xóa cấu hình chặn mạng của lần chạy trước và ghi lỗi tải tài nguyên để chẩn đoán môi trường QA.
- Cập nhật `docs/standing-seated.md`, `docs/seat-map-geometry.md` và báo cáo này để phân biệt UX hiện tại với phiên bản trước.

`js/venue-engine.js` được tái sử dụng, không đổi thuật toán phân bổ/tọa độ ghế trong lần này. Không chỉnh 11 file venue map hoặc bất kỳ file backend nào.

## Hành vi Fit / zoom

Fit tính một hệ số chung theo chiều rộng khả dụng và giới hạn chiều cao của viewport. Toàn bộ polygon và nút ghế cùng scale, không kéo giãn riêng chiều ngang/dọc; không cắt hoặc giấu ghế để tạo hình. Canvas có vùng bề mặt đúng kích thước sau scale. Tại Fit, toàn bộ ghế nằm trong viewport và không cần thanh cuộn.

Larger seats đưa ghế lên ít nhất kích thước cơ sở 44px; +/− zoom từng bước, Fit zone khôi phục toàn vùng. Zoom giữ tâm nhìn, resize tính lại Fit. Chọn/bỏ ghế và polling không làm mất mức zoom/vị trí pan của section đang mở. Mở khu khác hoặc quay lại từ overview bắt đầu ở Fit.

Lựa chọn được lưu trong bộ nhớ trang theo **hạng vé**: các section cùng hạng chia sẻ tập ghế đã chọn, tối đa 8; hạng khác có bản chọn nháp riêng. Standing lưu số lượng, không tạo số ghế. Giao diện giải thích checkout chỉ bao gồm hạng đang mở. Những ghế không còn Available/held_by_me bị loại khỏi bản chọn khi nhận trạng thái mới; API vẫn quyết định khi giữ vé.

## Kiểm thử đã chạy

Môi trường: Chrome headless/CDP, frontend QA cổng 8765, backend QA cổng 18000, PostgreSQL QA riêng cổng 55439. Các database dùng một lần được tạo cho test; không chạy seed/reset trên database ứng dụng. Backend local cổng 8000 giữ nguyên.

- **17 test JavaScript đạt**, cùng kiểm tra cú pháp Python/JS, tài nguyên/ID HTML, dấu ngoặc CSS và `git diff --check`.
- **5 test hợp đồng checkout, 10 subtest đạt**.
- **162 test backend đạt** trên database kiểm thử mới riêng.
- **77 lượt overview đạt**: 11 concert × 7 chiều rộng (320, 375, 390, 768, 1024, 1280, 1600px). Không tự mở chi tiết dù URL có `ticketType`; đúng kích thước CSS viewport và không cần cuộn trong venue ở Fit.
- **287 lượt section đạt**: 41 section Seated × 7 chiều rộng trên. Chỉ render một section đúng ID; tập seat ID bằng phân bổ geometry của section đó; tất cả nút ghế nằm trong vùng nhìn; không tràn trang hoặc cuộn ngang/dọc tại Fit; không còn preview lặp. Có thử zoom rồi Fit lại và Change zone/highlight.
- Giữ lựa chọn giữa LEFT/RIGHT cùng hạng, chuyển sang hạng khác, sang Standing rồi quay lại; giữ số lượng Standing và các ghế đã chọn. Resize không mất lựa chọn. Kéo chuột không chọn nhầm ghế; vuốt mobile làm dịch chuyển sơ đồ đã zoom.
- Luồng mua sau đổi khu: chọn hai ghế tại hai section của Standard Tier 2, chọn nháp thêm ở Standard Tier 1 rồi quay về Tier 2 → giữ đúng hai ID → checkout → order PostgreSQL có đúng hai ghế đó, không lẫn hạng khác; QR giữ nguyên payload.
- Luồng Standing 8 vé và Seated tiếp tục đạt; người khác giữ ghế bị khóa/409, hết hạn trở về Available, thanh toán xong Sold. Lỗi API chặn đặt vé, không fallback giả.
- **40 lượt hồi quy trang/kích thước đạt**, gồm Home/Explore/Tickets/Checkout/Ticket Detail/Admin; kiểm tra QR check-in, từ chối quét trùng và sai concert. Không có JavaScript exception trong các lần chạy thành công.

Lệnh: `python3 -B tests/check_project.py`; pytest `tests/test_checkout_contract.py`; pytest `backend/tests` với `TEST_DATABASE_URL` trỏ database dùng một lần có tên chứa `test`; `tests/mixed_admission_browser.py`; `tests/browser_qa.py`.

Ảnh `fit-c1/c2/c3/c5/c6-390.png` và `fit-c1/c2/c3/c5/c6-1280.png`, cùng JSON kết quả nằm tại `/private/tmp/concertly-mixed-qa/`. Hồi quy chung tại `/private/tmp/concertly-qa-results/`.

## Giới hạn

Ở Fit trên màn hình nhỏ, ghế/nhãn sẽ nhỏ để thấy toàn vùng; dùng Larger seats hoặc + trước khi cần đọc/chọn ghế lớn. Mọi phép scale giữ nguyên tỷ lệ nên khu vốn cao/hẹp vẫn có hình đó, được căn giữa thay vì kéo giãn sai polygon.

Bản chọn nháp được giữ khi đổi khu trong cùng trang, chưa lưu qua reload/đóng tab và chưa phải giữ chỗ trên server. Checkout chỉ mua hạng đang mở; không bổ sung giỏ hàng nhiều hạng trong lần này. Các quy ước vị trí demo/hàng trải nhiều dải và phân bổ giữa nhiều mảnh SVG từ lần trước không thay đổi.

Đã kiểm tra Chrome mô phỏng viewport và thao tác touch, chưa kiểm tra Safari/Firefox hoặc điện thoại vật lý. Gateway thanh toán vẫn là mô phỏng của dự án; order/vé/ghế trong test là dữ liệu PostgreSQL QA, không phải giao dịch ngân hàng.
