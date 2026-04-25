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
// Send to sender
client.emit('message', data);

// Send to room (excluding sender)
client.to('room1').emit('message', data);

// Or use broadcast
client.broadcast.to('room1').emit('message', data);
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
      username: client.data.user.name,
      message,
      timestamp: Date.now(),
    });
    
    client.to(channel).emit('message', {
      userId: client.id,
      username: client.data.user.name,
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
      username: client.data.user.name,
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
@WebSocketGateway()
export class NotificationGateway {
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
    const socket = this.getAnySocket();
    if (!socket) return;
    
    // Broadcast to all subscribers of this topic
    socket.broadcast
      .to(`notifications:${topic}`)
      .emit('notification', { topic, ...notification });
  }
  
  // Send to specific users
  sendToUsers(userIds: string[], notification: any) {
    userIds.forEach(userId => {
      const socket = this.getSocketByUserId(userId);
      if (socket) {
        socket.emit('notification', notification);
      }
    });
  }
}
```

### Admin Broadcasting

```typescript
@WebSocketGateway()
export class AdminGateway {
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
    
    // Confirm to admin
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
@WebSocketGateway()
export class SelectiveGateway {
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
    
    // Send to each friend individually
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
@WebSocketGateway()
export class PresenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  handleConnection(client: UwsSocket) {
    const userId = client.data?.user?.id;
    if (!userId) return;
    
    // Broadcast online status
    client.broadcast.emit('user-online', {
      userId,
      username: client.data.user.name,
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
    // Broadcast status change to friends
    const friendIds = client.data.friendIds || [];
    
    client.broadcast
      .except(friendIds.filter(id => id !== client.id))
      .emit('friend-status-changed', {
        userId: client.data.user.id,
        status,
      });
  }
}
```

### Rate-Limited Broadcasting

```typescript
@WebSocketGateway()
export class RateLimitedGateway {
  private lastBroadcast = new Map<string, number>();
  private readonly BROADCAST_COOLDOWN = 1000; // 1 second
  
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
```

---

## See Also

- [Socket API](./Socket.md)
- [Rooms](./Rooms.md)
- [Adapter](./Adapter.md)
- [Decorators](./Decorators.md)
