import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import FileUpload from '../components/upload/FileUpload';
import { Dataset } from '../types/data';

const UploadPage: React.FC = () => {
  const handleUploadSuccess = (dataset: Dataset) => {
    console.log('Upload successful:', dataset);
    // Could show success notification or redirect
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Could show error notification
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Data
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Import your datasets from various file formats to begin your statistical analysis
      </Typography>

      <FileUpload
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
      />

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Supported File Formats
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>CSV files (.csv)</strong> - Comma-separated values with headers
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>Excel files (.xlsx, .xls)</strong> - Microsoft Excel spreadsheets
        </Typography>
        <Typography variant="body2" paragraph>
          • <strong>JSON files (.json)</strong> - JavaScript Object Notation data
        </Typography>
        
        <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
          File Requirements
        </Typography>
        <Typography variant="body2" paragraph>
          • Maximum file size: 100MB
        </Typography>
        <Typography variant="body2" paragraph>
          • First row should contain column headers
        </Typography>
        <Typography variant="body2" paragraph>
          • Data should be in tabular format
        </Typography>
      </Paper>
    </Box>
  );
};

export default UploadPage;