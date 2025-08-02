import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useErrorHandler } from '../useErrorHandler';

// Mock notistack
const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar,
  }),
}));

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty error state', () => {
    const { result } = renderHook(() => useErrorHandler());

    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(false);
  });

  it('should handle API error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    const apiError = {
      response: {
        data: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            timestamp: '2023-01-01T00:00:00.000Z',
            requestId: 'test-request-id',
          },
        },
      },
    };

    act(() => {
      result.current.handleError(apiError);
    });

    expect(result.current.error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      timestamp: '2023-01-01T00:00:00.000Z',
      requestId: 'test-request-id',
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'Please check your input and try again',
      expect.objectContaining({
        variant: 'error',
        autoHideDuration: 6000,
      })
    );
  });

  it('should handle generic error correctly', () => {
    const { result } = renderHook(() => useErrorHandler());

    const genericError = new Error('Something went wrong');

    act(() => {
      result.current.handleError(genericError);
    });

    expect(result.current.error?.code).toBe('UNKNOWN_ERROR');
    expect(result.current.error?.message).toBe('Something went wrong');
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      'An unexpected error occurred. Please try again',
      expect.objectContaining({
        variant: 'error',
      })
    );
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useErrorHandler());

    // First set an error
    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    expect(result.current.error).not.toBeNull();

    // Then clear it
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryCount).toBe(0);
    expect(result.current.canRetry).toBe(false);
  });

  it('should handle retryable errors', () => {
    const { result } = renderHook(() => 
      useErrorHandler({ retryable: true, maxRetries: 3 })
    );

    const networkError = {
      response: {
        data: {
          error: {
            code: 'NETWORK_ERROR',
            message: 'Connection failed',
            timestamp: '2023-01-01T00:00:00.000Z',
            requestId: 'test-request-id',
          },
        },
      },
    };

    act(() => {
      result.current.handleError(networkError);
    });

    expect(result.current.canRetry).toBe(true);
    expect(result.current.retryCount).toBe(0);
  });

  it('should execute operation with error handling', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const successfulOperation = vi.fn().mockResolvedValue('success');

    let operationResult;
    await act(async () => {
      operationResult = await result.current.withErrorHandling(successfulOperation);
    });

    expect(operationResult).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('should handle operation failure', async () => {
    const { result } = renderHook(() => useErrorHandler());

    const failingOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));

    let operationResult;
    await act(async () => {
      operationResult = await result.current.withErrorHandling(failingOperation);
    });

    expect(operationResult).toBeNull();
    expect(result.current.error?.message).toBe('Operation failed');
  });

  it('should not show snackbar when disabled', () => {
    const { result } = renderHook(() => 
      useErrorHandler({ showSnackbar: false })
    );

    act(() => {
      result.current.handleError(new Error('Test error'));
    });

    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it('should call custom error handler', () => {
    const customErrorHandler = vi.fn();
    const { result } = renderHook(() => 
      useErrorHandler({ onError: customErrorHandler })
    );

    const error = new Error('Test error');

    act(() => {
      result.current.handleError(error);
    });

    expect(customErrorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNKNOWN_ERROR',
        message: 'Test error',
      })
    );
  });

  describe('User-friendly error messages', () => {
    const testCases = [
      {
        code: 'AUTHENTICATION_ERROR',
        expected: 'Please log in to continue',
      },
      {
        code: 'AUTHORIZATION_ERROR',
        expected: 'You don\'t have permission to perform this action',
      },
      {
        code: 'VALIDATION_ERROR',
        expected: 'Please check your input and try again',
      },
      {
        code: 'NOT_FOUND_ERROR',
        expected: 'The requested item could not be found',
      },
      {
        code: 'NETWORK_ERROR',
        expected: 'Unable to connect to the server. Please check your internet connection',
      },
      {
        code: 'INTERNAL_SERVER_ERROR',
        expected: 'Something went wrong on our end. Please try again later',
      },
    ];

    testCases.forEach(({ code, expected }) => {
      it(`should show user-friendly message for ${code}`, () => {
        const { result } = renderHook(() => useErrorHandler());

        const apiError = {
          response: {
            data: {
              error: {
                code,
                message: 'Technical error message',
                timestamp: '2023-01-01T00:00:00.000Z',
                requestId: 'test-request-id',
              },
            },
          },
        };

        act(() => {
          result.current.handleError(apiError);
        });

        expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
          expected,
          expect.any(Object)
        );
      });
    });
  });
});