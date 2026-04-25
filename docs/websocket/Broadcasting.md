# WebSocket Broadcasting

Broadcasting allows you to send messages to multiple clients simultaneously with room targeting and client exclusion.

## Table of Contents

- [Overview](#overview)
- [BroadcastOperator](#broadcastoperator)
- [Broadcasting Patterns](#broadcasting-patterns)
- [Examples](#examples)

---

## Overview

uWestJS provides flexible broadcasting capabilities:

- Broadcast to all clients
- Broadcast to specific rooms
- Broadcast with client exclusions
- Method chaining for complex targeting

### client.to() vs client.broadcast.to()

Both `client.to()` and `client.broadcast.to()` behave identically - they both **exclude the sender** from receiving the message:

```typescript
// These are equivalent - both exclude the sender
client.to('room1').emit('message', data);
client.broadcast.to('room1').emit('message', data);
```

**Key points:**
- `client.to('room')` - Sends to room, **excluding sender**
- `client.broadcast.to('room')` - Sends to room, **excluding sender** (same behavior)
- `client.emit('event', data)` - Sends **only to sender**
- `client.broadcast.emit('event', data)` - Sends to **all clients except sender**

Use whichever syntax you prefer - they produce the same result. The `client.to()` shorthand is more concise for room-based broadcasting.

---

## BroadcastOperator

The BroadcastOperator provides methods for sending messages to multiple clients with room targeting and client exclusion.

### Methods

#### to()

```typescript
to(room: string | string[]): BroadcastOperator
```

Target specific room(s) for broadcasting. Can be chained multiple times to target multiple rooms.

**Parameters:**
- `room` - Room name or array of room names

**Returns:** New BroadcastOperator for chaining

**Example:**

```typescript
// Target single room
client.broadcast.to('room1').emit('message', data);

// Target multiple rooms
client.broadcast.to(['room1', 'room2']).emit('message', data);

// Chaining multiple to() calls
client.broadcast.to('room1').to('room2').emit('message', data);

// Empty array = broadcast to zero rooms (no clients)
client.broadcast.to([]).emit('message', data);
```

#### except()

```typescript
except(clientId: string | string[]): BroadcastOperator
```

Exclude specific client(s) from broadcast. Multiple `except()` calls will accumulate excluded clients.

**Parameters:**
- `clientId` - Client ID or array of client IDs to exclude

**Returns:** New BroadcastOperator for chaining

**Example:**

```typescript
// Exclude single client
client.broadcast.except('client-1').emit('message', data);

// Exclude multiple clients
client.broadcast.except(['client-1', 'client-2']).emit('message', data);

// Chaining with to()
client.broadcast
  .to('room1')
  .except('client-1')
  .emit('message', data);

// Multiple except() calls accumulate
client.broadcast
  .except('client-1')
  .except('client-2')
  .emit('message', data); // Both excluded

// Empty array = exclude nobody
client.broadcast.except([]).emit('message', data);
```

#### emit()

```typescript
emit(event: string, data?: TEmitData): void
```

Emit event to all targeted clients.

**Parameters:**
- `event` - Event name
- `data` - Optional data to send

**Example:**

```typescript
// Broadcast to all clients
client.broadcast.emit('announcement', { message: 'Server restart in 5 min' });

// Broadcast to specific room
client.broadcast.to('game-1').emit('game-update', { status: 'started' });

// Broadcast to room, excluding specific clients
client.broadcast
  .to('chat')
  .except(['client-1', 'client-2'])
  .emit('message', { text: 'Hello!' });

// Complex targeting
client.broadcast
  .to(['room1', 'room2'])
  .except('client-1')
  .emit('notification', { type: 'info' });
```

---

## Broadcasting Patterns

### Broadcast to Everyone

Send to all connected clients:

```typescript
// Send to all except sender
client.broadcast.emit('server-message', { text: 'Hello everyone!' });
```

### Broadcast to Room

Send to all clients in a room:

```typescript
// Send to all in room except sender
client.broadcast.to('lobby').emit('player-count', { count: 10 });
```

### Broadcast to Multiple Rooms

Send to clients in multiple rooms:

```typescript
// Send to clients in multiple rooms except sender
client.broadcast
  .to(['premium-users', 'beta-testers'])
  .emit('feature-announcement', { feature: 'New Dashboard' });
```

### Broadcast with Exclusions

Send to room but exclude specific clients:

```typescript
// Send to room but exclude specific clients
client.broadcast
  .to('game-room')
  .except(['spectator-1', 'spectator-2'])
  .emit('game-state', gameData);
```

### Broadcast Including Sender

To include the sender, emit to both the sender and broadcast:

```typescript
// Send to sender only
client.emit('message', data);

// Send to room (excluding sender) - both methods are equivalent
client.to('room1').emit('message', data);
client.broadcast.to('room1').emit('message', data); // Same behavior as above

// Note: client.to() and client.broadcast.to() are identical
// Both exclude the sender from receiving the message
```

---

## Examples

### Chat Application

```typescript
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('send-message')
  handleMessage(
    @MessageBody() message: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const channel = client.data.currentChannel;
    
    // Broadcast to channel (including sender)
    client.emit('message', {
      userId: client.id,
      username: client.data?.user?.name,
      message,
      timestamp: Date.now(),
    });
    
    client.to(channel).emit('message', {
      userId: client.id,
      username: client.data?.user?.name,
      message,
      timestamp: Date.now(),
    });
  }
  
  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: UwsSocket) {
    const channel = client.data.currentChannel;
    
    // Broadcast typing indicator to channel (excluding sender)
    client.broadcast.to(channel).emit('user-typing', {
      userId: client.id,
      username: client.data?.user?.name,
    });
  }
}
```

### Game Broadcasting

```typescript
@WebSocketGateway()
export class GameGateway {
  @SubscribeMessage('game-action')
  handleGameAction(
    @MessageBody() action: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const gameId = client.data.gameId;
    const roomName = `game:${gameId}`;
    
    // Broadcast action to all players in the game
    client.to(roomName).emit('game-update', {
      playerId: client.id,
      action,
      timestamp: Date.now(),
    });
  }
  
  @SubscribeMessage('game-state-request')
  handleStateRequest(@ConnectedSocket() client: UwsSocket) {
    const gameId = client.data.gameId;
    const roomName = `game:${gameId}`;
    
    // Send state to requester
    const state = this.getGameState(gameId);
    client.emit('game-state', state);
    
    // Notify others that state was requested
    client.broadcast.to(roomName).emit('state-requested', {
      playerId: client.id,
    });
  }
}
```

### Notification System

```typescript
import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { UwsSocket } from 'uwestjs';

@WebSocketGateway()
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  // Track connected clients
  private clients = new Set<UwsSocket>();
  
  handleConnection(client: UwsSocket) {
    this.clients.add(client);
  }
  
  handleDisconnect(client: UwsSocket) {
    this.clients.delete(client);
  }
  
  @SubscribeMessage('subscribe-notifications')
  handleSubscribe(
    @MessageBody() topics: string[],
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Subscribe to multiple notification topics
    topics.forEach(topic => {
      client.join(`notifications:${topic}`);
    });
    
    return { event: 'subscribed', topics };
  }
  
  // Called from a service to send notifications
  sendNotification(topic: string, notification: any) {
    // Get any connected socket to use broadcast
    const socket = this.clients.values().next().value;
    if (!socket) return;
    
    // Broadcast to all subscribers of this topic
    socket.broadcast
      .to(`notifications:${topic}`)
      .emit('notification', { topic, ...notification });
  }
  
  // Send to specific users (requires tracking user-to-socket mapping)
  sendToUser(userId: string, notification: any) {
    // Find socket by user ID (assumes you store userId on socket during auth)
    for (const socket of this.clients) {
      if (socket.data?.userId === userId) {
        socket.emit('notification', notification);
        break;
      }
    }
  }
}
```

Note: This example tracks connected clients using a Set. In production, consider using a more robust solution like Redis for multi-server deployments.

### Admin Broadcasting

```typescript
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { UwsSocket, UwsAdapter } from 'uwestjs';

@WebSocketGateway()
export class AdminGateway {
  // NestJS automatically injects the adapter instance via @WebSocketServer() decorator
  // This provides access to adapter methods:
  // - getClientCount(): number - Get total connected clients
  // - getSocket(id: string): UwsSocket | undefined - Get socket by ID
  // - getClientIds(): string[] - Get all client IDs
  // - hasClient(id: string): boolean - Check if client is connected
  // - broadcast(data: unknown): void - Broadcast to all clients
  // - sendToClient(id: string, data: unknown): boolean - Send to specific client
  @WebSocketServer()
  private adapter: UwsAdapter;
  
  @SubscribeMessage('admin-broadcast')
  @UseGuards(AdminGuard)
  handleAdminBroadcast(
    @MessageBody() announcement: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Broadcast to all users
    client.broadcast.emit('admin-announcement', {
      message: announcement.message,
      priority: announcement.priority,
      timestamp: Date.now(),
    });
    
    // Confirm to admin (using adapter to get client count)
    client.emit('broadcast-sent', {
      recipients: this.adapter.getClientCount() - 1,
    });
  }
  
  @SubscribeMessage('admin-room-broadcast')
  @UseGuards(AdminGuard)
  handleRoomBroadcast(
    @MessageBody() data: { rooms: string[]; message: any },
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Broadcast to specific rooms
    client.broadcast
      .to(data.rooms)
      .emit('room-announcement', {
        message: data.message,
        timestamp: Date.now(),
      });
  }
}
```

### Selective Broadcasting

```typescript
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { UwsSocket, UwsAdapter } from 'uwestjs';

@WebSocketGateway()
export class SelectiveGateway {
  // NestJS automatically injects the adapter via @WebSocketServer()
  // Use adapter.getSocket(id) to retrieve a specific socket by client ID
  @WebSocketServer()
  private adapter: UwsAdapter;
  
  @SubscribeMessage('send-to-premium')
  handlePremiumMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Send only to premium users
    client.broadcast
      .to('premium-users')
      .emit('premium-message', message);
  }
  
  @SubscribeMessage('send-to-all-except-muted')
  handleMessageExceptMuted(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const mutedUsers = client.data.mutedUsers || [];
    
    // Broadcast excluding muted users
    client.broadcast
      .except(mutedUsers)
      .emit('message', message);
  }
  
  @SubscribeMessage('send-to-friends')
  handleFriendsMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const friendIds = client.data.friendIds || [];
    
    // Send to each friend individually (using adapter.getSocket())
    // Note: For large friend lists, consider using room-based broadcasting for better performance
    friendIds.forEach(friendId => {
      const friendSocket = this.adapter.getSocket(friendId);
      if (friendSocket) {
        friendSocket.emit('friend-message', {
          from: client.id,
          message,
        });
      }
    });
  }
}
```

### Presence Broadcasting

```typescript
import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { UwsSocket, UwsAdapter } from 'uwestjs';

@WebSocketGateway()
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private adapter: UwsAdapter;
  
  handleConnection(client: UwsSocket) {
    const userId = client.data?.user?.id;
    if (!userId) return;
    
    // Broadcast online status
    client.broadcast.emit('user-online', {
      userId,
      username: client.data?.user?.name,
      timestamp: Date.now(),
    });
  }
  
  handleDisconnect(client: UwsSocket) {
    const userId = client.data?.user?.id;
    if (!userId) return;
    
    // Broadcast offline status
    client.broadcast.emit('user-offline', {
      userId,
      timestamp: Date.now(),
    });
  }
  
  @SubscribeMessage('update-status')
  handleStatusUpdate(
    @MessageBody() status: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Broadcast status change to friends only
    const friendIds = client.data.friendIds || [];
    
    // Send to each friend individually
    friendIds.forEach(friendId => {
      const friendSocket = this.adapter.getSocket(friendId);
      if (friendSocket) {
        friendSocket.emit('friend-status-changed', {
          userId: client.data.user.id,
          status,
        });
      }
    });
  }
}
```

### Rate-Limited Broadcasting

```typescript
import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { UwsSocket } from 'uwestjs';

@WebSocketGateway()
export class RateLimitedGateway implements OnGatewayDisconnect, OnModuleDestroy {
  private lastBroadcast = new Map<string, number>();
  private readonly BROADCAST_COOLDOWN = 1000; // 1 second
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor() {
    // Clean up old entries periodically to prevent memory leak
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute
  }
  
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
  
  handleDisconnect(client: UwsSocket) {
    // Clean up client's rate limit data when they disconnect
    this.lastBroadcast.delete(client.id);
  }
  
  private cleanup() {
    const now = Date.now();
    // Remove entries older than 5 minutes (inactive clients)
    for (const [clientId, timestamp] of this.lastBroadcast.entries()) {
      if (now - timestamp > 300000) {
        this.lastBroadcast.delete(clientId);
      }
    }
  }
  
  @SubscribeMessage('broadcast-message')
  handleBroadcast(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const now = Date.now();
    const lastTime = this.lastBroadcast.get(client.id) || 0;
    
    if (now - lastTime < this.BROADCAST_COOLDOWN) {
      client.emit('rate-limited', {
        message: 'Please wait before broadcasting again',
        retryAfter: this.BROADCAST_COOLDOWN - (now - lastTime),
      });
      return;
    }
    
    // Update last broadcast time
    this.lastBroadcast.set(client.id, now);
    
    // Broadcast message
    client.broadcast.emit('message', {
      from: client.id,
      message,
      timestamp: now,
    });
  }
}

// Note: For production use, consider using @nestjs/throttler package which provides
// built-in rate limiting with Redis support for distributed systems.
```

---

## See Also

- [Socket API](./Socket.md)
- [Rooms](./Rooms.md)
- [Adapter](./Adapter.md)
- [Decorators](./Decorators.md)
