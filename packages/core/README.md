# @opchan/core

Core browser library for building decentralized forum applications with cryptographic identity management and peer-to-peer messaging.

## Overview

`@opchan/core` provides the foundational infrastructure for the OpChan protocol, featuring:

- 🔐 **Cryptographic Identity** - Ed25519 key delegation with wallet signatures
- 📡 **Waku Messaging** - Peer-to-peer communication via Waku network
- 💾 **Local-First Storage** - IndexedDB persistence with in-memory caching
- ⚖️ **Content Management** - Cells, posts, comments, and voting system
- 🎯 **Relevance Scoring** - Multi-factor content ranking algorithm
- 🛡️ **Message Validation** - Cryptographic verification of all content
- 👤 **Identity Resolution** - ENS integration and user profiles
- 🔖 **Bookmarks** - Client-side bookmark management

## Installation

```bash
npm install @opchan/core
```

## Quick Start

### 1. Initialize Client

```typescript
import { OpChanClient } from '@opchan/core';

const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/opchan/1/messages/proto',
    reliableChannelId: 'opchan-messages'
  },
  reownProjectId: 'your-reown-project-id' // Optional, for WalletConnect
});

// Open database
await client.database.open();
```

### 2. Set Up Message Listening

```typescript
// Listen for incoming messages
client.messageManager.onMessageReceived(async (message) => {
  // Apply message to local database
  await client.database.applyMessage(message);
  console.log('Received message:', message.type);
});

// Monitor network health
client.messageManager.onHealthChange((isHealthy) => {
  console.log('Network health:', isHealthy ? 'Connected' : 'Disconnected');
});
```

### 3. Delegate Signing Keys (Wallet Users)

```typescript
import { signMessage } from 'viem/accounts';

// Generate delegation for 7 days
const success = await client.delegation.delegate(
  walletAddress,
  '7days',
  async (message) => {
    return await signMessage({ message, account: walletAddress });
  }
);

if (success) {
  console.log('Delegation created successfully');
}
```

### 4. Create Content

```typescript
// Create a cell (requires ENS verification)
const cellResult = await client.forumActions.createCell(
  {
    name: 'Tech Discussion',
    description: 'A place for tech talk',
    icon: '🚀',
    currentUser: user,
    isAuthenticated: true
  },
  () => refreshUI()
);

// Create a post
const postResult = await client.forumActions.createPost(
  {
    cellId: 'cell-id',
    title: 'Hello World',
    content: 'My first post!',
    currentUser: user,
    isAuthenticated: true
  },
  () => refreshUI()
);

// Add a comment
const commentResult = await client.forumActions.createComment(
  {
    postId: 'post-id',
    content: 'Great post!',
    currentUser: user,
    isAuthenticated: true
  },
  () => refreshUI()
);

// Vote on content
await client.forumActions.vote(
  {
    targetId: 'post-id',
    isUpvote: true,
    currentUser: user,
    isAuthenticated: true
  },
  () => refreshUI()
);
```

### 5. Access Cached Data

```typescript
// Get all cells
const cells = Object.values(client.database.cache.cells);

// Get all posts
const posts = Object.values(client.database.cache.posts);

// Get posts for a specific cell
const cellPosts = posts.filter(post => post.cellId === 'cell-id');

// Get comments for a post
const comments = Object.values(client.database.cache.comments)
  .filter(comment => comment.postId === 'post-id');

// Get votes for a post
const votes = Object.values(client.database.cache.votes)
  .filter(vote => vote.targetId === 'post-id');
```

## Core Concepts

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    OpChanClient                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ MessageManager (Waku Network)                   │   │
│  │  - WakuNodeManager: Connection handling         │   │
│  │  - ReliableMessaging: Message delivery          │   │
│  │  - MessageService: Send/receive orchestration   │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ LocalDatabase (IndexedDB + Cache)               │   │
│  │  - In-memory cache for fast reads               │   │
│  │  - IndexedDB for persistence                    │   │
│  │  - Message validation and deduplication         │   │
│  └─────────────────────────────────────────────────┘   │
│                         ↕                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Services Layer                                  │   │
│  │  - ForumActions: Content creation               │   │
│  │  - UserIdentityService: Identity resolution     │   │
│  │  - DelegationManager: Key management            │   │
│  │  - RelevanceCalculator: Content scoring         │   │
│  │  - BookmarkService: Bookmark management         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Message Flow

1. **Outbound**: User action → Sign with delegated key → Store in LocalDatabase → Send via Waku
2. **Inbound**: Waku receives → Validate signature → Validate delegation proof → Store in LocalDatabase → Notify listeners

### Key Delegation

OpChan uses a two-tier signing system:

- **Wallet Key**: Used once to authorize a browser key
- **Browser Key**: Used for all subsequent messages

Benefits:
- Reduces wallet prompts from dozens to one
- Messages still cryptographically verifiable
- Works with anonymous sessions (no wallet required)

## API Reference

### OpChanClient

Main client class that orchestrates all services.

```typescript
class OpChanClient {
  readonly config: OpChanClientConfig;
  readonly messageManager: DefaultMessageManager;
  readonly database: LocalDatabase;
  readonly forumActions: ForumActions;
  readonly relevance: RelevanceCalculator;
  readonly messageService: MessageService;
  readonly userIdentityService: UserIdentityService;
  readonly delegation: DelegationManager;
}
```

**Configuration:**

```typescript
interface OpChanClientConfig {
  wakuConfig: WakuConfig;
  reownProjectId?: string;
}

interface WakuConfig {
  contentTopic: string;
  reliableChannelId: string;
}
```

---

### DelegationManager

Manages cryptographic key delegation and message signing.

#### Methods

**`delegate(address, duration, signFunction)`**

Create a wallet-signed delegation for browser keys.

```typescript
async delegate(
  address: `0x${string}`,
  duration: '7days' | '30days',
  signFunction: (message: string) => Promise<string>
): Promise<boolean>
```

**Example:**
```typescript
const success = await client.delegation.delegate(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  '7days',
  async (msg) => await wallet.signMessage(msg)
);
```

---

**`delegateAnonymous(duration)`**

Create an anonymous delegation (no wallet required).

```typescript
async delegateAnonymous(
  duration: '7days' | '30days' = '7days'
): Promise<string>
```

Returns a session ID for the anonymous user.

---

**`signMessage(message)`**

Sign a message with the delegated browser key.

```typescript
async signMessage(
  message: UnsignedMessage
): Promise<OpchanMessage | null>
```

---

**`verify(message)`**

Verify a signed message's authenticity.

```typescript
async verify(message: OpchanMessage): Promise<boolean>
```

---

**`getStatus(currentAddress?)`**

Get current delegation status.

```typescript
async getStatus(
  currentAddress?: string
): Promise<DelegationFullStatus>
```

**Returns:**
```typescript
interface DelegationFullStatus {
  hasDelegation: boolean;
  isValid: boolean;
  timeRemaining?: number;
  publicKey?: string;
  address?: `0x${string}`;
  proof?: DelegationProof;
}
```

---

**`clear()`**

Clear stored delegation.

```typescript
async clear(): Promise<void>
```

---

### LocalDatabase

IndexedDB-backed local storage with in-memory caching.

#### Properties

**`cache`** - In-memory cache of all content

```typescript
interface LocalDatabaseCache {
  cells: { [id: string]: CellMessage };
  posts: { [id: string]: PostMessage };
  comments: { [id: string]: CommentMessage };
  votes: { [key: string]: VoteMessage };
  moderations: { [key: string]: ModerateMessage };
  userIdentities: { [address: string]: UserIdentityCache };
  bookmarks: { [id: string]: Bookmark };
}
```

#### Methods

**`open()`**

Open database and hydrate cache from IndexedDB.

```typescript
async open(): Promise<void>
```

---

**`applyMessage(message)`**

Apply an incoming message to the database.

```typescript
async applyMessage(message: unknown): Promise<boolean>
```

Returns `true` if message was newly processed and stored.

---

**`storeUser(user)` / `loadUser()` / `clearUser()`**

Persist user authentication state.

```typescript
async storeUser(user: User): Promise<void>
async loadUser(): Promise<User | null>
async clearUser(): Promise<void>
```

---

**`storeDelegation(delegation)` / `loadDelegation()` / `clearDelegation()`**

Persist delegation information.

```typescript
async storeDelegation(delegation: DelegationInfo): Promise<void>
async loadDelegation(): Promise<DelegationInfo | null>
async clearDelegation(): Promise<void>
```

---

**`markPending(id)` / `clearPending(id)` / `isPending(id)`**

Track pending message synchronization.

```typescript
markPending(id: string): void
clearPending(id: string): void
isPending(id: string): boolean
onPendingChange(listener: () => void): () => void
```

---

**`addBookmark(bookmark)` / `removeBookmark(id)`**

Manage bookmarks.

```typescript
async addBookmark(bookmark: Bookmark): Promise<void>
async removeBookmark(bookmarkId: string): Promise<void>
async getUserBookmarks(userId: string): Promise<Bookmark[]>
isBookmarked(userId: string, type: 'post' | 'comment', targetId: string): boolean
```

---

### ForumActions

High-level actions for content creation and moderation.

#### Content Creation

**`createCell(params, updateCallback)`**

Create a new cell (requires ENS verification).

```typescript
async createCell(
  params: {
    name: string;
    description: string;
    icon?: string;
    currentUser: User | null;
    isAuthenticated: boolean;
  },
  updateCallback: () => void
): Promise<{ success: boolean; data?: Cell; error?: string }>
```

---

**`createPost(params, updateCallback)`**

Create a new post.

```typescript
async createPost(
  params: {
    cellId: string;
    title: string;
    content: string;
    currentUser: User | null;
    isAuthenticated: boolean;
  },
  updateCallback: () => void
): Promise<{ success: boolean; data?: Post; error?: string }>
```

---

**`createComment(params, updateCallback)`**

Create a new comment.

```typescript
async createComment(
  params: {
    postId: string;
    content: string;
    currentUser: User | null;
    isAuthenticated: boolean;
  },
  updateCallback: () => void
): Promise<{ success: boolean; data?: Comment; error?: string }>
```

---

#### Voting

**`vote(params, updateCallback)`**

Vote on a post or comment.

```typescript
async vote(
  params: {
    targetId: string;
    isUpvote: boolean;
    currentUser: User | null;
    isAuthenticated: boolean;
  },
  updateCallback: () => void
): Promise<{ success: boolean; data?: boolean; error?: string }>
```

---

#### Moderation

**`moderatePost(params, updateCallback)`**

Moderate a post (cell owner only).

```typescript
async moderatePost(
  params: {
    cellId: string;
    postId: string;
    reason?: string;
    currentUser: User | null;
    isAuthenticated: boolean;
    cellOwner: string;
  },
  updateCallback: () => void
): Promise<{ success: boolean; data?: boolean; error?: string }>
```

Similar methods exist for: `unmoderatePost`, `moderateComment`, `unmoderateComment`, `moderateUser`, `unmoderateUser`

---

### UserIdentityService

Manages user identity resolution and profiles.

#### Methods

**`getIdentity(address, opts?)`**

Get user identity with optional fresh resolution.

```typescript
async getIdentity(
  address: string,
  opts?: { fresh?: boolean }
): Promise<UserIdentity | null>
```

**Returns:**
```typescript
interface UserIdentity {
  address: `0x${string}`;
  ensName?: string;
  ensAvatar?: string;
  callSign?: string;
  displayPreference: EDisplayPreference;
  displayName: string;
  lastUpdated: number;
  verificationStatus: EVerificationStatus;
}
```

---

**`updateProfile(address, updates)`**

Update user profile (call sign and display preference).

```typescript
async updateProfile(
  address: string,
  updates: {
    callSign?: string;
    displayPreference?: EDisplayPreference;
  }
): Promise<{ ok: true; identity: UserIdentity } | { ok: false; error: Error }>
```

---

**`getDisplayName(params)`**

Get display name for a user based on their preferences.

```typescript
getDisplayName({
  address: string,
  ensName?: string | null,
  displayPreference?: EDisplayPreference
}): string
```

---

**`subscribe(listener)`**

Subscribe to identity changes.

```typescript
subscribe(
  listener: (address: string, identity: UserIdentity | null) => void
): () => void
```

---

### RelevanceCalculator

Calculates content relevance scores based on multiple factors.

#### Method

**`calculatePostScore(post, votes, comments, userVerificationStatus, moderatedPosts)`**

Calculate relevance score for a post.

```typescript
calculatePostScore(
  post: PostMessage,
  votes: VoteMessage[],
  comments: CommentMessage[],
  userVerificationStatus: UserVerificationStatus,
  moderatedPosts: { [postId: string]: ModerateMessage }
): RelevanceScoreDetails
```

**Score Factors:**
- **Base Score**: 100 points for all content
- **Engagement**: 10 points per upvote, 3 points per comment
- **Verification Bonuses**:
  - Author ENS verified: +20 points
  - Each verified upvote: +5 points
  - Each verified commenter: +10 points
- **Time Decay**: Exponential decay over 7 days (half-life)
- **Moderation Penalty**: -50% for moderated content

---

### MessageManager

Manages Waku network connectivity and message transmission.

#### Methods

**`sendMessage(message, statusCallback?)`**

Send a message via Waku network.

```typescript
async sendMessage(
  message: OpchanMessage,
  statusCallback?: (status: MessageStatus) => void
): Promise<void>
```

---

**`onMessageReceived(callback)`**

Subscribe to incoming messages.

```typescript
onMessageReceived(
  callback: (message: OpchanMessage) => void
): () => void
```

---

**`onHealthChange(callback)`**

Monitor network health.

```typescript
onHealthChange(
  callback: (isHealthy: boolean) => void
): () => void
```

---

**`onSyncStatus(callback)`**

Monitor synchronization status.

```typescript
onSyncStatus(
  callback: (status: SyncStatus) => void
): () => void
```

---

## Type Definitions

### Core Types

```typescript
// User verification levels
enum EVerificationStatus {
  ANONYMOUS = 'anonymous',
  WALLET_UNCONNECTED = 'wallet-unconnected',
  WALLET_CONNECTED = 'wallet-connected',
  ENS_VERIFIED = 'ens-verified',
}

// User display preferences
enum EDisplayPreference {
  CALL_SIGN = 'call-sign',
  WALLET_ADDRESS = 'wallet-address',
}

// User object
interface User {
  address: string; // 0x${string} for wallet, UUID for anonymous
  ensName?: string;
  ensAvatar?: string;
  callSign?: string;
  displayPreference: EDisplayPreference;
  displayName: string;
  verificationStatus: EVerificationStatus;
  lastChecked?: number;
}
```

### Message Types

```typescript
// All messages include signature fields
interface SignedMessage {
  signature: string;
  browserPubKey: string;
  delegationProof?: DelegationProof; // Present for wallet users only
}

// Message types
enum MessageType {
  CELL = 'cell',
  POST = 'post',
  COMMENT = 'comment',
  VOTE = 'vote',
  MODERATE = 'moderate',
  USER_PROFILE_UPDATE = 'user_profile_update',
}

// Cell message
interface CellMessage {
  type: MessageType.CELL;
  id: string;
  name: string;
  description: string;
  icon?: string;
  timestamp: number;
  author: string;
}

// Post message
interface PostMessage {
  type: MessageType.POST;
  id: string;
  cellId: string;
  title: string;
  content: string;
  timestamp: number;
  author: string;
}

// Comment message
interface CommentMessage {
  type: MessageType.COMMENT;
  id: string;
  postId: string;
  content: string;
  timestamp: number;
  author: string;
}

// Vote message
interface VoteMessage {
  type: MessageType.VOTE;
  id: string;
  targetId: string; // Post or comment ID
  value: 1 | -1; // Upvote or downvote
  timestamp: number;
  author: string;
}
```

### Extended Forum Types

```typescript
// Extended cell with computed fields
interface Cell extends CellMessage {
  relevanceScore?: number;
  activeMemberCount?: number;
  recentActivity?: number;
  postCount?: number;
}

// Extended post with computed fields
interface Post extends PostMessage {
  authorAddress: string;
  upvotes: VoteMessage[];
  downvotes: VoteMessage[];
  moderated?: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  relevanceScore?: number;
  verifiedUpvotes?: number;
  verifiedCommenters?: string[];
  voteScore?: number;
}

// Extended comment with computed fields
interface Comment extends CommentMessage {
  authorAddress: string;
  upvotes: VoteMessage[];
  downvotes: VoteMessage[];
  moderated?: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  relevanceScore?: number;
  voteScore?: number;
}
```

## Usage Patterns

### Pattern 1: Complete Vanilla JS Application

```typescript
import { OpChanClient, EVerificationStatus } from '@opchan/core';

// Initialize
const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/opchan/1/messages/proto',
    reliableChannelId: 'opchan-messages'
  }
});

await client.database.open();

// Set up message listener
client.messageManager.onMessageReceived(async (message) => {
  await client.database.applyMessage(message);
  renderUI();
});

// Create delegation
const sessionId = await client.delegation.delegateAnonymous('7days');
const user = {
  address: sessionId,
  displayName: 'Anonymous',
  displayPreference: EDisplayPreference.WALLET_ADDRESS,
  verificationStatus: EVerificationStatus.ANONYMOUS
};

// Create content
const result = await client.forumActions.createPost(
  {
    cellId: 'general',
    title: 'Hello',
    content: 'First post!',
    currentUser: user,
    isAuthenticated: true
  },
  () => renderUI()
);

// Render UI
function renderUI() {
  const posts = Object.values(client.database.cache.posts);
  document.getElementById('posts').innerHTML = posts
    .map(post => `<div>${post.title}</div>`)
    .join('');
}
```

---

### Pattern 2: Identity Resolution

```typescript
// Resolve user identity
const identity = await client.userIdentityService.getIdentity(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  { fresh: true }
);

console.log('Display name:', identity?.displayName);
console.log('ENS name:', identity?.ensName);
console.log('Verification:', identity?.verificationStatus);

// Update profile
const result = await client.userIdentityService.updateProfile(
  userAddress,
  {
    callSign: 'alice',
    displayPreference: EDisplayPreference.CALL_SIGN
  }
);

if (result.ok) {
  console.log('Profile updated:', result.identity);
}

// Subscribe to changes
const unsubscribe = client.userIdentityService.subscribe(
  (address, identity) => {
    console.log('Identity updated:', address, identity);
  }
);
```

---

### Pattern 3: Content Scoring

```typescript
import { transformPost } from '@opchan/core';

// Transform raw post message to enhanced post
const post = await transformPost(postMessage);

// Calculate relevance
const score = client.relevance.calculatePostScore(
  postMessage,
  votes,
  comments,
  userVerificationStatus,
  moderatedPosts
);

console.log('Relevance score:', score.finalScore);
console.log('Score breakdown:', {
  base: score.baseScore,
  engagement: score.engagementScore,
  verificationBonus: score.authorVerificationBonus + 
                     score.verifiedUpvoteBonus +
                     score.verifiedCommenterBonus,
  timeDecay: score.timeDecayMultiplier,
  moderation: score.moderationPenalty
});
```

---

### Pattern 4: Moderation

```typescript
// Check if user can moderate
const cellOwner = cell.author;
const canModerate = currentUser.address === cellOwner;

if (canModerate) {
  // Moderate a post
  await client.forumActions.moderatePost(
    {
      cellId: cell.id,
      postId: post.id,
      reason: 'Spam',
      currentUser,
      isAuthenticated: true,
      cellOwner
    },
    () => refreshUI()
  );

  // Unmoderate a post
  await client.forumActions.unmoderatePost(
    {
      cellId: cell.id,
      postId: post.id,
      currentUser,
      isAuthenticated: true,
      cellOwner
    },
    () => refreshUI()
  );
}
```

---

### Pattern 5: Bookmarks

```typescript
import { BookmarkService } from '@opchan/core';

const bookmarkService = new BookmarkService();

// Add post bookmark
await bookmarkService.addPostBookmark(
  post,
  userId,
  cellId
);

// Add comment bookmark
await bookmarkService.addCommentBookmark(
  comment,
  userId,
  postId
);

// Get user bookmarks
const bookmarks = await client.database.getUserBookmarks(userId);

// Check if bookmarked
const isBookmarked = client.database.isBookmarked(
  userId,
  'post',
  postId
);

// Remove bookmark
await bookmarkService.removeBookmark(bookmarkId);
```

---

## Complete Example

Here's a complete vanilla JavaScript application using `@opchan/core`:

```typescript
import {
  OpChanClient,
  EVerificationStatus,
  EDisplayPreference,
  transformPost,
  transformComment
} from '@opchan/core';

class OpChanApp {
  private client: OpChanClient;
  private currentUser: any = null;

  async initialize() {
    // Create client
    this.client = new OpChanClient({
      wakuConfig: {
        contentTopic: '/opchan/1/messages/proto',
        reliableChannelId: 'opchan-messages'
      }
    });

    // Open database
    await this.client.database.open();

    // Set up listeners
    this.setupListeners();

    // Create anonymous session
    await this.startAnonymousSession();

    // Initial render
    this.render();
  }

  private setupListeners() {
    // Message listener
    this.client.messageManager.onMessageReceived(async (message) => {
      await this.client.database.applyMessage(message);
      this.render();
    });

    // Health listener
    this.client.messageManager.onHealthChange((isHealthy) => {
      console.log('Network:', isHealthy ? 'Connected' : 'Disconnected');
      this.render();
    });
  }

  private async startAnonymousSession() {
    const sessionId = await this.client.delegation.delegateAnonymous('7days');
    this.currentUser = {
      address: sessionId,
      displayName: 'Anonymous',
      displayPreference: EDisplayPreference.WALLET_ADDRESS,
      verificationStatus: EVerificationStatus.ANONYMOUS
    };
  }

  private async createPost(cellId: string, title: string, content: string) {
    const result = await this.client.forumActions.createPost(
      {
        cellId,
        title,
        content,
        currentUser: this.currentUser,
        isAuthenticated: true
      },
      () => this.render()
    );

    if (result.success) {
      console.log('Post created:', result.data);
    } else {
      console.error('Failed to create post:', result.error);
    }
  }

  private async vote(targetId: string, isUpvote: boolean) {
    await this.client.forumActions.vote(
      {
        targetId,
        isUpvote,
        currentUser: this.currentUser,
        isAuthenticated: true
      },
      () => this.render()
    );
  }

  private render() {
    const cells = Object.values(this.client.database.cache.cells);
    const posts = Object.values(this.client.database.cache.posts);
    const comments = Object.values(this.client.database.cache.comments);

    console.log('Cells:', cells.length);
    console.log('Posts:', posts.length);
    console.log('Comments:', comments.length);

    // Update DOM here...
  }
}

// Start app
const app = new OpChanApp();
app.initialize();
```

## Advanced Topics

### Message Validation

All messages are validated before storage:

```typescript
import { MessageValidator } from '@opchan/core';

const validator = new MessageValidator();

// Validate message
const isValid = await validator.isValidMessage(message);

// Get detailed validation report
const report = await validator.getValidationReport(message);
console.log('Validation report:', {
  isValid: report.isValid,
  missingFields: report.missingFields,
  invalidFields: report.invalidFields,
  hasValidSignature: report.hasValidSignature,
  errors: report.errors,
  warnings: report.warnings
});
```

### Custom Transformers

Transform raw messages into enhanced domain objects:

```typescript
import { transformPost, transformComment, transformCell } from '@opchan/core';

// Transform post with votes and comments
const enhancedPost = await transformPost(postMessage);

// Transform comment with votes
const enhancedComment = await transformComment(commentMessage);

// Transform cell with stats
const enhancedCell = await transformCell(cellMessage);
```

### Network Configuration

Configure Waku network parameters:

```typescript
const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/my-app/1/messages/proto',
    reliableChannelId: 'my-app-messages',
    // Additional Waku options...
  }
});
```

## Best Practices

1. **Always open database before use**: Call `client.database.open()` on initialization
2. **Listen for messages**: Set up `onMessageReceived` listener to stay synchronized
3. **Handle delegation expiry**: Check delegation status and refresh when needed
4. **Validate user permissions**: Use `ForumActions` validation or implement custom checks
5. **Use transformers for UI**: Transform raw messages to enhanced types for rendering
6. **Monitor network health**: Subscribe to health changes for connection indicators
7. **Implement optimistic UI**: Mark items as pending during network operations
8. **Cache identity lookups**: Use `UserIdentityService` for efficient identity resolution

## Troubleshooting

### Messages not appearing

- **Check delegation**: Ensure delegation is valid with `delegation.getStatus()`
- **Verify network**: Monitor `onHealthChange` for connectivity issues
- **Check validation**: Messages may be rejected if signature is invalid

### Database not persisting

- **Call open()**: Ensure `database.open()` was called before use
- **Check browser support**: IndexedDB must be available
- **Clear cache**: Try `database.clearAll()` to reset

### Identity not resolving

- **Set public client**: Call `userIdentityService.setPublicClient(publicClient)` for ENS
- **Force refresh**: Use `getIdentity(address, { fresh: true })` to bypass cache
- **Check network**: ENS resolution requires network connectivity

## License

MIT

---

**Built for decentralized communities** 🌐

