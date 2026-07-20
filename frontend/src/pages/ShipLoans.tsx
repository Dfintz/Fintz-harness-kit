import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { RequestLoanDialog } from '@/components/RequestLoanDialog';
import { ShipLoansTable } from '@/components/ShipLoansTable';
import { Box } from '@mui/material';
import React, { useState } from 'react';

export const ShipLoans: React.FC = () => {
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [loansKey, setLoansKey] = useState(0);

  return (
    <FeatureErrorBoundary featureName="Ship Loans" showHomeButton>
      <Box sx={{ p: 4 }}>
        <ShipLoansTable key={loansKey} onRequestLoan={() => setLoanDialogOpen(true)} />
        <RequestLoanDialog
          open={loanDialogOpen}
          onClose={() => setLoanDialogOpen(false)}
          onSuccess={() => {
            setLoansKey(prev => prev + 1);
            setLoanDialogOpen(false);
          }}
        />
      </Box>
    </FeatureErrorBoundary>
  );
};
