## OpChan Core SDK (packages/core) — Building Decentralized Forums

This guide shows how to build a decentralized forum application using the Core SDK directly (without React). It covers project setup, client initialization, key delegation, network connectivity, content management, identity resolution, and persistence.

The examples assume you install and use the `@opchan/core` package.

---

### 1) Install and basic setup

```bash
npm i @opchan/core
```

Create a client instance and open the database:

```typescript
import { OpChanClient } from '@opchan/core';

const client = new OpChanClient({
  wakuConfig: {
    contentTopic: '/opchan/1/messages/proto',
    reliableChannelId: 'opchan-messages'
  },
  reownProjectId: 'your-reown-project-id' // Optional
});

// IMPORTANT: Open database before use
await client.database.open();
```

---

### 2) Message synchronization

Set up listeners for incoming messages and network health:

```typescript
// Listen for all incoming messages
const unsubscribeMessages = client.messageManager.onMessageReceived(
  async (message) => {
    // Apply to local database
    const wasNew = await client.database.applyMessage(message);
    if (wasNew) {
      console.log('New message received:', message.type);
      updateUI();
    }
  }
);

// Monitor network health
const unsubscribeHealth = client.messageManager.onHealthChange(
  (isHealthy) => {
    console.log('Network status:', isHealthy ? 'Connected' : 'Disconnected');
    updateNetworkIndicator(isHealthy);
  }
);

// Monitor sync status
const unsubscribeSync = client.messageManager.onSyncStatus(
  (status) => {
    console.log('Sync status:', status);
  }
);

// Clean up when done
function cleanup() {
  unsubscribeMessages();
  unsubscribeHealth();
  unsubscribeSync();
}
```

---

### 3) Key delegation — wallet users

For wallet-connected users, create a delegation to reduce signature prompts:

```typescript
import { signMessage } from 'viem/accounts';

async function setupWalletDelegation(walletAddress: `0x${string}`) {
  // Create delegation for 7 or 30 days
  const success = await client.delegation.delegate(
    walletAddress,
    '7days', // or '30days'
    async (message: string) => {
      // Sign with wallet
      return await signMessage({
        message,
        account: walletAddress
      });
    }
  );

  if (success) {
    console.log('Delegation created successfully');
    
    // Check delegation status
    const status = await client.delegation.getStatus(walletAddress);
    console.log('Delegation valid:', status.isValid);
    console.log('Time remaining:', status.timeRemaining);
    console.log('Expires at:', new Date(Date.now() + status.timeRemaining!));
  }
}
```

---

### 4) Key delegation — anonymous users

For anonymous users (no wallet), create an anonymous delegation:

```typescript
async function setupAnonymousSession() {
  // Create anonymous delegation (returns session ID)
  const sessionId = await client.delegation.delegateAnonymous('7days');
  
  console.log('Anonymous session ID:', sessionId);
  
  // Create user object
  const anonymousUser = {
    address: sessionId,
    displayName: 'Anonymous',
    displayPreference: EDisplayPreference.WALLET_ADDRESS,
    verificationStatus: EVerificationStatus.ANONYMOUS
  };
  
  // Store user in database
  await client.database.storeUser(anonymousUser);
  
  return anonymousUser;
}
```

---

### 5) Creating content — cells

Create a cell (requires ENS-verified wallet):

```typescript
async function createCell(
  currentUser: User,
  name: string,
  description: string,
  icon?: string
) {
  const result = await client.forumActions.createCell(
    {
      name,
      description,
      icon,
      currentUser,
      isAuthenticated: true
    },
    () => {
      // Callback when cache is updated
      updateUI();
    }
  );

  if (result.success) {
    console.log('Cell created:', result.data);
    return result.data;
  } else {
    console.error('Failed to create cell:', result.error);
    return null;
  }
}
```

---

### 6) Creating content — posts

Create a post in a cell:

```typescript
async function createPost(
  currentUser: User,
  cellId: string,
  title: string,
  content: string
) {
  const result = await client.forumActions.createPost(
    {
      cellId,
      title,
      content,
      currentUser,
      isAuthenticated: true
    },
    () => updateUI()
  );

  if (result.success) {
    console.log('Post created:', result.data);
    
    // Mark as pending until network confirms
    client.database.markPending(result.data!.id);
    
    return result.data;
  } else {
    console.error('Failed to create post:', result.error);
    return null;
  }
}
```

---

### 7) Creating content — comments

Add a comment to a post:

```typescript
async function createComment(
  currentUser: User,
  postId: string,
  content: string
) {
  const result = await client.forumActions.createComment(
    {
      postId,
      content,
      currentUser,
      isAuthenticated: true
    },
    () => updateUI()
  );

  if (result.success) {
    console.log('Comment created:', result.data);
    client.database.markPending(result.data!.id);
    return result.data;
  } else {
    console.error('Failed to create comment:', result.error);
    return null;
  }
}
```

---

### 8) Voting

Vote on posts or comments:

```typescript
async function voteOnContent(
  currentUser: User,
  targetId: string,
  isUpvote: boolean
) {
  const result = await client.forumActions.vote(
    {
      targetId,
      isUpvote,
      currentUser,
      isAuthenticated: true
    },
    () => updateUI()
  );

  if (result.success) {
    console.log('Vote registered:', isUpvote ? 'upvote' : 'downvote');
  } else {
    console.error('Failed to vote:', result.error);
  }
}
```

---

### 9) Moderation (cell owner only)

Moderate posts, comments, or users within a cell:

```typescript
async function moderatePost(
  currentUser: User,
  cellId: string,
  postId: string,
  reason: string
) {
  const cell = client.database.cache.cells[cellId];
  
  if (!cell || currentUser.address !== cell.author) {
    console.error('Not authorized: Only cell owner can moderate');
    return;
  }

  const result = await client.forumActions.moderatePost(
    {
      cellId,
      postId,
      reason,
      currentUser,
      isAuthenticated: true,
      cellOwner: cell.author
    },
    () => updateUI()
  );

  if (result.success) {
    console.log('Post moderated');
  }
}

async function unmoderatePost(
  currentUser: User,
  cellId: string,
  postId: string
) {
  const cell = client.database.cache.cells[cellId];
  
  const result = await client.forumActions.unmoderatePost(
    {
      cellId,
      postId,
      currentUser,
      isAuthenticated: true,
      cellOwner: cell.author
    },
    () => updateUI()
  );

  if (result.success) {
    console.log('Post unmoderated');
  }
}

// Similar methods exist for comments and users:
// - client.forumActions.moderateComment()
// - client.forumActions.unmoderateComment()
// - client.forumActions.moderateUser()
// - client.forumActions.unmoderateUser()
```

---

### 10) Reading cached data

Access cached content from the in-memory database:

```typescript
// Get all cells
const cells = Object.values(client.database.cache.cells);
console.log('Cells:', cells.length);

// Get all posts
const posts = Object.values(client.database.cache.posts);

// Filter posts by cell
const cellPosts = posts.filter(p => p.cellId === 'specific-cell-id');

// Get all comments
const comments = Object.values(client.database.cache.comments);

// Filter comments by post
const postComments = comments.filter(c => c.postId === 'specific-post-id');

// Get votes
const votes = Object.values(client.database.cache.votes);

// Get votes for specific content
const postVotes = votes.filter(v => v.targetId === 'post-id');
const upvotes = postVotes.filter(v => v.value === 1);
const downvotes = postVotes.filter(v => v.value === -1);

// Get moderations
const moderations = Object.values(client.database.cache.moderations);

// Check if post is moderated
const postModeration = moderations.find(
  m => m.targetType === 'post' && m.targetId === 'post-id'
);
const isModerated = postModeration?.action === 'moderate';
```

---

### 11) Identity resolution

Resolve user identities (ENS names, call signs, etc.):

```typescript
// Get identity for a wallet address
const identity = await client.userIdentityService.getIdentity(
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
);

if (identity) {
  console.log('Display name:', identity.displayName);
  console.log('ENS name:', identity.ensName);
  console.log('ENS avatar:', identity.ensAvatar);
  console.log('Call sign:', identity.callSign);
  console.log('Verification:', identity.verificationStatus);
}

// Force fresh resolution (bypass cache)
const freshIdentity = await client.userIdentityService.getIdentity(
  address,
  { fresh: true }
);

// Get display name only
const displayName = client.userIdentityService.getDisplayName({
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  ensName: 'alice.eth',
  displayPreference: EDisplayPreference.CALL_SIGN
});
```

---

### 12) User profiles

Update user profiles (call sign and display preference):

```typescript
async function updateUserProfile(
  userAddress: string,
  callSign?: string,
  displayPreference?: EDisplayPreference
) {
  const result = await client.userIdentityService.updateProfile(
    userAddress,
    {
      callSign,
      displayPreference
    }
  );

  if (result.ok) {
    console.log('Profile updated:', result.identity);
    return result.identity;
  } else {
    console.error('Failed to update profile:', result.error);
    return null;
  }
}

// Example: Set call sign
await updateUserProfile(
  userAddress,
  'alice',
  EDisplayPreference.CALL_SIGN
);
```

---

### 13) Subscribe to identity changes

React to identity updates in real-time:

```typescript
const unsubscribe = client.userIdentityService.subscribe(
  (address, identity) => {
    console.log('Identity updated:', address);
    
    if (identity) {
      console.log('New display name:', identity.displayName);
      console.log('New call sign:', identity.callSign);
      
      // Update UI
      updateUserDisplay(address, identity);
    }
  }
);

// Clean up
unsubscribe();
```

---

### 14) Relevance scoring

Calculate relevance scores for posts:

```typescript
import { transformPost } from '@opchan/core';

// Transform raw post message to enhanced post
const post = await transformPost(postMessage);

// Get votes and comments for scoring
const postVotes = Object.values(client.database.cache.votes)
  .filter(v => v.targetId === post.id);
const postComments = Object.values(client.database.cache.comments)
  .filter(c => c.postId === post.id);

// Get user verification status
const userVerificationStatus = {};
for (const [address, identity] of Object.entries(
  client.database.cache.userIdentities
)) {
  userVerificationStatus[address] = {
    isVerified: identity.verificationStatus === 'ens-verified',
    hasENS: !!identity.ensName,
    ensName: identity.ensName
  };
}

// Calculate score
const scoreDetails = client.relevance.calculatePostScore(
  postMessage,
  postVotes,
  postComments,
  userVerificationStatus,
  client.database.cache.moderations
);

console.log('Relevance score:', scoreDetails.finalScore);
console.log('Score breakdown:', {
  base: scoreDetails.baseScore,
  engagement: scoreDetails.engagementScore,
  authorBonus: scoreDetails.authorVerificationBonus,
  upvoteBonus: scoreDetails.verifiedUpvoteBonus,
  commenterBonus: scoreDetails.verifiedCommenterBonus,
  timeDecay: scoreDetails.timeDecayMultiplier,
  moderation: scoreDetails.moderationPenalty
});
```

---

### 15) Bookmarks

Manage user bookmarks:

```typescript
import { BookmarkService } from '@opchan/core';

const bookmarkService = new BookmarkService();

// Add post bookmark
await bookmarkService.addPostBookmark(post, userId, cellId);

// Add comment bookmark
await bookmarkService.addCommentBookmark(comment, userId, postId);

// Get all user bookmarks
const bookmarks = await client.database.getUserBookmarks(userId);
console.log('Total bookmarks:', bookmarks.length);

// Get bookmarks by type
const postBookmarks = bookmarks.filter(b => b.type === 'post');
const commentBookmarks = bookmarks.filter(b => b.type === 'comment');

// Check if content is bookmarked
const isBookmarked = client.database.isBookmarked(userId, 'post', postId);

// Remove bookmark
if (isBookmarked) {
  const bookmarkId = `post:${postId}`;
  await bookmarkService.removeBookmark(bookmarkId);
}

// Clear all bookmarks
const allBookmarks = await client.database.getUserBookmarks(userId);
for (const bookmark of allBookmarks) {
  await bookmarkService.removeBookmark(bookmark.id);
}
```

---

### 16) Pending state management

Track pending operations for optimistic UI:

```typescript
// Mark content as pending
client.database.markPending(postId);

// Check if pending
const isPending = client.database.isPending(postId);
if (isPending) {
  showSyncingIndicator(postId);
}

// Listen for pending changes
const unsubscribe = client.database.onPendingChange(() => {
  // Update UI when pending state changes
  updateAllPendingIndicators();
});

// Clear pending when confirmed
client.database.clearPending(postId);
```

---

### 17) Persistence and hydration

Load persisted data on app start:

```typescript
async function initializeApp() {
  // Open database (hydrates from IndexedDB)
  await client.database.open();
  
  // Load stored user
  const storedUser = await client.database.loadUser();
  if (storedUser) {
    console.log('Restored user session:', storedUser.displayName);
    
    // Check if delegation is still valid
    const delegationStatus = await client.delegation.getStatus(
      storedUser.address
    );
    
    if (!delegationStatus.isValid) {
      console.log('Delegation expired, need to re-authorize');
      await client.database.clearUser();
      await client.database.clearDelegation();
    }
  }
  
  // Content is already hydrated from IndexedDB
  console.log('Loaded from cache:', {
    cells: Object.keys(client.database.cache.cells).length,
    posts: Object.keys(client.database.cache.posts).length,
    comments: Object.keys(client.database.cache.comments).length,
    votes: Object.keys(client.database.cache.votes).length
  });
}
```

---

### 18) Message validation

Validate messages before processing:

```typescript
import { MessageValidator } from '@opchan/core';

const validator = new MessageValidator();

// Validate a message
const isValid = await validator.isValidMessage(message);

if (!isValid) {
  // Get detailed validation report
  const report = await validator.getValidationReport(message);
  
  console.error('Invalid message:', {
    missingFields: report.missingFields,
    invalidFields: report.invalidFields,
    hasValidSignature: report.hasValidSignature,
    errors: report.errors,
    warnings: report.warnings
  });
}
```

---

### 19) Network state management

Monitor and manage network connectivity:

```typescript
// Get current network status
const isReady = client.messageManager.isReady;
const health = client.messageManager.currentHealth;

console.log('Network ready:', isReady);
console.log('Network health:', health);

// Get sync state
const syncState = client.database.getSyncState();
console.log('Last sync:', new Date(syncState.lastSync || 0));
console.log('Is syncing:', syncState.isSyncing);

// Listen for health changes
client.messageManager.onHealthChange((isHealthy) => {
  if (isHealthy) {
    console.log('Network connected - messages will sync');
  } else {
    console.log('Network disconnected - working offline');
  }
});
```

---

### 20) Complete application skeleton

```typescript
import {
  OpChanClient,
  EVerificationStatus,
  EDisplayPreference,
  transformPost,
  transformComment,
  type User
} from '@opchan/core';

class ForumApp {
  private client: OpChanClient;
  private currentUser: User | null = null;
  private unsubscribers: (() => void)[] = [];

  async initialize() {
    // 1. Create client
    this.client = new OpChanClient({
      wakuConfig: {
        contentTopic: '/opchan/1/messages/proto',
        reliableChannelId: 'opchan-messages'
      }
    });

    // 2. Open database (hydrates from IndexedDB)
    await this.client.database.open();

    // 3. Try to restore user session
    this.currentUser = await this.client.database.loadUser();
    
    // 4. If no session, start anonymous
    if (!this.currentUser) {
      await this.startAnonymousSession();
    }

    // 5. Set up listeners
    this.setupListeners();

    // 6. Initial render
    this.render();
  }

  private async startAnonymousSession() {
    const sessionId = await this.client.delegation.delegateAnonymous('7days');
    this.currentUser = {
      address: sessionId,
      displayName: 'Anonymous',
      displayPreference: EDisplayPreference.WALLET_ADDRESS,
      verificationStatus: EVerificationStatus.ANONYMOUS
    };
    await this.client.database.storeUser(this.currentUser);
  }

  private setupListeners() {
    // Message listener
    const unsubMsg = this.client.messageManager.onMessageReceived(
      async (message) => {
        await this.client.database.applyMessage(message);
        this.render();
      }
    );
    this.unsubscribers.push(unsubMsg);

    // Health listener
    const unsubHealth = this.client.messageManager.onHealthChange(
      (isHealthy) => {
        console.log('Network:', isHealthy ? 'Connected' : 'Disconnected');
        this.updateNetworkStatus(isHealthy);
      }
    );
    this.unsubscribers.push(unsubHealth);

    // Identity listener
    const unsubIdentity = this.client.userIdentityService.subscribe(
      (address, identity) => {
        console.log('Identity updated:', address, identity);
        this.render();
      }
    );
    this.unsubscribers.push(unsubIdentity);

    // Pending listener
    const unsubPending = this.client.database.onPendingChange(() => {
      this.updatePendingIndicators();
    });
    this.unsubscribers.push(unsubPending);
  }

  async createPost(cellId: string, title: string, content: string) {
    if (!this.currentUser) return;

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
      this.client.database.markPending(result.data!.id);
    } else {
      console.error('Failed:', result.error);
    }
  }

  async vote(targetId: string, isUpvote: boolean) {
    if (!this.currentUser) return;

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
    // Get data from cache
    const cells = Object.values(this.client.database.cache.cells);
    const posts = Object.values(this.client.database.cache.posts);
    const comments = Object.values(this.client.database.cache.comments);

    // Transform and sort by relevance
    Promise.all(posts.map(p => transformPost(p))).then(transformedPosts => {
      const sorted = transformedPosts
        .filter(p => p !== null)
        .sort((a, b) => (b!.relevanceScore || 0) - (a!.relevanceScore || 0));

      // Update DOM
      this.renderCells(cells);
      this.renderPosts(sorted);
      this.renderComments(comments);
    });
  }

  private renderCells(cells: any[]) {
    console.log('Rendering', cells.length, 'cells');
    // Update DOM here...
  }

  private renderPosts(posts: any[]) {
    console.log('Rendering', posts.length, 'posts');
    // Update DOM here...
  }

  private renderComments(comments: any[]) {
    console.log('Rendering', comments.length, 'comments');
    // Update DOM here...
  }

  private updateNetworkStatus(isHealthy: boolean) {
    // Update network indicator in UI
    const indicator = document.getElementById('network-status');
    if (indicator) {
      indicator.textContent = isHealthy ? '🟢 Connected' : '🔴 Offline';
    }
  }

  private updatePendingIndicators() {
    // Update all pending indicators
    document.querySelectorAll('[data-pending]').forEach(el => {
      const id = el.getAttribute('data-id');
      if (id && this.client.database.isPending(id)) {
        el.classList.add('syncing');
      } else {
        el.classList.remove('syncing');
      }
    });
  }

  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
  }
}

// Initialize app
const app = new ForumApp();
app.initialize().then(() => {
  console.log('App initialized');
});
```

---

### 21) Best practices

- **Always open database**: Call `client.database.open()` before using the client
- **Set up message listener**: Subscribe to `onMessageReceived` early to stay synchronized
- **Monitor network health**: Use `onHealthChange` to show connection status
- **Use optimistic UI**: Mark items as pending during network operations
- **Cache identity lookups**: `UserIdentityService` automatically caches ENS resolution
- **Transform messages**: Use `transformPost/transformComment/transformCell` for enhanced data
- **Validate before storage**: `LocalDatabase.applyMessage` validates all messages
- **Handle delegation expiry**: Check `delegation.getStatus()` and re-authorize when needed
- **Persist user session**: Use `database.storeUser/loadUser` for session continuity
- **Clean up listeners**: Call unsubscribe functions when components unmount

---

### 22) Error handling

```typescript
// Wrap operations in try-catch
try {
  const result = await client.forumActions.createPost(params, callback);
  
  if (!result.success) {
    // Handle business logic errors
    showError(result.error);
  }
} catch (error) {
  // Handle unexpected errors
  console.error('Unexpected error:', error);
  showError('An unexpected error occurred');
}

// Check delegation before operations
const status = await client.delegation.getStatus(currentUser.address);
if (!status.isValid) {
  showError('Delegation expired. Please re-authorize.');
  await reauthorizeUser();
}

// Handle network errors
client.messageManager.onHealthChange((isHealthy) => {
  if (!isHealthy) {
    showWarning('Network disconnected. Working offline.');
  }
});
```

---

### 23) Notes

- The core package is framework-agnostic - use with React, Vue, Svelte, or vanilla JS
- All content is stored locally and synchronized via Waku network
- Delegation lasts 7 or 30 days - users need to re-authorize after expiry
- Anonymous users can post/comment/vote but cannot create cells
- Cell creation requires ENS-verified wallet
- Moderation is cell-owner only
- All messages are cryptographically signed and verified
- IndexedDB persists data across sessions

---

**See the React package for a higher-level React integration layer built on top of this core SDK.**

