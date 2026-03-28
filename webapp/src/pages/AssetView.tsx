import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, Paper, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import api from "../services/api.ts";

import { Asset, getAssetById } from "../services/gmail.ts";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";

const AssetView = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Category Initialization Button State ---
  const [initLoading, setInitLoading] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [initResult, setInitResult] = useState<{categories_created: number, subcategories_created: number} | null>(null);

  useAutoDismissMessage(error, setError, { delay: 5000 });

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

  const handleInitialize = async () => {
    setInitLoading(true);
    try {
      const res = await api.post("/api/categories/initialize");
      setInitResult(res.data);
      setInitDone(true);
      alert("Categories initialized successfully");
    } catch (err) {
      console.error(err);
      alert("Initialization failed");
    } finally {
      setInitLoading(false);
    }
  };

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
                <div className="col-12 md:col-6"><Typography><strong>Category:</strong> {asset.category || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>SubCategory:</strong> {asset.subcategory || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Vendor:</strong> {asset.vendor || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Price:</strong> {asset.price ?? "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Purchase Date:</strong> {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Invoice Number:</strong> {asset.invoice_number || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Serial Number:</strong> {asset.serial_number || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Model Number:</strong> {asset.model_number || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Location:</strong> {asset.location || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Assigned User:</strong> {asset.assigned_user || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Source:</strong> {asset.source}</Typography></div>
              </div>
              <Divider sx={{ my: 1 }} />
              <div className="grid">
                <div className="col-12 md:col-6"><Typography><strong>Description:</strong> {asset.description || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Notes:</strong> {asset.notes || "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Warranty:</strong> {asset.warranty ? "Available" : "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Insurance:</strong> {asset.insurance ? "Available" : "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Service Plan:</strong> {asset.service ? "Configured" : "-"}</Typography></div>
                <div className="col-12 md:col-6"><Typography><strong>Auto Reminders:</strong> {asset.auto_reminders_created ?? 0}</Typography></div>
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
      <Box className="col-12">
        <Divider sx={{ my: 2 }} />
        <Button
          variant="contained"
          color="primary"
          onClick={handleInitialize}
          disabled={initLoading || initDone}
          sx={{ mb: 2 }}
        >
          {initLoading ? "Initializing..." : initDone ? "Initialized" : "Initialize Categories"}
        </Button>
        {initResult && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Categories created: {initResult.categories_created}, Subcategories created: {initResult.subcategories_created}
          </Alert>
        )}
      </Box>
    </Box>
  );
};

export default AssetView;
