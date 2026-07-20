import { FleetViewImportResult, fleetViewService } from '@/services/fleetViewService';
import { logger } from '@/utils/logger';
import CheckmarkCircleIcon from '@mui/icons-material/CheckCircle';
import UploadToCloudIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import AlertIcon from '@mui/icons-material/Warning';
import { Box, Button, Checkbox, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useRef, useState } from 'react';

interface FleetBoxImportExportProps {
  organizationId?: string;
  isOrgLead?: boolean;
  onImportComplete?: () => void;
}

/**
 * Component for importing/exporting fleet data in FleetBox format
 * Compatible with hangar.link/fleet/canvas
 */
export const FleetBoxImportExport: React.FC<FleetBoxImportExportProps> = ({
  organizationId,
  isOrgLead = false,
  onImportComplete,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<FleetViewImportResult | null>(null);
  const [includeStatistics, setIncludeStatistics] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [merge, setMerge] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      let schema;
      if (organizationId && isOrgLead) {
        schema = await fleetViewService.exportOrgFleet(organizationId, {
          includeStatistics,
          includeInactive,
        });
      } else {
        schema = await fleetViewService.exportUserFleet({
          includeStatistics,
          includeInactive,
        });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename =
        organizationId && isOrgLead ? `org-fleet-${timestamp}.json` : `my-fleet-${timestamp}.json`;

      fleetViewService.downloadFleetViewFile(schema, filename);
    } catch (err) {
      logger.error('Export failed:', err, new Error('Export failed:', { cause: err }));
      setError('Failed to export fleet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setError('Please select a JSON file');
      return;
    }

    setLoading(true);
    setError(null);
    setImportResult(null);

    try {
      // Validate schema first
      const validation = await fleetViewService.validateSchema(file);

      if (!validation.valid) {
        setError(validation.error || 'Invalid FleetBox file format');
        setLoading(false);
        return;
      }

      // Import the file
      let result;
      if (organizationId && isOrgLead) {
        result = await fleetViewService.importOrgFleet(organizationId, file, {
          merge,
          skipDuplicates,
        });
      } else {
        result = await fleetViewService.importUserFleet(file, {
          merge,
          skipDuplicates,
        });
      }

      setImportResult(result);

      if (result.success && onImportComplete) {
        onImportComplete();
      }
    } catch (err: unknown) {
      logger.error('Import failed:', err, new Error('Import failed:', { cause: err }));
      setError((err as any).response?.data?.error || 'Failed to import fleet. Please try again.');
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="column" spacing={2}>
        <Typography variant="h6">FleetBox Import/Export</Typography>
        <Typography variant="body2">
          Import or export your fleet in FleetBox format, compatible with{' '}
          <a
            href="https://hangar.link/fleet/canvas"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.palette.primary.main }}
          >
            hangar.link/fleet/canvas
          </a>
        </Typography>

        <Divider />

        {/* Export Section */}
        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Stack direction="column" spacing={1.5}>
            <Typography variant="subtitle2">Export Fleet</Typography>
            <Typography variant="body2">Download your fleet as a FleetBox JSON file</Typography>

            <Stack direction="column" spacing={1}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Checkbox
                  checked={includeStatistics}
                  onChange={e => setIncludeStatistics(e.target.checked)}
                />
                <Typography variant="body2">Include fleet statistics</Typography>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Checkbox
                  checked={includeInactive}
                  onChange={e => setIncludeInactive(e.target.checked)}
                />
                <Typography variant="body2">Include inactive ships</Typography>
              </label>
            </Stack>

            <Button
              variant="contained"
              onClick={handleExport}
              disabled={loading}
              startIcon={<DownloadIcon />}
            >
              Export Fleet
            </Button>
          </Stack>
        </Box>

        {/* Import Section */}
        <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Stack direction="column" spacing={1.5}>
            <Typography variant="subtitle2">Import Fleet</Typography>
            <Typography variant="body2">Upload a FleetBox JSON file to import ships</Typography>

            <Stack direction="column" spacing={1}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Checkbox checked={merge} onChange={e => setMerge(e.target.checked)} />
                <Typography variant="body2">
                  Merge with existing ships (don't delete current ships)
                </Typography>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Checkbox
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                />
                <Typography variant="body2">Skip duplicate ships</Typography>
              </label>
            </Stack>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <Button
              variant="outlined"
              onClick={handleFileSelect}
              disabled={loading}
              startIcon={<UploadToCloudIcon />}
            >
              Select FleetBox File
            </Button>
          </Stack>
        </Box>

        {/* Loading State */}
        {loading && (
          <Stack justifyContent="center" sx={{ mt: 2 }}>
            <CircularProgress />
          </Stack>
        )}

        {/* Error Display */}
        {error && (
          <Box
            sx={{
              p: 1.5,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.error.main, 0.08),
            }}
          >
            <Stack spacing={1} direction="row" alignItems="center">
              <AlertIcon sx={{ color: theme.palette.error.main }} />
              <Typography variant="body2">{error}</Typography>
            </Stack>
          </Box>
        )}

        {/* Import Result Display */}
        {importResult && (
          <Box sx={{ p: 1.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Stack direction="column" spacing={1.5}>
              <Stack spacing={1} direction="row" alignItems="center">
                {importResult.success ? (
                  <>
                    <CheckmarkCircleIcon sx={{ fontSize: 24, color: theme.palette.success.main }} />
                    <Typography variant="subtitle2">Import Successful</Typography>
                  </>
                ) : (
                  <>
                    <AlertIcon sx={{ fontSize: 24, color: theme.palette.error.main }} />
                    <Typography variant="subtitle2">Import Completed with Errors</Typography>
                  </>
                )}
              </Stack>

              <Stack direction="row" spacing={2}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.5,
                    bgcolor: alpha(theme.palette.success.main, 0.2),
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption">{importResult.imported} imported</Typography>
                </Box>
                {importResult.skipped > 0 && (
                  <Box
                    sx={{ px: 1, py: 0.5, bgcolor: theme.palette.action.hover, borderRadius: 1 }}
                  >
                    <Typography variant="caption">{importResult.skipped} skipped</Typography>
                  </Box>
                )}
                {importResult.errors.length > 0 && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.5,
                      bgcolor: alpha(theme.palette.error.main, 0.2),
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="caption">{importResult.errors.length} errors</Typography>
                  </Box>
                )}
              </Stack>

              {importResult.errors.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    Errors:
                  </Typography>
                  {importResult.errors.map((err, idx) => (
                    <Typography key={idx} variant="body2" sx={{ color: theme.palette.error.dark }}>
                      • {err}
                    </Typography>
                  ))}
                </Box>
              )}

              <Button variant="text">View Details</Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
};
