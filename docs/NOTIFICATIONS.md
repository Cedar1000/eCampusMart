# Notifications

The server tells users about events in three ways:

- **Push:** through Expo's push service. Chat pushes only go to users who are offline. Every other push goes out whether the user is online or not; while the app is open, show those as a banner.
- **Saved notifications:** rows for the Notifications screen, kept for later, including ones that arrived while the app was closed.
- **Socket:** each saved notification is also sent as a `notification` event to a user who is connected.

## Contents

- [Saving a token](#saving-a-token)
- [Removing a token](#removing-a-token)
- [What a push looks like](#what-a-push-looks-like)
- [Push types](#push-types)
- [The Notifications screen](#the-notifications-screen)
- [Rating an order](#rating-an-order)
- [Reviews](#reviews)

## Saving a token

`POST /notifications/push-tokens` (Bearer)

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "android" }
```

- `token` must be an Expo push token (`ExponentPushToken[…]`), and `platform` is `ios` or `android`. Anything else gets a `400`.
- Send it after every sign-in and whenever the token changes.
- **Response:** `201` for a token the server didn't have, `200` for one it did. No body.
- **Several phones:** a user can have any number of tokens.
- **Shared phones:** a token belongs to one user at a time. If someone else was signed in on the phone, the token moves to the user who just sent it.

## Removing a token

`DELETE /notifications/push-tokens` (Bearer)

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

- Send it on sign-out, so the next person on the phone doesn't get this user's pushes.
- **Response:** always `204`, including for a token that's already gone.
- Only removes the signed-in user's own token.

Tokens of phones that uninstalled the app are removed by the server when Expo reports them as `DeviceNotRegistered`.

## What a push looks like

```json
{
  "to": "ExponentPushToken[…]",
  "title": "Grace Drinks",
  "body": "Is this still available?",
  "sound": "default",
  "channelId": "default",
  "data": { "type": "chat-message", "conversationId": "…", "receiverId": "…", "messageId": "…", "sender": { "id": "…", "type": "user", "name": "Grace Drinks", "photo": "https://…" } }
}
```

Read `data.type` to decide which screen to open, then use the other `data` fields to open the right item.

## Push types

Ids are UUIDs and amounts are in naira.

### `chat-message`

Sent when a `new-message` is saved and the receiver isn't connected, so the message's status stays `sent`. Nobody who's online gets one.

| Field | Meaning |
| --- | --- |
| `conversationId` | The chat to open |
| `receiverId` | Who the message was sent to: the user, or the store when it was sent to a store. A store's messages go to the store's owner. |
| `messageId` | The message |
| `sender` | Who sent it: `{ id, type, name, photo }`, the same as `sender` on the `new-message` event. `type` is `user`, `product-store` or `service-store`, and a store's `photo` is its logo. `photo` is `null` when there's none |

- **`title`:** the sender's name, or the store's name when sent as a store.
- **Photo:** the push itself shows no image. To show the sender's photo, for example in an in-app banner, read `data.sender.photo`.
- **`body`:** the message `content`, trimmed to 150 characters. An offer sent without a note reads "Made an offer: ₦5,000".

**Opens:** the chat `conversationId`, acting as `receiverId`.

### `order-updated`

An order was placed, cancelled, completed or expired. It goes to the buyer and the seller, except whoever made the change; an expiry goes to both. It's the same moment as the `order-updated` socket event.

| Field | Meaning |
| --- | --- |
| `orderId` | The order |
| `action` | `placed`, `cancelled`, `completed` or `expired` |
| `cancelledBy` | Only for `cancelled`: who cancelled, a user id or (for a store order's owner) the store's id |
| `cancelledByRole` | Only for `cancelled`: `buyer` or `seller` |

**Example:** title "New order", body "Ada Obi ordered 2 × iphone 12". A cancellation names who did it: "Gadget Hub cancelled the order for iphone 12".

**Opens:** the order `orderId` (the seller's or buyer's Orders).

### `offer-updated`

An offer was accepted, declined, withdrawn by the seller, or found expired. It goes to the side that didn't make the change. A store's offers go to the store's owner.

| Field | Meaning |
| --- | --- |
| `offerId` | The offer; find the chat message whose `offerId` matches |
| `status` | `accepted`, `rejected`, `cancelled` or `expired` |
| `conversationId` | The chat the offer was sent in. `null` only if the offer's message can't be found |

**Example:** title "Offer accepted", body "Your ₦5,000 offer for iphone 12 was accepted".

**Opens:** the chat `conversationId`. The `offer-updated` socket event carries the same `conversationId`, next to `offer`.

### `wallet-funded`

A top-up was credited to the user's wallet. It's sent once per top-up.

| Field | Meaning |
| --- | --- |
| `reference` | The top-up's reference |
| `amount` | The amount added, in naira |

**Opens:** the wallet.

### `subscription-updated`

A store subscription event that also sends an email: activated, renewal reminder, not renewing, cancelled or renewal failed. The title and body are the email's subject and text.

| Field | Meaning |
| --- | --- |
| `storeId` | The service store |
| `status` | The subscription's status after the event |

**Opens:** the store's subscription screen.

### `free-plan-ending`

The store's free plan ends in 3 days, ends tomorrow, or has ended. Each stage is sent once, with the same text as the reminder email.

| Field | Meaning |
| --- | --- |
| `storeId` | The service store |
| `stage` | `3d`, `1d` or `ended` |

**Opens:** the store's subscription screen.

### `review-received`

The other side of a completed order rated the user, or the user's store. See [Rating an order](#rating-an-order).

| Field | Meaning |
| --- | --- |
| `orderId` | The rated order |
| `stars` | 1 to 5 |

**Example:** title "New review", body "Ada rated you 5 stars".

**Opens:** the order `orderId`.

### Not sent yet

**Withdrawals:** there's no withdrawal flow in the backend yet, so there's no withdrawal push.

## The Notifications screen

Each user sees only their own notifications. All three routes need the Bearer token.

### List them

`GET /notifications?page=1`

Newest first, paged like the other lists: `page`, `limit` (10 by default), and `nextPage` is `null` on the last page. Filter on any field, e.g. `isRead=false` for unread only, or `type=offer-received,wallet-funded`.

```json
{
  "status": "success",
  "message": "Get All successful!",
  "total": 1,
  "nextPage": null,
  "prevPage": null,
  "count": 1,
  "pages": 1,
  "currentPage": 1,
  "data": [
    {
      "id": "c3f1a9e2-7b4d-4c8e-9a51-2e6d0b8f4a17",
      "userId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
      "type": "offer-accepted",
      "title": "Offer accepted",
      "body": "₦6,000 · oraimo 20w fast charger · order ORD-L1MK-WQ created",
      "data": {
        "offerId": "5f0c8a52-3f7e-4b8e-9c55-0f6f2a1d7e10",
        "orderId": "102d83e3-cc2a-4757-b056-f5b5e7b3a689",
        "productId": "8fe7a3f2-4faa-4cd3-ad4c-25b7a15014fd",
        "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744"
      },
      "isRead": false,
      "createdAt": "2026-11-06T10:42:18.512Z",
      "updatedAt": "2026-11-06T10:42:18.512Z"
    }
  ]
}
```

Show `title` and `body`, with `createdAt` as the time. Use `type` and `data` to open the right screen. Amounts in `data` are in naira.

### Mark them read

- `PATCH /notifications/{id}/read` marks one read and returns the row. Another user's id, or one that doesn't exist, gets a `404`.
- `PATCH /notifications/read-all` marks all of the user's unread ones read and returns `{ "data": { "updated": 3 } }`.

### Types

**These aren't the push types.** Saved notifications follow the Notifications screen's own types, and some events save a notification with no matching push:

| `type` | When | Who | `data` | Title, body |
| --- | --- | --- | --- | --- |
| `offer-received` | A seller sends an offer in chat | The buyer (a store's owner, if sent to a store) | `offerId`, `productId`, `conversationId`, `messageId`, `expiresAt` | "New offer received", "₦6,000 · oraimo 20w fast charger · expires in 24 hrs" |
| `offer-accepted` | The buyer accepts | The seller (a store's owner, for a store's offer) | `offerId`, `orderId`, `productId`, `conversationId` | "Offer accepted", "₦6,000 · … · order ORD-2113 created" |
| `order-placed` | Someone orders the seller's item | The seller (a store's owner, for a store's item) | `orderId`, `productId` | "New order", "Ada Obi ordered 2 × iphone 12" |
| `order-completed` | An order is completed | The other party | `orderId`, `productId` | "Order completed", "Adaeze scanned your code, order ORD-2113 is complete." |
| `order-cancelled` | An order is cancelled | The other party | `orderId`, `productId` | "Order cancelled", "Adaeze cancelled ORD-2113 before handover." |
| `review-received` | Someone rates the user or their store | The rated user, or the store's owner | `orderId`, `stars`, `ratingId` | "New review", "Ada rated you 5 stars" |
| `wallet-funded` | A top-up is credited | The wallet owner | `reference`, `amount` | "Wallet funded", "Paystack confirmed your ₦5,000 top-up. It's ready to spend." |
| `wallet-debited` | A product or housing listing fee is taken | The lister | `reference`, `amount`, `productId` or `housingId` | "Wallet debited", "₦300 listing fee debited." |
| `subscription-updated` | A store's plan changes (paid, failed, renewing, cancelled) | The store's owner | `storeId`, `status` | Same as the email, e.g. "Subscription will not renew", "Your subscription for Ada Cuts …" |
| `free-plan-ending` | A store's free plan ends in 3 days, 1 day, or has ended | The store's owner | `storeId`, `stage` (`3d`, `1d` or `ended`) | Same as the email, e.g. "Your free plan ends tomorrow", "Your free plan for Ada Cuts ends on …" |

`review-pending` and `wallet-refunded` are reserved but not sent yet. Expired orders, and declined, withdrawn and expired offers, are pushed but not saved.

The text in `body` is fixed when the notification is saved. For an offer's expiry, show the time left from `data.expiresAt` rather than from the body.

### Socket event: `notification`

When a notification is saved and its user is connected, the same row is sent as a `notification` event, so an open Notifications screen can add it without reloading:

```ts
socket.on('notification', (notification) => {
  // Same shape as a row from GET /notifications
  prependToList(notification);
});
```

This only reaches a connected app. The app disconnects in the background, so reload `GET /notifications` when the screen opens.

## Rating an order

`POST /orders/{id}/rating` (Bearer)

```json
{ "stars": 5, "comment": "quick pickup, no stress." }
```

- **Who:** the order's buyer rates the seller, or the store for a store order. The seller rates the buyer.
- **When:** only once the order is `completed`, and once per side.
- **Then:** the rated user's or store's `ratingsAverage` and `ratingsCount` are updated, and they get a `review-received` push, a saved notification and the `notification` socket event.
- **Body:** `stars` is a whole number from 1 to 5. `comment` is optional, up to 1,000 characters.

**Response:** `201` with the order and both sides' ratings, `null` for a side that hasn't rated:

```json
{
  "status": "success",
  "message": "create successful!",
  "data": {
    "id": "102d83e3-cc2a-4757-b056-f5b5e7b3a689",
    "status": "completed",
    "ratings": {
      "buyer": {
        "id": "9b2e4c1a-…",
        "orderId": "102d83e3-cc2a-4757-b056-f5b5e7b3a689",
        "raterId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
        "raterRole": "buyer",
        "rateeId": "91a8ea62-98ce-4168-9a4a-61fc93aaf2dc",
        "rateeType": "product-store",
        "stars": 5,
        "comment": "quick pickup, no stress.",
        "createdAt": "2026-11-06T12:00:00.000Z"
      },
      "seller": null
    }
  }
}
```

`GET /orders/buyer` and `GET /orders/seller` return the same `ratings` on every order.

| Status | When |
| --- | --- |
| `400` | The order isn't `completed`, or `stars` isn't 1 to 5 |
| `403` | The user isn't the order's buyer or seller |
| `404` | No order with that id |
| `409` | This side has already rated the order |

## Reviews

Reviews are the ratings left on orders, read back for the profile screens. All three take a Bearer token.

| Request | Returns |
| --- | --- |
| `GET /reviews/received?userId=…` | Reviews of that user and of their product stores, newest first. Leave out `userId` for your own |
| `GET /reviews/given` | Reviews you wrote, newest first |
| `GET /reviews/summary?userId=…` | `average` (1 decimal), `count`, and `breakdown`: how many of each star. Leave out `userId` for your own |

The two lists page like the others (`page`, `limit`, 10 by default). Each review is the rating, plus:

- `rater`: `{ id, name, photo, type: "user" }`
- `ratee`: the user or store rated, `{ id, name, photo, type }`, where `type` is `user` or `product-store` and `photo` is a store's logo
- `order`: `{ id, orderId, product: { id, name } }`

```json
{
  "status": "success",
  "total": 1,
  "count": 1,
  "pages": 1,
  "currentPage": 1,
  "nextPage": null,
  "prevPage": null,
  "data": [
    {
      "id": "9b2e4c1a-5d7f-4e21-8a3b-6c0d9e1f2a47",
      "orderId": "102d83e3-cc2a-4757-b056-f5b5e7b3a689",
      "raterRole": "buyer",
      "stars": 5,
      "comment": "quick pickup, no stress.",
      "createdAt": "2026-11-06T12:00:00.000Z",
      "rater": { "id": "48c03f11-…", "name": "Ada Obi", "photo": "https://…", "type": "user" },
      "ratee": { "id": "91a8ea62-…", "name": "Gadget Hub", "photo": "https://…", "type": "product-store" },
      "order": { "id": "102d83e3-…", "orderId": "ORD-L1MK-WQ", "product": { "id": "8fe7a3f2-…", "name": "iphone 12" } }
    }
  ]
}
```

Summary:

```json
{
  "status": "success",
  "data": {
    "userId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
    "average": 4.8,
    "count": 4,
    "breakdown": { "1": 0, "2": 0, "3": 0, "4": 1, "5": 3 }
  }
}
```

The profile's `ratingsAverage` and `ratingsCount` on the user are the user's own reviews only; the summary also counts their stores'.

