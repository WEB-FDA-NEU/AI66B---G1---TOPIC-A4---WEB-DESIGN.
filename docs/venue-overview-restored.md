# Khôi phục Venue Overview luôn hiển thị

> Báo cáo lịch sử của một giai đoạn triển khai. UI và lệnh kiểm thử hiện hành được mô tả tại [current-ui-qa.md](current-ui-qa.md); các selector/nút hoặc kết quả cũ dưới đây không phải trạng thái hiện tại.

Bản sửa trên `feature/trung` giữ đồng thời ba phần theo thứ tự:

1. **Venue Overview Map**: luôn hiện toàn bộ sân khấu, VIP, Standing, Seated và mọi khu trong cấu hình SVG hiện có.
2. **Seat Selection / Standing Quantity**: chưa chọn khu có hướng dẫn `Select a zone to view seats.`; chọn Seated chỉ render một section bên dưới, chọn Standing chỉ có bộ chọn số lượng.
3. **Ticket Summary**: số lượng, khu/ghế, giá và nút tiếp tục thanh toán.

## File sửa trong lần này

- `js/tickets.js`: bỏ điều kiện ẩn overview/detail card. Trạng thái chưa chọn khu hiển thị hướng dẫn. Khi bấm SVG không tự cuộn ra khỏi overview; giữ highlight hồng và các lựa chọn theo hạng từ phiên bản trước. Summary bổ sung số lượng vì bộ chọn Standing được chuyển lên phần chi tiết.
- `pages/concerts/tickets.html`: giữ overview ở trên, detail bên dưới và đưa Ticket Summary ngay sau detail. Chuyển đúng bộ điều khiển Standing có sẵn vào detail, không nhân bản các ID/nút. Legend ẩn cho tới khi chọn Seated.
- `css/seats.css`: workspace xếp dọc có khoảng cách; summary hai cột trên desktop, một cột trên mobile. Không sửa màu, tọa độ hoặc tên của venue. Giữ Fit, zoom/pan và màu trạng thái ghế hiện tại.
- `tests/frontend.test.js`: xác nhận overview và placeholder đều hiện, đổi khu/Standing không ẩn map tổng và không mất lựa chọn.
- `tests/seat_map_ux_browser.py`: kiểm tra thứ tự layout, SVG overview giữ nguyên DOM/shape/tên, highlight hồng sau transition, một section chi tiết; bấm SVG bằng tọa độ thật không cuộn khỏi overview; ảnh chụp có cả overview/detail/summary.
- Tài liệu: báo cáo này, cùng chú thích cập nhật trong `seat-map-ux.md` và `standing-seated.md`.

Không sửa `js/venue-engine.js`, `js/venues/c*-map.js`, backend, schema, seed, reservation, checkout hoặc QR trong lần này. Polygon và phân bổ seat ID từ các lần trước được giữ nguyên; không rollback tính năng ghế theo shape.

## Kiểm thử

- 17 kiểm thử JavaScript đạt; kiểm tra cú pháp JS/Python, tài nguyên/ID HTML, cấu trúc dấu ngoặc CSS và `git diff --check` đạt.
- 5 test checkout, 10 subtest đạt.
- Chrome: **77 lượt overview / 287 lượt section** đạt ở 320, 375, 390, 768, 1024, 1280, 1600px, trên 11 concert. Overview luôn có kích thước hiển thị; không bị thay DOM khi đổi khu; shape/tên mọi section giữ nguyên; highlight hồng đạt sau hiệu ứng chuyển màu 0,25 giây.
- Thứ tự overview → detail → summary và vị trí bộ chọn Standing được kiểm tra trên DOM/layout; Fit không tràn/cuộn mặc định. Không có nhiều section chi tiết cùng lúc.
- Bấm polygon bằng tọa độ thật trong Chrome 390/1280px: mở đúng CENTER PREMIUM bên dưới, overview không mất và trang không tự cuộn khỏi map tổng.
- Giữ lựa chọn giữa các section/hạng, số lượng Standing, zoom/Fit, kéo chuột và vuốt mobile đạt. Bộ geometry gốc vẫn đạt 12 hạng Seated / 2.910 ghế cùng 2 hình mẫu bổ sung, không mất/trùng/tràn.
- Checkout mua đúng hai seat ID được chọn ở hai section cùng hạng, không lẫn lựa chọn nháp hạng khác; phát hành order/vé/QR đúng. Standing mua 8 vé; Seated kiểm tra Held/409, hết hạn, Sold và QR đạt. API lỗi chặn mua; không fallback mock. Không có JavaScript exception trong lần chạy thành công.
- JSON đầy đủ: `/private/tmp/concertly-mixed-qa/results.json`. Ảnh toàn workspace: `/private/tmp/concertly-mixed-qa/overview-and-seats-390.png` và `overview-and-seats-1280.png`.

Các kiểm thử mua vé sử dụng backend QA cổng 18000 và PostgreSQL QA riêng cổng 55439. Không seed/reset hoặc sửa dữ liệu database ứng dụng.

## Giới hạn giữ nguyên

Fit trên mobile làm ghế/nhãn nhỏ để thấy toàn vùng; dùng Larger seats/+ để phóng và vuốt/pan. Bản chọn được giữ khi đổi khu trong cùng trang, chưa giữ qua reload và chưa phải giữ chỗ trên server. Checkout mua hạng đang chọn. Dữ liệu hình học vẫn là cấu hình demo, không khẳng định sơ đồ ghế vật lý của nhà tổ chức.

Kiểm thử Chrome headless với viewport/touch mô phỏng; chưa kiểm tra điện thoại vật lý, Safari/Firefox. Gateway thanh toán vẫn là mô phỏng của dự án.
