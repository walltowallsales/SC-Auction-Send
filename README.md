# SellerChamp Auction Inventory V1.5

Changes from V1.4:
- In-memory server cache: normal app opens reuse the latest successful scan immediately.
- Refresh button forces a fresh SellerChamp scan.
- Displays Last updated time.
- Expanded SellerChamp image-field detection and, only for matching auction products missing an image in the list response, checks the full product record for an image.
- Cache is updated after quantity / Send Some / Send All actions.

Render:
- Build Command: npm install
- Start Command: npm start
- Environment: SELLERCHAMP_API_TOKEN and APP_PIN
