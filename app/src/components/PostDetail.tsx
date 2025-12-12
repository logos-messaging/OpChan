import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MarkdownInput } from '@/components/ui/markdown-input';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  MessageCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { AuthorDisplay } from './ui/author-display';
import { BookmarkButton } from './ui/bookmark-button';
import { MarkdownRenderer } from './ui/markdown-renderer';
import CommentCard from './CommentCard';
import { useAuth, useContent, usePermissions } from '@/hooks';
import type { Cell as ForumCell } from '@opchan/core';
import { ShareButton } from './ui/ShareButton';
import { InlineCallSignInput } from './ui/inline-callsign-input';
import { EVerificationStatus } from '@opchan/core';

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  // Use aggregated forum API
  const content = useContent();
  const permissions = usePermissions();
  const { currentUser } = useAuth();
  // Get post and comments using focused hooks
  const post = content.posts.find(p => p.id === postId);
  const visibleComments = postId ? (content.commentsByPost[postId] ?? []) : [];

  // Use library pending API
  const postPending = content.pending.isPending(post?.id);
  const postVotePending = content.pending.isPending(post?.id);

  // Check if bookmarked
  const isBookmarked = content.bookmarks.some(
    b => b.targetId === post?.id && b.type === 'post'
  );
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);
  const [followLoading, setFollowLoading] = React.useState(false);

  const [newComment, setNewComment] = useState('');

  if (!postId) return <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 text-center">Invalid post ID</div>;

  // ✅ Loading state handled by hook
  if (postPending) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-12 sm:py-16 text-center">
        <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-3 sm:mb-4 animate-spin text-primary" />
        <p className="text-sm sm:text-lg font-medium text-muted-foreground">
          Loading Post...
        </p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 text-center">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 uppercase tracking-[0.2em]">Post not found</h2>
        <p className="text-xs sm:text-sm mb-3 sm:mb-4 text-muted-foreground px-4">
          The post you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild size="sm" className="text-[10px] sm:text-[11px] px-3 sm:px-4">
          <Link to="/">Go back home</Link>
        </Button>
      </div>
    );
  }

  // ✅ All data comes pre-computed from hooks
  const cell = content.cells.find((c: ForumCell) => c.id === post?.cellId);

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Use aggregated content API
    const result = await content.createComment({ postId, content: newComment });
    if (result) {
      setNewComment('');
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter inserts newline by default. Send on Ctrl+Enter or Shift+Enter.
    const isSendCombo =
      (e.ctrlKey || e.metaKey || e.shiftKey) && e.key === 'Enter';
    if (isSendCombo) {
      e.preventDefault();
      if (newComment.trim()) {
        handleCreateComment(e as React.FormEvent);
      }
    }
  };

  const handleVotePost = async (isUpvote: boolean) => {
    await content.vote({ targetId: post.id, isUpvote });
  };

  const handleBookmark = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setBookmarkLoading(true);
    try {
      await content.togglePostBookmark(post, post.cellId);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleFollow = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFollowLoading(true);
    try {
      await content.toggleFollow(post.author);
    } finally {
      setFollowLoading(false);
    }
  };

  const isOwnPost = currentUser?.address === post.author;
  const isFollowingAuthor = content.isFollowing(post.author);

  const score = post.upvotes.length - post.downvotes.length;
  const isPostUpvoted = Boolean(
    post.upvotes.some(v => v.author === currentUser?.address)
  );
  const isPostDownvoted = Boolean(
    post.downvotes.some(v => v.author === currentUser?.address)
  );

  const handleModerateComment = async (commentId: string) => {
    const reason =
      window.prompt('Enter a reason for moderation (optional):') || undefined;
    if (!cell) return;
    await content.moderate.comment(cell.id, commentId, reason);
  };

  const handleUnmoderateComment = async (commentId: string) => {
    const reason =
      window.prompt('Optional note for unmoderation?') || undefined;
    if (!cell) return;
    await content.moderate.uncomment(cell.id, commentId, reason);
  };

  const handleModerateUser = async (userAddress: string) => {
    const reason =
      window.prompt('Reason for moderating this user? (optional)') || undefined;
    if (!cell) return;
    await content.moderate.user(cell.id, userAddress, reason);
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={() => navigate(`/cell/${post.cellId}`)}
          className="mb-3 text-xs text-primary hover:underline"
        >
          ← r/{cell?.name || 'cell'}
        </button>

        <div className="border-b border-border/50 pb-4 mb-4">
          <div className="flex gap-3">
            {/* Vote column */}
            <div className="flex flex-col items-center gap-0.5 text-xs min-w-[40px]">
              <button
                className={`hover:text-primary ${
                  isPostUpvoted ? 'text-primary' : 'text-muted-foreground'
                }`}
                onClick={() => handleVotePost(true)}
                disabled={!permissions.canVote}
                title={
                  permissions.canVote ? 'Upvote post' : permissions.reasons.vote
                }
              >
                ▲
              </button>
              <span className={`font-mono text-xs ${score > 0 ? 'text-primary' : score < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                {score}
              </span>
              <button
                className={`hover:text-blue-400 ${
                  isPostDownvoted ? 'text-blue-400' : 'text-muted-foreground'
                }`}
                onClick={() => handleVotePost(false)}
                disabled={!permissions.canVote}
                title={
                  permissions.canVote
                    ? 'Downvote post'
                    : permissions.reasons.vote
                }
              >
                ▼
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-xs">
              {/* Title */}
              <h1 className="text-base sm:text-lg font-bold text-foreground mb-2">{post.title}</h1>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground mb-3">
                <Link
                  to={cell?.id ? `/cell/${cell.id}` : "#"}
                  className="text-primary hover:underline"
                  onClick={e => {
                    if (!cell?.id) e.preventDefault();
                  }}
                >
                  r/{cell?.name || 'unknown'}
                </Link>
                <span>·</span>
                <AuthorDisplay
                  address={post.author}
                  className="text-[11px]"
                  showBadge={false}
                />
                <span>·</span>
                <span className="text-muted-foreground/80">
                  {formatDistanceToNow(new Date(post.timestamp), {
                    addSuffix: true,
                  })}
                </span>
                {postPending && (
                  <>
                    <span>·</span>
                    <span className="text-yellow-400 text-[10px]">syncing</span>
                  </>
                )}
              </div>

              {/* Content */}
              <div className="text-xs sm:text-sm text-foreground leading-relaxed mb-3 prose prose-invert max-w-none">
                <MarkdownRenderer content={post.content} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <button
                  onClick={handleBookmark}
                  disabled={bookmarkLoading}
                  className="hover:underline"
                >
                  {isBookmarked ? 'unsave' : 'save'}
                </button>
                <ShareButton
                  size="sm"
                  url={`${window.location.origin}/post/${post.id}`}
                  title={post.title}
                />
                {currentUser && !isOwnPost && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`hover:underline ${isFollowingAuthor ? 'text-red-400' : ''}`}
                  >
                    {isFollowingAuthor ? 'unfollow' : 'follow'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comment Form */}
      {permissions.canComment && (
        <div className="mb-6">
          <form onSubmit={handleCreateComment} onKeyDown={handleKeyDown}>
            <div className="text-xs font-semibold mb-2 text-foreground">Reply:</div>
            <MarkdownInput
              placeholder="What are your thoughts?"
              value={newComment}
              onChange={setNewComment}
              disabled={false}
              minHeight={80}
              initialHeight={100}
              maxHeight={600}
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={!permissions.canComment}
                className="text-xs text-primary hover:underline"
              >
                post
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Call Sign Suggestion for Anonymous Users */}
      {currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS && !currentUser.callSign && permissions.canComment && (
        <div className="mb-6">
          <InlineCallSignInput />
        </div>
      )}

      {!permissions.canComment && (
        <div className="mb-4 p-3 border-t border-b border-border/30 text-xs text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">Connect wallet</Link> to comment
        </div>
      )}

      {/* Comments */}
      <div className="mt-6">
        <div className="text-sm font-semibold mb-3 text-foreground">
          {visibleComments.length} {visibleComments.length === 1 ? 'reply' : 'replies'}
        </div>

        {visibleComments.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4">
            {permissions.canComment
              ? 'No replies yet'
              : 'Connect your wallet to reply'}
          </div>
        ) : (
          visibleComments.map(comment => (
            <CommentCard
              key={comment.id}
              comment={comment}
              postId={postId}
              cellId={cell?.id}
              canModerate={permissions.canModerate(cell?.id || '')}
              onModerateComment={handleModerateComment}
              onUnmoderateComment={handleUnmoderateComment}
              onModerateUser={handleModerateUser}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PostDetail;
