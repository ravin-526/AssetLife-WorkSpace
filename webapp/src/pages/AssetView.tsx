import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Divider, Paper, Typography } from "@mui/material";
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
    <Box className="grid">
      <Box className="col-12">
        <Typography variant="h4" sx={{ mb: 2 }}>Asset Details</Typography>
      </Box>
      <Box className="col-12 lg:col-10 xl:col-8">
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!error && !asset ? <Alert severity="warning">Asset not found.</Alert> : null}
          {asset ? (
            <>
              <div className="grid mt-1">
                <div className="col-12 md:col-6"><Typography><strong>Name:</strong> {asset.name}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Brand:</strong> {asset.brand || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Vendor:</strong> {asset.vendor || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Price:</strong> {asset.price ?? "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Purchase Date:</strong> {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Source:</strong> {asset.source}</Typography></div>
              </div>
              <Divider sx={{ my: 1 }} />
              <div className="grid">
                <div className="col-12 md:col-6"><Typography><strong>Source Email Id:</strong> {asset.source_email_id || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Source Sender:</strong> {asset.source_email_sender || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Source Subject:</strong> {asset.source_email_subject || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Created:</strong> {new Date(asset.created_at).toLocaleString()}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Updated:</strong> {new Date(asset.updated_at).toLocaleString()}</Typography></div>
              </div>
            </>
          ) : null}
        </Paper>
      </Box>
    </Box>
  );
};

export default AssetView;
