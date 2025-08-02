import { CacheService, CACHE_KEYS } from './redis.js';
import { PerformanceMonitor } from './performance-monitor.js';

// Job types
export enum JobType {
  STATISTICAL_ANALYSIS = 'statistical_analysis',
  DATA_PREPROCESSING = 'data_preprocessing',
  REPORT_GENERATION = 'report_generation',
  DATA_EXPORT = 'data_export',
  CACHE_CLEANUP = 'cache_cleanup',
  PERFORMANCE_CLEANUP = 'performance_cleanup'
}

// Job status
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Job priority
export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

// Job interface
export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  data: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  userId?: string;
}

// Job processor function type
export type JobProcessor<T = any, R = any> = (job: Job, data: T) => Promise<R>;

/**
 * Background job queue system
 */
export class JobQueue {
  private static processors: Map<JobType, JobProcessor> = new Map();
  private static isProcessing = false;
  private static processingInterval: NodeJS.Timeout | null = null;
  private static readonly PROCESSING_INTERVAL = 1000; // 1 second
  private static readonly MAX_CONCURRENT_JOBS = 3;
  private static currentlyProcessing = new Set<string>();

  /**
   * Initialize the job queue
   */
  static async initialize(): Promise<void> {
    console.log('🔄 Initializing job queue...');
    
    // Register default processors
    this.registerProcessor(JobType.CACHE_CLEANUP, this.processCacheCleanup);
    this.registerProcessor(JobType.PERFORMANCE_CLEANUP, this.processPerformanceCleanup);
    
    // Start processing
    this.startProcessing();
    
    // Schedule periodic cleanup jobs
    this.schedulePeriodicJobs();
    
    console.log('✅ Job queue initialized');
  }

  /**
   * Register a job processor
   */
  static registerProcessor<T, R>(type: JobType, processor: JobProcessor<T, R>): void {
    this.processors.set(type, processor);
    console.log(`📝 Registered processor for job type: ${type}`);
  }

  /**
   * Add a job to the queue
   */
  static async addJob(
    type: JobType,
    data: any,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      userId?: string;
      delay?: number;
    } = {}
  ): Promise<string> {
    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      type,
      status: JobStatus.PENDING,
      priority: options.priority || JobPriority.NORMAL,
      data,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      userId: options.userId
    };

    // Store job in Redis
    const jobKey = `${CACHE_KEYS.STATS}job:${jobId}`;
    await CacheService.set(jobKey, job, 24 * 60 * 60); // 24 hours TTL

    // Add to queue
    const queueKey = `${CACHE_KEYS.STATS}queue:${type}:${job.priority}`;
    const queueData = { jobId, scheduledFor: Date.now() + (options.delay || 0) };
    await CacheService.set(`${queueKey}:${jobId}`, queueData, 24 * 60 * 60);

    console.log(`➕ Added job ${jobId} of type ${type} to queue`);
    return jobId;
  }

  /**
   * Get job status
   */
  static async getJob(jobId: string): Promise<Job | null> {
    const jobKey = `${CACHE_KEYS.STATS}job:${jobId}`;
    return await CacheService.get<Job>(jobKey);
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job || job.status === JobStatus.COMPLETED) {
      return false;
    }

    job.status = JobStatus.CANCELLED;
    const jobKey = `${CACHE_KEYS.STATS}job:${jobId}`;
    await CacheService.set(jobKey, job, 24 * 60 * 60);

    // Remove from processing if currently processing
    this.currentlyProcessing.delete(jobId);

    console.log(`❌ Cancelled job ${jobId}`);
    return true;
  }

  /**
   * Start processing jobs
   */
  private static startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(async () => {
      try {
        await this.processNextJobs();
      } catch (error) {
        console.error('Error processing jobs:', error);
      }
    }, this.PROCESSING_INTERVAL);

    console.log('🚀 Job processing started');
  }

  /**
   * Stop processing jobs
   */
  static stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    console.log('⏹️  Job processing stopped');
  }

  /**
   * Process next available jobs
   */
  private static async processNextJobs(): Promise<void> {
    if (this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) {
      return; // Already at max capacity
    }

    // Get jobs from all queues, ordered by priority
    const priorities = [JobPriority.CRITICAL, JobPriority.HIGH, JobPriority.NORMAL, JobPriority.LOW];
    
    for (const priority of priorities) {
      if (this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) break;

      for (const jobType of Object.values(JobType)) {
        if (this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) break;

        const queueKey = `${CACHE_KEYS.STATS}queue:${jobType}:${priority}`;
        const jobIds = await this.getJobsFromQueue(queueKey);

        for (const jobId of jobIds) {
          if (this.currentlyProcessing.size >= this.MAX_CONCURRENT_JOBS) break;
          if (this.currentlyProcessing.has(jobId)) continue;

          const job = await this.getJob(jobId);
          if (!job || job.status !== JobStatus.PENDING) continue;

          // Check if job is scheduled for future
          const queueData = await CacheService.get<any>(`${queueKey}:${jobId}`);
          if (queueData && queueData.scheduledFor > Date.now()) continue;

          // Process the job
          this.processJob(job).catch(error => {
            console.error(`Error processing job ${jobId}:`, error);
          });
        }
      }
    }
  }

  /**
   * Get jobs from a specific queue
   */
  private static async getJobsFromQueue(queueKey: string): Promise<string[]> {
    // This is a simplified implementation
    // In a real system, you might use Redis lists or sorted sets
    const pattern = `${queueKey}:*`;
    const keys = await CacheService.get<string[]>(pattern) || [];
    return keys.map(key => key.split(':').pop()!);
  }

  /**
   * Process a single job
   */
  private static async processJob(job: Job): Promise<void> {
    const startTime = Date.now();
    this.currentlyProcessing.add(job.id);

    try {
      // Update job status
      job.status = JobStatus.PROCESSING;
      job.startedAt = new Date();
      await this.updateJob(job);

      console.log(`🔄 Processing job ${job.id} of type ${job.type}`);

      // Get processor
      const processor = this.processors.get(job.type);
      if (!processor) {
        throw new Error(`No processor registered for job type: ${job.type}`);
      }

      // Execute processor
      const result = await processor(job, job.data);

      // Update job with result
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      await this.updateJob(job);

      // Record metrics
      const processingTime = Date.now() - startTime;
      await PerformanceMonitor.recordMetric('job_processing_time', processingTime, {
        job_type: job.type,
        job_priority: job.priority.toString(),
        success: 'true'
      });

      console.log(`✅ Completed job ${job.id} in ${processingTime}ms`);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);

      // Update job with error
      job.error = error instanceof Error ? error.message : String(error);
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        // Retry the job
        job.status = JobStatus.PENDING;
        await this.updateJob(job);
        
        // Re-add to queue with delay
        const delay = Math.pow(2, job.retryCount) * 1000; // Exponential backoff
        await this.addJob(job.type, job.data, {
          priority: job.priority,
          maxRetries: job.maxRetries,
          userId: job.userId,
          delay
        });
        
        console.log(`🔄 Retrying job ${job.id} (attempt ${job.retryCount + 1}/${job.maxRetries})`);
      } else {
        // Mark as failed
        job.status = JobStatus.FAILED;
        job.completedAt = new Date();
        await this.updateJob(job);
      }

      // Record metrics
      const processingTime = Date.now() - startTime;
      await PerformanceMonitor.recordMetric('job_processing_time', processingTime, {
        job_type: job.type,
        job_priority: job.priority.toString(),
        success: 'false'
      });

    } finally {
      this.currentlyProcessing.delete(job.id);
    }
  }

  /**
   * Update job in storage
   */
  private static async updateJob(job: Job): Promise<void> {
    const jobKey = `${CACHE_KEYS.STATS}job:${job.id}`;
    await CacheService.set(jobKey, job, 24 * 60 * 60);
  }

  /**
   * Generate unique job ID
   */
  private static generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule periodic jobs
   */
  private static schedulePeriodicJobs(): void {
    // Schedule cache cleanup every hour
    setInterval(async () => {
      await this.addJob(JobType.CACHE_CLEANUP, {}, { priority: JobPriority.LOW });
    }, 60 * 60 * 1000);

    // Schedule performance cleanup every 30 minutes
    setInterval(async () => {
      await this.addJob(JobType.PERFORMANCE_CLEANUP, {}, { priority: JobPriority.LOW });
    }, 30 * 60 * 1000);

    console.log('⏰ Scheduled periodic cleanup jobs');
  }

  /**
   * Default cache cleanup processor
   */
  private static async processCacheCleanup(job: Job, data: any): Promise<void> {
    console.log('🧹 Running cache cleanup...');
    
    // Clean up expired sessions
    await CacheService.deletePattern(`${CACHE_KEYS.SESSION}*`);
    
    // Clean up old analysis results
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    await CacheService.deletePattern(`${CACHE_KEYS.ANALYSIS}*:${oneHourAgo}`);
    
    console.log('✅ Cache cleanup completed');
  }

  /**
   * Default performance cleanup processor
   */
  private static async processPerformanceCleanup(job: Job, data: any): Promise<void> {
    console.log('📊 Running performance cleanup...');
    
    // Clear old performance metrics
    PerformanceMonitor.clearOldMetrics();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ Performance cleanup completed');
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<{
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
    currentlyProcessing: number;
  }> {
    // This is a simplified implementation
    // In a real system, you would query Redis for actual counts
    return {
      totalJobs: 0,
      pendingJobs: 0,
      processingJobs: this.currentlyProcessing.size,
      completedJobs: 0,
      failedJobs: 0,
      currentlyProcessing: this.currentlyProcessing.size
    };
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down job queue...');
  JobQueue.stopProcessing();
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down job queue...');
  JobQueue.stopProcessing();
});