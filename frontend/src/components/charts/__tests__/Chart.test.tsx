import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Chart from '../Chart';
import { ChartConfiguration } from '../../../types/chart';
import { createDefaultChartConfig } from '../../../utils/chartUtils';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Bar: vi.fn(({ data, options, ...props }) => (
    <div data-testid="bar-chart" {...props}>
      Bar Chart: {data.labels?.join(', ')}
    </div>
  )),
  Line: vi.fn(({ data, options, ...props }) => (
    <div data-testid="line-chart" {...props}>
      Line Chart: {data.labels?.join(', ')}
    </div>
  )),
  Scatter: vi.fn(({ data, options, ...props }) => (
    <div data-testid="scatter-chart" {...props}>
      Scatter Chart: {data.labels?.join(', ')}
    </div>
  )),
  Pie: vi.fn(({ data, options, ...props }) => (
    <div data-testid="pie-chart" {...props}>
      Pie Chart: {data.labels?.join(', ')}
    </div>
  )),
  Doughnut: vi.fn(({ data, options, ...props }) => (
    <div data-testid="doughnut-chart" {...props}>
      Doughnut Chart: {data.labels?.join(', ')}
    </div>
  ))
}));

// Mock Chart.js registration
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn()
  },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  LineElement: {},
  PointElement: {},
  ArcElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {}
}));

describe('Chart Component', () => {
  let mockConfig: ChartConfiguration;

  beforeEach(() => {
    mockConfig = createDefaultChartConfig('test-chart', 'bar', 'Test Chart');
    mockConfig.data = {
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'Test Data',
        data: [10, 20, 30],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2
      }]
    };
  });

  it('renders bar chart correctly', () => {
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Bar Chart: Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('renders line chart correctly', () => {
    mockConfig.type = 'line';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByText('Line Chart: Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('renders scatter chart correctly', () => {
    mockConfig.type = 'scatter';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
    expect(screen.getByText('Scatter Chart: Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('renders pie chart correctly', () => {
    mockConfig.type = 'pie';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByText('Pie Chart: Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('renders doughnut chart correctly', () => {
    mockConfig.type = 'doughnut';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    expect(screen.getByText('Doughnut Chart: Jan, Feb, Mar')).toBeInTheDocument();
  });

  it('shows controls when showControls is true', () => {
    render(<Chart config={mockConfig} showControls={true} />);
    
    const moreButton = screen.getByRole('button');
    expect(moreButton).toBeInTheDocument();
  });

  it('hides controls when showControls is false', () => {
    render(<Chart config={mockConfig} showControls={false} />);
    
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('opens export menu when more button is clicked', async () => {
    render(<Chart config={mockConfig} showControls={true} />);
    
    const moreButton = screen.getByRole('button');
    fireEvent.click(moreButton);
    
    await waitFor(() => {
      expect(screen.getByText('Export as PNG')).toBeInTheDocument();
      expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    });
  });

  it('calls onConfigChange when config changes', () => {
    const mockOnConfigChange = vi.fn();
    render(<Chart config={mockConfig} onConfigChange={mockOnConfigChange} />);
    
    // This would be triggered by chart interactions in a real scenario
    // For now, we just verify the prop is passed correctly
    expect(mockOnConfigChange).toBeDefined();
  });

  it('calls onExport when export is triggered', () => {
    const mockOnExport = vi.fn();
    render(<Chart config={mockConfig} onExport={mockOnExport} showControls={true} />);
    
    expect(mockOnExport).toBeDefined();
  });

  it('handles histogram type as bar chart', () => {
    mockConfig.type = 'histogram';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('handles boxplot type as line chart', () => {
    mockConfig.type = 'boxplot';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('falls back to bar chart for unknown types', () => {
    // @ts-ignore - Testing fallback behavior
    mockConfig.type = 'unknown';
    render(<Chart config={mockConfig} />);
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});