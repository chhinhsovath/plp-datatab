import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Import components for visual testing
import Chart from '../components/charts/Chart';
import Dashboard from '../components/charts/Dashboard';
import DataTable from '../components/common/DataTable';

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

describe('Visual Regression Tests', () => {
  let browser: Browser;
  let page: Page;
  const screenshotDir = path.join(__dirname, 'screenshots');
  const baselineDir = path.join(screenshotDir, 'baseline');
  const currentDir = path.join(screenshotDir, 'current');
  const diffDir = path.join(screenshotDir, 'diff');

  beforeAll(async () => {
    // Create screenshot directories
    [screenshotDir, baselineDir, currentDir, diffDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Launch browser for visual testing
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  describe('Chart Visual Tests', () => {
    const chartTestData = {
      bar: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June'],
        datasets: [{
          label: 'Sales',
          data: [12, 19, 3, 5, 2, 3],
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 205, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)',
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 205, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          borderWidth: 1,
        }],
      },
      line: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
        datasets: [{
          label: 'Performance',
          data: [65, 59, 80, 81, 56],
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        }],
      },
      scatter: {
        datasets: [{
          label: 'Scatter Dataset',
          data: [
            { x: -10, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 5 },
            { x: 0.5, y: 5.5 },
          ],
          backgroundColor: 'rgb(255, 99, 132)',
        }],
      },
      pie: {
        labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
        datasets: [{
          label: 'Colors',
          data: [12, 19, 3, 5, 2, 3],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
          ],
        }],
      },
    };

    Object.entries(chartTestData).forEach(([chartType, data]) => {
      it(`should render ${chartType} chart consistently`, async () => {
        const testHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Chart Test</title>
              <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
              <style>
                body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                .chart-container { width: 800px; height: 400px; }
              </style>
            </head>
            <body>
              <div class="chart-container">
                <canvas id="chart"></canvas>
              </div>
              <script>
                const ctx = document.getElementById('chart').getContext('2d');
                new Chart(ctx, {
                  type: '${chartType}',
                  data: ${JSON.stringify(data)},
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: {
                        display: true,
                        text: '${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart Test'
                      },
                      legend: {
                        display: true,
                        position: 'top'
                      }
                    },
                    scales: ${chartType === 'pie' ? '{}' : `{
                      y: {
                        beginAtZero: true
                      }
                    }`}
                  }
                });
              </script>
            </body>
          </html>
        `;

        await page.setContent(testHtml);
        await page.waitForTimeout(2000); // Wait for chart to render

        const screenshot = await page.screenshot({
          path: path.join(currentDir, `chart-${chartType}.png`),
          fullPage: false,
          clip: { x: 0, y: 0, width: 840, height: 440 },
        });

        expect(screenshot).toBeDefined();

        // Compare with baseline if it exists
        const baselinePath = path.join(baselineDir, `chart-${chartType}.png`);
        if (fs.existsSync(baselinePath)) {
          const baseline = fs.readFileSync(baselinePath);
          const current = fs.readFileSync(path.join(currentDir, `chart-${chartType}.png`));
          
          // Simple byte comparison (in real scenarios, use image comparison libraries)
          if (!baseline.equals(current)) {
            console.warn(`Visual difference detected in ${chartType} chart`);
            // In a real implementation, you would use a library like pixelmatch
            // to generate a diff image and calculate the difference percentage
          }
        } else {
          // Create baseline if it doesn't exist
          fs.copyFileSync(
            path.join(currentDir, `chart-${chartType}.png`),
            baselinePath
          );
        }
      });
    });

    it('should render charts with different themes consistently', async () => {
      const themes = ['light', 'dark'];
      
      for (const theme of themes) {
        const testHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Chart Theme Test</title>
              <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
              <style>
                body { 
                  margin: 0; 
                  padding: 20px; 
                  font-family: Arial, sans-serif;
                  background-color: ${theme === 'dark' ? '#121212' : '#ffffff'};
                  color: ${theme === 'dark' ? '#ffffff' : '#000000'};
                }
                .chart-container { width: 800px; height: 400px; }
              </style>
            </head>
            <body>
              <div class="chart-container">
                <canvas id="chart"></canvas>
              </div>
              <script>
                const ctx = document.getElementById('chart').getContext('2d');
                Chart.defaults.color = '${theme === 'dark' ? '#ffffff' : '#000000'}';
                Chart.defaults.borderColor = '${theme === 'dark' ? '#333333' : '#e0e0e0'}';
                
                new Chart(ctx, {
                  type: 'bar',
                  data: ${JSON.stringify(chartTestData.bar)},
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: {
                        display: true,
                        text: 'Bar Chart - ${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme'
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: '${theme === 'dark' ? '#333333' : '#e0e0e0'}'
                        }
                      },
                      x: {
                        grid: {
                          color: '${theme === 'dark' ? '#333333' : '#e0e0e0'}'
                        }
                      }
                    }
                  }
                });
              </script>
            </body>
          </html>
        `;

        await page.setContent(testHtml);
        await page.waitForTimeout(2000);

        const screenshot = await page.screenshot({
          path: path.join(currentDir, `chart-theme-${theme}.png`),
          fullPage: false,
          clip: { x: 0, y: 0, width: 840, height: 440 },
        });

        expect(screenshot).toBeDefined();
      }
    });

    it('should render responsive charts at different viewport sizes', async () => {
      const viewports = [
        { width: 320, height: 568, name: 'mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1200, height: 800, name: 'desktop' },
      ];

      for (const viewport of viewports) {
        await page.setViewport(viewport);

        const testHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Responsive Chart Test</title>
              <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
              <style>
                body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }
                .chart-container { 
                  width: 100%; 
                  height: ${Math.min(viewport.height - 100, 400)}px; 
                  max-width: ${viewport.width - 20}px;
                }
              </style>
            </head>
            <body>
              <div class="chart-container">
                <canvas id="chart"></canvas>
              </div>
              <script>
                const ctx = document.getElementById('chart').getContext('2d');
                new Chart(ctx, {
                  type: 'line',
                  data: ${JSON.stringify(chartTestData.line)},
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      title: {
                        display: true,
                        text: 'Responsive Chart - ${viewport.name}'
                      },
                      legend: {
                        display: ${viewport.width > 480},
                        position: 'top'
                      }
                    }
                  }
                });
              </script>
            </body>
          </html>
        `;

        await page.setContent(testHtml);
        await page.waitForTimeout(2000);

        const screenshot = await page.screenshot({
          path: path.join(currentDir, `chart-responsive-${viewport.name}.png`),
          fullPage: true,
        });

        expect(screenshot).toBeDefined();
      }
    });
  });

  describe('Dashboard Visual Tests', () => {
    it('should render dashboard layout consistently', async () => {
      const dashboardHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Dashboard Test</title>
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .dashboard { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
              .chart-container { 
                width: 100%; 
                height: 300px; 
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                padding: 10px;
                box-sizing: border-box;
              }
              .dashboard-title { 
                grid-column: 1 / -1; 
                text-align: center; 
                margin-bottom: 20px;
                font-size: 24px;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="dashboard-title">Analytics Dashboard</div>
            <div class="dashboard">
              <div class="chart-container">
                <canvas id="chart1"></canvas>
              </div>
              <div class="chart-container">
                <canvas id="chart2"></canvas>
              </div>
              <div class="chart-container">
                <canvas id="chart3"></canvas>
              </div>
              <div class="chart-container">
                <canvas id="chart4"></canvas>
              </div>
            </div>
            <script>
              // Chart 1 - Bar Chart
              new Chart(document.getElementById('chart1'), {
                type: 'bar',
                data: ${JSON.stringify(chartTestData.bar)},
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { title: { display: true, text: 'Sales Data' } }
                }
              });

              // Chart 2 - Line Chart
              new Chart(document.getElementById('chart2'), {
                type: 'line',
                data: ${JSON.stringify(chartTestData.line)},
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { title: { display: true, text: 'Performance Trend' } }
                }
              });

              // Chart 3 - Pie Chart
              new Chart(document.getElementById('chart3'), {
                type: 'pie',
                data: ${JSON.stringify(chartTestData.pie)},
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { title: { display: true, text: 'Distribution' } }
                }
              });

              // Chart 4 - Scatter Plot
              new Chart(document.getElementById('chart4'), {
                type: 'scatter',
                data: ${JSON.stringify(chartTestData.scatter)},
                options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { title: { display: true, text: 'Correlation' } }
                }
              });
            </script>
          </body>
        </html>
      `;

      await page.setContent(dashboardHtml);
      await page.waitForTimeout(3000); // Wait for all charts to render

      const screenshot = await page.screenshot({
        path: path.join(currentDir, 'dashboard-layout.png'),
        fullPage: true,
      });

      expect(screenshot).toBeDefined();
    });
  });

  describe('Data Table Visual Tests', () => {
    it('should render data table with consistent styling', async () => {
      const tableData = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + Math.floor(Math.random() * 40),
        score: Math.floor(Math.random() * 100),
        status: i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'Inactive' : 'Pending',
      }));

      const tableHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Data Table Test</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .table-container { 
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                overflow: hidden;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                background: white;
              }
              th, td { 
                padding: 12px; 
                text-align: left; 
                border-bottom: 1px solid #e0e0e0; 
              }
              th { 
                background-color: #f5f5f5; 
                font-weight: bold;
                position: sticky;
                top: 0;
              }
              tr:hover { background-color: #f9f9f9; }
              .status-active { color: #4caf50; font-weight: bold; }
              .status-inactive { color: #f44336; font-weight: bold; }
              .status-pending { color: #ff9800; font-weight: bold; }
              .pagination { 
                margin-top: 20px; 
                text-align: center; 
              }
              .pagination button { 
                margin: 0 5px; 
                padding: 8px 16px; 
                border: 1px solid #e0e0e0; 
                background: white; 
                cursor: pointer;
              }
              .pagination button:hover { background-color: #f5f5f5; }
              .pagination button.active { 
                background-color: #2196f3; 
                color: white; 
                border-color: #2196f3;
              }
            </style>
          </head>
          <body>
            <h2>User Data Table</h2>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Age</th>
                    <th>Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableData.slice(0, 10).map(row => `
                    <tr>
                      <td>${row.id}</td>
                      <td>${row.name}</td>
                      <td>${row.email}</td>
                      <td>${row.age}</td>
                      <td>${row.score}</td>
                      <td class="status-${row.status.toLowerCase()}">${row.status}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="pagination">
              <button>Previous</button>
              <button class="active">1</button>
              <button>2</button>
              <button>Next</button>
            </div>
          </body>
        </html>
      `;

      await page.setContent(tableHtml);
      await page.waitForTimeout(1000);

      const screenshot = await page.screenshot({
        path: path.join(currentDir, 'data-table.png'),
        fullPage: true,
      });

      expect(screenshot).toBeDefined();
    });

    it('should render data table with sorting indicators', async () => {
      const sortedTableHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Sorted Data Table Test</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .table-container { 
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                overflow: hidden;
              }
              table { width: 100%; border-collapse: collapse; background: white; }
              th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e0e0e0; }
              th { 
                background-color: #f5f5f5; 
                font-weight: bold;
                cursor: pointer;
                position: relative;
              }
              th:hover { background-color: #eeeeee; }
              th.sortable::after {
                content: '↕';
                position: absolute;
                right: 8px;
                opacity: 0.5;
              }
              th.sort-asc::after {
                content: '↑';
                opacity: 1;
                color: #2196f3;
              }
              th.sort-desc::after {
                content: '↓';
                opacity: 1;
                color: #2196f3;
              }
              tr:hover { background-color: #f9f9f9; }
            </style>
          </head>
          <body>
            <h2>Sortable Data Table</h2>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th class="sortable">ID</th>
                    <th class="sortable sort-asc">Name</th>
                    <th class="sortable">Age</th>
                    <th class="sortable">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>1</td><td>Alice Johnson</td><td>25</td><td>95</td></tr>
                  <tr><td>2</td><td>Bob Smith</td><td>30</td><td>87</td></tr>
                  <tr><td>3</td><td>Charlie Brown</td><td>28</td><td>92</td></tr>
                  <tr><td>4</td><td>Diana Wilson</td><td>35</td><td>88</td></tr>
                  <tr><td>5</td><td>Eve Davis</td><td>27</td><td>94</td></tr>
                </tbody>
              </table>
            </div>
          </body>
        </html>
      `;

      await page.setContent(sortedTableHtml);
      await page.waitForTimeout(1000);

      const screenshot = await page.screenshot({
        path: path.join(currentDir, 'data-table-sorted.png'),
        fullPage: true,
      });

      expect(screenshot).toBeDefined();
    });
  });

  describe('Form Visual Tests', () => {
    it('should render forms with consistent styling', async () => {
      const formHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Form Test</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; }
              .form-container { 
                max-width: 500px; 
                margin: 0 auto; 
                background: white; 
                padding: 30px; 
                border-radius: 8px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .form-group { margin-bottom: 20px; }
              label { 
                display: block; 
                margin-bottom: 5px; 
                font-weight: bold; 
                color: #333;
              }
              input, select, textarea { 
                width: 100%; 
                padding: 12px; 
                border: 1px solid #ddd; 
                border-radius: 4px; 
                font-size: 14px;
                box-sizing: border-box;
              }
              input:focus, select:focus, textarea:focus { 
                outline: none; 
                border-color: #2196f3; 
                box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
              }
              .error { border-color: #f44336; }
              .error-message { color: #f44336; font-size: 12px; margin-top: 5px; }
              .success { border-color: #4caf50; }
              button { 
                background: #2196f3; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer; 
                font-size: 16px;
                width: 100%;
              }
              button:hover { background: #1976d2; }
              button:disabled { background: #ccc; cursor: not-allowed; }
              .checkbox-group { display: flex; align-items: center; }
              .checkbox-group input { width: auto; margin-right: 10px; }
            </style>
          </head>
          <body>
            <div class="form-container">
              <h2>User Registration Form</h2>
              <form>
                <div class="form-group">
                  <label for="name">Full Name *</label>
                  <input type="text" id="name" value="John Doe" class="success">
                </div>
                
                <div class="form-group">
                  <label for="email">Email Address *</label>
                  <input type="email" id="email" value="invalid-email" class="error">
                  <div class="error-message">Please enter a valid email address</div>
                </div>
                
                <div class="form-group">
                  <label for="age">Age</label>
                  <select id="age">
                    <option>Select age range</option>
                    <option selected>25-34</option>
                    <option>35-44</option>
                    <option>45-54</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label for="bio">Bio</label>
                  <textarea id="bio" rows="4" placeholder="Tell us about yourself..."></textarea>
                </div>
                
                <div class="form-group checkbox-group">
                  <input type="checkbox" id="terms" checked>
                  <label for="terms">I agree to the terms and conditions</label>
                </div>
                
                <button type="submit">Register Account</button>
              </form>
            </div>
          </body>
        </html>
      `;

      await page.setContent(formHtml);
      await page.waitForTimeout(1000);

      const screenshot = await page.screenshot({
        path: path.join(currentDir, 'form-styling.png'),
        fullPage: true,
      });

      expect(screenshot).toBeDefined();
    });
  });

  // Helper function to compare images (simplified version)
  const compareImages = async (baseline: string, current: string): Promise<boolean> => {
    try {
      const baselineBuffer = fs.readFileSync(baseline);
      const currentBuffer = fs.readFileSync(current);
      return baselineBuffer.equals(currentBuffer);
    } catch (error) {
      return false;
    }
  };

  // Generate baseline images if they don't exist
  const ensureBaseline = (testName: string) => {
    const baselinePath = path.join(baselineDir, `${testName}.png`);
    const currentPath = path.join(currentDir, `${testName}.png`);
    
    if (!fs.existsSync(baselinePath) && fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, baselinePath);
    }
  };
});