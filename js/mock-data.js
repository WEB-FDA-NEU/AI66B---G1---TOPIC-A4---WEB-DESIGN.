// js/mock-data.js
const MOCK_CONCERTS = [
  {
    id: "c1",
    title: "Eternal Sunshine Tour 2026",
    artist: "Ariana Grande",
    date: "2026-11-20",
    time: "20:00",
    published: true,
    saleStart: "2026-09-20T00:00",
    cancelled: false,
    location: "My Dinh National Stadium, Hanoi",
    priceRange: "$80 - $350",
    poster: "https://media.vogue.co.jp/photos/696ce3e747fe9213e055c6e5/1:1/w_1800,h_1800,c_limit/7-ARIANA-GRANDE-voguejapan.jpg",
    banner: "https://www.nme.com/wp-content/uploads/2024/03/Ariana-Grande-review-header-Katia-Temkin.jpg",
    category: "Pop",
    status: "Selling Fast",
    description: "Experience Ariana Grande live on stage with her chart-topping global hits, breathtaking vocals, and an immersive stage production.",
    tickets: [
      { type: "Standard Tier 2", price: "$80", status: "Available" },
      { type: "Standard Tier 1", price: "$150", status: "Available" },
      { type: "VIP Diamond Experience", price: "$350", status: "Limited" }
    ]
  },
  {
    id: "c2",
    title: "After Hours Til Dawn Stadium Tour",
    artist: "The Weeknd",
    date: "2026-12-05",
    time: "19:30",
    published: true,
    saleStart: "2026-08-01T00:00",
    cancelled: false,
    location: "Quan Khu 7 Stadium, Ho Chi Minh City",
    priceRange: "$90 - $420",
    poster: "https://m.media-amazon.com/images/I/51akaUj0S6L._AC_UF894,1000_QL80_.jpg",
    banner: "https://www.socanmagazine.ca/wp-content/uploads/2022/09/TheWeeknd_LiveAtRogersCentre_2022_ByBradArdley_1-1024x459.jpg",
    category: "R&B",
    status: "Hot",
    description: "An electric stadium experience featuring The Weeknd's cinematic visuals, synth-pop classics, and hypnotic R&B anthems.",
    tickets: [
      { type: "General Admission Standing", price: "$90", status: "Available" },
      { type: "Cat 1 Seated", price: "$180", status: "Limited" },
      { type: "VIP After Hours Lounge", price: "$420", status: "Sold Out" }
    ]
  },
  {
    id: "c3",
    title: "Circus Maximus World Tour",
    artist: "Travis Scott",
    date: "2026-10-18",
    time: "20:30",
    published: true,
    saleStart: "2026-10-01T00:00",
    cancelled: false,
    location: "National Convention Center, Hanoi",
    priceRange: "$75 - $300",
    poster: "https://compass-media.vogue.it/photos/5c2c9d0e8172c6727647e7a9/2:3/w_2560%2Cc_limit/Sequenza-UV-103.jpg",
    banner: "https://wallpapers.com/images/featured/travis-scott-concert-77so7jvq2d74pgs9.jpg",
    category: "Hip-Hop",
    status: "High Demand",
    description: "Brace yourself for pure adrenaline, heavy bass, and high-energy mosh pits as Travis Scott brings Utopia to life.",
    tickets: [
      { type: "Floor Standing Mosh", price: "$75", status: "Available" },
      { type: "Balcony Seating", price: "$120", status: "Available" },
      { type: "Cactus Jack VIP Pass", price: "$300", status: "Limited" }
    ]
  },
  {
    id: "c4",
    title: "Ruby Solo Showcase - Live in Concert",
    artist: "Jennie",
    date: "2026-11-28",
    time: "19:00",
    published: true,
    saleStart: "2026-09-01T00:00",
    cancelled: false,
    location: "Saigon Exhibition and Convention Center, HCMC",
    priceRange: "$85 - $380",
    poster: "https://image.starnewskorea.com/cdn-cgi/image/f=avif,w=860/21/2026/05/2026052617370323365_1.jpg",
    banner: "https://i0.wp.com/kstationtv.com/wp-content/uploads/2025/03/Capture-decran-2025-03-07-222459.png?fit=1024%2C468&ssl=1",
    category: "K-Pop",
    status: "Selling Fast",
    description: "The global fashion and music icon Jennie takes the spotlight with sensational solo performances, dazzling choreography, and chic visuals.",
    tickets: [
      { type: "General Floor Standing", price: "$85", status: "Available" },
      { type: "Lower Bowl Seated", price: "$170", status: "Available" },
      { type: "OA VIP Soundcheck Package", price: "$380", status: "Limited" }
    ]
  },
  {
    id: "c5",
    title: "Alter Ego Exclusive Live Experience",
    artist: "Lisa",
    date: "2026-12-15",
    time: "20:00",
    published: false,
    saleStart: null,
    cancelled: false,
    location: "My Dinh Indoor Athletics Arena, Hanoi",
    priceRange: "$95 - $450",
    poster: "https://kenh14cdn.com/203336854389633024/2021/8/29/title-16302503606451337225511.jpeg",
    banner: "https://cdn2.tuoitre.vn/471584752817336320/data/teen360/pictures/2021/08/26/1629981430_236722463_377598043730003_7359485805446615495_n.jpg",
    category: "K-Pop",
    status: "Hot",
    description: "Witness Lisa's explosive stage presence, fierce rap verses, and electrifying choreography on her milestone solo world tour.",
    tickets: [
      { type: "Rockstar Standing Zone", price: "$95", status: "Available" },
      { type: "Tier 1 Center Seated", price: "$200", status: "Limited" },
      { type: "LLOUD Ultimate VIP Meet & Greet", price: "$450", status: "Sold Out" }
    ]
  }
];