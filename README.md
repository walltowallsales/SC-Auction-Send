SellerChamp Auction Inventory V1.9

Adds an automatic elapsed-time stopwatch during inventory loads and explicitly marks marketplace listings as manually removed when sending inventory to auction, while retaining verification and tag safety checks.


## V1.9 marketplace ending fix
SellerChamp's documented product DELETE endpoint is now used with `delete_product=false` and `end_listing_on_marketplace=true`. This ends the marketplace listing without deleting the SellerChamp product. The app polls SellerChamp for confirmation before removing the auction tag and adding `Sent to Auction`.
