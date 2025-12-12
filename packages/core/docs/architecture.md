# @opchan/core Architecture Guide

Deep dive into the architecture, design patterns, and implementation details of the OpChan Core SDK.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Data Flow](#data-flow)
4. [Key Subsystems](#key-subsystems)
5. [Cryptographic Design](#cryptographic-design)
6. [Storage Strategy](#storage-strategy)
7. [Network Layer](#network-layer)
8. [Design Patterns](#design-patterns)
9. [Performance Considerations](#performance-considerations)
10. [Security Model](#security-model)

---

## System Overview

OpChan Core is a decentralized forum infrastructure built on three pillars:

1. **Cryptographic Identity** - Ed25519 key delegation with wallet authorization
2. **P2P Messaging** - Waku protocol for decentralized communication
3. **Local-First Storage** - IndexedDB with in-memory caching

### Design Philosophy

- **Local-First**: All data persisted locally, network as synchronization mechanism
- **Optimistic UI**: Immediate feedback, eventual consistency
- **Privacy-Preserving**: No centralized servers, peer-to-peer architecture
- **Framework-Agnostic**: Pure TypeScript library, no UI framework dependencies

---

## Core Architecture

```
┌───────────────────────────────────────────────────────────────────┐
│                          OpChanClient                             │
│  Entry point orchestrating all subsystems                         │
└───────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  MessageManager  │  │  LocalDatabase   │  │ DelegationManager│
│                  │  │                  │  │                  │
│ - WakuNode       │  │ - IndexedDB      │  │ - Key Generation │
│ - Reliable       │  │ - In-memory      │  │ - Signing        │
│   Messaging      │  │   Cache          │  │ - Verification   │
│ - Health Monitor │  │ - Validation     │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Service Layer                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ ForumActions │  │   Identity   │  │   Relevance  │           │
│  │              │  │   Service    │  │  Calculator  │           │
│  │ - Create     │  │              │  │              │           │
│  │ - Moderate   │  │ - ENS Lookup │  │ - Scoring    │           │
│  │ - Vote       │  │ - Profiles   │  │ - Time Decay │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### OpChanClient
- **Role**: Facade pattern - single entry point for all operations
- **Responsibilities**:
  - Instantiate and wire all services
  - Configure environment
  - Initialize message manager with Waku config
  - Provide unified API surface

#### MessageManager
- **Role**: Network abstraction layer
- **Responsibilities**:
  - Manage Waku node lifecycle
  - Handle message sending/receiving
  - Monitor network health
  - Implement reliable messaging (retries, acknowledgments)
  - Manage subscriptions to content topics

#### LocalDatabase
- **Role**: Persistence and caching layer
- **Responsibilities**:
  - IndexedDB operations (async)
  - In-memory cache (sync)
  - Message validation
  - Deduplication
  - State management (pending, syncing)

#### DelegationManager
- **Role**: Cryptographic signing system
- **Responsibilities**:
  - Generate Ed25519 keypairs
  - Create wallet-authorized delegations
  - Sign messages with browser keys
  - Verify message signatures
  - Verify delegation proofs

---

## Data Flow

### Outbound Message Flow (Creating Content)

```
1. User Action
   └─> ForumActions.createPost()
       │
       ├─> Validate permissions (wallet or anonymous)
       │
       ├─> Create unsigned message with UUID
       │
       ├─> DelegationManager.signMessage()
       │   ├─> Load cached delegation
       │   ├─> Check expiry
       │   ├─> Sign with browser private key (Ed25519)
       │   └─> Attach signature + browserPubKey + delegationProof
       │
       ├─> LocalDatabase.applyMessage()
       │   ├─> Validate signature
       │   ├─> Check for duplicates
       │   ├─> Store in cache
       │   └─> Persist to IndexedDB
       │
       ├─> LocalDatabase.markPending()
       │
       ├─> Call updateCallback() [UI refresh]
       │
       └─> MessageManager.sendMessage()
           ├─> Encode with protobuf
           ├─> Send via Waku
           └─> Wait for acknowledgment
               └─> LocalDatabase.clearPending()
```

### Inbound Message Flow (Receiving Content)

```
1. Waku Network
   └─> WakuNodeManager receives message
       │
       ├─> Decode protobuf
       │
       ├─> ReliableMessaging handles deduplication
       │
       └─> MessageService.onMessageReceived() callback
           │
           └─> LocalDatabase.applyMessage()
               │
               ├─> MessageValidator.isValidMessage()
               │   ├─> Check required fields
               │   ├─> Verify signature (Ed25519)
               │   ├─> If delegationProof:
               │   │   ├─> Verify auth message format
               │   │   ├─> Verify wallet signature (viem)
               │   │   └─> Check expiry (optional)
               │   └─> If anonymous:
               │       └─> Verify session ID format (UUID)
               │
               ├─> Check duplicate (type:id:timestamp key)
               │
               ├─> Store in appropriate cache collection
               │   ├─> cells[id]
               │   ├─> posts[id]
               │   ├─> comments[id]
               │   ├─> votes[targetId:author]
               │   ├─> moderations[key]
               │   └─> userIdentities[address]
               │
               ├─> Persist to IndexedDB
               │
               ├─> Update lastSync timestamp
               │
               └─> Return true (new message)
```

---

## Key Subsystems

### 1. Delegation Subsystem

**Purpose**: Reduce wallet signature prompts while maintaining cryptographic security.

**Components**:

- **DelegationManager** - Core delegation logic
- **DelegationStorage** - IndexedDB persistence
- **DelegationCrypto** - Ed25519 signing/verification

**Delegation Process (Wallet)**:

```typescript
// 1. Generate browser keypair
const keypair = DelegationCrypto.generateKeypair();
// { publicKey: string, privateKey: string }

// 2. Create authorization message
const authMessage = `
Authorize browser key:
  Public Key: ${keypair.publicKey}
  Wallet: ${walletAddress}
  Expires: ${new Date(expiryTimestamp).toISOString()}
  Nonce: ${nonce}
`;

// 3. Sign with wallet (happens once)
const walletSignature = await signFunction(authMessage);

// 4. Store delegation
const delegation: WalletDelegationInfo = {
  authMessage,
  walletSignature,
  expiryTimestamp,
  walletAddress,
  browserPublicKey: keypair.publicKey,
  browserPrivateKey: keypair.privateKey,
  nonce
};

await DelegationStorage.store(delegation);

// 5. Subsequent messages signed with browser key
const signature = DelegationCrypto.signRaw(messageJson, privateKey);
```

**Delegation Process (Anonymous)**:

```typescript
// 1. Generate browser keypair
const keypair = DelegationCrypto.generateKeypair();

// 2. Generate session ID (UUID)
const sessionId = crypto.randomUUID();

// 3. Store anonymous delegation
const delegation: AnonymousDelegationInfo = {
  sessionId,
  browserPublicKey: keypair.publicKey,
  browserPrivateKey: keypair.privateKey,
  expiryTimestamp,
  nonce
};

// 4. No wallet signature required
// User address = sessionId
```

**Verification Process**:

```typescript
// 1. Verify message signature
const messagePayload = JSON.stringify({
  ...message,
  signature: undefined,
  browserPubKey: undefined,
  delegationProof: undefined
});

const signatureValid = DelegationCrypto.verifyRaw(
  messagePayload,
  message.signature,
  message.browserPubKey
);

if (!signatureValid) return false;

// 2. Verify delegation authorization
if (message.delegationProof) {
  // Wallet user - verify delegation proof
  const proofValid = await DelegationCrypto.verifyWalletSignature(
    message.delegationProof.authMessage,
    message.delegationProof.walletSignature,
    message.delegationProof.walletAddress
  );
  
  // Check auth message contains browser key, wallet address, expiry
  const authMessageValid = 
    message.delegationProof.authMessage.includes(message.browserPubKey) &&
    message.delegationProof.authMessage.includes(message.author) &&
    message.delegationProof.authMessage.includes(
      message.delegationProof.expiryTimestamp.toString()
    );
  
  return proofValid && authMessageValid;
} else {
  // Anonymous user - verify session ID format
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    message.author
  );
}
```

---

### 2. Storage Subsystem

**Purpose**: Fast local access with persistent storage.

**Two-Tier Architecture**:

1. **In-Memory Cache** (Tier 1)
   - Synchronous access
   - Fast reads for UI rendering
   - Volatile (resets on page reload)

2. **IndexedDB** (Tier 2)
   - Asynchronous access
   - Persistent across sessions
   - Hydrates cache on startup

**IndexedDB Schema**:

```typescript
const schema = {
  // Content stores (keyPath = 'id')
  cells: { keyPath: 'id' },
  posts: { keyPath: 'id' },
  comments: { keyPath: 'id' },
  
  // Votes (keyPath = 'key', composite: targetId:author)
  votes: { keyPath: 'key' },
  
  // Moderations (keyPath = 'key', composite varies by type)
  moderations: { keyPath: 'key' },
  
  // User identities (keyPath = 'address')
  userIdentities: {
    keyPath: 'address',
    indexes: []
  },
  
  // Bookmarks (keyPath = 'id')
  bookmarks: {
    keyPath: 'id',
    indexes: [{ name: 'by_userId', keyPath: 'userId' }]
  },
  
  // Auth/state stores (keyPath = 'key')
  userAuth: { keyPath: 'key' },
  delegation: { keyPath: 'key' },
  uiState: { keyPath: 'key' },
  meta: { keyPath: 'key' }
};
```

**Cache Synchronization**:

```
┌─────────────────────────────────────────────────────┐
│                  Write Operation                     │
│                                                      │
│  1. Update in-memory cache (immediate)              │
│  2. Write to IndexedDB (async, fire-and-forget)     │
│  3. Notify listeners (for UI update)                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  Read Operation                      │
│                                                      │
│  1. Check in-memory cache (fast path)               │
│  2. If not found, return null/empty                 │
│     (IndexedDB only used for hydration on startup)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                  Startup Hydration                   │
│                                                      │
│  1. Open IndexedDB connection                       │
│  2. Load all stores in parallel                     │
│  3. Populate in-memory cache                        │
│  4. Ready for use                                   │
└─────────────────────────────────────────────────────┘
```

**Deduplication**:

Messages are deduplicated using a composite key:

```typescript
const messageKey = `${message.type}:${message.id}:${message.timestamp}`;
```

This allows the same logical message to be received multiple times without creating duplicates.

---

### 3. Identity Subsystem

**Purpose**: Resolve and cache user identities with ENS integration.

**Resolution Strategy**:

```
┌────────────────────────────────────────────────────┐
│         Identity Resolution Flow                    │
│                                                     │
│  1. Check LocalDatabase cache                      │
│     └─> If found and fresh (< 5 min): return      │
│                                                     │
│  2. Check if Ethereum address                      │
│     └─> If not (anonymous/UUID): return null      │
│                                                     │
│  3. Resolve ENS via PublicClient                   │
│     ├─> Get ENS name                               │
│     ├─> Get ENS avatar                             │
│     └─> Cache result for 5 minutes                │
│                                                     │
│  4. Build UserIdentity object                      │
│     ├─> address                                    │
│     ├─> ensName                                    │
│     ├─> ensAvatar                                  │
│     ├─> callSign (from profile messages)          │
│     ├─> displayPreference                          │
│     ├─> displayName (computed)                     │
│     ├─> verificationStatus (computed)              │
│     └─> lastUpdated                                │
│                                                     │
│  5. Store in LocalDatabase                         │
│                                                     │
│  6. Return identity                                │
└────────────────────────────────────────────────────┘
```

**Display Name Resolution**:

```typescript
function getDisplayName(identity: UserIdentity): string {
  // Priority 1: Call sign (if preference is CALL_SIGN)
  if (
    identity.callSign &&
    identity.displayPreference === EDisplayPreference.CALL_SIGN
  ) {
    return identity.callSign;
  }
  
  // Priority 2: ENS name
  if (identity.ensName) {
    return identity.ensName;
  }
  
  // Priority 3: Shortened address
  return `${identity.address.slice(0, 6)}...${identity.address.slice(-4)}`;
}
```

**Profile Updates**:

User profile updates are broadcast as USER_PROFILE_UPDATE messages:

```typescript
{
  type: MessageType.USER_PROFILE_UPDATE,
  id: uuid(),
  timestamp: Date.now(),
  author: userAddress,
  callSign: 'alice', // optional
  displayPreference: EDisplayPreference.CALL_SIGN,
  signature: '...',
  browserPubKey: '...',
  delegationProof: { ... }
}
```

These messages update the `userIdentities` cache, propagating changes across the network.

---

### 4. Relevance Subsystem

**Purpose**: Score content based on engagement, verification, time, and moderation.

**Scoring Algorithm**:

```typescript
interface RelevanceFactors {
  base: 100;
  engagement: {
    upvoteWeight: 10;
    commentWeight: 3;
  };
  verification: {
    authorBonus: 20;        // ENS verified author
    upvoteBonus: 5;         // Per ENS verified upvoter
    commenterBonus: 10;     // Per ENS verified commenter
  };
  timeDecay: {
    halfLifeDays: 7;
    formula: 'exponential';  // exp(-0.693 * days / halfLife)
  };
  moderation: {
    penalty: 0.5;           // 50% reduction if moderated
  };
}

function calculateScore(
  post: Post,
  votes: Vote[],
  comments: Comment[],
  verifications: Map<address, boolean>,
  moderations: Map<postId, Moderation>
): number {
  // Base score
  let score = 100;
  
  // Engagement
  const upvotes = votes.filter(v => v.value === 1).length;
  const downvotes = votes.filter(v => v.value === -1).length;
  score += (upvotes * 10) + (comments.length * 3);
  
  // Verification bonuses
  if (verifications.get(post.author)) {
    score += 20; // Author ENS verified
  }
  
  const verifiedUpvoters = votes
    .filter(v => v.value === 1 && verifications.get(v.author))
    .length;
  score += verifiedUpvoters * 5;
  
  const verifiedCommenters = new Set(
    comments
      .map(c => c.author)
      .filter(author => verifications.get(author))
  ).size;
  score += verifiedCommenters * 10;
  
  // Time decay (exponential)
  const daysOld = (Date.now() - post.timestamp) / (1000 * 60 * 60 * 24);
  const decay = Math.exp(-0.693 * daysOld / 7); // Half-life 7 days
  score *= decay;
  
  // Moderation penalty
  if (moderations.has(post.id)) {
    score *= 0.5;
  }
  
  return Math.max(0, score);
}
```

**Score Components Breakdown**:

```typescript
interface RelevanceScoreDetails {
  baseScore: 100,
  engagementScore: (upvotes * 10) + (comments * 3),
  authorVerificationBonus: isENS ? 20 : 0,
  verifiedUpvoteBonus: verifiedUpvoters * 5,
  verifiedCommenterBonus: verifiedCommenters * 10,
  timeDecayMultiplier: exp(-0.693 * daysOld / 7),
  moderationPenalty: isModerated ? 0.5 : 1.0,
  finalScore: (base + engagement + bonuses) * decay * modPenalty
}
```

---

## Cryptographic Design

### Key Hierarchy

```
Wallet Private Key (User's wallet, never exposed)
    │
    ├─> Signs authorization message
    │   └─> Stored in delegationProof.walletSignature
    │
    └─> Authorizes ─────────────────────────┐
                                             │
Browser Private Key (Generated, stored locally)
    │                                        │
    ├─> Signs all messages                   │
    │   └─> Stored in message.signature      │
    │                                        │
    └─> Public key: message.browserPubKey ───┘
```

### Cryptographic Primitives

**Ed25519** (via @noble/ed25519):
- Browser key generation
- Message signing
- Signature verification

**ECDSA** (via viem):
- Wallet signature verification
- ENS resolution

### Message Signature Structure

```typescript
// Unsigned message
const unsignedMessage = {
  type: 'post',
  id: 'abc123',
  cellId: 'xyz789',
  title: 'Hello',
  content: 'World',
  timestamp: 1234567890,
  author: '0x...'
};

// Message to sign (excludes signature fields)
const messageToSign = JSON.stringify({
  ...unsignedMessage,
  signature: undefined,
  browserPubKey: undefined,
  delegationProof: undefined
});

// Sign with browser private key
const signature = await ed25519.sign(
  sha512(messageToSign),
  browserPrivateKey
);

// Signed message
const signedMessage = {
  ...unsignedMessage,
  signature: bytesToHex(signature),
  browserPubKey: bytesToHex(browserPublicKey),
  delegationProof: {
    authMessage: '...',
    walletSignature: '...',
    expiryTimestamp: 1234567890,
    walletAddress: '0x...'
  }
};
```

### Verification Logic

```typescript
async function verifyMessage(message: OpchanMessage): Promise<boolean> {
  // 1. Verify message signature with browser public key
  const messagePayload = JSON.stringify({
    ...message,
    signature: undefined,
    browserPubKey: undefined,
    delegationProof: undefined
  });
  
  const signatureValid = await ed25519.verify(
    hexToBytes(message.signature),
    sha512(messagePayload),
    hexToBytes(message.browserPubKey)
  );
  
  if (!signatureValid) return false;
  
  // 2. Verify delegation authorization
  if (message.delegationProof) {
    // Wallet user - verify wallet signature on auth message
    const { authMessage, walletSignature, walletAddress } = message.delegationProof;
    
    const walletSigValid = await verifyMessage({
      account: walletAddress,
      message: authMessage,
      signature: walletSignature
    });
    
    if (!walletSigValid) return false;
    
    // Verify auth message contains browser key and expiry
    if (!authMessage.includes(message.browserPubKey)) return false;
    if (!authMessage.includes(walletAddress)) return false;
    if (!authMessage.includes(message.delegationProof.expiryTimestamp.toString())) {
      return false;
    }
    
    return true;
  } else {
    // Anonymous user - verify session ID is valid UUID
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      message.author
    );
  }
}
```

---

## Network Layer

### Waku Protocol Integration

**Architecture**:

```
┌─────────────────────────────────────────────────────┐
│              MessageManager                          │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         WakuNodeManager                    │    │
│  │  - Create Waku node                        │    │
│  │  - Connect to bootstrap peers              │    │
│  │  - Monitor health                          │    │
│  │  - Emit health events                      │    │
│  └────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌────────────────────────────────────────────┐    │
│  │      ReliableMessaging                     │    │
│  │  - Store & Forward protocol                │    │
│  │  - Message deduplication                   │    │
│  │  - Acknowledgments                         │    │
│  │  - Retries                                 │    │
│  └────────────────────────────────────────────┘    │
│                        │                             │
│                        ▼                             │
│  ┌────────────────────────────────────────────┐    │
│  │         MessageService                     │    │
│  │  - Send messages                           │    │
│  │  - Receive subscriptions                   │    │
│  │  - Codec management (protobuf)             │    │
│  └────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Content Topics**:

Messages are published/subscribed via content topics:

```typescript
const contentTopic = '/opchan/1/messages/proto';

// All message types share the same content topic
// Filtering happens at application layer based on message.type
```

**Message Encoding**:

Messages are encoded with protobuf before transmission (handled by Waku SDK).

**Reliable Messaging**:

The `ReliableMessaging` layer provides:

1. **Store-and-Forward**: Messages cached for offline peers
2. **Deduplication**: Filter out duplicate receives
3. **Acknowledgments**: Confirm message delivery
4. **Retries**: Resend on failure

---

## Design Patterns

### 1. Singleton Pattern

**DelegationManager**, **LocalDatabase**, **MessageManager** are exported as singletons:

```typescript
// Singleton instance
export const delegationManager = new DelegationManager();
export const localDatabase = new LocalDatabase();
export default new DefaultMessageManager();
```

### 2. Facade Pattern

**OpChanClient** acts as a facade, providing a simplified interface:

```typescript
class OpChanClient {
  // Aggregates all services
  readonly delegation: DelegationManager;
  readonly database: LocalDatabase;
  readonly messageManager: DefaultMessageManager;
  readonly forumActions: ForumActions;
  // ...
}
```

### 3. Observer Pattern

Event subscriptions throughout:

```typescript
// MessageManager
messageManager.onMessageReceived(callback);
messageManager.onHealthChange(callback);
messageManager.onSyncStatus(callback);

// UserIdentityService
userIdentityService.subscribe(callback);

// LocalDatabase
database.onPendingChange(callback);
```

### 4. Strategy Pattern

**MessageValidator** validates different message types:

```typescript
class MessageValidator {
  async isValidMessage(message: unknown): Promise<boolean> {
    // Different validation logic per message type
    switch (message.type) {
      case MessageType.CELL:
        return this.validateCell(message);
      case MessageType.POST:
        return this.validatePost(message);
      // ...
    }
  }
}
```

### 5. Repository Pattern

**LocalDatabase** acts as a repository abstracting storage:

```typescript
interface Repository<T> {
  getById(id: string): T | null;
  getAll(): T[];
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}

// LocalDatabase implements repository pattern for each entity type
```

---

## Performance Considerations

### 1. In-Memory Caching

All reads are synchronous from in-memory cache:

```typescript
// Fast - synchronous cache access
const posts = Object.values(client.database.cache.posts);

// No IndexedDB reads during normal operation
```

### 2. Lazy Identity Resolution

Identities resolved on-demand with caching:

```typescript
// First call: async ENS lookup
const identity1 = await getIdentity(address);

// Subsequent calls: cache hit (fast)
const identity2 = await getIdentity(address); // same address
```

### 3. Debouncing

Identity lookups are debounced to avoid redundant calls:

```typescript
// Multiple rapid calls
getIdentity(address); // Starts timer
getIdentity(address); // Resets timer
getIdentity(address); // Resets timer
// Only executes once after 100ms
```

### 4. Batch Operations

IndexedDB writes are batched:

```typescript
// Single transaction for multiple writes
const tx = db.transaction(['cells', 'posts'], 'readwrite');
tx.objectStore('cells').put(cell);
tx.objectStore('posts').put(post);
await tx.complete;
```

### 5. Optimistic UI

Immediate feedback with pending states:

```typescript
// 1. Write to cache immediately
cache.posts[postId] = post;

// 2. Mark as pending
markPending(postId);

// 3. Update UI (shows post with "syncing" badge)
updateUI();

// 4. Send to network (async)
sendMessage(post);

// 5. Clear pending when confirmed
clearPending(postId);
```

---

## Security Model

### Threat Model

**Trusted**:
- User's device and browser
- User's wallet private key

**Untrusted**:
- Network peers
- Network infrastructure
- Message content

### Security Guarantees

1. **Message Authenticity**
   - All messages signed with browser key
   - Browser key authorized by wallet (for wallet users)
   - Anonymous users sign with session key (no wallet)

2. **Message Integrity**
   - Signatures cover entire message payload
   - Any modification invalidates signature

3. **Non-Repudiation**
   - Messages cryptographically tied to author
   - Cannot deny authorship of signed messages

4. **Replay Protection**
   - Deduplication prevents replayed messages
   - Timestamps in message payloads

### Attack Resistance

**Impersonation**:
- ❌ Prevented: Cannot forge signature without private key

**Message Tampering**:
- ❌ Prevented: Modified messages fail signature verification

**Replay Attacks**:
- ✅ Mitigated: Deduplication based on (type:id:timestamp)
- ⚠️ Limited: Same message can be replayed with different timestamp

**Sybil Attacks**:
- ⚠️ Possible: Anonymous users can create multiple sessions
- ✅ Mitigated: ENS-verified users have higher trust/scoring

**DoS Attacks**:
- ⚠️ Possible: Can flood network with messages
- ✅ Mitigated: Client-side validation rejects malformed messages

---

**End of Architecture Guide**

