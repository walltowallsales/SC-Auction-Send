# SellerChamp Auction Inventory V1.0

A separate SellerChamp/Render app for products tagged `auction` or `auction some`.

## Render environment variables

- `SELLERCHAMP_API_TOKEN` — your existing SellerChamp API token
- `APP_PIN` — the PIN you want to use

The PIN login cookie lasts 30 days on that browser/device.

## Workflow

- Items are scanned from SellerChamp, filtered for `auction` / `auction some`, and sorted by location.
- Quantity can be adjusted per SellerChamp inventory location.
- `auction some`: **Send Some** subtracts the entered amount and leaves the tag in place while any quantity remains.
- At total quantity 0: the app requests inactive listing status, removes `auction` / `auction some`, adds `Sent to Auction`, and the item disappears from this app.
- **Send to Auction / Send ALL Remaining** sets all locations to zero and runs the same finalization.

## Important first-live-use check

SellerChamp's public Help Center confirms tags are product data, but does not publish the exact listing-end API operation. This package uses the product update operation supported by the existing Returns app and verifies SellerChamp reports the listing inactive before it removes the auction tag. If SellerChamp does not accept that inactive-status update on your account, the item stays tagged and visible for follow-up instead of silently disappearing.

## Deploy

Upload all files to a new GitHub repository, create a Render Web Service, and use:

- Build command: `npm install`
- Start command: `npm start`

Then add the two environment variables above.
