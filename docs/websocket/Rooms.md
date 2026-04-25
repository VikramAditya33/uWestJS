# WebSocket Rooms

Rooms allow you to organize clients into groups for targeted broadcasting.

## Table of Contents

- [Overview](#overview)
- [Room Operations](#room-operations)
- [Room Patterns](#room-patterns)
- [Room Naming Conventions](#room-naming-conventions)
- [Examples](#examples)

---

## Overview

Rooms provide a way to:

- Group clients by feature, game, channel, or any logical grouping
- Broadcast messages to specific groups
- Manage client memberships dynamically
- Implement complex communication patterns

**Key Features:**
- Clients can join multiple rooms simultaneously
- Clients are automatically removed from all rooms on disconnect
- Room operations are efficient and scalable
- Supports dynamic room creation and deletion

---

## Room Operations

### Joining Rooms

```typescript
// Join single room
client.join('lobby');

// Join multiple rooms at once
client.join(['game-1', 'chat-general', 'notifications']);

// Join room based on user data
@SubscribeMessage('join-game')
handleJoinGame(
  @MessageBody() gameId: string,
  @ConnectedSocket() client: UwsSocket,
) {
  const roomName = `game:${gameId}`;
  client.join(roomName);
  
  // Notify others in the room
  client.to(roomName).emit('player-joined', {
    playerId: client.id,
    username: client.data.user.name,
  });
  
  return { event: 'joined', room: roomName };
}
```

### Leaving Rooms

```typescript
// Leave single room
client.leave('lobby');

// Leave multiple rooms at once
client.leave(['game-1', 'chat-general']);

// Leave room on disconnect
@SubscribeMessage('leave-game')
handleLeaveGame(
  @MessageBody() gameId: string,
  @ConnectedSocket() client: UwsSocket,
) {
  const roomName = `game:${gameId}`;
  client.leave(roomName);
  
  // Notify others
  client.to(roomName).emit('player-left', {
    playerId: client.id,
  });
}
```

**Note:** Clients are automatically removed from all rooms when they disconnect.

### Broadcasting to Rooms

```typescript
// Broadcast to single room (excluding sender)
client.to('room1').emit('message', data);

// Broadcast to multiple rooms (excluding sender)
client.to(['room1', 'room2']).emit('message', data);

// Broadcast to room including sender
client.emit('message', data); // Send to self
client.to('room1').emit('message', data); // Send to room

// Or use broadcast to exclude sender
client.broadcast.to('room1').emit('message', data);
```

---

## Room Patterns

### Lobby Pattern

```typescript
@WebSocketGateway()
export class LobbyGateway {
  @SubscribeMessage('join-lobby')
  handleJoinLobby(@ConnectedSocket() client: UwsSocket) {
    client.join('lobby');
    
    // Announce to lobby
    client.to('lobby').emit('user-joined', {
      userId: client.id,
      username: client.data.user.name,
    });
    
    // Send lobby state to new user
    const lobbyUsers = this.getLobbyUsers();
    client.emit('lobby-state', { users: lobbyUsers });
  }
  
  @SubscribeMessage('leave-lobby')
  handleLeaveLobby(@ConnectedSocket() client: UwsSocket) {
    client.leave('lobby');
    client.to('lobby').emit('user-left', {
      userId: client.id,
    });
  }
}
```

### Game Room Pattern

```typescript
@WebSocketGateway()
export class GameGateway {
  @SubscribeMessage('create-game')
  handleCreateGame(
    @MessageBody() settings: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const gameId = this.generateGameId();
    const roomName = `game:${gameId}`;
    
    client.join(roomName);
    client.data.gameId = gameId;
    
    return { event: 'game-created', gameId };
  }
  
  @SubscribeMessage('join-game')
  handleJoinGame(
    @MessageBody() gameId: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const roomName = `game:${gameId}`;
    client.join(roomName);
    client.data.gameId = gameId;
    
    // Notify all players
    client.to(roomName).emit('player-joined', {
      playerId: client.id,
      username: client.data.user.name,
    });
  }
  
  @SubscribeMessage('game-action')
  handleGameAction(
    @MessageBody() action: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const gameId = client.data.gameId;
    if (!gameId) {
      throw new WsException('Not in a game');
    }
    
    // Broadcast action to all players in the game
    client.to(`game:${gameId}`).emit('game-update', {
      playerId: client.id,
      action,
    });
  }
}
```

### Chat Room Pattern

```typescript
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('join-channel')
  handleJoinChannel(
    @MessageBody() channel: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Leave previous channel if any
    if (client.data.currentChannel) {
      client.leave(client.data.currentChannel);
    }
    
    // Join new channel
    client.join(channel);
    client.data.currentChannel = channel;
    
    // Announce to channel
    client.to(channel).emit('user-joined-channel', {
      userId: client.id,
      username: client.data.user.name,
      channel,
    });
  }
  
  @SubscribeMessage('send-message')
  handleSendMessage(
    @MessageBody() message: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const channel = client.data.currentChannel;
    if (!channel) {
      throw new WsException('Not in a channel');
    }
    
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
}
```

### Notification Room Pattern

```typescript
@WebSocketGateway()
export class NotificationGateway implements OnGatewayInit {
  private adapter: UwsAdapter;
  
  afterInit(server: UwsAdapter) {
    this.adapter = server;
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
  
  @SubscribeMessage('unsubscribe-notifications')
  handleUnsubscribe(
    @MessageBody() topics: string[],
    @ConnectedSocket() client: UwsSocket,
  ) {
    topics.forEach(topic => {
      client.leave(`notifications:${topic}`);
    });
    
    return { event: 'unsubscribed', topics };
  }
  
  // Called from a service to send notifications
  sendNotification(topic: string, notification: any) {
    // Get any connected socket to use broadcast
    const clientIds = this.adapter.getClientIds();
    if (clientIds.length === 0) return;
    
    const socket = this.adapter.getSocket(clientIds[0]);
    if (!socket) return;
    
    // Broadcast to all subscribers of this topic
    socket.broadcast
      .to(`notifications:${topic}`)
      .emit('notification', { topic, ...notification });
  }
}
```

### Private Room Pattern

```typescript
@WebSocketGateway()
export class PrivateRoomGateway {
  @SubscribeMessage('create-private-room')
  handleCreatePrivateRoom(
    @MessageBody() participants: string[],
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Generate unique room ID
    const roomId = this.generateRoomId();
    const roomName = `private:${roomId}`;
    
    // Add creator to room
    client.join(roomName);
    
    // Invite participants
    participants.forEach(participantId => {
      const socket = this.adapter.getSocket(participantId);
      if (socket) {
        socket.emit('room-invitation', {
          roomId,
          from: client.id,
        });
      }
    });
    
    return { event: 'room-created', roomId };
  }
  
  @SubscribeMessage('accept-invitation')
  handleAcceptInvitation(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const roomName = `private:${roomId}`;
    client.join(roomName);
    
    // Notify room members
    client.to(roomName).emit('member-joined', {
      userId: client.id,
      username: client.data.user.name,
    });
  }
}
```

### Hierarchical Room Pattern

```typescript
@WebSocketGateway()
export class HierarchicalGateway {
  @SubscribeMessage('join-organization')
  handleJoinOrganization(
    @MessageBody() data: { orgId: string; deptId: string; teamId: string },
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Join all levels of hierarchy
    client.join([
      `org:${data.orgId}`,
      `org:${data.orgId}:dept:${data.deptId}`,
      `org:${data.orgId}:dept:${data.deptId}:team:${data.teamId}`,
    ]);
    
    client.data.organization = data;
  }
  
  @SubscribeMessage('broadcast-to-org')
  handleOrgBroadcast(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const orgId = client.data.organization?.orgId;
    client.to(`org:${orgId}`).emit('org-message', message);
  }
  
  @SubscribeMessage('broadcast-to-dept')
  handleDeptBroadcast(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const { orgId, deptId } = client.data.organization;
    client.to(`org:${orgId}:dept:${deptId}`).emit('dept-message', message);
  }
  
  @SubscribeMessage('broadcast-to-team')
  handleTeamBroadcast(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const { orgId, deptId, teamId } = client.data.organization;
    client.to(`org:${orgId}:dept:${deptId}:team:${teamId}`)
      .emit('team-message', message);
  }
}
```

---

## Room Naming Conventions

Use consistent naming patterns for better organization:

```typescript
// Prefix-based naming
`game:${gameId}`        // game:abc123
`chat:${channelId}`     // chat:general
`user:${userId}`        // user:12345
`notifications:${type}` // notifications:orders

// Hierarchical naming
`company:${companyId}:department:${deptId}` // company:1:department:5

// Feature-based naming
`live-feed:${feedId}`
`auction:${auctionId}`
`collaboration:${docId}`

// Status-based naming
`online-users`
`premium-users`
`beta-testers`

// Geographic naming
`region:${region}`      // region:us-east
`country:${country}`    // country:usa
`city:${city}`          // city:new-york
```

---

## Examples

### Multi-Room Membership

```typescript
@WebSocketGateway()
export class MultiRoomGateway {
  @SubscribeMessage('join-multiple')
  handleJoinMultiple(@ConnectedSocket() client: UwsSocket) {
    // User can be in multiple rooms simultaneously
    client.join([
      'lobby',
      'notifications',
      `user:${client.data.user.id}`,
      `region:${client.data.user.region}`,
    ]);
  }
  
  @SubscribeMessage('send-to-region')
  handleRegionMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const region = client.data.user.region;
    client.to(`region:${region}`).emit('region-message', message);
  }
}
```

### Dynamic Room Management

```typescript
@WebSocketGateway()
export class DynamicRoomGateway {
  private rooms = new Map<string, Set<string>>();
  
  @SubscribeMessage('create-room')
  handleCreateRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    
    client.join(roomName);
    this.rooms.get(roomName)!.add(client.id);
    
    return { event: 'room-created', roomName };
  }
  
  @SubscribeMessage('delete-room')
  handleDeleteRoom(
    @MessageBody() roomName: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    const members = this.rooms.get(roomName);
    if (!members) return;
    
    // Remove all members from room
    members.forEach(memberId => {
      const socket = this.adapter.getSocket(memberId);
      if (socket) {
        socket.leave(roomName);
        socket.emit('room-deleted', { roomName });
      }
    });
    
    this.rooms.delete(roomName);
  }
}
```

### Room-Based Permissions

```typescript
@WebSocketGateway()
export class PermissionGateway {
  @SubscribeMessage('join-premium-room')
  @UseGuards(PremiumGuard)
  handleJoinPremium(@ConnectedSocket() client: UwsSocket) {
    client.join('premium-users');
    client.emit('premium-access-granted');
  }
  
  @SubscribeMessage('send-premium-message')
  handlePremiumMessage(
    @MessageBody() message: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Only send to premium users
    client.to('premium-users').emit('premium-message', message);
  }
}
```

---

## See Also

- [Socket API](./Socket.md)
- [Broadcasting](./Broadcasting.md)
- [Adapter](./Adapter.md)
- [Decorators](./Decorators.md)
