# WebSocket Lifecycle Hooks

Gateway lifecycle hooks allow you to execute code at specific points in the gateway lifecycle.

## Table of Contents

- [Overview](#overview)
- [How We Manage uWS Handlers](#how-we-manage-uws-handlers)
- [Available Hooks](#available-hooks)
- [Implementing Multiple Hooks](#implementing-multiple-hooks)
- [Lifecycle Hook Patterns](#lifecycle-hook-patterns)
- [Best Practices](#best-practices)

---

## Overview

Lifecycle hooks provide entry points for:

- Gateway initialization
- Client connection handling
- Client disconnection cleanup
- Resource management
- State synchronization

---

## How We Manage uWS Handlers

We manage uWebSockets.js low-level handlers internally so you can use clean NestJS lifecycle hooks instead.

### Internal Management

| uWS Handler | What We Do | Your Benefit |
|-------------|------------|--------------|
| `open` | Track connections, create wrapped sockets, call your `handleConnection()` | High-level connection events with Socket.IO-like API |
| `message` | Parse JSON, route to `@SubscribeMessage` handlers, handle errors | Simple decorated methods instead of raw message parsing |
| `close` | Clean up rooms, remove tracking, call your `handleDisconnect()` | Clean disconnect events with automatic cleanup |
| `dropped` | Log warnings about backpressure | Warnings when messages are dropped due to slow clients |
| `drain` | Managed internally for backpressure | Automatic backpressure handling, no user action needed |
| `ping`/`pong` | Automatic by uWS when `sendPingsAutomatically: true` | Keep-alive works automatically, no user code needed |

### What You Write vs What We Handle

Instead of low-level uWS handlers:

```javascript
// Low-level uWS (you don't write this)
app.ws('/*', {
  open: (ws) => {
    // Track connection
    // Create socket wrapper
    // Handle errors
  },
  message: (ws, message) => {
    // Parse ArrayBuffer to string
    // Parse JSON
    // Route to handler
    // Handle errors
  },
  close: (ws) => {
    // Clean up rooms
    // Remove from tracking
    // Handle errors
  }
});
```

You write clean NestJS code:

```typescript
// High-level NestJS (what you write)
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  
  handleConnection(client: UwsSocket) {
    client.emit('welcome', { message: 'Hello!' });
  }

  @SubscribeMessage('chat')
  handleChat(@MessageBody() data: any) {
    // Message already parsed and routed
  }

  handleDisconnect(client: UwsSocket) {
    // Rooms automatically cleaned up
  }
}
```

### Automatic Features

These work automatically without any code:

1. **Backpressure Management** - Configure limits, we handle buffering
   ```typescript
   const app = await NestFactory.create(AppModule);
   const adapter = new UwsAdapter(app, {
     maxBackpressure: 1024 * 1024, // 1MB buffer
     closeOnBackpressureLimit: false, // Allow buffering
   });
   app.useWebSocketAdapter(adapter);
   ```

2. **Keep-Alive (Ping/Pong)** - Automatic connection health monitoring
   ```typescript
   const app = await NestFactory.create(AppModule);
   const adapter = new UwsAdapter(app, {
     sendPingsAutomatically: true, // Auto ping/pong
     idleTimeout: 120, // Close if no pong within 120s
   });
   app.useWebSocketAdapter(adapter);
   ```

3. **Room Cleanup** - Automatic when clients disconnect
   ```typescript
   // Client joins room
   client.join('game-room');
   
   // When client disconnects, automatically removed from all rooms
   // No cleanup code needed in handleDisconnect()
   ```

---

## Available Hooks

### afterInit()

Called after the gateway is initialized and registered with the adapter.

```typescript
import { OnGatewayInit } from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway implements OnGatewayInit {
  afterInit(server: any) {
    console.log('Gateway initialized');
    // Perform initialization tasks
    // - Load initial data
    // - Set up timers
    // - Configure gateway state
  }
}
```

**Use cases:**
- Initialize gateway state
- Load configuration or data
- Set up periodic tasks
- Log gateway startup

**Example:**

```typescript
import { OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayInit } from '@nestjs/websockets';

@WebSocketGateway()
export class GameGateway implements OnGatewayInit, OnModuleDestroy {
  private games = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  
  afterInit(server: any) {
    console.log('Game gateway initialized');
    
    // Load active games from database
    this.loadActiveGames();
    
    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveGames();
    }, 60000); // Every minute
  }
  
  onModuleDestroy() {
    // Clean up interval timer to prevent resource leak
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  private async loadActiveGames() {
    const games = await this.gameService.findActive();
    games.forEach(game => {
      this.games.set(game.id, game);
    });
    console.log(`Loaded ${games.length} active games`);
  }
  
  private cleanupInactiveGames() {
    // Cleanup logic
  }
}
```

### handleConnection()

Called when a client connects to the gateway.

```typescript
import { OnGatewayConnection } from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection {
  handleConnection(client: any) {
    console.log(`Client connected: ${client.id}`);
    // Handle new connection
    // - Authenticate client
    // - Send welcome message
    // - Join default rooms
    // - Track connection
  }
}
```

**Use cases:**
- Authenticate connections
- Send welcome messages
- Auto-join default rooms
- Track active connections
- Log connection events

**Example:**

```typescript
@WebSocketGateway()
export class ChatGateway implements OnGatewayConnection {
  private connectedUsers = new Map();
  
  handleConnection(client: UwsSocket) {
    console.log(`Client connected: ${client.id}`);
    
    // Send welcome message
    client.emit('welcome', {
      message: 'Welcome to the chat!',
      serverId: 'server-1',
      timestamp: Date.now(),
    });
    
    // Auto-join lobby
    client.join('lobby');
    
    // Track connection
    this.connectedUsers.set(client.id, {
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    });
    
    // Notify others
    client.to('lobby').emit('user-connected', {
      userId: client.id,
      count: this.connectedUsers.size,
    });
  }
}
```

### handleDisconnect()

Called when a client disconnects from the gateway.

```typescript
import { OnGatewayDisconnect } from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway implements OnGatewayDisconnect {
  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
    // Handle disconnection
    // - Clean up client data
    // - Remove from rooms (automatic)
    // - Notify other clients
    // - Save session data
  }
}
```

**Use cases:**
- Clean up client-specific data
- Notify other clients
- Save session data
- Update presence status
- Log disconnection events

**Example:**

```typescript
@WebSocketGateway()
export class GameGateway implements OnGatewayDisconnect {
  handleDisconnect(client: UwsSocket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Get user data before cleanup
    const gameId = client.data?.gameId;
    const username = client.data?.user?.name;
    
    // Notify game room if user was in a game
    if (gameId) {
      client.to(`game:${gameId}`).emit('player-disconnected', {
        playerId: client.id,
        username,
      });
      
      // Handle game state
      this.handlePlayerLeave(gameId, client.id);
    }
    
    // Clean up tracking
    this.connectedUsers.delete(client.id);
    
    // Save session data
    if (client.data?.user) {
      this.saveUserSession(client.data.user.id, {
        disconnectedAt: Date.now(),
        lastGameId: gameId,
      });
    }
  }
}
```

---

## Implementing Multiple Hooks

You can implement multiple lifecycle hooks in a single gateway:

```typescript
import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private activeUsers = new Map();
  
  afterInit(server: any) {
    console.log('Chat gateway initialized');
    this.loadConfiguration();
  }
  
  handleConnection(client: UwsSocket) {
    console.log(`User connected: ${client.id}`);
    
    // Initialize user data
    this.activeUsers.set(client.id, {
      connectedAt: Date.now(),
      messageCount: 0,
    });
    
    // Send initial state
    client.emit('init', {
      userId: client.id,
      activeUsers: this.activeUsers.size,
    });
  }
  
  handleDisconnect(client: UwsSocket) {
    console.log(`User disconnected: ${client.id}`);
    
    // Cleanup
    this.activeUsers.delete(client.id);
    
    // Broadcast updated count
    client.broadcast.emit('user-count', {
      count: this.activeUsers.size,
    });
  }
  
  private loadConfiguration() {
    // Load config
  }
}
```

---

## Lifecycle Hook Patterns

### Authentication on Connection

```typescript
@WebSocketGateway()
export class SecureGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private authService: AuthService) {}
  
  async handleConnection(client: UwsSocket) {
    try {
      // Extract token from connection (implementation depends on client)
      const token = this.extractToken(client);
      
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }
      
      // Validate token
      const user = await this.authService.validateToken(token);
      
      if (!user) {
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }
      
      // Store user data
      client.data = { user, authenticated: true };
      
      // Send success
      client.emit('authenticated', { user: user.username });
      
    } catch (error) {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }
  
  handleDisconnect(client: UwsSocket) {
    if (client.data?.user) {
      console.log(`User ${client.data.user.username} disconnected`);
    }
  }
  
  private extractToken(client: UwsSocket): string | null {
    // Extract token from client (implementation specific)
    return null;
  }
}
```

### Presence Tracking

```typescript
@WebSocketGateway()
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private presence = new Map<string, { userId: string; status: string }>();
  
  handleConnection(client: UwsSocket) {
    const userId = client.data?.user?.id;
    if (!userId) return;
    
    // Update presence
    this.presence.set(client.id, {
      userId,
      status: 'online',
    });
    
    // Broadcast presence update
    client.broadcast.emit('presence-update', {
      userId,
      status: 'online',
    });
  }
  
  handleDisconnect(client: UwsSocket) {
    const presence = this.presence.get(client.id);
    if (!presence) return;
    
    // Remove presence
    this.presence.delete(client.id);
    
    // Broadcast offline status
    client.broadcast.emit('presence-update', {
      userId: presence.userId,
      status: 'offline',
    });
  }
}
```

### Session Management

```typescript
@WebSocketGateway()
export class SessionGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private sessionService: SessionService) {}
  
  async handleConnection(client: UwsSocket) {
    const userId = client.data?.user?.id;
    if (!userId) return;
    
    // Load or create session
    const session = await this.sessionService.getOrCreate(userId);
    client.data.session = session;
    
    // Send session data
    client.emit('session', session);
  }
  
  async handleDisconnect(client: UwsSocket) {
    const session = client.data?.session;
    if (!session) return;
    
    // Update session with disconnect time
    await this.sessionService.update(session.id, {
      lastDisconnect: Date.now(),
      duration: Date.now() - session.connectedAt,
    });
  }
}
```

### Resource Initialization

```typescript
import { OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayInit } from '@nestjs/websockets';

@WebSocketGateway()
export class ResourceGateway implements OnGatewayInit, OnModuleDestroy {
  private cache: Map<string, any>;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(private dataService: DataService) {}
  
  afterInit(server: any) {
    console.log('Initializing resources...');
    
    // Initialize cache
    this.cache = new Map();
    
    // Load initial data
    this.loadInitialData();
    
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 300000); // Every 5 minutes
    
    console.log('Resources initialized');
  }
  
  onModuleDestroy() {
    // Clean up interval timer to prevent resource leak
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  private async loadInitialData() {
    // Load data from database
    const data = await this.dataService.loadAll();
    data.forEach(item => {
      this.cache.set(item.id, item);
    });
  }
  
  private cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 600000) { // 10 minutes
        this.cache.delete(key);
      }
    }
  }
}
```

### Connection Tracking

```typescript
import { WebSocketGateway, SubscribeMessage, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { UwsSocket } from 'uwestjs';

@WebSocketGateway()
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private connections = new Map<string, {
    connectedAt: number;
    lastActivity: number;
    messageCount: number;
  }>();
  
  handleConnection(client: UwsSocket) {
    this.connections.set(client.id, {
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    });
    
    console.log(`Total connections: ${this.connections.size}`);
  }
  
  handleDisconnect(client: UwsSocket) {
    const connection = this.connections.get(client.id);
    if (connection) {
      const duration = Date.now() - connection.connectedAt;
      console.log(`Client ${client.id} disconnected after ${duration}ms, sent ${connection.messageCount} messages`);
      this.connections.delete(client.id);
    }
  }
  
  @SubscribeMessage('message')
  handleMessage(@ConnectedSocket() client: UwsSocket) {
    const connection = this.connections.get(client.id);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.messageCount++;
    }
  }
}
```

---

## Best Practices

### 1. Keep Hooks Lightweight

Avoid heavy operations that block the event loop:

```typescript
// Good - async operations
async handleConnection(client: UwsSocket) {
  const user = await this.userService.find(client.data.userId);
  client.data.user = user;
}

// Avoid - heavy synchronous operations
handleConnection(client: UwsSocket) {
  // Don't do heavy computation here
  this.processLargeDataset(); // Bad!
}
```

### 2. Handle Errors Gracefully

```typescript
handleConnection(client: UwsSocket) {
  try {
    // Connection logic
  } catch (error) {
    console.error('Connection error:', error);
    client.emit('error', { message: 'Connection failed' });
    client.disconnect();
  }
}
```

### 3. Clean Up Resources

Clean up resources in handleDisconnect:

```typescript
import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { UwsSocket } from 'uwestjs';

@WebSocketGateway()
export class Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  private activeClients = new Map<string, UwsSocket>();
  
  handleConnection(client: UwsSocket) {
    // Track active clients
    this.activeClients.set(client.id, client);
  }
  
  handleDisconnect(client: UwsSocket) {
    // Clear timers
    if (client.data.heartbeatTimer) {
      clearInterval(client.data.heartbeatTimer);
    }
    
    // Remove from tracking
    this.activeClients.delete(client.id);
    
    // Clean up any other resources
  }
}
```

### 4. Use Lifecycle Hooks for Initialization

Use lifecycle hooks for initialization, not constructors:

```typescript
// Good
@WebSocketGateway()
export class Gateway implements OnGatewayInit {
  afterInit(server: any) {
    this.initialize(); // Initialize here
  }
}

// Avoid
@WebSocketGateway()
export class Gateway {
  constructor() {
    this.initialize(); // Don't initialize in constructor
  }
}
```

### 5. Log Important Events

```typescript
import { WebSocketGateway, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { UwsSocket } from 'uwestjs';

// Example custom logger service - replace with your own logging implementation
// You could also use @nestjs/common Logger: import { Logger } from '@nestjs/common';
interface LoggerService {
  log(message: string): void;
}

@WebSocketGateway()
export class LoggingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private logger: LoggerService) {} // Inject your custom logger service
  
  afterInit(server: any) {
    this.logger.log('Gateway initialized');
  }
  
  handleConnection(client: UwsSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }
  
  handleDisconnect(client: UwsSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
```

### 6. Validate Client Data

```typescript
handleConnection(client: UwsSocket) {
  // Validate client has required data
  if (!client.data?.user) {
    client.emit('error', { message: 'User data required' });
    client.disconnect();
    return;
  }
  
  // Continue with connection logic
}
```

### 7. Use Async/Await for Async Operations

```typescript
async handleConnection(client: UwsSocket) {
  try {
    // Async operations
    const user = await this.userService.find(client.data.userId);
    const session = await this.sessionService.create(user.id);
    
    client.data = { user, session };
    client.emit('connected', { user, session });
  } catch (error) {
    client.emit('error', { message: 'Connection failed' });
    client.disconnect();
  }
}
```

---

## See Also

- [Adapter](./Adapter.md)
- [Socket API](./Socket.md)
- [Decorators](./Decorators.md)
- [Middleware](./Middleware.md)
- [Exceptions](./Exceptions.md)
