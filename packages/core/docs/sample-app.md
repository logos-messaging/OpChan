# @opchan/core Sample Application

Complete, production-ready forum application demonstrating all features of the OpChan Core SDK.

---

## Complete Forum Application

A full-featured, production-ready decentralized forum demonstrating all features of the OpChan Core SDK including authentication, content management, moderation, identity resolution, bookmarks, and real-time updates.

### Features Demonstrated

- ✅ **Client Initialization** - Setup and configuration
- ✅ **Anonymous & Wallet Authentication** - Dual authentication modes
- ✅ **Session Persistence** - Restore sessions across page loads
- ✅ **Content Creation** - Posts, comments, and cells
- ✅ **Voting System** - Upvote/downvote functionality
- ✅ **Identity Resolution** - ENS lookup and call signs
- ✅ **Real-Time Updates** - Live message synchronization
- ✅ **Relevance Scoring** - Content ranking algorithm
- ✅ **Moderation** - Cell owner moderation tools
- ✅ **Bookmarks** - Save and manage favorite content
- ✅ **Network Monitoring** - Connection health tracking
- ✅ **Pending States** - Optimistic UI with sync indicators

### Application Structure

```typescript
import {
  OpChanClient,
  EVerificationStatus,
  EDisplayPreference,
  BookmarkService,
  transformPost,
  type User,
  type Post,
  type Comment,
  type Cell
} from '@opchan/core';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { signMessage } from 'viem/accounts';

class CompleteForum {
  // Core components
  private client: OpChanClient;
  private bookmarkService: BookmarkService;
  private currentUser: User | null = null;
  
  // Event handlers
  private unsubscribers: (() => void)[] = [];

  constructor() {
    this.client = new OpChanClient({
      wakuConfig: {
        contentTopic: '/opchan/1/messages/proto',
        reliableChannelId: 'opchan-messages'
      },
      reownProjectId: process.env.REOWN_PROJECT_ID
    });
    
    this.bookmarkService = new BookmarkService();
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async initialize() {
    console.log('🚀 Initializing OpChan Forum...\n');

    // 1. Open database (hydrates from IndexedDB)
    await this.client.database.open();
    console.log('✅ Database opened');

    // 2. Set up ENS resolution
    const publicClient = createPublicClient({
      chain: mainnet,
      transport: http()
    });
    this.client.userIdentityService.setPublicClient(publicClient);
    console.log('✅ ENS resolution configured');

    // 3. Set up event listeners
    this.setupListeners();
    console.log('✅ Event listeners configured');

    // 4. Restore or create session
    await this.restoreSession();

    // 5. Initial render
    await this.render();

    console.log('\n✅ Forum initialized successfully!\n');
  }

  private setupListeners() {
    // Message listener - handles all incoming messages
    const msgUnsub = this.client.messageManager.onMessageReceived(
      async (message) => {
        const wasNew = await this.client.database.applyMessage(message);
        if (wasNew) {
          console.log(`📨 New ${message.type} received`);
          await this.render();
        }
      }
    );
    this.unsubscribers.push(msgUnsub);

    // Network health listener
    const healthUnsub = this.client.messageManager.onHealthChange(
      (isHealthy) => {
        console.log(isHealthy ? '🟢 Network: Connected' : '🔴 Network: Offline');
      }
    );
    this.unsubscribers.push(healthUnsub);

    // Identity updates listener
    const identityUnsub = this.client.userIdentityService.subscribe(
      (address, identity) => {
        if (identity) {
          console.log(`👤 Identity updated: ${identity.displayName}`);
        }
      }
    );
    this.unsubscribers.push(identityUnsub);

    // Pending state listener
    const pendingUnsub = this.client.database.onPendingChange(() => {
      this.updatePendingIndicators();
    });
    this.unsubscribers.push(pendingUnsub);
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  private async restoreSession() {
    // Try to load stored user
    const storedUser = await this.client.database.loadUser();
    
    if (storedUser) {
      // Validate delegation
      const status = await this.client.delegation.getStatus(storedUser.address);
      
      if (status.isValid) {
        this.currentUser = storedUser;
        console.log(`👤 Restored session: ${storedUser.displayName}`);
      } else {
        console.log('⚠️  Delegation expired, starting new session');
        await this.startAnonymousSession();
      }
    } else {
      await this.startAnonymousSession();
    }
  }

  async startAnonymousSession() {
    const sessionId = await this.client.delegation.delegateAnonymous('7days');
    
    this.currentUser = {
      address: sessionId,
      displayName: 'Anonymous',
      displayPreference: EDisplayPreference.WALLET_ADDRESS,
      verificationStatus: EVerificationStatus.ANONYMOUS
    };

    await this.client.database.storeUser(this.currentUser);
    console.log('👤 Started anonymous session');
  }

  async connectWallet(walletAddress: `0x${string}`) {
    console.log('\n🔐 Connecting wallet...');

    // Create delegation
    const success = await this.client.delegation.delegate(
      walletAddress,
      '7days',
      async (message) => {
        // Sign with wallet (this would use your wallet provider)
        console.log('📝 Please sign the authorization message...');
        return await signMessage({ message, account: walletAddress });
      }
    );

    if (!success) {
      console.error('❌ Failed to create delegation');
      return;
    }

    // Get identity
    const identity = await this.client.userIdentityService.getIdentity(
      walletAddress,
      { fresh: true }
    );

    if (!identity) {
      console.error('❌ Failed to resolve identity');
      return;
    }

    this.currentUser = {
      address: walletAddress,
      displayName: identity.displayName,
      displayPreference: identity.displayPreference,
      verificationStatus: identity.verificationStatus,
      ensName: identity.ensName,
      ensAvatar: identity.ensAvatar,
      callSign: identity.callSign
    };

    await this.client.database.storeUser(this.currentUser);
    console.log(`✅ Wallet connected: ${identity.displayName}`);
    console.log(`   Verification: ${identity.verificationStatus}\n`);
  }

  async disconnect() {
    await this.client.delegation.clear();
    await this.client.database.clearUser();
    this.currentUser = null;
    console.log('👋 Disconnected');
  }

  async setCallSign(callSign: string) {
    if (!this.currentUser) return;

    const result = await this.client.userIdentityService.updateProfile(
      this.currentUser.address,
      {
        callSign,
        displayPreference: EDisplayPreference.CALL_SIGN
      }
    );

    if (result.ok) {
      this.currentUser.callSign = callSign;
      this.currentUser.displayName = callSign;
      this.currentUser.displayPreference = EDisplayPreference.CALL_SIGN;
      await this.client.database.storeUser(this.currentUser);
      console.log(`✅ Call sign set: ${callSign}`);
    } else {
      console.error('❌ Failed to set call sign:', result.error);
    }
  }

  // ============================================================================
  // CONTENT CREATION
  // ============================================================================

  async createCell(name: string, description: string, icon?: string) {
    if (!this.currentUser) {
      console.error('❌ Not authenticated');
      return null;
    }

    const result = await this.client.forumActions.createCell(
      {
        name,
        description,
        icon,
        currentUser: this.currentUser,
        isAuthenticated: true
      },
      () => this.render()
    );

    if (result.success) {
      console.log(`✅ Cell created: ${name}`);
      this.client.database.markPending(result.data!.id);
      return result.data;
    } else {
      console.error(`❌ Failed to create cell: ${result.error}`);
      return null;
    }
  }

  async createPost(cellId: string, title: string, content: string) {
    if (!this.currentUser) {
      console.error('❌ Not authenticated');
      return null;
    }

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
      console.log(`✅ Post created: ${title}`);
      this.client.database.markPending(result.data!.id);
      return result.data;
    } else {
      console.error(`❌ Failed to create post: ${result.error}`);
      return null;
    }
  }

  async createComment(postId: string, content: string) {
    if (!this.currentUser) {
      console.error('❌ Not authenticated');
      return null;
    }

    const result = await this.client.forumActions.createComment(
      {
        postId,
        content,
        currentUser: this.currentUser,
        isAuthenticated: true
      },
      () => this.render()
    );

    if (result.success) {
      console.log('✅ Comment created');
      this.client.database.markPending(result.data!.id);
      return result.data;
    } else {
      console.error(`❌ Failed to create comment: ${result.error}`);
      return null;
    }
  }

  // ============================================================================
  // VOTING
  // ============================================================================

  async vote(targetId: string, isUpvote: boolean) {
    if (!this.currentUser) {
      console.error('❌ Not authenticated');
      return;
    }

    const result = await this.client.forumActions.vote(
      {
        targetId,
        isUpvote,
        currentUser: this.currentUser,
        isAuthenticated: true
      },
      () => this.render()
    );

    if (result.success) {
      console.log(`✅ ${isUpvote ? 'Upvoted' : 'Downvoted'}`);
    } else {
      console.error(`❌ Failed to vote: ${result.error}`);
    }
  }

  // ============================================================================
  // MODERATION
  // ============================================================================

  canModerate(cellId: string): boolean {
    if (!this.currentUser) return false;
    const cell = this.client.database.cache.cells[cellId];
    return cell?.author === this.currentUser.address;
  }

  async moderatePost(cellId: string, postId: string, reason: string) {
    if (!this.currentUser || !this.canModerate(cellId)) {
      console.error('❌ Not authorized to moderate');
      return;
    }

    const cell = this.client.database.cache.cells[cellId];
    const result = await this.client.forumActions.moderatePost(
      {
        cellId,
        postId,
        reason,
        currentUser: this.currentUser,
        isAuthenticated: true,
        cellOwner: cell.author
      },
      () => this.render()
    );

    if (result.success) {
      console.log('✅ Post moderated');
    } else {
      console.error(`❌ Failed to moderate: ${result.error}`);
    }
  }

  async unmoderatePost(cellId: string, postId: string) {
    if (!this.currentUser || !this.canModerate(cellId)) {
      console.error('❌ Not authorized');
      return;
    }

    const cell = this.client.database.cache.cells[cellId];
    const result = await this.client.forumActions.unmoderatePost(
      {
        cellId,
        postId,
        currentUser: this.currentUser,
        isAuthenticated: true,
        cellOwner: cell.author
      },
      () => this.render()
    );

    if (result.success) {
      console.log('✅ Post unmoderated');
    } else {
      console.error(`❌ Failed to unmoderate: ${result.error}`);
    }
  }

  // ============================================================================
  // BOOKMARKS
  // ============================================================================

  async bookmarkPost(postId: string) {
    if (!this.currentUser) return;

    const post = this.client.database.cache.posts[postId];
    if (!post) {
      console.error('❌ Post not found');
      return;
    }

    await this.bookmarkService.addPostBookmark(
      post,
      this.currentUser.address,
      post.cellId
    );
    console.log(`✅ Bookmarked: ${post.title}`);
  }

  async removeBookmark(bookmarkId: string) {
    await this.bookmarkService.removeBookmark(bookmarkId);
    console.log('✅ Bookmark removed');
  }

  isBookmarked(type: 'post' | 'comment', targetId: string): boolean {
    if (!this.currentUser) return false;
    return this.client.database.isBookmarked(
      this.currentUser.address,
      type,
      targetId
    );
  }

  // ============================================================================
  // DATA ACCESS
  // ============================================================================

  async getSortedPosts(cellId?: string): Promise<Post[]> {
    let posts = Object.values(this.client.database.cache.posts);

    if (cellId) {
      posts = posts.filter(p => p.cellId === cellId);
    }

    // Transform and score posts
    const transformedPosts = await Promise.all(
      posts.map(async p => {
        const transformed = await transformPost(p);
        if (!transformed) return null;

        // Calculate relevance
        const votes = Object.values(this.client.database.cache.votes)
          .filter(v => v.targetId === p.id);
        const comments = Object.values(this.client.database.cache.comments)
          .filter(c => c.postId === p.id);

        const userVerificationStatus = {};
        for (const [addr, identity] of Object.entries(
          this.client.database.cache.userIdentities
        )) {
          userVerificationStatus[addr] = {
            isVerified: identity.verificationStatus === 'ens-verified',
            hasENS: !!identity.ensName,
            ensName: identity.ensName
          };
        }

        const scoreDetails = this.client.relevance.calculatePostScore(
          p,
          votes,
          comments,
          userVerificationStatus,
          this.client.database.cache.moderations
        );

        transformed.relevanceScore = scoreDetails.finalScore;
        transformed.relevanceDetails = scoreDetails;

        return transformed;
      })
    );

    return transformedPosts
      .filter((p): p is Post => p !== null)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  getCells(): Cell[] {
    return Object.values(this.client.database.cache.cells);
  }

  getComments(postId: string): Comment[] {
    return Object.values(this.client.database.cache.comments)
      .filter(c => c.postId === postId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getMyBookmarks() {
    if (!this.currentUser) return [];
    return await this.client.database.getUserBookmarks(this.currentUser.address);
  }

  // ============================================================================
  // UI RENDERING
  // ============================================================================

  private async render() {
    console.clear();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    OPCHAN FORUM                           ');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Network status
    const isHealthy = this.client.messageManager.isReady;
    console.log(`Network: ${isHealthy ? '🟢 Connected' : '🔴 Offline'}`);

    // User status
    if (this.currentUser) {
      console.log(`User: ${this.currentUser.displayName} (${this.currentUser.verificationStatus})`);
    } else {
      console.log('User: Not authenticated');
    }

    console.log('\n───────────────────────────────────────────────────────────\n');

    // Cells
    const cells = this.getCells();
    console.log(`📁 CELLS (${cells.length})\n`);
    cells.forEach(cell => {
      const posts = Object.values(this.client.database.cache.posts)
        .filter(p => p.cellId === cell.id);
      console.log(`   ${cell.icon || '📁'} ${cell.name} (${posts.length} posts)`);
      console.log(`      ${cell.description}`);
      if (this.canModerate(cell.id)) {
        console.log(`      👮 You can moderate this cell`);
      }
      console.log();
    });

    // Posts (top 10 by relevance)
    const posts = await this.getSortedPosts();
    console.log(`\n📝 TOP POSTS (${posts.length} total)\n`);
    
    posts.slice(0, 10).forEach((post, index) => {
      const isPending = this.client.database.isPending(post.id);
      const score = post.relevanceScore?.toFixed(0) || '0';
      const upvotes = post.upvotes?.length || 0;
      const downvotes = post.downvotes?.length || 0;
      const comments = this.getComments(post.id).length;
      const isBookmarked = this.isBookmarked('post', post.id);

      console.log(`${index + 1}. [Score: ${score}] ${post.title}${isPending ? ' ⏳' : ''}`);
      console.log(`   by ${post.author.slice(0, 8)}... | Cell: ${post.cellId}`);
      console.log(`   ⬆️  ${upvotes} ⬇️  ${downvotes} 💬 ${comments}${isBookmarked ? ' 🔖' : ''}`);
      
      if (post.relevanceDetails) {
        const details = post.relevanceDetails;
        console.log(`   📊 Base: ${details.baseScore} + Engagement: ${details.engagementScore.toFixed(0)} × Decay: ${(details.timeDecayMultiplier * 100).toFixed(0)}%`);
      }
      
      console.log(`   ${post.content.slice(0, 80)}${post.content.length > 80 ? '...' : ''}`);
      console.log();
    });

    // Bookmarks
    if (this.currentUser) {
      const bookmarks = await this.getMyBookmarks();
      if (bookmarks.length > 0) {
        console.log(`\n🔖 MY BOOKMARKS (${bookmarks.length})\n`);
        bookmarks.slice(0, 5).forEach(b => {
          console.log(`   ${b.title || b.id}`);
        });
        console.log();
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
  }

  private updatePendingIndicators() {
    // In a real UI, this would update visual indicators
    // For console, we just re-render
    this.render();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    console.log('👋 Forum cleaned up');
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

async function main() {
  const forum = new CompleteForum();
  
  try {
    // Initialize
    await forum.initialize();
    
    // Wait a moment for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Example: Set a call sign for anonymous user
    await forum.setCallSign('alice');
    
    // Example: Create a post
    await forum.createPost(
      'general',
      'Hello OpChan!',
      'This is a comprehensive example of the OpChan forum application.'
    );
    
    // Example: Vote on a post (would need actual post ID)
    // await forum.vote('post-id', true);
    
    // Example: Bookmark a post
    // await forum.bookmarkPost('post-id');
    
    // Keep running and listening for updates
    console.log('\n✅ Forum is running. Press Ctrl+C to exit.\n');
    
    // In a real application, this would be kept alive by your UI framework
    // For this example, we'll just wait
    await new Promise(() => {}); // Wait forever
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    forum.cleanup();
  }
}

// Run the application
main();
```

---

## Key Features Explained

### 1. **Robust Initialization**

The application properly initializes all components in order:
- Opens database and hydrates from IndexedDB
- Configures ENS resolution
- Sets up event listeners
- Restores or creates user session

### 2. **Dual Authentication**

Supports both anonymous and wallet-connected users:
- Anonymous users get a UUID session ID
- Wallet users connect with ENS verification
- Sessions persist across page reloads
- Delegation expiry is checked on restoration

### 3. **Real-Time Synchronization**

All events are properly wired:
- Incoming messages trigger UI updates
- Network health changes are logged
- Identity updates propagate automatically
- Pending states tracked for optimistic UI

### 4. **Complete Content Management**

Full CRUD operations:
- Create cells (ENS-verified users only)
- Create posts and comments (all authenticated users)
- Vote on content
- Moderation tools for cell owners

### 5. **Advanced Features**

Production-ready functionality:
- Relevance scoring with detailed breakdown
- Bookmark management
- Identity resolution with ENS
- Call sign support
- Pending state indicators

### 6. **Proper Error Handling**

All operations include error handling:
- Permission checks before actions
- Validation of delegation status
- User-friendly error messages
- Graceful degradation

### 7. **Clean Architecture**

Well-organized code structure:
- Logical section separation
- Event-driven design
- Proper cleanup on exit
- Reusable methods

---

## Running the Application

### Prerequisites

```bash
npm install @opchan/core viem
```

### Environment Variables

```bash
export REOWN_PROJECT_ID="your-project-id"
```

### Run

```typescript
// Save as forum.ts
// Run with: npx tsx forum.ts
```

### Integration with UI

This application can be easily adapted for:
- **React**: Convert methods to hooks, use state management
- **Vue**: Use reactive refs and computed properties
- **Svelte**: Use stores and reactive statements
- **Web Components**: Create custom elements
- **CLI**: Interactive command-line interface

---

## Extending the Application

### Add Wallet Support

```typescript
import { useWalletClient } from 'wagmi';

async connectWithWagmi() {
  const { data: walletClient } = useWalletClient();
  if (!walletClient) return;
  
  await this.connectWallet(walletClient.account.address);
}
```

### Add Search Functionality

```typescript
searchPosts(query: string): Post[] {
  const posts = Object.values(this.client.database.cache.posts);
  return posts.filter(p => 
    p.title.toLowerCase().includes(query.toLowerCase()) ||
    p.content.toLowerCase().includes(query.toLowerCase())
  );
}
```

### Add Notifications

```typescript
private setupListeners() {
  this.client.messageManager.onMessageReceived(async (message) => {
    const wasNew = await this.client.database.applyMessage(message);
    if (wasNew && message.type === 'comment') {
      this.notify(`New comment on your post!`);
    }
  });
}
```

---

## Production Considerations

### Performance

- Cache is in-memory for fast reads
- IndexedDB persistence for reliability
- Lazy loading of identities
- Debounced identity lookups

### Security

- All messages cryptographically signed
- Delegation proofs verified
- Permission checks enforced
- Wallet signatures required for delegation

### Scalability

- Event-driven architecture
- Efficient data structures
- Minimal re-renders
- Optimistic UI updates

### Reliability

- Session persistence
- Delegation expiry handling
- Network disconnect handling
- Error recovery

---

**This is a production-ready template demonstrating all features of the OpChan Core SDK. Use it as a foundation for building your decentralized forum application.**

