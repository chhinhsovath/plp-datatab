import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
  stack?: string;
}

export interface ErrorHandlerOptions {
  showSnackbar?: boolean;
  retryable?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: ApiError) => void;
  onRetry?: (attempt: number) => void;
}

export interface ErrorState {
  error: ApiError | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
}

const defaultOptions: ErrorHandlerOptions = {
  showSnackbar: true,
  retryable: false,
  maxRetries: 3,
  retryDelay: 1000,
};

export function useErrorHandler(options: ErrorHandlerOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const config = { ...defaultOptions, ...options };
  
  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    canRetry: false,
  });

  const handleError = useCallback((error: any) => {
    let apiError: ApiError;

    // Parse different error formats
    if (error.response?.data?.error) {
      // Axios error with API error response
      apiError = error.response.data.error;
    } else if (error.error) {
      // Direct API error object
      apiError = error.error;
    } else if (error.message) {
      // Generic error
      apiError = {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
        requestId: `client_${Date.now()}`,
      };
    } else {
      // Fallback
      apiError = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId: `client_${Date.now()}`,
      };
    }

    const canRetry = config.retryable && errorState.retryCount < (config.maxRetries || 3);

    setErrorState({
      error: apiError,
      isRetrying: false,
      retryCount: errorState.retryCount,
      canRetry,
    });

    // Show user-friendly error message
    if (config.showSnackbar) {
      const userMessage = getUserFriendlyMessage(apiError);
      enqueueSnackbar(userMessage, { 
        variant: 'error',
        autoHideDuration: 6000,
        action: canRetry ? 'Retry' : undefined,
      });
    }

    // Call custom error handler
    if (config.onError) {
      config.onError(apiError);
    }
  }, [config, errorState.retryCount, enqueueSnackbar]);

  const retry = useCallback(async (operation: () => Promise<any>) => {
    if (!errorState.canRetry) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
    }));

    // Call retry callback
    if (config.onRetry) {
      config.onRetry(errorState.retryCount + 1);
    }

    try {
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      
      const result = await operation();
      
      // Success - clear error state
      setErrorState({
        error: null,
        isRetrying: false,
        retryCount: 0,
        canRetry: false,
      });

      return result;
    } catch (error) {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: prev.retryCount + 1,
        canRetry: prev.retryCount + 1 < (config.maxRetries || 3),
      }));

      handleError(error);
      throw error;
    }
  }, [errorState.canRetry, errorState.retryCount, config, handleError]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      canRetry: false,
    });
  }, []);

  const withErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    try {
      clearError();
      return await operation();
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [handleError, clearError]);

  return {
    ...errorState,
    handleError,
    retry,
    clearError,
    withErrorHandling,
  };
}

function getUserFriendlyMessage(error: ApiError): string {
  // Map error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    // Authentication errors
    AUTHENTICATION_ERROR: 'Please log in to continue',
    AUTHORIZATION_ERROR: 'You don\'t have permission to perform this action',
    TOKEN_EXPIRED: 'Your session has expired. Please log in again',
    
    // Validation errors
    VALIDATION_ERROR: 'Please check your input and try again',
    INVALID_INPUT: 'The information provided is not valid',
    
    // Data errors
    NOT_FOUND_ERROR: 'The requested item could not be found',
    DUPLICATE_RECORD: 'This item already exists',
    
    // File upload errors
    FILE_TOO_LARGE: 'The file you\'re trying to upload is too large',
    UNSUPPORTED_FILE_TYPE: 'This file type is not supported',
    
    // Statistical errors
    INSUFFICIENT_DATA: 'Not enough data to perform this analysis',
    STATISTICAL_ERROR: 'Unable to complete the statistical analysis',
    
    // Network errors
    NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection',
    TIMEOUT_ERROR: 'The request took too long to complete. Please try again',
    
    // Server errors
    INTERNAL_SERVER_ERROR: 'Something went wrong on our end. Please try again later',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later',
    
    // Database errors
    DATABASE_ERROR: 'Unable to save your changes. Please try again',
    
    // Default
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
  };

  return errorMessages[error.code] || error.message || errorMessages.UNKNOWN_ERROR;
}

// Hook for handling specific error types
export function useStatisticalErrorHandler() {
  return useErrorHandler({
    showSnackbar: true,
    retryable: true,
    maxRetries: 2,
    retryDelay: 1000,
    onError: (error) => {
      // Log statistical errors for analysis
      console.warn('Statistical analysis error:', error);
    },
  });
}

export function useNetworkErrorHandler() {
  return useErrorHandler({
    showSnackbar: true,
    retryable: true,
    maxRetries: 3,
    retryDelay: 2000,
    onError: (error) => {
      // Log network errors
      console.warn('Network error:', error);
    },
  });
}

export function useValidationErrorHandler() {
  return useErrorHandler({
    showSnackbar: true,
    retryable: false,
    onError: (error) => {
      // Validation errors usually don't need logging
      console.info('Validation error:', error.message);
    },
  });
}