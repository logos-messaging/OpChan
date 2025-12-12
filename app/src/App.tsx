import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CellPage from './pages/CellPage';
import PostPage from './pages/PostPage';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import Index from './pages/Index';
import ProfilePage from './pages/ProfilePage';
import BookmarksPage from './pages/BookmarksPage';
import FollowingPage from './pages/FollowingPage';
import DebugPage from './pages/DebugPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

// Create a client
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cells" element={<Index />} />
          <Route path="/cell/:cellId" element={<CellPage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/following" element={<FollowingPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </Router>
  </QueryClientProvider>
);

export default App;
