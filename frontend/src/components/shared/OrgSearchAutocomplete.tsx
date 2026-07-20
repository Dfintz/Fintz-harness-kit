import { useOrgSearch, type OrgSearchResult } from '@/hooks/queries/useRelationshipQueries';
import { apiClient } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import SearchIcon from '@mui/icons-material/Search';
import { Autocomplete, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';

export interface OrgSearchAutocompleteProps {
  readonly onSelect: (org: OrgSearchResult | null) => void;
  readonly selected: OrgSearchResult | null;
  readonly label?: string;
  readonly placeholder?: string;
  readonly helperText?: string;
  readonly textFieldSx?: SxProps<Theme>;
}

export const OrgSearchAutocomplete: React.FC<OrgSearchAutocompleteProps> = ({
  onSelect,
  selected,
  label = 'Target Organization',
  placeholder = 'Search organizations or enter RSI SID...',
  helperText,
  textFieldSx,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [rsiLookupLoading, setRsiLookupLoading] = useState(false);
  const { data: results = [], isLoading } = useOrgSearch(inputValue);

  const options = useMemo(() => {
    const opts: OrgSearchResult[] = [...results];
    if (inputValue.trim().length >= 2 && !isLoading && results.length === 0) {
      opts.push({
        id: `rsi:${inputValue.trim().toUpperCase()}`,
        name: `Look up "${inputValue.trim().toUpperCase()}" on RSI`,
        primaryFocus: 'rsi-lookup',
      });
    }
    return opts;
  }, [results, inputValue, isLoading]);

  const handleSelect = async (org: OrgSearchResult | null) => {
    if (!org) {
      onSelect(null);
      return;
    }

    if (org.id.startsWith('rsi:')) {
      const sid = org.id.replace('rsi:', '');
      setRsiLookupLoading(true);
      try {
        const response = await apiClient.get<{
          data?: { sid: string; name: string; memberCount?: number; logoUrl?: string };
          sid?: string;
          name?: string;
        }>(`/api/v2/rsi-crawler/organizations/${encodeURIComponent(sid)}`, { timeout: 10000 });
        const rsiOrg = response?.data?.data ?? response?.data;
        if (
          rsiOrg &&
          typeof rsiOrg === 'object' &&
          'name' in rsiOrg &&
          typeof rsiOrg.name === 'string'
        ) {
          const resolved = rsiOrg as {
            sid: string;
            name: string;
            memberCount?: number;
            logoUrl?: string;
          };
          onSelect({
            id: `rsi-org:${resolved.sid}`,
            name: `${resolved.name} (RSI: ${resolved.sid})`,
            memberCount: resolved.memberCount,
            logoUrl: resolved.logoUrl,
          });
        } else {
          onSelect({
            id: `rsi-org:${sid}`,
            name: `${sid} (RSI organization)`,
          });
        }
      } catch (err: unknown) {
        logger.error('RSI org lookup failed', err instanceof Error ? err : new Error(String(err)));
        onSelect({
          id: `rsi-org:${sid}`,
          name: `${sid} (RSI organization)`,
        });
      } finally {
        setRsiLookupLoading(false);
      }
    } else {
      onSelect(org);
    }
  };

  return (
    <Autocomplete<OrgSearchResult>
      value={selected}
      onChange={(_, newValue) => handleSelect(newValue)}
      inputValue={inputValue}
      onInputChange={(_, value) => setInputValue(value)}
      options={options}
      getOptionLabel={opt => opt.name}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      loading={isLoading || rsiLookupLoading}
      noOptionsText={inputValue.length < 2 ? 'Type to search...' : 'No organizations found'}
      filterOptions={x => x}
      renderOption={(props, opt) => (
        <Box component="li" {...props} key={opt.id}>
          {opt.primaryFocus === 'rsi-lookup' ? (
            <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>
              <SearchIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'text-bottom' }} />
              {opt.name}
            </Typography>
          ) : (
            <Stack>
              <Typography sx={{ fontWeight: 500 }}>{opt.name}</Typography>
              {opt.memberCount != null && (
                <Typography variant="caption" color="text.secondary">
                  {opt.memberCount} members
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      )}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          size="small"
          placeholder={placeholder}
          helperText={helperText}
          sx={textFieldSx}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {(isLoading || rsiLookupLoading) && <CircularProgress size={14} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};
