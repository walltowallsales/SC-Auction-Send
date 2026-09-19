SellerChamp Auction Inventory V1.10

Adds an automatic elapsed-time stopwatch during inventory loads and explicitly marks marketplace listings as manually removed when sending inventory to auction, while retaining verification and tag safety checks.


## V1.10 marketplace ending fix
SellerChamp's documented product DELETE endpoint is now used with `delete_product=false` and `end_listing_on_marketplace=true`. This ends the marketplace listing without deleting the SellerChamp product. The app polls SellerChamp for confirmation before removing the auction tag and adding `Sent to Auction`.


## V1.10 design update
- More prominent location headers
- Product images 35% larger on mobile and desktop
- SKU moved above title; digits 5 through 10 are bold/blue
- Quantity-by-location controls tightened and aligned to the right
- Added View in SellerChamp button
- No Print Label button
- SellerChamp V1.9 quantity, listing-end, tag, cache, PIN, and stopwatch behavior preserved


## V1.11 browser cache
Auction inventory is saved in the browser. On later visits the saved list displays immediately while a fresh SellerChamp scan runs in the background. Successful quantity and auction actions update the browser cache immediately. No paid Render disk is required.
