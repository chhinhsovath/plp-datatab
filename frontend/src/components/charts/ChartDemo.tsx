import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Button } from '@mui/material';
import Chart from './Chart';
import Dashboard from './Dashboard';
import { createDefaultChartConfig } from '../../utils/chartUtils';
import { Dashboard as DashboardType, ChartConfiguration } from '../../types/chart';

const ChartDemo: React.FC = () => {
  const [sampleCharts, setSampleCharts] = useState<ChartConfiguration[]>([]);
  const [dashboard, setDashboard] = useState<DashboardType>({
    id: 'demo-dashboard',
    name: 'Sample Dashboard',
    description: 'A demonstration of the chart system capabilities',
    charts: [],
    layout: [],
    filters: [],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const createSampleChart = (type: 'bar' | 'line' | 'scatter' | 'pie', title: string) => {
    const chart = createDefaultChartConfig(`chart-${Date.now()}`, type, title);
    
    // Add sample data based on chart type
    if (type === 'pie') {
      chart.data = {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple'],
        datasets: [{
          label: 'Colors',
          data: [12, 19, 3, 5, 2],
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 205, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ]
        }]
      };
    } else {
      chart.data = {
        labels: ['January', 'February', 'March', 'April', 'May', 'June'],
        datasets: [{
          label: 'Dataset 1',
          data: [12, 19, 3, 5, 2, 3],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          fill: type === 'line' ? false : true
        }]
      };
    }

    return chart;
  };

  const addSampleChart = (type: 'bar' | 'line' | 'scatter' | 'pie') => {
    const titles = {
      bar: 'Sample Bar Chart',
      line: 'Sample Line Chart',
      scatter: 'Sample Scatter Plot',
      pie: 'Sample Pie Chart'
    };

    const newChart = createSampleChart(type, titles[type]);
    setSampleCharts(prev => [...prev, newChart]);
  };

  const addToDashboard = (chart: ChartConfiguration) => {
    setDashboard(prev => ({
      ...prev,
      charts: [...prev.charts, chart],
      updatedAt: new Date()
    }));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>
        Chart System Demo
      </Typography>
      
      <Typography variant="body1" paragraph>
        This demo showcases the data visualization and charting system with Chart.js integration,
        customization options, and dashboard functionality.
      </Typography>

      {/* Sample Chart Creation */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Create Sample Charts
        </Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Button variant="contained" onClick={() => addSampleChart('bar')}>
              Add Bar Chart
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={() => addSampleChart('line')}>
              Add Line Chart
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={() => addSampleChart('scatter')}>
              Add Scatter Plot
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={() => addSampleChart('pie')}>
              Add Pie Chart
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Individual Charts */}
      {sampleCharts.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Individual Charts
          </Typography>
          <Grid container spacing={3}>
            {sampleCharts.map((chart) => (
              <Grid item xs={12} md={6} key={chart.id}>
                <Box sx={{ height: 400 }}>
                  <Chart
                    config={chart}
                    onConfigChange={(updatedChart) => {
                      setSampleCharts(prev => 
                        prev.map(c => c.id === updatedChart.id ? updatedChart : c)
                      );
                    }}
                  />
                </Box>
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => addToDashboard(chart)}
                  >
                    Add to Dashboard
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Dashboard */}
      {dashboard.charts.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Dashboard View
          </Typography>
          <Dashboard
            dashboard={dashboard}
            onDashboardChange={setDashboard}
          />
        </Box>
      )}

      {/* Features List */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Features Implemented
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Chart Types
            </Typography>
            <ul>
              <li>Bar Charts</li>
              <li>Line Charts</li>
              <li>Scatter Plots</li>
              <li>Pie Charts</li>
              <li>Doughnut Charts</li>
              <li>Histograms</li>
              <li>Box Plots</li>
            </ul>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Functionality
            </Typography>
            <ul>
              <li>Interactive tooltips and hover effects</li>
              <li>Chart customization interface</li>
              <li>Export to PNG and PDF</li>
              <li>Responsive design for mobile devices</li>
              <li>Dashboard creation and management</li>
              <li>Real-time chart updates</li>
              <li>Comprehensive test coverage</li>
            </ul>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ChartDemo;