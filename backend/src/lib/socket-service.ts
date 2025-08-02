import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { collaborationService } from './collaboration-service.js';

const prisma = new PrismaClient();

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map(); // projectId -> Set of userIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, name: true, email: true }
        });

        if (!user) {
          throw new Error('User not found');
        }

        (socket as any).userId = user.id;
        (socket as any).user = user;
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      console.log(`User ${authSocket.user.name} connected`);

      // Join project room
      socket.on('join-project', async (projectId: string) => {
        try {
          // Verify user has access to project
          await collaborationService.checkProjectPermission(projectId, authSocket.userId, 'VIEWER');
          
          socket.join(projectId);
          
          // Track connected users
          if (!this.connectedUsers.has(projectId)) {
            this.connectedUsers.set(projectId, new Set());
          }
          this.connectedUsers.get(projectId)!.add(authSocket.userId);

          // Notify other users in the project
          socket.to(projectId).emit('user-joined', {
            user: authSocket.user,
            timestamp: new Date().toISOString()
          });

          // Send current connected users to the joining user
          const connectedUserIds = Array.from(this.connectedUsers.get(projectId) || []);
          const connectedUsers = await prisma.user.findMany({
            where: { id: { in: connectedUserIds } },
            select: { id: true, name: true, email: true }
          });

          socket.emit('connected-users', connectedUsers);

        } catch (error) {
          socket.emit('error', { message: 'Failed to join project' });
        }
      });

      // Leave project room
      socket.on('leave-project', (projectId: string) => {
        socket.leave(projectId);
        
        // Remove from connected users
        if (this.connectedUsers.has(projectId)) {
          this.connectedUsers.get(projectId)!.delete(authSocket.userId);
          if (this.connectedUsers.get(projectId)!.size === 0) {
            this.connectedUsers.delete(projectId);
          }
        }

        // Notify other users
        socket.to(projectId).emit('user-left', {
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // Real-time comment creation
      socket.on('new-comment', async (data: { projectId: string; content: string; parentId?: string }) => {
        try {
          const comment = await collaborationService.createComment(
            data.projectId,
            authSocket.userId,
            { content: data.content, parentId: data.parentId }
          );

          // Broadcast to all users in the project
          this.io.to(data.projectId).emit('comment-created', comment);
        } catch (error) {
          socket.emit('error', { message: 'Failed to create comment' });
        }
      });

      // Real-time activity updates
      socket.on('activity-update', (data: { projectId: string; activity: any }) => {
        // Broadcast activity to all users in the project except sender
        socket.to(data.projectId).emit('activity-updated', {
          activity: data.activity,
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // Real-time dataset updates
      socket.on('dataset-uploaded', (data: { projectId: string; dataset: any }) => {
        socket.to(data.projectId).emit('dataset-updated', {
          dataset: data.dataset,
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // Real-time analysis updates
      socket.on('analysis-started', (data: { projectId: string; analysis: any }) => {
        socket.to(data.projectId).emit('analysis-status-changed', {
          analysis: data.analysis,
          status: 'RUNNING',
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('analysis-completed', (data: { projectId: string; analysis: any }) => {
        socket.to(data.projectId).emit('analysis-status-changed', {
          analysis: data.analysis,
          status: 'COMPLETED',
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // Real-time report updates
      socket.on('report-updated', (data: { projectId: string; report: any }) => {
        socket.to(data.projectId).emit('report-changed', {
          report: data.report,
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // User typing indicators for comments
      socket.on('typing-start', (data: { projectId: string }) => {
        socket.to(data.projectId).emit('user-typing', {
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('typing-stop', (data: { projectId: string }) => {
        socket.to(data.projectId).emit('user-stopped-typing', {
          user: authSocket.user,
          timestamp: new Date().toISOString()
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${authSocket.user.name} disconnected`);
        
        // Remove from all project rooms
        for (const [projectId, userIds] of this.connectedUsers.entries()) {
          if (userIds.has(authSocket.userId)) {
            userIds.delete(authSocket.userId);
            if (userIds.size === 0) {
              this.connectedUsers.delete(projectId);
            }
            
            // Notify other users in the project
            socket.to(projectId).emit('user-left', {
              user: authSocket.user,
              timestamp: new Date().toISOString()
            });
          }
        }
      });
    });
  }

  // Method to emit events from other parts of the application
  public emitToProject(projectId: string, event: string, data: any) {
    this.io.to(projectId).emit(event, data);
  }

  public emitToUser(userId: string, event: string, data: any) {
    this.io.emit(event, data); // This would need user-specific rooms for proper implementation
  }

  public getConnectedUsers(projectId: string): string[] {
    return Array.from(this.connectedUsers.get(projectId) || []);
  }

  public isUserConnected(projectId: string, userId: string): boolean {
    return this.connectedUsers.get(projectId)?.has(userId) || false;
  }
}

let socketService: SocketService;

export const initializeSocketService = (server: HTTPServer) => {
  socketService = new SocketService(server);
  return socketService;
};

export const getSocketService = () => {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
};