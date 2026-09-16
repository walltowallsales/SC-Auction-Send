# SellerChamp Auction Inventory V1.4

Fixes SellerChamp tag detection by reading the `tags_array` field discovered by the diagnostic. The inventory loader now scans only paginated product-list responses and requests inventory-location details only for matching `auction` / `auction some` products. It no longer fetches every full product record.

Render: Build `npm install`; Start `npm start`. Environment variables: `SELLERCHAMP_API_TOKEN`, `APP_PIN`.
