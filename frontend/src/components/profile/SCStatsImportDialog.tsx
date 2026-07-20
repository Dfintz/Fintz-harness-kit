import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import { useImportSCStatsCsv } from '@/hooks/queries/useSCStatsQueries';
import { logger } from '@/utils/logger';

interface SCStatsImportDialogProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CsvFileSlot {
  key: 'playtime' | 'loadoutTop' | 'loadoutDetail' | 'purchases' | 'ships';
  label: string;
  description: string;
}

const CSV_SLOTS: CsvFileSlot[] = [
  {
    key: 'playtime',
    label: 'Playtime',
    description: 'Playtime tab → Save (playtime_versions.csv)',
  },
  {
    key: 'loadoutTop',
    label: 'Loadout (Top)',
    description: 'Loadout tab → "Most Worn Items" table → Save',
  },
  {
    key: 'loadoutDetail',
    label: 'Loadout (Detail)',
    description: 'Loadout tab → "Other Worn Items" table → Save',
  },
  {
    key: 'purchases',
    label: 'Purchases',
    description: 'Purchases tab → Save (purchases_items.csv)',
  },
  {
    key: 'ships',
    label: 'Ships',
    description: 'Ships tab → Save (ships.csv)',
  },
];

type CsvFiles = Record<CsvFileSlot['key'], File | null>;

const emptyFiles: CsvFiles = {
  playtime: null,
  loadoutTop: null,
  loadoutDetail: null,
  purchases: null,
  ships: null,
};

export const SCStatsImportDialog: React.FC<SCStatsImportDialogProps> = ({
  userId,
  open,
  onClose,
  onSuccess,
}) => {
  const [files, setFiles] = useState<CsvFiles>({ ...emptyFiles });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importCsv = useImportSCStatsCsv(userId);

  const selectedCount = CSV_SLOTS.filter(slot => files[slot.key] !== null).length;
  const anyFileSelected = selectedCount > 0;

  const handleFileChange = useCallback((key: CsvFileSlot['key'], file: File | null) => {
    setFiles(prev => ({ ...prev, [key]: file }));
    setError(null);
  }, []);

  const handleUpload = async () => {
    if (!anyFileSelected || !consent) return;

    setError(null);

    try {
      const selectedFiles: Partial<Record<CsvFileSlot['key'], File>> = {};
      for (const slot of CSV_SLOTS) {
        if (files[slot.key]) {
          selectedFiles[slot.key] = files[slot.key]!;
        }
      }

      await importCsv.mutateAsync({
        files: selectedFiles,
        consent,
      });
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import SCStats data';
      setError(message);
      logger.error(
        'SCStats CSV import failed',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const handleClose = () => {
    setFiles({ ...emptyFiles });
    setConsent(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Import SCStats CSV Data</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Upload CSV exports from the SCStats desktop app. Select one or more categories to import.
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>How to export from SCStats:</strong>
            <br />
            Open the SCStats desktop app → go to each tab (Playtime, Loadout, Purchases, Ships) →
            click the <strong>Save</strong> button to download the CSV for each table.
          </Typography>
        </Alert>

        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {CSV_SLOTS.map(slot => (
            <FileUploadRow
              key={slot.key}
              slot={slot}
              file={files[slot.key]}
              onFileChange={handleFileChange}
            />
          ))}
        </Stack>

        <Box sx={{ mb: 2 }}>
          <Chip
            label={`${selectedCount} / ${CSV_SLOTS.length} files selected`}
            color={anyFileSelected ? 'success' : 'default'}
            size="small"
          />
        </Box>

        <FormControlLabel
          control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} />}
          label={
            <Typography variant="body2">
              I consent to importing and storing my SCStats gameplay data. This data will be used to
              verify my profile, improve matchmaking, and help organizations make informed
              decisions. I can delete this data at any time from my privacy settings.
            </Typography>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={!anyFileSelected || !consent || importCsv.isPending}
          startIcon={importCsv.isPending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
        >
          {importCsv.isPending ? 'Importing…' : 'Import Data'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Single file upload row
// ---------------------------------------------------------------------------

interface FileUploadRowProps {
  slot: CsvFileSlot;
  file: File | null;
  onFileChange: (key: CsvFileSlot['key'], file: File | null) => void;
}

const FileUploadRow: React.FC<FileUploadRowProps> = ({ slot, file, onFileChange }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      p: 1.5,
      border: 1,
      borderColor: file ? 'success.main' : 'divider',
      borderRadius: 1,
      bgcolor: file ? 'success.50' : 'transparent',
    }}
  >
    {file ? (
      <CheckCircleIcon color="success" fontSize="small" />
    ) : (
      <UploadFileIcon color="action" fontSize="small" />
    )}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600}>
        {slot.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {file ? file.name : slot.description}
      </Typography>
    </Box>
    <Button variant="outlined" size="small" component="label" sx={{ flexShrink: 0 }}>
      {file ? 'Change' : 'Select'}
      <input
        type="file"
        hidden
        accept=".csv"
        onChange={e => onFileChange(slot.key, e.target.files?.[0] ?? null)}
      />
    </Button>
  </Box>
);
