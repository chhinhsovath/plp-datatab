import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Complete Data Analysis Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should complete full data analysis workflow', async ({ page }) => {
    // Step 1: Upload data
    await page.click('[data-testid="upload-data-button"]');
    
    // Create test CSV file content
    const testCsvContent = `name,age,score,group
John,25,85,A
Jane,30,92,A
Bob,35,78,B
Alice,28,88,B
Charlie,32,95,A
Diana,29,82,B`;
    
    // Upload file (simulate file upload)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(testCsvContent)
    });
    
    // Configure upload options
    await page.check('[data-testid="has-header-checkbox"]');
    await page.selectOption('[data-testid="delimiter-select"]', ',');
    
    // Submit upload
    await page.click('[data-testid="upload-button"]');
    
    // Wait for upload success
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();
    
    // Step 2: Data preprocessing
    await page.click('[data-testid="preprocess-data-button"]');
    
    // Check data summary
    await expect(page.locator('[data-testid="data-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="column-info"]')).toContainText('name');
    await expect(page.locator('[data-testid="column-info"]')).toContainText('age');
    await expect(page.locator('[data-testid="column-info"]')).toContainText('score');
    
    // Handle missing values (if any)
    const missingValuesSection = page.locator('[data-testid="missing-values-section"]');
    if (await missingValuesSection.isVisible()) {
      await page.selectOption('[data-testid="missing-value-method"]', 'mean');
      await page.click('[data-testid="handle-missing-values-button"]');
    }
    
    // Check for outliers
    await page.click('[data-testid="detect-outliers-button"]');
    await expect(page.locator('[data-testid="outliers-result"]')).toBeVisible();
    
    // Step 3: Statistical analysis
    await page.click('[data-testid="analyze-data-button"]');
    
    // Descriptive statistics
    await page.click('[data-testid="descriptive-stats-tab"]');
    await page.selectOption('[data-testid="variable-select"]', 'score');
    await page.click('[data-testid="calculate-stats-button"]');
    
    // Wait for results
    await expect(page.locator('[data-testid="descriptive-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="mean-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="median-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="std-dev-value"]')).toBeVisible();
    
    // T-test analysis
    await page.click('[data-testid="ttest-tab"]');
    await page.selectOption('[data-testid="ttest-variable"]', 'score');
    await page.selectOption('[data-testid="ttest-group"]', 'group');
    await page.click('[data-testid="run-ttest-button"]');
    
    // Wait for t-test results
    await expect(page.locator('[data-testid="ttest-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="t-statistic"]')).toBeVisible();
    await expect(page.locator('[data-testid="p-value"]')).toBeVisible();
    
    // ANOVA analysis
    await page.click('[data-testid="anova-tab"]');
    await page.selectOption('[data-testid="anova-dependent"]', 'score');
    await page.selectOption('[data-testid="anova-independent"]', 'group');
    await page.click('[data-testid="run-anova-button"]');
    
    // Wait for ANOVA results
    await expect(page.locator('[data-testid="anova-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="f-statistic"]')).toBeVisible();
    await expect(page.locator('[data-testid="anova-p-value"]')).toBeVisible();
    
    // Step 4: Data visualization
    await page.click('[data-testid="visualize-data-button"]');
    
    // Create histogram
    await page.click('[data-testid="histogram-button"]');
    await page.selectOption('[data-testid="histogram-variable"]', 'score');
    await page.click('[data-testid="create-histogram-button"]');
    
    // Wait for chart to render
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    
    // Create scatter plot
    await page.click('[data-testid="scatter-plot-button"]');
    await page.selectOption('[data-testid="scatter-x-variable"]', 'age');
    await page.selectOption('[data-testid="scatter-y-variable"]', 'score');
    await page.click('[data-testid="create-scatter-button"]');
    
    // Wait for scatter plot
    await expect(page.locator('[data-testid="scatter-chart"]')).toBeVisible();
    
    // Customize chart
    await page.click('[data-testid="customize-chart-button"]');
    await page.fill('[data-testid="chart-title-input"]', 'Age vs Score Analysis');
    await page.fill('[data-testid="x-axis-label-input"]', 'Age (years)');
    await page.fill('[data-testid="y-axis-label-input"]', 'Score');
    await page.click('[data-testid="apply-customization-button"]');
    
    // Verify customization
    await expect(page.locator('[data-testid="chart-title"]')).toContainText('Age vs Score Analysis');
    
    // Step 5: Report generation
    await page.click('[data-testid="generate-report-button"]');
    
    // Fill report details
    await page.fill('[data-testid="report-title-input"]', 'Data Analysis Report');
    await page.fill('[data-testid="report-description-input"]', 'Comprehensive analysis of test data');
    
    // Add sections to report
    await page.click('[data-testid="add-section-button"]');
    await page.selectOption('[data-testid="section-type-select"]', 'text');
    await page.fill('[data-testid="section-content-input"]', 'This report presents the analysis of our test dataset.');
    
    await page.click('[data-testid="add-section-button"]');
    await page.selectOption('[data-testid="section-type-select"]', 'analysis');
    await page.selectOption('[data-testid="analysis-select"]', 'descriptive-stats');
    
    await page.click('[data-testid="add-section-button"]');
    await page.selectOption('[data-testid="section-type-select"]', 'visualization');
    await page.selectOption('[data-testid="chart-select"]', 'histogram');
    
    // Generate report
    await page.click('[data-testid="create-report-button"]');
    
    // Wait for report generation
    await expect(page.locator('[data-testid="report-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="report-preview"]')).toBeVisible();
    
    // Export report
    await page.click('[data-testid="export-report-button"]');
    await page.selectOption('[data-testid="export-format-select"]', 'pdf');
    await page.click('[data-testid="confirm-export-button"]');
    
    // Wait for export completion
    await expect(page.locator('[data-testid="export-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="download-link"]')).toBeVisible();
  });

  test('should handle data upload errors gracefully', async ({ page }) => {
    await page.click('[data-testid="upload-data-button"]');
    
    // Try to upload invalid file
    const invalidContent = 'This is not a valid CSV file';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(invalidContent)
    });
    
    await page.click('[data-testid="upload-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid file format');
  });

  test('should handle large dataset upload', async ({ page }) => {
    await page.click('[data-testid="upload-data-button"]');
    
    // Create large CSV content
    let largeCsvContent = 'id,value,category\n';
    for (let i = 1; i <= 1000; i++) {
      largeCsvContent += `${i},${Math.random() * 100},Category${i % 10}\n`;
    }
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-dataset.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(largeCsvContent)
    });
    
    await page.check('[data-testid="has-header-checkbox"]');
    await page.click('[data-testid="upload-button"]');
    
    // Should show loading indicator
    await expect(page.locator('[data-testid="upload-loading"]')).toBeVisible();
    
    // Wait for upload completion (with longer timeout for large file)
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('[data-testid="data-preview"]')).toBeVisible();
    
    // Verify data summary shows correct row count
    await expect(page.locator('[data-testid="row-count"]')).toContainText('1000');
  });

  test('should save and load analysis sessions', async ({ page }) => {
    // Upload data first
    await page.click('[data-testid="upload-data-button"]');
    
    const testCsvContent = 'name,score\nJohn,85\nJane,92\nBob,78';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'session-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(testCsvContent)
    });
    
    await page.check('[data-testid="has-header-checkbox"]');
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Perform some analysis
    await page.click('[data-testid="analyze-data-button"]');
    await page.selectOption('[data-testid="variable-select"]', 'score');
    await page.click('[data-testid="calculate-stats-button"]');
    await expect(page.locator('[data-testid="descriptive-results"]')).toBeVisible();
    
    // Save session
    await page.click('[data-testid="save-session-button"]');
    await page.fill('[data-testid="session-name-input"]', 'Test Analysis Session');
    await page.click('[data-testid="confirm-save-button"]');
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible();
    
    // Navigate away and back
    await page.click('[data-testid="dashboard-link"]');
    await expect(page).toHaveURL('/dashboard');
    
    // Load saved session
    await page.click('[data-testid="load-session-button"]');
    await page.click('[data-testid="session-Test Analysis Session"]');
    await page.click('[data-testid="confirm-load-button"]');
    
    // Verify session was loaded correctly
    await expect(page.locator('[data-testid="descriptive-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-name"]')).toContainText('Test Analysis Session');
  });

  test('should handle collaborative features', async ({ page, context }) => {
    // Create a project for collaboration
    await page.click('[data-testid="create-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Collaborative Analysis Project');
    await page.fill('[data-testid="project-description-input"]', 'Testing collaboration features');
    await page.click('[data-testid="create-project-confirm-button"]');
    
    await expect(page.locator('[data-testid="project-created-success"]')).toBeVisible();
    
    // Upload data to project
    await page.click('[data-testid="upload-to-project-button"]');
    const testCsvContent = 'name,value\nTest1,10\nTest2,20\nTest3,30';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'collab-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(testCsvContent)
    });
    
    await page.check('[data-testid="has-header-checkbox"]');
    await page.click('[data-testid="upload-button"]');
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
    
    // Add a comment to the project
    await page.click('[data-testid="add-comment-button"]');
    await page.fill('[data-testid="comment-input"]', 'This is a test comment for collaboration');
    await page.click('[data-testid="submit-comment-button"]');
    
    // Verify comment appears
    await expect(page.locator('[data-testid="comment-list"]')).toContainText('This is a test comment for collaboration');
    
    // Share project (simulate sharing)
    await page.click('[data-testid="share-project-button"]');
    await page.fill('[data-testid="share-email-input"]', 'collaborator@example.com');
    await page.selectOption('[data-testid="permission-select"]', 'editor');
    await page.click('[data-testid="send-invitation-button"]');
    
    await expect(page.locator('[data-testid="invitation-sent"]')).toBeVisible();
  });
});