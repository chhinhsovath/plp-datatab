import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Fab,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import Chart from './Chart';
import ChartCustomizer from './ChartCustomizer';
import { Dashboard as DashboardType, ChartConfiguration } from '../../types/chart';
import { createDefaultChartConfig } from '../../utils/chartUtils';

interface DashboardProps {
  dashboard: DashboardType;
  onDashboardChange: (dashboard: DashboardType) => void;
  onChartAdd?: (chart: ChartConfiguration) => void;
  onChartEdit?: (chart: ChartConfiguration) => void;
  onChartDelete?: (chartId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  dashboard,
  onDashboardChange,
  onChartAdd,
  onChartEdit,
  onChartDelete
}) => {
  const [selectedChart, setSelectedChart] = useState<ChartConfiguration | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newChartTitle, setNewChartTitle] = useState('');
  const [newChartType, setNewChartType] = useState<'bar' | 'line' | 'scatter' | 'pie'>('bar');
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({});
  const [fullscreenChart, setFullscreenChart] = useState<ChartConfiguration | null>(null);

  const handleMenuOpen = (chartId: string, event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(prev => ({ ...prev, [chartId]: event.currentTarget }));
  };

  const handleMenuClose = (chartId: string) => {
    setAnchorEl(prev => ({ ...prev, [chartId]: null }));
  };

  const handleAddChart = () => {
    if (!newChartTitle.trim()) return;

    const newChart = createDefaultChartConfig(
      `chart-${Date.now()}`,
      newChartType,
      newChartTitle
    );

    // Add sample data for demonstration
    newChart.data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Sample Data',
        data: [12, 19, 3, 5, 2, 3],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    };

    const updatedDashboard = {
      ...dashboard,
      charts: [...dashboard.charts, newChart],
      updatedAt: new Date()
    };

    onDashboardChange(updatedDashboard);
    
    if (onChartAdd) {
      onChartAdd(newChart);
    }

    setNewChartTitle('');
    setIsAddDialogOpen(false);
  };

  const handleEditChart = (chart: ChartConfiguration) => {
    setSelectedChart(chart);
    setIsCustomizerOpen(true);
    handleMenuClose(chart.id);
  };

  const handleDeleteChart = (chartId: string) => {
    const updatedDashboard = {
      ...dashboard,
      charts: dashboard.charts.filter(chart => chart.id !== chartId),
      updatedAt: new Date()
    };

    onDashboardChange(updatedDashboard);
    
    if (onChartDelete) {
      onChartDelete(chartId);
    }

    handleMenuClose(chartId);
  };

  const handleChartConfigChange = useCallback((updatedChart: ChartConfiguration) => {
    const updatedDashboard = {
      ...dashboard,
      charts: dashboard.charts.map(chart => 
        chart.id === updatedChart.id ? updatedChart : chart
      ),
      updatedAt: new Date()
    };

    onDashboardChange(updatedDashboard);
    
    if (onChartEdit) {
      onChartEdit(updatedChart);
    }
  }, [dashboard, onDashboardChange, onChartEdit]);

  const handleFullscreen = (chart: ChartConfiguration) => {
    setFullscreenChart(chart);
    handleMenuClose(chart.id);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Dashboard Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {dashboard.name}
          </Typography>
          {dashboard.description && (
            <Typography variant="body1" color="text.secondary">
              {dashboard.description}
            </Typography>
          )}
        </Box>
        <Fab
          color="primary"
          size="medium"
          onClick={() => setIsAddDialogOpen(true)}
          sx={{ ml: 2 }}
        >
          <AddIcon />
        </Fab>
      </Box>

      {/* Charts Grid */}
      {dashboard.charts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No charts yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add your first chart to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsAddDialogOpen(true)}
          >
            Add Chart
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {dashboard.charts.map((chart) => (
            <Grid item xs={12} md={6} lg={4} key={chart.id}>
              <Box sx={{ position: 'relative', height: 400 }}>
                <Chart
                  config={chart}
                  onConfigChange={handleChartConfigChange}
                  showControls={false}
                />
                
                {/* Chart Controls */}
                <Box sx={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8, 
                  zIndex: 2,
                  display: 'flex',
                  gap: 0.5
                }}>
                  <IconButton
                    size="small"
                    onClick={() => handleFullscreen(chart)}
                    sx={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                  >
                    <FullscreenIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(chart.id, e)}
                    sx={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Chart Menu */}
                <Menu
                  anchorEl={anchorEl[chart.id]}
                  open={Boolean(anchorEl[chart.id])}
                  onClose={() => handleMenuClose(chart.id)}
                >
                  <MenuItem onClick={() => handleEditChart(chart)}>
                    <EditIcon sx={{ mr: 1 }} fontSize="small" />
                    Edit
                  </MenuItem>
                  <MenuItem onClick={() => handleDeleteChart(chart.id)}>
                    <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
                    Delete
                  </MenuItem>
                </Menu>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Chart Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Chart</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Chart Title"
            fullWidth
            variant="outlined"
            value={newChartTitle}
            onChange={(e) => setNewChartTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Chart Type"
            fullWidth
            variant="outlined"
            value={newChartType}
            onChange={(e) => setNewChartType(e.target.value as any)}
          >
            <MenuItem value="bar">Bar Chart</MenuItem>
            <MenuItem value="line">Line Chart</MenuItem>
            <MenuItem value="scatter">Scatter Plot</MenuItem>
            <MenuItem value="pie">Pie Chart</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddChart} variant="contained">Add Chart</Button>
        </DialogActions>
      </Dialog>

      {/* Chart Customizer Dialog */}
      <Dialog 
        open={isCustomizerOpen} 
        onClose={() => setIsCustomizerOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Customize Chart</DialogTitle>
        <DialogContent>
          {selectedChart && (
            <ChartCustomizer
              config={selectedChart}
              onChange={handleChartConfigChange}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCustomizerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Fullscreen Chart Dialog */}
      <Dialog
        open={Boolean(fullscreenChart)}
        onClose={() => setFullscreenChart(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          {fullscreenChart?.title}
          <IconButton
            onClick={() => setFullscreenChart(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            ×
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ height: '100%' }}>
          {fullscreenChart && (
            <Box sx={{ height: '100%' }}>
              <Chart
                config={fullscreenChart}
                onConfigChange={handleChartConfigChange}
                containerWidth={1000}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default Dashboard;