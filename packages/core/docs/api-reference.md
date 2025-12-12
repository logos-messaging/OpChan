# @opchan/core API Reference

Complete API documentation for all classes, interfaces, and utilities in the OpChan Core SDK.

---

## Table of Contents

1. [OpChanClient](#opchanclient)
2. [DelegationManager](#delegationmanager)
3. [LocalDatabase](#localdatabase)
4. [ForumActions](#forumactions)
5. [UserIdentityService](#useridentityservice)
6. [RelevanceCalculator](#relevancecalculator)
7. [MessageManager](#messagemanager)
8. [BookmarkService](#bookmarkservice)
9. [MessageValidator](#messagevalidator)
10. [Type Definitions](#type-definitions)
11. [Utility Functions](#utility-functions)

---

## OpChanClient

Main client class that orchestrates all services and provides a unified interface.

### Constructor

```typescript
constructor(config: OpChanClientConfig)
```

**Parameters:**

- `config.wakuConfig` - Waku network configuration
  - `contentTopic` - Content topic for Waku messages (e.g., `/opchan/1/messages/proto`)
  - `reliableChannelId` - Channel ID for reliable messaging (e.g., `opchan-messages`)
- `config.reownProjectId` - Optional Reown/WalletConnect project ID

**Example:**

```typescript
const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/opchan/1/messages/proto',
    reliableChannelId: 'opchan-messages'
  },
  reownProjectId: 'your-project-id'
});
```

### Properties

#### `config: OpChanClientConfig`

Client configuration object passed to constructor.

#### `messageManager: DefaultMessageManager`

Manages Waku network connectivity and message transmission.

#### `database: LocalDatabase`

IndexedDB-backed local storage with in-memory caching.

#### `forumActions: ForumActions`

High-level actions for content creation and moderation.

#### `relevance: RelevanceCalculator`

Content relevance scoring algorithm.

#### `messageService: MessageService`

Low-level message signing and broadcasting.

#### `userIdentityService: UserIdentityService`

User identity resolution and profile management.

#### `delegation: DelegationManager`

Cryptographic key delegation system.

---

## DelegationManager

Manages browser key delegation with wallet signatures or anonymous sessions.

### Methods

#### `delegate(address, duration, signFunction)`

Create a wallet-signed delegation authorizing browser keys.

**Signature:**

```typescript
async delegate(
  address: `0x${string}`,
  duration: '7days' | '30days' = '7days',
  signFunction: (message: string) => Promise<string>
): Promise<boolean>
```

**Parameters:**

- `address` - Wallet address to delegate from
- `duration` - Delegation validity period ('7days' or '30days')
- `signFunction` - Function that signs the authorization message with wallet

**Returns:** `true` if delegation created successfully, `false` otherwise

**Example:**

```typescript
import { signMessage } from 'viem/accounts';

const success = await client.delegation.delegate(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  '7days',
  async (message) => await signMessage({ message, account: walletAddress })
);
```

**Flow:**

1. Generates Ed25519 browser keypair
2. Creates authorization message with expiry timestamp and nonce
3. Signs authorization message with wallet (via `signFunction`)
4. Stores delegation in IndexedDB
5. Returns success status

---

#### `delegateAnonymous(duration)`

Create an anonymous delegation without wallet signature.

**Signature:**

```typescript
async delegateAnonymous(
  duration: '7days' | '30days' = '7days'
): Promise<string>
```

**Parameters:**

- `duration` - Delegation validity period

**Returns:** Session ID (UUID) for the anonymous user

**Example:**

```typescript
const sessionId = await client.delegation.delegateAnonymous('7days');
// sessionId: "a3f5c2d1-8e9b-4c7a-b6d5-3e2f1a0b9c8d"
```

**Flow:**

1. Generates Ed25519 browser keypair
2. Generates UUID session ID
3. Creates expiry timestamp and nonce
4. Stores anonymous delegation in IndexedDB
5. Returns session ID as user address

---

#### `signMessage(message)`

Sign a message with the delegated browser key.

**Signature:**

```typescript
async signMessage(
  message: UnsignedMessage
): Promise<OpchanMessage | null>
```

**Parameters:**

- `message` - Unsigned message object (cell, post, comment, vote, etc.)

**Returns:** Signed message with signature and delegation proof, or `null` if delegation invalid

**Example:**

```typescript
const unsignedPost = {
  type: MessageType.POST,
  id: 'post-id',
  cellId: 'cell-id',
  title: 'Hello',
  content: 'World',
  timestamp: Date.now(),
  author: userAddress
};

const signed = await client.delegation.signMessage(unsignedPost);
if (signed) {
  // Message is now signed and ready to send
  await client.messageManager.sendMessage(signed);
}
```

**Signature Process:**

1. Retrieves cached delegation (or loads from storage)
2. Checks if delegation is valid (not expired)
3. Creates message payload (excluding signature fields)
4. Signs payload with browser private key (Ed25519)
5. Attaches signature, browser public key, and delegation proof
6. Returns signed message

---

#### `verify(message)`

Verify a signed message's authenticity.

**Signature:**

```typescript
async verify(message: OpchanMessage): Promise<boolean>
```

**Parameters:**

- `message` - Signed message to verify

**Returns:** `true` if message is valid, `false` otherwise

**Example:**

```typescript
const isValid = await client.delegation.verify(message);
if (isValid) {
  await client.database.applyMessage(message);
}
```

**Verification Process:**

1. Checks required fields (signature, browserPubKey, author)
2. Verifies message signature with browser public key
3. If wallet delegation: verifies delegation proof
4. If anonymous: validates session ID format (UUID)
5. Returns validation result

---

#### `verifyWithReason(message)`

Verify message and return detailed validation reasons.

**Signature:**

```typescript
async verifyWithReason(
  message: OpchanMessage
): Promise<{ isValid: boolean; reasons: string[] }>
```

**Example:**

```typescript
const result = await client.delegation.verifyWithReason(message);
if (!result.isValid) {
  console.error('Validation failed:', result.reasons);
}
```

---

#### `getStatus(currentAddress?)`

Get current delegation status.

**Signature:**

```typescript
async getStatus(
  currentAddress?: string
): Promise<DelegationFullStatus>
```

**Parameters:**

- `currentAddress` - Optional address to check against stored delegation

**Returns:**

```typescript
interface DelegationFullStatus {
  hasDelegation: boolean;
  isValid: boolean;
  timeRemaining?: number; // milliseconds
  publicKey?: string;
  address?: `0x${string}`;
  proof?: DelegationProof;
}
```

**Example:**

```typescript
const status = await client.delegation.getStatus(userAddress);

if (!status.isValid) {
  console.log('Delegation expired or invalid');
  // Re-authorize user
} else {
  console.log(`Valid for ${Math.round(status.timeRemaining! / 3600000)} more hours`);
}
```

---

#### `clear()`

Clear stored delegation from IndexedDB.

**Signature:**

```typescript
async clear(): Promise<void>
```

**Example:**

```typescript
await client.delegation.clear();
// User needs to re-authorize
```

---

## LocalDatabase

IndexedDB-backed local storage with in-memory caching for fast reads.

### Properties

#### `cache: LocalDatabaseCache`

In-memory cache of all content. Fast synchronous access.

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

**Example:**

```typescript
// Synchronous access to cached data
const cells = Object.values(client.database.cache.cells);
const posts = Object.values(client.database.cache.posts);

// Filter by relationship
const cellPosts = posts.filter(p => p.cellId === 'cell-id');
```

### Methods

#### `open()`

Open IndexedDB and hydrate in-memory cache.

**Signature:**

```typescript
async open(): Promise<void>
```

**Example:**

```typescript
const client = new OpChanClient(config);
await client.database.open(); // MUST call before use
```

**Hydration Process:**

1. Opens IndexedDB connection
2. Loads all cells, posts, comments, votes, moderations from stores
3. Populates in-memory cache
4. Loads pending message IDs
5. Ready for use

---

#### `applyMessage(message)`

Validate and store an incoming message.

**Signature:**

```typescript
async applyMessage(message: unknown): Promise<boolean>
```

**Parameters:**

- `message` - Message to validate and store

**Returns:** `true` if message was newly processed and stored, `false` if invalid or duplicate

**Example:**

```typescript
client.messageManager.onMessageReceived(async (message) => {
  const wasNew = await client.database.applyMessage(message);
  if (wasNew) {
    console.log('New message stored:', message.type);
    updateUI();
  }
});
```

**Process:**

1. Validates message signature and structure
2. Checks for duplicates (message key = `type:id:timestamp`)
3. Stores in appropriate cache collection
4. Persists to IndexedDB
5. Updates last sync timestamp
6. Returns whether message was new

---

#### `updateCache(message)`

Alias for `applyMessage()`. For backward compatibility.

---

#### `clear()`

Clear all in-memory cache (does not affect IndexedDB).

**Signature:**

```typescript
clear(): void
```

---

#### `clearAll()`

Clear both in-memory cache and all IndexedDB stores.

**Signature:**

```typescript
async clearAll(): Promise<void>
```

**Example:**

```typescript
// Complete reset
await client.database.clearAll();
await client.database.open();
```

---

### User Storage

#### `storeUser(user)` / `loadUser()` / `clearUser()`

Persist user authentication state.

**Signatures:**

```typescript
async storeUser(user: User): Promise<void>
async loadUser(): Promise<User | null>
async clearUser(): Promise<void>
```

**Example:**

```typescript
// Store current user
await client.database.storeUser(currentUser);

// Load on app start
const restoredUser = await client.database.loadUser();
if (restoredUser) {
  console.log('Restored session:', restoredUser.displayName);
}

// Clear on logout
await client.database.clearUser();
```

**User Expiry:** Stored user expires after 24 hours. `loadUser()` returns `null` if expired.

---

### Delegation Storage

#### `storeDelegation(delegation)` / `loadDelegation()` / `clearDelegation()`

Persist delegation information.

**Signatures:**

```typescript
async storeDelegation(delegation: DelegationInfo): Promise<void>
async loadDelegation(): Promise<DelegationInfo | null>
async clearDelegation(): Promise<void>
```

---

### Pending State

#### `markPending(id)` / `clearPending(id)` / `isPending(id)` / `onPendingChange(listener)`

Track pending message synchronization for optimistic UI.

**Signatures:**

```typescript
markPending(id: string): void
clearPending(id: string): void
isPending(id: string): boolean
onPendingChange(listener: () => void): () => void
```

**Example:**

```typescript
// Mark as pending when creating
const post = await createPost(...);
client.database.markPending(post.id);

// Show pending indicator
if (client.database.isPending(post.id)) {
  showSyncingBadge(post.id);
}

// Listen for changes
const unsubscribe = client.database.onPendingChange(() => {
  updateAllPendingIndicators();
});

// Clear when confirmed via network
client.database.clearPending(post.id);
```

---

### Sync State

#### `getSyncState()` / `setSyncing(isSyncing)` / `updateLastSync(timestamp)`

Manage synchronization state.

**Signatures:**

```typescript
getSyncState(): { lastSync: number | null; isSyncing: boolean }
setSyncing(isSyncing: boolean): void
updateLastSync(timestamp: number): void
```

**Example:**

```typescript
const { lastSync, isSyncing } = client.database.getSyncState();

if (isSyncing) {
  showSyncSpinner();
}

if (lastSync) {
  console.log('Last synced:', new Date(lastSync));
}
```

---

### Bookmarks

#### `addBookmark(bookmark)` / `removeBookmark(id)` / `getUserBookmarks(userId)`

Manage user bookmarks.

**Signatures:**

```typescript
async addBookmark(bookmark: Bookmark): Promise<void>
async removeBookmark(bookmarkId: string): Promise<void>
async getUserBookmarks(userId: string): Promise<Bookmark[]>
async getUserBookmarksByType(userId: string, type: 'post' | 'comment'): Promise<Bookmark[]>
isBookmarked(userId: string, type: 'post' | 'comment', targetId: string): boolean
getBookmark(bookmarkId: string): Bookmark | undefined
getAllBookmarks(): Bookmark[]
```

**Example:**

```typescript
// Add bookmark
await client.database.addBookmark({
  id: `post:${postId}`,
  type: 'post',
  targetId: postId,
  userId: currentUser.address,
  createdAt: Date.now(),
  title: post.title,
  author: post.author,
  cellId: post.cellId
});

// Check if bookmarked
const isBookmarked = client.database.isBookmarked(
  userId,
  'post',
  postId
);

// Get all user bookmarks
const bookmarks = await client.database.getUserBookmarks(userId);

// Remove bookmark
await client.database.removeBookmark(`post:${postId}`);
```

---

### User Identity Cache

#### `upsertUserIdentity(address, record)`

Update user identity in centralized cache.

**Signature:**

```typescript
async upsertUserIdentity(
  address: string,
  record: Partial<UserIdentityCache[string]> & { lastUpdated?: number }
): Promise<void>
```

**Example:**

```typescript
await client.database.upsertUserIdentity(address, {
  ensName: 'alice.eth',
  ensAvatar: 'https://...',
  verificationStatus: 'ens-verified',
  lastUpdated: Date.now()
});
```

---

### UI State

#### `storeUIState(key, value)` / `loadUIState(key)` / `clearUIState(key)`

Persist arbitrary UI state to IndexedDB.

**Signatures:**

```typescript
async storeUIState(key: string, value: unknown): Promise<void>
async loadUIState(key: string): Promise<unknown>
async clearUIState(key: string): Promise<void>
```

**Example:**

```typescript
// Store theme preference
await client.database.storeUIState('theme', 'dark');

// Load on app start
const theme = await client.database.loadUIState('theme');

// Clear
await client.database.clearUIState('theme');
```

---

## ForumActions

High-level actions for content creation, voting, and moderation.

### Content Creation

#### `createCell(params, updateCallback)`

Create a new cell. Requires ENS-verified wallet.

**Signature:**

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

**Parameters:**

- `params.name` - Cell name (required)
- `params.description` - Cell description (required)
- `params.icon` - Optional emoji/icon for cell
- `params.currentUser` - Current user object
- `params.isAuthenticated` - Whether user is authenticated
- `updateCallback` - Function called when cache is updated (for UI refresh)

**Returns:** Result object with success status, created cell, or error message

**Permissions:** Only ENS-verified users can create cells

**Example:**

```typescript
const result = await client.forumActions.createCell(
  {
    name: 'Tech Discussion',
    description: 'A place for tech enthusiasts',
    icon: '💻',
    currentUser,
    isAuthenticated: true
  },
  () => {
    // Refresh UI
    renderCells();
  }
);

if (result.success) {
  console.log('Cell created:', result.data);
} else {
  console.error('Error:', result.error);
}
```

---

#### `createPost(params, updateCallback)`

Create a new post in a cell.

**Signature:**

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

**Permissions:** Wallet-connected or anonymous users

**Example:**

```typescript
const result = await client.forumActions.createPost(
  {
    cellId: 'cell-id',
    title: 'My First Post',
    content: 'Hello, OpChan!',
    currentUser,
    isAuthenticated: true
  },
  () => renderPosts()
);
```

---

#### `createComment(params, updateCallback)`

Add a comment to a post.

**Signature:**

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

**Permissions:** Wallet-connected or anonymous users

**Example:**

```typescript
const result = await client.forumActions.createComment(
  {
    postId: 'post-id',
    content: 'Great post!',
    currentUser,
    isAuthenticated: true
  },
  () => renderComments()
);
```

---

### Voting

#### `vote(params, updateCallback)`

Vote on a post or comment.

**Signature:**

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

**Permissions:** Wallet-connected or anonymous users

**Example:**

```typescript
// Upvote
await client.forumActions.vote(
  {
    targetId: postId,
    isUpvote: true,
    currentUser,
    isAuthenticated: true
  },
  () => updateVoteCount()
);

// Downvote
await client.forumActions.vote(
  {
    targetId: commentId,
    isUpvote: false,
    currentUser,
    isAuthenticated: true
  },
  () => updateVoteCount()
);
```

---

### Moderation

#### `moderatePost(params, updateCallback)`

Moderate a post (hide it).

**Signature:**

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

**Permissions:** Cell owner only

**Similar Methods:**

- `unmoderatePost()` - Remove moderation from post
- `moderateComment()` - Moderate a comment
- `unmoderateComment()` - Remove moderation from comment
- `moderateUser()` - Moderate user in a cell
- `unmoderateUser()` - Remove user moderation

**Example:**

```typescript
const cell = client.database.cache.cells[cellId];

if (currentUser.address === cell.author) {
  await client.forumActions.moderatePost(
    {
      cellId,
      postId,
      reason: 'Spam',
      currentUser,
      isAuthenticated: true,
      cellOwner: cell.author
    },
    () => renderPosts()
  );
}
```

---

## UserIdentityService

Manages user identity resolution, ENS lookup, and profile management.

### Methods

#### `getIdentity(address, opts?)`

Get user identity with ENS resolution and caching.

**Signature:**

```typescript
async getIdentity(
  address: string,
  opts?: { fresh?: boolean }
): Promise<UserIdentity | null>
```

**Parameters:**

- `address` - Wallet address or session ID
- `opts.fresh` - If `true`, bypass cache and resolve fresh

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

**Example:**

```typescript
// Cached lookup (fast)
const identity = await client.userIdentityService.getIdentity(address);

// Fresh lookup (bypasses cache)
const freshIdentity = await client.userIdentityService.getIdentity(
  address,
  { fresh: true }
);

if (identity) {
  console.log('Display name:', identity.displayName);
  console.log('ENS name:', identity.ensName);
  console.log('Call sign:', identity.callSign);
  console.log('Verification:', identity.verificationStatus);
}
```

**Caching Strategy:**

1. Checks LocalDatabase cache first
2. If not found or stale, resolves from ENS
3. Stores result in cache
4. Returns identity

---

#### `setPublicClient(publicClient)`

Set viem PublicClient for ENS resolution.

**Signature:**

```typescript
setPublicClient(publicClient: PublicClient): void
```

**Example:**

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
});

client.userIdentityService.setPublicClient(publicClient);
```

---

#### `updateProfile(address, updates)`

Update user profile (call sign and display preference).

**Signature:**

```typescript
async updateProfile(
  address: string,
  updates: {
    callSign?: string;
    displayPreference?: EDisplayPreference;
  }
): Promise<{ ok: true; identity: UserIdentity } | { ok: false; error: Error }>
```

**Example:**

```typescript
const result = await client.userIdentityService.updateProfile(
  userAddress,
  {
    callSign: 'alice',
    displayPreference: EDisplayPreference.CALL_SIGN
  }
);

if (result.ok) {
  console.log('Profile updated:', result.identity);
} else {
  console.error('Failed:', result.error);
}
```

**Process:**

1. Creates USER_PROFILE_UPDATE message
2. Signs with delegated key
3. Broadcasts to network
4. Updates LocalDatabase
5. Returns updated identity

---

#### `getDisplayName(params)`

Get display name for a user based on their preferences.

**Signature:**

```typescript
getDisplayName({
  address: string,
  ensName?: string | null,
  displayPreference?: EDisplayPreference
}): string
```

**Example:**

```typescript
const displayName = client.userIdentityService.getDisplayName({
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  ensName: 'alice.eth',
  displayPreference: EDisplayPreference.CALL_SIGN
});

// If user has call sign and preference is CALL_SIGN: "alice"
// If user has ENS: "alice.eth"
// Otherwise: "0x742d...0bEb"
```

---

#### `subscribe(listener)`

Subscribe to identity changes.

**Signature:**

```typescript
subscribe(
  listener: (address: string, identity: UserIdentity | null) => void
): () => void
```

**Returns:** Unsubscribe function

**Example:**

```typescript
const unsubscribe = client.userIdentityService.subscribe(
  (address, identity) => {
    console.log('Identity updated:', address);
    if (identity) {
      updateUserDisplay(address, identity.displayName);
    }
  }
);

// Clean up
unsubscribe();
```

---

#### `getAll()`

Get all cached user identities.

**Signature:**

```typescript
getAll(): UserIdentity[]
```

---

#### `refreshIdentity(address)`

Force refresh of a user's identity.

**Signature:**

```typescript
async refreshIdentity(address: string): Promise<void>
```

---

## RelevanceCalculator

Calculates content relevance scores based on multiple factors.

### Method

#### `calculatePostScore(post, votes, comments, userVerificationStatus, moderatedPosts)`

Calculate relevance score for a post.

**Signature:**

```typescript
calculatePostScore(
  post: PostMessage,
  votes: VoteMessage[],
  comments: CommentMessage[],
  userVerificationStatus: UserVerificationStatus,
  moderatedPosts: { [postId: string]: ModerateMessage }
): RelevanceScoreDetails
```

**Parameters:**

- `post` - Post message to score
- `votes` - All votes for this post
- `comments` - All comments on this post
- `userVerificationStatus` - Verification status of all users (for bonuses)
- `moderatedPosts` - Moderation records

**Returns:**

```typescript
interface RelevanceScoreDetails {
  baseScore: number; // 100
  engagementScore: number; // upvotes*10 + comments*3
  authorVerificationBonus: number; // +20 if ENS verified
  verifiedUpvoteBonus: number; // +5 per verified upvoter
  verifiedCommenterBonus: number; // +10 per verified commenter
  timeDecayMultiplier: number; // Exponential decay (half-life 7 days)
  moderationPenalty: number; // -50% if moderated
  finalScore: number; // Combined total
  isVerified: boolean;
  upvotes: number;
  comments: number;
  verifiedUpvotes: number;
  verifiedCommenters: number;
  daysOld: number;
  isModerated: boolean;
}
```

**Scoring Formula:**

```
base = 100
engagement = (upvotes * 10) + (comments * 3)
verification = (author ENS ? 20 : 0) +
               (verified upvoters * 5) +
               (verified commenters * 10)
timeDecay = exp(-0.693 * daysOld / 7)
moderation = isModerated ? 0.5 : 1.0

finalScore = (base + engagement + verification) * timeDecay * moderation
```

**Example:**

```typescript
const post = client.database.cache.posts['post-id'];
const votes = Object.values(client.database.cache.votes)
  .filter(v => v.targetId === post.id);
const comments = Object.values(client.database.cache.comments)
  .filter(c => c.postId === post.id);

const userVerificationStatus = {};
for (const [addr, identity] of Object.entries(client.database.cache.userIdentities)) {
  userVerificationStatus[addr] = {
    isVerified: identity.verificationStatus === 'ens-verified',
    hasENS: !!identity.ensName,
    ensName: identity.ensName
  };
}

const score = client.relevance.calculatePostScore(
  post,
  votes,
  comments,
  userVerificationStatus,
  client.database.cache.moderations
);

console.log('Final score:', score.finalScore);
console.log('Breakdown:', {
  base: score.baseScore,
  engagement: score.engagementScore,
  verification: score.authorVerificationBonus + 
                score.verifiedUpvoteBonus +
                score.verifiedCommenterBonus,
  timeDecay: score.timeDecayMultiplier,
  moderation: score.moderationPenalty
});
```

---

## MessageManager

Manages Waku network connectivity and message transmission.

### Properties

#### `isReady: boolean`

Whether Waku node is ready to send/receive messages.

#### `currentHealth: HealthStatus`

Current network health status.

### Methods

#### `sendMessage(message, statusCallback?)`

Send a message via Waku network.

**Signature:**

```typescript
async sendMessage(
  message: OpchanMessage,
  statusCallback?: (status: MessageStatus) => void
): Promise<void>
```

**Example:**

```typescript
const signed = await client.delegation.signMessage(unsignedMessage);
if (signed) {
  await client.messageManager.sendMessage(signed, (status) => {
    console.log('Message status:', status);
  });
}
```

---

#### `onMessageReceived(callback)`

Subscribe to incoming messages.

**Signature:**

```typescript
onMessageReceived(
  callback: (message: OpchanMessage) => void
): () => void
```

**Returns:** Unsubscribe function

**Example:**

```typescript
const unsubscribe = client.messageManager.onMessageReceived(
  async (message) => {
    await client.database.applyMessage(message);
    console.log('Received:', message.type);
  }
);
```

---

#### `onHealthChange(callback)`

Monitor network health changes.

**Signature:**

```typescript
onHealthChange(
  callback: (isHealthy: boolean) => void
): () => void
```

**Example:**

```typescript
client.messageManager.onHealthChange((isHealthy) => {
  if (isHealthy) {
    showConnectedIndicator();
  } else {
    showDisconnectedIndicator();
  }
});
```

---

#### `onSyncStatus(callback)`

Monitor synchronization status.

**Signature:**

```typescript
onSyncStatus(
  callback: (status: SyncStatus) => void
): () => void
```

---

## BookmarkService

Service for managing user bookmarks (posts and comments).

### Methods

#### `addPostBookmark(post, userId, cellId?)`

Add a post to bookmarks.

**Signature:**

```typescript
async addPostBookmark(
  post: Post,
  userId: string,
  cellId?: string
): Promise<Bookmark>
```

---

#### `addCommentBookmark(comment, userId, postId?)`

Add a comment to bookmarks.

**Signature:**

```typescript
async addCommentBookmark(
  comment: Comment,
  userId: string,
  postId?: string
): Promise<Bookmark>
```

---

#### `removeBookmark(bookmarkId)`

Remove a bookmark by ID.

**Signature:**

```typescript
async removeBookmark(bookmarkId: string): Promise<void>
```

**Example:**

```typescript
import { BookmarkService } from '@opchan/core';

const bookmarkService = new BookmarkService();

// Add post bookmark
await bookmarkService.addPostBookmark(post, userId, cellId);

// Check if bookmarked
const isBookmarked = client.database.isBookmarked(userId, 'post', postId);

// Remove bookmark
await bookmarkService.removeBookmark(`post:${postId}`);
```

---

## MessageValidator

Validates message signatures and structure.

### Methods

#### `isValidMessage(message)`

Check if message is valid.

**Signature:**

```typescript
async isValidMessage(message: unknown): Promise<boolean>
```

---

#### `getValidationReport(message)`

Get detailed validation report.

**Signature:**

```typescript
async getValidationReport(message: unknown): Promise<{
  isValid: boolean;
  missingFields: string[];
  invalidFields: string[];
  hasValidSignature: boolean;
  errors: string[];
  warnings: string[];
}>
```

**Example:**

```typescript
import { MessageValidator } from '@opchan/core';

const validator = new MessageValidator();

const report = await validator.getValidationReport(message);

if (!report.isValid) {
  console.error('Validation failed:');
  console.error('Missing fields:', report.missingFields);
  console.error('Invalid fields:', report.invalidFields);
  console.error('Errors:', report.errors);
}
```

---

## Type Definitions

### Enums

#### `EVerificationStatus`

User verification levels.

```typescript
enum EVerificationStatus {
  ANONYMOUS = 'anonymous',
  WALLET_UNCONNECTED = 'wallet-unconnected',
  WALLET_CONNECTED = 'wallet-connected',
  ENS_VERIFIED = 'ens-verified',
}
```

---

#### `EDisplayPreference`

User display name preference.

```typescript
enum EDisplayPreference {
  CALL_SIGN = 'call-sign',
  WALLET_ADDRESS = 'wallet-address',
}
```

---

#### `MessageType`

Message types in the protocol.

```typescript
enum MessageType {
  CELL = 'cell',
  POST = 'post',
  COMMENT = 'comment',
  VOTE = 'vote',
  MODERATE = 'moderate',
  USER_PROFILE_UPDATE = 'user_profile_update',
}
```

---

#### `EModerationAction`

Moderation actions.

```typescript
enum EModerationAction {
  MODERATE = 'moderate',
  UNMODERATE = 'unmoderate',
}
```

---

### Core Interfaces

#### `User`

User object representing authenticated or anonymous user.

```typescript
interface User {
  address: string; // 0x${string} for wallet, UUID for anonymous
  ensName?: string;
  ensAvatar?: string;
  callSign?: string;
  displayPreference: EDisplayPreference;
  displayName: string;
  verificationStatus: EVerificationStatus;
  lastChecked?: number;
  browserPubKey?: string;
  delegationSignature?: string;
  delegationExpiry?: number;
}
```

---

#### `Cell`

Extended cell with computed fields.

```typescript
interface Cell extends CellMessage {
  relevanceScore?: number;
  activeMemberCount?: number;
  recentActivity?: number;
  postCount?: number;
  relevanceDetails?: RelevanceScoreDetails;
}
```

---

#### `Post`

Extended post with votes and moderation.

```typescript
interface Post extends PostMessage {
  authorAddress: string;
  upvotes: VoteMessage[];
  downvotes: VoteMessage[];
  moderated?: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  moderationTimestamp?: number;
  relevanceScore?: number;
  verifiedUpvotes?: number;
  verifiedCommenters?: string[];
  relevanceDetails?: RelevanceScoreDetails;
  voteScore?: number;
}
```

---

#### `Comment`

Extended comment with votes and moderation.

```typescript
interface Comment extends CommentMessage {
  authorAddress: string;
  upvotes: VoteMessage[];
  downvotes: VoteMessage[];
  moderated?: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  moderationTimestamp?: number;
  relevanceScore?: number;
  relevanceDetails?: RelevanceScoreDetails;
  voteScore?: number;
}
```

---

#### `Bookmark`

Bookmark data structure.

```typescript
interface Bookmark {
  id: string; // `${type}:${targetId}`
  type: BookmarkType;
  targetId: string;
  userId: string;
  createdAt: number;
  title?: string;
  author?: string;
  cellId?: string;
  postId?: string;
}
```

---

### Message Types

#### `OpchanMessage`

Union type of all signed message types.

```typescript
type OpchanMessage = (
  | CellMessage
  | PostMessage
  | CommentMessage
  | VoteMessage
  | ModerateMessage
  | UserProfileUpdateMessage
) & SignedMessage;
```

---

#### `SignedMessage`

Signature fields present on all messages.

```typescript
interface SignedMessage {
  signature: string; // Ed25519 signature
  browserPubKey: string; // Browser public key
  delegationProof?: DelegationProof; // Optional for anonymous
}
```

---

#### `DelegationProof`

Proof that browser key was authorized by wallet.

```typescript
interface DelegationProof {
  authMessage: string; // Message signed by wallet
  walletSignature: string; // Wallet's signature
  expiryTimestamp: number; // When delegation expires
  walletAddress: string; // Wallet that signed
}
```

---

## Utility Functions

### `transformPost(postMessage)`

Transform raw post message to enhanced Post type.

**Signature:**

```typescript
async transformPost(postMessage: PostMessage): Promise<Post | null>
```

---

### `transformComment(commentMessage)`

Transform raw comment message to enhanced Comment type.

**Signature:**

```typescript
async transformComment(commentMessage: CommentMessage): Promise<Comment | null>
```

---

### `transformCell(cellMessage)`

Transform raw cell message to enhanced Cell type.

**Signature:**

```typescript
async transformCell(cellMessage: CellMessage): Promise<Cell | null>
```

**Example:**

```typescript
import { transformPost, transformComment, transformCell } from '@opchan/core';

// Transform messages
const post = await transformPost(postMessage);
const comment = await transformComment(commentMessage);
const cell = await transformCell(cellMessage);

// Use enhanced types
if (post) {
  console.log('Upvotes:', post.upvotes.length);
  console.log('Downvotes:', post.downvotes.length);
  console.log('Vote score:', post.voteScore);
  console.log('Relevance:', post.relevanceScore);
}
```

---

## Complete Type Reference

For complete TypeScript type definitions, see:

- `packages/core/src/types/forum.ts` - Forum-specific types
- `packages/core/src/types/identity.ts` - Identity and user types
- `packages/core/src/types/waku.ts` - Message and network types
- `packages/core/src/lib/delegation/types.ts` - Delegation types

---

**End of API Reference**

