# WebSocket Decorators

uWestJS supports all standard NestJS WebSocket decorators for building WebSocket gateways.

## Table of Contents

- [Gateway Decorators](#gateway-decorators)
- [Message Handler Decorators](#message-handler-decorators)
- [Parameter Decorators](#parameter-decorators)
- [Middleware Decorators](#middleware-decorators)
- [Examples](#examples)

---

## Gateway Decorators

### @WebSocketGateway()

Marks a class as a WebSocket gateway.

```typescript
import { WebSocketGateway } from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway {
  // Gateway methods
}
```

**Note:** Gateway options (port, namespace, etc.) are ignored by uWestJS. Configure the adapter directly instead.

**Example:**

```typescript
@WebSocketGateway()
export class EventsGateway {
  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: string) {
    return { event: 'response', data };
  }
}
```

---

## Message Handler Decorators

### @SubscribeMessage()

Marks a method as a message handler for a specific event.

```typescript
import { SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';

@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: string,
    @ConnectedSocket() client: any,
  ) {
    return { event: 'response', data: `Echo: ${data}` };
  }
}
```

**Return Values:**
- Return an object to send a response: `{ event: 'response', data: ... }`
- Return `undefined` or `void` to send no response
- Return a Promise for async handlers

**Example with async:**

```typescript
@SubscribeMessage('fetch-data')
async handleFetchData(@MessageBody() id: string) {
  const data = await this.dataService.findById(id);
  return { event: 'data', data };
}
```

**Example with no response:**

```typescript
@SubscribeMessage('log-event')
handleLogEvent(@MessageBody() event: string) {
  console.log('Event logged:', event);
  // No return = no response sent
}
```

---

## Parameter Decorators

### @MessageBody()

Extracts the message data from the incoming message.

```typescript
@SubscribeMessage('message')
handleMessage(@MessageBody() data: string) {
  console.log('Received:', data);
}
```

**With validation:**

```typescript
import { UsePipes, ValidationPipe } from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';

class MessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

@UsePipes(new ValidationPipe())
@SubscribeMessage('message')
handleMessage(@MessageBody() dto: MessageDto) {
  console.log('Valid message:', dto.content);
}
```

**Extract specific property:**

```typescript
@SubscribeMessage('update-user')
handleUpdate(@MessageBody('userId') userId: string) {
  console.log('Updating user:', userId);
}
```

### @ConnectedSocket()

Injects the connected socket instance.

```typescript
@SubscribeMessage('message')
handleMessage(
  @MessageBody() data: string,
  @ConnectedSocket() client: UwsSocket,
) {
  console.log(`Message from ${client.id}`);
  client.emit('response', { received: true });
}
```

**Accessing socket data:**

```typescript
@SubscribeMessage('secure-action')
handleSecure(@ConnectedSocket() client: UwsSocket) {
  const user = client.data.user;
  console.log(`User ${user.name} performed action`);
}
```

### @Payload()

Alias for `@MessageBody()`. Works identically.

```typescript
import { Payload } from 'uwestjs';

@SubscribeMessage('message')
handleMessage(@Payload() data: string) {
  console.log('Received:', data);
}
```

---

## Middleware Decorators

### @UseGuards()

Apply guards to protect message handlers.

```typescript
import { UseGuards } from '@nestjs/common';

@WebSocketGateway()
export class SecureGateway {
  // Method-level guard
  @UseGuards(WsAuthGuard)
  @SubscribeMessage('secure-action')
  handleSecureAction(@MessageBody() data: any) {
    return { event: 'success', data };
  }
  
  // Multiple guards (executed in order)
  @UseGuards(WsAuthGuard, WsRoleGuard)
  @SubscribeMessage('admin-action')
  handleAdminAction(@MessageBody() data: any) {
    return { event: 'admin-success', data };
  }
}

// Class-level guard (applies to all handlers)
@UseGuards(WsAuthGuard)
@WebSocketGateway()
export class ProtectedGateway {
  @SubscribeMessage('action1')
  handleAction1() { }
  
  @SubscribeMessage('action2')
  handleAction2() { }
}
```

### @UsePipes()

Apply pipes for validation and transformation.

```typescript
import { UsePipes, ValidationPipe } from '@nestjs/common';

@WebSocketGateway()
export class ChatGateway {
  // Method-level pipe
  @UsePipes(new ValidationPipe())
  @SubscribeMessage('message')
  handleMessage(@MessageBody() dto: MessageDto) {
    return { event: 'message-received', data: dto };
  }
  
  // Multiple pipes
  @UsePipes(ValidationPipe, TransformPipe)
  @SubscribeMessage('complex')
  handleComplex(@MessageBody() data: any) {
    return { event: 'processed', data };
  }
}

// Class-level pipe (applies to all handlers)
@UsePipes(new ValidationPipe({ transform: true }))
@WebSocketGateway()
export class ValidatedGateway {
  @SubscribeMessage('action1')
  handleAction1(@MessageBody() dto: Dto1) { }
  
  @SubscribeMessage('action2')
  handleAction2(@MessageBody() dto: Dto2) { }
}
```

### @UseFilters()

Apply exception filters to handle errors.

```typescript
import { UseFilters } from '@nestjs/common';

@WebSocketGateway()
export class ChatGateway {
  // Method-level filter
  @UseFilters(WsExceptionFilter)
  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: string) {
    if (!data) {
      throw new WsException('Message cannot be empty');
    }
    return { event: 'success' };
  }
  
  // Multiple filters
  @UseFilters(WsExceptionFilter, ValidationExceptionFilter)
  @SubscribeMessage('complex')
  handleComplex(@MessageBody() data: any) {
    // Handler logic
  }
}

// Class-level filter (applies to all handlers)
@UseFilters(AllExceptionsFilter)
@WebSocketGateway()
export class ProtectedGateway {
  @SubscribeMessage('action1')
  handleAction1() { }
  
  @SubscribeMessage('action2')
  handleAction2() { }
}
```

---

## Examples

### Complete Gateway Example

```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  UseGuards,
  UsePipes,
  UseFilters,
  ValidationPipe,
} from '@nestjs/common';
import { UwsSocket } from 'uwestjs';

@UseFilters(WsExceptionFilter)
@WebSocketGateway()
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  afterInit(server: any) {
    console.log('Gateway initialized');
  }
  
  handleConnection(client: UwsSocket) {
    console.log(`Client connected: ${client.id}`);
    client.join('lobby');
  }
  
  handleDisconnect(client: UwsSocket) {
    console.log(`Client disconnected: ${client.id}`);
  }
  
  @SubscribeMessage('message')
  @UsePipes(new ValidationPipe())
  handleMessage(
    @MessageBody() dto: MessageDto,
    @ConnectedSocket() client: UwsSocket,
  ) {
    client.broadcast.emit('message', {
      from: client.id,
      content: dto.content,
    });
    
    return { event: 'message-sent', data: { id: Date.now() } };
  }
  
  @SubscribeMessage('secure-action')
  @UseGuards(WsAuthGuard)
  handleSecureAction(
    @MessageBody() data: any,
    @ConnectedSocket() client: UwsSocket,
  ) {
    return { event: 'success', data };
  }
}
```

### Validation with DTOs

```typescript
import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
  
  @IsInt()
  @Min(1)
  @Max(5)
  priority: number;
}

@WebSocketGateway()
export class MessagesGateway {
  @UsePipes(new ValidationPipe({ transform: true }))
  @SubscribeMessage('create-message')
  handleCreate(@MessageBody() dto: CreateMessageDto) {
    // dto is validated and transformed
    return { event: 'message-created', data: dto };
  }
}
```

### Multiple Parameter Decorators

```typescript
@WebSocketGateway()
export class ExampleGateway {
  // Multiple @MessageBody decorators with field extraction
  // Each extracts a different property from the message data
  @SubscribeMessage('complex-handler')
  handleComplex(
    @MessageBody('userId') userId: string,
    @MessageBody('action') action: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    console.log('User ID:', userId);
    console.log('Action:', action);
    console.log('Client:', client.id);
  }
  
  // Alternative: Get full data and destructure
  @SubscribeMessage('complex-handler-alt')
  handleComplexAlt(
    @MessageBody() data: { userId: string; action: string },
    @ConnectedSocket() client: UwsSocket,
  ) {
    const { userId, action } = data;
    console.log('User ID:', userId);
    console.log('Action:', action);
    console.log('Client:', client.id);
  }
}
```

### Combining Decorators

```typescript
@UseGuards(WsAuthGuard)
@UsePipes(new ValidationPipe())
@UseFilters(WsExceptionFilter)
@WebSocketGateway()
export class SecureGateway {
  @SubscribeMessage('secure-action')
  handleSecureAction(@MessageBody() dto: ActionDto) {
    // 1. Guard checks authentication
    // 2. Pipe validates and transforms data
    // 3. Handler executes
    // 4. Filter catches any exceptions
    return { event: 'success', data: dto };
  }
  
  // Override class-level decorators for specific handler
  @UseGuards(AdminGuard) // Replaces WsAuthGuard for this handler
  @SubscribeMessage('admin-action')
  handleAdminAction(@MessageBody() data: any) {
    return { event: 'admin-success', data };
  }
}
```

### Async Handlers

```typescript
@WebSocketGateway()
export class AsyncGateway {
  constructor(private dataService: DataService) {}
  
  @SubscribeMessage('fetch-user')
  async handleFetchUser(@MessageBody('userId') userId: string) {
    const user = await this.dataService.findUser(userId);
    return { event: 'user-data', data: user };
  }
  
  @SubscribeMessage('batch-operation')
  async handleBatch(@MessageBody() ids: string[]) {
    const results = await Promise.all(
      ids.map(id => this.dataService.process(id))
    );
    return { event: 'batch-complete', data: results };
  }
}
```

### Observable Handlers

```typescript
import { Observable, interval } from 'rxjs';
import { map, take } from 'rxjs/operators';

@WebSocketGateway()
export class StreamGateway {
  @SubscribeMessage('start-stream')
  handleStream(): Observable<any> {
    return interval(1000).pipe(
      take(10),
      map(i => ({ event: 'stream-data', data: { count: i } }))
    );
  }
}
```

---

## See Also

- [Socket API](./Socket.md)
- [Middleware](./Middleware.md)
- [Exceptions](./Exceptions.md)
- [Lifecycle](./Lifecycle.md)
