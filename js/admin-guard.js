document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  // Hàm hỗ trợ chuyển hướng về trang login giống code cũ của bạn
  const requireLogin = () => {
    window.location.replace(new URL("../auth/login.html", window.location.href));
  };

  // 1. Không có token -> Văng ra login
  if (!token) {
    requireLogin();
    return;
  }

  try {
    // 2. Gọi API kiểm tra token thật
    const response = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.ok) {
      const userData = await response.json();
      
      // 3. Có token nhưng role không phải admin -> Văng ra login
      if (userData.role !== "admin") {
        requireLogin();
      }
      // Nếu là admin thì kịch bản kết thúc, cho phép ở lại trang
    } else {
      // 4. Token hết hạn hoặc sai -> Xóa token cũ, văng ra login
      localStorage.removeItem("token");
      requireLogin();
    }
  } catch (error) {
    console.error("Lỗi xác thực Admin:", error);
    requireLogin();
  }
});