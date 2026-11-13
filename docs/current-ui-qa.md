# UI và QA hiện hành

Tài liệu này mô tả phiên bản cuối sau khi khôi phục giao diện gốc. Những báo cáo `seat-map-ux.md`, `venue-overview-restored.md`, `seat-selection-recovery.md`, `seat-map-geometry.md`, `qa-regression.md` ghi lịch sử các lần triển khai; không dùng selector/nút trong các báo cáo đó để xác định UI hiện hành.

## Giao diện và hành vi

- Giữ bố cục gốc: Venue Overview và Seat Selection ở cột trái; Event Information/Your Selection ở cột phải trên desktop. Mobile xếp theo responsive có sẵn.
- Venue Overview luôn tồn tại. Bấm trực tiếp polygon sẽ highlight khu và hiển thị đúng một section Seated bên dưới. Preview của cùng khu vẫn được giữ.
- Chi tiết tự fit đồng tỷ lệ theo chiều rộng và chiều cao khả dụng. Nút +/− zoom; Reset seats về mức fit. Sau khi zoom có thể cuộn/vuốt để pan.
- Các section cùng hạng vé chia sẻ tập seat ID; đổi section trong cùng hạng giữ lựa chọn. Đổi sang hạng khác bắt đầu lựa chọn mới. Không có giỏ nháp giữa nhiều hạng, nút Change zone hoặc Larger seats.
- Standing chỉ chọn khu/số lượng ở Your Selection, không hiển thị ghế đánh số. Tổng tối đa 6 vé mỗi reservation, giữ chỗ 5 phút.
- Phân loại: 10 concert có cả Standing/Seated, c8 chỉ Standing; xem `standing-seated.md`.
- Polygon CENTER PREMIUM ở c1/c5/c6 đã được điều chỉnh để rộng phía sân khấu, hẹp phía sau. Không đổi hình dạng Standing hoặc giá vé. Seat ID, row, number và QR vẫn giữ tương thích.

## Chạy kiểm thử

Kiểm tra nguồn/frontend và hợp đồng checkout:

```sh
python3 -B tests/check_project.py
PYTHONDONTWRITEBYTECODE=1 backend/.venv/bin/python -m pytest -q -p no:cacheprovider tests/test_checkout_contract.py
```

Toàn bộ backend cần `TEST_DATABASE_URL` trỏ tới **database dùng một lần, tên chứa test**. Fixture sẽ reset bảng trong database đó. Không dùng database ứng dụng.

Các script Chrome cần Python có `backend/requirements-dev.txt` và `tests/requirements-browser.txt`, Chrome CDP cổng 9337, frontend HTTP cổng 8765 và cụm PostgreSQL QA riêng cổng 55439 (user `concertly_qa`, database `postgres` truy cập được). Dùng profile Chrome kiểm thử riêng. Hai script dưới đây tự tạo database QA mới và backend riêng 18000; không dùng backend local 8000:

```sh
python3 -B tests/mixed_admission_browser.py
python3 -B tests/browser_qa.py
```

Chạy tuần tự vì cả hai sử dụng cùng cổng backend và tab Chrome.

- `mixed_admission_browser.py`: cấu hình 11 concert, biên SVG/seat IDs, fit/single-section, trạng thái và chọn ghế, zoom/reset/pan; mua đúng ghế đã chọn qua nhiều section cùng hạng; Standing 6 vé; Held/409, hết hạn, Sold và QR.
- `browser_qa.py`: giới hạn vé, validation, countdown/expiry, thanh toán, order/ticket/QR và check-in; 40 lượt trang/kích thước ở Home/Explore/Tickets/Checkout/Ticket Detail/Admin. Kiểm tra zoom venue bằng kích thước SVG thật, không dựa vào class của UI cũ.
- `recovered_seat_selection_browser.py`: tùy chọn kiểm thử chỉ đọc với backend local 8000 và tài khoản demo `quocbao@concertly.dev`; mật khẩu lấy nội bộ từ `.env`. Không tạo reservation/checkout. Script này phụ thuộc tài khoản/môi trường local, không thay thế suite QA độc lập ở trên.

Kết quả nằm trong `/private/tmp/concertly-mixed-qa/`, `/private/tmp/concertly-qa-results/` hoặc `/private/tmp/concertly-restored-ui-qa/` trên máy chạy test, không phải artifact được lưu sẵn trong repository.

## Giới hạn

Chrome headless chỉ mô phỏng kích thước và thao tác touch; chưa thay thế kiểm tra trên thiết bị vật lý/Safari/Firefox. Gateway thanh toán là mô phỏng. Ghế và phân bổ giữa các mảnh SVG là cấu hình demo, không khẳng định sơ đồ vật lý của concert. Không đưa `.env`, token, database local hoặc môi trường ảo vào Git.

## Kết quả lần đồng bộ QA này

- Kiểm tra nguồn và 17 kịch bản JavaScript đạt; checkout contract 5 test/10 subtest đạt.
- `mixed_admission_browser.py` chạy trực tiếp đạt: 77 overview, 287 lượt section tại 7 chiều rộng; 14 trường hợp geometry (12 hạng thật trong demo và 2 hình mẫu), chọn qua nhiều section cùng hạng, zoom/reset/cuộn, touch pan mobile, resize, Standing, thanh toán và QR. Không có JavaScript exception.
- `browser_qa.py` chạy trực tiếp đạt: 40 lượt responsive và 12 luồng kiểm thử, gồm validation, expiry, thanh toán, order/vé và QR/check-in. Không cần adapter tạm hoặc chỉnh source ứng dụng.
- Checksum 89 file JS/CSS/HTML/backend được bảo vệ giữ nguyên trước/sau sửa QA. Thay đổi lần này chỉ thuộc test và tài liệu.
