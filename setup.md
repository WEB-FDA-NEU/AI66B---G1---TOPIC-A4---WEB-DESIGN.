# Hướng dẫn cài đặt & chạy Concertly (local)

Tài liệu này dành cho hai trường hợp:

- **A. Máy đã từng chạy project** (đã có Python, PostgreSQL, đã clone repo) → xem [Phần A](#a-máy-đã-chạy-project-trước-đây).
- **B. Máy mới hoàn toàn** → làm lần lượt [Phần B](#b-máy-mới-hoàn-toàn) từ bước 1.

Sau khi xong, hệ thống gồm:

| Thành phần | Địa chỉ |
| --- | --- |
| Backend API (FastAPI) | http://localhost:8000/api |
| Tài liệu API (Swagger) | http://localhost:8000/docs |
| Frontend (HTML/CSS/JS tĩnh) | http://localhost:5500/index.html |
| Database | PostgreSQL, database `concertly` |

> **Branch:** backend + các trang đã nối API hiện nằm trên chuỗi branch `feat/34-…` → `feat/38-admin-dashboard-checkin`
> (đang chờ merge vào `main`). Cho tới khi các PR được merge, hãy chạy trên branch
> `feat/38-admin-dashboard-checkin` — branch này chứa đầy đủ seed, API admin, check-in, login và các trang đã tích hợp.
> Sau khi merge thì dùng `main`.

---

## Yêu cầu phần mềm

| Phần mềm | Phiên bản | Ghi chú |
| --- | --- | --- |
| Git | bất kỳ | |
| Python | **3.12** (đã kiểm thử 3.12.3; 3.11+ là đủ) | nhớ tick *Add python.exe to PATH* khi cài trên Windows |
| PostgreSQL | **15 trở lên** (đã kiểm thử 17 và 18) | cần cả `psql` (đi kèm bộ cài) |
| Trình duyệt | Chrome / Edge / Firefox | |

Không cần Node.js để chạy project.

> Quy ước lệnh: khối **PowerShell** cho Windows, khối **bash** cho macOS/Linux (hoặc Git Bash trên Windows).
> Mọi lệnh đều chạy từ **thư mục gốc repo** trừ khi có ghi `cd backend`.

---

## B. Máy mới hoàn toàn

### 1. Cài phần mềm

**Windows**

1. Python 3.12: https://www.python.org/downloads/ → tick **Add python.exe to PATH**.
2. PostgreSQL: https://www.postgresql.org/download/windows/ (bộ cài EDB). Ghi nhớ **mật khẩu user `postgres`** bạn đặt lúc cài; giữ cổng mặc định **5432**.
3. Git: https://git-scm.com/download/win

`psql` thường **không** có sẵn trong PATH. Hoặc thêm `C:\Program Files\PostgreSQL\17\bin` vào PATH, hoặc gọi bằng đường dẫn đầy đủ:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
```

(thay `17` bằng phiên bản bạn cài).

**macOS** (Homebrew)

```bash
brew install python@3.12 postgresql@17 git
brew services start postgresql@17
```

**Ubuntu / Debian**

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip postgresql postgresql-contrib git
sudo systemctl enable --now postgresql
```

### 2. Lấy mã nguồn

```bash
git clone https://github.com/WEB-FDA-NEU/AI66B---G1---TOPIC-A4---WEB-DESIGN..git concertly
cd concertly
git checkout feat/38-admin-dashboard-checkin   # hoặc main sau khi các PR đã merge
```

### 3. Tạo database

Tạo database `concertly` (dùng để chạy app) và `concertly_test` (chỉ dùng cho test — **test sẽ xoá sạch database này**).

**Windows (PowerShell)** — nhập mật khẩu `postgres` khi được hỏi:

```powershell
$PSQL = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
& $PSQL -U postgres -h localhost -c "CREATE DATABASE concertly;"
& $PSQL -U postgres -h localhost -c "CREATE DATABASE concertly_test;"
```

**macOS**

```bash
createdb concertly
createdb concertly_test
```

**Linux** (user `postgres` của hệ điều hành; đặt mật khẩu cho role `postgres` để app kết nối qua TCP):

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'doi-mat-khau-nay';"
sudo -u postgres createdb concertly
sudo -u postgres createdb concertly_test
```

### 4. Môi trường Python cho backend

```powershell
# Windows
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

```bash
# macOS / Linux
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

> Nếu PowerShell báo *running scripts is disabled*: chạy `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` một lần rồi kích hoạt lại.
> Mỗi lần mở terminal mới để chạy backend, nhớ **kích hoạt lại venv**.

`requirements-dev.txt` cài cả thư viện chạy app (`requirements.txt`) lẫn `pytest`, `httpx` cho test.

### 5. Tạo file `backend/.env`

Backend **chỉ đọc `backend/.env`** (không phải `backend/app/.env`). File này đã nằm trong `.gitignore` — **không bao giờ commit nó**.

```powershell
# Windows (đang ở thư mục backend)
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # copy kết quả làm JWT_SECRET
notepad .env
```

```bash
# macOS / Linux (đang ở thư mục backend)
cp .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"   # copy kết quả làm JWT_SECRET
nano .env
```

Nội dung tối thiểu (thay giá trị trong `<...>`):

```dotenv
DATABASE_URL=postgresql://postgres:<mat-khau-postgres>@localhost:5432/concertly
JWT_SECRET=<chuoi-ngau-nhien-vua-tao>

# Mật khẩu cho tài khoản mẫu do seed tạo (chỉ dùng lúc tài khoản được tạo lần đầu)
SEED_ADMIN_PASSWORD=<mat-khau-admin>
SEED_USER_PASSWORD=<mat-khau-user-mau>
```

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | ✔ | Chuỗi kết nối PostgreSQL. `postgresql://` hoặc `postgres://` đều được. Mật khẩu có ký tự đặc biệt (`@`, `#`, `/`…) phải URL-encode, ví dụ `@` → `%40`. |
| `JWT_SECRET` | ✔ | Khoá ký token đăng nhập. Thiếu biến này thì đăng nhập lỗi 500. Mỗi máy/môi trường một giá trị riêng. |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | nên có | Mật khẩu tài khoản mẫu. Bỏ trống thì seed **tự sinh mật khẩu ngẫu nhiên và in ra một lần** — hãy lưu lại. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | | Thời hạn token, mặc định 60 phút. |
| `CORS_ORIGINS` | | Mặc định `*` (cho phép mọi origin) — đủ cho local. |
| `ALLOW_DEV_USER_HEADER` | | Chỉ để debug: `=1` cho phép gọi API bằng header `X-User-Id` không cần đăng nhập. **Không bật khi deploy.** |

Kiểm tra kết nối:

```bash
python test_db.py      # mong đợi: Database connection successful: SELECT 1
```

### 6. Tạo bảng (schema)

Chạy **một lần** trên database trống (lệnh an toàn nếu chạy lại: chỉ tạo những gì chưa có).

```powershell
# Windows (đang ở thư mục backend)
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d concertly -f schema.sql
```

```bash
# macOS / Linux (đang ở thư mục backend)
psql -h localhost -U postgres -d concertly -f schema.sql
```

### 7. Nạp dữ liệu mẫu (seed)

```bash
python scripts/seed.py --check   # chỉ kiểm tra seed_data.json, không đụng DB
python scripts/seed.py           # nạp dữ liệu
```

Kết quả lần đầu:

```
Created admin admin@concertly.dev (password from $SEED_ADMIN_PASSWORD)
Created customer minhanh@concertly.dev (password from $SEED_USER_PASSWORD)
Created customer quocbao@concertly.dev (password from $SEED_USER_PASSWORD)
Seed complete. Created: 3 users, 11 concerts, 33 zones, 7200 seats, 14 orders, 19 tickets.
```

Seed **chạy lại bao nhiêu lần cũng được** — lần sau sẽ báo `Created: nothing (already seeded)` và không ghi đè dữ liệu đã thay đổi.
Dùng `--no-sample-orders` nếu chỉ muốn concert + tài khoản admin (không có user/đơn hàng mẫu).

Tài khoản sau khi seed:

| Email | Vai trò | Mật khẩu |
| --- | --- | --- |
| `admin@concertly.dev` | admin | giá trị `SEED_ADMIN_PASSWORD` |
| `minhanh@concertly.dev` | customer (7 đơn mẫu) | giá trị `SEED_USER_PASSWORD` |
| `quocbao@concertly.dev` | customer (7 đơn mẫu) | giá trị `SEED_USER_PASSWORD` |

> Bỏ qua file cũ `backend/seed.py` / `seed_concerts.json` (seed tạm thời trước đây, tạo user không đăng nhập được). Luôn dùng `scripts/seed.py`.

### 8. Chạy backend

```bash
# đang ở thư mục backend, venv đã kích hoạt
uvicorn app.main:app --reload --port 8000
```

Kiểm tra: mở http://localhost:8000/api/health (→ `{"status":"ok"}`) và http://localhost:8000/docs.

Giữ cửa sổ terminal này mở.

### 9. Chạy frontend

Frontend là file tĩnh, cần phục vụ qua HTTP (không mở trực tiếp bằng `file://`). Mở **terminal thứ hai** ở **thư mục gốc repo**:

```bash
python -m http.server 5500
```

hoặc dùng extension **Live Server** của VS Code (mặc định cũng cổng 5500).

Mở http://localhost:5500/index.html.

Frontend gọi API tại `http://localhost:8000/api` (cấu hình trong `js/api.js`). Nếu backend chạy ở địa chỉ khác, khai báo trước khi nạp `api.js`:

```html
<script>window.CONCERTLY_API_BASE = "https://ten-backend-cua-ban/api";</script>
```

### 10. Kiểm tra nhanh mọi thứ hoạt động

1. **Sign in** bằng `minhanh@concertly.dev` → menu tài khoản → **My Orders**: thấy 7 đơn; **My Tickets**: thấy vé + mã QR.
2. Đăng xuất, **Sign in** bằng `admin@concertly.dev` → tự chuyển tới **Admin Dashboard**: Total Revenue `$2,510`, Tickets Sold `16`, Total Orders `14`, Total Concerts `11`.
3. **Check-in** → chọn concert → bấm **Check in** cho một vé → số "Checked in" tăng, tải lại trang vẫn giữ.

### 11. Chạy test backend (tuỳ chọn)

Test cần PostgreSQL thật và **xoá/tạo lại toàn bộ bảng** trong database test, nên `TEST_DATABASE_URL` bắt buộc trỏ tới database có chữ `test` trong tên (bộ test tự từ chối database khác).

```powershell
# Windows (thư mục backend, venv đã kích hoạt)
$env:TEST_DATABASE_URL = "postgresql://postgres:<mat-khau>@localhost:5432/concertly_test"
pytest -q
```

```bash
# macOS / Linux
TEST_DATABASE_URL="postgresql://postgres:<mat-khau>@localhost:5432/concertly_test" pytest -q
```

Kết quả mong đợi: `151 passed`.

---

## A. Máy đã chạy project trước đây

Máy này đã có Python, PostgreSQL và repo. Chỉ cần cập nhật code, thư viện, `.env` và dữ liệu.

### 1. Cập nhật code

```bash
git status                     # đảm bảo không còn thay đổi chưa commit
git fetch origin
git checkout feat/38-admin-dashboard-checkin   # hoặc main sau khi các PR đã merge
git pull
```

### 2. Cài thư viện mới

Backend vừa thêm `bcrypt`, `PyJWT`, `python-multipart`, `segno`:

```bash
cd backend
# kích hoạt venv như Bước B4 (nếu bạn dùng venv), rồi:
pip install -r requirements-dev.txt
```

### 3. Kiểm tra `backend/.env`

- Backend đọc **`backend/.env`**. Nếu bạn từng để cấu hình ở `backend/app/.env` thì file đó **không được dùng** — chuyển các biến sang `backend/.env` (rồi có thể xoá file cũ).
- Đảm bảo `backend/.env` có đủ các biến ở [Bước B5](#5-tạo-file-backendenv), đặc biệt **`JWT_SECRET`** (mới, bắt buộc cho đăng nhập) và `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD`.

### 4. Dữ liệu: dùng lại hay làm mới?

- **Database chưa có bảng** → làm [Bước B6](#6-tạo-bảng-schema) và [B7](#7-nạp-dữ-liệu-mẫu-seed).
- **Database đã có bảng nhưng chưa có dữ liệu** → chỉ cần [B7](#7-nạp-dữ-liệu-mẫu-seed).
- **Database đã từng chạy seed cũ `backend/seed.py`** (có user `demo@concertly.dev` / `staff@concertly.dev`, mỗi khu vực chỉ 50 ghế) → nên **làm mới database local**, vì seed mới không sửa dữ liệu đã có nên sức chứa sẽ không khớp:

  ```powershell
  # Windows — XOÁ TOÀN BỘ dữ liệu trong database local "concertly"
  $PSQL = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  & $PSQL -U postgres -h localhost -c "DROP DATABASE IF EXISTS concertly;"
  & $PSQL -U postgres -h localhost -c "CREATE DATABASE concertly;"
  cd backend
  & $PSQL -U postgres -h localhost -d concertly -f schema.sql
  python scripts/seed.py
  ```

  ```bash
  # macOS / Linux — XOÁ TOÀN BỘ dữ liệu trong database local "concertly"
  dropdb --if-exists -h localhost -U postgres concertly
  createdb -h localhost -U postgres concertly
  cd backend
  psql -h localhost -U postgres -d concertly -f schema.sql
  python scripts/seed.py
  ```

  > Chỉ làm việc này với database **local** của bạn, không bao giờ với database chung của nhóm hay production.

### 5. Chạy

Làm [Bước B8](#8-chạy-backend) (backend), [B9](#9-chạy-frontend) (frontend) và kiểm tra theo [B10](#10-kiểm-tra-nhanh-mọi-thứ-hoạt-động).

> Tài khoản mock cũ `admin` / `admin123` **không còn dùng được**; đăng nhập admin bằng `admin@concertly.dev`.
> Nếu trình duyệt còn phiên đăng nhập mock cũ, bấm **Log out** (hoặc xoá localStorage của `localhost:5500`) rồi đăng nhập lại.

---

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
| --- | --- |
| `RuntimeError: DATABASE_URL is not set` | Chưa có `backend/.env`, hoặc đang để ở `backend/app/.env`, hoặc chạy lệnh ngoài thư mục `backend`. |
| `password authentication failed for user "postgres"` | Sai mật khẩu trong `DATABASE_URL`; mật khẩu có ký tự đặc biệt cần URL-encode. |
| `connection refused` cổng 5432 | PostgreSQL chưa chạy. Windows: *Services* → `postgresql-x64-17` → Start. macOS: `brew services start postgresql@17`. Linux: `sudo systemctl start postgresql`. |
| `relation "users" does not exist` | Chưa chạy `schema.sql` (Bước B6). |
| Đăng nhập báo lỗi 500 | Thiếu `JWT_SECRET` trong `backend/.env`; thêm rồi khởi động lại uvicorn. |
| "Incorrect email or password" với tài khoản seed | Mật khẩu là giá trị `SEED_*_PASSWORD` **lúc tài khoản được tạo lần đầu**; đổi biến sau đó không đổi mật khẩu. Làm mới database (Phần A, bước 4) để tạo lại. |
| Trang hiện "Cannot reach the Concertly server" | Backend chưa chạy ở cổng 8000, hoặc `CONCERTLY_API_BASE` sai. |
| Trang tài khoản/admin cứ quay về trang đăng nhập | Token hết hạn (60 phút) hoặc chưa đăng nhập — đăng nhập lại. |
| Chọn ghế / checkout báo 401 | Cần đăng nhập trước khi đặt vé. |
| `'psql' is not recognized` (Windows) | Dùng đường dẫn đầy đủ `C:\Program Files\PostgreSQL\<phiên bản>\bin\psql.exe` hoặc thêm thư mục `bin` vào PATH. |
| `pytest` báo `TEST_DATABASE_URL must point at a database whose name contains 'test'` | Cơ chế bảo vệ: trỏ biến này tới `concertly_test`, không phải `concertly`. |
| Cổng 8000 / 5500 đã bị dùng | Đổi cổng: `uvicorn ... --port 8001` (nhớ đặt `CONCERTLY_API_BASE` tương ứng) hoặc `python -m http.server 5501`. |
| Ảnh poster không hiện | Ảnh lấy từ website bên ngoài; một số trang chặn hotlink. Không ảnh hưởng chức năng. |
