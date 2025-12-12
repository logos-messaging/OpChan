/**
 * @opchan/core - Browser library for opchan
 */

// Export all types
export * from './types/forum';
export * from './types/identity';  
export * from './types/waku';

// Export database functionality
export { LocalDatabase, localDatabase } from './lib/database/LocalDatabase';
export * from './lib/database/schema';

// Export delegation system
export { 
  DelegationManager, 
  delegationManager,
  DelegationStorage,
  DelegationCrypto 
} from './lib/delegation';
export * from './lib/delegation/types';
export type { DelegationFullStatus } from './lib/delegation';

// Export forum functionality
export { ForumActions } from './lib/forum/ForumActions';
export { RelevanceCalculator } from './lib/forum/RelevanceCalculator';
export * from './lib/forum/transformers';

// Export services
export { BookmarkService } from './lib/services/BookmarkService';
export { FollowingService } from './lib/services/FollowingService';
export { MessageService } from './lib/services/MessageService';
export { UserIdentityService, type UserIdentity } from './lib/services/UserIdentityService';

// Export utilities
export * from './lib/utils';
export { MessageValidator } from './lib/utils/MessageValidator';
export { environment, type EnvironmentConfig } from './lib/utils/environment';

// Export Waku networking
export { default as messageManager } from './lib/waku';
export * from './lib/waku/network';

// Export wallet functionality
export { EthereumWallet, EthereumWalletHelpers } from './lib/wallet';
export { wagmiConfig, config, createWagmiConfig } from './lib/wallet/config';
export * from './lib/wallet/types';

// Primary client API
export { OpChanClient, type OpChanClientConfig } from './client/OpChanClient';

