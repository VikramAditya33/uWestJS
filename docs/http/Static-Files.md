# Static File Serving

High-performance static file serving with advanced caching, compression, and range request support.

## Table of Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Configuration Options](#configuration-options)
- [Caching](#caching)
- [Range Requests](#range-requests)
- [Security](#security)
- [Performance](#performance)
- [Examples](#examples)

## Overview

uWestJS provides built-in static file serving with:

- **High performance** - Worker pool for file operations
- **Smart caching** - ETags, Last-Modified, Cache-Control
- **Range requests** - Support for video streaming and resumable downloads
- **Compression** - Automatic gzip/brotli compression
- **Security** - Path traversal protection, dotfile handling
- **Index files** - Automatic index.html serving

## Basic Usage

### Serve from Directory

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new UwsPlatformAdapter()
  );
  
  // Serve files from 'public' directory
  app.useStaticAssets('public');
  
  await app.listen(3000);
}
bootstrap();
```

**Directory structure:**
```text
public/
├── index.html
├── styles.css
├── script.js
└── images/
    └── logo.png
```

**URLs:**
- `http://localhost:3000/` → `public/index.html`
- `http://localhost:3000/styles.css` → `public/styles.css`
- `http://localhost:3000/images/logo.png` → `public/images/logo.png`

### With URL Prefix

```typescript
app.useStaticAssets('public', {
  prefix: '/static',
});
```

**URLs:**
- `http://localhost:3000/static/` → `public/index.html`
- `http://localhost:3000/static/styles.css` → `public/styles.css`

### Multiple Directories

```typescript
// Serve from multiple directories
app.useStaticAssets('public', { prefix: '/public' });
app.useStaticAssets('uploads', { prefix: '/uploads' });
app.useStaticAssets('assets', { prefix: '/assets' });
```

## Configuration Options

### StaticFileOptions Interface

```typescript
interface StaticFileOptions {
  /**
   * URL prefix for static files
   * Default: '/'
   */
  prefix?: string;

  /**
   * Index file names to serve for directories
   * Default: ['index.html']
   */
  index?: string | string[];

  /**
   * Cache max-age in milliseconds or string format
   * Supports: '1d', '2h', '30m', '5s', or number in milliseconds
   * Default: 0 (no caching)
   */
  maxAge?: number | string;

  /**
   * Enable or disable ETag generation
   * - true or 'weak': Generate weak ETags (W/"...") - default, fast
   * - 'strong': Generate strong ETags (supports If-Range for resumable downloads)
   * - false: Disable ETag generation
   * Default: true
   */
  etag?: boolean | 'weak' | 'strong';

  /**
   * Send Last-Modified header
   * Default: true
   */
  lastModified?: boolean;

  /**
   * Send Cache-Control header
   * Default: true
   */
  cacheControl?: boolean;

  /**
   * Add immutable directive to Cache-Control
   * Default: false
   */
  immutable?: boolean;

  /**
   * Dotfile handling: 'allow', 'deny', 'ignore'
   * Default: 'ignore'
   */
  dotfiles?: 'allow' | 'deny' | 'ignore';

  /**
   * Redirect to trailing slash for directories
   * Default: true
   */
  redirect?: boolean;

  /**
   * Suppress logging
   * Default: false
   */
  silent?: boolean;
}
```

### Complete Configuration

```typescript
app.useStaticAssets('public', {
  prefix: '/static',
  index: ['index.html', 'index.htm'],
  maxAge: '1y', // String format: 1 year (or use number in milliseconds: 31536000000)
  etag: 'strong', // 'weak' (default), 'strong', true, or false
  lastModified: true,
  cacheControl: true,
  immutable: true,
  dotfiles: 'ignore',
  redirect: true,
  silent: false,
});
```

## Caching

### No Caching (Development)

```typescript
app.useStaticAssets('public', {
  maxAge: 0, // or '0s'
  etag: false,
  cacheControl: false,
});
```

### Short-term Caching

```typescript
app.useStaticAssets('public', {
  maxAge: '1h', // 1 hour (or use milliseconds: 3600000)
  etag: true,
  lastModified: true,
});
```

**Response headers:**
```http
Cache-Control: public, max-age=3600
ETag: "abc123"
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
```

### Long-term Caching (Immutable Assets)

```typescript
// For versioned/hashed assets (e.g., app.abc123.js)
app.useStaticAssets('public/assets', {
  prefix: '/assets',
  maxAge: '1y', // 1 year (or use milliseconds: 31536000000)
  immutable: true,
});
```

**Response headers:**
```http
Cache-Control: public, max-age=31536000, immutable
```

### Environment-Based Caching

```typescript
const cacheConfig = process.env.NODE_ENV === 'production'
  ? {
      maxAge: '1y', // 1 year
      immutable: true,
      etag: true,
    }
  : {
      maxAge: 0,
      etag: false,
    };

app.useStaticAssets('public', cacheConfig);
```

### Conditional Requests

The server automatically handles conditional requests:

**Client sends:**
```http
If-None-Match: "abc123"
```

**Server responds:**
```http
304 Not Modified
```

**Client sends:**
```http
If-Modified-Since: Wed, 21 Oct 2024 07:28:00 GMT
```

**Server responds:**
```http
304 Not Modified
```

## Range Requests

Range requests are automatically supported for video streaming and resumable downloads.

### Video Streaming

```html
<!-- Browser automatically uses range requests -->
<video controls>
  <source src="/videos/movie.mp4" type="video/mp4">
</video>
```

**Request:**
```http
GET /videos/movie.mp4
Range: bytes=0-1023
```

**Response:**
```http
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1023/1048576
Content-Length: 1024
Accept-Ranges: bytes

[binary data]
```

### Resumable Downloads

```javascript
// Client-side resumable download
async function downloadWithResume(url, filename) {
  const response = await fetch(url, {
    headers: {
      'Range': 'bytes=0-',
    },
  });
  
  if (response.status === 206) {
    // Partial content - can resume
    const blob = await response.blob();
    // Save blob
  }
}
```

### Multiple Ranges

```http
Range: bytes=0-1023,2048-3071
```

The server will respond with multipart/byteranges if multiple ranges are requested.

## Security

### Path Traversal Protection

The server automatically prevents path traversal attacks:

```text
GET /../../../etc/passwd  → 404 Not Found
GET /./secret.txt         → 404 Not Found
GET /%2e%2e/secret.txt    → 404 Not Found
```

### Dotfile Handling

```typescript
// Ignore dotfiles (default)
app.useStaticAssets('public', {
  dotfiles: 'ignore', // .htaccess, .env not served
});

// Deny dotfiles (403 Forbidden)
app.useStaticAssets('public', {
  dotfiles: 'deny',
});

// Allow dotfiles
app.useStaticAssets('public', {
  dotfiles: 'allow', // .well-known/acme-challenge accessible
});
```

### MIME Type Sniffing Protection

The server sets correct Content-Type headers and prevents MIME sniffing:

```http
Content-Type: text/html; charset=utf-8
X-Content-Type-Options: nosniff
```

## Performance

### Worker Pool

Static file operations use a worker pool for non-blocking I/O:

```typescript
// Default: CPU-aware (1-4 workers)
// Math.max(1, Math.min(4, os.cpus().length - 1))
```

### Compression

Files are automatically compressed based on Accept-Encoding:

```http
Accept-Encoding: gzip, deflate, br
```

**Response:**
```http
Content-Encoding: br
Vary: Accept-Encoding
```

### Memory Efficiency

Large files are streamed, not buffered:

```typescript
// Efficient - streams 1GB file
app.useStaticAssets('videos');

// No memory issues with large files
```

## Examples

### SPA (Single Page Application)

```typescript
// Serve SPA with fallback to index.html
app.useStaticAssets('dist', {
  prefix: '/',
  index: ['index.html'],
});

// Handle client-side routing
@Controller()
export class AppController {
  @Get('*')
  async serveSPA(@Res() res: UwsResponse) {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    const stats = await fs.promises.stat(indexPath);
    const fileStream = fs.createReadStream(indexPath);
    
    res.type('html');
    await res.stream(fileStream, stats.size);
  }
}
```

### CDN-Style Asset Serving

```typescript
// Versioned assets with aggressive caching
app.useStaticAssets('public/assets', {
  prefix: '/assets',
  maxAge: '1y', // 1 year
  immutable: true,
  etag: true,
});

// HTML files with no caching
app.useStaticAssets('public', {
  prefix: '/',
  maxAge: 0,
  index: ['index.html'],
});
```

### File Downloads

```typescript
import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { UwsResponse } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

// Recommended: Use built-in static file serving with security
app.useStaticAssets('downloads', {
  prefix: '/downloads',
  maxAge: '1h',
  etag: true,
});

// Files are now accessible at /downloads/filename.pdf
// Built-in security includes:
// - Path traversal protection
// - Null byte protection  
// - Dotfile access control
// - ETag and caching support
```

Note: For simple file downloads, use `useStaticAssets()` which provides automatic security. Only implement custom download endpoints if you need special logic like access control, logging, or dynamic file generation.

### Custom Download with Access Control

If you need custom logic (e.g., authentication, logging), you can implement a secure download endpoint:

```typescript
import { Controller, Get, Param, Res, NotFoundException, UseGuards } from '@nestjs/common';
import { UwsResponse } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

@Controller('secure-downloads')
export class SecureDownloadController {
  @Get(':filename')
  @UseGuards(AuthGuard) // Require authentication
  async downloadFile(@Param('filename') filename: string, @Res() res: UwsResponse) {
    // SECURITY: Prevent path traversal attacks
    const safeFilename = path.basename(filename);
    
    // Validate filename doesn't contain path separators
    if (safeFilename !== filename || safeFilename.includes('..')) {
      return res.status(400).send('Invalid filename');
    }
    
    const filepath = path.join(process.cwd(), 'downloads', safeFilename);
    
    // Check if file exists and get stats (non-blocking)
    try {
      const stats = await fs.promises.stat(filepath);
      
      // Log download for audit trail
      console.log(`User downloaded: ${safeFilename}`);
      
      // Set content-disposition header for download
      res.attachment(safeFilename);
      
      // Stream file to response
      const fileStream = fs.createReadStream(filepath);
      await res.stream(fileStream, stats.size);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }
}
```

### Image Gallery

```typescript
app.useStaticAssets('images', {
  prefix: '/images',
  maxAge: '1d', // 1 day
  etag: true,
  lastModified: true,
});

// Thumbnails with longer cache
app.useStaticAssets('images/thumbnails', {
  prefix: '/thumbnails',
  maxAge: '7d', // 1 week
  immutable: true,
});
```

### Documentation Site

```typescript
app.useStaticAssets('docs', {
  prefix: '/docs',
  index: ['index.html', 'index.htm'],
  maxAge: '1h',
  etag: true,
});
```

Note: Static file servers serve raw file content. If you include `README.md` in the index array, browsers will receive the raw markdown source (displayed as plain text or downloaded), not rendered HTML like GitHub. To serve rendered documentation, pre-render markdown to HTML during your build process or use a markdown rendering middleware.

### API with Static Assets

```typescript
// API routes
@Controller('api')
export class ApiController {
  @Get('users')
  getUsers() {
    return this.userService.findAll();
  }
}

// Static assets
app.useStaticAssets('public', {
  prefix: '/public',
  maxAge: '1d',
});
```

### Multi-Tenant Static Files

```typescript
import { Controller } from '@nestjs/common';

// Tenant-specific assets using built-in security
// Register separate static asset routes for each tenant
app.useStaticAssets('tenants/tenant1/assets', {
  prefix: '/tenant1/assets',
  maxAge: '1h',
});

app.useStaticAssets('tenants/tenant2/assets', {
  prefix: '/tenant2/assets',
  maxAge: '1h',
});

// Or dynamically register tenant routes at startup
const tenants = ['tenant1', 'tenant2', 'tenant3'];
tenants.forEach(tenant => {
  app.useStaticAssets(`tenants/${tenant}/assets`, {
    prefix: `/${tenant}/assets`,
    maxAge: '1h',
  });
});
```

Note: `useStaticAssets()` provides built-in security features including:
- Path traversal protection (blocks `../` attacks)
- Null byte protection
- Path containment verification
- Dotfile access control
- URL decoding and validation

For dynamic tenant routing based on request parameters, use the built-in static file handler which includes all security features automatically.

## Best Practices

### 1. Use Versioned Assets

```typescript
// Good - versioned filenames
// app.abc123.js, styles.def456.css
app.useStaticAssets('public/assets', {
  maxAge: '1y',
  immutable: true,
});

// Bad - no versioning
app.useStaticAssets('public', {
  maxAge: '1y', // Cache issues on updates!
});
```

### 2. Separate Caching Strategies

```typescript
// Long cache for assets
app.useStaticAssets('public/assets', {
  prefix: '/assets',
  maxAge: '1y',
  immutable: true,
});

// Short cache for HTML
app.useStaticAssets('public', {
  prefix: '/',
  maxAge: '5m', // 5 minutes
  index: ['index.html'],
});
```

### 3. Use CDN for Production

```typescript
// Note: uWestJS does not support Express-style app.use() middleware
// Use conditional static asset serving instead

if (process.env.NODE_ENV === 'production') {
  // In production, don't serve static assets locally
  // Configure your CDN to serve from your build output
  // Assets should be uploaded to CDN during deployment
  console.log('Static assets served from CDN: https://cdn.example.com');
} else {
  // Serve locally in development
  app.useStaticAssets('public');
}

// Alternative: Use NestJS interceptor to add CDN headers
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CdnHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-CDN-URL', 'https://cdn.example.com');
    return next.handle();
  }
}

// Apply globally in main.ts
app.useGlobalInterceptors(new CdnHeaderInterceptor());
```

### 4. Compress Assets

```bash
# Pre-compress assets for better performance
gzip -k public/assets/*.js
gzip -k public/assets/*.css
brotli -k public/assets/*.js
brotli -k public/assets/*.css
```

### 5. Monitor Performance

```typescript
app.useStaticAssets('public', {
  prefix: '/static',
  maxAge: '1d',
  silent: false, // Log requests for monitoring
});
```

## Troubleshooting

### Files Not Found

**Check:**
1. Path is correct relative to project root
2. Files exist in the directory
3. Prefix matches URL

```typescript
// Correct
app.useStaticAssets('public', { prefix: '/static' });
// Access: http://localhost:3000/static/file.js

// Incorrect
app.useStaticAssets('public', { prefix: 'static' }); // Missing leading /
```

### Caching Issues

**Solution:** Clear browser cache or use versioned filenames

```bash
# Clear cache
Ctrl+Shift+R (Chrome/Firefox)

# Or use versioned filenames
app.abc123.js instead of app.js
```

### MIME Type Issues

**Check:** File extension is recognized

```typescript
// Custom MIME types
import * as mime from 'mime-types';
mime.types['custom'] = 'application/x-custom';
```

### Permission Errors

**Check:** File permissions

```bash
# Set file permissions (644 for files, 755 for directories)
find public -type f -exec chmod 644 {} \;
find public -type d -exec chmod 755 {} \;
```

## See Also

- [Server](./Server.md) - Server configuration
- [Response](./Response.md) - Response methods
