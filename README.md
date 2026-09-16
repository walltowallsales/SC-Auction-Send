# SellerChamp Auction Inventory V1.6

Fixes SellerChamp tag writes by using the confirmed `tags_array` product field.

For a completed auction item the app preserves unrelated tags, removes `auction` / `auction some`, and adds `Sent to Auction`.

Render:
- Build command: `npm install`
- Start command: `npm start`
- Environment: `SELLERCHAMP_API_TOKEN`, `APP_PIN`
