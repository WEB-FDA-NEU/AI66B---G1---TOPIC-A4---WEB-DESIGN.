// Mock data for Concertly ticket orders

const MOCK_ORDERS = [
  {
    "orderId": "#CT-10482",
    "customer": "Nguyen Hoang Linh",
    "concert": "Eternal Sunshine Tour 2026",
    "amount": 350.0,
    "date": "Sep 17, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10481",
    "customer": "Pham Duc Anh",
    "concert": "Circus Maximus World Tour",
    "amount": 300.0,
    "date": "Sep 17, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10480",
    "customer": "Le Thi Quynh",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 420.0,
    "date": "Sep 16, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10479",
    "customer": "Tran Gia Han",
    "concert": "Ruby Solo Showcase - Live in Concert",
    "amount": 170.0,
    "date": "Sep 16, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10478",
    "customer": "Vu Minh Duc",
    "concert": "Eternal Sunshine Tour 2026",
    "amount": 80.0,
    "date": "Sep 15, 2026",
    "status": "Refunded"
  },
  {
    "orderId": "#CT-10477",
    "customer": "Nguyen Minh Chau",
    "concert": "The Eras Tour",
    "amount": 220.0,
    "date": "Sep 15, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10476",
    "customer": "Hoang Anh Tuan",
    "concert": "Circus Maximus World Tour",
    "amount": 120.0,
    "date": "Sep 14, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10475",
    "customer": "Do Khanh Linh",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 420.0,
    "date": "Sep 14, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10474",
    "customer": "Bui Quang Huy",
    "concert": "24K Magic World Tour",
    "amount": 85.0,
    "date": "Sep 13, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10473",
    "customer": "Pham Ngoc Mai",
    "concert": "Ruby Solo Showcase - Live in Concert",
    "amount": 170.0,
    "date": "Sep 13, 2026",
    "status": "Refunded"
  },
  {
    "orderId": "#CT-10472",
    "customer": "Nguyen Duc Long",
    "concert": "Eternal Sunshine Tour 2026",
    "amount": 350.0,
    "date": "Sep 12, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10471",
    "customer": "Tran Thu Trang",
    "concert": "The Midnight Echoes Tour",
    "amount": 60.0,
    "date": "Sep 12, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10470",
    "customer": "Le Hoang Nam",
    "concert": "The Eras Tour",
    "amount": 220.0,
    "date": "Sep 11, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10469",
    "customer": "Nguyen Phuong Anh",
    "concert": "Justice World Tour",
    "amount": 160.0,
    "date": "Sep 11, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10468",
    "customer": "Dang Minh Khang",
    "concert": "Circus Maximus World Tour",
    "amount": 300.0,
    "date": "Sep 10, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10467",
    "customer": "Vu Thanh Ha",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 180.0,
    "date": "Sep 10, 2026",
    "status": "Refunded"
  },
  {
    "orderId": "#CT-10466",
    "customer": "Phan Anh Thu",
    "concert": "Ruby Solo Showcase - Live in Concert",
    "amount": 170.0,
    "date": "Sep 09, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10465",
    "customer": "Hoang Minh Quan",
    "concert": "The Midnight Echoes Tour",
    "amount": 140.0,
    "date": "Sep 09, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10464",
    "customer": "Do Ngoc Ha",
    "concert": "Eternal Sunshine Tour 2026",
    "amount": 350.0,
    "date": "Sep 08, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10463",
    "customer": "Nguyen Quoc Bao",
    "concert": "ACT III: M.O.T.T.E World Tour",
    "amount": 210.0,
    "date": "Sep 08, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10462",
    "customer": "Pham Thanh Ngan",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 180.0,
    "date": "Sep 07, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10461",
    "customer": "Le Duc Thinh",
    "concert": "The Eras Tour",
    "amount": 220.0,
    "date": "Sep 07, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10460",
    "customer": "Vo Mai Phuong",
    "concert": "Alter Ego Exclusive Live Experience",
    "amount": 200.0,
    "date": "Sep 06, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10459",
    "customer": "Nguyen Hoai Nam",
    "concert": "24K Magic World Tour",
    "amount": 390.0,
    "date": "Sep 06, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10458",
    "customer": "Bui Ngoc Anh",
    "concert": "Justice World Tour",
    "amount": 160.0,
    "date": "Sep 05, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10457",
    "customer": "Tran Minh Khoi",
    "concert": "Love Yourself: Speak Yourself Tour",
    "amount": 280.0,
    "date": "Sep 05, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10456",
    "customer": "Hoang Thu Ha",
    "concert": "ACT III: M.O.T.T.E World Tour",
    "amount": 210.0,
    "date": "Sep 04, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10455",
    "customer": "Do Minh Quan",
    "concert": "The Midnight Echoes Tour",
    "amount": 140.0,
    "date": "Sep 04, 2026",
    "status": "Refunded"
  },
  {
    "orderId": "#CT-10454",
    "customer": "Nguyen Khanh Linh",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 420.0,
    "date": "Sep 03, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10453",
    "customer": "Pham Quang Huy",
    "concert": "Circus Maximus World Tour",
    "amount": 300.0,
    "date": "Sep 03, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10452",
    "customer": "Ly Bao Tram",
    "concert": "Eternal Sunshine Tour 2026",
    "amount": 150.0,
    "date": "Sep 02, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10451",
    "customer": "Vu Anh Kiet",
    "concert": "Alter Ego Exclusive Live Experience",
    "amount": 450.0,
    "date": "Sep 02, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10450",
    "customer": "Nguyen Thuy Tien",
    "concert": "Love Yourself: Speak Yourself Tour",
    "amount": 90.0,
    "date": "Sep 01, 2026",
    "status": "Refunded"
  },
  {
    "orderId": "#CT-10449",
    "customer": "Tran Gia Bao",
    "concert": "After Hours Til Dawn Stadium Tour",
    "amount": 420.0,
    "date": "Sep 01, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10448",
    "customer": "Le Ngoc Han",
    "concert": "The Eras Tour",
    "amount": 95.0,
    "date": "Aug 31, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10447",
    "customer": "Phan Duc Minh",
    "concert": "24K Magic World Tour",
    "amount": 180.0,
    "date": "Aug 31, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10446",
    "customer": "Doan Ha My",
    "concert": "Justice World Tour",
    "amount": 350.0,
    "date": "Aug 30, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10445",
    "customer": "Nguyen Tuan Anh",
    "concert": "ACT III: M.O.T.T.E World Tour",
    "amount": 420.0,
    "date": "Aug 30, 2026",
    "status": "Paid"
  },
  {
    "orderId": "#CT-10444",
    "customer": "Hoang Yen Nhi",
    "concert": "Ruby Solo Showcase - Live in Concert",
    "amount": 170.0,
    "date": "Aug 29, 2026",
    "status": "Pending"
  },
  {
    "orderId": "#CT-10443",
    "customer": "Dang Quoc Viet",
    "concert": "The Midnight Echoes Tour",
    "amount": 260.0,
    "date": "Aug 29, 2026",
    "status": "Paid"
  }
];
