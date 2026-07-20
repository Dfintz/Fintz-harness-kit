/**
 * Help Center Page
 *
 * FAQ-based help page with 7 categories, expandable accordion items,
 * and real-time client-side search. Accessible at /help.
 *
 * Wave 1.3 — Part A: Frontend Help Center
 *
 * @module pages/HelpCenter
 */

import { faqCategories, searchFaqItems, type FaqCategory, type FaqItem } from '@/data/helpContent';
import {
  AccountBalance,
  AdminPanelSettings,
  BarChart,
  Close,
  Event,
  ExpandMore,
  Gavel,
  Groups,
  Handshake,
  HelpOutline,
  Map,
  MilitaryTech,
  RocketLaunch,
  Search,
  Security,
  SmartToy,
  Storefront,
  TrackChanges,
  TrendingUp,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  SvgIcon,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

// Custom Discord brand icon for the help category
const DiscordIcon = (
  <SvgIcon>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </SvgIcon>
);

// ── Icon mapping ────────────────────────────────────────────────────────
const iconMap: Record<string, React.ReactElement> = {
  AccountBalance: <AccountBalance />,
  AdminPanelSettings: <AdminPanelSettings />,
  BarChart: <BarChart />,
  Discord: DiscordIcon,
  Event: <Event />,
  Gavel: <Gavel />,
  Groups: <Groups />,
  Handshake: <Handshake />,
  HelpOutline: <HelpOutline />,
  Map: <Map />,
  MilitaryTech: <MilitaryTech />,
  RocketLaunch: <RocketLaunch />,
  Security: <Security />,
  SmartToy: <SmartToy />,
  Storefront: <Storefront />,
  TrackChanges: <TrackChanges />,
  TrendingUp: <TrendingUp />,
};

function getCategoryIcon(iconName: string): React.ReactElement {
  return iconMap[iconName] ?? <HelpOutline />;
}

// ── Component ───────────────────────────────────────────────────────────

export const HelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | false>(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Search results (client-side only)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchFaqItems(searchQuery);
  }, [searchQuery]);

  const handleCategoryToggle = useCallback(
    (categoryId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedCategory(isExpanded ? categoryId : false);
    },
    []
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <HelpOutline sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h4" component="h1" gutterBottom fontWeight={700}>
          Help Center
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Find answers to common questions about Fringe Core
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper
        elevation={2}
        sx={{
          mb: 4,
          p: 0.5,
          borderRadius: 2,
        }}
      >
        <TextField
          fullWidth
          placeholder='Search FAQ... (e.g. "fleet", "GDPR", "discord bot")'
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          variant="outlined"
          size={isMobile ? 'small' : 'medium'}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton onClick={handleClearSearch} size="small" aria-label="Clear search">
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          aria-label="Search frequently asked questions"
        />
      </Paper>

      {/* Search Results */}
      {isSearching && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            {(() => {
              if (!searchResults || searchResults.length === 0)
                return `No results for "${searchQuery}"`;
              const plural = searchResults.length === 1 ? '' : 's';
              return `${searchResults.length} result${plural} for "${searchQuery}"`;
            })()}
          </Typography>

          {searchResults && searchResults.length > 0 ? (
            searchResults.map(item => (
              <SearchResultCard key={item.id} item={item} query={searchQuery} />
            ))
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No matching FAQ items found. Try different keywords or browse the categories below.
            </Alert>
          )}
        </Box>
      )}

      {/* Category Accordions */}
      {!isSearching && (
        <Box>
          {faqCategories.map(category => (
            <CategoryAccordion
              key={category.id}
              category={category}
              expanded={expandedCategory === category.id}
              onChange={handleCategoryToggle(category.id)}
              isMobile={isMobile}
            />
          ))}
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ textAlign: 'center', mt: 4, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Can&apos;t find what you&apos;re looking for? Use{' '}
          <Typography component="span" variant="body2" color="primary.main" fontWeight={600}>
            /help
          </Typography>{' '}
          in Discord or contact your organization admin.
        </Typography>
      </Box>
    </Container>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────

interface CategoryAccordionProps {
  category: FaqCategory;
  expanded: boolean;
  onChange: (event: React.SyntheticEvent, isExpanded: boolean) => void;
  isMobile: boolean;
}

const CategoryAccordion: React.FC<CategoryAccordionProps> = React.memo(
  ({ category, expanded, onChange, isMobile }) => (
    <Accordion
      expanded={expanded}
      onChange={onChange}
      elevation={expanded ? 3 : 1}
      sx={{
        mb: 1.5,
        borderRadius: '8px !important',
        '&::before': { display: 'none' },
        transition: theme => theme.transitions.create('box-shadow', { duration: 200 }),
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        aria-controls={`${category.id}-content`}
        id={`${category.id}-header`}
        sx={{ py: 0.5 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            {getCategoryIcon(category.icon)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight={600}>
              {category.title}
            </Typography>
            {!isMobile && (
              <Typography variant="body2" color="text.secondary">
                {category.description}
              </Typography>
            )}
          </Box>
          <Chip
            label={`${category.items.length}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {category.items.map(item => (
          <FaqItemCard key={item.id} item={item} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
);

CategoryAccordion.displayName = 'CategoryAccordion';

interface FaqItemCardProps {
  item: FaqItem;
}

const FaqItemCard: React.FC<FaqItemCardProps> = React.memo(({ item }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2,
      mb: 1,
      borderRadius: 1.5,
      '&:last-child': { mb: 0 },
    }}
  >
    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
      {item.question}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
      {item.answer}
    </Typography>
  </Paper>
));

FaqItemCard.displayName = 'FaqItemCard';

interface SearchResultCardProps {
  item: FaqItem & { categoryTitle: string };
  query: string;
}

const SearchResultCard: React.FC<SearchResultCardProps> = React.memo(({ item, query }) => {
  // Highlight matching text
  const highlightText = (text: string): React.ReactNode => {
    if (!query.trim()) return text;
    const escaped = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map(part =>
      regex.test(part) ? (
        <Box
          component="mark"
          key={`hl-${part}-${text.indexOf(part)}`}
          sx={{ bgcolor: 'warning.light', borderRadius: 0.5, px: 0.25 }}
        >
          {part}
        </Box>
      ) : (
        part
      )
    );
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        borderLeft: 3,
        borderLeftColor: 'primary.main',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Chip label={item.categoryTitle} size="small" variant="outlined" />
      </Box>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        {highlightText(item.question)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {highlightText(item.answer)}
      </Typography>
    </Paper>
  );
});

SearchResultCard.displayName = 'SearchResultCard';

// ── Error Boundary Wrapper ──────────────────────────────────────────────

export const HelpCenterWithErrorBoundary: React.FC = () => {
  // Simple wrapper — FeatureErrorBoundary can be added later if needed
  return <HelpCenter />;
};
