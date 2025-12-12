# OpChan Core - Quick Start

Get up and running with OpChan in 5 minutes.

---

## Installation

```bash
npm install @opchan/core
```

---

## Minimal Working Example

```typescript
import { OpChanClient, EVerificationStatus, EDisplayPreference } from '@opchan/core';

// 1. Create client
const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/opchan/1/messages/proto',
    reliableChannelId: 'opchan-messages'
  }
});

// 2. Open database
await client.database.open();

// 3. Listen for messages
client.messageManager.onMessageReceived(async (message) => {
  await client.database.applyMessage(message);
  console.log('Received:', message.type);
});

// 4. Start anonymous session
const sessionId = await client.delegation.delegateAnonymous('7days');
const user = {
  address: sessionId,
  displayName: 'Anonymous',
  displayPreference: EDisplayPreference.WALLET_ADDRESS,
  verificationStatus: EVerificationStatus.ANONYMOUS
};

// 5. Create a post
const result = await client.forumActions.createPost(
  {
    cellId: 'general',
    title: 'Hello World',
    content: 'My first post!',
    currentUser: user,
    isAuthenticated: true
  },
  () => console.log('Post created!')
);

// 6. Read posts
const posts = Object.values(client.database.cache.posts);
console.log('Posts:', posts.length);
```

---

## Essential Operations

### Create Content

```typescript
// Post
await client.forumActions.createPost({
  cellId: 'general',
  title: 'Title',
  content: 'Content',
  currentUser: user,
  isAuthenticated: true
}, () => {});

// Comment
await client.forumActions.createComment({
  postId: 'post-id',
  content: 'Great post!',
  currentUser: user,
  isAuthenticated: true
}, () => {});

// Vote
await client.forumActions.vote({
  targetId: 'post-id',
  isUpvote: true,
  currentUser: user,
  isAuthenticated: true
}, () => {});
```

### Read Content

```typescript
// All cells
const cells = Object.values(client.database.cache.cells);

// All posts
const posts = Object.values(client.database.cache.posts);

// Posts in a cell
const cellPosts = posts.filter(p => p.cellId === 'cell-id');

// Comments on a post
const comments = Object.values(client.database.cache.comments)
  .filter(c => c.postId === 'post-id');

// Votes on a post
const votes = Object.values(client.database.cache.votes)
  .filter(v => v.targetId === 'post-id');
```

### Network Status

```typescript
// Check connection
const isReady = client.messageManager.isReady;

// Listen for changes
client.messageManager.onHealthChange((isHealthy) => {
  console.log(isHealthy ? 'Connected' : 'Offline');
});
```

---

## Complete Starter Template

```typescript
import { OpChanClient, EVerificationStatus, EDisplayPreference, type User } from '@opchan/core';

class MyForumApp {
  private client: OpChanClient;
  private currentUser: User | null = null;

  async init() {
    // Initialize
    this.client = new OpChanClient({
      wakuConfig: {
        contentTopic: '/opchan/1/messages/proto',
        reliableChannelId: 'opchan-messages'
      }
    });

    await this.client.database.open();

    // Set up listeners
    client.messageManager.onMessageReceived(async (message) => {
      await client.database.applyMessage(message);
      this.onNewMessage(message);
    });

    // Start session
    const sessionId = await client.delegation.delegateAnonymous('7days');
    this.currentUser = {
      address: sessionId,
      displayName: 'Anonymous',
      displayPreference: EDisplayPreference.WALLET_ADDRESS,
      verificationStatus: EVerificationStatus.ANONYMOUS
    };

    this.render();
  }

  async createPost(cellId: string, title: string, content: string) {
    if (!this.currentUser) return;

    const result = await this.client.forumActions.createPost(
      { cellId, title, content, currentUser: this.currentUser, isAuthenticated: true },
      () => this.render()
    );

    if (!result.success) {
      console.error('Failed:', result.error);
    }
  }

  private onNewMessage(message: any) {
    console.log('New message:', message.type);
    this.render();
  }

  private render() {
    const posts = Object.values(this.client.database.cache.posts);
    console.log('Posts:', posts.length);
    // Update your UI here
  }
}

// Start
const app = new MyForumApp();
await app.init();
```

---

## Next Steps

- **Full Documentation**: See [README.md](./README.md)
- **Getting Started Guide**: See [docs/getting-started.md](./docs/getting-started.md)
- **API Reference**: See [docs/api-reference.md](./docs/api-reference.md)
- **Architecture**: See [docs/architecture.md](./docs/architecture.md)
- **Sample Apps**: See [docs/sample-apps.md](./docs/sample-apps.md)

---

## Common Patterns

### Wallet Connection

```typescript
import { signMessage } from 'viem/accounts';

await client.delegation.delegate(
  walletAddress,
  '7days',
  async (msg) => await signMessage({ message: msg, account: walletAddress })
);
```

### ENS Resolution

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

client.userIdentityService.setPublicClient(publicClient);

const identity = await client.userIdentityService.getIdentity(address);
console.log('ENS name:', identity?.ensName);
```

### Relevance Scoring

```typescript
import { transformPost } from '@opchan/core';

const post = await transformPost(postMessage);
console.log('Relevance score:', post?.relevanceScore);
```

### Bookmarks

```typescript
import { BookmarkService } from '@opchan/core';

const bookmarkService = new BookmarkService();
await bookmarkService.addPostBookmark(post, userId, cellId);
```

---

**Ready to build!** 🚀

