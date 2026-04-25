# HTTP Middleware

Complete guide to HTTP middleware in uWestJS including Guards, Pipes, Filters, and Interceptors.

## Table of Contents

- [Overview](#overview)
- [Guards](#guards)
- [Pipes](#pipes)
- [Filters](#filters)
- [Interceptors](#interceptors)
- [Execution Order](#execution-order)
- [Examples](#examples)

---

## Overview

uWestJS supports all NestJS middleware for HTTP requests:

- **Guards** - Determine whether a request should be handled
- **Pipes** - Transform and validate input data
- **Filters** - Handle exceptions and errors
- **Interceptors** - Add extra logic before/after route handlers

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

// Rate limiting guard
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
    return true;
  }
}
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
import { Controller, Get, Param, Query, Body, UsePipes } from '@nestjs/common';

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

## Interceptors

Interceptors add extra logic before and after route handler execution.

### Creating an Interceptor

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const now = Date.now();
    
    console.log(`Before: ${request.method} ${request.url}`);
    
    return next.handle().pipe(
      tap(() => {
        console.log(`After: ${Date.now() - now}ms`);
      }),
    );
  }
}
```

### Using Interceptors

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';

@Controller('api')
export class ApiController {
  // Method-level interceptor
  @Get('data')
  @UseInterceptors(LoggingInterceptor)
  getData() {
    return { data: 'example' };
  }
}

// Class-level interceptor (applies to all routes)
@Controller('api')
@UseInterceptors(LoggingInterceptor)
export class LoggedController {
  @Get('data')
  getData() { }
}
```

### Transform Response

```typescript
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### Cache Interceptor

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();
  
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = `${request.method}:${request.url}`;
    
    if (this.cache.has(key)) {
      return of(this.cache.get(key));
    }
    
    return next.handle().pipe(
      tap(response => {
        this.cache.set(key, response);
      }),
    );
  }
}
```

### Timeout Interceptor

```typescript
import { timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(timeout(5000)); // 5 second timeout
  }
}
```

---

## Execution Order

Middleware executes in this order:

1. **Guards** - Check if request should be processed
2. **Interceptors (before)** - Pre-processing
3. **Pipes** - Transform and validate data
4. **Route Handler** - Execute the controller method
5. **Interceptors (after)** - Post-processing
6. **Filters** - Catch exceptions (if thrown)

```typescript
@UseGuards(AuthGuard)              // 1. Guard
@UseInterceptors(LoggingInterceptor) // 2 & 5. Interceptor
@UsePipes(ValidationPipe)          // 3. Pipe
@UseFilters(HttpExceptionFilter)   // 6. Filter (if error)
@Get('resource')
getResource() {                    // 4. Handler
  return { data: 'resource' };
}
```

---

## Examples

### Complete Middleware Stack

```typescript
@Controller('api')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
@UsePipes(new ValidationPipe({ transform: true }))
@UseFilters(HttpExceptionFilter)
export class ApiController {
  @Post('data')
  createData(@Body() data: CreateDataDto) {
    return { created: true, data };
  }
}
```

### Authentication Flow

```typescript
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
