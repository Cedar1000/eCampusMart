# Chat API

Chat has two parts:

- **Socket.IO** for everything live: connecting, sending messages, typing and recording indicators, delivery and read receipts.
- **REST** for loading history: the conversation list and the messages in a conversation.

Base URL in development: `http://localhost:3000` (Socket.IO on `ws://localhost:3000`).

## Contents

- [Concepts](#concepts)
- [Connecting](#connecting)
- [Socket events: client → server](#socket-events-client--server)
  - [`new-message`](#new-message)
  - [`typing` / `stop-typing`](#typing--stop-typing)
  - [`recording` / `stop-recording`](#recording--stop-recording)
  - [`mark-all-as-read`](#mark-all-as-read)
- [Socket events: server → client](#socket-events-server--client)
- [REST endpoints](#rest-endpoints)
  - [List conversations](#list-conversations)
  - [List messages in a conversation](#list-messages-in-a-conversation)
- [Data shapes](#data-shapes)
- [Errors](#errors)
- [Typical flows](#typical-flows)

---

## Concepts

### Participants: users and stores

A conversation is between two **participants**. A participant is one of:

| Type            | `MessageIndentity` value | Example                                  |
| --------------- | ------------------------ | ---------------------------------------- |
| A user          | `user`                   | A buyer messaging a seller               |
| A product store | `product-store`          | A buyer messaging a store about an item  |
| A service store | `service-store`          | A user messaging a service provider      |

All ids are UUIDs. When a user owns stores, they are online for all of them: one socket connection receives messages sent to the user **and** to every store they own.

Send `senderId` and `receiverId` as the participants' ids. The server works out whether each is a user, product store or service store; you never send `senderType` / `receiverType`.

### Message status

Each message moves forward through these statuses and never goes back:

```
sent ──► delivered ──► read
```

| Status      | Meaning                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `sent`      | Saved on the server; the receiver hasn't been online since it was sent.   |
| `delivered` | The receiver was online when it arrived, or has connected since.          |
| `read`      | The receiver opened the conversation and marked it as read.               |
| `failed`    | Reserved; the server doesn't currently set it.                            |

`sent` and `delivered` messages both count as **unread**.

### Message type

Every message is currently saved with `type: "text"`; the client can't set the type yet. Because of that, **`content` is required on every message, including ones with media.** Use a caption, or a placeholder such as `"📷 Photo"` or `"🎤 Voice note"`.

The types that exist are `text`, `image`, `video`, `audio`, `file`, `system` and `voicenote`.

### Listings in a message

A message can reference **one** listing the conversation is about:

| Field       | References          |
| ----------- | ------------------- |
| `productId` | A product           |
| `serviceId` | A service           |
| `housingId` | A housing listing   |

When you load messages over REST, the server adds a short summary of the listing (`product`, `service` or `housing`) so you can render a card. See [List messages in a conversation](#list-messages-in-a-conversation).

---

## Connecting

Connect with the Socket.IO **v4** client and pass the logged-in user's id in a `userid` header.

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  extraHeaders: {
    userid: currentUser.id, // the user's id, not a store id
  },
});

socket.on('connect', () => console.log('connected', socket.id));
socket.on('disconnect', (reason) => console.log('disconnected', reason));
socket.on('exception', (error) => console.error('chat error', error));
```

The server **disconnects the socket immediately** if:

- the `userid` header is missing or empty, or
- no user has that id.

> **Browsers:** browsers can't set custom headers on a WebSocket, so `extraHeaders` only works with the `polling` transport there (leave out `transports: ['websocket']`), or in React Native and Node. Ask the backend team before relying on this in a browser build; moving the id to `auth` (`io(url, { auth: { ... } })`) is planned.

### What happens on connect

1. The user and all their stores are marked online (`isOnline: true`).
2. Every message sent to them, or to their stores, while they were offline moves from `sent` to `delivered`.
3. Each sender of those messages gets a [`message-delivered`](#message-delivered) event, if they are online.

On disconnect, the user and their stores are marked offline (`isOnline: false`).

### Postman

1. **New → WebSocket**, then change the type from **Raw** to **Socket.IO**.
2. URL: `ws://localhost:3000`.
3. **Settings:** client version **v4**.
4. **Headers:** `userid` = a real user id.
5. **Events:** listen for `new-message`, `message-delivered`, `mark-all-as-read`, `typing`, `stop-typing`, `recording`, `stop-recording` and `exception`.

---

## Socket events: client → server

Every payload is validated strictly. **Unknown fields are rejected**, so send only the fields listed for each event. A rejected payload comes back as an [`exception`](#errors) event.

Events that return data (`new-message`, `mark-all-as-read`) return it through a Socket.IO **acknowledgement**: pass a callback as the last argument to `emit`, or use `emitWithAck`.

### `new-message`

Send a message. The server saves it, sends it to the receiver if they are online, and returns the saved message.

**Payload**

| Field            | Type          | Required | Notes                                                                                   |
| ---------------- | ------------- | -------- | --------------------------------------------------------------------------------------- |
| `senderId`       | UUID          | Yes      | The current user's id, or the id of one of their stores if they're replying as a store. |
| `receiverId`     | UUID          | Yes      | A user, product store or service store id.                                              |
| `content`        | string        | Yes\*    | \*Required in practice; see [Message type](#message-type).                              |
| `conversationId` | UUID          | No       | Leave out for a new chat; the server finds or creates the conversation between the two.  |
| `productId`      | UUID          | No       | The product this message is about.                                                      |
| `serviceId`      | UUID          | No       | The service this message is about.                                                      |
| `housingId`      | UUID          | No       | The housing listing this message is about.                                              |
| `media`          | `ChatMedia[]` | No       | Already-uploaded files; see [`ChatMedia`](#chatmedia).                                  |

**Text message**

```ts
const message = await socket.emitWithAck('new-message', {
  conversationId: '0b2ff029-745f-4c0b-a0f4-040d0870e744',
  senderId: 'fa98a8f0-fc09-49c3-9cab-91e19b9dabc3',
  receiverId: '48c03f11-8cf5-4249-b1fe-304e3197f9bd',
  content: 'Hi, is this still available?',
});
```

**First message about a product** (no conversation yet)

```json
{
  "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
  "receiverId": "7d1c2e44-5b0a-4f7e-9a51-2f3c8e6d9b10",
  "productId": "c3a9e1f2-6b7d-4c8e-9f01-23456789abcd",
  "content": "Hi, is this laptop still available?"
}
```

**Message with media**

Upload files first; the chat API only stores their URLs.

```json
{
  "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
  "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
  "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
  "content": "Here are the photos and a voice note",
  "media": [
    {
      "url": "https://cdn.example.com/chat/photo-1.jpg",
      "thumbnail": "https://cdn.example.com/chat/photo-1-thumb.jpg",
      "size": 245760,
      "mimeType": "image/jpeg",
      "type": "image"
    },
    {
      "url": "https://cdn.example.com/chat/voice-note.m4a",
      "size": 98304,
      "duration": 12,
      "mimeType": "audio/mp4",
      "type": "voicenote"
    }
  ]
}
```

**Acknowledgement:** the saved [`Message`](#message)

```json
{
  "id": "3e4cff2a-84a7-4fb9-b566-3ea6aac08082",
  "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
  "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
  "senderType": "user",
  "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
  "receiverType": "user",
  "productId": null,
  "serviceId": null,
  "housingId": null,
  "type": "text",
  "content": "Hi, is this still available?",
  "media": null,
  "status": "delivered",
  "replyToId": null,
  "isDeleted": false,
  "isEdited": false,
  "metadata": null,
  "createdAt": "2026-10-20T09:14:03.512Z",
  "updatedAt": "2026-10-20T09:14:03.512Z"
}
```

`status` is `delivered` if the receiver was online, otherwise `sent`. Save `conversationId` from the first message of a new chat and send it with the rest.

**What the server sends**

| To                         | Event                                     | When                     |
| -------------------------- | ----------------------------------------- | ------------------------ |
| Receiver                   | [`new-message`](#new-message-1)           | If they're online        |
| Sender                     | [`message-delivered`](#message-delivered) | If the receiver's online |

### `typing` / `stop-typing`

Show or hide a "typing…" indicator for the other participant. Nothing is saved.

```ts
socket.emit('typing', {
  conversationId: '0b2ff029-745f-4c0b-a0f4-040d0870e744',
  senderId: 'fa98a8f0-fc09-49c3-9cab-91e19b9dabc3',
  receiverId: '48c03f11-8cf5-4249-b1fe-304e3197f9bd',
});

socket.emit('stop-typing', { /* same payload */ });
```

| Field            | Type | Required |
| ---------------- | ---- | -------- |
| `conversationId` | UUID | Yes      |
| `senderId`       | UUID | Yes      |
| `receiverId`     | UUID | Yes      |

The receiver gets the same payload on the event of the same name, if they're online. Emit `stop-typing` when the input is cleared, the message is sent, or after a few seconds without keystrokes.

### `recording` / `stop-recording`

Same as typing, for a "recording a voice note…" indicator. The payload is identical.

```ts
socket.emit('recording', {
  conversationId: '0b2ff029-745f-4c0b-a0f4-040d0870e744',
  senderId: 'fa98a8f0-fc09-49c3-9cab-91e19b9dabc3',
  receiverId: '48c03f11-8cf5-4249-b1fe-304e3197f9bd',
});

socket.emit('stop-recording', { /* same payload */ });
```

### `mark-all-as-read`

Mark every unread message the reader has received in a conversation as `read`. Emit it when the user opens a conversation, and when a new message arrives in the conversation they have open.

| Field            | Type | Required | Notes                                                   |
| ---------------- | ---- | -------- | ------------------------------------------------------- |
| `conversationId` | UUID | Yes      |                                                         |
| `receiverId`     | UUID | Yes      | **The reader:** the current user, or their store's id.   |
| `senderId`       | UUID | Yes      | The other participant.                                  |

```ts
const readIds = await socket.emitWithAck('mark-all-as-read', {
  conversationId: '0b2ff029-745f-4c0b-a0f4-040d0870e744',
  receiverId: '48c03f11-8cf5-4249-b1fe-304e3197f9bd',
  senderId: 'fa98a8f0-fc09-49c3-9cab-91e19b9dabc3',
});
```

**Acknowledgement:** ids of the messages that changed to `read` (empty if there was nothing unread)

```json
[
  "3e4cff2a-84a7-4fb9-b566-3ea6aac08082",
  "22294aa6-16e7-4bfe-8e21-d66f351bb944"
]
```

The server also resets the reader's unread count for the conversation (`unReadCount[receiverId]`) and recalculates their total unread count.

If any messages changed, the server emits [`mark-all-as-read`](#mark-all-as-read-1) with the `conversationId` to the **`receiverId`** participant.

---

## Socket events: server → client

### `new-message`

A message was sent to you or one of your stores. The payload is the full [`Message`](#message), the same as the sender's acknowledgement.

```ts
socket.on('new-message', (message) => {
  // append to the open conversation, or bump the conversation list
});
```

### `message-delivered`

Messages you sent have reached the receiver. You get one event per conversation; when the receiver comes back online after a while, it can list several messages.

```json
{
  "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
  "messageIds": [
    "3e4cff2a-84a7-4fb9-b566-3ea6aac08082",
    "22294aa6-16e7-4bfe-8e21-d66f351bb944"
  ]
}
```

Set those messages' `status` to `delivered`, unless you have already shown them as `read`.

### `mark-all-as-read`

Messages in a conversation were marked as read. The payload is the conversation id as a plain string:

```json
"0b2ff029-745f-4c0b-a0f4-040d0870e744"
```

### `typing`, `stop-typing`, `recording`, `stop-recording`

The other participant started or stopped typing or recording. The payload is what they sent:

```json
{
  "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
  "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
  "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd"
}
```

### `exception`

Something went wrong with an event you sent. See [Errors](#errors).

> **Offline senders:** live events are only sent to participants who are connected at the time. A sender who is offline when their message is delivered or read won't get the event later. Load the latest statuses over REST when a conversation is opened.

---

## REST endpoints

All REST endpoints need the logged-in user's access token:

```
Authorization: Bearer <accessToken>
```

### List conversations

```
GET /chat/conversations/:participantId
```

The conversations a participant is in, most recently active first, each with the other participant's details and the last message.

`participantId` must be the logged-in user's id or the id of one of their stores. Any other id returns `403`.

**Query parameters**

| Param   | Default          | Example          | Notes                                   |
| ------- | ---------------- | ---------------- | --------------------------------------- |
| `page`  | `1`              | `2`              |                                         |
| `limit` | `10`             | `20`             |                                         |
| `sort`  | `desc-updatedAt` | `asc-createdAt`  | `<asc\|desc>-<field>`                   |

**Example**

```
GET /chat/conversations/48c03f11-8cf5-4249-b1fe-304e3197f9bd?page=1&limit=20
```

**Response `200`**

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
      "id": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
      "type": "private",
      "participants": [
        "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
        "48c03f11-8cf5-4249-b1fe-304e3197f9bd"
      ],
      "createdBy": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
      "isArchived": false,
      "unReadCount": {
        "48c03f11-8cf5-4249-b1fe-304e3197f9bd": 2,
        "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3": 0
      },
      "mutedBy": {},
      "mutedUntil": {},
      "createdAt": "2026-10-19T14:02:11.004Z",
      "updatedAt": "2026-10-20T09:14:03.540Z",
      "lastMessage": {
        "id": "3e4cff2a-84a7-4fb9-b566-3ea6aac08082",
        "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
        "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
        "content": "Hi, is this still available?",
        "type": "text",
        "status": "delivered",
        "createdAt": "2026-10-20T09:14:03.512Z"
      },
      "recipient": {
        "id": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
        "type": "user",
        "name": "Ada Obi",
        "photo": "https://cdn.example.com/users/ada.jpg"
      }
    }
  ]
}
```

`lastMessage` is the full [`Message`](#message); it's shortened here.

- **`recipient`** is the *other* participant. `name` is a user's full name or a store's name, and `photo` is a user's photo or a store's logo (`null` if none).
- **Unread badge:** use `unReadCount[participantId]`, the number of unread messages for the participant whose conversations you're listing.

### List messages in a conversation

```
GET /chat/conversations/:conversationId/messages
```

Messages in a conversation, **newest first**. The logged-in user, or one of their stores, must be a participant; otherwise the response is `403`.

**Query parameters**

| Param   | Default          | Example          | Notes                              |
| ------- | ---------------- | ---------------- | ---------------------------------- |
| `page`  | `1`              | `2`              | Load older messages with `page+1`. |
| `limit` | `10`             | `30`             |                                    |
| `sort`  | `desc-createdAt` | `asc-createdAt`  |                                    |

**Example**

```
GET /chat/conversations/0b2ff029-745f-4c0b-a0f4-040d0870e744/messages?page=1&limit=30
```

**Response `200`**

```json
{
  "status": "success",
  "message": "Get All successful!",
  "total": 3,
  "nextPage": null,
  "prevPage": null,
  "count": 3,
  "pages": 1,
  "currentPage": 1,
  "data": [
    {
      "id": "3e4cff2a-84a7-4fb9-b566-3ea6aac08082",
      "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
      "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
      "senderType": "user",
      "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
      "receiverType": "user",
      "productId": "c3a9e1f2-6b7d-4c8e-9f01-23456789abcd",
      "serviceId": null,
      "housingId": null,
      "type": "text",
      "content": "Is this laptop still available?",
      "media": null,
      "status": "read",
      "replyToId": null,
      "isDeleted": false,
      "isEdited": false,
      "metadata": null,
      "createdAt": "2026-10-20T09:14:03.512Z",
      "updatedAt": "2026-10-20T09:20:41.118Z",
      "product": {
        "id": "c3a9e1f2-6b7d-4c8e-9f01-23456789abcd",
        "name": "HP EliteBook 840",
        "description": "Barely used, 16GB RAM, 512GB SSD",
        "price": "150000.00",
        "photo": "https://cdn.example.com/products/elitebook-cover.jpg"
      }
    },
    {
      "id": "be638a70-bebc-4709-9e4f-8af038b1827a",
      "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
      "senderId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
      "senderType": "user",
      "receiverId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
      "receiverType": "user",
      "productId": null,
      "serviceId": null,
      "housingId": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "type": "text",
      "content": "Is the self-contain near the main gate still free?",
      "media": null,
      "status": "delivered",
      "replyToId": null,
      "isDeleted": false,
      "isEdited": false,
      "metadata": null,
      "createdAt": "2026-10-20T08:55:10.002Z",
      "updatedAt": "2026-10-20T08:55:10.002Z",
      "housing": {
        "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
        "title": "Self-contain near main gate",
        "description": "Tiled, running water, 5 minutes from campus",
        "price": "350000.00",
        "photo": "https://cdn.example.com/housing/self-contain-cover.jpg"
      }
    },
    {
      "id": "81cff556-4b26-42fd-b78a-9f42591e0b99",
      "conversationId": "0b2ff029-745f-4c0b-a0f4-040d0870e744",
      "senderId": "fa98a8f0-fc09-49c3-9cab-91e19b9dabc3",
      "senderType": "user",
      "receiverId": "48c03f11-8cf5-4249-b1fe-304e3197f9bd",
      "receiverType": "user",
      "productId": null,
      "serviceId": null,
      "housingId": null,
      "type": "text",
      "content": "🎤 Voice note",
      "media": [
        {
          "url": "https://cdn.example.com/chat/voice-note.m4a",
          "size": 98304,
          "duration": 12,
          "mimeType": "audio/mp4",
          "type": "voicenote"
        }
      ],
      "status": "read",
      "replyToId": null,
      "isDeleted": false,
      "isEdited": false,
      "metadata": null,
      "createdAt": "2026-10-20T08:40:00.000Z",
      "updatedAt": "2026-10-20T09:20:41.118Z"
    }
  ]
}
```

**Listing summaries**

A message with a `productId`, `serviceId` or `housingId` gets a matching `product`, `service` or `housing` object. Messages without one don't get the key.

| Key       | Fields                                             |
| --------- | -------------------------------------------------- |
| `product` | `id`, `name`, `description`, `price`, `photo`      |
| `service` | `id`, `title`, `description`, `price`, `photo`     |
| `housing` | `id`, `title`, `description`, `price`, `photo`     |

- Products use **`name`**; services and housing use **`title`**.
- **`price`** is a **string** with two decimals (for example `"150000.00"`). Convert it with `Number(price)` before formatting.
- **`photo`** is the listing's cover image, or its first image, or `null`.
- The value is **`null`** if the listing has been deleted since the message was sent.

**Deleted messages:** messages with `isDeleted: true` are still returned. Show them as "This message was deleted".

---

## Data shapes

### `Message`

| Field            | Type                                              | Notes                                         |
| ---------------- | ------------------------------------------------- | --------------------------------------------- |
| `id`             | UUID                                              |                                               |
| `conversationId` | UUID                                              |                                               |
| `senderId`       | UUID                                              |                                               |
| `senderType`     | `"user" \| "product-store" \| "service-store"`    | Set by the server.                            |
| `receiverId`     | UUID                                              |                                               |
| `receiverType`   | `"user" \| "product-store" \| "service-store"`    | Set by the server.                            |
| `productId`      | UUID \| null                                      |                                               |
| `serviceId`      | UUID \| null                                      |                                               |
| `housingId`      | UUID \| null                                      |                                               |
| `type`           | `"text" \| "image" \| "video" \| "audio" \| "file" \| "system" \| "voicenote"` | Currently always `"text"`. |
| `content`        | string \| null                                    |                                               |
| `media`          | `ChatMedia[]` \| null                             |                                               |
| `status`         | `"sent" \| "delivered" \| "read" \| "failed"`     |                                               |
| `replyToId`      | UUID \| null                                      | Reserved; replies aren't supported yet.       |
| `isDeleted`      | boolean                                           |                                               |
| `isEdited`       | boolean                                           |                                               |
| `metadata`       | `{ editedAt?, deletedAt?, forwardedFrom? }` \| null |                                             |
| `createdAt`      | ISO date string                                   |                                               |
| `updatedAt`      | ISO date string                                   |                                               |

### `ChatMedia`

| Field       | Type   | Required | Notes                                                    |
| ----------- | ------ | -------- | -------------------------------------------------------- |
| `url`       | string | Yes      | Public URL of the uploaded file.                         |
| `thumbnail` | string | No       | Preview image for images and videos.                     |
| `size`      | number | No       | Bytes.                                                   |
| `duration`  | number | No       | Seconds, for audio, video and voice notes.               |
| `mimeType`  | string | No       | For example `image/jpeg`, `audio/mp4`.                   |
| `type`      | string | No       | `image`, `video`, `audio`, `file` or `voicenote`.         |

### TypeScript types

```ts
type ParticipantType = 'user' | 'product-store' | 'service-store';
type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
type MessageType =
  | 'text' | 'image' | 'video' | 'audio' | 'file' | 'system' | 'voicenote';

interface ChatMedia {
  url: string;
  thumbnail?: string;
  size?: number;
  duration?: number;
  mimeType?: string;
  type?: string;
}

interface ListingSummary {
  id: string;
  description: string;
  price: string;
  photo: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: ParticipantType;
  receiverId: string;
  receiverType: ParticipantType;
  productId: string | null;
  serviceId: string | null;
  housingId: string | null;
  type: MessageType;
  content: string | null;
  media: ChatMedia[] | null;
  status: MessageStatus;
  replyToId: string | null;
  isDeleted: boolean;
  isEdited: boolean;
  metadata: { editedAt?: string; deletedAt?: string; forwardedFrom?: string } | null;
  createdAt: string;
  updatedAt: string;
  // Only on GET /chat/conversations/:conversationId/messages
  product?: (ListingSummary & { name: string }) | null;
  service?: (ListingSummary & { title: string }) | null;
  housing?: (ListingSummary & { title: string }) | null;
}

interface Conversation {
  id: string;
  type: 'private' | 'group';
  participants: string[];
  createdBy: string | null;
  isArchived: boolean;
  unReadCount: Record<string, number>;
  mutedBy: Record<string, boolean>;
  mutedUntil: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastMessage: Message | null;
  recipient: {
    id: string;
    type: ParticipantType;
    name: string;
    photo: string | null;
  } | null;
}

// Client → server payloads
interface NewMessagePayload {
  senderId: string;
  receiverId: string;
  content: string;
  conversationId?: string;
  productId?: string;
  serviceId?: string;
  housingId?: string;
  media?: ChatMedia[];
}

interface IndicatorPayload {
  // typing, stop-typing, recording, stop-recording
  conversationId: string;
  senderId: string;
  receiverId: string;
}

interface MarkAllAsReadPayload {
  conversationId: string;
  receiverId: string; // the reader
  senderId: string;   // the other participant
}

// Server → client payloads
interface MessageDeliveredEvent {
  conversationId: string;
  messageIds: string[];
}

interface ChatException {
  status: 'error';
  message: string;
}
```

---

## Errors

### Socket errors

A failed socket event emits `exception` on the same socket:

```json
{ "status": "error", "message": "Receiver 48c03f11-8cf5-4249-b1fe-304e3197f9bd not found" }
```

| Cause                                                                  | `message`                                    |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| `senderId` doesn't match a user or store                               | `Sender <id> not found`                      |
| `receiverId` doesn't match a user or store                             | `Receiver <id> not found`                    |
| Invalid payload: missing or non-UUID id, unknown field, wrong type     | `Internal server error`                      |
| Text message without `content`                                         | A database error about the check constraint  |

Validation failures currently come back as the generic `Internal server error`. If you get it, check the payload against the tables above first: an extra field, or a missing `conversationId` on `mark-all-as-read`, is the usual cause.

When an event fails, its acknowledgement callback isn't called, so add a timeout to `emitWithAck`:

```ts
const message = await socket.timeout(10_000).emitWithAck('new-message', payload);
```

### REST errors

```json
{ "statusCode": 403, "message": "You are not in this conversation", "error": "Forbidden" }
```

| Status | When                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| `400`  | A path id isn't a valid UUID.                                                        |
| `401`  | Missing or invalid `Authorization` header.                                           |
| `403`  | The participant or conversation doesn't belong to the logged-in user or their stores. |

---

## Typical flows

### Opening the chat screen

1. Connect the socket with the `userid` header.
2. `GET /chat/conversations/:userId` for the conversation list. A user with stores can call it again with each store id to show store inboxes.
3. Listen for `new-message` to move conversations to the top and increase unread badges.

### Opening a conversation

1. `GET /chat/conversations/:conversationId/messages?limit=30`, then reverse the list to show oldest at the top.
2. Emit `mark-all-as-read` with `receiverId` set to the current participant.
3. When the user scrolls to the top, load `page=2`, `page=3`, and so on, until `nextPage` is `null`.

### Sending a message

1. Add the message to the UI immediately as "sending".
2. `emitWithAck('new-message', payload)`.
3. Replace it with the acknowledged message, which has a real `id` and a `status` of `sent` or `delivered`.
4. Update it to `delivered` when a `message-delivered` event lists its id.
5. On an `exception` or timeout, show it as failed with a retry option.

### Receiving a message

1. On `new-message`: if that conversation is open, append the message and emit `mark-all-as-read`. Otherwise increase the conversation's unread badge.

### Starting a chat from a listing

Send the first `new-message` **without** `conversationId` and with the listing's id (`productId`, `serviceId` or `housingId`). Use the `conversationId` from the acknowledgement for everything after that.

For a store listing, set `receiverId` to the **store's id**, not the owner's user id, so the message lands in the store's inbox.
