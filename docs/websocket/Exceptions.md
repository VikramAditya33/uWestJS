# WebSocket Exception Handling

Exception handling in uWestJS using WsException and exception filters.

## Table of Contents

- [Overview](#overview)
- [WsException](#wsexception)
- [Using WsException](#using-wsexception)
- [Custom Exception Filters](#custom-exception-filters)
- [Error Response Patterns](#error-response-patterns)
- [Best Practices](#best-practices)

---

## Overview

uWestJS provides robust exception handling through:

- **WsException** - WebSocket-specific exception class
- **Exception Filters** - Catch and handle exceptions
- **Error Responses** - Structured error messages to clients

---

## WsException

WebSocket exception that can be caught by exception filters.

```typescript
import { WsException } from 'uwestjs';
```

### Constructor

```typescript
constructor(message: string | object, error?: string)
```

**Parameters:**
- `message` - Error message or error object
- `error` - Optional error type/code

**Examples:**

```typescript
// Simple message
throw new WsException('Invalid input');

// With error code
throw new WsException('Unauthorized', 'AUTH_ERROR');

// With object message
throw new WsException({
  field: 'email',
  message: 'Invalid email format',
}, 'VALIDATION_ERROR');
```

### Methods

#### getError()

```typescript
getError(): { message: string | object; error?: string }
```

Gets the error response object with consistent structure.

**Example:**

```typescript
try {
  throw new WsException('Something went wrong', 'ERROR_CODE');
} catch (exception) {
  const error = exception.getError();
  // { message: 'Something went wrong', error: 'ERROR_CODE' }
}
```

---

## Using WsException

### In Handlers

```typescript
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('send-message')
  handleSendMessage(
    @MessageBody() message: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    if (!client.data?.authenticated) {
      throw new WsException('Not authenticated', 'AUTH_REQUIRED');
    }
    
    if (!message || message.trim().length === 0) {
      throw new WsException('Message cannot be empty', 'INVALID_MESSAGE');
    }
    
    if (message.length > 1000) {
      throw new WsException('Message too long', 'MESSAGE_TOO_LONG');
    }
    
    // Process message
    return { event: 'message-sent', data: { id: '123' } };
  }
}
```

### In Guards

```typescript
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    
    if (!client.data?.token) {
      throw new WsException('Token required', 'TOKEN_MISSING');
    }
    
    if (!this.validateToken(client.data.token)) {
      throw new WsException('Invalid token', 'TOKEN_INVALID');
    }
    
    return true;
  }
}
```

### In Pipes

```typescript
@Injectable()
export class ValidationPipe implements PipeTransform {
  transform(value: any): any {
    if (!value) {
      throw new WsException('Value is required', 'VALIDATION_ERROR');
    }
    
    if (typeof value !== 'string') {
      throw new WsException('Value must be a string', 'TYPE_ERROR');
    }
    
    return value;
  }
}
```

---

## Custom Exception Filters

Create custom filters to handle exceptions:

```typescript
import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { WsException } from 'uwestjs';

@Catch(WsException)
export class CustomWsExceptionFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const error = exception.getError();
    
    // Send formatted error to client
    client.emit('error', {
      success: false,
      error: {
        code: error.error || 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Use the filter
@UseFilters(CustomWsExceptionFilter)
@WebSocketGateway()
export class ChatGateway {
  // Handlers
}
```

---

## Error Response Patterns

### Standard Error Response

```typescript
@Catch(WsException)
export class StandardErrorFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const error = exception.getError();
    
    client.emit('error', {
      status: 'error',
      code: error.error,
      message: error.message,
      timestamp: Date.now(),
    });
  }
}
```

### Detailed Error Response

```typescript
@Catch(WsException)
export class DetailedErrorFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const data = host.switchToWs().getData();
    const error = exception.getError();
    
    client.emit('error', {
      status: 'error',
      error: {
        code: error.error || 'UNKNOWN',
        message: error.message,
        details: typeof error.message === 'object' ? error.message : undefined,
      },
      request: {
        event: data?.event,
        timestamp: Date.now(),
      },
      client: {
        id: client.id,
      },
    });
  }
}
```

### Logging Error Filter

```typescript
@Injectable()
@Catch()
export class LoggingErrorFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const data = host.switchToWs().getData();
    
    // Log the error
    this.logger.error({
      message: exception instanceof Error ? exception.message : 'Unknown error',
      clientId: client.id,
      event: data?.event,
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    
    // Send error to client
    const message = exception instanceof WsException
      ? exception.getError().message
      : 'Internal server error';
    
    client.emit('error', {
      message,
      timestamp: Date.now(),
    });
  }
}
```

---

## Best Practices

### 1. Use Specific Error Codes

Use specific error codes for different error types:

```typescript
// Good
throw new WsException('User not found', 'USER_NOT_FOUND');
throw new WsException('Invalid credentials', 'AUTH_FAILED');
throw new WsException('Rate limit exceeded', 'RATE_LIMIT');

// Avoid
throw new WsException('Error');
```

### 2. Provide Helpful Error Messages

```typescript
// Good
throw new WsException('Message length must be between 1 and 1000 characters', 'INVALID_LENGTH');

// Avoid
throw new WsException('Invalid');
```

### 3. Use Structured Error Objects

For complex errors, use structured error objects:

```typescript
throw new WsException({
  field: 'email',
  message: 'Email format is invalid',
  example: 'user@example.com',
}, 'VALIDATION_ERROR');
```

### 4. Handle Errors at Appropriate Levels

```typescript
// Class-level filter for all handlers
@UseFilters(GlobalErrorFilter)
@WebSocketGateway()
export class Gateway {
  // Method-level filter for specific handler
  @UseFilters(SpecificErrorFilter)
  @SubscribeMessage('action')
  handleAction() { }
}
```

### 5. Log Errors for Debugging

```typescript
@Injectable()
@Catch()
export class LoggingFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    
    // Log for debugging
    this.logger.error({
      clientId: client.id,
      error: exception instanceof Error ? exception.message : 'Unknown',
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    
    // Send user-friendly message to client
    client.emit('error', {
      message: 'An error occurred',
      timestamp: Date.now(),
    });
  }
}
```

### 6. Don't Expose Sensitive Information

```typescript
// Good - Generic error message
client.emit('error', {
  message: 'Authentication failed',
  code: 'AUTH_ERROR',
});

// Avoid - Exposes internal details
client.emit('error', {
  message: 'Database connection failed: Connection refused at 192.168.1.100:5432',
  stack: error.stack,
});
```

### 7. Use Different Filters for Different Exception Types

```typescript
// Specific filter for WsException
@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    // Handle WsException
  }
}

// Specific filter for validation errors
@Catch(BadRequestException)
export class ValidationFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    // Handle validation errors
  }
}

// Catch-all filter for unexpected errors
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Handle all other errors
  }
}
```

---

## Examples

### Complete Error Handling Setup

```typescript
// Custom exception filter
@Catch(WsException)
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const error = exception.getError();
    
    client.emit('error', {
      success: false,
      error: {
        code: error.error || 'UNKNOWN_ERROR',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Gateway with error handling
@UseFilters(WsExceptionFilter)
@WebSocketGateway()
export class ChatGateway {
  @SubscribeMessage('send-message')
  handleSendMessage(
    @MessageBody() message: string,
    @ConnectedSocket() client: UwsSocket,
  ) {
    // Validation
    if (!client.data?.authenticated) {
      throw new WsException('Not authenticated', 'AUTH_REQUIRED');
    }
    
    if (!message || message.trim().length === 0) {
      throw new WsException('Message cannot be empty', 'INVALID_MESSAGE');
    }
    
    if (message.length > 1000) {
      throw new WsException('Message too long', 'MESSAGE_TOO_LONG');
    }
    
    // Process message
    return { event: 'message-sent', data: { id: '123' } };
  }
}
```

### Error Codes Enum

```typescript
export enum WsErrorCode {
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_FAILED = 'AUTH_FAILED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  RATE_LIMIT = 'RATE_LIMIT',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

// Usage
throw new WsException('Not authenticated', WsErrorCode.AUTH_REQUIRED);
```

### Validation Error Handling

```typescript
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const response = exception.getResponse();
    
    client.emit('validation-error', {
      status: 'error',
      code: 'VALIDATION_ERROR',
      errors: typeof response === 'object' ? response : { message: response },
      timestamp: Date.now(),
    });
  }
}
```

---

## See Also

- [Adapter](./Adapter.md)
- [Middleware](./Middleware.md)
- [Decorators](./Decorators.md)
- [Lifecycle](./Lifecycle.md)
