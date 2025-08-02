import { test, expect } from '@playwright/test';

test.describe('Complete User Workflow Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Login with test user
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword');
    await page.click('[data-testid="login-button"]');
    
    // Wait for dashboard to load
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('complete data analysis workflow', async ({ page }) => {
    // Step 1: Create a new project
    await page.click('[data-testid="projects-nav"]');
    await page.click('[data-testid="new-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Test Analysis Project');
    await page.fill('[data-testid="project-description-input"]', 'Integration test project');
    await page.click('[data-testid="create-project-button"]');
    
    // Verify project creation
    await expect(page.locator('text=Test Analysis Project')).toBeVisible();
    
    // Step 2: Upload data file
    await page.click('[data-testid="upload-nav"]');
    
    // Upload CSV file
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles('test-data/sample_data.csv');
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Verify data preview
    await expect(page.locator('[data-testid="data-preview-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-count"]')).toContainText('columns');
    await expect(page.locator('[data-testid="row-count"]')).toContainText('rows');
    
    // Step 3: Data preprocessing
    await page.click('[data-testid="preprocess-data-button"]');
    
    // Handle missing values
    await page.click('[data-testid="missing-values-tab"]');
    await page.selectOption('[data-testid="missing-value-strategy"]', 'mean');
    await page.click('[data-testid="apply-preprocessing"]');
    
    // Wait for preprocessing to complete
    await expect(page.locator('[data-testid="preprocessing-success"]')).toBeVisible();
    
    // Step 4: Statistical analysis
    await page.click('[data-testid="analysis-nav"]');
    
    // Select dataset
    await page.selectOption('[data-testid="dataset-selector"]', 'sample_data.csv');
    
    // Perform descriptive statistics
    await page.click('[data-testid="descriptive-stats-button"]');
    await page.click('[data-testid="run-analysis-button"]');
    
    // Wait for results
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="mean-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="std-dev-value"]')).toBeVisible();
    
    // Perform t-test
    await page.click('[data-testid="hypothesis-tests-tab"]');
    await page.selectOption('[data-testid="test-type-selector"]', 'one-sample-t-test');
    await page.selectOption('[data-testid="variable-selector"]', 'numeric_column');
    await page.fill('[data-testid="test-value-input"]', '0');
    await page.click('[data-testid="run-test-button"]');
    
    // Verify test results
    await expect(page.locator('[data-testid="test-statistic"]')).toBeVisible();
    await expect(page.locator('[data-testid="p-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="confidence-interval"]')).toBeVisible();
    
    // Step 5: Create visualization
    await page.click('[data-testid="visualizations-nav"]');
    await page.selectOption('[data-testid="chart-type-selector"]', 'histogram');
    await page.selectOption('[data-testid="x-axis-variable"]', 'numeric_column');
    await page.click('[data-testid="create-chart-button"]');
    
    // Verify chart creation
    await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
    
    // Customize chart
    await page.click('[data-testid="customize-chart-button"]');
    await page.fill('[data-testid="chart-title-input"]', 'Distribution Analysis');
    await page.click('[data-testid="apply-customization"]');
    
    // Step 6: Generate report
    await page.click('[data-testid="reports-nav"]');
    await page.click('[data-testid="create-report-button"]');
    
    // Add report content
    await page.fill('[data-testid="report-title-input"]', 'Statistical Analysis Report');
    await page.fill('[data-testid="report-description-input"]', 'Comprehensive analysis of sample data');
    
    // Add analysis results to report
    await page.click('[data-testid="add-analysis-section"]');
    await page.selectOption('[data-testid="analysis-selector"]', 'descriptive-stats');
    await page.click('[data-testid="add-section-button"]');
    
    // Add visualization to report
    await page.click('[data-testid="add-visualization-section"]');
    await page.selectOption('[data-testid="chart-selector"]', 'histogram');
    await page.click('[data-testid="add-section-button"]');
    
    // Save report
    await page.click('[data-testid="save-report-button"]');
    await expect(page.locator('[data-testid="report-saved-message"]')).toBeVisible();
    
    // Step 7: Export report
    await page.click('[data-testid="export-report-button"]');
    await page.selectOption('[data-testid="export-format-selector"]', 'pdf');
    await page.click('[data-testid="confirm-export-button"]');
    
    // Wait for export to complete
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
    
    // Step 8: Collaboration features
    await page.click('[data-testid="share-project-button"]');
    await page.fill('[data-testid="collaborator-email-input"]', 'collaborator@example.com');
    await page.selectOption('[data-testid="permission-level"]', 'editor');
    await page.click('[data-testid="send-invitation-button"]');
    
    // Verify invitation sent
    await expect(page.locator('[data-testid="invitation-sent-message"]')).toBeVisible();
  });

  test('data validation and error handling', async ({ page }) => {
    // Test invalid file upload
    await page.click('[data-testid="upload-nav"]');
    
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles('test-data/invalid_file.txt');
    
    // Verify error message
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('text=Unsupported file format')).toBeVisible();
    
    // Test analysis with insufficient data
    await page.click('[data-testid="analysis-nav"]');
    await page.selectOption('[data-testid="test-type-selector"]', 'two-sample-t-test');
    await page.click('[data-testid="run-test-button"]');
    
    // Verify error message for insufficient data
    await expect(page.locator('[data-testid="analysis-error"]')).toBeVisible();
    await expect(page.locator('text=Insufficient data for analysis')).toBeVisible();
  });

  test('performance with large dataset', async ({ page }) => {
    // Upload large dataset
    await page.click('[data-testid="upload-nav"]');
    
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles('test-data/large_dataset.csv');
    
    // Monitor upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    
    // Wait for upload to complete (with extended timeout for large files)
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    
    // Test analysis performance
    await page.click('[data-testid="analysis-nav"]');
    await page.selectOption('[data-testid="dataset-selector"]', 'large_dataset.csv');
    
    const startTime = Date.now();
    await page.click('[data-testid="descriptive-stats-button"]');
    await page.click('[data-testid="run-analysis-button"]');
    
    await expect(page.locator('[data-testid="analysis-results"]')).toBeVisible({ timeout: 15000 });
    const endTime = Date.now();
    
    // Verify analysis completed within reasonable time
    expect(endTime - startTime).toBeLessThan(15000);
  });

  test('cross-browser compatibility', async ({ page, browserName }) => {
    // Test core functionality across different browsers
    console.log(`Testing on ${browserName}`);
    
    // Upload and analyze data
    await page.click('[data-testid="upload-nav"]');
    const fileInput = page.locator('[data-testid="file-upload-input"]');
    await fileInput.setInputFiles('test-data/sample_data.csv');
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Create visualization
    await page.click('[data-testid="visualizations-nav"]');
    await page.selectOption('[data-testid="chart-type-selector"]', 'scatter');
    await page.click('[data-testid="create-chart-button"]');
    await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
    
    // Verify chart interactivity
    await page.hover('[data-testid="chart-canvas"]');
    await expect(page.locator('[data-testid="chart-tooltip"]')).toBeVisible();
  });

  test('mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Test navigation on mobile
    await page.click('[data-testid="mobile-menu-button"]');
    await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    
    // Test upload on mobile
    await page.click('[data-testid="upload-nav-mobile"]');
    await expect(page.locator('[data-testid="mobile-upload-area"]')).toBeVisible();
    
    // Test chart responsiveness
    await page.click('[data-testid="visualizations-nav-mobile"]');
    await page.selectOption('[data-testid="chart-type-selector"]', 'bar');
    await page.click('[data-testid="create-chart-button"]');
    
    // Verify chart adapts to mobile viewport
    const chartElement = page.locator('[data-testid="chart-canvas"]');
    await expect(chartElement).toBeVisible();
    
    const boundingBox = await chartElement.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(375);
  });

  test('accessibility compliance', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Test screen reader compatibility
    const uploadButton = page.locator('[data-testid="upload-nav"]');
    await expect(uploadButton).toHaveAttribute('aria-label');
    
    // Test color contrast and focus indicators
    await page.click('[data-testid="analysis-nav"]');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toHaveCSS('outline-width', /\d+px/);
    
    // Test form labels and descriptions
    await page.click('[data-testid="create-report-button"]');
    const titleInput = page.locator('[data-testid="report-title-input"]');
    await expect(titleInput).toHaveAttribute('aria-describedby');
  });
});