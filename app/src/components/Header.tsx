import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth, useForum, useNetwork, useUIState } from '@/hooks';
import { EVerificationStatus } from '@opchan/core';
import { localDatabase } from '@opchan/core';

import {
  LogOut,
  AlertTriangle,
  CheckCircle,
  Key,
  CircleSlash,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useToast } from '@/components/ui/use-toast';
import { useEthereumWallet } from '@opchan/react';
import { WalletWizard } from '@/components/ui/wallet-wizard';
import { CallSignSetupDialog } from '@/components/ui/call-sign-setup-dialog';
import RemixBanner from '@/components/RemixBanner';


const Header = () => {
  const { currentUser, delegationInfo } = useAuth();
  const { statusMessage, syncStatus, syncDetail } = useNetwork();

  const location = useLocation();
  const { toast } = useToast();

  const { isConnected, disconnect } = useEthereumWallet();

  const [walletWizardOpen, setWalletWizardOpen] = useState(false);
  const [callSignDialogOpen, setCallSignDialogOpen] = useState(false);

  // Use centralized UI state instead of direct LocalDatabase access
  const [hasShownWizard, setHasShownWizard] = useUIState(
    'hasShownWalletWizard',
    false
  );

  // Auto-open wizard when wallet connects for the first time
  React.useEffect(() => {
    if (isConnected && !hasShownWizard) {
      setWalletWizardOpen(true);
      setHasShownWizard(true);
    }
  }, [isConnected, hasShownWizard, setHasShownWizard]);

  const handleConnect = async () => {
    setWalletWizardOpen(true);
  };

  const handleOpenWizard = () => {
    setWalletWizardOpen(true);
  };

  const handleDisconnect = async () => {
    // For anonymous users, clear their session
    if (currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS) {
      await localDatabase.clearUser();
      await localDatabase.clearDelegation();
      window.location.reload(); // Reload to reset state
      return;
    }

    // For wallet users, disconnect wallet
    await disconnect();
    setHasShownWizard(false); // Reset so wizard can show again on next connection
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected successfully.',
    });
  };

  const handleClearDatabase = async () => {
    try {
      await localDatabase.clearAll();
      toast({
        title: 'Database Cleared',
        description: 'All local data has been cleared successfully.',
      });
    } catch (error) {
      console.error('Failed to clear database:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear local database. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = () => {
    if (!isConnected) return <CircleSlash className="w-4 h-4" />;

    if (
      currentUser?.verificationStatus ===
      EVerificationStatus.ENS_VERIFIED &&
      delegationInfo?.isValid
    ) {
      return <CheckCircle className="w-4 h-4" />;
    } else if (
      currentUser?.verificationStatus === EVerificationStatus.WALLET_CONNECTED
    ) {
      return <AlertTriangle className="w-4 h-4" />;
    } else if (
      currentUser?.verificationStatus ===
      EVerificationStatus.ENS_VERIFIED
    ) {
      return <Key className="w-4 h-4" />;
    } else {
      return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <>
      <header className="bg-cyber-dark border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-2 py-2">
          {/* Single Row - Logo, Nav, Status, User */}
          <div className="flex items-center justify-between text-sm gap-2">
            {/* Logo & Nav */}
            <div className="flex items-center gap-3">
              <Link to="/" className="font-semibold text-foreground">
                OPCHAN
              </Link>
              <nav className="hidden sm:flex items-center gap-2">
                <Link
                  to="/"
                  className={location.pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                >
                  HOME
                </Link>
                <span className="text-muted-foreground">|</span>
                <Link
                  to="/cells"
                  className={location.pathname === '/cells' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                >
                  CELLS
                </Link>
                {isConnected && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <Link
                      to="/bookmarks"
                      className={location.pathname === '/bookmarks' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                    >
                      BOOKMARKS
                    </Link>
                    <span className="text-muted-foreground">|</span>
                    <Link
                      to="/following"
                      className={location.pathname === '/following' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}
                    >
                      FOLLOWING
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Network Status */}
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{statusMessage}</span>
              {syncStatus === 'syncing' && syncDetail && syncDetail.missing > 0 && (
                <span className="text-yellow-400">SYNCING ({syncDetail.missing})</span>
              )}
            </div>

            {/* User */}
            <div className="flex items-center gap-2">
              {isConnected || currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS ? (
                <div className="flex items-center gap-2">

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-foreground hover:text-primary text-sm">
                        {currentUser?.displayName}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[#050505] border border-border text-sm">
                      <DropdownMenuItem asChild>
                        <Link to="/profile">Profile</Link>
                      </DropdownMenuItem>

                      {currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS ? (
                        <DropdownMenuItem onClick={() => setCallSignDialogOpen(true)}>
                          {currentUser?.callSign ? 'Update' : 'Set'} Call Sign
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={handleOpenWizard}>
                          Setup Wizard
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator className="bg-border" />

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-orange-400 focus:text-orange-400">
                            Clear Database
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#050505] border border-border text-foreground">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-foreground uppercase tracking-[0.2em] text-sm">
                              Clear Local Database
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                              This will permanently delete all locally stored
                              data including:
                              <br />• Posts and comments
                              <br />• User identities and preferences
                              <br />• Bookmarks and votes
                              <br />• UI state and settings
                              <br />
                              <br />
                              <strong>This action cannot be undone.</strong>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border border-border text-foreground hover:bg-white/5">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleClearDatabase}
                              className="border border-red-600 text-red-400 hover:bg-red-600/10"
                            >
                              Clear Database
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <DropdownMenuItem onClick={handleDisconnect} className="text-red-400 focus:text-red-400">
                        {currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS ? 'Exit Anonymous' : 'Disconnect'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  className="text-primary hover:underline text-sm"
                >
                  LOGIN
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Remix Banner */}
      <RemixBanner />

      {/* Wallet Wizard */}
      <WalletWizard
        open={walletWizardOpen}
        onOpenChange={setWalletWizardOpen}
        onComplete={() => {
          setWalletWizardOpen(false);
          toast({
            title: 'Setup Complete',
            description: 'Your wallet is ready to use!',
          });
        }}
      />

      {/* Call Sign Dialog for Anonymous Users */}
      {currentUser?.verificationStatus === EVerificationStatus.ANONYMOUS && (
        <CallSignSetupDialog
          open={callSignDialogOpen}
          onOpenChange={setCallSignDialogOpen}
        />
      )}
    </>
  );
};

export default Header;
