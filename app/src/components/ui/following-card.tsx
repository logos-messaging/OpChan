import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserMinus, Users } from 'lucide-react';
import { Following } from '@opchan/core';
import { useUserDisplay } from '@opchan/react';
import { cn } from '../../utils';
import { formatDistanceToNow } from 'date-fns';

interface FollowingCardProps {
  following: Following;
  onUnfollow: (followedAddress: string) => void;
  className?: string;
}

export function FollowingCard({
  following,
  onUnfollow,
  className,
}: FollowingCardProps) {
  const userInfo = useUserDisplay(following.followedAddress);

  // Fallback to truncated address if no display name
  const truncatedAddress = `${following.followedAddress.slice(0, 6)}...${following.followedAddress.slice(-4)}`;
  const displayName = userInfo.displayName || truncatedAddress;

  const handleUnfollow = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnfollow(following.followedAddress);
  };

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:bg-cyber-muted/20 hover:border-cyber-accent/30',
        className
      )}
    >
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          {/* User Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-cyber-accent/20 flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-cyber-accent" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-cyber-light truncate">
                {displayName}
              </h3>
              <p className="text-xs text-cyber-neutral truncate">
                Followed {formatDistanceToNow(new Date(following.followedAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnfollow}
              className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
              title="Unfollow"
            >
              <UserMinus size={14} className="mr-1" />
              Unfollow
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FollowingListProps {
  following: Following[];
  onUnfollow: (followedAddress: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function FollowingList({
  following,
  onUnfollow,
  emptyMessage = 'Not following anyone yet',
  className,
}: FollowingListProps) {
  if (following.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
      >
        <Users size={48} className="text-cyber-neutral/50 mb-4" />
        <h3 className="text-lg font-medium text-cyber-light mb-2">
          {emptyMessage}
        </h3>
        <p className="text-cyber-neutral max-w-md">
          Follow users to see their posts in your personalized feed. Your following
          list is stored locally and won't be shared.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {following.map(f => (
        <FollowingCard
          key={f.id}
          following={f}
          onUnfollow={onUnfollow}
        />
      ))}
    </div>
  );
}
