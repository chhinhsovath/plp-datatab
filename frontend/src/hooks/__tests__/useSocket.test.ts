import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSocket } from '../useSocket';
import { useAuth } from '../../contexts/AuthContext';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('useSocket', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ token: mockToken });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize socket connection with token', () => {
    const { io } = require('socket.io-client');
    
    renderHook(() => useSocket());

    expect(io).toHaveBeenCalledWith(
      'http://localhost:3001',
      {
        auth: {
          token: mockToken
        }
      }
    );
  });

  it('should not initialize socket without token', () => {
    (useAuth as any).mockReturnValue({ token: null });
    const { io } = require('socket.io-client');
    
    renderHook(() => useSocket());

    expect(io).not.toHaveBeenCalled();
  });

  it('should set up event listeners', () => {
    renderHook(() => useSocket());

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connected-users', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('user-joined', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('user-left', expect.any(Function));
  });

  it('should handle connection state changes', () => {
    const { result } = renderHook(() => useSocket());

    expect(result.current.isConnected).toBe(false);

    // Simulate connect event
    const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
    act(() => {
      connectHandler();
    });

    expect(result.current.isConnected).toBe(true);

    // Simulate disconnect event
    const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
    act(() => {
      disconnectHandler();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it('should handle user presence updates', () => {
    const { result } = renderHook(() => useSocket());

    const testUsers = [
      { id: '1', name: 'User 1', email: 'user1@test.com' },
      { id: '2', name: 'User 2', email: 'user2@test.com' }
    ];

    // Simulate connected-users event
    const connectedUsersHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'connected-users'
    )[1];
    
    act(() => {
      connectedUsersHandler(testUsers);
    });

    expect(result.current.connectedUsers).toEqual(testUsers);

    // Simulate user-joined event
    const newUser = { id: '3', name: 'User 3', email: 'user3@test.com' };
    const userJoinedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'user-joined'
    )[1];
    
    act(() => {
      userJoinedHandler({ user: newUser, timestamp: '2024-01-01T00:00:00Z' });
    });

    expect(result.current.connectedUsers).toEqual([...testUsers, newUser]);

    // Simulate user-left event
    const userLeftHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'user-left'
    )[1];
    
    act(() => {
      userLeftHandler({ user: testUsers[0], timestamp: '2024-01-01T00:00:00Z' });
    });

    expect(result.current.connectedUsers).toEqual([testUsers[1], newUser]);
  });

  it('should provide socket methods', () => {
    const { result } = renderHook(() => useSocket());

    // Test joinProject
    act(() => {
      result.current.joinProject('project-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('join-project', 'project-1');

    // Test leaveProject
    act(() => {
      result.current.leaveProject('project-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('leave-project', 'project-1');

    // Test emitComment
    act(() => {
      result.current.emitComment('project-1', 'Test comment', 'parent-id');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('new-comment', {
      projectId: 'project-1',
      content: 'Test comment',
      parentId: 'parent-id'
    });

    // Test emitActivity
    const activity = { type: 'DATASET_UPLOADED', details: {} };
    act(() => {
      result.current.emitActivity('project-1', activity);
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('activity-update', {
      projectId: 'project-1',
      activity
    });
  });

  it('should provide event listener methods', () => {
    const { result } = renderHook(() => useSocket());

    const handler = vi.fn();

    // Test on method
    act(() => {
      result.current.on('comment-created', handler);
    });
    expect(mockSocket.on).toHaveBeenCalledWith('comment-created', handler);

    // Test off method
    act(() => {
      result.current.off('comment-created', handler);
    });
    expect(mockSocket.off).toHaveBeenCalledWith('comment-created', handler);

    // Test off without handler
    act(() => {
      result.current.off('comment-created');
    });
    expect(mockSocket.off).toHaveBeenCalledWith('comment-created');
  });

  it('should handle typing indicators', () => {
    const { result } = renderHook(() => useSocket());

    // Test startTyping
    act(() => {
      result.current.startTyping('project-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('typing-start', { projectId: 'project-1' });

    // Test stopTyping
    act(() => {
      result.current.stopTyping('project-1');
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('typing-stop', { projectId: 'project-1' });
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useSocket());

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should handle socket methods when socket is null', () => {
    (useAuth as any).mockReturnValue({ token: null });
    const { result } = renderHook(() => useSocket());

    // These should not throw errors
    act(() => {
      result.current.joinProject('project-1');
      result.current.leaveProject('project-1');
      result.current.emitComment('project-1', 'test');
      result.current.on('comment-created', vi.fn());
      result.current.off('comment-created');
    });

    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(mockSocket.on).not.toHaveBeenCalled();
    expect(mockSocket.off).not.toHaveBeenCalled();
  });
});