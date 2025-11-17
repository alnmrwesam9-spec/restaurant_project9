// src/components/LLMOverlay.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Backdrop, CircularProgress, Typography, Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress } from '@mui/material';

export default function LLMOverlay({
  open,
  onCancel,
  elapsedMs,
  stepLabel = 'Generating codes…',
  step = 1,
  steps = 3,
  percent = 0,
}) {
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowTimeoutDialog(false);
      return;
    }
    const id = setTimeout(() => setShowTimeoutDialog(true), 30_000);
    return () => clearTimeout(id);
  }, [open]);

  const pct = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  const stepText = `${stepLabel} — Step ${step}/${steps}`;

  return (
    <>
      <Backdrop open={open} sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 2 }}>
        <Box sx={{
          bgcolor: 'rgba(0,0,0,0.6)',
          p: 3,
          borderRadius: 2,
          minWidth: 320,
          maxWidth: '80vw',
        }}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress color="inherit" thickness={4} />
            <Typography variant="h6" sx={{ fontWeight: 700, textAlign: 'center' }}>
              {stepText}
            </Typography>
            <Box sx={{ width: '100%' }}>
              <LinearProgress variant="determinate" value={pct} />
            </Box>
            <Stack direction="row" spacing={1}>
              <Button onClick={onCancel} variant="outlined" color="inherit" sx={{ borderRadius: 999 }}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Backdrop>

      <Dialog open={open && showTimeoutDialog} onClose={() => setShowTimeoutDialog(false)}>
        <DialogTitle>Still working…</DialogTitle>
        <DialogContent>
          <Typography>
            Operation is taking longer than expected. Continue waiting or cancel?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTimeoutDialog(false)} autoFocus>
            Continue
          </Button>
          <Button onClick={() => { setShowTimeoutDialog(false); onCancel && onCancel(); }} color="error" variant="contained">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

