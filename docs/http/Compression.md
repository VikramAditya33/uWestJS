# HTTP Compression

Automatic request and response compression support for reducing bandwidth usage.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [Supported Algorithms](#supported-algorithms)
- [Response Compression](#response-compression)
- [Request Decompression](#request-decompression)
- [Examples](#examples)

---

## Overview

uWestJS provides built-in compression support for both requests and responses:

- **Response Compression** - Automatically compress responses based on client capabilities
- **Request Decompression** - Automatically decompress incoming compressed requests
- **Multiple Algorithms** - Support for gzip, deflate, and brotli compression
- **Smart Compression** - Only compress compressible content types
- **Configurable Thresholds** - Control when compression is applied

---

## Configuration

### Basic Setup

Compression is automatically enabled when you create the HTTP adapter:

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';

const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    compression: {
      enabled: true, // Enable compression (default: true)
    },
  })
);
```

### Compression Options

```typescript
interface CompressionOptions {
  enabled?: boolean;
  threshold?: number;
  level?: number;
  memLevel?: number;
  strategy?: number;
  filter?: (req: Request, res: Response) => boolean;
  brotli?: {
    enabled?: boolean;
    quality?: number;
  };
}
```

### enabled

```typescript
enabled?: boolean
```

Enable or disable compression globally.

**Default:** `true`

**Example:**

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
  },
})
```

### threshold

```typescript
threshold?: number
```

Minimum response size (in bytes) to compress. Responses smaller than this won't be compressed.

**Default:** `1024` (1KB)

**Example:**

```typescript
new UwsPlatformAdapter({
  compression: {
    threshold: 2048, // Only compress responses >= 2KB
  },
})
```

### level

```typescript
level?: number
```

Compression level for gzip and deflate (0-9).

- `0` - No compression (fastest)
- `1` - Fastest compression
- `6` - Default compression (balanced)
- `9` - Best compression (slowest)

**Default:** `6`

**Example:**

```typescript
new UwsPlatformAdapter({
  compression: {
    level: 9, // Maximum compression
  },
})
```

### memLevel

```typescript
memLevel?: number
```

Memory level for gzip and deflate (1-9). Higher values use more memory but may improve compression.

**Default:** `8`

### strategy

```typescript
strategy?: number
```

Compression strategy for gzip and deflate.

**Default:** `0` (Z_DEFAULT_STRATEGY)

### filter

```typescript
filter?: (req: Request, res: Response) => boolean
```

Custom function to determine if a response should be compressed.

**Example:**

```typescript
new UwsPlatformAdapter({
  compression: {
    filter: (req, res) => {
      // Don't compress responses for specific paths
      if (req.url.startsWith('/api/stream')) {
        return false;
      }
      return true;
    },
  },
})
```

### brotli

```typescript
brotli?: {
  enabled?: boolean;
  quality?: number;
}
```

Brotli compression configuration.

**Options:**
- `enabled` - Enable brotli compression (default: `true`)
- `quality` - Brotli quality level 0-11 (default: `4`)

**Example:**

```typescript
new UwsPlatformAdapter({
  compression: {
    brotli: {
      enabled: true,
      quality: 6, // Higher quality compression
    },
  },
})
```

---

## Supported Algorithms

### Algorithm Priority

When a client supports multiple algorithms, the server uses this priority:

1. **Brotli (br)** - Best compression ratio, modern browsers
2. **Gzip (gzip)** - Good compression, universal support
3. **Deflate (deflate)** - Basic compression, legacy support

### Client Support

The server automatically selects the best algorithm based on the `Accept-Encoding` header:

```
Accept-Encoding: gzip, deflate, br
```

---

## Response Compression

### Automatic Compression

Responses are automatically compressed when:

1. Client supports compression (via `Accept-Encoding` header)
2. Response size exceeds threshold (default: 1KB)
3. Content type is compressible
4. Response hasn't been sent yet

**Example:**

```typescript
@Controller('api')
export class ApiController {
  @Get('data')
  getData() {
    // Large response will be automatically compressed
    return {
      data: Array(1000).fill({ id: 1, name: 'Item', description: 'Description' }),
    };
  }
}
```

### Compressible Content Types

By default, these content types are compressed:

- `text/*` (text/html, text/plain, text/css, text/javascript, etc.)
- `application/json`
- `application/javascript`
- `application/xml`
- `application/x-javascript`
- `image/svg+xml`

**Non-compressible types** (already compressed):
- `image/jpeg`, `image/png`, `image/gif`
- `video/*`
- `audio/*`
- `application/zip`, `application/gzip`

### Streaming Compression

For streaming responses, compression is applied on-the-fly:

```typescript
@Controller('api')
export class StreamController {
  @Get('stream')
  streamData(@Res() res: Response) {
    // Stream will be compressed automatically
    const stream = fs.createReadStream('large-file.json');
    stream.pipe(res);
  }
}
```

### Vary Header

The server automatically adds the `Vary: Accept-Encoding` header to compressed responses for proper caching:

```
HTTP/1.1 200 OK
Content-Encoding: gzip
Vary: Accept-Encoding
Content-Type: application/json
```

---

## Request Decompression

### Automatic Decompression

Incoming compressed requests are automatically decompressed based on the `Content-Encoding` header:

```typescript
@Controller('api')
export class UploadController {
  @Post('upload')
  async upload(@Body() data: any) {
    // Request body is automatically decompressed
    console.log(data);
    return { received: true };
  }
}
```

### Supported Encodings

- `gzip` - Gzip compressed requests
- `deflate` - Deflate compressed requests
- `br` - Brotli compressed requests

### Size Limits

Decompressed request size is limited to prevent memory exhaustion:

**Default limit:** 10MB decompressed

**Example client request:**

```bash
# Compress and send data
echo '{"large":"data"}' | gzip | curl -X POST \
  -H "Content-Encoding: gzip" \
  -H "Content-Type: application/json" \
  --data-binary @- \
  http://localhost:3000/api/upload
```

---

## Examples

### Basic Configuration

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';

const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    compression: {
      enabled: true,
      threshold: 1024, // 1KB
      level: 6, // Default compression
    },
  })
);

await app.listen(3000);
```

### High Compression

For maximum compression (slower, but smaller responses):

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
    level: 9, // Maximum gzip/deflate compression
    brotli: {
      enabled: true,
      quality: 11, // Maximum brotli compression
    },
  },
})
```

### Fast Compression

For faster compression (larger responses, but faster):

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
    level: 1, // Fastest gzip/deflate compression
    brotli: {
      enabled: true,
      quality: 0, // Fastest brotli compression
    },
  },
})
```

### Selective Compression

Compress only specific routes:

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
    filter: (req, res) => {
      // Only compress API responses
      if (req.url.startsWith('/api/')) {
        return true;
      }
      // Don't compress static files (already optimized)
      if (req.url.startsWith('/static/')) {
        return false;
      }
      return true;
    },
  },
})
```

### Large Threshold

Only compress very large responses:

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
    threshold: 10240, // Only compress responses >= 10KB
  },
})
```

### Disable Brotli

Use only gzip and deflate:

```typescript
new UwsPlatformAdapter({
  compression: {
    enabled: true,
    brotli: {
      enabled: false, // Disable brotli
    },
  },
})
```

### API Response Compression

```typescript
@Controller('api')
export class DataController {
  @Get('large-dataset')
  getLargeDataset() {
    // This response will be automatically compressed
    return {
      data: Array(10000).fill({
        id: 1,
        name: 'Item',
        description: 'Long description text',
        metadata: {
          created: new Date(),
          updated: new Date(),
        },
      }),
    };
  }
  
  @Get('small-response')
  getSmallResponse() {
    // This response won't be compressed (below threshold)
    return { status: 'ok' };
  }
}
```

### Compressed Upload

```typescript
@Controller('api')
export class UploadController {
  @Post('upload-compressed')
  async uploadCompressed(@Body() data: any) {
    // Client sends compressed data:
    // curl -X POST -H "Content-Encoding: gzip" \
    //   -H "Content-Type: application/json" \
    //   --data-binary @data.json.gz \
    //   http://localhost:3000/api/upload-compressed
    
    // Data is automatically decompressed
    console.log('Received data:', data);
    return { received: true, size: JSON.stringify(data).length };
  }
}
```

### Streaming with Compression

```typescript
@Controller('api')
export class StreamController {
  @Get('stream-large-file')
  streamLargeFile(@Res() res: Response) {
    res.setHeader('Content-Type', 'application/json');
    
    // Stream will be compressed automatically
    const stream = fs.createReadStream('large-data.json');
    stream.pipe(res);
  }
}
```

---

## Performance Considerations

### Compression Level Trade-offs

- **Level 1-3** - Fast compression, larger files, good for real-time data
- **Level 4-6** - Balanced compression (recommended for most use cases)
- **Level 7-9** - Slow compression, smaller files, good for static content

### When to Disable Compression

Disable compression for:

- Already compressed content (images, videos, archives)
- Very small responses (< 1KB)
- Real-time streaming where latency matters
- CPU-constrained environments

### Brotli vs Gzip

**Brotli:**
- Better compression ratio (10-20% smaller)
- Slower compression
- Modern browser support
- Best for static content

**Gzip:**
- Faster compression
- Universal support
- Good for dynamic content
- Better for real-time responses

---

## See Also

- [Server](./Server.md)
- [Request](./Request.md)
- [Response](./Response.md)
- [Body Parsing](./Body-Parsing.md)
