# Sơ đồ Seated theo hình dạng SVG

Báo cáo này mô tả lần sửa geometry trước. UX hiện tại đã thay preview/lưới cuộn mặc định bằng Fit và chỉ một section; xem `seat-map-ux.md`. Thuật toán geometry và định danh ghế ở đây vẫn được tái sử dụng.

Thực hiện trên `feature/trung`, không chuyển nhánh, commit hoặc push. Không thay đổi schema hay dữ liệu database ứng dụng. Backend và hợp đồng reservation/checkout/QR giữ nguyên trong lần sửa này.

## Thay đổi

- `js/venue-engine.js`: bổ sung `SeatGeometry`, đọc polygon và lấy mẫu đường path bằng SVG API. Đưa hướng sân khấu lên trên; polygon xếp theo các dải trong biên, path cong xếp theo cung quanh tâm sân khấu. Chỉ đặt ghế khi toàn bộ ô ghế nằm trong vùng hợp lệ; không dùng clip-path. Phân bổ đủ tập ghế API, không tạo/xóa/đổi ID, hàng, số ghế hoặc trạng thái.
- `js/tickets.js`: tái sử dụng chọn ghế hiện tại, đặt từng nút theo tọa độ từ geometry. Hiển thị đường biên, hướng sân khấu, tổng quan toàn khu và bản lớn để chọn ghế; hover/focus có khu, hàng, số ghế, giá/trạng thái. Chọn/bỏ chọn và polling giữ tọa độ; cache geometry luôn gắn lại trạng thái mới từ API. Khi mở khu hẹp/xiên trên mobile, cuộn tới ghế đầu thay vì khoảng trống. Giữ vị trí cuộn riêng theo section.
- `css/seats.css` và `pages/concerts/tickets.html`: bảng màu sân khấu hồng #E84393, VIP tím đậm, khu thường navy, viền bạc và chữ trắng. Available ○, Selected ✓, Held ◷, Sold ×; ghế Sold/Held của người khác bị khóa như trước. Bản lớn giữ nút tối thiểu 44px, zoom và cuộn hai chiều.
- `js/venues/c1-map.js`, `c5-map.js`, `c6-map.js`: tọa độ CENTER PREMIUM cũ thực tế rộng ở phía dưới, ngược yêu cầu. Chỉnh riêng ba hình thang để rộng gần sân khấu và hẹp phía sau; c5 có khoảng cách với hai khu Standing bên cạnh. Không đổi polygon/path, tên hoặc loại của khu Standing.
- Test: `tests/frontend.test.js`, `tests/check_project.py`, `tests/seat-geometry.browser.js`, `tests/mixed_admission_browser.py`, `tests/browser_qa.py`. Backend QA mặc định cổng 18000 và chặn cổng 8000 để tránh dùng nhầm backend của người dùng.

## Kết quả kiểm thử local

- 16 kiểm thử JavaScript đạt; kiểm tra cú pháp JS/Python, tài nguyên/ID HTML và dấu ngoặc CSS đạt. Đây không phải trình kiểm định HTML/CSS đầy đủ.
- 5 test hợp đồng checkout, 10 subtest đạt.
- 162 test backend đạt trên database mới riêng trong cụm QA PostgreSQL 16 cổng 55439. Không dùng database ứng dụng làm fixture.
- Chrome kiểm tra 11 venue map, gồm 12 hạng Seated / 2.910 ghế. So sánh ID đầu vào/đầu ra; giữ nguyên dữ liệu từng ghế; đối chiếu tâm/cạnh/góc ô ghế với native SVG `isPointInFill`; không mất, trùng, chồng lấn hoặc ra ngoài vùng. Có kiểm thử bổ sung tam giác và hình thang, và kiểm tra cache nhận trạng thái mới.
- Ba CENTER PREMIUM tại c1/c5/c6: 15 trường hợp ở 320, 375, 390, 768, 1024px; cạnh trên nhiều ghế hơn cạnh dưới, không phủ khu Standing, tổng quan thấy đủ shape, có ghế nhìn thấy khi mở, không tràn trang. Chrome thử bấm chọn/bỏ chọn theo tọa độ ở 390px, tooltip có khu/hàng/số ghế.
- Standing và Seated tại 5 chiều rộng trên: chọn/bỏ chọn, giới hạn 8, zoom/cuộn; Standing vẫn chỉ chọn số lượng.
- Database QA: mua Standing 8 vé; Seated giữ ghế → checkout → order/vé → Sold → ảnh QR. Người khác giữ ghế thì nút khóa và API trả 409; hết hạn trả Available. API lỗi chặn đặt vé, không fallback giả.
- Hồi quy Chrome chung: 40 lượt trang/kích thước đạt, gồm Home, Explore, Tickets, Checkout, Ticket Detail, Admin; kiểm tra QR/check-in và từ chối quét lặp đạt. Không có JavaScript exception trong các lần chạy thành công.

Chạy: `python3 -B tests/check_project.py`, pytest cho `tests/test_checkout_contract.py` và `backend/tests` (bắt buộc database dùng một lần có tên chứa `test`), rồi `tests/mixed_admission_browser.py` / `tests/browser_qa.py` với Chrome CDP cổng 9337, frontend cổng 8765 và PostgreSQL QA cổng 55439. Các test trình duyệt tự tạo database QA mới; không chạy seed trên database local của người dùng.

Ảnh và JSON kết quả: `/private/tmp/concertly-mixed-qa/` và `/private/tmp/concertly-qa-results/`.

## Giới hạn

Dữ liệu demo cũ thường có cùng số ghế ở mỗi hàng. Để giữ nguyên mọi hàng/số ghế và đồng thời tạo đường biên thu hẹp, một hàng dữ liệu có thể trải qua nhiều dải hiển thị; không khẳng định đây là sơ đồ ghế vật lý của nhà tổ chức. Khi một hạng có nhiều mảnh SVG, phân bổ ghế theo diện tích là quy ước hiển thị demo, chưa phải ánh xạ vị trí được lưu trong database.

Các path cong hiện tại được lấy mẫu để dựng biên; phép kiểm tra SVG native đã đạt với toàn bộ map hiện có. Chưa kiểm chứng SVG tùy ý có nhiều đường con/lỗ hoặc hình tự cắt. Chưa kiểm tra Safari/Firefox hay thiết bị điện thoại/máy quét vật lý. Gateway thanh toán vẫn là mô phỏng của dự án; kiểm thử tạo order/vé thật trong PostgreSQL QA, không phải giao dịch ngân hàng.
