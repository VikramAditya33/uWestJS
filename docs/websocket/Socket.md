# WebSocket Socket API

The UwsSocket provides a Socket.IO-like API over native uWebSockets.js. This is the object you receive when using `@ConnectedSocket()` decorator.

## Table of Contents

- [Overview](#overview)
- [Properties](#properties)
- [Methods](#methods)
- [Examples](#examples)

---

## Overview

UwsSocket wraps the native uWebSockets.js socket and provides convenient methods for:

- Emitting events to clients
- Managing room memberships
- Broadcasting to multiple clients
- Monitoring connection health
- Storing custom data

---

## Properties

### id

```typescript
readonly id: string
```

Unique identifier for this socket connection.

**Example:**

```typescript
@SubscribeMessage('message')
handleMessage(@ConnectedSocket() client: UwsSocket) {
  console.log(`Message from client: ${client.id}`);
}
```

### data

```typescript
data: TData
```

Custom data attached to this socket. Use this to store user information, session data, authentication tokens, etc.

**Example:**

```typescript
@SubscribeMessage('authenticate')
handleAuth(
  @MessageBody() token: string,
  @ConnectedSocket() client: UwsSocket,
) {
  // Verify token and attach user data
  const user = this.authService.verify(token);
  client.data = { user, authenticated: true };
}

@SubscribeMessage('secure-action')
handleSecure(@ConnectedSocket() client: UwsSocket) {
  if (!client.data?.authenticated) {
    throw new WsException('Not authenticated');
  }
  // Access user data
  console.log(`User ${client.data.user.name} performed action`);
}
```

### broadcast

```typescript
readonly broadcast: BroadcastOperator
```

Broadcast operator for sending to multiple clients, excluding the sender.

**Example:**

```typescript
@SubscribeMessage('message')
handleMessage(
  @MessageBody() data: string,
  @ConnectedSocket() client: UwsSocket,
) {
  // Send to all clients except the sender
  client.broadcast.emit('message', data);
}
```

---

## Methods

### emit()

```typescript
emit(event: string, data?: TEmitData): void
```

Emit an event to this specific client.

**Parameters:**
- `event` - Event name
- `data` - Optional data to send

**Example:**

```typescript
@SubscribeMessage('request-data')
handleRequest(@ConnectedSocket() client: UwsSocket) {
  client.emit('response', { status: 'ok', data: [1, 2, 3] });
}

// Multiple emits
client.emit('notification', { type: 'info', message: 'Welcome' });
client.emit('heartbeat'); // No data needed
```

**Throws:**
- Error if message cannot be serialized to JSON
- Error if message is dropped due to backpressure

### disconnect()

```typescript
disconnect(): void
```

Disconnect this client. Closes the WebSocket connection.

**Example:**

```typescript
@SubscribeMessage('logout')
handleLogout(@ConnectedSocket() client: UwsSocket) {
  client.emit('logged-out', { message: 'Goodbye!' });
  client.disconnect();
}

// Disconnect idle clients
if (client.getBufferedAmount() > 1024 * 1024) {
  console.log('Client is too slow, disconnecting');
  client.disconnect();
}
```

### join()

```typescript
join(room: string | string[]): void
```

Join one or more rooms.

**Parameters:**
- `room` - Room name or array of room names

**Example:**

```typescript
// Join single room
client.join('lobby');

// Join multiple rooms
client.join(['game-1', 'chat-general']);

// Join room based on user data
@SubscribeMessage('join-game')
handleJoinGame(
  @MessageBody() gameId: string,
  @ConnectedSocket() client: UwsSocket,
) {
  client.join(`game:${gameId}`);
  client.to(`game:${gameId}`).emit('player-joined', {
    playerId: client.id,
    username: client.data.user.name,
  });
}
```

### leave()

```typescript
leave(room: string | string[]): void
```

Leave one or more rooms.

**Parameters:**
- `room` - Room name or array of room names

**Example:**

```typescript
// Leave single room
client.leave('lobby');

// Leave multiple rooms
client.leave(['game-1', 'chat-general']);

// Leave room on disconnect
@SubscribeMessage('leave-game')
handleLeaveGame(
  @MessageBody() gameId: string,
  @ConnectedSocket() client: UwsSocket,
) {
  client.leave(`game:${gameId}`);
  client.to(`game:${gameId}`).emit('player-left', {
    playerId: client.id,
  });
}
```

### to()

```typescript
to(room: string | string[]): BroadcastOperator
```

Emit to specific room(s), excluding the sender (Socket.IO-compatible behavior).

**Parameters:**
- `room` - Room name or array of room names

**Returns:** BroadcastOperator for chaining

**Example:**

```typescript
// Send to single room, excluding sender
client.to('room1').emit('message', data);

// Send to multiple rooms, excluding sender
client.to(['room1', 'room2']).emit('message', data);

// Chaining
client.to('room1').to('room2').emit('message', data);

// Game example
@SubscribeMessage('game-move')
handleMove(
  @MessageBody() move: any,
  @ConnectedSocket() client: UwsSocket,
) {
  const gameId = client.data.gameId;
  // Broadcast move to all players in the game except the sender
  client.to(`game:${gameId}`).emit('move-made', {
    playerId: client.id,
    move,
  });
}
```

### getBufferedAmount()

```typescript
getBufferedAmount(): number
```

Get the amount of buffered (backpressured) data for this socket. Returns the number of bytes waiting to be sent.

**Returns:** Number of bytes buffered

**Example:**

```typescript
const buffered = client.getBufferedAmount();
if (buffered > 1024 * 1024) {
  console.log('Client is slow, consider disconnecting');
  client.disconnect();
}

// Monitor backpressure before sending large data
if (client.getBufferedAmount() < 100000) {
  client.emit('large-data', largePayload);
} else {
  console.log('Client has backpressure, skipping large data');
}
```

---

## Examples

### Basic Message Handling

```typescript
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    console.log(`Message from ${client.id}: ${data}`);
    
    // Send response to sender
    client.emit('message-received', { id: client.id, data });
    
    // Broadcast to others
    client.broadcast.emit('new-message', { from: client.id, data });
  }
}
```

### Authentication and User Data

```typescript
@WebSocketGateway()
export class AuthGateway {
  constructor(private authService: AuthService) {}
  
  @SubscribeMessage('authenticate')
  async handleAuth(
    @MessageBody() token: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    try {
      const user = await this.authService.validateToken(token);
      
      // Store user data on socket
      client.data = {
        user,
        authenticated: true,
        connectedAt: Date.now(),
      };
      
      client.emit('authenticated', { username: user.username });
    } catch (error) {
      client.emit('auth-error', { message: 'Invalid token' });
      client.disconnect();
    }
  }
  
  @SubscribeMessage('secure-action')
  handleSecureAction(@ConnectedSocket() client: UwsSocket) {
    if (!client.data?.authenticated) {
      throw new WsException('Not authenticated');
    }
    
    // Access user data
    const user = client.data.user;
    console.log(`User ${user.username} performed secure action`);
  }
}
```

### Room Management

```typescript
@WebSocketGateway()
export class GameGateway {
  @SubscribeMessage('join-game')
  handleJoinGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const roomName = `game:${gameId}`;
    
    // Join room
    client.join(roomName);
    client.data.gameId = gameId;
    
    // Notify others in the room
    client.to(roomName).emit('player-joined', {
      playerId: client.id,
      username: client.data.user?.name,
    });
    
    // Send confirmation to sender
    client.emit('joined-game', { gameId });
  }
  
  @SubscribeMessage('leave-game')
  handleLeaveGame(@ConnectedSocket() client: UwsSocket) {
    const gameId = client.data.gameId;
    if (!gameId) return;
    
    const roomName = `game:${gameId}`;
    
    // Leave room
    client.leave(roomName);
    delete client.data.gameId;
    
    // Notify others
    client.to(roomName).emit('player-left', {
      playerId: client.id,
    });
  }
}
```

### Backpressure Monitoring

```typescript
@WebSocketGateway()
export class StreamGateway {
  @SubscribeMessage('stream-data')
  handleStreamData(
    @MessageBody() data: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Check backpressure before sending large data
    const buffered = client.getBufferedAmount();
    
    if (buffered > 1024 * 1024) {
      // Client is slow, skip this frame
      console.log(`Skipping frame for slow client ${client.id}`);
      return;
    }
    
    // Send data
    client.emit('stream-frame', data);
  }
  
  @SubscribeMessage('request-large-file')
  async handleLargeFile(@ConnectedSocket() client: UwsSocket) {
    const chunks = await this.getFileChunks();
    
    for (const chunk of chunks) {
      // Monitor backpressure between chunks
      const buffered = client.getBufferedAmount();
      
      if (buffered > 500000) {
        // Wait for buffer to drain
        await this.waitForDrain(client, 100000);
      }
      
      client.emit('file-chunk', chunk);
    }
    
    client.emit('file-complete');
  }
  
  private async waitForDrain(
    client: UwsSocket,
    threshold: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (client.getBufferedAmount() < threshold) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
}
```

### Broadcasting Patterns

```typescript
@WebSocketGateway()
export class NotificationGateway {
  @SubscribeMessage('send-notification')
  handleNotification(
    @MessageBody() notification: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Send to all except sender
    client.broadcast.emit('notification', notification);
    
    // Send to specific room except sender
    client.broadcast.to('premium-users').emit('premium-notification', notification);
    
    // Send to multiple rooms except sender
    client.broadcast
      .to(['room1', 'room2'])
      .emit('multi-room-notification', notification);
  }
}
```

### Disconnection Handling

```typescript
@WebSocketGateway()
export class ConnectionGateway implements OnGatewayDisconnect {
  handleDisconnect(client: UwsSocket) {
    console.log(`Client disconnected: ${client.id}`);
    
    // Access user data before cleanup
    const user = client.data?.user;
    const gameId = client.data?.gameId;
    
    if (gameId) {
      // Notify game room
      client.to(`game:${gameId}`).emit('player-disconnected', {
        playerId: client.id,
        username: user?.name,
      });
    }
    
    // Cleanup is automatic - client is removed from all rooms
  }
}
```

---

## See Also

- [Adapter](./Adapter.md)
- [Broadcasting](./Broadcasting.md)
- [Rooms](./Rooms.md)
- [Decorators](./Decorators.md)
- [Lifecycle](./Lifecycle.md)
