/**
 * Hero Section
 *
 * Landing page hero with animated star-field background,
 * "Fringe Core" branding, tagline, and CTA buttons.
 */

import { DISCORD_BLUE, DISCORD_BLUE_HOVER } from '@/utils/brandColors';
import ExploreIcon from '@mui/icons-material/Explore';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha, darken, lighten, useTheme } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HeroSection.css';

const STAR_COUNT = 120;
const SHOOTING_STAR_INTERVAL = 4000;

export const HeroSection: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastShootingStar = 0;
    let shootingStar: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
    } | null = null;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars — Math.random() is intentional for cosmetic canvas animations (NOSONAR)
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * canvas.width, // NOSONAR
      y: Math.random() * canvas.height, // NOSONAR
      radius: Math.random() * 1.5 + 0.5, // NOSONAR
      alpha: Math.random() * 0.8 + 0.2, // NOSONAR
      speed: Math.random() * 0.3 + 0.05, // NOSONAR
      twinkleSpeed: Math.random() * 0.02 + 0.005, // NOSONAR
      twinkleDir: 1,
    }));

    const draw = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw stars
      for (const star of stars) {
        star.alpha += star.twinkleSpeed * star.twinkleDir;
        if (star.alpha >= 1) star.twinkleDir = -1;
        if (star.alpha <= 0.2) star.twinkleDir = 1;
        star.y += star.speed;
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width; // NOSONAR
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${star.alpha})`;
        ctx.fill();
      }

      // Shooting star
      if (timestamp - lastShootingStar > SHOOTING_STAR_INTERVAL && !shootingStar) {
        lastShootingStar = timestamp;
        shootingStar = {
          x: Math.random() * canvas.width * 0.5, // NOSONAR
          y: Math.random() * canvas.height * 0.3, // NOSONAR
          vx: 6 + Math.random() * 4, // NOSONAR
          vy: 2 + Math.random() * 2, // NOSONAR
          life: 0,
          maxLife: 60,
        };
      }
      if (shootingStar) {
        shootingStar.x += shootingStar.vx;
        shootingStar.y += shootingStar.vy;
        shootingStar.life++;
        const progress = shootingStar.life / shootingStar.maxLife;
        const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(shootingStar.x - shootingStar.vx * 8, shootingStar.y - shootingStar.vy * 8);
        const gradient = ctx.createLinearGradient(
          shootingStar.x,
          shootingStar.y,
          shootingStar.x - shootingStar.vx * 8,
          shootingStar.y - shootingStar.vy * 8
        );
        gradient.addColorStop(0, `rgba(0, 217, 255, ${alpha})`);
        gradient.addColorStop(1, 'rgba(0, 217, 255, 0)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (shootingStar.life >= shootingStar.maxLife) {
          shootingStar = null;
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: { xs: '100vh', md: '90vh' },
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        py: { xs: 10, md: 12 },
        background: `linear-gradient(135deg, ${darken(theme.palette.background.default, 0.5)} 0%, ${theme.palette.background.default} 50%, ${theme.palette.background.paper} 100%)`,
      }}
    >
      {/* Star-field canvas */}
      <canvas ref={canvasRef} className="hero-starfield-canvas" />

      {/* Pulsing radial glow (matches login page) */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          pointerEvents: 'none',
          animation: 'heroGlowPulse 4s ease-in-out infinite',
          '@keyframes heroGlowPulse': {
            '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.5 },
            '50%': { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0.8 },
          },
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
          },
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* Logo Image */}
        {logoLoadError ? (
          <Box
            role="presentation"
            aria-hidden="true"
            sx={{
              width: { xs: 80, sm: 100, md: 120 },
              height: { xs: 80, sm: 100, md: 120 },
              mb: 3,
              mx: 'auto',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${theme.palette.primary.main} 0%, ${darken(theme.palette.primary.main, 0.4)} 70%, transparent 100%)`,
              boxShadow: `0 0 40px ${alpha(theme.palette.primary.main, 0.6)}, inset 0 0 20px ${alpha(theme.palette.primary.main, 0.4)}`,
            }}
          />
        ) : (
          <Box
            component="img"
            src="/fringecore.png"
            alt="Fringe Core Logo"
            onError={() => setLogoLoadError(true)}
            sx={{
              width: { xs: 80, sm: 100, md: 120 },
              height: { xs: 80, sm: 100, md: 120 },
              mb: 3,
              filter: `drop-shadow(0 0 20px ${alpha(theme.palette.primary.main, 0.6)})`,
              mx: 'auto',
              display: 'block',
            }}
          />
        )}

        {/* Branding */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
            fontWeight: 800,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${lighten(theme.palette.primary.main, 0.2)} 50%, ${theme.palette.warning.main} 100%)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb: 2,
            pb: '0.15em',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            overflow: 'visible',
          }}
        >
          Fringe Core
        </Typography>

        {/* Tagline */}
        <Typography
          sx={{
            color: theme.palette.primary.main,
            fontSize: { xs: '0.8rem', sm: '0.9rem', md: '0.95rem' },
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            mb: 3,
            opacity: 0.9,
          }}
        >
          One Core, Infinite Possibilities
        </Typography>

        <Typography
          variant="h5"
          sx={{
            color: alpha(theme.palette.common.white, 0.7),
            fontSize: { xs: '1rem', sm: '1.15rem', md: '1.3rem' },
            mb: 2,
            fontWeight: 400,
            maxWidth: 600,
            mx: 'auto',
          }}
        >
          The All-in-One Platform for Star Citizen Organizations
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: alpha(theme.palette.common.white, 0.45),
            mb: { xs: 3, md: 4 },
            maxWidth: 520,
            mx: 'auto',
            lineHeight: 1.7,
          }}
        >
          Manage fleets, run operations, post bounties, plan trade routes, coordinate with tactical
          briefings, and lead your org — all backed by zero-trust security and real-time
          collaboration.
        </Typography>

        {/* CTAs */}
        <Stack
          direction="row"
          spacing={2.5}
          justifyContent="center"
          alignItems="center"
          sx={{ mx: 'auto', mt: 1 }}
        >
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              px: { xs: 3.5, md: 5 },
              py: 0,
              fontSize: { xs: '0.8rem', md: '0.9rem' },
              fontWeight: 700,
              borderRadius: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              height: { xs: 46, md: 52 },
              background: `linear-gradient(135deg, ${DISCORD_BLUE} 0%, ${DISCORD_BLUE_HOVER} 100%)`,
              border: `2px solid ${alpha(DISCORD_BLUE, 0.6)}`,
              boxShadow: `0 4px 12px ${alpha(DISCORD_BLUE, 0.4)}`,
              width: { xs: '100%', sm: 195, md: 220 },
              '&:hover': {
                background: `linear-gradient(135deg, ${DISCORD_BLUE_HOVER} 0%, ${DISCORD_BLUE} 100%)`,
                borderColor: alpha(DISCORD_BLUE, 0.8),
                boxShadow: `0 0 20px ${alpha(DISCORD_BLUE, 0.5)}`,
                transform: 'translateY(-2px)',
              },
              transition: theme.transitions.create('all', { duration: 300 }),
            }}
          >
            Get Started
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<ExploreIcon />}
            onClick={() => navigate('/directory')}
            sx={{
              px: { xs: 3.5, md: 5 },
              py: 0,
              fontSize: { xs: '0.8rem', md: '0.9rem' },
              fontWeight: 700,
              borderRadius: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              height: { xs: 46, md: 52 },
              borderWidth: 2,
              borderColor: alpha(theme.palette.primary.main, 0.5),
              color: theme.palette.primary.main,
              width: { xs: '100%', sm: 195, md: 220 },
              boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
              '&:hover': {
                borderColor: theme.palette.primary.main,
                borderWidth: 2,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                transform: 'translateY(-2px)',
              },
              transition: theme.transitions.create('all', { duration: 300 }),
            }}
          >
            Explore Orgs
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};
