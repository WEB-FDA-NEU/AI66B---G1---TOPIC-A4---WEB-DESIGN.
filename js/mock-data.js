const MOCK_CONCERTS = [
  {
    id: "c1",
    title: "Eternal Sunshine Tour 2026",
    artist: "Ariana Grande",
    date: "2026-11-20",
    time: "20:00",
    location: "Madison Square Garden, New York, USA",
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
    id: "c11",
    title: "The Midnight Echoes Tour",
    artist: "Cortis",
    date: "2027-02-14",
    time: "20:00",
    location: "Royal Albert Hall, London, UK",
    priceRange: "$60 - $260",
    poster: "https://images.squarespace-cdn.com/content/v1/605c6aa462ce2d326bb1cb7b/1786647706446-0N3H170KONFOADS2YYWM/2.jpg",
    banner: "https://cdn2.tuoitre.vn/471584752817336320/2025/12/15/cortis4-1765788082717358285352.jpg",
    category: "K-Pop",
    status: "Selling Fast",
    description: "An intimate night of deep synthwave, evocative vocals, and atmospheric live arrangements for an unforgettable Valentine's concert.",
    tickets: [
      { type: "Balcony Seated", price: "$60", status: "Available" },
      { type: "Front Row Orchestra", price: "$140", status: "Available" },
      { type: "Midnight VIP Pass", price: "$260", status: "Selling Fast" }
    ]
  },
  {
    id: "c2",
    title: "After Hours Til Dawn Stadium Tour",
    artist: "The Weeknd",
    date: "2026-12-05",
    time: "19:30",
    location: "SoFi Stadium, Los Angeles, USA",
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
    location: "Allianz Arena, Munich, Germany",
    priceRange: "$75 - $300",
    poster: "https://static.wixstatic.com/media/57e354_bc294554b9b84f4da9015ff07a9e2813~mv2.jpg/v1/fill/w_1000,h_563,al_c,q_85,usm_0.66_1.00_0.01/57e354_bc294554b9b84f4da9015ff07a9e2813~mv2.jpg",
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
    location: "Tokyo Dome, Tokyo, Japan",
    priceRange: "$85 - $380",
    poster: "https://www.acfc.com.vn/acfc_wp/wp-content/uploads/2026/01/image-20.png",
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
    location: "Rajamangala National Stadium, Bangkok, Thailand",
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
  },
  {
    id: "c6",
    title: "The Eras Tour",
    artist: "Taylor Swift",
    date: "2026-11-14",
    time: "19:00",
    location: "Wembley Stadium, London, UK",
    priceRange: "$95 - $490",
    poster: "https://s2.r29static.com/bin/entry/4b0/720x864,85/2218651/image.webp",
    banner: "https://marieclaire.vn/media/full/2025/11/1762689433_taylor_swift_bien_am_nhac_thanh_tuyen_ngon_nu_quyen_thumb-jpg.jpg",
    category: "Pop",
    status: "Selling Fast",
    description: "Experience every era of Taylor Swift's historic discography in a breathtaking, multi-hour stadium masterpiece.",
    tickets: [
      { type: "Standard Floor GA", price: "$95", status: "Available" },
      { type: "Lower Bowl Reserved", price: "$220", status: "Limited" },
      { type: "Karma Is My Boyfriend VIP", price: "$490", status: "Sold Out" }
    ]
  },
  {
    id: "c7",
    title: "24K Magic World Tour",
    artist: "Bruno Mars",
    date: "2026-12-12",
    time: "20:00",
    location: "Singapore National Stadium, Singapore",
    priceRange: "$85 - $390",
    poster: "https://retropopmagazine.com/wp-content/uploads/2026/01/Bruno-Mars-The-Romantic-I-Just-Might-Press-Handout-2026-4.jpeg",
    banner: "https://www.allegiantstadium.com/assets/img/Static_Digital_800x500_BrunoMars_2026_Regional_AllegiantStadium_0410-1fc3d6f0cd.jpg",
    category: "Pop",
    status: "Hot",
    description: "An explosive night of funk, soul, and pure pop showmanship brought to life by Bruno Mars and the Hooligans.",
    tickets: [
      { type: "Silver Tribune", price: "$85", status: "Available" },
      { type: "Gold Standing Pit", price: "$180", status: "Available" },
      { type: "24K Magic VIP Experience", price: "$390", status: "Limited" }
    ]
  },
  {
    id: "c8",
    title: "Justice World Tour",
    artist: "Justin Bieber",
    date: "2026-12-24",
    time: "19:30",
    location: "Mercedes-Benz Arena, Berlin, Germany",
    priceRange: "$75 - $350",
    poster: "https://cdn2.tuoitre.vn/thumb_w/730/471584752817336320/2026/2/4/49e12861b96737396e76-1770177690443746537378.jpg",
    banner: "https://i8.amplience.net/i/naras/justin_bieber_performer_announcement_2026_grammys_hero_1644x925",
    category: "Pop",
    status: "Selling Fast",
    description: "Celebrate Christmas Eve with Justin Bieber performing massive anthems from Justice and his record-breaking catalog.",
    tickets: [
      { type: "General Admission", price: "$75", status: "Available" },
      { type: "Belieber Standing Pit", price: "$160", status: "Available" },
      { type: "Ghost VIP Lounge", price: "$350", status: "Limited" }
    ]
  },
  {
    id: "c9",
    title: "Love Yourself: Speak Yourself Tour",
    artist: "BTS",
    date: "2027-01-09",
    time: "18:30",
    location: "Seoul Olympic Stadium, Seoul, South Korea",
    priceRange: "$90 - $550",
    poster: "https://m.media-amazon.com/images/M/MV5BYzU5NjA3Y2YtY2UwZi00ZDMwLWE5NjAtOTljNTA4NTI4ZjYyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
    banner: "https://i.scdn.co/image/ab67616d0000b273ba4fa604f046ff824331f4f4",
    category: "K-Pop",
    status: "Hot",
    description: "The historic stadium tour of BTS featuring synchronized choreography, stunning visual stages, and anthems of self-love.",
    tickets: [
      { type: "CAT 3 Seating", price: "$90", status: "Available" },
      { type: "Soundcheck Standing", price: "$280", status: "Limited" },
      { type: "ARMY Ultimate VIP Pass", price: "$550", status: "Sold Out" }
    ]
  },
  {
    id: "c10",
    title: "ACT III: M.O.T.T.E World Tour",
    artist: "G-Dragon",
    date: "2027-01-22",
    time: "20:00",
    location: "Kyocera Dome Osaka, Osaka, Japan",
    priceRange: "$85 - $420",
    poster: "https://vcdn1-giaitri.vnecdn.net/2025/11/14/G-dragon-1763088129-2463-1763088149.jpg?w=1020&h=0&q=100&dpr=2&fit=crop&s=4m6EzLXVDe4_2PRvpE-OQA",
    banner: "https://cdn-images.vtv.vn/zoom/700_390/66349b6076cb4dee98746cf1/2025/02/08/1738988634-20250207-gd-52491352916461466283040-74311170467851099440769.jpg",
    category: "K-Pop",
    status: "Selling Fast",
    description: "Witness the sheer magnetism and avant-garde artistry of G-Dragon in a dramatic, crimson-lit live performance.",
    tickets: [
      { type: "Standard Tier", price: "$85", status: "Available" },
      { type: "Coup D'Etat Pit", price: "$210", status: "Limited" },
      { type: "One of a Kind VIP", price: "$420", status: "Limited" }
    ]
  }
];