import React from 'react';
import { useClient } from '../context/ClientContext';
import { useOpchanStore, setOpchanState } from '../store/opchanStore';
import {
  Post,
  Comment,
  Cell,
  EVerificationStatus,
  UserVerificationStatus,
  BookmarkType,
  getDataFromCache,
} from '@opchan/core';
import { BookmarkService, FollowingService } from '@opchan/core';

function reflectCache(client: ReturnType<typeof useClient>): void {
  getDataFromCache().then(({ cells, posts, comments }: { cells: Cell[]; posts: Post[]; comments: Comment[] }) => {
    setOpchanState(prev => ({
      ...prev,
      content: {
        ...prev.content,
        cells,
        posts,
        comments,
        bookmarks: Object.values(client.database.cache.bookmarks),
        following: Object.values(client.database.cache.following),
        lastSync: client.database.getSyncState().lastSync,
        pendingIds: prev.content.pendingIds,
        pendingVotes: prev.content.pendingVotes,
      },
    }));
  }).catch((err: Error) => {
    console.error('reflectCache failed', err);
  });
}

/**
 * Hook for accessing and managing forum content including cells, posts, comments,
 * bookmarks, and following relationships.
 *
 * ## Following Feature
 *
 * The hook provides methods to follow/unfollow users and filter posts by followed users.
 * Following data is stored locally in IndexedDB and persists across sessions.
 *
 * ### Data
 * - `following`: Array of `Following` objects containing `{ id, userId, followedAddress, followedAt }`
 *
 * ### Methods
 * - `toggleFollow(address)`: Toggle follow status, returns `true` if now following
 * - `followUser(address)`: Follow a user
 * - `unfollowUser(address)`: Unfollow a user
 * - `isFollowing(address)`: Synchronously check if following a user
 * - `getFollowingPosts()`: Get posts from all followed users
 * - `clearAllFollowing()`: Unfollow all users
 *
 * ### Example: Follow Button
 * ```tsx
 * function FollowButton({ authorAddress }: { authorAddress: string }) {
 *   const { currentUser } = useAuth();
 *   const { isFollowing, toggleFollow } = useContent();
 *   const [loading, setLoading] = useState(false);
 *
 *   // Don't show for own address or when not logged in
 *   if (!currentUser || currentUser.address === authorAddress) return null;
 *
 *   const handleClick = async () => {
 *     setLoading(true);
 *     await toggleFollow(authorAddress);
 *     setLoading(false);
 *   };
 *
 *   return (
 *     <button onClick={handleClick} disabled={loading}>
 *       {isFollowing(authorAddress) ? 'Unfollow' : 'Follow'}
 *     </button>
 *   );
 * }
 * ```
 *
 * ### Example: Following Feed
 * ```tsx
 * function FollowingFeed() {
 *   const { following, posts } = useContent();
 *
 *   const followedAddresses = following.map(f => f.followedAddress);
 *   const followingPosts = posts.filter(p => followedAddresses.includes(p.authorAddress));
 *
 *   return (
 *     <div>
 *       <h2>Posts from people you follow ({following.length})</h2>
 *       {followingPosts.map(post => <PostCard key={post.id} post={post} />)}
 *     </div>
 *   );
 * }
 * ```
 *
 * ### Example: Following List
 * ```tsx
 * function FollowingList() {
 *   const { following, unfollowUser } = useContent();
 *
 *   return (
 *     <ul>
 *       {following.map(f => (
 *         <li key={f.id}>
 *           {f.followedAddress}
 *           <button onClick={() => unfollowUser(f.followedAddress)}>
 *             Unfollow
 *           </button>
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useContent() {
  const client = useClient();
  const content = useOpchanStore(s => s.content);
  const session = useOpchanStore(s => s.session);

  // Re-render on pending changes from LocalDatabase so isPending reflects current state
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const off = client.database.onPendingChange(() => {
      forceRender();
    });
    return () => {
        try {
          off();
        } catch (err) {
          console.error('Error cleaning up pending change listener:', err);
        }
    };
  }, [client]);

  // Derived maps
  const postsByCell = React.useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const p of content.posts) {
      (map[p.cellId] ||= []).push(p);
    }
    return map;
  }, [content.posts]);

  const commentsByPost = React.useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of content.comments) {
      (map[c.postId] ||= []).push(c);
    }
    for (const postId in map) {
      map[postId].sort((a, b) => a.timestamp - b.timestamp);
    }
    return map;
  }, [content.comments]);

  // Derived: user verification status from identity cache
  const userVerificationStatus: UserVerificationStatus = React.useMemo(() => {
    const identities = client.database.cache.userIdentities;
    const result: UserVerificationStatus = {};
    for (const [address, rec] of Object.entries(identities)) {
      if (rec) {
        const hasEns = Boolean(rec.ensName);
        const isVerified = rec.verificationStatus === EVerificationStatus.ENS_VERIFIED;
        result[address] = {
          isVerified,
          hasENS: hasEns,
          ensName: rec.ensName,
          verificationStatus: rec.verificationStatus,
        };
      }
    }
    return result;
  }, [client.database.cache.userIdentities]);

  // Derived: cells with stats for sidebar/trending
  const cellsWithStats = React.useMemo(() => {
    const byCell: Record<string, { postCount: number; activeUsers: Set<string>; recentActivity: number }> = {};
    const now = Date.now();
    const recentWindowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    for (const p of content.posts) {
      const entry = (byCell[p.cellId] ||= { postCount: 0, activeUsers: new Set<string>(), recentActivity: 0 });
      entry.postCount += 1;
      entry.activeUsers.add(p.author);
      if (now - p.timestamp <= recentWindowMs) entry.recentActivity += 1;
    }
    for (const c of content.comments) {
      // find post for cell reference
      const post = content.posts.find(pp => pp.id === c.postId);
      if (!post) continue;
      const entry = (byCell[post.cellId] ||= { postCount: 0, activeUsers: new Set<string>(), recentActivity: 0 });
      entry.activeUsers.add(c.author);
      if (now - c.timestamp <= recentWindowMs) entry.recentActivity += 1;
    }
    return content.cells.map(cell => {
      const stats = byCell[cell.id] || { postCount: 0, activeUsers: new Set<string>(), recentActivity: 0 };
      return {
        ...cell,
        postCount: stats.postCount,
        activeUsers: stats.activeUsers.size,
        recentActivity: stats.recentActivity,
      } as Cell & { postCount: number; activeUsers: number; recentActivity: number };
    });
  }, [content.cells, content.posts, content.comments]);

  // Actions
  const createCell = React.useCallback(async (input: { name: string; description: string; icon?: string }): Promise<Cell | null> => {
    const currentUser = session.currentUser;
    const isAuthenticated = Boolean(currentUser);
    const result = await client.forumActions.createCell(
      { ...input, currentUser, isAuthenticated },
      () => reflectCache(client)
    );
    reflectCache(client);
    return result.data ?? null;
  }, [client, session.currentUser]);

  const createPost = React.useCallback(async (input: { cellId: string; title: string; content: string }): Promise<Post | null> => {
    const currentUser = session.currentUser;
    const isAuthenticated = Boolean(currentUser);
    const result = await client.forumActions.createPost(
      { ...input, currentUser, isAuthenticated },
      () => reflectCache(client)
    );
    reflectCache(client);
    return result.data ?? null;
  }, [client, session.currentUser]);

  const createComment = React.useCallback(async (input: { postId: string; content: string }): Promise<Comment | null> => {
    const currentUser = session.currentUser;
    const isAuthenticated = Boolean(currentUser);
    const result = await client.forumActions.createComment(
      { ...input, currentUser, isAuthenticated },
      () => reflectCache(client)
    );
    reflectCache(client);
    return result.data ?? null;
  }, [client, session.currentUser]);

  const vote = React.useCallback(async (input: { targetId: string; isUpvote: boolean }): Promise<boolean> => {
    const currentUser = session.currentUser;
    const isAuthenticated = Boolean(currentUser);
    const result = await client.forumActions.vote(
      { ...input, currentUser, isAuthenticated },
      () => reflectCache(client)
    );
    reflectCache(client);
    return result.data ?? false;
  }, [client, session.currentUser]);

  const moderate = React.useMemo(() => ({
    post: async (cellId: string, postId: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const res = await client.forumActions.moderatePost(
        { cellId, postId, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
    unpost: async (cellId: string, postId: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const res = await client.forumActions.unmoderatePost(
        { cellId, postId, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
    comment: async (cellId: string, commentId: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const comment = content.comments.find(c => c.id === commentId);
      const res = await client.forumActions.moderateComment(
        { cellId, commentId, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '', commentAuthor: comment?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
    uncomment: async (cellId: string, commentId: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const comment = content.comments.find(c => c.id === commentId);
      const res = await client.forumActions.unmoderateComment(
        { cellId, commentId, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '', commentAuthor: comment?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
    user: async (cellId: string, userAddress: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const res = await client.forumActions.moderateUser(
        { cellId, userAddress, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
    unuser: async (cellId: string, userAddress: string, reason?: string) => {
      const currentUser = session.currentUser;
      const isAuthenticated = Boolean(currentUser);
      const cell = content.cells.find(c => c.id === cellId);
      const res = await client.forumActions.unmoderateUser(
        { cellId, userAddress, reason, currentUser, isAuthenticated, cellOwner: cell?.author ?? '' },
        () => reflectCache(client)
      );
      reflectCache(client);
      return res.data ?? false;
    },
  }), [client, session.currentUser, content.cells]);

  const togglePostBookmark = React.useCallback(async (post: Post, cellId?: string): Promise<boolean> => {
    const address = session.currentUser?.address;
    if (!address) return false;
    const added = await BookmarkService.togglePostBookmark(post, address, cellId);
    const updated = await client.database.getUserBookmarks(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, bookmarks: updated } }));
    return added;
  }, [client, session.currentUser?.address]);

  const toggleCommentBookmark = React.useCallback(async (comment: Comment, postId?: string): Promise<boolean> => {
    const address = session.currentUser?.address;
    if (!address) return false;
    const added = await BookmarkService.toggleCommentBookmark(comment, address, postId);
    const updated = await client.database.getUserBookmarks(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, bookmarks: updated } }));
    return added;
  }, [client, session.currentUser?.address]);

  const removeBookmark = React.useCallback(async (bookmarkId: string): Promise<void> => {
    const address = session.currentUser?.address;
    if (!address) return;
    const [typeStr, targetId] = bookmarkId.split(':');
    const type = typeStr === 'post' ? BookmarkType.POST : BookmarkType.COMMENT;
    await BookmarkService.removeBookmark(type, targetId);
    const updated = await client.database.getUserBookmarks(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, bookmarks: updated } }));
  }, [client, session.currentUser?.address]);

  const clearAllBookmarks = React.useCallback(async (): Promise<void> => {
    const address = session.currentUser?.address;
    if (!address) return;
    await BookmarkService.clearUserBookmarks(address);
    const updated = await client.database.getUserBookmarks(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, bookmarks: updated } }));
  }, [client, session.currentUser?.address]);

  // ============================================================================
  // FOLLOWING METHODS
  // ============================================================================
  // The following feature allows users to follow other users and see their posts
  // in a personalized feed. Following data is stored locally in IndexedDB.
  //
  // Data:
  //   - `following`: Array of Following objects for the current user
  //
  // Methods:
  //   - `toggleFollow(address)`: Toggle follow status, returns true if now following
  //   - `followUser(address)`: Follow a user
  //   - `unfollowUser(address)`: Unfollow a user
  //   - `isFollowing(address)`: Check if following (synchronous)
  //   - `getFollowingPosts()`: Get posts from followed users
  //   - `clearAllFollowing()`: Unfollow all users
  //
  // Example usage:
  // ```tsx
  // function FollowButton({ authorAddress }: { authorAddress: string }) {
  //   const { isFollowing, toggleFollow } = useContent();
  //   const [loading, setLoading] = useState(false);
  //
  //   const handleClick = async () => {
  //     setLoading(true);
  //     await toggleFollow(authorAddress);
  //     setLoading(false);
  //   };
  //
  //   return (
  //     <button onClick={handleClick} disabled={loading}>
  //       {isFollowing(authorAddress) ? 'Unfollow' : 'Follow'}
  //     </button>
  //   );
  // }
  // ```
  // ============================================================================

  /**
   * Toggle follow status for a user.
   * @param followedAddress - The address of the user to follow/unfollow
   * @returns true if now following, false if unfollowed or user not logged in
   */
  const toggleFollow = React.useCallback(async (followedAddress: string): Promise<boolean> => {
    const address = session.currentUser?.address;
    if (!address) return false;
    const isNowFollowing = await FollowingService.toggleFollow(address, followedAddress);
    const updated = await client.database.getUserFollowing(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, following: updated } }));
    return isNowFollowing;
  }, [client, session.currentUser?.address]);

  /**
   * Follow a user.
   * @param followedAddress - The address of the user to follow
   * @returns true if successful, false if user not logged in
   */
  const followUser = React.useCallback(async (followedAddress: string): Promise<boolean> => {
    const address = session.currentUser?.address;
    if (!address) return false;
    await FollowingService.followUser(address, followedAddress);
    const updated = await client.database.getUserFollowing(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, following: updated } }));
    return true;
  }, [client, session.currentUser?.address]);

  /**
   * Unfollow a user.
   * @param followedAddress - The address of the user to unfollow
   * @returns true if successful, false if user not logged in
   */
  const unfollowUser = React.useCallback(async (followedAddress: string): Promise<boolean> => {
    const address = session.currentUser?.address;
    if (!address) return false;
    await FollowingService.unfollowUser(address, followedAddress);
    const updated = await client.database.getUserFollowing(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, following: updated } }));
    return true;
  }, [client, session.currentUser?.address]);

  /**
   * Check if the current user is following another user (synchronous).
   * @param followedAddress - The address to check
   * @returns true if following, false otherwise
   */
  const isFollowing = React.useCallback((followedAddress: string): boolean => {
    const address = session.currentUser?.address;
    if (!address) return false;
    return FollowingService.isFollowing(address, followedAddress);
  }, [session.currentUser?.address]);

  /**
   * Get all posts from users that the current user follows.
   * @returns Array of posts from followed users
   */
  const getFollowingPosts = React.useCallback(async (): Promise<Post[]> => {
    const address = session.currentUser?.address;
    if (!address) return [];
    return FollowingService.getFollowingPosts(address);
  }, [session.currentUser?.address]);

  /**
   * Unfollow all users. Useful for account cleanup.
   */
  const clearAllFollowing = React.useCallback(async (): Promise<void> => {
    const address = session.currentUser?.address;
    if (!address) return;
    await FollowingService.clearUserFollowing(address);
    const updated = await client.database.getUserFollowing(address);
    setOpchanState(prev => ({ ...prev, content: { ...prev.content, following: updated } }));
  }, [client, session.currentUser?.address]);

  const refresh = React.useCallback(async () => {
    // Minimal refresh: re-reflect cache; network refresh is via useNetwork
    reflectCache(client);
  }, [client]);

  return {
    // data
    cells: content.cells,
    posts: content.posts,
    comments: content.comments,
    bookmarks: content.bookmarks,
    following: content.following,
    postsByCell,
    commentsByPost,
    cellsWithStats,
    userVerificationStatus,
    pending: {
      isPending: (id?: string) => (id ? client.database.isPending(id) : false),
      onChange: (cb: () => void) => client.database.onPendingChange(cb),
    },
    lastSync: content.lastSync,
    // actions
    createCell,
    createPost,
    createComment,
    vote,
    moderate,
    togglePostBookmark,
    toggleCommentBookmark,
    removeBookmark,
    clearAllBookmarks,
    toggleFollow,
    followUser,
    unfollowUser,
    isFollowing,
    getFollowingPosts,
    clearAllFollowing,
    refresh,
  } as const;
}




