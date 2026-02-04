import React from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useContent, useAuth } from '@/hooks';
import { cn } from '../../utils';

interface FollowButtonProps {
  address: string;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
}

export function FollowButton({
  address,
  className,
  variant = 'outline',
  size = 'sm',
  showText = true,
}: FollowButtonProps) {
  const { currentUser } = useAuth();
  const { isFollowing, toggleFollow } = useContent();
  const [loading, setLoading] = React.useState(false);

  const isCurrentlyFollowing = isFollowing(address);
  const isOwnAddress = currentUser?.address === address;

  // Don't show follow button for own address
  if (isOwnAddress || !currentUser) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await toggleFollow(address);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={cn(
        isCurrentlyFollowing
          ? 'border-red-400/30 text-red-400 hover:bg-red-400/10 hover:text-red-300'
          : 'border-cyber-accent/30 text-cyber-accent hover:bg-cyber-accent/10',
        className
      )}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isCurrentlyFollowing ? (
        <UserMinus size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {showText && (
        <span className="ml-1">
          {isCurrentlyFollowing ? 'Unfollow' : 'Follow'}
        </span>
      )}
    </Button>
  );
}
