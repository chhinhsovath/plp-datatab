import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Import components to test
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import FileUpload from '../components/upload/FileUpload';
import DataTable from '../components/common/DataTable';
import Chart from '../components/charts/Chart';
import ReportEditor from '../components/reports/ReportEditor';
import Dashboard from '../components/charts/Dashboard';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const theme = createTheme({
    palette: {
      mode: 'light',
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

describe('Accessibility Tests (WCAG 2.1 AA Compliance)', () => {
  describe('Authentication Components', () => {
    it('LoginForm should be accessible', async () => {
      const { container } = render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper form labels
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

      // Check for proper button labeling
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('RegisterForm should be accessible', async () => {
      const { container } = render(
        <TestWrapper>
          <RegisterForm />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper form labels
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

      // Check for password requirements description
      expect(screen.getByText(/password must be/i)).toBeInTheDocument();
    });
  });

  describe('Data Upload Components', () => {
    it('FileUpload should be accessible', async () => {
      const mockOnUpload = vi.fn();
      const { container } = render(
        <TestWrapper>
          <FileUpload onUpload={mockOnUpload} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper file input labeling
      const fileInput = screen.getByLabelText(/choose file/i);
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('accept', '.csv,.xlsx,.xls,.json');

      // Check for drag and drop accessibility
      const dropzone = screen.getByRole('button', { name: /drag.*drop.*files/i });
      expect(dropzone).toBeInTheDocument();
      expect(dropzone).toHaveAttribute('tabindex', '0');

      // Check for file format instructions
      expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
    });
  });

  describe('Data Display Components', () => {
    it('DataTable should be accessible', async () => {
      const mockData = [
        { id: 1, name: 'John Doe', age: 30, score: 85 },
        { id: 2, name: 'Jane Smith', age: 25, score: 92 },
        { id: 3, name: 'Bob Johnson', age: 35, score: 78 },
      ];

      const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'age', label: 'Age', sortable: true },
        { key: 'score', label: 'Score', sortable: true },
      ];

      const { container } = render(
        <TestWrapper>
          <DataTable data={mockData} columns={mockColumns} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper table structure
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      expect(table).toHaveAttribute('aria-label');

      // Check for proper column headers
      expect(screen.getByRole('columnheader', { name: /name/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /age/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /score/i })).toBeInTheDocument();

      // Check for sortable column indicators
      const sortableHeaders = screen.getAllByRole('button', { name: /sort by/i });
      expect(sortableHeaders.length).toBeGreaterThan(0);

      // Check for proper row structure
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBe(4); // 3 data rows + 1 header row
    });

    it('DataTable with pagination should be accessible', async () => {
      const mockData = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        value: Math.random() * 100,
      }));

      const mockColumns = [
        { key: 'name', label: 'Name' },
        { key: 'value', label: 'Value' },
      ];

      const { container } = render(
        <TestWrapper>
          <DataTable 
            data={mockData} 
            columns={mockColumns} 
            pagination={{ pageSize: 10, currentPage: 1 }}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for pagination controls
      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();

      // Check for page information
      expect(screen.getByText(/page \d+ of \d+/i)).toBeInTheDocument();
    });
  });

  describe('Chart Components', () => {
    it('Chart should be accessible', async () => {
      const mockChartData = {
        labels: ['January', 'February', 'March', 'April', 'May'],
        datasets: [{
          label: 'Sales Data',
          data: [12, 19, 3, 5, 2],
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
        }],
      };

      const { container } = render(
        <TestWrapper>
          <Chart 
            type="bar" 
            data={mockChartData} 
            title="Monthly Sales"
            description="Bar chart showing monthly sales data"
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper chart labeling
      expect(screen.getByRole('img', { name: /monthly sales/i })).toBeInTheDocument();

      // Check for chart description
      expect(screen.getByText(/bar chart showing monthly sales data/i)).toBeInTheDocument();

      // Check for data table alternative
      expect(screen.getByRole('button', { name: /view data table/i })).toBeInTheDocument();
    });

    it('Dashboard with multiple charts should be accessible', async () => {
      const mockDashboardData = {
        charts: [
          {
            id: 'chart1',
            type: 'bar',
            title: 'Chart 1',
            data: { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] },
          },
          {
            id: 'chart2',
            type: 'line',
            title: 'Chart 2',
            data: { labels: ['X', 'Y'], datasets: [{ data: [3, 4] }] },
          },
        ],
      };

      const { container } = render(
        <TestWrapper>
          <Dashboard data={mockDashboardData} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper heading structure
      expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();

      // Check for chart regions
      const chartRegions = screen.getAllByRole('region');
      expect(chartRegions.length).toBeGreaterThan(0);

      // Check for skip links
      expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
    });
  });

  describe('Report Components', () => {
    it('ReportEditor should be accessible', async () => {
      const { container } = render(
        <TestWrapper>
          <ReportEditor />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper form structure
      expect(screen.getByRole('form')).toBeInTheDocument();

      // Check for editor labeling
      expect(screen.getByLabelText(/report title/i)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /report content/i })).toBeInTheDocument();

      // Check for toolbar accessibility
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar).toHaveAttribute('aria-label');

      // Check for formatting buttons
      expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    });
  });

  describe('Color Contrast and Visual Design', () => {
    it('should have sufficient color contrast for text', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <h1 style={{ color: '#000000', backgroundColor: '#ffffff' }}>
              High Contrast Heading
            </h1>
            <p style={{ color: '#333333', backgroundColor: '#ffffff' }}>
              This text should have sufficient contrast ratio.
            </p>
            <button style={{ color: '#ffffff', backgroundColor: '#0066cc' }}>
              Accessible Button
            </button>
          </div>
        </TestWrapper>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not rely solely on color for information', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <div role="alert" aria-label="Error message">
              <span style={{ color: 'red' }}>❌</span>
              <span>Error: Please fill in all required fields</span>
            </div>
            <div role="status" aria-label="Success message">
              <span style={{ color: 'green' }}>✅</span>
              <span>Success: Data uploaded successfully</span>
            </div>
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check that messages have both color and text/icon indicators
      expect(screen.getByText(/❌/)).toBeInTheDocument();
      expect(screen.getByText(/✅/)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for interactive elements', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <button>First Button</button>
            <input type="text" placeholder="Text Input" />
            <select>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <a href="#link">Link</a>
          </div>
        </TestWrapper>
      );

      const results = await axe(container, {
        rules: {
          'keyboard': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();

      // Check that all interactive elements are focusable
      const button = screen.getByRole('button', { name: /first button/i });
      const input = screen.getByRole('textbox');
      const select = screen.getByRole('combobox');
      const link = screen.getByRole('link');

      expect(button).toHaveAttribute('tabindex', '0');
      expect(input).not.toHaveAttribute('tabindex', '-1');
      expect(select).not.toHaveAttribute('tabindex', '-1');
      expect(link).not.toHaveAttribute('tabindex', '-1');
    });

    it('should have visible focus indicators', async () => {
      const { container } = render(
        <TestWrapper>
          <style>
            {`
              button:focus,
              input:focus,
              select:focus,
              a:focus {
                outline: 2px solid #0066cc;
                outline-offset: 2px;
              }
            `}
          </style>
          <div>
            <button>Focusable Button</button>
            <input type="text" placeholder="Focusable Input" />
          </div>
        </TestWrapper>
      );

      const results = await axe(container, {
        rules: {
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA labels and descriptions', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <button aria-label="Close dialog" aria-describedby="close-help">
              ×
            </button>
            <div id="close-help">Click to close the dialog</div>
            
            <input 
              type="text" 
              aria-label="Search datasets" 
              aria-describedby="search-help"
            />
            <div id="search-help">Enter keywords to search your datasets</div>
            
            <div role="status" aria-live="polite" aria-label="Loading status">
              Loading data...
            </div>
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper ARIA attributes
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Close dialog');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search datasets');
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide proper heading structure', async () => {
      const { container } = render(
        <TestWrapper>
          <div>
            <h1>Main Page Title</h1>
            <h2>Section Title</h2>
            <h3>Subsection Title</h3>
            <h2>Another Section</h2>
            <h3>Another Subsection</h3>
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check heading hierarchy
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2);
    });
  });

  describe('Form Accessibility', () => {
    it('should provide proper form validation messages', async () => {
      const { container } = render(
        <TestWrapper>
          <form>
            <div>
              <label htmlFor="email">Email Address *</label>
              <input 
                id="email" 
                type="email" 
                required 
                aria-describedby="email-error"
                aria-invalid="true"
              />
              <div id="email-error" role="alert">
                Please enter a valid email address
              </div>
            </div>
            
            <div>
              <label htmlFor="password">Password *</label>
              <input 
                id="password" 
                type="password" 
                required 
                aria-describedby="password-help"
                minLength={8}
              />
              <div id="password-help">
                Password must be at least 8 characters long
              </div>
            </div>
            
            <button type="submit">Submit Form</button>
          </form>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for proper form labeling
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

      // Check for error messages
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Check for required field indicators
      expect(screen.getByText(/email address \*/i)).toBeInTheDocument();
      expect(screen.getByText(/password \*/i)).toBeInTheDocument();
    });
  });

  describe('Mobile Accessibility', () => {
    it('should be accessible on mobile devices', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667,
      });

      const { container } = render(
        <TestWrapper>
          <div style={{ width: '100%', maxWidth: '375px' }}>
            <button style={{ minHeight: '44px', minWidth: '44px' }}>
              Mobile Button
            </button>
            <input 
              type="text" 
              style={{ minHeight: '44px', fontSize: '16px' }}
              placeholder="Mobile Input"
            />
          </div>
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check for minimum touch target sizes (44px x 44px)
      const button = screen.getByRole('button');
      const computedStyle = window.getComputedStyle(button);
      expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(computedStyle.minWidth)).toBeGreaterThanOrEqual(44);
    });
  });
});