import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import type { SocketEvents, User } from '../types/collaboration';

export const useSocket = () => {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      auth: {
        token
      }
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
      setConnectedUsers([]);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setIsConnected(false);
    });

    // User presence handlers
    socket.on('connected-users', (users: User[]) => {
      setConnectedUsers(users);
    });

    socket.on('user-joined', (data: { user: User; timestamp: string }) => {
      setConnectedUsers(prev => {
        if (prev.find(u => u.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
    });

    socket.on('user-left', (data: { user: User; timestamp: string }) => {
      setConnectedUsers(prev => prev.filter(u => u.id !== data.user.id));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectedUsers([]);
    };
  }, [token]);

  const joinProject = (projectId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-project', projectId);
    }
  };

  const leaveProject = (projectId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-project', projectId);
    }
  };

  const emitComment = (projectId: string, content: string, parentId?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('new-comment', { projectId, content, parentId });
    }
  };

  const emitActivity = (projectId: string, activity: any) => {
    if (socketRef.current) {
      socketRef.current.emit('activity-update', { projectId, activity });
    }
  };

  const emitDatasetUploaded = (projectId: string, dataset: any) => {
    if (socketRef.current) {
      socketRef.current.emit('dataset-uploaded', { projectId, dataset });
    }
  };

  const emitAnalysisStarted = (projectId: string, analysis: any) => {
    if (socketRef.current) {
      socketRef.current.emit('analysis-started', { projectId, analysis });
    }
  };

  const emitAnalysisCompleted = (projectId: string, analysis: any) => {
    if (socketRef.current) {
      socketRef.current.emit('analysis-completed', { projectId, analysis });
    }
  };

  const emitReportUpdated = (projectId: string, report: any) => {
    if (socketRef.current) {
      socketRef.current.emit('report-updated', { projectId, report });
    }
  };

  const startTyping = (projectId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('typing-start', { projectId });
    }
  };

  const stopTyping = (projectId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('typing-stop', { projectId });
    }
  };

  const on = <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    if (socketRef.current) {
      socketRef.current.on(event as string, handler as any);
    }
  };

  const off = <K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]) => {
    if (socketRef.current) {
      if (handler) {
        socketRef.current.off(event as string, handler as any);
      } else {
        socketRef.current.off(event as string);
      }
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    connectedUsers,
    joinProject,
    leaveProject,
    emitComment,
    emitActivity,
    emitDatasetUploaded,
    emitAnalysisStarted,
    emitAnalysisCompleted,
    emitReportUpdated,
    startTyping,
    stopTyping,
    on,
    off
  };
};

export default useSocket;