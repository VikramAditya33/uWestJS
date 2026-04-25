# HTTP Middleware

Complete guide to HTTP middleware in uWestJS including Guards, Pipes and Filters.

## Table of Contents

- [Overview](#overview)
- [Guards](#guards)
- [Pipes](#pipes)
- [Filters](#filters)
- [Execution Order](#execution-order)
- [Examples](#examples)

---

## Overview

uWestJS supports NestJS middleware for HTTP requests:

- **Guards** - Determine whether a request should be handled
- **Pipes** - Transform and validate input data
- **Filters** - Handle exceptions and errors

---

## Guards

Guards determine whether a request should be processed by the route handler.

### Creating a Guard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }
  
  private validateRequest(request: any): boolean {
    // Check authentication
    return !!request.headers.authorization;
  }
}
```

### Using Guards

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';

@Controller('api')
export class ApiController {
  // Method-level guard
  @Get('protected')
  @UseGuards(AuthGuard)
  getProtected() {
    return { data: 'protected' };
  }
  
  // Multiple guards (executed in order)
  @Get('admin')
  @UseGuards(AuthGuard, AdminGuard)
  getAdmin() {
    return { data: 'admin' };
  }
}

// Class-level guard (applies to all routes)
@Controller('api')
@UseGuards(AuthGuard)
export class ProtectedController {
  @Get('data')
  getData() { }
  
  @Get('info')
  getInfo() { }
}
```

### Async Guards

```typescript
@Injectable()
export class AsyncAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) return false;
    
    try {
      const user = await this.authService.validateToken(token);
      request.user = user;
      return true;
    } catch {
      return false;
    }
  }
}
```

### Guard Examples

```typescript
import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Role-based guard
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    return roles.some(role => user?.roles?.includes(role));
  }
}

// API key guard
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    
    return this.validateApiKey(apiKey);
  }
  
  private validateApiKey(key: string): boolean {
    return key === process.env.API_KEY;
  }
}

// Rate limiting guard (simplified example for single-instance deployments)
// IMPORTANT: This uses in-memory storage and won't work across multiple server instances
// For production with multiple instances, use @nestjs/throttler with Redis
@Injectable()
export class RateLimitGuard implements CanActivate {
  private requests = new Map<string, number[]>();
  private readonly limit = 100;
  private readonly window = 60000; // 1 minute
  
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    const now = Date.now();
    
    const requests = this.requests.get(ip) || [];
    const recentRequests = requests.filter(time => now - time < this.window);
    
    if (recentRequests.length >= this.limit) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    
    recentRequests.push(now);
    this.requests.set(ip, recentRequests);
    
    // Note: For production, implement periodic cleanup to prevent memory leaks
    // Consider using @nestjs/throttler or a background job to clean stale entries
    
    return true;
  }
}

// For production with multiple server instances, use @nestjs/throttler:
// npm install @nestjs/throttler
//
// import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
//
// @Module({
//   imports: [
//     ThrottlerModule.forRoot({
//       ttl: 60,
//       limit: 100,
//       storage: new ThrottlerStorageRedisService(redisClient), // Distributed storage
//     }),
//   ],
// })
// export class AppModule {}
```

---

## Pipes

Pipes transform and validate incoming data.

### Creating a Pipe

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const val = parseInt(value, 10);
    if (isNaN(val)) {
      throw new BadRequestException('Value must be a number');
    }
    return val;
  }
}
```

### Using Pipes

```typescript
import { Controller, Get, Post, Param, Query, Body, UsePipes } from '@nestjs/common';

@Controller('api')
export class ApiController {
  // Parameter-level pipe
  @Get('user/:id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return { user: { id } };
  }
  
  // Query parameter pipe
  @Get('users')
  getUsers(
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ) {
    return { users: [], page, limit };
  }
  
  // Body pipe
  @Post('user')
  @UsePipes(ValidationPipe)
  createUser(@Body() data: CreateUserDto) {
    return { created: true, data };
  }
}

// Class-level pipe (applies to all routes)
@Controller('api')
@UsePipes(new ValidationPipe({ transform: true }))
export class ValidatedController {
  @Post('data')
  create(@Body() data: any) { }
}
```

### Built-in Pipes

```typescript
import {
  ValidationPipe,
  ParseIntPipe,
  ParseBoolPipe,
  ParseArrayPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get('example')
  example(
    @Query('id', ParseIntPipe) id: number,
    @Query('active', ParseBoolPipe) active: boolean,
    @Query('tags', ParseArrayPipe) tags: string[],
    @Query('uuid', ParseUUIDPipe) uuid: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    return { id, active, tags, uuid, page };
  }
}
```

### Validation Pipe

```typescript
import { IsString, IsInt, IsEmail, Min, Max } from 'class-validator';

class CreateUserDto {
  @IsString()
  name: string;
  
  @IsEmail()
  email: string;
  
  @IsInt()
  @Min(18)
  @Max(100)
  age: number;
}

@Controller('users')
export class UsersController {
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  create(@Body() createUserDto: CreateUserDto) {
    return { created: true, user: createUserDto };
  }
}
```

### Async Pipes

```typescript
@Injectable()
export class AsyncValidationPipe implements PipeTransform {
  constructor(private validationService: ValidationService) {}
  
  async transform(value: any): Promise<any> {
    const isValid = await this.validationService.validate(value);
    if (!isValid) {
      throw new BadRequestException('Validation failed');
    }
    return value;
  }
}
```

---

## Filters

Exception filters handle errors and exceptions.

### Creating a Filter

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message,
    });
  }
}
```

### Using Filters

```typescript
import { Controller, Get, UseFilters } from '@nestjs/common';

@Controller('api')
export class ApiController {
  // Method-level filter
  @Get('error')
  @UseFilters(HttpExceptionFilter)
  throwError() {
    throw new HttpException('Something went wrong', 500);
  }
  
  // Multiple filters
  @Get('complex')
  @UseFilters(HttpExceptionFilter, ValidationExceptionFilter)
  complexOperation() { }
}

// Class-level filter (applies to all routes)
@Controller('api')
@UseFilters(HttpExceptionFilter)
export class ProtectedController {
  @Get('data')
  getData() { }
}
```

### Catch All Exceptions

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
    
    const message = exception instanceof Error
      ? exception.message
      : 'Internal server error';
    
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

### Filter Examples

```typescript
// Validation exception filter
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    response.status(400).json({
      statusCode: 400,
      timestamp: new Date().toISOString(),
      path: request.url,
      errors: exception.getResponse(),
    });
  }
}

// Logging exception filter
@Injectable()
@Catch()
export class LoggingExceptionFilter implements ExceptionFilter {
  constructor(private logger: LoggerService) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
    
    // Log the error
    this.logger.error({
      message: exception instanceof Error ? exception.message : 'Unknown error',
      path: request.url,
      method: request.method,
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    
    response.status(status).json({
      statusCode: status,
      message: 'An error occurred',
    });
  }
}
```

---

## Execution Order

1. **Guards** - Check if request should be processed
2. **Pipes** - Transform and validate data  
3. **Route Handler** - Execute the controller method
4. **Filters** - Catch exceptions (if thrown)

```typescript
@UseGuards(AuthGuard)              // 1. Guard
@UsePipes(ValidationPipe)          // 2. Pipe
@UseFilters(HttpExceptionFilter)   // 4. Filter
@Get('resource')
getResource() {                    // 3. Handler
  return { data: 'resource' };
}
```

---

## Examples

### Complete Middleware Stack

```typescript
@Controller('api')
@UseGuards(AuthGuard)
@UsePipes(new ValidationPipe({ transform: true }))
@UseFilters(HttpExceptionFilter)
export class ApiController {
  @Post('data')
  createData(@Body() data: CreateDataDto) {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Authentication Flow

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Auth guard
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// Controller
@Controller('api')
@UseGuards(JwtAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@Req() req: any) {
    return req.user;
  }
}
```

### Request Validation

```typescript
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { IsString, IsNumber, IsOptional, MinLength, Min } from 'class-validator';

// DTO
class CreateProductDto {
  @IsString()
  @MinLength(3)
  name: string;
  
  @IsNumber()
  @Min(0)
  price: number;
  
  @IsString()
  @IsOptional()
  description?: string;
}

// Controller
@Controller('products')
export class ProductsController {
  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() createProductDto: CreateProductDto) {
    return { created: true, product: createProductDto };
  }
}
```

### Error Handling

```typescript
import { HttpException, HttpStatus, ExceptionFilter, Catch, ArgumentsHost, Controller, Post, Body, UseFilters } from '@nestjs/common';

// Custom exception
export class BusinessException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

// Exception filter
@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: BusinessException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    response.status(422).json({
      statusCode: 422,
      error: 'Business Logic Error',
      message: exception.message,
    });
  }
}

// Controller
@Controller('api')
@UseFilters(BusinessExceptionFilter)
export class ApiController {
  @Post('order')
  createOrder(@Body() data: any) {
    if (data.quantity <= 0) {
      throw new BusinessException('Quantity must be greater than 0');
    }
    return { created: true };
  }
}
```

---

## See Also

- [Server](./Server.md)
- [Routing](./Routing.md)
- [Request](./Request.md)
- [Response](./Response.md)
