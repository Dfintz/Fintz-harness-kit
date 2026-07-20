import { retryLazy } from '@/utils/retryLazy';
import { Box, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AboutModal } from './AboutModal';
import { GuideModeProvider } from './guide';
import { Breadcrumb, HubSidebar, MobileBottomNavigation, TopNavigation } from './navigation';
import { getHubShortcut } from './navigation/commandConfig';

// Lazy load CommandPalette for better initial load performance
const CommandPalette = retryLazy(() =>
  import('./navigation/CommandPalette').then(m => ({ default: m.CommandPalette }))
);

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);

  // Close mobile menu when switching to desktop
  React.useEffect(() => {
    if (!isMobile) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobile]);

  // Load persisted sidebar collapsed state (desktop)
  React.useEffect(() => {
    try {
      const saved = globalThis.localStorage.getItem('nav.sidebarCollapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    } catch {
      // ignore storage errors in non-browser envs
    }
  }, []);

  // Close mobile menu when navigating
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle keyboard shortcut for command palette (Cmd/Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Number key shortcuts (1-4) for hub navigation
      if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        const target = event.target as HTMLElement;
        const tagName = target?.tagName?.toLowerCase();
        const isInputField =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target?.isContentEditable;

        if (!isInputField && ['1', '2', '3', '4'].includes(event.key)) {
          event.preventDefault();
          const shortcut = getHubShortcut(event.key);
          if (shortcut) {
            navigate(shortcut.path);
          }
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <GuideModeProvider>
      <Stack
        direction="column"
        minHeight="100vh"
        width="100%"
        sx={{
          background: `linear-gradient(180deg, ${muiTheme.palette.background.default} 0%, ${muiTheme.palette.background.paper} 100%)`,
        }}
      >
        {/* Header */}
        <TopNavigation
          isMobile={isMobile}
          isMobileMenuOpen={isMobileMenuOpen}
          onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onAboutClick={() => setIsAboutModalOpen(true)}
          onSearchClick={() => setIsCommandPaletteOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => {
            setIsSidebarCollapsed(prev => {
              const next = !prev;
              try {
                globalThis.localStorage.setItem('nav.sidebarCollapsed', String(next));
              } catch {
                // ignore storage errors
              }
              return next;
            });
          }}
        />

        <Stack direction="row" flex={1}>
          {/* Sidebar Navigation */}
          <HubSidebar
            isVisible={!isSidebarCollapsed}
            isOpen={!isMobile || isMobileMenuOpen}
            isMobile={isMobile}
            onOpen={() => setIsMobileMenuOpen(true)}
            onClose={() => setIsMobileMenuOpen(false)}
          />

          {/* Main Content Area */}
          <Box
            component="main"
            id="main-content"
            flex={1}
            sx={{
              backgroundColor: 'transparent',
              minWidth: 0,
              overflowX: 'hidden',
              // Add bottom padding on mobile to avoid content being hidden behind the bottom nav
              pb: isMobile ? '72px' : 0,
            }}
          >
            <Breadcrumb isVisible={!isSidebarCollapsed && !isMobile} />
            <Box p={4}>{children}</Box>
          </Box>
        </Stack>

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNavigation isSidebarOpen={isMobileMenuOpen} />}

        {/* About Modal */}
        <AboutModal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} />

        {/* Command Palette */}
        {isCommandPaletteOpen && (
          <Suspense fallback={null}>
            <CommandPalette
              isOpen={isCommandPaletteOpen}
              onClose={() => setIsCommandPaletteOpen(false)}
            />
          </Suspense>
        )}
      </Stack>
    </GuideModeProvider>
  );
};
