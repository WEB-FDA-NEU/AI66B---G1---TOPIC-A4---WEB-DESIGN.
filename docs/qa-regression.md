# Kiểm thử hồi quy CONCERTLY — feature/trung

Ngày kiểm thử: 13/11/2026. Không chuyển nhánh, không commit/push, không thay đổi schema database.

## Môi trường

- Frontend được phục vụ bằng HTTP tại `127.0.0.1:8765`.
- Backend FastAPI chạy thực tế tại `127.0.0.1:8000`.
- PostgreSQL 16: cluster riêng trong `/private/tmp/concertly-qa-postgres`, cổng `55439`.
- Database regression và database trình duyệt tách biệt, chỉ chứa dữ liệu dùng một lần.
- Chrome headless điều khiển qua CDP; không dùng dữ liệu hay profile Chrome cá nhân.
- Thư viện cài vào virtualenv tạm `/private/tmp/concertly-qa-venv`.
- Lịch concert trong database trình duyệt được đẩy tới tương lai để test không phụ thuộc ngày chạy; không sửa seed nguồn.

## Kết quả

| Nhóm | Kết quả |
| --- | --- |
| Ticket Detail | Có header/footer, bố cục co giãn, mã dài xuống dòng; ảnh QR tải thành công |
| Seat map | Sơ đồ SVG và ghế API tải thành công; zoom/reset, chọn vùng bằng bàn phím, giới hạn chọn 8 ghế hoạt động |
| Checkout/layout | Có header/footer, các khung có khoảng cách; không tràn ngang trang |
| Validation/countdown | Form chặn thiếu/sai thông tin; API trả 422 nếu thiếu/sai buyer; 9 ghế bị chặn, 8 ghế hợp lệ; reservation hết hạn trả 410 |
| Mã vé/order/QR | Nhãn hiển thị có concert; ID và payload QR gốc được giữ nguyên; mã gốc check-in một lần, quét lại trả 409, sai concert trả 400 |
| Mobile/admin | Điều hướng admin vẫn hiển thị, bảng cuộn trong wrapper; 40/40 lượt đo không tràn ngang trang |
| Header Home/Explore | Cùng chiều cao, danh sách điều hướng và placeholder tìm kiếm ở cả 5 kích thước |

Các màn hình trong ma trận: Home, Explore, Tickets, Checkout, Ticket Detail, Admin Dashboard, Admin Concerts, Admin Check-in.

| Chiều rộng | Lượt kiểm tra bố cục đạt |
| --- | --- |
| 320px | 8/8 |
| 375px | 8/8 |
| 390px | 8/8 |
| 768px | 8/8 |
| 1024px | 8/8 |

Luồng mua API được thao tác trên DOM trình duyệt: chọn ghế → POST giữ chỗ → checkout có countdown → validate người mua → thanh toán mô phỏng → đơn paid → vé có QR. Gọi checkout lặp lại trả về cùng order.

Luồng mock: API seat map bị chặn có chủ ý → xuất hiện lỗi/nút thử lại → phục hồi API và thử lại thành công → chặn lần nữa và chủ động chọn demo → tối đa 8 vé → reload giữ nguyên expiresAt → thanh toán tạo biên nhận demo. Demo không cấp QR vào cửa.

Hết hạn được kiểm tra bằng hai cách: đưa reservation trong database dùng một lần về quá hạn để API từ chối; tăng đồng hồ trình duyệt qua mốc 5 phút để bộ đếm đang chạy tự chuyển trang hết hạn. Không phải chờ 5 phút thật mỗi lần chạy.

## Lỗi phát hiện và đã sửa trong đợt kiểm thử

1. **API có thể bỏ qua thông tin người mua:** `CheckoutRequest.buyer` trước đây tùy chọn. Đã bắt buộc trường này, bổ sung regression test cho payload thiếu/rỗng/sai; hold vẫn active và không tạo order khi validation thất bại. Điều chỉnh các API test cũ và README cho request mới. Không sửa ID, mã vé hoặc dữ liệu cũ.
2. **Chọn vùng SVG bằng bàn phím gây TypeError:** `<g>` không có `HTMLElement.click()`. Sửa `js/venue-engine.js` để phát `MouseEvent` thay thế; kiểm thử lại bằng Chrome không còn exception.

## Test tự động

- `python3 -B tests/check_project.py`: 13 kịch bản JavaScript pass; cú pháp Python/JavaScript, tham chiếu tài nguyên và ID HTML, dấu ngoặc CSS đạt.
- `python -m pytest -q -p no:cacheprovider tests/test_checkout_contract.py`: 5 test, 10 subtest pass.
- `TEST_DATABASE_URL=... python -m pytest -q -p no:cacheprovider backend/tests`: 154 test pass, gồm các kịch bản đồng thời.
- `python -B tests/browser_qa.py`: các luồng trình duyệt và 40 lượt responsive pass, không có JavaScript exception.
- `python3 -B backend/scripts/seed.py --check`: seed hợp lệ, 11 concert, 14 đơn mẫu.
- `git diff --check`: đạt.

Để chạy browser suite cần cài `tests/requirements-browser.txt`, chạy frontend HTTP trên cổng 8765, PostgreSQL dùng riêng cho QA trên cổng 55439 với user `concertly_qa`, và Chrome headless với remote debugging port 9337. Suite tự tạo database có tên ngẫu nhiên chứa `test`, seed dữ liệu và khởi động/dừng backend. Không trỏ suite vào database đang sử dụng.

Ảnh và kết quả chi tiết ở `/private/tmp/concertly-qa-results/` (`results.json`, các PNG theo tên trang và chiều rộng); đây là artifact tạm, không thêm ảnh vào Git.

## Giới hạn

Không phát hiện lỗi còn lại trong các kịch bản đã chạy. Kết quả giao diện áp dụng cho Chrome headless với viewport mô phỏng; chưa kiểm tra Safari/Firefox, thiết bị iOS/Android thật hoặc máy quét QR vật lý. Payment vẫn là mô phỏng theo phạm vi dự án.
