import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { Post } from '@opchan/core';
import { useAuth, useContent, usePermissions } from '@/hooks';

interface PostCardProps {
  post: Post;
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const {
    bookmarks,
    pending,
    vote,
    togglePostBookmark,
    toggleFollow,
    isFollowing,
    cells,
    commentsByPost,
  } = useContent();
  const permissions = usePermissions();
  const { currentUser } = useAuth();

  const cellName = cells.find(c => c.id === post.cellId)?.name || 'unknown';
  const commentCount = commentsByPost[post.id]?.length || 0;

  const isPending = pending.isPending(post.id);

  const isBookmarked = bookmarks.some(
    b => b.targetId === post.id && b.type === 'post'
  );
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);
  const [followLoading, setFollowLoading] = React.useState(false);

  const isOwnPost = currentUser?.address === post.author;
  const isFollowingAuthor = isFollowing(post.author);

  const score = post.upvotes.length - post.downvotes.length;
  const userUpvoted = Boolean(
    post.upvotes.some(v => v.author === currentUser?.address)
  );
  const userDownvoted = Boolean(
    post.downvotes.some(v => v.author === currentUser?.address)
  );

  const contentText =
    typeof post.content === 'string'
      ? post.content
      : String(post.content ?? '');
  const contentPreview =
    contentText.length > 200
      ? contentText.substring(0, 200) + '...'
      : contentText;

  const handleVote = async (e: React.MouseEvent, isUpvote: boolean) => {
    e.preventDefault();
    await vote({ targetId: post.id, isUpvote });
  };

  const handleBookmark = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setBookmarkLoading(true);
    try {
      await togglePostBookmark(post, post.cellId);
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
      await toggleFollow(post.author);
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="border-b border-border/30 py-3 px-4 text-sm">
      <div className="flex items-start gap-3">
        {/* Inline vote display */}
        <button
          className={`${userUpvoted ? 'text-primary' : 'text-muted-foreground'} hover:text-primary text-lg`}
          onClick={e => handleVote(e, true)}
          disabled={!permissions.canVote}
          title={permissions.canVote ? 'Upvote' : permissions.reasons.vote}
        >
          ▲
        </button>
        <span className={`font-mono text-base min-w-[2ch] text-center ${score > 0 ? 'text-primary' : score < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          {score}
        </span>
        <button
          className={`${userDownvoted ? 'text-blue-400' : 'text-muted-foreground'} hover:text-blue-400 text-lg`}
          onClick={e => handleVote(e, false)}
          disabled={!permissions.canVote}
          title={permissions.canVote ? 'Downvote' : permissions.reasons.vote}
        >
          ▼
        </button>

        {/* Content - all inline */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <Link
              to={cellName ? `/cell/${post.cellId}` : '#'}
              className="text-primary hover:underline text-sm font-medium"
              onClick={e => {
                if (!cellName) e.preventDefault();
              }}
            >
              r/{cellName}
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to={`/post/${post.id}`} className="text-foreground hover:underline font-medium text-lg">
              {post.title}
            </Link>
            <span className="text-muted-foreground text-xs">
              by {post.author.slice(0, 6)}...{post.author.slice(-4)}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(post.timestamp), {
                addSuffix: true,
              })}
            </span>
            <span className="text-muted-foreground text-xs">·</span>
            <Link to={`/post/${post.id}`} className="text-muted-foreground hover:underline text-xs">
              {commentCount} {commentCount === 1 ? 'reply' : 'replies'}
            </Link>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={handleBookmark}
              disabled={bookmarkLoading}
              className="text-muted-foreground hover:underline text-xs"
            >
              {isBookmarked ? 'unsave' : 'save'}
            </button>
            {currentUser && !isOwnPost && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`hover:underline text-xs ${isFollowingAuthor ? 'text-red-400' : 'text-muted-foreground'}`}
                >
                  {isFollowingAuthor ? 'unfollow' : 'follow'}
                </button>
              </>
            )}
            {isPending && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-yellow-400 text-xs">syncing</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
