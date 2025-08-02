import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Button,

  Slider
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { ChartConfiguration, ChartType } from '../../types/chart';
// import { DEFAULT_COLORS } from '../../utils/chartUtils';

interface ChartCustomizerProps {
  config: ChartConfiguration;
  onChange: (config: ChartConfiguration) => void;
  onApply?: () => void;
}

// Simple color picker component
const SimpleColorPicker: React.FC<{
  value: string;
  onChange: (color: string) => void;
  label: string;
}> = ({ value, onChange, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Typography variant="body2" sx={{ minWidth: 80 }}>
      {label}:
    </Typography>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 40,
        height: 30,
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer'
      }}
    />
  </Box>
);

const ChartCustomizer: React.FC<ChartCustomizerProps> = ({
  config,
  onChange,
  onApply
}) => {
  const [localConfig, setLocalConfig] = useState<ChartConfiguration>(config);

  const handleConfigChange = (updates: Partial<ChartConfiguration>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handleStylingChange = (updates: Partial<ChartConfiguration['styling']>) => {
    handleConfigChange({
      styling: { ...localConfig.styling, ...updates }
    });
  };

  const handleAxisChange = (
    axis: 'xAxis' | 'yAxis',
    updates: Partial<ChartConfiguration['xAxis']>
  ) => {
    handleConfigChange({
      [axis]: { ...localConfig[axis], ...updates }
    });
  };

  const handleLegendChange = (updates: Partial<ChartConfiguration['legend']>) => {
    handleConfigChange({
      legend: { ...localConfig.legend, ...updates }
    });
  };

  const handleTooltipChange = (updates: Partial<ChartConfiguration['tooltip']>) => {
    handleConfigChange({
      tooltip: { ...localConfig.tooltip, ...updates }
    });
  };

  return (
    <Paper sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Chart Customization
      </Typography>

      {/* Basic Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Basic Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Chart Title"
                value={localConfig.title}
                onChange={(e) => handleConfigChange({ title: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={localConfig.type}
                  label="Chart Type"
                  onChange={(e) => handleConfigChange({ type: e.target.value as ChartType })}
                >
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="scatter">Scatter Plot</MenuItem>
                  <MenuItem value="pie">Pie Chart</MenuItem>
                  <MenuItem value="doughnut">Doughnut Chart</MenuItem>
                  <MenuItem value="histogram">Histogram</MenuItem>
                  <MenuItem value="boxplot">Box Plot</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.responsive}
                    onChange={(e) => handleConfigChange({ responsive: e.target.checked })}
                  />
                }
                label="Responsive"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Styling */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Styling</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" gutterBottom>
                Border Width
              </Typography>
              <Slider
                value={localConfig.styling.borderWidth || 2}
                onChange={(_, value) => handleStylingChange({ borderWidth: value as number })}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SimpleColorPicker
                value={localConfig.styling.backgroundColor || '#ffffff'}
                onChange={(color) => handleStylingChange({ backgroundColor: color })}
                label="Background"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SimpleColorPicker
                value={localConfig.styling.gridColor || '#e0e0e0'}
                onChange={(color) => handleStylingChange({ gridColor: color })}
                label="Grid Color"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Axes */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Axes</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" gutterBottom>
                X-Axis
              </Typography>
              <TextField
                fullWidth
                label="X-Axis Title"
                value={localConfig.xAxis.title.text}
                onChange={(e) => handleAxisChange('xAxis', {
                  title: { ...localConfig.xAxis.title, text: e.target.value }
                })}
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.xAxis.display}
                    onChange={(e) => handleAxisChange('xAxis', { display: e.target.checked })}
                  />
                }
                label="Show X-Axis"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.xAxis.grid.display}
                    onChange={(e) => handleAxisChange('xAxis', {
                      grid: { ...localConfig.xAxis.grid, display: e.target.checked }
                    })}
                  />
                }
                label="Show X-Grid"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" gutterBottom>
                Y-Axis
              </Typography>
              <TextField
                fullWidth
                label="Y-Axis Title"
                value={localConfig.yAxis.title.text}
                onChange={(e) => handleAxisChange('yAxis', {
                  title: { ...localConfig.yAxis.title, text: e.target.value }
                })}
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.yAxis.display}
                    onChange={(e) => handleAxisChange('yAxis', { display: e.target.checked })}
                  />
                }
                label="Show Y-Axis"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.yAxis.grid.display}
                    onChange={(e) => handleAxisChange('yAxis', {
                      grid: { ...localConfig.yAxis.grid, display: e.target.checked }
                    })}
                  />
                }
                label="Show Y-Grid"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Legend */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Legend</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.legend.display}
                    onChange={(e) => handleLegendChange({ display: e.target.checked })}
                  />
                }
                label="Show Legend"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Legend Position</InputLabel>
                <Select
                  value={localConfig.legend.position}
                  label="Legend Position"
                  onChange={(e) => handleLegendChange({ 
                    position: e.target.value as 'top' | 'bottom' | 'left' | 'right' 
                  })}
                >
                  <MenuItem value="top">Top</MenuItem>
                  <MenuItem value="bottom">Bottom</MenuItem>
                  <MenuItem value="left">Left</MenuItem>
                  <MenuItem value="right">Right</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Tooltip */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Tooltip</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.tooltip.enabled}
                    onChange={(e) => handleTooltipChange({ enabled: e.target.checked })}
                  />
                }
                label="Enable Tooltips"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SimpleColorPicker
                value={localConfig.tooltip.backgroundColor}
                onChange={(color) => handleTooltipChange({ backgroundColor: color })}
                label="Background"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <SimpleColorPicker
                value={localConfig.tooltip.titleColor}
                onChange={(color) => handleTooltipChange({ titleColor: color })}
                label="Title Color"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {onApply && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={onApply}>
            Apply Changes
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default ChartCustomizer;