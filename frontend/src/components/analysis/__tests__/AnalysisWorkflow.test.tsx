import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import AnalysisPage from '../../../pages/AnalysisPage';
import { dataApi } from '../../../services/api';
import { analysisApi } from '../../../services/analysisApi';

import { vi } from 'vitest';

// Mock the API modules
vi.mock('../../../services/api');
vi.mock('../../../services/analysisApi');

const mockDataApi = dataApi as any;
const mockAnalysisApi = analysisApi as any;

const theme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <BrowserRouter>
          {component}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

const mockDataset = {
  id: 'dataset-1',
  name: 'Test Dataset',
  columns: [
    { name: 'age', dataType: 'numeric' as const, missingValues: 0, uniqueValues: 50 },
    { name: 'gender', dataType: 'categorical' as const, missingValues: 0, uniqueValues: 2 },
    { name: 'score', dataType: 'numeric' as const, missingValues: 2, uniqueValues: 45 },
  ],
  rowCount: 100,
  fileSize: 5000,
  uploadedAt: '2024-01-01T00:00:00Z',
  userId: 'user-1',
};

const mockAnalysisResult = {
  analysisId: 'analysis-1',
  testType: 'descriptive',
  statistics: {
    mean: 25.5,
    median: 25.0,
    standardDeviation: 5.2,
    variance: 27.04,
    min: 18,
    max: 35,
    count: 98,
    nullCount: 2,
    skewness: 0.1,
    kurtosis: -0.5,
  },
  interpretation: 'The data shows a normal distribution with slight positive skew.',
  assumptions: [],
  summary: 'Descriptive statistics calculated for age variable with 98 valid observations.',
  recommendations: ['Consider checking for outliers', 'Verify data collection methods'],
};

describe('Analysis Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    mockDataApi.getDatasets = vi.fn().mockResolvedValue({
      data: { data: [mockDataset], success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    mockAnalysisApi.getTestSuggestions = vi.fn().mockResolvedValue({
      data: {
        suggestions: [
          {
            testName: 'Descriptive Statistics',
            testType: 'descriptive',
            reason: 'Good for exploring numeric data',
            assumptions: ['Data should be numeric'],
            confidence: 0.9,
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    mockAnalysisApi.calculateDescriptiveStats = vi.fn().mockResolvedValue({
      data: { data: mockAnalysisResult, success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  });

  test('completes full descriptive statistics workflow', async () => {
    renderWithProviders(<AnalysisPage />);

    // Step 1: Dataset selection should be visible
    await waitFor(() => {
      expect(screen.getByText('Select a Dataset for Analysis')).toBeInTheDocument();
    });

    // Should show the mock dataset
    expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    expect(screen.getByText('100 rows × 3 columns')).toBeInTheDocument();

    // Select the dataset
    const selectButton = screen.getByRole('button', { name: /select/i });
    fireEvent.click(selectButton);

    const continueButton = screen.getByRole('button', { name: /continue with selected dataset/i });
    fireEvent.click(continueButton);

    // Step 2: Test selection should be visible
    await waitFor(() => {
      expect(screen.getByText('Choose Statistical Test')).toBeInTheDocument();
    });

    // Should show test suggestions
    expect(screen.getByText('Recommended Tests')).toBeInTheDocument();
    expect(screen.getByText('Descriptive Statistics')).toBeInTheDocument();

    // Select descriptive statistics test
    const descriptiveCard = screen.getByText('Descriptive Statistics').closest('.MuiCard-root');
    expect(descriptiveCard).toBeInTheDocument();
    
    fireEvent.click(descriptiveCard!);

    const configureButton = screen.getByRole('button', { name: /configure test parameters/i });
    fireEvent.click(configureButton);

    // Step 3: Parameter configuration should be visible
    await waitFor(() => {
      expect(screen.getByText('Configure Descriptive Statistics')).toBeInTheDocument();
    });

    // Should show variable selection
    const variableSelect = screen.getByLabelText('Variable');
    expect(variableSelect).toBeInTheDocument();

    // Select a numeric variable
    fireEvent.mouseDown(variableSelect);
    const ageOption = screen.getByText('age');
    fireEvent.click(ageOption);

    // Run the analysis
    const runButton = screen.getByRole('button', { name: /run analysis/i });
    fireEvent.click(runButton);

    // Step 4: Results should be displayed
    await waitFor(() => {
      expect(screen.getByText('Analysis Results: Descriptive Statistics')).toBeInTheDocument();
    });

    // Should show summary
    expect(screen.getByText(mockAnalysisResult.summary)).toBeInTheDocument();

    // Should show statistical results
    expect(screen.getByText('Statistical Results')).toBeInTheDocument();
    
    // Should show interpretation
    expect(screen.getByText('Interpretation')).toBeInTheDocument();
    expect(screen.getByText(mockAnalysisResult.interpretation)).toBeInTheDocument();

    // Verify API calls were made
    expect(mockDataApi.getDatasets).toHaveBeenCalledTimes(1);
    expect(mockAnalysisApi.getTestSuggestions).toHaveBeenCalledWith('dataset-1', {
      variables: ['age', 'gender', 'score'],
      numGroups: 2,
      pairedData: false,
    });
    expect(mockAnalysisApi.calculateDescriptiveStats).toHaveBeenCalledWith('dataset-1', 'age');
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    mockDataApi.getDatasets = vi.fn().mockRejectedValue(new Error('Network error'));

    renderWithProviders(<AnalysisPage />);

    // Should show loading initially, then error
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('validates required parameters', async () => {
    renderWithProviders(<AnalysisPage />);

    // Navigate through steps quickly
    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    // Select dataset and continue
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with selected dataset/i }));

    await waitFor(() => {
      expect(screen.getByText('Descriptive Statistics')).toBeInTheDocument();
    });

    // Select test and continue
    const descriptiveCard = screen.getByText('Descriptive Statistics').closest('.MuiCard-root');
    fireEvent.click(descriptiveCard!);
    fireEvent.click(screen.getByRole('button', { name: /configure test parameters/i }));

    await waitFor(() => {
      expect(screen.getByText('Configure Descriptive Statistics')).toBeInTheDocument();
    });

    // Try to run analysis without selecting variable
    const runButton = screen.getByRole('button', { name: /run analysis/i });
    fireEvent.click(runButton);

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Variable is required')).toBeInTheDocument();
    });

    // Should not call API
    expect(mockAnalysisApi.calculateDescriptiveStats).not.toHaveBeenCalled();
  });

  test('shows test compatibility warnings', async () => {
    // Create dataset with only categorical variables
    const categoricalDataset = {
      ...mockDataset,
      columns: [
        { name: 'category1', dataType: 'categorical' as const, missingValues: 0, uniqueValues: 3 },
        { name: 'category2', dataType: 'categorical' as const, missingValues: 0, uniqueValues: 4 },
      ],
    };

    mockDataApi.getDatasets = vi.fn().mockResolvedValue({
      data: { data: [categoricalDataset], success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    renderWithProviders(<AnalysisPage />);

    // Navigate to test selection
    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with selected dataset/i }));

    await waitFor(() => {
      expect(screen.getByText('Choose Statistical Test')).toBeInTheDocument();
    });

    // Descriptive statistics should show compatibility warning
    const descriptiveCard = screen.getByText('Descriptive Statistics').closest('.MuiCard-root');
    expect(descriptiveCard).toHaveClass('Mui-disabled'); // Should be disabled/grayed out

    // Should show compatibility message
    expect(screen.getByText(/Requires at least 1 numeric variables/)).toBeInTheDocument();
  });

  test('supports test suggestions workflow', async () => {
    renderWithProviders(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    // Navigate to test selection
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with selected dataset/i }));

    await waitFor(() => {
      expect(screen.getByText('Recommended Tests')).toBeInTheDocument();
    });

    // Should show test suggestions with confidence scores
    expect(screen.getByText('90% match')).toBeInTheDocument();
    expect(screen.getByText('Good for exploring numeric data')).toBeInTheDocument();

    // Verify suggestions API was called
    expect(mockAnalysisApi.getTestSuggestions).toHaveBeenCalledWith('dataset-1', {
      variables: ['age', 'gender', 'score'],
      numGroups: 2,
      pairedData: false,
    });
  });

  test('allows navigation between steps', async () => {
    renderWithProviders(<AnalysisPage />);

    // Complete first step
    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with selected dataset/i }));

    // Should be on step 2
    await waitFor(() => {
      expect(screen.getByText('Choose Statistical Test')).toBeInTheDocument();
    });

    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Should be back on dataset selection
    await waitFor(() => {
      expect(screen.getByText('Select a Dataset for Analysis')).toBeInTheDocument();
    });
  });
});

describe('Parameter Form Tests', () => {
  test('shows different parameters for different test types', async () => {
    // Test t-test parameters
    mockAnalysisApi.performTTest = vi.fn().mockResolvedValue({
      data: { 
        data: {
          ...mockAnalysisResult,
          testType: 'one-sample-ttest',
          statistics: {
            statistic: 2.5,
            pValue: 0.015,
            degreesOfFreedom: 97,
            confidenceInterval: [23.2, 27.8],
            meanDifference: 0.5,
            standardError: 0.2,
            effectSize: 0.25,
          }
        }, 
        success: true 
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    renderWithProviders(<AnalysisPage />);

    // Navigate to parameter configuration for t-test
    await waitFor(() => {
      expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    });

    // Quick navigation to t-test parameters
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with selected dataset/i }));

    await waitFor(() => {
      expect(screen.getByText('One-Sample t-test')).toBeInTheDocument();
    });

    const tTestCard = screen.getByText('One-Sample t-test').closest('.MuiCard-root');
    fireEvent.click(tTestCard!);
    fireEvent.click(screen.getByRole('button', { name: /configure test parameters/i }));

    await waitFor(() => {
      expect(screen.getByText('Configure One-Sample t-test')).toBeInTheDocument();
    });

    // Should show t-test specific parameters
    expect(screen.getByLabelText('Variable')).toBeInTheDocument();
    expect(screen.getByLabelText('Population Mean')).toBeInTheDocument();
    expect(screen.getByLabelText('Significance Level (α)')).toBeInTheDocument();

    // Fill in parameters
    const variableSelect = screen.getByLabelText('Variable');
    fireEvent.mouseDown(variableSelect);
    fireEvent.click(screen.getByText('age'));

    const populationMeanInput = screen.getByLabelText('Population Mean');
    fireEvent.change(populationMeanInput, { target: { value: '25' } });

    // Run analysis
    fireEvent.click(screen.getByRole('button', { name: /run analysis/i }));

    await waitFor(() => {
      expect(mockAnalysisApi.performTTest).toHaveBeenCalledWith('dataset-1', {
        testType: 'one-sample',
        variable1: 'age',
        populationMean: 25,
        alpha: 0.05,
      });
    });
  });
});