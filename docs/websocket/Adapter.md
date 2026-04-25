# WebSocket Adapter

The UwsAdapter integrates uWebSockets.js with NestJS for high-performance WebSocket communication.

## Table of Contents

- [Overview](#overview)
- [Constructor](#constructor)
- [Configuration Options](#configuration-options)
- [Methods](#methods)
- [Manual Gateway Registration](#manual-gateway-registration)
- [HTTP + WebSocket Integration](#http--websocket-integration)
- [Examples](#examples)

---

## Overview

The UwsAdapter provides a high-performance WebSocket implementation using uWebSockets.js. It supports:

- Manual gateway registration for better control
- Multiple gateway support
- Dependency injection for middleware
- Room-based broadcasting
- SSL/TLS support
- HTTP + WebSocket integration (v2.0.0+)

## Constructor

```typescript
constructor(app: INestApplicationContext, options?: UwsAdapterOptions)
```

Creates a new UwsAdapter instance.

**Parameters:**
- `app` - NestJS application context
- `options` - Optional configuration options

**Example:**

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsAdapter } from 'uwestjs';

const app = await NestFactory.create(AppModule);
const adapter = new UwsAdapter(app, {
  port: 8099,
  maxPayloadLength: 16384,
  idleTimeout: 60,
});
app.useWebSocketAdapter(adapter);
```

---

## Configuration Options

### UwsAdapterOptions

```typescript
interface UwsAdapterOptions {
  port?: number;
  maxPayloadLength?: number;
  idleTimeout?: number;
  compression?: uWS.CompressOptions;
  path?: string;
  cors?: CorsOptions;
  moduleRef?: ModuleRef;
  uwsApp?: uWS.TemplatedApp;
  cert_file_name?: string;
  key_file_name?: string;
  passphrase?: string;
  dh_params_file_name?: string;
  ssl_prefer_low_memory_usage?: boolean;
}
```

### port

```typescript
port?: number
```

WebSocket server port.

**Default:** `8099`

**Example:**

```typescript
new UwsAdapter(app, { port: 3001 });
```

### maxPayloadLength

```typescript
maxPayloadLength?: number
```

Maximum payload length in bytes. Messages larger than this will be rejected.

**Default:** `16384` (16KB)

**Example:**

```typescript
// Allow 1MB messages
new UwsAdapter(app, { maxPayloadLength: 1024 * 1024 });

// For large file transfers
new UwsAdapter(app, { maxPayloadLength: 10 * 1024 * 1024 }); // 10MB
```

### idleTimeout

```typescript
idleTimeout?: number
```

Idle timeout in seconds. Connections that don't send any data within this time will be automatically closed.

**Default:** `60` seconds

**Example:**

```typescript
// 5 minute timeout
new UwsAdapter(app, { idleTimeout: 300 });

// Disable timeout (not recommended for production)
new UwsAdapter(app, { idleTimeout: 0 });
```

### compression

```typescript
compression?: uWS.CompressOptions
```

Compression mode for WebSocket messages.

**Default:** `uWS.SHARED_COMPRESSOR`

**Options:**
- `uWS.DISABLED` - No compression
- `uWS.SHARED_COMPRESSOR` - Shared compressor (recommended)
- `uWS.DEDICATED_COMPRESSOR` - Dedicated compressor per connection

**Example:**

```typescript
import * as uWS from 'uWebSockets.js';

// Disable compression
new UwsAdapter(app, { compression: uWS.DISABLED });

// Use dedicated compressor (higher memory, better compression)
new UwsAdapter(app, { compression: uWS.DEDICATED_COMPRESSOR });
```

### path

```typescript
path?: string
```

WebSocket endpoint path.

**Default:** `'/*'`

**Example:**

```typescript
// Specific path
new UwsAdapter(app, { path: '/ws' });

// Multiple paths (use wildcard)
new UwsAdapter(app, { path: '/api/ws/*' });
```

### cors

```typescript
cors?: CorsOptions
```

CORS configuration for WebSocket connections.

**Example:**

```typescript
new UwsAdapter(app, {
  cors: {
    origin: 'https://example.com',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});
```

See [CORS Options](#cors-options) for detailed configuration.

### moduleRef

```typescript
moduleRef?: ModuleRef
```

Module reference for dependency injection support. When provided, enables DI for guards, pipes, and filters.

**Important:** Without `moduleRef`, guards/pipes/filters are instantiated directly and cannot have constructor dependencies.

**Example:**

```typescript
import { ModuleRef } from '@nestjs/core';

const app = await NestFactory.create(AppModule);
const moduleRef = app.get(ModuleRef);

const adapter = new UwsAdapter(app, {
  port: 8099,
  moduleRef, // Enable DI support
});

// Now guards can inject services
@Injectable()
class WsAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {} // DI works!
  
  canActivate(context: any): boolean {
    const token = context.args[1]?.token;
    if (!token) return false;
    
    this.jwtService.verify(token);
    return true;
  }
}
```

### SSL/TLS Options

#### cert_file_name

```typescript
cert_file_name?: string
```

Path to SSL certificate file. Required for HTTPS/WSS.

#### key_file_name

```typescript
key_file_name?: string
```

Path to SSL private key file. Required for HTTPS/WSS.

#### passphrase

```typescript
passphrase?: string
```

Optional passphrase for encrypted private key.

#### dh_params_file_name

```typescript
dh_params_file_name?: string
```

Optional path to Diffie-Hellman parameters file for enhanced security.

#### ssl_prefer_low_memory_usage

```typescript
ssl_prefer_low_memory_usage?: boolean
```

Optimize SSL for lower memory usage at the cost of some performance.

**Example:**

```typescript
new UwsAdapter(app, {
  port: 8099,
  cert_file_name: './certs/server.crt',
  key_file_name: './certs/server.key',
  passphrase: 'your-passphrase',
});
```

### uwsApp

```typescript
uwsApp?: uWS.TemplatedApp
```

Provide an existing uWebSockets.js app instance for HTTP + WebSocket integration (v2.0.0+).

**Example:**

```typescript
import * as uWS from 'uWebSockets.js';

const uwsApp = uWS.App();

// HTTP adapter
const httpAdapter = new UwsPlatformAdapter(uwsApp);
const app = await NestFactory.create(AppModule, httpAdapter);

// WebSocket adapter (shares the same uWS instance)
const wsAdapter = new UwsAdapter(app, { uwsApp });
app.useWebSocketAdapter(wsAdapter);
```

---

## CORS Options

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

### origin

```typescript
origin?: string | string[] | ((origin: string | null) => boolean)
```

Allowed origins. Can be a string, array of strings, or a function that returns boolean.

**Default:** `undefined` (no CORS)

**Examples:**

```typescript
// Specific origin (recommended for production)
cors: { origin: 'https://example.com' }

// Allow all origins (use only for development/testing)
cors: { origin: '*' }

// Allow multiple origins
cors: { origin: ['https://example.com', 'https://app.example.com'] }

// Dynamic validation (recommended for flexible security)
cors: {
  origin: (origin) => {
    // Allow all subdomains of example.com
    return origin?.endsWith('.example.com') ?? false;
  }
}
```

**Security Warning:** Never use `origin: '*'` with `credentials: true` in production.

### credentials

```typescript
credentials?: boolean
```

Allow credentials (cookies, authorization headers, TLS client certificates).

**Default:** `false`

### methods

```typescript
methods?: string | string[]
```

Allowed HTTP methods for CORS preflight.

**Default:** `['GET', 'POST']`

### allowedHeaders

```typescript
allowedHeaders?: string | string[]
```

Headers that clients are allowed to send.

**Default:** `['Content-Type', 'Authorization']`

### exposedHeaders

```typescript
exposedHeaders?: string | string[]
```

Headers that are exposed to the client.

**Default:** `[]`

### maxAge

```typescript
maxAge?: number
```

How long (in seconds) the results of a preflight request can be cached.

**Default:** `86400` (24 hours)

---

## Methods

### registerGateway()

```typescript
registerGateway(gateway: object): void
```

Manually register a WebSocket gateway for message handling.

**Important:** We recommend calling `registerGateway()` manually over `bindMessageHandlers()` as this provides more metadata control and explicit lifecycle management.

**Parameters:**
- `gateway` - The gateway instance to register

**Example:**

```typescript
const app = await NestFactory.create(AppModule);
const adapter = new UwsAdapter(app, { port: 8099 });
app.useWebSocketAdapter(adapter);

// Manually register your gateway
const chatGateway = app.get(ChatGateway);
adapter.registerGateway(chatGateway);

await app.listen(3000);
```

**Why manual registration?**
- Better control over metadata scanning and handler registration timing
- Explicit gateway lifecycle management (afterInit, handleConnection, handleDisconnect)
- Clearer separation between adapter initialization and gateway registration
- Allows for custom handler registration strategies

### sendToClient()

```typescript
sendToClient(clientId: string, data: unknown): boolean
```

Send a message to a specific client.

**Parameters:**
- `clientId` - Client identifier
- `data` - Data to send (will be JSON stringified)

**Returns:** `true` if sent successfully, `false` otherwise

**Example:**

```typescript
const success = adapter.sendToClient('client-123', {
  event: 'notification',
  message: 'Hello!',
});
```

### broadcast()

```typescript
broadcast(data: unknown): void
```

Broadcast a message to all connected clients.

**Parameters:**
- `data` - Data to send (will be JSON stringified)

**Example:**

```typescript
adapter.broadcast({
  event: 'announcement',
  message: 'Server maintenance in 5 minutes',
});
```

### getClientCount()

```typescript
getClientCount(): number
```

Get the number of connected clients.

**Example:**

```typescript
const count = adapter.getClientCount();
console.log(`${count} clients connected`);
```

### getClientIds()

```typescript
getClientIds(): string[]
```

Get all connected client IDs.

**Example:**

```typescript
const clientIds = adapter.getClientIds();
clientIds.forEach(id => {
  console.log(`Client: ${id}`);
});
```

### hasClient()

```typescript
hasClient(clientId: string): boolean
```

Check if a client is connected.

**Example:**

```typescript
if (adapter.hasClient('client-123')) {
  adapter.sendToClient('client-123', { event: 'ping' });
}
```

### getSocket()

```typescript
getSocket(clientId: string): UwsSocket | undefined
```

Get a wrapped socket by client ID.

**Example:**

```typescript
const socket = adapter.getSocket('client-123');
if (socket) {
  socket.emit('message', { text: 'Hello!' });
}
```

### close()

```typescript
close(server: any): void
```

Close the server and all client connections.

**Example:**

```typescript
// Graceful shutdown
process.on('SIGTERM', () => {
  adapter.close(null);
  process.exit(0);
});
```

---

## Manual Gateway Registration

### Single Gateway

```typescript
const app = await NestFactory.create(AppModule);
const adapter = new UwsAdapter(app, { port: 8099 });
app.useWebSocketAdapter(adapter);

// Register gateway
const gateway = app.get(EventsGateway);
adapter.registerGateway(gateway);

await app.listen(3000);
```

### Multiple Gateways

```typescript
const app = await NestFactory.create(AppModule);
const adapter = new UwsAdapter(app, { port: 8099 });
app.useWebSocketAdapter(adapter);

// Register multiple gateways
const chatGateway = app.get(ChatGateway);
const gameGateway = app.get(GameGateway);
const notificationGateway = app.get(NotificationGateway);

adapter.registerGateway(chatGateway);
adapter.registerGateway(gameGateway);
adapter.registerGateway(notificationGateway);

await app.listen(3000);
```

**Important:** If multiple gateways register handlers for the same event, the last registered handler will be invoked. Use unique event names or namespacing to avoid conflicts:

```typescript
// Gateway1
@SubscribeMessage('chat:message')
handleChatMessage() { }

// Gateway2
@SubscribeMessage('game:message')
handleGameMessage() { }
```

---

## HTTP + WebSocket Integration

Starting from v2.0.0, you can share a single uWebSockets.js instance between HTTP and WebSocket:

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsPlatformAdapter } from 'uwestjs';
import { UwsAdapter } from 'uwestjs';
import * as uWS from 'uWebSockets.js';

// Create shared uWS instance
const uwsApp = uWS.App();

// HTTP adapter
const httpAdapter = new UwsPlatformAdapter(uwsApp);
const app = await NestFactory.create(AppModule, httpAdapter);

// WebSocket adapter (shares the same uWS instance)
const wsAdapter = new UwsAdapter(app, { uwsApp });
app.useWebSocketAdapter(wsAdapter);

// Register gateways
const gateway = app.get(EventsGateway);
wsAdapter.registerGateway(gateway);

// Start server (HTTP adapter manages the listening port)
await app.listen(3000);
```

**Benefits:**
- Single port for both HTTP and WebSocket
- Better resource utilization
- Simplified deployment

---

## Examples

### Basic Setup

```typescript
import { NestFactory } from '@nestjs/core';
import { UwsAdapter } from 'uwestjs';

const app = await NestFactory.create(AppModule);
const adapter = new UwsAdapter(app, { port: 8099 });
app.useWebSocketAdapter(adapter);

const gateway = app.get(EventsGateway);
adapter.registerGateway(gateway);

await app.listen(3000);
```

### With SSL/TLS

```typescript
const adapter = new UwsAdapter(app, {
  port: 8099,
  cert_file_name: './certs/server.crt',
  key_file_name: './certs/server.key',
  passphrase: 'your-passphrase',
});
```

### With CORS

```typescript
const adapter = new UwsAdapter(app, {
  port: 8099,
  cors: {
    origin: (origin) => origin?.endsWith('.example.com') ?? false,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});
```

### With Dependency Injection

```typescript
const moduleRef = app.get(ModuleRef);
const adapter = new UwsAdapter(app, {
  port: 8099,
  moduleRef, // Enable DI for guards/pipes/filters
});
```

### Complete Configuration

```typescript
import { NestFactory } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { UwsAdapter } from 'uwestjs';
import * as uWS from 'uWebSockets.js';

const app = await NestFactory.create(AppModule);
const moduleRef = app.get(ModuleRef);

const adapter = new UwsAdapter(app, {
  // Server configuration
  port: 8099,
  path: '/ws',
  
  // Performance tuning
  maxPayloadLength: 1024 * 1024, // 1MB
  idleTimeout: 300, // 5 minutes
  compression: uWS.SHARED_COMPRESSOR,
  
  // CORS configuration
  cors: {
    origin: (origin) => origin?.endsWith('.example.com') ?? false,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  },
  
  // Enable DI for guards/pipes/filters
  moduleRef,
});

app.useWebSocketAdapter(adapter);

// Register gateways
const gateway = app.get(EventsGateway);
adapter.registerGateway(gateway);

await app.listen(3000);
```

---

## See Also

- [Socket API](./Socket.md)
- [Broadcasting](./Broadcasting.md)
- [Decorators](./Decorators.md)
- [Rooms](./Rooms.md)
- [Middleware](./Middleware.md)
- [Lifecycle](./Lifecycle.md)
