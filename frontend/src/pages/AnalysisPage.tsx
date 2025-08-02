import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Button,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { dataApi } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import DatasetSelector from '../components/analysis/DatasetSelector';
import TestSelector from '../components/analysis/TestSelector';
import ParameterForm from '../components/analysis/ParameterForm';
import ResultsDisplay from '../components/analysis/ResultsDisplay';
import { Dataset } from '../types/data';
import { AnalysisConfig, AnalysisResult } from '../types/analysis';

const steps = [
  'Select Dataset',
  'Choose Test',
  'Configure Parameters',
  'View Results'
];

const AnalysisPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [analysisConfig, setAnalysisConfig] = useState<AnalysisConfig | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const response = await dataApi.getDatasets();
      return response.data.data;
    },
  });

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
    setError(null);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError(null);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedDataset(null);
    setAnalysisConfig(null);
    setAnalysisResult(null);
    setError(null);
  };

  const handleDatasetSelect = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    handleNext();
  };

  const handleTestSelect = (config: AnalysisConfig) => {
    setAnalysisConfig(config);
    handleNext();
  };

  const handleParametersSubmit = (result: AnalysisResult) => {
    setAnalysisResult(result);
    handleNext();
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <DatasetSelector
            datasets={datasets || []}
            onSelect={handleDatasetSelect}
          />
        );
      case 1:
        return (
          <TestSelector
            dataset={selectedDataset!}
            onSelect={handleTestSelect}
            onError={handleError}
          />
        );
      case 2:
        return (
          <ParameterForm
            dataset={selectedDataset!}
            config={analysisConfig!}
            onSubmit={handleParametersSubmit}
            onError={handleError}
          />
        );
      case 3:
        return (
          <ResultsDisplay
            dataset={selectedDataset!}
            config={analysisConfig!}
            result={analysisResult!}
          />
        );
      default:
        return <div>Unknown step</div>;
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Statistical Analysis
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Follow the guided workflow to perform statistical analysis on your data
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 3, minHeight: 400 }}>
          {getStepContent(activeStep)}
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
            variant="outlined"
          >
            Back
          </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep === steps.length - 1 && (
              <Button onClick={handleReset} variant="outlined">
                Start New Analysis
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default AnalysisPage;