# eCampusMart backend: fixes for the open issues

**For:** eCampusMart mobile app team · **From:** backend · **As of:** 8 Nov 2026

Answers to "eCampusMart backend: open issues" (8 Nov), using its item numbers.
Everything below is in the backend code (commits `6d2afc2` and `a8d1dfb`). The
server at `site--ecampusmart--s56z6fbqd5wm.code.run` has these once it's
redeployed (see [1.7](#17-documented-but-not-on-the-server)).

Full details for the socket events are in `docs/CHAT.md` (with a dated
changelog at the top) and for pushes, notifications and reviews in
`docs/NOTIFICATIONS.md`.

## 1. Bugs

### 1.0b Subscriptions

- **Starting a checkout no longer fails the previous one.** Earlier unpaid
  checkouts now become `expired`, not `failed`. If one of them is paid late,
  the webhook still activates it.
- **Two paid checkouts for one store:** the second payment is refunded
  automatically instead of starting a second plan.
- **Paying during the free trial:** the plan starts when the trial ends, and
  that's the first charge. `subscription.trialEndsAt` and `subscription.endsAt`
  are now the same date during a trial, and `trialEndsAt` is `null` once the
  store is paying.
- **`/auth/me` during a switch:** `plan`, `endsAt` and `renews` describe the
  plan still running (`renews: false`). The plan switched to is in a new field:

  ```json
  "nextPlan": { "plan": { "id": "…", "name": "Yearly", "type": "yearly" }, "startsAt": "2026-11-22T…" }
  ```

  `nextPlan` is `null` when there's no switch.
- **Yearly plan running 30 days:** the Paystack plans are monthly and yearly.
  The 30-day yearly row came from the old card-check flow, which is gone.
- **`isTrial: true` on every row:** also from the old card-check flow. New
  checkouts save `isTrial: false`. Read `subscription.isFreeTrial` on
  `/auth/me` instead.
- **The lost payments from 21 and 22 Oct** were test-mode payments and have
  been left as they are. The Paystack webhook URL and delivery log are being
  checked separately.

### 1.4 Secret fields

- User responses never include `password`, `otp`, `otpExpiration`,
  `passwordResetToken` or `passwordResetTokenExpires`.
- New examples without them: Sign Up "201 No Secret Fields" and Update
  Password "200 No Password Hash". The old examples still have to be deleted
  by hand in Postman.

### 1.6 Top-ups credited late

- The webhook answers Paystack straight away and credits the wallet in a
  background job.
- `GET /transactions/verify/{reference}` asks Paystack about a `pending`
  payment and settles it with the same code as the webhook: a paid top-up is
  credited, a paid plan activated, a failed one marked `failed`, and an
  unfinished one left `pending`.
- **Credited once only:** the row is marked `success` only if it is still
  unpaid, in the same database transaction as the credit.
- **New:** every 10 minutes the server checks top-ups still `pending` after
  `expiresAt` with Paystack. Paid ones are credited, the rest marked `failed`.

### 1.7 Documented but not on the server

All of these are built. They'll answer once the server is redeployed:

- `GET /house-types`, `GET /reviews/received`, `GET /reviews/given`,
  `GET /reviews/summary`
- `DELETE /orders/{id}`
- `cancelledBy`, `cancelledByRole`, `completedAt`, `cancelledAt`,
  `expiredAt`, `hiddenBySeller` and `hiddenByBuyer` on orders. The columns are
  added on the first start after the deploy.
- `POST /uploads/signature` with `{ "purpose": "chat" }` signing
  `ECampusMart/chat`
- `GET /auth/users/{id}` and `GET /auth/users` returning public fields only
  for other users

### N.1 Marking a chat read as someone else

`mark-all-as-read` is refused with an `exception` unless `senderId` is the
connected user or one of their stores. The messages stay unread.

## 2. Orders, offers and notifications

### O.3 New order

`order-updated` (`{ orderId, action }`) goes out on the socket and as a push
when an order is placed, cancelled, completed or expired. The seller also gets
an `order-placed` row in `GET /notifications`.

### O.4 Who cancelled, ratings

- **Who cancelled:** `cancelledBy` and `cancelledByRole` (`buyer` or `seller`)
  are on the order, the `order-updated` socket event and the push. For a store
  order cancelled by its owner, `cancelledBy` is the store's id. The push names
  who cancelled: "Gadget Hub cancelled the order for iphone 12".
- **Order ratings:** `POST /orders/{id}/rating` with
  `{ "stars": 1-5, "comment": "optional" }`, as specified:
  - Only the buyer or seller can rate, only once the order is `completed`,
    and once per side.
  - The response has both sides' ratings, and `ratingsAverage` and
    `ratingsCount` are updated.
  - The rated person gets a push, a `review-received` notification and the
    `notification` socket event.
- **Reviews:** `GET /reviews/received`, `GET /reviews/given` and
  `GET /reviews/summary` read these ratings back, with `rater`, `ratee` and
  the ordered item.
- **Delete an expired order:** `DELETE /orders/{id}` hides an `expired` order
  from your own list only. Other statuses get a `400`.

### 2.6 Notifications

- `offer-updated` (push and socket event) carries `conversationId`.
- `subscription-updated` and `free-plan-ending` are saved as notification rows
  with the `data` you listed.
- Every saved notification is also sent as a `notification` socket event to a
  connected user, in addition to the push.
- Notifications use `isRead` (`isRead=false` for unread only).

## 3. Chat

### N.2b The listing on live messages

`new-message`, for the receiver and in the sender's acknowledgement, now
carries the same `product`, `service` or `housing` summary as `GET` messages,
plus the offer amount in naira. It also carries `sender`:
`{ id, type, name, photo }`.

### N.3 Sender's photo on message pushes

The `chat-message` push now has `"richContent": { "image": "<photo URL>" }`
and `"mutableContent": true`. The image is the sender's profile photo, or the
store's logo when the message is sent as a store. Both are left out when
there is no photo. The same details are in `data.sender`.

## 4. Missing endpoints

### 2.1 Store subscriptions

- **The free trial is once only.** `POST /subscriptions/restart-free` is
  removed.
- **Cancelling a paid plan** keeps it running until its paid period ends. The
  store then drops off Explore. Cancelling a free trial ends it straight away.
- A store with no plan only loses its Explore placement. The seller keeps the
  store, its services and its orders.
- New "Cancel Subscription Plan" examples cover a paid plan and a free trial.
  The old free-trial 400 "card check" example is still to be deleted in
  Postman.

### 2.2 Google sign-in

- An unverified Google email gets `403`.
- An email that already has an account is linked to it (`clerkId` set), not
  duplicated.
- Still to do: the server needs the **ecampusmart** Clerk app's secret key.
  After that, the `POST /auth/clerk` example will be re-saved.

### 2.4 Wrong password status

A wrong password on `verify-password`, `change-email` and `update-password`
gets `400`, never `401`. So does reusing your old password on reset.

### 2.5 Leftover unverified account

Signing up again replaces the unverified account, so that email isn't blocked.

## 5. Changes to existing endpoints

| Item | Fixed |
| --- | --- |
| 3.1 | Deleting a store deletes its products or services, their photos and favourites |
| 3.2 | Changing campus moves the user's stores, products and services; housing stays |
| 3.3 | `CHAT.md` is in the backend repo, with a dated changelog at the top |
| 3.5 | `locationId` is optional on `POST /housings` |
| 3.6 | `basePrice` is optional on service stores |
| 3.7 | Duplicate categories merged: each name exists once, and every store and service points at the remaining one |
| 3.9 | `POST /housings` answers a low balance with the same 403 "Insufficient wallet balance…" as products |

## 6. Sample-data features

Two new endpoints for screens on sample data:

- `GET /house-types`: the housing types as `{ value, label }`.
- Reviews: see [O.4](#o4-who-cancelled-ratings).

## 7. Before production

### 5.1 Chat socket authentication

The socket takes the user from the access token: `io(url, { auth: { token } })`
or an `Authorization: Bearer …` header. A bad or expired token is refused.
The old `userid` header still works until the app sends the token; it will be
turned off before launch.

## Still open

- **O.4** `POST /service-stores/{id}/rating`, and service store reviews in
  `/reviews`.
- **2.2** The Clerk secret key and the re-saved example (above).
- **2.3** Change phone: needs an SMS provider for the OTP.
- **3.3** Examples for products and services with `store`, the `my-store` and
  `my-listings` requests, `address`, `status` values and `unreadMessages`.
- **3.8** The other party's name on transactions: waits for sending between
  users.
- **3.10** `photo` and `photoKey` on Update Me.
- **6** Withdraw, send to user and KYC.
- **5.2** Signed handover QR.
- **Postman tidy-up:** the old Sign Up, Update Password, free-trial "card
  check" and Get My Notifications "200 OK" examples, "Get All Notifications"
  and "New Request" are still to be deleted.
