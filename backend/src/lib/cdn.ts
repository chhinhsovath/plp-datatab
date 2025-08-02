import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CDN configuration
interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  cacheDuration: number;
  staticPaths: string[];
  compressionEnabled: boolean;
}

const CDN_CONFIG: CDNConfig = {
  enabled: process.env.CDN_ENABLED === 'true',
  baseUrl: process.env.CDN_BASE_URL || '',
  cacheDuration: parseInt(process.env.CDN_CACHE_DURATION || '86400'), // 24 hours
  staticPaths: ['/static', '/assets', '/images', '/css', '/js'],
  compressionEnabled: process.env.CDN_COMPRESSION === 'true'
};

/**
 * CDN service for static asset optimization
 */
export class CDNService {
  
  /**
   * Configure static asset serving with CDN support
   */
  static configureStaticAssets(app: express.Application): void {
    // Set up static file serving with caching headers
    const staticOptions: express.ServeStaticOptions = {
      maxAge: CDN_CONFIG.cacheDuration * 1000, // Convert to milliseconds
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // Set cache control headers
        if (this.isStaticAsset(path)) {
          res.setHeader('Cache-Control', `public, max-age=${CDN_CONFIG.cacheDuration}`);
          res.setHeader('Expires', new Date(Date.now() + CDN_CONFIG.cacheDuration * 1000).toUTCString());
        }
        
        // Set compression headers
        if (CDN_CONFIG.compressionEnabled) {
          res.setHeader('Vary', 'Accept-Encoding');
        }
        
        // Set security headers for static assets
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
      }
    };

    // Serve static files from uploads directory
    const uploadsPath = path.join(__dirname, '../../uploads');
    app.use('/uploads', express.static(uploadsPath, staticOptions));

    // Serve static files from public directory if it exists
    const publicPath = path.join(__dirname, '../../public');
    app.use('/static', express.static(publicPath, staticOptions));

    console.log('📁 Static asset serving configured');
    if (CDN_CONFIG.enabled) {
      console.log(`🌐 CDN enabled: ${CDN_CONFIG.baseUrl}`);
    }
  }

  /**
   * Generate CDN URL for static assets
   */
  static getCDNUrl(assetPath: string): string {
    if (!CDN_CONFIG.enabled || !CDN_CONFIG.baseUrl) {
      return assetPath;
    }

    // Remove leading slash if present
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    
    return `${CDN_CONFIG.baseUrl}/${cleanPath}`;
  }

  /**
   * Check if a path is a static asset
   */
  private static isStaticAsset(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const staticExtensions = [
      '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
      '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.mp4', '.webm'
    ];
    
    return staticExtensions.includes(ext);
  }

  /**
   * Middleware for adding CDN headers
   */
  static cdnMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Add CDN headers for API responses that include asset URLs
      if (req.path.startsWith('/api/')) {
        res.locals.getCDNUrl = this.getCDNUrl.bind(this);
      }
      
      next();
    };
  }

  /**
   * Optimize images and assets (placeholder for future implementation)
   */
  static async optimizeAsset(filePath: string, options: {
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
    resize?: { width?: number; height?: number };
  } = {}): Promise<string> {
    // This is a placeholder for image optimization
    // In a real implementation, you would use libraries like Sharp or ImageMagick
    
    console.log(`🖼️  Optimizing asset: ${filePath}`, options);
    
    // For now, just return the original path
    return filePath;
  }

  /**
   * Preload critical assets
   */
  static generatePreloadHeaders(criticalAssets: string[]): string {
    const preloadLinks = criticalAssets.map(asset => {
      const cdnUrl = this.getCDNUrl(asset);
      const ext = path.extname(asset).toLowerCase();
      
      let asType = 'fetch';
      if (ext === '.css') asType = 'style';
      else if (ext === '.js') asType = 'script';
      else if (['.woff', '.woff2', '.ttf'].includes(ext)) asType = 'font';
      else if (['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) asType = 'image';
      
      return `<${cdnUrl}>; rel=preload; as=${asType}${ext === '.woff2' ? '; crossorigin' : ''}`;
    });
    
    return preloadLinks.join(', ');
  }

  /**
   * Generate resource hints for better performance
   */
  static generateResourceHints(): {
    dnsPrefetch: string[];
    preconnect: string[];
    prefetch: string[];
  } {
    const hints = {
      dnsPrefetch: [] as string[],
      preconnect: [] as string[],
      prefetch: [] as string[]
    };

    if (CDN_CONFIG.enabled && CDN_CONFIG.baseUrl) {
      const cdnDomain = new URL(CDN_CONFIG.baseUrl).hostname;
      hints.dnsPrefetch.push(cdnDomain);
      hints.preconnect.push(CDN_CONFIG.baseUrl);
    }

    return hints;
  }

  /**
   * Asset versioning for cache busting
   */
  static addVersionToAsset(assetPath: string, version?: string): string {
    const assetVersion = version || process.env.ASSET_VERSION || Date.now().toString();
    const separator = assetPath.includes('?') ? '&' : '?';
    
    return `${assetPath}${separator}v=${assetVersion}`;
  }

  /**
   * Compress assets (placeholder for future implementation)
   */
  static async compressAssets(assetsDir: string): Promise<void> {
    // This is a placeholder for asset compression
    // In a real implementation, you would use tools like:
    // - Gzip/Brotli compression
    // - CSS/JS minification
    // - Image optimization
    
    console.log(`🗜️  Compressing assets in: ${assetsDir}`);
    
    // For now, just log the action
    console.log('✅ Asset compression completed (placeholder)');
  }

  /**
   * Generate manifest file for assets
   */
  static generateAssetManifest(assetsDir: string): Record<string, string> {
    // This is a placeholder for asset manifest generation
    // In a real implementation, you would scan the assets directory
    // and create a mapping of original filenames to versioned filenames
    
    const manifest: Record<string, string> = {
      'app.css': this.addVersionToAsset('/static/css/app.css'),
      'app.js': this.addVersionToAsset('/static/js/app.js'),
      'vendor.js': this.addVersionToAsset('/static/js/vendor.js'),
      'logo.png': this.addVersionToAsset('/static/images/logo.png')
    };

    console.log('📋 Asset manifest generated:', Object.keys(manifest).length, 'assets');
    
    return manifest;
  }

  /**
   * Middleware to inject asset URLs into responses
   */
  static assetInjectionMiddleware() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const originalJson = res.json;
      
      res.json = function(obj: any) {
        // Inject CDN URLs into response objects that contain asset paths
        if (obj && typeof obj === 'object') {
          obj = CDNService.injectCDNUrls(obj);
        }
        
        return originalJson.call(this, obj);
      };
      
      next();
    };
  }

  /**
   * Recursively inject CDN URLs into response objects
   */
  private static injectCDNUrls(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.injectCDNUrls(item));
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && this.isAssetUrl(value)) {
          result[key] = this.getCDNUrl(value);
        } else if (typeof value === 'object') {
          result[key] = this.injectCDNUrls(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }
    
    return obj;
  }

  /**
   * Check if a string looks like an asset URL
   */
  private static isAssetUrl(str: string): boolean {
    if (typeof str !== 'string') return false;
    
    return CDN_CONFIG.staticPaths.some(path => str.startsWith(path)) ||
           this.isStaticAsset(str);
  }

  /**
   * Get CDN configuration
   */
  static getConfig(): CDNConfig {
    return { ...CDN_CONFIG };
  }

  /**
   * Update CDN configuration
   */
  static updateConfig(updates: Partial<CDNConfig>): void {
    Object.assign(CDN_CONFIG, updates);
    console.log('🔄 CDN configuration updated');
  }
}

/**
 * Express middleware for comprehensive static asset optimization
 */
export function setupCDN(app: express.Application): void {
  // Configure static asset serving
  CDNService.configureStaticAssets(app);
  
  // Add CDN middleware
  app.use(CDNService.cdnMiddleware());
  
  // Add asset injection middleware
  app.use(CDNService.assetInjectionMiddleware());
  
  // Add route for asset manifest
  app.get('/api/assets/manifest', (_req, res) => {
    const manifest = CDNService.generateAssetManifest('');
    res.json(manifest);
  });
  
  // Add route for resource hints
  app.get('/api/assets/hints', (_req, res) => {
    const hints = CDNService.generateResourceHints();
    res.json(hints);
  });
  
  console.log('🚀 CDN setup completed');
}