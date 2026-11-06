# Push notifications

The server sends pushes through Expo's push service. Chat pushes only go to users who are offline. Every other push goes out whether the user is online or not; while the app is open, show those as a banner.

## Contents

- [Saving a token](#saving-a-token)
- [Removing a token](#removing-a-token)
- [What a push looks like](#what-a-push-looks-like)
- [Push types](#push-types)

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
  "data": { "type": "chat-message", "conversationId": "…", "receiverId": "…", "messageId": "…" }
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

- **`title`:** the sender's name, or the store's name when sent as a store.
- **`body`:** the message `content`, trimmed to 150 characters. An offer sent without a note reads "Made an offer: ₦5,000".

**Opens:** the chat `conversationId`, acting as `receiverId`.

### `order-updated`

An order was placed, cancelled, completed or expired. It goes to the buyer and the seller, except whoever made the change; an expiry goes to both. It's the same moment as the `order-updated` socket event.

| Field | Meaning |
| --- | --- |
| `orderId` | The order |
| `action` | `placed`, `cancelled`, `completed` or `expired` |

**Example:** title "New order", body "Ada Obi ordered 2 × iphone 12".

**Opens:** the order `orderId` (the seller's or buyer's Orders).

### `offer-updated`

An offer was accepted, declined, withdrawn by the seller, or found expired. It goes to the side that didn't make the change. A store's offers go to the store's owner.

| Field | Meaning |
| --- | --- |
| `offerId` | The offer; find the chat message whose `offerId` matches |
| `status` | `accepted`, `rejected`, `cancelled` or `expired` |

**Example:** title "Offer accepted", body "Your ₦5,000 offer for iphone 12 was accepted".

**Opens:** the chat with that offer. The push has no `conversationId`, so look the offer up among loaded conversations, or open the conversation list.

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

### Not sent yet

**Withdrawals:** there's no withdrawal flow in the backend yet, so there's no withdrawal push.
