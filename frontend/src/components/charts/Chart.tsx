import React, { useRef, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import {
  Bar,
  Line,
  Scatter,
  Pie,
  Doughnut
} from 'react-chartjs-2';
import { Box, Paper, IconButton, Menu, MenuItem } from '@mui/material';
import { MoreVert as MoreVertIcon, Download as DownloadIcon } from '@mui/icons-material';
import { ChartConfiguration, ExportOptions } from '../../types/chart';
import { 
  convertToChartJsData, 
  convertToChartJsOptions, 
  exportChart,
  getResponsiveOptions
} from '../../utils/chartUtils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartProps {
  config: ChartConfiguration;
  onConfigChange?: (config: ChartConfiguration) => void;
  onExport?: (format: 'png' | 'svg' | 'pdf') => void;
  showControls?: boolean;
  containerWidth?: number;
}

const Chart: React.FC<ChartProps> = ({
  config,
  onConfigChange,
  onExport,
  showControls = true,
  containerWidth = 800
}) => {
  const chartRef = useRef<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleExport = async (format: 'png' | 'svg' | 'pdf') => {
    setIsExporting(true);
    try {
      const dataUrl = await exportChart(chartRef, {
        format,
        width: 800,
        height: 600,
        quality: 1.0
      });
      
      // Create download link
      const link = document.createElement('a');
      link.download = `${config.title || 'chart'}.${format}`;
      link.href = dataUrl;
      link.click();
      
      if (onExport) {
        onExport(format);
      }
    } catch (error) {
      console.error('Export failed:', error);
      // Show user-friendly error message
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      handleMenuClose();
    }
  };

  // Prepare Chart.js data and options
  const chartData = convertToChartJsData(config);
  const baseOptions = convertToChartJsOptions(config);
  const responsiveOptions = getResponsiveOptions(containerWidth);
  
  const chartOptions = {
    ...baseOptions,
    ...responsiveOptions,
    onHover: config.interactivity.hover ? undefined : () => {},
    onClick: config.interactivity.click ? undefined : () => {}
  };

  // Render appropriate chart type
  const renderChart = () => {
    const commonProps = {
      ref: chartRef,
      data: chartData,
      options: chartOptions
    };

    switch (config.type) {
      case 'bar':
        return <Bar {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'scatter':
        return <Scatter {...commonProps} />;
      case 'pie':
        return <Pie {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      case 'histogram':
        // Histogram is rendered as a bar chart
        return <Bar {...commonProps} />;
      case 'boxplot':
        // Box plot is rendered as a line chart for now
        return <Line {...commonProps} />;
      default:
        return <Bar {...commonProps} />;
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {showControls && (
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            disabled={isExporting}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => handleExport('png')}>
              <DownloadIcon sx={{ mr: 1 }} />
              Export as PNG
            </MenuItem>
            <MenuItem onClick={() => handleExport('svg')} disabled>
              <DownloadIcon sx={{ mr: 1 }} />
              Export as SVG
            </MenuItem>
            <MenuItem onClick={() => handleExport('pdf')}>
              <DownloadIcon sx={{ mr: 1 }} />
              Export as PDF
            </MenuItem>
          </Menu>
        </Box>
      )}
      
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {renderChart()}
      </Box>
    </Paper>
  );
};

export default Chart;