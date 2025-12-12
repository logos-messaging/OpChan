import {
  CellMessage,
  CommentMessage,
  PostMessage,
  VoteMessage,
  ModerateMessage,
  UserProfileUpdateMessage,
} from './waku';
import { EVerificationStatus } from './identity';
import { DelegationProof } from '../lib/delegation/types';

/**
 * Union type of all message types
 * All messages MUST have valid signature and browserPubKey for authenticity
 */
export type OpchanMessage = (
  | CellMessage
  | PostMessage
  | CommentMessage
  | VoteMessage
  | ModerateMessage
  | UserProfileUpdateMessage
) &
  SignedMessage;

/**
 * Partial message type for validation
 */
export interface PartialMessage {
  type?: string;
  author?: string;
  timestamp?: number;
  signature?: string;
  browserPubKey?: string;
  [key: string]: unknown;
}

/**
 * Relevance score calculation details
 */
export interface RelevanceScoreDetails {
  baseScore: number;
  engagementScore: number;
  authorVerificationBonus: number;
  verifiedUpvoteBonus: number;
  verifiedCommenterBonus: number;
  timeDecayMultiplier: number;
  moderationPenalty: number;
  finalScore: number;
  isVerified: boolean;
  upvotes: number;
  comments: number;
  verifiedUpvotes: number;
  verifiedCommenters: number;
  daysOld: number;
  isModerated: boolean;
}

/**
 * Extended Cell with forum-specific fields
 * Extends the base CellMessage with UI and business logic properties
 */
export interface Cell extends CellMessage {
  relevanceScore?: number;
  activeMemberCount?: number;
  recentActivity?: number;
  postCount?: number;
  relevanceDetails?: RelevanceScoreDetails;
}

/**
 * Extended Post with forum-specific fields
 * Extends the base PostMessage with UI and business logic properties
 */
export interface Post extends PostMessage {
  authorAddress: string; // alias for author field for consistency
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
  voteScore?: number; // Computed field for enhanced posts
}

/**
 * Extended Comment with forum-specific fields
 * Extends the base CommentMessage with UI and business logic properties
 */
export interface Comment extends CommentMessage {
  authorAddress: string; // alias for author field for consistency
  upvotes: VoteMessage[];
  downvotes: VoteMessage[];
  moderated?: boolean;
  moderatedBy?: string;
  moderationReason?: string;
  moderationTimestamp?: number;
  relevanceScore?: number;
  relevanceDetails?: RelevanceScoreDetails;
  voteScore?: number; // Computed field for enhanced comments
}

/**
 * Extended message types for verification
 * Signature and browserPubKey are REQUIRED for all messages
 * delegationProof is OPTIONAL - present for wallet users, absent for anonymous users
 */
export interface SignedMessage {
  signature: string;
  browserPubKey: string;
  delegationProof?: DelegationProof; // Cryptographic proof that browser key was authorized (wallet users only)
}

/**
 * User verification status mapping
 */
export interface UserVerificationStatus {
  [address: string]: {
    isVerified: boolean;
    hasENS: boolean;
    ensName?: string;
    verificationStatus?: EVerificationStatus;
  };
}

/**
 * Bookmark types for posts and comments
 */
export enum BookmarkType {
  POST = 'post',
  COMMENT = 'comment',
}

/**
 * Bookmark data structure
 */
export interface Bookmark {
  id: string; // Composite key: `${type}:${targetId}`
  type: BookmarkType;
  targetId: string; // Post ID or Comment ID
  userId: string; // User's wallet address
  createdAt: number; // Timestamp when bookmarked
  // Optional metadata for display
  title?: string; // Post title or comment preview
  author?: string; // Author address
  cellId?: string; // For posts, the cell they belong to
  postId?: string; // For comments, the post they belong to
}

/**
 * Bookmark cache for in-memory storage
 */
export interface BookmarkCache {
  [bookmarkId: string]: Bookmark;
}

/**
 * Following relationship data structure
 */
export interface Following {
  id: string; // Composite key: `${userId}:${followedAddress}`
  userId: string; // Follower's address
  followedAddress: string; // Address being followed
  followedAt: number; // Timestamp when followed
}

/**
 * Following cache for in-memory storage
 */
export interface FollowingCache {
  [followingId: string]: Following;
}
