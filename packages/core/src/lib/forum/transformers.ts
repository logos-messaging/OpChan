import { Cell, Post, Comment, Following } from '../../types/forum';
import {
  CellMessage,
  CommentMessage,
  PostMessage,
  VoteMessage,
  ModerateMessage,
  EModerationAction,
} from '../../types/waku';
import { localDatabase } from '../database/LocalDatabase';
import { RelevanceCalculator } from './RelevanceCalculator';
import { UserVerificationStatus } from '../../types/forum';
import { EVerificationStatus } from '../../types/identity';

export const transformCell = async (
  cellMessage: CellMessage,
  _verifyMessage?: unknown,
  userVerificationStatus?: UserVerificationStatus,
  posts?: Post[]
): Promise<Cell | null> => {
  if (userVerificationStatus && posts) {
    const relevanceCalculator = new RelevanceCalculator();

    const relevanceResult = relevanceCalculator.calculateCellScore(
      cellMessage,
      posts
    );

    // Calculate active member count
    const cellPosts = posts.filter(post => post.cellId === cellMessage.id);
    const activeMembers = new Set<string>();
    cellPosts.forEach(post => {
      activeMembers.add(post.authorAddress);
    });

    return {
      ...cellMessage,
      relevanceScore: relevanceResult.score,
      activeMemberCount: activeMembers.size,
      relevanceDetails: relevanceResult.details,
    };
  }

  return cellMessage;
};

export const transformPost = async (
  postMessage: PostMessage,
  _verifyMessage?: unknown,
  userVerificationStatus?: UserVerificationStatus
): Promise<Post | null> => {
  // Message validity already enforced upstream

  const votes = Object.values(localDatabase.cache.votes).filter(
    (vote): vote is VoteMessage => vote && vote.targetId === postMessage.id
  );
  // Votes in cache are already validated; just map
  const filteredVotes = votes;
  const upvotes = filteredVotes.filter(
    (vote): vote is VoteMessage => vote !== null && vote.value === 1
  );
  const downvotes = filteredVotes.filter(
    (vote): vote is VoteMessage => vote !== null && vote.value === -1
  );

  const modMsg = localDatabase.cache.moderations[postMessage.id];
  const isPostModerated =
    !!modMsg &&
    modMsg.targetType === 'post' &&
    modMsg.action === EModerationAction.MODERATE;
  const userModMsg = Object.values(
    localDatabase.cache.moderations
  ).find(
    (m): m is ModerateMessage =>
      m &&
      m.targetType === 'user' &&
      m.cellId === postMessage.cellId &&
      m.targetId === postMessage.author
  );
  const isUserModerated =
    !!userModMsg && userModMsg.action === EModerationAction.MODERATE;

  const transformedPost: Post = {
    authorAddress: postMessage.author,
    ...postMessage,
    upvotes,
    downvotes,
    moderated: isPostModerated || isUserModerated,
    moderatedBy: isPostModerated
      ? modMsg.author
      : isUserModerated
        ? userModMsg!.author
        : undefined,
    moderationReason: isPostModerated
      ? modMsg.reason
      : isUserModerated
        ? userModMsg!.reason
        : undefined,
    moderationTimestamp: isPostModerated
      ? modMsg.timestamp
      : isUserModerated
        ? userModMsg!.timestamp
        : undefined,
    // mark pending for optimistic UI if not yet acknowledged
    // not persisted as a field; UI can check via LocalDatabase
  };

  // Calculate relevance score if user verification status is provided
  if (userVerificationStatus) {
    const relevanceCalculator = new RelevanceCalculator();

    // Get comments for this post
    const comments = await Promise.all(
      Object.values(localDatabase.cache.comments)
        .filter((comment): comment is CommentMessage => comment !== null)
        .map(comment =>
          transformComment(comment, undefined, userVerificationStatus)
        )
    ).then(comments =>
      comments.filter((comment): comment is Comment => comment !== null)
    );
    const postComments = comments.filter(
      comment => comment.postId === postMessage.id
    );

    const relevanceResult = relevanceCalculator.calculatePostScore(
      transformedPost,
      filteredVotes,
      postComments,
      userVerificationStatus
    );

    const relevanceScore = relevanceResult.score;

    // Calculate verified upvotes and commenters
    const verifiedUpvotes = upvotes.filter(vote => {
      const voterStatus = userVerificationStatus[vote.author];
      return voterStatus?.isVerified;
    }).length;

    const verifiedCommenters = new Set<string>();
    postComments.forEach(comment => {
      const commenterStatus = userVerificationStatus[comment.authorAddress];
      if (commenterStatus?.isVerified) {
        verifiedCommenters.add(comment.authorAddress);
      }
    });

    return {
      ...transformedPost,
      relevanceScore,
      verifiedUpvotes,
      verifiedCommenters: Array.from(verifiedCommenters),
      relevanceDetails: relevanceResult.details,
    };
  }

  return transformedPost;
};

export const transformComment = async (
  commentMessage: CommentMessage,
  _verifyMessage?: unknown,
  userVerificationStatus?: UserVerificationStatus
): Promise<Comment | null> => {
  // Message validity already enforced upstream
  const votes = Object.values(localDatabase.cache.votes).filter(
    (vote): vote is VoteMessage => vote && vote.targetId === commentMessage.id
  );
  // Votes in cache are already validated
  const filteredVotes = votes;
  const upvotes = filteredVotes.filter(
    (vote): vote is VoteMessage => vote !== null && vote.value === 1
  );
  const downvotes = filteredVotes.filter(
    (vote): vote is VoteMessage => vote !== null && vote.value === -1
  );

  const modMsg = localDatabase.cache.moderations[commentMessage.id];
  const isCommentModerated =
    !!modMsg &&
    modMsg.targetType === 'comment' &&
    modMsg.action === EModerationAction.MODERATE;
  // Find the post to get the correct cell ID
  const parentPost = Object.values(localDatabase.cache.posts).find(
    (post): post is PostMessage => post && post.id === commentMessage.postId
  );
  const userModMsg = Object.values(
    localDatabase.cache.moderations
  ).find(
    (m): m is ModerateMessage =>
      m &&
      m.targetType === 'user' &&
      m.cellId === parentPost?.cellId &&
      m.targetId === commentMessage.author
  );
  const isUserModerated =
    !!userModMsg && userModMsg.action === EModerationAction.MODERATE;

  const transformedComment: Comment = {
    ...commentMessage,
    authorAddress: commentMessage.author,
    upvotes,
    downvotes,
    moderated: isCommentModerated || isUserModerated,
    moderatedBy: isCommentModerated
      ? modMsg.author
      : isUserModerated
        ? userModMsg!.author
        : undefined,
    moderationReason: isCommentModerated
      ? modMsg.reason
      : isUserModerated
        ? userModMsg!.reason
        : undefined,
    moderationTimestamp: isCommentModerated
      ? modMsg.timestamp
      : isUserModerated
        ? userModMsg!.timestamp
        : undefined,
    // mark pending for optimistic UI via LocalDatabase lookup
  };

  // Calculate relevance score if user verification status is provided
  if (userVerificationStatus) {
    const relevanceCalculator = new RelevanceCalculator();

    const relevanceResult = relevanceCalculator.calculateCommentScore(
      transformedComment,
      filteredVotes.filter((vote): vote is VoteMessage => vote !== null),
      userVerificationStatus
    );

    return {
      ...transformedComment,
      relevanceScore: relevanceResult.score,
      relevanceDetails: relevanceResult.details,
    };
  }

  return transformedComment;
};

export const transformVote = async (
  voteMessage: VoteMessage,
  _verifyMessage?: unknown
): Promise<VoteMessage | null> => {
  // Message validity already enforced upstream

  return voteMessage;
};

/**
 * Get posts from users that the specified user is following
 */
export const getFollowingPostsFromCache = async (
  userId: string
): Promise<Post[]> => {
  const followingRecords = Object.values(localDatabase.cache.following);
  const followedAddresses = followingRecords
    .filter(f => f.userId === userId)
    .map(f => f.followedAddress);

  const { posts } = await getDataFromCache();
  return posts.filter(post => followedAddresses.includes(post.authorAddress));
};

export const getDataFromCache = async (
  _verifyMessage?: unknown, // Deprecated parameter, kept for compatibility
): Promise<{ cells: Cell[]; posts: Post[]; comments: Comment[] }> => {
  const userIdentities = localDatabase.cache.userIdentities;
  const userVerificationStatus: UserVerificationStatus = {};

  for (const [address, rec] of Object.entries(userIdentities)) {
    userVerificationStatus[address] = {
      isVerified: rec.verificationStatus === EVerificationStatus.ENS_VERIFIED,
      hasENS: Boolean(rec.ensName),
      ensName: rec.ensName,
      verificationStatus: rec.verificationStatus,
    };
  }

  const posts = await Promise.all(
    Object.values(localDatabase.cache.posts)
      .filter((post): post is PostMessage => post !== null)
      .map(post =>
        transformPost(post, undefined, userVerificationStatus)
      )
  ).then(posts => posts.filter((post): post is Post => post !== null));

  const comments = await Promise.all(
    Object.values(localDatabase.cache.comments)
      .filter((c): c is CommentMessage => c !== null)
      .map(c =>
        transformComment(c, undefined, userVerificationStatus)
      )
  ).then(comments =>
    comments.filter((comment): comment is Comment => comment !== null)
  );

  // Then transform cells with posts for relevance calculation
  const cells = await Promise.all(
    Object.values(localDatabase.cache.cells)
      .filter((cell): cell is CellMessage => cell !== null)
      .map(cell =>
        transformCell(cell, undefined, userVerificationStatus, posts)
      )
  ).then(cells => cells.filter((cell): cell is Cell => cell !== null));

  return { cells, posts, comments };
};
