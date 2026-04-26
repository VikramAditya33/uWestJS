# HTTP Server

The HTTP Server component provides a high-performance HTTP adapter for NestJS using uWebSockets.js. It offers Express-compatible APIs with significantly better performance.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Server Methods](#server-methods)
- [Static File Serving](#static-file-serving)
- [CORS Configuration](#cors-configuration)
- [Performance Tuning](#performance-tuning)

## Overview

The `UwsPlatformAdapter` is a drop-in replacement for the default NestJS HTTP adapter (`@nestjs/platform-express`). It provides:

- **Up to 10x faster** than Express for HTTP requests
- **Lower memory footprint** for handling concurrent connections
- **Native backpressure handling** for streaming responses
- **Built-in static file serving** with advanced caching
- **Full Express compatibility** for existing NestJS applications

## Quick Start

### Basic Setup

Replace your existing HTTP adapter in `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new UwsPlatformAdapter();
  const app = await NestFactory.create(AppModule, adapter);
  
  // Initialize the app (sets up routes and middleware)
  await app.init();
  
  // Start the server
  adapter.listen(3000, () => {
    console.log('Application is running on: http://localhost:3000');
  });
}
bootstrap();
```

> **Important:** Unlike Express, you must call `app.init()` before `adapter.listen()`. This is because uWebSockets.js doesn't implement Node.js EventEmitter interface that NestJS's `app.listen()` expects. See [Server Initialization](#server-initialization) for details.

### With Configuration

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new UwsPlatformAdapter({
    maxBodySize: 10 * 1024 * 1024, // 10MB
    trustProxy: true,
    etag: 'weak',
    bodyParser: {
      json: true,
      urlencoded: true,
      raw: false,
      text: false,
    },
  });
  
  const app = await NestFactory.create(AppModule, adapter);
  
  // Initialize the app
  await app.init();
  
  // Start the server
  adapter.listen(3000, () => {
    console.log('Server started on port 3000');
  });
}
bootstrap();
```

### Server Initialization

**Why the different initialization pattern?**

Unlike Express or Fastify, uWebSockets.js doesn't implement Node.js's EventEmitter interface. NestJS's `app.listen()` expects the HTTP server to emit a `'listening'` event:

```typescript
// What NestJS tries to do internally (doesn't work with uWS)
this.httpServer.once('listening', callback); // uWS doesn't have .once()
```

**The Solution:**

We split initialization into two steps:

1. `app.init()` - NestJS sets up routes, middleware, and dependency injection
2. `adapter.listen()` - uWS starts the server directly

```typescript
// Correct pattern for uWS
await app.init();
adapter.listen(3000, callback);
```

**This is the standard pattern for uWS adapters** - it's not a limitation, but rather the proper way to integrate uWebSockets.js with NestJS's lifecycle.

**What happens if you call `listen()` before `init()`?**

If you forget to call `app.init()` before `adapter.listen()`, your routes won't be registered and the server will respond with 404 for all requests:

```typescript
// WRONG - Routes not registered yet
const adapter = new UwsPlatformAdapter();
const app = await NestFactory.create(AppModule, adapter);
adapter.listen(3000); // Server starts but has no routes!

// CORRECT - Routes registered before listening
const adapter = new UwsPlatformAdapter();
const app = await NestFactory.create(AppModule, adapter);
await app.init(); // Register routes first
adapter.listen(3000); // Now routes are available
```

**Symptoms of missing `app.init()`:**
- All requests return 404 Not Found
- No error message in console
- Server appears to be running normally
- Controllers and routes are not registered

**Quick fix:** Always call `await app.init()` before `adapter.listen()`.

### HTTP + WebSocket on Same Port

To run both HTTP and WebSocket on the same port, share the uWS instance:

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { UwsAdapter } from 'uwestjs/websocket';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create HTTP adapter
  const httpAdapter = new UwsPlatformAdapter({
    maxBodySize: 10 * 1024 * 1024,
  });
  
  const app = await NestFactory.create(AppModule, httpAdapter);
  
  // Initialize WebSocket adapter with shared uWS instance
  const wsAdapter = httpAdapter.initWebSocketAdapter(app.getHttpServer());
  app.useWebSocketAdapter(wsAdapter);
  
  // Initialize the app
  await app.init();
  
  // Start server (HTTP + WebSocket on same port)
  httpAdapter.listen(3000, () => {
    console.log('HTTP + WebSocket server running on port 3000');
  });
}
bootstrap();
```

### Separate Ports for HTTP and WebSocket

If you need HTTP and WebSocket on different ports:

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { UwsAdapter } from 'uwestjs/websocket';
import { AppModule } from './app.module';

async function bootstrap() {
  // HTTP on port 3000
  const httpAdapter = new UwsPlatformAdapter();
  const app = await NestFactory.create(AppModule, httpAdapter);
  
  // WebSocket on port 8099
  const wsAdapter = new UwsAdapter(app, { port: 8099 });
  app.useWebSocketAdapter(wsAdapter);
  
  // Initialize the app
  await app.init();
  
  // Start HTTP server
  httpAdapter.listen(3000, () => {
    console.log('HTTP server running on port 3000');
    console.log('WebSocket server running on port 8099');
  });
}
bootstrap();
```

## Configuration

### PlatformOptions

Configuration options for the HTTP adapter.

```typescript
interface PlatformOptions {
  // HTTP options
  maxBodySize?: number;
  trustProxy?: boolean | number | string | string[] | ((ip: string, hopIndex: number) => boolean);
  etag?: false | 'weak' | 'strong';
  bodyParser?: {
    json?: boolean;
    urlencoded?: boolean;
    raw?: boolean;
    text?: boolean;
  };
  
  // uWebSockets.js options
  key_file_name?: string;
  cert_file_name?: string;
  passphrase?: string;
  dh_params_file_name?: string;
  ssl_prefer_low_memory_usage?: boolean;
  
  // CORS options
  cors?: CorsOptions;
  
  // Logger
  logger?: Logger;
}
```

#### maxBodySize

Maximum request body size in bytes.

**Default:** `1048576` (1MB)

**Example:**

```typescript
new UwsPlatformAdapter({
  maxBodySize: 10 * 1024 * 1024, // 10MB
})
```

#### trustProxy

Trust proxy headers (X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host). This setting controls whether the server trusts these headers to determine the client's real IP address, protocol, and hostname.

**Security Warning:** Incorrect configuration can allow IP spoofing! Only enable this when your application is behind a trusted reverse proxy (nginx, Apache, load balancer, etc.). Never use `trustProxy: true` in production without understanding the security implications.

**Options:**
- `false`: Do not trust any proxy (default, safest)
- `true`: Trust all proxies (dangerous - only use in development)
- `number`: Trust N hops from the client
- `string | string[]`: Trust specific proxy IPs/CIDRs
- `(ip, hopIndex) => boolean`: Custom validation function

**Default:** `false`

**When to Enable:**
- Your app is behind nginx, Apache, or a cloud load balancer
- You need accurate client IP addresses for rate limiting, logging, or geolocation
- You need to detect HTTPS connections when SSL is terminated at the proxy

**When to Keep Disabled:**
- Your app is directly exposed to the internet
- You're not behind a reverse proxy
- You don't need X-Forwarded-* headers

**Examples:**

```typescript
// Development only - trust all proxies (NOT for production!)
new UwsPlatformAdapter({ trustProxy: true })

// Production - trust first proxy (common with single reverse proxy)
new UwsPlatformAdapter({ trustProxy: 1 })

// Production - trust specific proxy IPs (recommended)
new UwsPlatformAdapter({
  trustProxy: ['127.0.0.1', '::1', '10.0.0.1']
})

// Production - trust private network proxies
new UwsPlatformAdapter({
  trustProxy: (ip, hopIndex) => {
    // Trust proxies in private IP ranges
    return ip.startsWith('10.') || 
           ip.startsWith('192.168.') || 
           ip.startsWith('172.16.');
  }
})

// Cloud deployment - trust cloud provider's load balancer
new UwsPlatformAdapter({
  trustProxy: ['10.0.0.0/8'] // AWS VPC, adjust for your provider
})
```

**Security Best Practices:**
1. Never use `trustProxy: true` in production
2. Always specify exact proxy IPs or use a validation function
3. Regularly audit your proxy configuration
4. Monitor for suspicious X-Forwarded-For values in logs

**Impact on Request Properties:**
When `trustProxy` is enabled, these properties respect X-Forwarded-* headers:
- `req.ip` - Uses X-Forwarded-For
- `req.ips` - Parses X-Forwarded-For chain
- `req.protocol` - Uses X-Forwarded-Proto
- `req.hostname` - Uses X-Forwarded-Host
- `req.secure` - Checks X-Forwarded-Proto === 'https'



#### etag

Enable ETag generation for responses.

**Default:** `'weak'`

**Options:**
- `false`: Disable ETags
- `'weak'`: Generate weak ETags (W/"...")
- `'strong'`: Generate strong ETags

**Example:**

```typescript
new UwsPlatformAdapter({
  etag: 'weak', // Enable weak ETags
})
```

#### bodyParser

Configure automatic body parsing for different content types.

**Default:**

```typescript
{
  json: true,
  urlencoded: true,
  raw: false,
  text: false,
}
```

**Example:**

```typescript
new UwsPlatformAdapter({
  bodyParser: {
    json: true,
    urlencoded: true,
    raw: true,  // Enable raw buffer parsing
    text: true, // Enable text parsing
  },
})
```

#### SSL/TLS Options

Configure HTTPS server with SSL certificates.

**Example:**

```typescript
new UwsPlatformAdapter({
  key_file_name: '/path/to/private-key.pem',
  cert_file_name: '/path/to/certificate.pem',
  passphrase: 'your-passphrase',
})
```

## Server Methods

### listen()

Start the HTTP server on the specified port.

```typescript
listen(port: number, callback?: (error?: Error) => void): void
listen(port: number, hostname: string, callback?: (error?: Error) => void): void
```

**Parameters:**
- `port` - Port number to listen on (0-65535)
- `hostname` - Optional hostname (default: '0.0.0.0')
- `callback` - Optional error-first callback when server starts or fails

**Important:** You must call `app.init()` before calling `adapter.listen()`.

**Example:**

```typescript
const adapter = new UwsPlatformAdapter();
const app = await NestFactory.create(AppModule, adapter);

await app.init();

// Simple
adapter.listen(3000);

// With error handling
adapter.listen(3000, (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  console.log('Server started on port 3000');
});

// With hostname and error handling
adapter.listen(3000, '127.0.0.1', (error) => {
  if (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  console.log('Server started on localhost:3000');
});
```

### close()

Close the HTTP server and all connections.

```typescript
close(): Promise<void>
```

**Usage:**

You can close the server in two ways:

1. **Using `app.close()`** (Recommended) - Closes the entire NestJS application, including the adapter:

```typescript
// Graceful shutdown - closes app and adapter
process.on('SIGTERM', async () => {
  await app.close(); // NestJS calls adapter.close() internally
  process.exit(0);
});
```

2. **Using `adapter.close()`** (Direct) - Closes only the HTTP server:

```typescript
// Direct adapter close
process.on('SIGTERM', async () => {
  await adapter.close(); // Only closes the HTTP server
  process.exit(0);
});
```

**Recommendation:** Use `app.close()` for graceful shutdown as it properly cleans up all NestJS resources (modules, providers, connections) before closing the server. Use `adapter.close()` only if you need to close the HTTP server independently while keeping the NestJS application running.

### getHttpServer()

Get the underlying uWebSockets.js server instance.

```typescript
getHttpServer(): uWS.TemplatedApp
```

**Example:**

```typescript
const adapter = app.getHttpAdapter();
const uwsApp = adapter.getHttpServer();
```

### getInstance()

Alias for `getHttpServer()`.

```typescript
getInstance(): uWS.TemplatedApp
```

### getType()

Get the adapter type identifier.

```typescript
getType(): string
```

**Returns:** `'uws'`

## Static File Serving

Serve static files with advanced caching, compression, and range request support.

### useStaticAssets()

Enable static file serving from a directory.

```typescript
useStaticAssets(path: string, options?: StaticFileOptions): void
```

**Parameters:**
- `path` - Directory path to serve files from
- `options` - Optional configuration

**Example:**

```typescript
// Basic usage
app.useStaticAssets('public');

// With options
app.useStaticAssets('public', {
  prefix: '/static',
  index: ['index.html', 'index.htm'],
  maxAge: '1d', // or milliseconds: 86400000
  etag: true,
  lastModified: true,
  cacheControl: true,
  immutable: false,
  dotfiles: 'ignore',
  redirect: true,
  silent: false,
});
```

### StaticFileOptions

```typescript
interface StaticFileOptions {
  prefix?: string;           // URL prefix (default: '/')
  index?: string | string[]; // Index files (default: ['index.html'])
  maxAge?: number | string;  // Cache max-age: number in milliseconds or string ('1d', '2h', '30m') (default: 0)
  etag?: boolean | 'weak' | 'strong'; // Enable ETags: true/'weak' for weak, 'strong' for strong, false to disable (default: true)
  lastModified?: boolean;    // Send Last-Modified header (default: true)
  cacheControl?: boolean;    // Send Cache-Control header (default: true)
  immutable?: boolean;       // Add immutable directive (default: false)
  dotfiles?: 'allow' | 'deny' | 'ignore' | 'ignore_files'; // Dotfile handling (default: 'ignore')
  redirect?: boolean;        // Redirect to trailing slash (default: true)
  silent?: boolean;          // Suppress logging (default: false)
}
```

### Advanced Static File Examples

#### Multiple Static Directories

```typescript
// Serve from multiple directories
app.useStaticAssets('public', { prefix: '/public' });
app.useStaticAssets('uploads', { prefix: '/uploads' });
app.useStaticAssets('assets', { prefix: '/assets' });
```

#### Long-term Caching

```typescript
// Cache static assets for 1 year
app.useStaticAssets('public/assets', {
  prefix: '/assets',
  maxAge: '1y', // or milliseconds: 31536000000
  immutable: true,  // Add immutable directive
});
```

#### Custom Index Files

```typescript
app.useStaticAssets('docs', {
  prefix: '/docs',
  index: ['README.md', 'index.html', 'index.htm'],
});
```

#### Disable Caching for Development

```typescript
if (process.env.NODE_ENV === 'development') {
  app.useStaticAssets('public', {
    maxAge: 0,
    etag: false,
    cacheControl: false,
  });
}
```

## CORS Configuration

Configure Cross-Origin Resource Sharing for your HTTP server.

### enableCors()

Enable CORS with optional configuration.

```typescript
enableCors(options?: CorsOptions): void
```

**Example:**

```typescript
// Enable CORS for all origins
app.enableCors();

// Specific origin
app.enableCors({
  origin: 'https://example.com',
  credentials: true,
});

// Multiple origins
app.enableCors({
  origin: ['https://example.com', 'https://app.example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Dynamic origin validation
app.enableCors({
  origin: (origin) => {
    return origin?.endsWith('.example.com') ?? false;
  },
  credentials: true,
});
```

### CorsOptions

```typescript
interface CorsOptions {
  origin?: string | string[] | ((origin: string | null) => boolean);
  credentials?: boolean;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  maxAge?: number;
}
```

See [CORS.md](./CORS.md) for detailed CORS documentation.

## Performance Tuning

### Body Size Limits

Adjust based on your application needs:

```typescript
// For APIs with small payloads
new UwsPlatformAdapter({
  maxBodySize: 100 * 1024, // 100KB
})

// For file uploads
new UwsPlatformAdapter({
  maxBodySize: 50 * 1024 * 1024, // 50MB
})
```

### Static File Caching

Optimize static file serving:

```typescript
// Production: aggressive caching
app.useStaticAssets('public', {
  maxAge: '1y', // or milliseconds: 31536000000
  immutable: true,
  etag: true,
  lastModified: true,
});

// Development: no caching
app.useStaticAssets('public', {
  maxAge: 0,
  etag: false,
  cacheControl: false,
});
```

### Worker Pool for Static Files

The adapter automatically uses a worker pool for static file operations. The default pool size is CPU-aware:

```typescript
// Default: Math.max(1, Math.min(4, os.cpus().length - 1))
// On 8-core machine: 4 workers
// On 2-core machine: 1 worker
```

### SSL/TLS Performance

For HTTPS, consider:

```typescript
new UwsPlatformAdapter({
  key_file_name: '/path/to/key.pem',
  cert_file_name: '/path/to/cert.pem',
  ssl_prefer_low_memory_usage: true, // Reduce memory usage
})
```

## Migration from Express

### Before (Express)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  app.useStaticAssets('public');
  
  await app.listen(3000);
}
bootstrap();
```

### After (uWestJS)

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { AppModule } from './app.module';

async function bootstrap() {
  const adapter = new UwsPlatformAdapter({
    maxBodySize: 10 * 1024 * 1024,
    trustProxy: true,
  });
  
  const app = await NestFactory.create(AppModule, adapter);
  
  app.enableCors();
  app.useStaticAssets('public');
  
  // Key difference: init() before listen()
  await app.init();
  adapter.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}
bootstrap();
```

**Key Changes:**

1. Create adapter instance separately to access `listen()` method
2. Call `app.init()` before starting the server
3. Use `adapter.listen()` instead of `app.listen()`

Your controllers, services, and business logic remain unchanged!

## Best Practices

1. **Set appropriate body size limits** based on your use case
2. **Enable trustProxy** when behind a reverse proxy
3. **Use long-term caching** for static assets in production
4. **Enable compression** for large responses (handled automatically)
5. **Configure CORS properly** - never use `origin: '*'` with `credentials: true`
6. **Use ETags** for efficient caching
7. **Monitor backpressure** for streaming responses

## See Also

- [Request](./Request.md) - HTTP Request object documentation
- [Response](./Response.md) - HTTP Response object documentation
- [CORS](./CORS.md) - Detailed CORS documentation
- [Static Files](./Static-Files.md) - Advanced static file serving
