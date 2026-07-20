/**
 * Public Navigation Bar
 *
 * Sticky, translucent AppBar for public-facing pages (landing, directory, login).
 * Auth-aware: shows "Dashboard" for authenticated users, "Sign In" otherwise.
 * Responsive: hamburger drawer on mobile.
 *
 * @module components/layout/PublicNavBar
 */

import { selectIsAuthenticated, useAuthStore } from '@/store/authStore';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Slide,
  Toolbar,
  Typography,
  useScrollTrigger,
} from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  label: string;
  href: string;
  /** If true, uses smooth scroll to an anchor on the landing page */
  isAnchor?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Features', href: '#features', isAnchor: true },
  { label: 'How It Works', href: '#how-it-works', isAnchor: true },
  { label: 'Directory', href: '/directory' },
];

/**
 * Hide-on-scroll wrapper for the AppBar
 */
function HideOnScroll({ children }: Readonly<{ children: React.ReactElement }>) {
  const trigger = useScrollTrigger({ threshold: 100 });
  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

export const PublicNavBar: React.FC = () => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollTrigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 50,
  });

  const handleNavClick = useCallback(
    (item: NavItem) => {
      setDrawerOpen(false);

      if (item.isAnchor) {
        // If we're on the landing page, smooth-scroll to anchor
        if (location.pathname === '/' || location.pathname === '/welcome') {
          const id = item.href.replace('#', '');
          const element = document.getElementById(id);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else {
          // Navigate to landing page with anchor
          navigate(`/${item.href}`);
        }
      } else {
        navigate(item.href);
      }
    },
    [location.pathname, navigate]
  );

  const handleCTA = useCallback(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return (
    <>
      <HideOnScroll>
        <AppBar
          position="fixed"
          elevation={scrollTrigger ? 4 : 0}
          sx={{
            background: scrollTrigger
              ? alpha(theme.palette.background.default, 0.95)
              : alpha(theme.palette.background.default, 0.6),
            backdropFilter: 'blur(20px)',
            borderBottom: scrollTrigger
              ? `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
              : '1px solid transparent',
            transition: theme.transitions.create('all', { duration: 300 }),
          }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ minHeight: { xs: 56, md: 64 } }}>
              {/* Logo */}
              <Box
                component={RouterLink}
                to="/"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                  mr: 4,
                }}
              >
                {logoLoadError ? (
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 32,
                      height: 32,
                      mr: 1,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 700,
                      color: theme.palette.common.white,
                    }}
                  >
                    FC
                  </Box>
                ) : (
                  <Box
                    component="img"
                    src="/fringecore.png"
                    alt="Fringe Core Logo"
                    onError={() => setLogoLoadError(true)}
                    sx={{
                      width: 32,
                      height: 32,
                      mr: 1,
                      filter: `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.5)})`,
                    }}
                  />
                )}
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                    fontSize: { xs: '1rem', md: '1.15rem' },
                  }}
                >
                  Fringe Core
                </Typography>
              </Box>

              {/* Desktop nav links */}
              <Box
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 1,
                  flexGrow: 1,
                }}
              >
                {NAV_ITEMS.map(item => (
                  <Button
                    key={item.label}
                    onClick={() => handleNavClick(item)}
                    sx={{
                      color: alpha(theme.palette.common.white, 0.8),
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.9rem',
                      px: 2,
                      '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>

              {/* Desktop CTA */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={handleCTA}
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${darken(theme.palette.primary.main, 0.4)} 100%)`,
                    color: theme.palette.background.default,
                    fontWeight: 600,
                    textTransform: 'none',
                    px: 3,
                    borderRadius: 2,
                    '&:hover': {
                      background: `linear-gradient(135deg, ${lighten(theme.palette.primary.main, 0.2)} 0%, ${darken(theme.palette.primary.main, 0.15)} 100%)`,
                      boxShadow: `0 0 20px ${alpha(theme.palette.primary.main, 0.3)}`,
                    },
                  }}
                >
                  {isAuthenticated ? 'Dashboard' : 'Sign In'}
                </Button>
              </Box>

              {/* Mobile hamburger */}
              <IconButton
                edge="end"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation menu"
                sx={{
                  display: { md: 'none' },
                  ml: 'auto',
                  color: theme.palette.primary.main,
                }}
              >
                <MenuIcon />
              </IconButton>
            </Toolbar>
          </Container>
        </AppBar>
      </HideOnScroll>

      {/* Toolbar spacer */}
      <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }} />

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 280,
            background: alpha(theme.palette.background.default, 0.98),
            backdropFilter: 'blur(20px)',
            borderLeft: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Fringe Core
          </Typography>
          <IconButton
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation menu"
            sx={{ color: alpha(theme.palette.common.white, 0.7) }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: alpha(theme.palette.primary.main, 0.1) }} />

        <List sx={{ px: 1, py: 2 }}>
          {NAV_ITEMS.map(item => (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                onClick={() => handleNavClick(item)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: alpha(theme.palette.common.white, 0.85),
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ borderColor: alpha(theme.palette.primary.main, 0.1) }} />

        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              setDrawerOpen(false);
              handleCTA();
            }}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${darken(theme.palette.primary.main, 0.4)} 100%)`,
              color: theme.palette.background.default,
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
            }}
          >
            {isAuthenticated ? 'Dashboard' : 'Sign In'}
          </Button>
        </Box>
      </Drawer>
    </>
  );
};
