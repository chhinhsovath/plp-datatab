import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  Search,
  DataObject,
  TableChart,
  CalendarToday,
} from '@mui/icons-material';
import { Dataset } from '../../types/data';

interface DatasetSelectorProps {
  datasets: Dataset[];
  onSelect: (dataset: Dataset) => void;
}

const DatasetSelector: React.FC<DatasetSelectorProps> = ({ datasets, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'numeric': return 'primary';
      case 'categorical': return 'secondary';
      case 'date': return 'success';
      case 'text': return 'warning';
      default: return 'default';
    }
  };

  const handleSelect = () => {
    if (selectedDataset) {
      onSelect(selectedDataset);
    }
  };

  if (datasets.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <DataObject sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No datasets available
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload a dataset first to perform statistical analysis
        </Typography>
        <Button variant="contained" href="/upload">
          Upload Dataset
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select a Dataset for Analysis
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose the dataset you want to analyze. Make sure your data is clean and properly formatted.
      </Typography>

      <TextField
        fullWidth
        placeholder="Search datasets..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
      />

      {selectedDataset && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Selected: <strong>{selectedDataset.name}</strong> with {selectedDataset.rowCount} rows and {selectedDataset.columns.length} columns
        </Alert>
      )}

      <Grid container spacing={3}>
        {filteredDatasets.map((dataset) => (
          <Grid item xs={12} md={6} key={dataset.id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedDataset?.id === dataset.id ? 2 : 1,
                borderColor: selectedDataset?.id === dataset.id ? 'primary.main' : 'divider',
                '&:hover': {
                  boxShadow: 4,
                },
              }}
              onClick={() => setSelectedDataset(dataset)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <DataObject sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" component="div">
                    {dataset.name}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TableChart sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {dataset.rowCount.toLocaleString()} rows × {dataset.columns.length} columns
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CalendarToday sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Uploaded {formatDate(dataset.uploadedAt)} • {formatFileSize(dataset.fileSize)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {dataset.columns.slice(0, 6).map((column) => (
                    <Chip
                      key={column.name}
                      label={`${column.name} (${column.dataType})`}
                      size="small"
                      color={getDataTypeColor(column.dataType) as any}
                      variant="outlined"
                    />
                  ))}
                  {dataset.columns.length > 6 && (
                    <Chip
                      label={`+${dataset.columns.length - 6} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  variant={selectedDataset?.id === dataset.id ? 'contained' : 'outlined'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDataset(dataset);
                  }}
                >
                  {selectedDataset?.id === dataset.id ? 'Selected' : 'Select'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredDatasets.length === 0 && searchTerm && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No datasets found matching "{searchTerm}"
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={!selectedDataset}
        >
          Continue with Selected Dataset
        </Button>
      </Box>
    </Box>
  );
};

export default DatasetSelector;