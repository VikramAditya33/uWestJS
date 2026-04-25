# CORS (Cross-Origin Resource Sharing)

Complete guide to configuring CORS for your uWestJS HTTP server.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration Options](#configuration-options)
- [Origin Validation](#origin-validation)
- [Credentials](#credentials)
- [Preflight Requests](#preflight-requests)
- [Security Best Practices](#security-best-practices)
- [Examples](#examples)

## Overview

CORS (Cross-Origin Resource Sharing) is a security feature that controls which origins can access your API. uWestJS provides flexible CORS configuration through the `enableCors()` method.

**When do you need CORS?**
- Your frontend is hosted on a different domain than your API
- You're building a public API that will be accessed from browsers
- You need to allow specific origins to make authenticated requests

## Quick Start

### Enable for All Origins (Development Only)

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new UwsPlatformAdapter()
  );
  
  // Allow all origins (development only!)
  app.enableCors();
  
  await app.listen(3000);
}
bootstrap();
```

### Enable for Specific Origin (Production)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new UwsPlatformAdapter()
  );
  
  // Allow specific origin
  app.enableCors({
    origin: 'https://example.com',
    credentials: true,
  });
  
  await app.listen(3000);
}
bootstrap();
```

## Configuration Options

### CorsOptions Interface

```typescript
interface CorsOptions {
  /**
   * Allowed origin(s)
   * - string: Single origin
   * - string[]: Multiple origins
   * - (origin) => boolean: Dynamic validation
   * - '*': All origins (not recommended with credentials)
   */
  origin?: string | string[] | ((origin: string | null) => boolean);

  /**
   * Allow credentials (cookies, authorization headers)
   * Default: false
   */
  credentials?: boolean;

  /**
   * Allowed HTTP methods
   * Default: ['GET', 'POST']
   */
  methods?: string | string[];

  /**
   * Headers that clients can send
   * Default: ['Content-Type', 'Authorization']
   */
  allowedHeaders?: string | string[];

  /**
   * Headers that are exposed to the client
   * Default: []
   */
  exposedHeaders?: string | string[];

  /**
   * How long preflight results can be cached (seconds)
   * Default: 86400 (24 hours)
   */
  maxAge?: number;
}
```

### Complete Configuration Example

```typescript
app.enableCors({
  origin: 'https://example.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
  maxAge: 3600, // 1 hour
});
```

## Origin Validation

### Single Origin

```typescript
app.enableCors({
  origin: 'https://example.com',
});
```

### Multiple Origins

```typescript
app.enableCors({
  origin: [
    'https://example.com',
    'https://app.example.com',
    'https://admin.example.com',
  ],
});
```

### Wildcard (All Origins)

```typescript
// Development only!
app.enableCors({
  origin: '*',
});
```

**Warning:** Never use `origin: '*'` with `credentials: true` in production. This is a security vulnerability.

### Dynamic Origin Validation

```typescript
app.enableCors({
  origin: (origin) => {
    // Allow all subdomains of example.com
    if (origin?.endsWith('.example.com')) {
      return true;
    }
    
    // Allow specific domains
    const allowedDomains = ['example.com', 'partner.com'];
    return allowedDomains.some(domain => origin?.includes(domain));
  },
  credentials: true,
});
```

### Environment-Based Configuration

```typescript
app.enableCors({
  origin: (origin) => {
    if (process.env.NODE_ENV === 'development') {
      // Allow localhost in development
      return origin?.includes('localhost') ?? false;
    }
    
    // Production: strict validation
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    return origin ? allowedOrigins.includes(origin) : false;
  },
  credentials: true,
});
```

### Null Origin Handling

Some contexts (sandboxed iframes, local files) send `null` as the origin:

```typescript
app.enableCors({
  origin: (origin) => {
    // Reject null origins for security
    if (!origin) {
      return false;
    }
    
    // Validate non-null origins
    return origin.endsWith('.example.com');
  },
});
```

## Credentials

### Enable Credentials

```typescript
app.enableCors({
  origin: 'https://example.com',
  credentials: true, // Allow cookies and auth headers
});
```

### Client-Side (Fetch API)

```javascript
fetch('https://api.example.com/data', {
  method: 'GET',
  credentials: 'include', // Send cookies
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

### Client-Side (Axios)

```javascript
axios.get('https://api.example.com/data', {
  withCredentials: true, // Send cookies
  headers: {
    'Authorization': 'Bearer token',
  },
});
```

## Preflight Requests

Browsers send preflight OPTIONS requests for:
- Non-simple methods (PUT, DELETE, PATCH)
- Custom headers
- Content-Type other than application/x-www-form-urlencoded, multipart/form-data, or text/plain

### Automatic Handling

uWestJS automatically handles preflight requests:

```typescript
app.enableCors({
  origin: 'https://example.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600, // Cache preflight for 1 hour
});
```

### Manual Preflight Handling

If you need custom preflight logic:

```typescript
@Controller('api')
export class ApiController {
  @Options('*')
  handlePreflight(@Res() res: UwsResponse) {
    // Custom preflight logic
    res.status(204).send();
  }
}
```

## Security Best Practices

### 1. Never Use Wildcard with Credentials

```typescript
// DANGEROUS - Security vulnerability!
app.enableCors({
  origin: '*',
  credentials: true,
});

// SAFE - Specific origins
app.enableCors({
  origin: 'https://example.com',
  credentials: true,
});
```

### 2. Validate Origins Strictly

```typescript
// Good - strict validation
app.enableCors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://example.com',
      'https://app.example.com',
    ];
    return origin ? allowedOrigins.includes(origin) : false;
  },
});

// Bad - loose validation
app.enableCors({
  origin: (origin) => {
    return origin?.includes('example') ?? false; // Too permissive!
  },
});
```

### 3. Limit Allowed Methods

```typescript
// Good - only needed methods
app.enableCors({
  methods: ['GET', 'POST'],
});

// Bad - all methods
app.enableCors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
});
```

### 4. Limit Exposed Headers

```typescript
// Good - only necessary headers
app.enableCors({
  exposedHeaders: ['X-Total-Count'],
});

// Bad - exposing sensitive headers
app.enableCors({
  exposedHeaders: ['X-API-Key', 'X-Internal-Token'], // Don't expose secrets!
});
```

### 5. Use HTTPS in Production

```typescript
app.enableCors({
  origin: (origin) => {
    if (process.env.NODE_ENV === 'production') {
      // Require HTTPS in production
      return origin?.startsWith('https://') ?? false;
    }
    return true;
  },
});
```

## Examples

### Public API

```typescript
// Allow all origins, no credentials
app.enableCors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
});
```

### Authenticated API

```typescript
// Specific origins with credentials
app.enableCors({
  origin: [
    'https://example.com',
    'https://app.example.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Number'],
  maxAge: 3600,
});
```

### Development vs Production

```typescript
const corsOptions: CorsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://example.com', 'https://app.example.com']
    : ['http://localhost:3000', 'http://localhost:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.enableCors(corsOptions);
```

### Multi-Tenant Application

```typescript
app.enableCors({
  origin: (origin) => {
    if (!origin) return false;
    
    // Allow all tenant subdomains
    const tenantPattern = /^https:\/\/[\w-]+\.example\.com$/;
    if (tenantPattern.test(origin)) {
      return true;
    }
    
    // Allow main domain
    return origin === 'https://example.com';
  },
  credentials: true,
});
```

### API with Custom Headers

```typescript
app.enableCors({
  origin: 'https://example.com',
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Client-Version',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
});
```

### Microservices Gateway

```typescript
app.enableCors({
  origin: (origin) => {
    // Allow requests from other microservices
    const internalServices = [
      'http://auth-service:3001',
      'http://user-service:3002',
      'http://payment-service:3003',
    ];
    
    if (origin && internalServices.includes(origin)) {
      return true;
    }
    
    // Allow external clients
    return origin === 'https://example.com';
  },
  credentials: true,
});
```

### Mobile App API

```typescript
app.enableCors({
  origin: (origin) => {
    // Mobile apps may send null origin
    if (!origin) {
      // Validate using other headers (e.g., API key)
      return true;
    }
    
    // Web clients must be from allowed domains
    return origin.endsWith('.example.com');
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});
```

## Troubleshooting

### CORS Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** Origin not allowed

**Solution:**
```typescript
// Check your origin configuration
app.enableCors({
  origin: 'https://your-frontend-domain.com', // Must match exactly
});
```

### CORS Error: "Credentials flag is true, but Access-Control-Allow-Credentials is not"

**Cause:** Credentials not enabled on server

**Solution:**
```typescript
app.enableCors({
  origin: 'https://example.com',
  credentials: true, // Add this
});
```

### CORS Error: "Method not allowed"

**Cause:** HTTP method not in allowed methods

**Solution:**
```typescript
app.enableCors({
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Add your method
});
```

### CORS Error: "Header not allowed"

**Cause:** Custom header not in allowed headers

**Solution:**
```typescript
app.enableCors({
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
});
```

### Preflight Request Fails

**Cause:** OPTIONS request not handled

**Solution:** uWestJS handles OPTIONS automatically. If it's not working:

```typescript
// Ensure CORS is enabled before routes
app.enableCors({
  origin: 'https://example.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});
```

## Testing CORS

### Using cURL

```bash
# Test simple request
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/data

# Test with credentials
curl -H "Origin: https://example.com" \
     -H "Cookie: session=abc123" \
     http://localhost:3000/api/data
```

### Using Browser Console

```javascript
// Test CORS from browser console
fetch('http://localhost:3000/api/data', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('CORS Error:', error));
```

## See Also

- [Server](./Server.md) - Server configuration
- [Security Best Practices](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) - MDN CORS Guide
- [OWASP CORS](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html) - Security guidelines
