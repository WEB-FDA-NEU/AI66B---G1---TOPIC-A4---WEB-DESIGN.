# Test Plan & Verification for US02 (Issue #3)

## 1. Mock Data Integration
- File: `js/mock-data.js`
- Verified valid JS object structure with 5 international concerts.
- Checked verified direct image links (poster & banner).

## 2. Screen Verification
- **404 Page (`pages/404.html`)**: Renders custom dark theme error message and functional "Back to Home" CTA.
- **Home Page (`index.html`)**: Dynamic rendering of trending concert cards, navigation bar, and hero banner.
- **Explore Page (`pages/concerts/index.html`)**: Dynamic listing with live keyword search and genre filtering (All, Pop, R&B, Hip-Hop, K-Pop).
- **Detail Page (`pages/concerts/detail.html`)**: Dynamic parameter reading via URL query (`?id=...`), ticket tier rendering, and 404 redirect fallback for invalid IDs.

## 3. Responsive Design
- Validated on desktop, tablet, and mobile viewports (< 768px).