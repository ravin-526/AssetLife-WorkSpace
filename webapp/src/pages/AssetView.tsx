import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom";

import { Asset, getAssetById } from "../services/gmail.ts";

const AssetView = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      if (!assetId) {
        setError("Invalid asset id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await getAssetById(assetId);
        setAsset(response);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load asset");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [assetId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Asset Details</Typography>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={1.25}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!error && !asset ? <Alert severity="warning">Asset not found.</Alert> : null}
          {asset ? (
            <>
              <Typography><strong>Name:</strong> {asset.name}</Typography>
              <Typography><strong>Brand:</strong> {asset.brand || "-"}</Typography>
              <Typography><strong>Vendor:</strong> {asset.vendor || "-"}</Typography>
              <Typography><strong>Price:</strong> {asset.price ?? "-"}</Typography>
              <Typography><strong>Purchase Date:</strong> {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</Typography>
              <Typography><strong>Source:</strong> {asset.source}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography><strong>Source Email Id:</strong> {asset.source_email_id || "-"}</Typography>
              <Typography><strong>Source Sender:</strong> {asset.source_email_sender || "-"}</Typography>
              <Typography><strong>Source Subject:</strong> {asset.source_email_subject || "-"}</Typography>
              <Typography><strong>Created:</strong> {new Date(asset.created_at).toLocaleString()}</Typography>
              <Typography><strong>Updated:</strong> {new Date(asset.updated_at).toLocaleString()}</Typography>
            </>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
};

export default AssetView;
