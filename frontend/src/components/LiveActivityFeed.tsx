import { scColors } from '@/components/ui/tokens';
import type { ActivityEvent, FleetEvent, TradingEvent, User } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';
import {
  ViewList as BoxList,
  Campaign,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Filter as FilterIcon,
  Search as SearchIcon,
  ShoppingCart,
  Star as StarIcon,
  StarOutline as StarOutlineIcon,
} from '@mui/icons-material';
import { Button, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EventDetailModal } from './EventDetailModal';
import { IconButton } from './ui';

interface LiveActivityFeedProps {
  fleetEvents?: FleetEvent[];
  activityEvents?: ActivityEvent[];
  tradingEvents?: TradingEvent[];
  autoScroll?: boolean;
  /** Maximum height of the scrollable feed area. Defaults to '600px'. */
  maxHeight?: string;
}

type CombinedEvent = {
  id: string;
  timestamp: number;
  type: string;
  category: 'fleet' | 'activity' | 'trading';
  title: string;
  description: string;
  icon: React.ComponentType<{ sx?: Record<string, unknown> }>;
  color: string;
  rawData?: Record<string, unknown>;
  userId?: string;
  user?: User;
};

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({
  fleetEvents = [],
  activityEvents = [],
  tradingEvents = [],
  autoScroll = true,
  maxHeight = '600px',
}) => {
  const theme = useTheme();
  const feedRef = useRef<HTMLDivElement>(null);
  const previousLengthRef = useRef(0);

  // State for filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'fleet' | 'activity' | 'trading'>(
    'all'
  );
  const [selectedEvent, setSelectedEvent] = useState<CombinedEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Additional filters
  const [dateRange, setDateRange] = useState<'all' | 'hour' | 'today' | 'week' | 'month'>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'category'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Bookmarks (persisted in localStorage with max-count enforcement)
  const MAX_BOOKMARKS = 200;
  const [bookmarkedEvents, setBookmarkedEvents] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('bookmarkedEvents');
      if (!saved) return new Set();
      const parsed: string[] = JSON.parse(saved);
      if (parsed.length > MAX_BOOKMARKS) {
        const trimmed = parsed.slice(-MAX_BOOKMARKS);
        localStorage.setItem('bookmarkedEvents', JSON.stringify(trimmed));
        return new Set(trimmed);
      }
      return new Set(parsed);
    } catch {
      return new Set();
    }
  });
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);

  // Combine all events
  const allEvents = useMemo(() => {
    return [
      ...fleetEvents.map(event => formatFleetEvent(event)),
      ...activityEvents.map(event => formatActivityEvent(event)),
      ...tradingEvents.map(event => formatTradingEvent(event)),
    ].sort((a, b) => b.timestamp - a.timestamp);
  }, [fleetEvents, activityEvents, tradingEvents]);

  // Get all unique event types
  const allEventTypes = useMemo(() => {
    const types = new Set<string>();
    allEvents.forEach(e => types.add(e.type));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  // Filter and search events
  const filteredEvents = useMemo(() => {
    let events = allEvents;

    // Apply category filter
    if (categoryFilter !== 'all') {
      events = events.filter(e => e.category === categoryFilter);
    }

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const ranges = {
        hour: 60 * 60 * 1000,
        today: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - ranges[dateRange];
      events = events.filter(e => e.timestamp >= cutoff);
    }

    // Apply event type filter
    if (eventTypeFilter.size > 0) {
      events = events.filter(e => eventTypeFilter.has(e.type));
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      events = events.filter(
        e =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.type.toLowerCase().includes(query)
      );
    }

    // Apply bookmarks filter
    if (showOnlyBookmarked) {
      events = events.filter(e => bookmarkedEvents.has(e.id));
    }

    // Apply sorting
    if (sortBy === 'oldest') {
      events = [...events].sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'category') {
      events = [...events].sort((a, b) => {
        if (a.category === b.category) {
          return b.timestamp - a.timestamp;
        }
        return a.category.localeCompare(b.category);
      });
    }
    // 'newest' is already sorted by default

    return events;
  }, [
    allEvents,
    categoryFilter,
    dateRange,
    eventTypeFilter,
    searchQuery,
    showOnlyBookmarked,
    bookmarkedEvents,
    sortBy,
  ]);

  // Paginated events
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredEvents.slice(startIndex, endIndex);
  }, [filteredEvents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, dateRange, eventTypeFilter, searchQuery, showOnlyBookmarked, sortBy]);

  const combinedEvents = paginatedEvents;

  useEffect(() => {
    if (autoScroll && feedRef.current && allEvents.length > previousLengthRef.current) {
      feedRef.current.scrollTop = 0;
    }
    previousLengthRef.current = allEvents.length;
  }, [allEvents.length, autoScroll]);

  // Save bookmarks to localStorage (enforcing max count)
  useEffect(() => {
    const arr = Array.from(bookmarkedEvents);
    const toSave = arr.length > MAX_BOOKMARKS ? arr.slice(-MAX_BOOKMARKS) : arr;
    localStorage.setItem('bookmarkedEvents', JSON.stringify(toSave));
  }, [bookmarkedEvents]);

  const handleEventClick = (event: CombinedEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Category', 'Type', 'Title', 'Description'];
    const rows = combinedEvents.map(e => [
      new Date(e.timestamp).toISOString(),
      e.category,
      e.type,
      e.title,
      e.description,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    // CWE-79: Validate blob URL before DOM assignment
    if (!url?.startsWith('blob:')) {
      logger.error('Invalid blob URL generated');
      URL.revokeObjectURL(url);
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-feed-${Date.now()}.csv`;
    a.rel = 'noopener noreferrer';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(combinedEvents, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // CWE-79: Validate blob URL before DOM assignment
    if (!url?.startsWith('blob:')) {
      logger.error('Invalid blob URL generated');
      URL.revokeObjectURL(url);
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-feed-${Date.now()}.json`;
    a.rel = 'noopener noreferrer';
    a.click();
    URL.revokeObjectURL(url);
  };

  const _getCategoryFilterLabel = () => {
    if (categoryFilter === 'all') return 'All Categories';
    return categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1);
  };

  const _getDateRangeLabel = () => {
    const labels = {
      all: 'All Time',
      hour: 'Last Hour',
      today: 'Today',
      week: 'Last 7 Days',
      month: 'Last 30 Days',
    };
    return labels[dateRange];
  };

  const _getSortLabel = () => {
    const labels = {
      newest: 'Newest First',
      oldest: 'Oldest First',
      category: 'By Category',
    };
    return labels[sortBy];
  };

  const toggleBookmark = (eventId: string) => {
    setBookmarkedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const _toggleEventType = (type: string) => {
    setEventTypeFilter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  return (
    <>
      <EventDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        event={selectedEvent}
      />

      <Paper elevation={1} sx={{ padding: 2 }}>
        {/* Toolbar with search, filter, and export */}
        <Stack direction="column" spacing={2} mb={2}>
          {/* Row 1: Search and main filters */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {/* Search */}
            <TextField
              label="Search events"
              placeholder="Search by title, description, or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flexGrow: 1, minWidth: 250 }}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
                },
              }}
            />

            {/* Category Filter */}
            <Select<typeof categoryFilter>
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="fleet">Fleet</MenuItem>
              <MenuItem value="activity">Activity</MenuItem>
              <MenuItem value="trading">Trading</MenuItem>
            </Select>

            {/* Date Range Filter */}
            <Select<typeof dateRange>
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="hour">Last Hour</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
            </Select>

            {/* Event Type Filter */}
            <Select
              multiple
              displayEmpty
              value={Array.from(eventTypeFilter)}
              onChange={e =>
                setEventTypeFilter(
                  new Set(typeof e.target.value === 'string' ? [e.target.value] : e.target.value)
                )
              }
              size="small"
              sx={{ minWidth: 150 }}
              renderValue={(selected: string[]) =>
                selected.length > 0 ? `Type (${selected.length})` : 'Event Type'
              }
            >
              {allEventTypes.map(type => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          {/* Row 2: Sort and bookmarks */}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            {/* Sort */}
            <Select<typeof sortBy>
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="newest">Newest First</MenuItem>
              <MenuItem value="oldest">Oldest First</MenuItem>
              <MenuItem value="category">By Category</MenuItem>
            </Select>

            {/* Bookmarks Toggle */}
            <Button
              variant={showOnlyBookmarked ? 'contained' : 'outlined'}
              onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
              startIcon={
                showOnlyBookmarked ? (
                  <StarIcon sx={{ color: 'warning.main' }} />
                ) : (
                  <StarOutlineIcon />
                )
              }
              size="small"
            >
              Bookmarked{bookmarkedEvents.size > 0 ? ` (${bookmarkedEvents.size})` : ''}
            </Button>

            {/* Export Buttons */}
            <Button
              variant="outlined"
              onClick={handleExportCSV}
              size="small"
              disabled={combinedEvents.length === 0}
            >
              CSV
            </Button>
            <Button
              variant="outlined"
              onClick={handleExportJSON}
              size="small"
              disabled={combinedEvents.length === 0}
            >
              JSON
            </Button>
          </Stack>
        </Stack>

        {/* Result count and pagination info */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography>
            {filteredEvents.length > 0
              ? `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredEvents.length)} of ${filteredEvents.length} events`
              : 'No events'}
          </Typography>

          {/* Items per page selector */}
          {filteredEvents.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Items per page:</Typography>
              <Select
                value={itemsPerPage}
                onChange={e => setItemsPerPage(Number(e.target.value))}
                size="small"
                sx={{ minWidth: 80 }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </Stack>
          )}
        </Stack>

        {/* Empty state */}
        {combinedEvents.length === 0 && (
          <Stack direction="column" alignItems="center" spacing={2} sx={{ padding: '40px 20px' }}>
            <FilterIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
            <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
              {searchQuery || categoryFilter !== 'all'
                ? 'No events match your filters'
                : 'No recent activity'}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', textAlign: 'center' }}>
              {searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Live updates will appear here as events occur'}
            </Typography>
          </Stack>
        )}

        {/* Event list */}
        {combinedEvents.length > 0 && (
          <div
            ref={feedRef}
            style={{
              maxHeight,
              overflowY: 'auto',
              scrollBehavior: 'smooth',
            }}
          >
            <Stack direction="column" spacing={1.5}>
              {combinedEvents.map((event, index) => (
                <button
                  key={event.id}
                  type="button"
                  style={{
                    padding: '12px',
                    borderLeft: `3px solid ${event.color}`,
                    backgroundColor:
                      index === 0 ? alpha(theme.palette.primary.main, 0.05) : 'transparent',
                    borderRadius: '4px',
                    transition: theme.transitions.create('background-color', { duration: 300 }),
                    animation: index === 0 ? 'fadeIn 0.5s ease-out' : 'none',
                    cursor: 'pointer',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                  }}
                  onClick={() => handleEventClick(event)}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = alpha(theme.palette.common.white, 0.05);
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor =
                      index === 0 ? alpha(theme.palette.primary.main, 0.05) : 'transparent';
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="start">
                    {/* User Avatar (if available) or Event Icon */}
                    {event.user ? (
                      <div
                        style={{
                          position: 'relative',
                          flexShrink: 0,
                        }}
                      >
                        {event.user.avatar && sanitizeImageUrl(event.user.avatar) ? (
                          <img
                            src={sanitizeImageUrl(event.user.avatar) || ''}
                            alt={(
                              event.user.displayName ||
                              event.user.username ||
                              'User'
                            ).replaceAll(/[<>"']/g, '')}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: event.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: theme.palette.common.black,
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          >
                            {(event.user.displayName || event.user.username)
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                        )}
                        {/* Small icon overlay */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: alpha(theme.palette.common.black, 0.8),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                          }}
                        >
                          {React.createElement(event.icon, {
                            sx: { color: event.color, fontSize: '0.75rem' },
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: alpha(theme.palette.common.black, 0.3),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {React.createElement(event.icon, {
                          sx: { color: event.color, fontSize: '1rem' },
                        })}
                      </div>
                    )}

                    <Stack direction="column" spacing={0.5} sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="start">
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            flex: 1,
                          }}
                        >
                          {event.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {getTimeAgo(event.timestamp)}
                        </Typography>
                      </Stack>

                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          lineHeight: 1.4,
                        }}
                      >
                        {event.description}
                      </Typography>

                      <div
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: `${event.color}20`,
                          fontSize: '0.7rem',
                          color: event.color,
                          alignSelf: 'Stack-start',
                          marginTop: '4px',
                        }}
                      >
                        {event.category}
                      </div>
                    </Stack>

                    {/* Bookmark button — span stops click propagation to parent button */}
                    <span onClick={e => e.stopPropagation()}>
                      <IconButton
                        tooltip={
                          bookmarkedEvents.has(event.id) ? 'Remove bookmark' : 'Add bookmark'
                        }
                        isQuiet
                        onClick={() => toggleBookmark(event.id)}
                        sx={{ marginLeft: 'auto', StackShrink: 0 }}
                      >
                        {bookmarkedEvents.has(event.id) ? (
                          <StarIcon sx={{ color: 'warning.main' }} />
                        ) : (
                          <StarOutlineIcon />
                        )}
                      </IconButton>
                    </span>
                  </Stack>
                </button>
              ))}
            </Stack>
            <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes fadeIn {
              from, to { opacity: 1; transform: none; }
            }
          }
        `}</style>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredEvents.length > itemsPerPage && (
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} mt={2}>
            <Button
              variant="outlined"
              size="small"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              startIcon={<ChevronLeftIcon />}
            >
              Previous
            </Button>

            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Page</Typography>
              <Typography sx={{ fontWeight: 'bold' }}>{currentPage}</Typography>
              <Typography>of</Typography>
              <Typography sx={{ fontWeight: 'bold' }}>{totalPages}</Typography>
            </Stack>

            <Button
              variant="outlined"
              size="small"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              endIcon={<ChevronRightIcon />}
            >
              Next
            </Button>
          </Stack>
        )}
      </Paper>
    </>
  );
};

// Format fleet events
function formatFleetEvent(event: FleetEvent, user?: User): CombinedEvent {
  const eventTypeMap: Record<string, { title: string; description: string }> = {
    'fleet:created': {
      title: 'Fleet Created',
      description: `New fleet "${event.data?.name || 'Unknown'}" has been created`,
    },
    'fleet:updated': {
      title: 'Fleet Updated',
      description: `Fleet "${event.data?.name || 'Unknown'}" has been updated`,
    },
    'fleet:deleted': {
      title: 'Fleet Deleted',
      description: `Fleet has been removed`,
    },
    'fleet:ship_added': {
      title: 'Ship Added to Fleet',
      description: `A ship was added to fleet "${event.data?.fleetName || 'Unknown'}"`,
    },
    'fleet:ship_removed': {
      title: 'Ship Removed from Fleet',
      description: `A ship was removed from fleet "${event.data?.fleetName || 'Unknown'}"`,
    },
  };

  const mapped = eventTypeMap[event.type] || {
    title: 'Fleet Event',
    description: 'A fleet event occurred',
  };

  return {
    id: `${event.type}-${event.timestamp}`,
    timestamp: event.timestamp,
    type: event.type,
    category: 'fleet',
    title: mapped.title,
    description: mapped.description,
    icon: BoxList,
    color: scColors.info,
    rawData: event as unknown as Record<string, unknown>,
    userId: event.userId,
    user,
  };
}

// Format activity events
function formatActivityEvent(event: ActivityEvent, user?: User): CombinedEvent {
  const eventTypeMap: Record<string, { title: string; description: string }> = {
    'activity:created': {
      title: 'Activity Created',
      description: `New activity "${event.data?.title || 'Unknown'}" has been scheduled`,
    },
    'activity:updated': {
      title: 'Activity Updated',
      description: `Activity "${event.data?.title || 'Unknown'}" has been updated`,
    },
    'activity:deleted': {
      title: 'Activity Deleted',
      description: `Activity has been cancelled`,
    },
    'activity:participant_joined': {
      title: 'Participant Joined',
      description: `A member joined "${event.data?.activityTitle || 'activity'}"`,
    },
    'activity:participant_left': {
      title: 'Participant Left',
      description: `A member left "${event.data?.activityTitle || 'activity'}"`,
    },
    'activity:status_changed': {
      title: 'Activity Status Changed',
      description: `Activity status changed to ${event.data?.newStatus || 'unknown'}`,
    },
    'activity:reminder': {
      title: 'Activity Reminder',
      description: `Upcoming activity: "${event.data?.title || 'Unknown'}"`,
    },
  };

  const mapped = eventTypeMap[event.type] || {
    title: 'Activity Event',
    description: 'An activity event occurred',
  };

  return {
    id: `${event.type}-${event.timestamp}`,
    timestamp: event.timestamp,
    type: event.type,
    category: 'activity',
    title: mapped.title,
    description: mapped.description,
    icon: Campaign,
    color: scColors.success,
    rawData: event as unknown as Record<string, unknown>,
    userId: event.userId,
    user,
  };
}

// Format trading events
function formatTradingEvent(event: TradingEvent, user?: User): CombinedEvent {
  const eventTypeMap: Record<string, { title: string; description: string }> = {
    'trading:route_created': {
      title: 'Trading Route Created',
      description: `New route from ${event.data?.origin || 'unknown'} to ${event.data?.destination || 'unknown'}`,
    },
    'trading:route_updated': {
      title: 'Route Updated',
      description: `Trading route has been updated`,
    },
    'trading:route_deleted': {
      title: 'Route Deleted',
      description: `Trading route has been removed`,
    },
    'trading:route_status_changed': {
      title: 'Route Status Changed',
      description: `Route status changed to ${event.data?.newStatus || 'unknown'}`,
    },
    'trading:opportunity_discovered': {
      title: 'New Opportunity Discovered!',
      description: (() => {
        const profitDesc = event.data?.profitPerUnit
          ? `${event.data.profitPerUnit} aUEC/unit`
          : 'Good profit margin';
        return `Profitable route found: ${profitDesc}`;
      })(),
    },
    'trading:market_updated': {
      title: 'Market Data Updated',
      description: `Market prices updated for ${event.data?.location || 'multiple locations'}`,
    },
    'trading:price_changed': {
      title: 'Price Alert',
      description: `${event.data?.commodity || 'Commodity'} price changed at ${event.data?.location || 'market'}`,
    },
  };

  const mapped = eventTypeMap[event.type] || {
    title: 'Trading Event',
    description: 'A trading event occurred',
  };

  return {
    id: `${event.type}-${event.timestamp}`,
    timestamp: event.timestamp,
    type: event.type,
    category: 'trading',
    title: mapped.title,
    description: mapped.description,
    icon: ShoppingCart,
    color: scColors.warning,
    rawData: event as unknown as Record<string, unknown>,
    userId: event.userId,
    user,
  };
}

// Format timestamp as relative time
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
