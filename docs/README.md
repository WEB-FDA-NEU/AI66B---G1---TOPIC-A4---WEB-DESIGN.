# CONCERTLY — Online Concert Ticketing Platform

## 1. Giới thiệu đề tài

Đề tài A4: Trang bán khóa học / vé sự kiện online, được cụ thể hóa thành website bán vé concert các nhóm nhạc.

**CONCERTLY** là website bán vé concert trực tuyến, tập trung vào trải nghiệm tìm kiếm sự kiện, lựa chọn ghế, mua vé và quản lý vé sau khi đăng nhập.

Website được xây dựng dưới dạng student project, mô phỏng quy trình mua vé concert thực tế nhưng sử dụng mock payment, không thực hiện giao dịch tiền thật.

---

## 2. Bài toán

Vé concert là sản phẩm số có số lượng giới hạn (theo hạng ghế/khu vực), nhiều người có thể cùng đặt một vé tại một thời điểm. Hệ thống cần đảm bảo:

- Giúp người dùng dễ dàng tìm kiếm và khám phá các concert.
- Cung cấp đầy đủ thông tin về concert, venue, nghệ sĩ và giá vé.
- Cho phép người dùng lựa chọn ghế trực tiếp trên sơ đồ chỗ ngồi.
- Tạm giữ ghế trong thời gian ngắn trong quá trình checkout.
- Mô phỏng quy trình đặt vé và thanh toán.
- Tạo vé điện tử có QR Code sau khi đặt vé thành công.
- Cho phép người dùng xem lại vé và lịch sử đơn hàng.
- Cung cấp giao diện quản trị để quản lý concert và đơn hàng.

---

## 3. Các tính năng chính

### 3.1. Concert Discovery

Người dùng có thể khám phá các concert trên website.

- Danh sách concert sắp diễn ra và đang mở bán.
- Tìm kiếm concert theo tên concert hoặc nghệ sĩ.
  -Lọc theo ngày và khoảng giá.
- Hiển thị concert nổi bật.
- Hiển thị trạng thái mở bán / sắp mở bán.
- Countdown đến thời điểm concert hoặc mở bán.

Mục tiêu: Tạo trải nghiệm khám phá concert trực quan và dễ sử dụng.

### 3.2. Concert Detail

Trang chi tiết cung cấp thông tin cần thiết trước khi người dùng quyết định mua vé.

- Tên concert.
- Poster / hình ảnh concert.
- Nghệ sĩ / line-up.
- Ngày và thời gian.
- Địa điểm / venue.
- Mô tả concert.
- Các khu vực vé.
- Giá vé theo từng khu vực.
- Số lượng vé còn lại.
- Điều khoản cơ bản.

### 3.3. Interactive Seat Selection

Người dùng chọn ghế trực tiếp trên **sơ đồ chỗ ngồi**.

- Hiển thị sơ đồ sân khấu và các khu vực ghế.
- Phân biệt các khu vực như VIP / A / B / C.
- Phân biệt trạng thái:
  - Available
  - Selected
  - Held
  - Sold
- Không cho phép chọn ghế đã Sold.
- Click vào ghế để chọn / bỏ chọn.
- Hiển thị giá của ghế hoặc khu vực.
- Tự động cập nhật số lượng ghế và tổng tiền.

Phạm vi hiện tại chỉ hỗ trợ vé có ghế đánh số. Vé khu vực đứng (General
Admission) theo số lượng chưa được hỗ trợ và nằm ngoài phạm vi phiên bản này.

### 3.4. Temporary Seat Reservation

Sau khi người dùng chọn ghế:

- Ghế được chuyển sang trạng thái Held.
- Hiển thị countdown 5 phút trong phiên checkout.
- Người dùng có thời gian hoàn tất đơn hàng.
- Nếu thanh toán thành công → ghế chuyển thành Sold.
- Nếu hết thời gian → ghế được trả về Available.
- Khi checkout, hệ thống kiểm tra lại trạng thái ghế trước khi xác nhận đơn hàng.

### 3.5. Mock Checkout & Payment

Website mô phỏng quy trình đặt vé:

Seat Selection → Order Summary → Payment → Success

Người dùng có thể:

- Kiểm tra concert đã chọn.
- Kiểm tra ghế đã chọn.
- Xem số lượng vé.
- Xem tổng tiền.
- Chọn phương thức thanh toán giả lập:
  - Credit/Debit Card
  - E-wallet
  - Bank Transfer
- Xác nhận thanh toán.

Sau khi thanh toán thành công:

- Order được cập nhật thành Paid.
- Ghế được xác nhận là Sold.
- Hệ thống tạo digital ticket.

Hệ thống chỉ mô phỏng thanh toán và không thực hiện giao dịch tiền thật.

### 3.6. Digital Ticket & QR Code

Sau khi đặt vé thành công:

- Tạo digital ticket.
- Hiển thị:
  - Concert
  - Ngày / giờ
  - Venue
  - Khu vực
  - Số ghế
  - Ticket ID
- Sinh QR Code cho mỗi vé.
- Ticket có trạng thái:
  - Valid
  - Used
- Người dùng có thể mở vé từ My Tickets.

Admin có thể sử dụng QR Code để kiểm tra và xác thực vé tại sự kiện.

### 3.7. My Tickets & Orders

Sau khi đăng nhập, người dùng có thể:

- Xem các concert sắp tham dự.
- Xem danh sách vé đã mua.
- Mở digital ticket.
- Xem QR Code.
- Xem Ticket ID.
- Xem lịch sử đơn hàng.
- Xem trạng thái đơn hàng:
  - Pending
  - Paid
  - Cancelled
- Người dùng có thể hủy đơn theo chính sách của concert.
- Đơn đủ điều kiện được ghi nhận yêu cầu hoàn tiền qua mock payment và cập nhật
  trạng thái hoàn tiền.

### 3.8. Admin Dashboard

Admin có thể:

**Concert Management**
Xem danh sách concert.
Thêm concert mới.
Chỉnh sửa thông tin concert.
Xóa concert.

**Ticket & Seat Management**

- Xem các khu vực ghế.
- Cập nhật giá vé.
- Xem số lượng vé còn lại.

**Order Management**

- Xem danh sách đơn hàng.
- Xem thông tin khách hàng.
- Xem trạng thái thanh toán.
- Xem chi tiết đơn hàng.

**Basic Dashboard**

Hiển thị một số chỉ số cơ bản:

- Total Concerts.
- Tickets Sold.
- Total Orders.
- Total Revenue.
- Upcoming Concerts.

### 3.9. Cancellation & Refund

- Người dùng gửi yêu cầu hủy từ Order Detail khi đơn còn đủ điều kiện.
- Hệ thống hiển thị chính sách và yêu cầu xác nhận trước khi hủy.
- Đơn chuyển sang Cancelled; nếu đã thanh toán, mock payment mô phỏng hoàn tiền.
- Không thực hiện giao dịch tiền thật.

---

## 4. Các màn hình dự kiến

### User

1. **Register**
   Mục đích: Tạo tài khoản khách hàng mới.

- Họ tên
- Email
- Mật khẩu

2. **Login**
   Mục đích: Đăng nhập tài khoản khách hàng để xem vé và đơn hàng.

- Email
- Mật khẩu

3. **Home**
   Mục đích: Giúp người dùng khám phá nhanh các concert nổi bật.
   - Concert nổi bật
   - Trending
   - Upcoming concerts

4. **Explore Concerts**
   Mục đích: Tìm kiếm và lọc concert.
   - Search
   - Filter
   - Danh sách concert

5. **Concert Detail**
   Mục đích: Cung cấp thông tin chi tiết trước khi mua vé.
   - Thông tin concert
   - Line-up
   - Venue
   - Giá vé
   - Seat map

6. **Seat Selection**
   Mục đích: Cho phép người dùng chọn ghế trực tiếp.
   - Interactive seat map
   - Chọn ghế
   - Countdown giữ vé
   - Tổng tiền

7. **Checkout**
   Mục đích: Xác nhận thông tin đơn hàng và mô phỏng thanh toán.
   - Thông tin vé
   - Ghế đã chọn
   - Tổng tiền
   - Phương thức thanh toán

- Nút xác nhận thanh toán

8. **Session Expired**
   Mục đích: Thông báo phiên giữ ghế đã hết hạn.

- Thông báo ghế đã được trả lại
- Nút quay lại Seat Selection

9. **Order Confirmation**
   Mục đích: Xác nhận đặt vé thành công sau khi thanh toán.

- Payment Success
- Mã đơn hàng
- Link tới vé

10. **My Tickets**
    Mục đích: Quản lý các vé đã mua.

- Danh sách vé
- QR Code
- Thông tin concert
- Mã vé

11. **Profile & Orders**
    Mục đích: Quản lý tài khoản và lịch sử mua vé.

- Thông tin cá nhân
- Lịch sử đơn hàng
- Trạng thái thanh toán

12. **Order Detail**
    Mục đích: Xem chi tiết một đơn hàng và thao tác hủy nếu đủ điều kiện.

- Thông tin concert, vé và tổng tiền
- Trạng thái thanh toán / đơn hàng
- Chính sách hủy và hoàn tiền
- Nút hủy đơn

### Authentication & Admin

13. **Admin Login**
    Mục đích: Xác thực quản trị viên trước khi vào khu vực quản trị.

- Tài khoản quản trị
- Mật khẩu

14. **Admin Dashboard**
    Mục đích: Tổng quan và quản lý hệ thống.

- Tổng quan doanh thu
- Vé đã bán
- Concert đang hoạt động
- Quản lý concert
- Quản lý khu vực / ghế
- Quản lý đơn hàng
- Check-in và xác thực QR Code

---

## 5. User Flow chính

**5.1. Customer — Discover & Purchase Ticket**

```text
Home
  ↓
Explore Concerts
  ↓
Concert Detail
  ↓
Select Seats
  ↓
Temporary Reservation (5 minutes)
  ↓
Checkout
  ↓
Mock Payment
  ↓
Order Confirmation
  ↓
My Tickets
  ↓
Digital Ticket + QR Code
```

**5.2. Customer — View Existing Ticket**

```text
Login
  ↓
My Tickets
  ↓
Select Ticket
  ↓
Digital Ticket
  ↓
View QR Code
```

**5.2a. Customer — Register & Login**

```text
Register
  ↓
Login
  ↓
Home
```

**5.3. Customer — View Order History**

```text
Profile
  ↓
Orders
  ↓
Order Detail
  ↓
Payment Status
  ↓
View Ticket
```

**5.4. Admin — Manage Concert**

```text
Admin Login
  ↓
Admin Dashboard
  ↓
Concert Management
  ↓
Create / Edit Concert
  ↓
Update Ticket Information
  ↓
Save
```

**5.5. Admin — Manage Orders**

```text
Admin Dashboard
  ↓
Order Management
  ↓
Order List
  ↓
Order Detail
  ↓
View Payment / Ticket Status
```

**5.6. Optional — QR Check-in**

```text
Admin Dashboard
  ↓
Check-in
  ↓
Enter / Scan QR Code
  ↓
Validate Ticket
  ↓
Valid → Mark as Used
```

**5.7. Customer — Reservation Timeout**

```text
Checkout
  ↓ (hết 5 phút giữ chỗ)
Session Expired
  ↓
Seat Selection
```

Khi phiên hết hạn, hệ thống trả ghế về Available và người dùng phải chọn lại
ghế trước khi tiếp tục checkout.

**5.8. Customer — Cancel Order & Refund**

```text
Login
  ↓
Profile & Orders
  ↓
Order Detail
  ↓
Cancel Order
  ↓
Refund Processing (Mock)
  ↓
Cancelled
```

Nếu đơn chưa thanh toán, bước hoàn tiền được bỏ qua. Nếu đơn đã thanh toán,
mock payment cập nhật kết quả hoàn tiền theo chính sách của concert.
