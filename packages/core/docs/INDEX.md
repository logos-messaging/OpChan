# OpChan Core Documentation Index

Complete documentation for `@opchan/core` - the foundational SDK for building decentralized forums.

---

## Quick Links

- **[Quick Start](../QUICK_START.md)** - Get started in 5 minutes
- **[README](../README.md)** - Package overview and installation
- **[Getting Started Guide](./getting-started.md)** - Comprehensive tutorial
- **[API Reference](./api-reference.md)** - Complete API documentation
- **[Architecture Guide](./architecture.md)** - System design and internals
- **[Sample Applications](./sample-apps.md)** - Full working examples

---

## Documentation Overview

### For Beginners

Start here if you're new to OpChan:

1. **[Quick Start](../QUICK_START.md)** (5 min)
   - Minimal working example
   - Essential operations
   - Complete starter template

2. **[README](../README.md)** (15 min)
   - Package overview
   - Core concepts
   - Quick start guide
   - Usage patterns

3. **[Getting Started Guide](./getting-started.md)** (30 min)
   - Step-by-step tutorial
   - All features explained
   - Best practices
   - Complete application skeleton

### For Developers

Deep dive into building applications:

4. **[API Reference](./api-reference.md)** (Reference)
   - Complete API documentation
   - All classes and methods
   - Type definitions
   - Usage examples

5. **[Sample Applications](./sample-apps.md)** (Templates)
   - Minimal forum
   - Anonymous-first forum
   - Moderation dashboard
   - Identity explorer
   - Bookmark manager
   - Real-time feed
   - CLI tool

### For Advanced Users

Understanding the system:

6. **[Architecture Guide](./architecture.md)** (Deep Dive)
   - System overview
   - Core architecture
   - Data flow
   - Key subsystems
   - Cryptographic design
   - Storage strategy
   - Network layer
   - Design patterns
   - Performance considerations
   - Security model

---

## By Topic

### Getting Started

- [Installation](../README.md#installation)
- [Quick Start](../QUICK_START.md)
- [Basic Setup](./getting-started.md#1-install-and-basic-setup)
- [First Application](../README.md#quick-start)

### Client Setup

- [OpChanClient Configuration](./api-reference.md#opchanclient)
- [Opening Database](./getting-started.md#1-install-and-basic-setup)
- [Message Synchronization](./getting-started.md#2-message-synchronization)
- [Network Monitoring](./getting-started.md#19-network-state-management)

### Authentication & Identity

- [Key Delegation (Wallet)](./getting-started.md#3-key-delegation--wallet-users)
- [Key Delegation (Anonymous)](./getting-started.md#4-key-delegation--anonymous-users)
- [Identity Resolution](./getting-started.md#11-identity-resolution)
- [User Profiles](./getting-started.md#12-user-profiles)
- [ENS Integration](./api-reference.md#useridentityservice)

### Content Management

- [Creating Cells](./getting-started.md#5-creating-content--cells)
- [Creating Posts](./getting-started.md#6-creating-content--posts)
- [Creating Comments](./getting-started.md#7-creating-content--comments)
- [Voting](./getting-started.md#8-voting)
- [Reading Content](./getting-started.md#10-reading-cached-data)

### Moderation

- [Moderating Posts](./getting-started.md#9-moderation-cell-owner-only)
- [Moderating Comments](./getting-started.md#9-moderation-cell-owner-only)
- [Moderating Users](./getting-started.md#9-moderation-cell-owner-only)
- [Moderation Dashboard Example](./sample-apps.md#moderation-dashboard)

### Advanced Features

- [Relevance Scoring](./getting-started.md#14-relevance-scoring)
- [Bookmarks](./getting-started.md#15-bookmarks)
- [Pending State Management](./getting-started.md#16-pending-state-management)
- [Message Validation](./getting-started.md#18-message-validation)

### Architecture & Internals

- [System Overview](./architecture.md#system-overview)
- [Core Architecture](./architecture.md#core-architecture)
- [Data Flow](./architecture.md#data-flow)
- [Delegation Subsystem](./architecture.md#1-delegation-subsystem)
- [Storage Subsystem](./architecture.md#2-storage-subsystem)
- [Identity Subsystem](./architecture.md#3-identity-subsystem)
- [Relevance Subsystem](./architecture.md#4-relevance-subsystem)
- [Cryptographic Design](./architecture.md#cryptographic-design)
- [Network Layer](./architecture.md#network-layer)
- [Security Model](./architecture.md#security-model)

---

## API Documentation

### Core Classes

- **[OpChanClient](./api-reference.md#opchanclient)** - Main entry point
- **[DelegationManager](./api-reference.md#delegationmanager)** - Key delegation
- **[LocalDatabase](./api-reference.md#localdatabase)** - Storage and caching
- **[ForumActions](./api-reference.md#forumactions)** - Content operations
- **[UserIdentityService](./api-reference.md#useridentityservice)** - Identity resolution
- **[RelevanceCalculator](./api-reference.md#relevancecalculator)** - Content scoring
- **[MessageManager](./api-reference.md#messagemanager)** - Network layer
- **[BookmarkService](./api-reference.md#bookmarkservice)** - Bookmarks
- **[MessageValidator](./api-reference.md#messagevalidator)** - Validation

### Type Definitions

- [Core Types](./api-reference.md#type-definitions)
- [User Types](./api-reference.md#user)
- [Message Types](./api-reference.md#message-types)
- [Forum Types](./api-reference.md#extended-forum-types)
- [Delegation Types](./api-reference.md#delegationproof)

---

## Sample Application

### Complete Production-Ready Template

**[Complete Forum Application](./sample-apps.md)**

A comprehensive, production-ready forum demonstrating all features:

- ✅ Client initialization and configuration
- ✅ Anonymous & wallet authentication
- ✅ Session persistence across reloads
- ✅ Content creation (cells, posts, comments)
- ✅ Voting system (upvote/downvote)
- ✅ Identity resolution (ENS, call signs)
- ✅ Real-time message synchronization
- ✅ Relevance scoring with breakdown
- ✅ Moderation tools (cell owners)
- ✅ Bookmark management
- ✅ Network health monitoring
- ✅ Optimistic UI with pending states
- ✅ Proper error handling
- ✅ Clean architecture

**Use this as a foundation for building your decentralized forum application.**

---

## Usage Patterns

### Common Workflows

- [Anonymous User Flow](../README.md#anonymous-user-flow)
- [Wallet User Flow](../README.md#wallet-user-flow)
- [Creating Content](../README.md#pattern-1-complete-vanilla-js-application)
- [Identity Resolution](../README.md#pattern-2-identity-resolution)
- [Content Scoring](../README.md#pattern-3-content-scoring)
- [Moderation](../README.md#pattern-4-moderation)
- [Bookmarks](../README.md#pattern-5-bookmarks)

### Best Practices

- [Database Management](./getting-started.md#21-best-practices)
- [Message Handling](./getting-started.md#21-best-practices)
- [Network Monitoring](./getting-started.md#21-best-practices)
- [Error Handling](./getting-started.md#22-error-handling)
- [Performance Optimization](./architecture.md#performance-considerations)
- [Security Considerations](./architecture.md#security-model)

---

## Additional Resources

### External Links

- **GitHub Repository**: [opchan](https://github.com/your-org/opchan)
- **React Package**: [@opchan/react](../../react/README.md)
- **Waku Protocol**: [Waku Docs](https://docs.waku.org/)
- **Viem**: [Viem Docs](https://viem.sh/)

### Related Documentation

- [React Package Docs](../../react/README.md)
- [React Getting Started](../../react/docs/getting-started.md)
- [Project README](../../../README.md)

---

## Quick Reference

### Essential Imports

```typescript
// Core client
import { OpChanClient } from '@opchan/core';

// Types
import {
  EVerificationStatus,
  EDisplayPreference,
  type User,
  type Cell,
  type Post,
  type Comment,
  type Bookmark
} from '@opchan/core';

// Utilities
import {
  transformPost,
  transformComment,
  transformCell,
  BookmarkService,
  MessageValidator
} from '@opchan/core';

// Services
import {
  DelegationManager,
  LocalDatabase,
  ForumActions,
  UserIdentityService,
  RelevanceCalculator
} from '@opchan/core';
```

### Most Common Operations

```typescript
// Initialize
const client = new OpChanClient({ wakuConfig });
await client.database.open();

// Anonymous session
const sessionId = await client.delegation.delegateAnonymous('7days');

// Create post
await client.forumActions.createPost(params, callback);

// Read posts
const posts = Object.values(client.database.cache.posts);

// Get identity
const identity = await client.userIdentityService.getIdentity(address);
```

---

## Troubleshooting

### Common Issues

- [Messages not appearing](../README.md#messages-not-appearing)
- [Database not persisting](../README.md#database-not-persisting)
- [Identity not resolving](../README.md#identity-not-resolving)
- [Delegation expired](./getting-started.md#22-error-handling)
- [Network errors](./getting-started.md#22-error-handling)

### Debug Tips

1. Check delegation status: `await client.delegation.getStatus()`
2. Monitor network health: `client.messageManager.onHealthChange()`
3. Validate messages: `await validator.isValidMessage()`
4. Check database: `await client.database.open()`
5. Review logs: Enable verbose logging in browser console

---

## Contributing

Documentation improvements are welcome! Please see the main project README for contribution guidelines.

---

## License

MIT License - See [LICENSE](../../../LICENSE) for details.

---

**Last Updated**: December 2024

**Version**: 1.0.3

---

