import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
} from '@mui/material';
import {
  Upload,
  Analytics,
  BarChart,
  Assessment,

  DataObject,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const quickActions = [
    {
      title: 'Upload Data',
      description: 'Import your datasets from CSV, Excel, or JSON files',
      icon: <Upload sx={{ fontSize: 40 }} />,
      color: 'primary',
      action: () => navigate('/upload'),
    },
    {
      title: 'View Datasets',
      description: 'Browse and manage your uploaded datasets',
      icon: <DataObject sx={{ fontSize: 40 }} />,
      color: 'secondary',
      action: () => navigate('/datasets'),
    },
    {
      title: 'Statistical Analysis',
      description: 'Perform statistical tests and analysis',
      icon: <Analytics sx={{ fontSize: 40 }} />,
      color: 'success',
      action: () => navigate('/analysis'),
    },
    {
      title: 'Create Visualizations',
      description: 'Generate charts and graphs from your data',
      icon: <BarChart sx={{ fontSize: 40 }} />,
      color: 'warning',
      action: () => navigate('/visualizations'),
    },
  ];

  const recentActivity = [
    { type: 'upload', description: 'Uploaded dataset: Sales_Data_2024.csv', time: '2 hours ago' },
    { type: 'analysis', description: 'Performed t-test analysis', time: '1 day ago' },
    { type: 'visualization', description: 'Created bar chart visualization', time: '2 days ago' },
    { type: 'report', description: 'Generated statistical report', time: '3 days ago' },
  ];

  const stats = [
    { label: 'Total Datasets', value: '12', icon: <DataObject /> },
    { label: 'Analyses Performed', value: '34', icon: <Analytics /> },
    { label: 'Visualizations Created', value: '28', icon: <BarChart /> },
    { label: 'Reports Generated', value: '15', icon: <Assessment /> },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.name}!
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's an overview of your statistical analysis platform
      </Typography>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Paper
              sx={{
                p: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ color: 'primary.main' }}>
                {stat.icon}
              </Box>
              <Box>
                <Typography variant="h4" component="div">
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h5" gutterBottom>
        Quick Actions
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {quickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
              onClick={action.action}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box sx={{ color: `${action.color}.main`, mb: 2 }}>
                  {action.icon}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {action.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {action.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                <Button size="small" color={action.color as any}>
                  Get Started
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentActivity.map((activity, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    backgroundColor: 'grey.50',
                    borderRadius: 1,
                  }}
                >
                  <Chip
                    label={activity.type}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">
                      {activity.description}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {activity.time}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Getting Started
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => navigate('/upload')}
                fullWidth
              >
                Upload Your First Dataset
              </Button>
              <Button
                variant="outlined"
                startIcon={<Analytics />}
                onClick={() => navigate('/analysis')}
                fullWidth
              >
                Explore Analysis Tools
              </Button>
              <Button
                variant="outlined"
                startIcon={<BarChart />}
                onClick={() => navigate('/visualizations')}
                fullWidth
              >
                Create Visualizations
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;