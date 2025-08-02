import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert, Chip, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import { Refresh, BugReport, ExpandMore, Warning, Info } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  retryable?: boolean;
  maxRetries?: number;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
  isRetrying: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
      isRetrying: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.generateErrorId();
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log error to monitoring service
    this.logError(error, errorInfo, errorId);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(error: Error, errorInfo: ErrorInfo, errorId: string) {
    const errorData = {
      errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', errorData);
    }

    // Send to error tracking service (implement based on your service)
    this.sendErrorToService(errorData);
  }

  private getUserId(): string | undefined {
    // Get user ID from your auth context or local storage
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id;
    } catch {
      return undefined;
    }
  }

  private async sendErrorToService(errorData: any) {
    try {
      // Replace with your actual error tracking service
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });
    } catch (error) {
      console.error('Failed to send error to tracking service:', error);
    }
  }

  private getErrorSeverity(): 'low' | 'medium' | 'high' {
    if (!this.state.error) return 'medium';
    
    const error = this.state.error;
    
    // High severity errors
    if (error.name === 'ChunkLoadError' || 
        error.message.includes('Loading chunk') ||
        error.message.includes('Network Error')) {
      return 'high';
    }
    
    // Low severity errors
    if (error.name === 'ValidationError' ||
        error.message.includes('validation')) {
      return 'low';
    }
    
    return 'medium';
  }

  private getErrorCategory(): string {
    if (!this.state.error) return 'Unknown';
    
    const error = this.state.error;
    
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'Network/Loading';
    }
    
    if (error.name === 'TypeError') {
      return 'Code Error';
    }
    
    if (error.name === 'ValidationError') {
      return 'Validation';
    }
    
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network';
    }
    
    return 'Application';
  }

  private getUserFriendlyMessage(): string {
    if (!this.state.error) return 'An unexpected error occurred';
    
    const error = this.state.error;
    
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'Failed to load application resources. This might be due to a network issue or an app update.';
    }
    
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    if (error.name === 'ValidationError') {
      return 'There was an issue with the data provided. Please check your input and try again.';
    }
    
    return 'Something unexpected happened. Our team has been notified and is working on a fix.';
  }

  private getSuggestions(): string[] {
    if (!this.state.error) return [];
    
    const error = this.state.error;
    const suggestions: string[] = [];
    
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      suggestions.push('Refresh the page to reload the application');
      suggestions.push('Clear your browser cache and cookies');
      suggestions.push('Check your internet connection');
    } else if (error.message.includes('Network Error')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try again in a few moments');
      suggestions.push('Contact support if the issue persists');
    } else {
      suggestions.push('Try refreshing the page');
      suggestions.push('Go back and try a different action');
      suggestions.push('Contact support if the problem continues');
    }
    
    return suggestions;
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: undefined,
      retryCount: 0,
      isRetrying: false
    });
  };

  handleRetry = () => {
    const maxRetries = this.props.maxRetries || 3;
    
    if (this.state.retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRetrying: true });
    
    // Retry after a short delay
    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
        isRetrying: false
      }));
    }, 1000);
  };

  handleGoBack = () => {
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const severity = this.getErrorSeverity();
      const category = this.getErrorCategory();
      const userMessage = this.getUserFriendlyMessage();
      const suggestions = this.getSuggestions();
      const maxRetries = this.props.maxRetries || 3;
      const canRetry = this.props.retryable && this.state.retryCount < maxRetries;

      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
            p: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 700,
              width: '100%',
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <BugReport sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
              
              <Typography variant="h5" gutterBottom>
                Oops! Something went wrong
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2 }}>
                <Chip 
                  label={category} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                />
                <Chip 
                  label={severity} 
                  size="small" 
                  color={severity === 'high' ? 'error' : severity === 'medium' ? 'warning' : 'info'}
                  variant="outlined" 
                />
                {this.state.errorId && (
                  <Chip 
                    label={`ID: ${this.state.errorId.slice(-8)}`} 
                    size="small" 
                    variant="outlined" 
                  />
                )}
              </Box>
              
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {userMessage}
              </Typography>
            </Box>

            {suggestions.length > 0 && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <Info sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                  What you can try:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <Typography variant="body2">{suggestion}</Typography>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            {this.state.retryCount > 0 && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  Retry attempt {this.state.retryCount} of {maxRetries}
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              
              {canRetry && (
                <Button
                  variant="outlined"
                  onClick={this.handleRetry}
                  disabled={this.state.isRetrying}
                >
                  {this.state.isRetrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
              
              <Button
                variant="outlined"
                onClick={this.handleGoBack}
              >
                Go Back
              </Button>
            </Box>

            {(this.props.showDetails || process.env.NODE_ENV === 'development') && this.state.error && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2">
                    <Warning sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                    Technical Details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="error" sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" component="pre" sx={{ 
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      <strong>Error:</strong> {this.state.error.name}: {this.state.error.message}
                      {'\n\n'}
                      <strong>Stack Trace:</strong>
                      {'\n'}
                      {this.state.error.stack}
                      {this.state.errorInfo?.componentStack && (
                        <>
                          {'\n\n'}
                          <strong>Component Stack:</strong>
                          {'\n'}
                          {this.state.errorInfo.componentStack}
                        </>
                      )}
                    </Typography>
                  </Alert>
                </AccordionDetails>
              </Accordion>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;