import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { FollowingList } from '@/components/ui/following-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Post } from '@opchan/core';
import {
  Trash2,
  Users,
  FileText,
} from 'lucide-react';
import { useAuth, useContent } from '@/hooks';
import PostCard from '@/components/PostCard';

const FollowingPage = () => {
  const { currentUser } = useAuth();
  const { following, posts, unfollowUser, clearAllFollowing } = useContent();

  const [activeTab, setActiveTab] = useState<'following' | 'feed'>('following');

  // Get posts from followed users
  const followedAddresses = useMemo(
    () => following.map(f => f.followedAddress),
    [following]
  );

  const followingPosts = useMemo(
    () => posts.filter(post => followedAddresses.includes(post.authorAddress)),
    [posts, followedAddresses]
  );

  // Sort posts by timestamp (newest first)
  const sortedFollowingPosts = useMemo(
    () => [...followingPosts].sort((a, b) => b.timestamp - a.timestamp),
    [followingPosts]
  );

  // Redirect to login if not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col bg-cyber-dark text-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-cyber-light mb-4">
              Authentication Required
            </h1>
            <p className="text-cyber-neutral">
              Please connect your wallet to view your following list.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const handleUnfollow = async (followedAddress: string) => {
    await unfollowUser(followedAddress);
  };

  const handleClearAll = async () => {
    await clearAllFollowing();
  };

  return (
    <div className="page-container">
      <Header />

      <main className="page-content">
        <div className="page-main">
          {/* Header Section */}
          <div className="page-header">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Users className="text-cyber-accent" size={32} />
                <h1 className="page-title">Following</h1>
              </div>

              {following.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                    >
                      <Trash2 size={16} className="mr-2" />
                      Unfollow All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Unfollow All Users</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to unfollow all users? This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Unfollow All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            <p className="page-subtitle">
              Manage the users you follow and see their posts in your personalized feed.
            </p>
          </div>

          {/* Stats */}
          {following.length > 0 && (
            <div className="flex gap-4 mb-6">
              <Badge
                variant="outline"
                className="border-cyber-accent/30 text-cyber-accent"
              >
                <Users size={14} className="mr-1" />
                {following.length} Following
              </Badge>
              <Badge
                variant="outline"
                className="border-cyber-accent/30 text-cyber-accent"
              >
                <FileText size={14} className="mr-1" />
                {followingPosts.length} Posts
              </Badge>
            </div>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={value =>
              setActiveTab(value as 'following' | 'feed')
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="following" className="flex items-center gap-2">
                <Users size={16} />
                Following ({following.length})
              </TabsTrigger>
              <TabsTrigger value="feed" className="flex items-center gap-2">
                <FileText size={16} />
                Feed ({followingPosts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="following">
              <FollowingList
                following={following}
                onUnfollow={handleUnfollow}
                emptyMessage="Not following anyone yet"
              />
            </TabsContent>

            <TabsContent value="feed">
              {followingPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText size={48} className="text-cyber-neutral/50 mb-4" />
                  <h3 className="text-lg font-medium text-cyber-light mb-2">
                    No posts from followed users
                  </h3>
                  <p className="text-cyber-neutral max-w-md">
                    {following.length === 0
                      ? 'Follow some users to see their posts here.'
                      : 'The users you follow haven\'t posted anything yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedFollowingPosts.map(post => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FollowingPage;
