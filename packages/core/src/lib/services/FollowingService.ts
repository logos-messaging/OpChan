import { Following, Post } from '../../types/forum';
import { localDatabase } from '../database/LocalDatabase';
import { getDataFromCache } from '../forum/transformers';

/**
 * Service for managing following relationships
 * Handles all following-related operations including CRUD operations
 * and post filtering for followed users
 */
export class FollowingService {
  /**
   * Follow a user
   */
  public static async followUser(
    userId: string,
    followedAddress: string
  ): Promise<Following> {
    const following: Following = {
      id: `${userId}:${followedAddress}`,
      userId,
      followedAddress,
      followedAt: Date.now(),
    };

    await localDatabase.addFollowing(following);
    return following;
  }

  /**
   * Unfollow a user
   */
  public static async unfollowUser(
    userId: string,
    followedAddress: string
  ): Promise<void> {
    const followingId = `${userId}:${followedAddress}`;
    await localDatabase.removeFollowing(followingId);
  }

  /**
   * Toggle follow status for a user
   */
  public static async toggleFollow(
    userId: string,
    followedAddress: string
  ): Promise<boolean> {
    const isFollowing = localDatabase.isFollowing(userId, followedAddress);

    if (isFollowing) {
      await this.unfollowUser(userId, followedAddress);
      return false;
    } else {
      await this.followUser(userId, followedAddress);
      return true;
    }
  }

  /**
   * Check if a user is following another address (sync)
   */
  public static isFollowing(userId: string, followedAddress: string): boolean {
    return localDatabase.isFollowing(userId, followedAddress);
  }

  /**
   * Get all addresses a user is following
   */
  public static async getFollowing(userId: string): Promise<string[]> {
    const following = await localDatabase.getUserFollowing(userId);
    return following.map(f => f.followedAddress);
  }

  /**
   * Get all following records for a user
   */
  public static async getFollowingRecords(userId: string): Promise<Following[]> {
    return localDatabase.getUserFollowing(userId);
  }

  /**
   * Get all users who follow a specific address
   */
  public static async getFollowers(followedAddress: string): Promise<string[]> {
    const followers = await localDatabase.getFollowers(followedAddress);
    return followers.map(f => f.userId);
  }

  /**
   * Get the count of addresses a user is following
   */
  public static async getFollowingCount(userId: string): Promise<number> {
    const following = await localDatabase.getUserFollowing(userId);
    return following.length;
  }

  /**
   * Get the count of followers for an address
   */
  public static async getFollowersCount(followedAddress: string): Promise<number> {
    const followers = await localDatabase.getFollowers(followedAddress);
    return followers.length;
  }

  /**
   * Get posts from followed users
   */
  public static async getFollowingPosts(userId: string): Promise<Post[]> {
    const following = await this.getFollowing(userId);
    const { posts } = await getDataFromCache();
    return posts.filter(post => following.includes(post.authorAddress));
  }

  /**
   * Clear all following for a user (useful for account cleanup)
   */
  public static async clearUserFollowing(userId: string): Promise<void> {
    const following = await localDatabase.getUserFollowing(userId);
    await Promise.all(
      following.map(f => localDatabase.removeFollowing(f.id))
    );
  }

  /**
   * Get all following (for debugging/admin purposes)
   */
  public static getAllFollowing(): Following[] {
    return localDatabase.getAllFollowing();
  }
}
