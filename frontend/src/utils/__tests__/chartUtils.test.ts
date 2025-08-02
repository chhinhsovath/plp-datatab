import { describe, it, expect, vi } from 'vitest';
import {
  createDefaultChartConfig,
  convertToChartJsData,
  convertToChartJsOptions,
  generateHistogramData,
  generateBoxPlotData,
  validateChartData,
  getResponsiveOptions,
  DEFAULT_COLORS
} from '../chartUtils';
import { ChartConfiguration, ChartData } from '../../types/chart';

describe('chartUtils', () => {
  describe('createDefaultChartConfig', () => {
    it('creates a default chart configuration', () => {
      const config = createDefaultChartConfig('test-id', 'bar', 'Test Chart');
      
      expect(config.id).toBe('test-id');
      expect(config.type).toBe('bar');
      expect(config.title).toBe('Test Chart');
      expect(config.responsive).toBe(true);
      expect(config.maintainAspectRatio).toBe(true);
      expect(config.data.labels).toEqual([]);
      expect(config.data.datasets).toEqual([]);
    });

    it('sets default styling properties', () => {
      const config = createDefaultChartConfig('test-id', 'line', 'Test Chart');
      
      expect(config.styling.colors).toEqual(DEFAULT_COLORS);
      expect(config.styling.borderWidth).toBe(2);
      expect(config.styling.fontSize).toBe(12);
      expect(config.styling.fontFamily).toBe('Arial, sans-serif');
    });

    it('sets default axis configurations', () => {
      const config = createDefaultChartConfig('test-id', 'scatter', 'Test Chart');
      
      expect(config.xAxis.display).toBe(true);
      expect(config.xAxis.title.text).toBe('X Axis');
      expect(config.yAxis.display).toBe(true);
      expect(config.yAxis.title.text).toBe('Y Axis');
    });
  });

  describe('convertToChartJsData', () => {
    it('converts chart configuration to Chart.js data format', () => {
      const config = createDefaultChartConfig('test-id', 'bar', 'Test Chart');
      config.data = {
        labels: ['A', 'B', 'C'],
        datasets: [{
          label: 'Test',
          data: [1, 2, 3]
        }]
      };

      const result = convertToChartJsData(config);

      expect(result.labels).toEqual(['A', 'B', 'C']);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('Test');
      expect(result.datasets[0].data).toEqual([1, 2, 3]);
      expect(result.datasets[0].backgroundColor).toBe(DEFAULT_COLORS[0]);
    });

    it('applies custom colors from styling', () => {
      const config = createDefaultChartConfig('test-id', 'bar', 'Test Chart');
      config.styling.colors = ['#ff0000', '#00ff00'];
      config.data = {
        labels: ['A', 'B'],
        datasets: [
          { label: 'Test1', data: [1, 2] },
          { label: 'Test2', data: [3, 4] }
        ]
      };

      const result = convertToChartJsData(config);

      expect(result.datasets[0].backgroundColor).toBe('#ff0000');
      expect(result.datasets[1].backgroundColor).toBe('#00ff00');
    });
  });

  describe('convertToChartJsOptions', () => {
    it('converts chart configuration to Chart.js options', () => {
      const config = createDefaultChartConfig('test-id', 'bar', 'Test Chart');
      
      const result = convertToChartJsOptions(config);

      expect(result.responsive).toBe(true);
      expect(result.maintainAspectRatio).toBe(true);
      expect(result.plugins.title.text).toBe('Test Chart');
      expect(result.plugins.legend.display).toBe(true);
      expect(result.plugins.tooltip.enabled).toBe(true);
    });

    it('configures axes correctly', () => {
      const config = createDefaultChartConfig('test-id', 'line', 'Test Chart');
      config.xAxis.title.text = 'Custom X';
      config.yAxis.title.text = 'Custom Y';
      
      const result = convertToChartJsOptions(config);

      expect(result.scales.x.title.text).toBe('Custom X');
      expect(result.scales.y.title.text).toBe('Custom Y');
    });
  });

  describe('generateHistogramData', () => {
    it('generates histogram data from values', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = generateHistogramData(values, 5, 'Test Histogram');

      expect(result.labels).toHaveLength(5);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('Test Histogram');
      expect(result.datasets[0].data).toHaveLength(5);
      
      // Check that all values are accounted for
      const totalCount = result.datasets[0].data.reduce((sum, count) => sum + count, 0);
      expect(totalCount).toBe(values.length);
    });

    it('handles edge cases with single value', () => {
      const values = [5];
      const result = generateHistogramData(values, 3);

      expect(result.datasets[0].data.reduce((sum, count) => sum + count, 0)).toBe(1);
    });
  });

  describe('generateBoxPlotData', () => {
    it('generates box plot data from values', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = generateBoxPlotData(values, 'Test Box Plot');

      expect(result.labels).toEqual(['Min', 'Q1', 'Median', 'Q3', 'Max']);
      expect(result.datasets).toHaveLength(1);
      expect(result.datasets[0].label).toBe('Test Box Plot');
      expect(result.datasets[0].data).toHaveLength(5);
      
      // Check that min and max are correct
      expect(result.datasets[0].data[0]).toBe(1); // Min
      expect(result.datasets[0].data[4]).toBe(10); // Max
    });

    it('handles unsorted values', () => {
      const values = [10, 1, 5, 3, 8, 2, 9, 4, 7, 6];
      const result = generateBoxPlotData(values);

      expect(result.datasets[0].data[0]).toBe(1); // Min
      expect(result.datasets[0].data[4]).toBe(10); // Max
    });
  });

  describe('validateChartData', () => {
    it('validates correct chart data', () => {
      const data: ChartData = {
        labels: ['A', 'B', 'C'],
        datasets: [{
          label: 'Test',
          data: [1, 2, 3]
        }]
      };

      expect(validateChartData(data)).toBe(true);
    });

    it('rejects data with mismatched lengths', () => {
      const data: ChartData = {
        labels: ['A', 'B', 'C'],
        datasets: [{
          label: 'Test',
          data: [1, 2] // Length mismatch
        }]
      };

      expect(validateChartData(data)).toBe(false);
    });

    it('rejects data without labels', () => {
      const data = {
        datasets: [{
          label: 'Test',
          data: [1, 2, 3]
        }]
      } as ChartData;

      expect(validateChartData(data)).toBe(false);
    });

    it('rejects data without datasets', () => {
      const data = {
        labels: ['A', 'B', 'C']
      } as ChartData;

      expect(validateChartData(data)).toBe(false);
    });
  });

  describe('getResponsiveOptions', () => {
    it('returns mobile options for small screens', () => {
      const options = getResponsiveOptions(400);

      expect(options.maintainAspectRatio).toBe(false);
      expect(options.aspectRatio).toBe(1);
      expect(options.plugins.legend.position).toBe('bottom');
    });

    it('returns tablet options for medium screens', () => {
      const options = getResponsiveOptions(700);

      expect(options.maintainAspectRatio).toBe(true);
      expect(options.aspectRatio).toBe(1.5);
      expect(options.plugins.legend.position).toBe('top');
    });

    it('returns desktop options for large screens', () => {
      const options = getResponsiveOptions(1200);

      expect(options.maintainAspectRatio).toBe(true);
      expect(options.aspectRatio).toBe(2);
      expect(options.plugins.legend.position).toBe('top');
    });
  });
});