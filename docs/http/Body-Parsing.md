# Body Parsing

Comprehensive guide to parsing request bodies in uWestJS, including JSON, URL-encoded, multipart, raw, and text formats.

## Table of Contents

- [Overview](#overview)
- [Automatic Parsing](#automatic-parsing)
- [JSON Bodies](#json-bodies)
- [URL-Encoded Bodies](#url-encoded-bodies)
- [Multipart Form Data](#multipart-form-data)
- [Raw Bodies](#raw-bodies)
- [Text Bodies](#text-bodies)
- [Configuration](#configuration)
- [Size Limits](#size-limits)
- [Error Handling](#error-handling)

## Overview

uWestJS automatically parses request bodies based on the `Content-Type` header when body parsing is enabled. The parsed body is available via `req.body` or the `@Body()` decorator.

**Supported Content Types:**
- `application/json` - JSON parsing
- `application/x-www-form-urlencoded` - Form data parsing
- `multipart/form-data` - Multipart/file upload parsing
- `application/octet-stream` - Raw buffer parsing
- `text/*` - Text parsing

## Automatic Parsing

Body parsing is enabled by default for JSON and URL-encoded content types:

```typescript
// main.ts
const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    bodyParser: {
      json: true,        // Parse application/json
      urlencoded: true,  // Parse application/x-www-form-urlencoded
      raw: false,        // Parse application/octet-stream
      text: false,       // Parse text/*
    },
  })
);
```

## JSON Bodies

### Basic Usage

```typescript
import { Controller, Post, Body } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Post('data')
  handleData(@Body() data: any) {
    console.log(data); // Parsed JSON object
    return { received: data };
  }
}
```

### With DTO Validation

```typescript
import { IsString, IsNumber, IsEmail } from 'class-validator';
import { UsePipes, ValidationPipe } from '@nestjs/common';

class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  age: number;
}

@Post('users')
@UsePipes(ValidationPipe)
createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### Nested Objects

```typescript
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  country: string;
}

class UserDto {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

@Post('users')
createUser(@Body() dto: UserDto) {
  // dto.address is properly typed and validated
  return dto;
}
```

### Arrays

```typescript
@Post('batch')
createBatch(@Body() items: CreateItemDto[]) {
  return this.itemService.createMany(items);
}
```

## URL-Encoded Bodies

### Form Submissions

```typescript
@Post('form')
handleForm(@Body() formData: any) {
  console.log(formData);
  // { name: 'John', email: 'john@example.com' }
  return { received: formData };
}
```

### HTML Form Example

```html
<form action="/api/form" method="POST">
  <input type="text" name="name" value="John" />
  <input type="email" name="email" value="john@example.com" />
  <button type="submit">Submit</button>
</form>
```

### Arrays in Forms

```typescript
// Form: ?tags=javascript&tags=typescript&tags=nodejs
@Post('tags')
handleTags(@Body() body: { tags: string[] }) {
  console.log(body.tags); // ['javascript', 'typescript', 'nodejs']
}
```

## Multipart Form Data

For file uploads and mixed form data, see the dedicated [Multipart documentation](./Multipart.md).

### Quick Example

```typescript
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  const files: any[] = [];
  const fields: Record<string, string> = {};

  await req.multipart(async (field) => {
    if (field.file) {
      // Handle file
      files.push({
        name: field.name,
        filename: field.file.filename,
        mimeType: field.mimeType,
      });
      
      // Consume stream
      field.file.stream.resume();
    } else {
      // Handle regular field
      fields[field.name] = field.value || '';
    }
  });

  return { files, fields };
}
```

## Raw Bodies

For binary data or when you need the raw buffer:

### Enable Raw Parsing

```typescript
// main.ts
const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    bodyParser: {
      raw: true, // Enable raw parsing
    },
  })
);
```

### Usage

```typescript
import { Controller, Post, Req, Body, UnauthorizedException } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';

@Post('webhook')
handleWebhook(@Req() req: UwsRequest, @Body() rawBody: Buffer) {
  // rawBody is a Buffer
  console.log('Received bytes:', rawBody.length);
  
  // Verify signature
  const signature = req.get('X-Signature');
  const isValid = this.verifySignature(rawBody, signature);
  
  if (!isValid) {
    throw new UnauthorizedException('Invalid signature');
  }
  
  return { received: true };
}
```

### Webhook Example (Stripe)

```typescript
import { Controller, Post, Req, Body, BadRequestException } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';
import Stripe from 'stripe';

@Post('webhooks/stripe')
async handleStripeWebhook(
  @Req() req: UwsRequest,
  @Body() rawBody: Buffer,
) {
  const signature = req.get('stripe-signature');
  
  try {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Handle event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      // ... other events
    }
    
    return { received: true };
  } catch (err) {
    throw new BadRequestException('Webhook signature verification failed');
  }
}
```

## Text Bodies

For plain text content:

### Enable Text Parsing

```typescript
// main.ts
const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    bodyParser: {
      text: true, // Enable text parsing
    },
  })
);
```

### Usage

```typescript
import { Controller, Post, Body } from '@nestjs/common';

@Post('text')
handleText(@Body() text: string) {
  console.log('Received text:', text);
  return { length: text.length };
}
```

### CSV Upload

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

@Post('import/csv')
async importCSV(@Body() csvText: string) {
  // Use a robust CSV parser that handles quoted values, escaped quotes, and edge cases
  const records = parse(csvText, {
    columns: true,           // Use first row as headers
    skip_empty_lines: true,  // Ignore empty lines
    trim: true,              // Trim whitespace
    relax_quotes: true,      // Handle malformed quotes
  });
  
  await this.dataService.importMany(records);
  return { imported: records.length };
}
```

Note: For production CSV parsing, always use a robust library like `csv-parse` or `papaparse` instead of simple string splitting. These libraries properly handle:
- Quoted values containing commas
- Escaped quotes
- Different line endings (CRLF vs LF)
- Empty lines and whitespace
- RFC 4180 compliance

## Configuration

### Global Configuration

Configure body parsing globally in `main.ts`:

```typescript
const app = await NestFactory.create(
  AppModule,
  new UwsPlatformAdapter({
    maxBodySize: 10 * 1024 * 1024, // 10MB limit
    bodyParser: {
      json: true,
      urlencoded: true,
      raw: false,
      text: false,
    },
  })
);
```

### Per-Route Raw Body Access

If you need to access the raw request stream without automatic body parsing, you can use the request as a Readable stream:

```typescript
import { Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';

@Post('webhook')
async handleWebhook(@Req() req: UwsRequest) {
  // Access raw body as buffer (body parser still runs, but you get raw data)
  const rawBody = await req.buffer();
  
  // Or stream the body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  
  // Process raw body (e.g., verify webhook signature)
  return { received: true };
}
```

**Note**: The body parser is always initialized for all routes. Use `req.buffer()` to get the raw body data, or pipe the request stream for large payloads.

## Size Limits

### Global Limit

Set a global body size limit:

```typescript
new UwsPlatformAdapter({
  maxBodySize: 5 * 1024 * 1024, // 5MB
})
```

### Handling Size Limit Errors

**Note**: When the body size limit is exceeded, uWestJS closes the connection immediately before your handler runs. The client receives a connection close, and your handler is never invoked.

If you need custom error handling for oversized bodies, you can implement it at the application level using exception filters or by manually checking the body size:

```typescript
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';

@Post('upload')
async handleUpload(@Body() data: any) {
  // Custom validation after body is parsed
  const bodySize = JSON.stringify(data).length;
  const maxAllowed = 1024 * 1024; // 1MB
  
  if (bodySize > maxAllowed) {
    throw new BadRequestException('Request body too large');
  }
  
  // Process data
  return { success: true };
}
```

**Alternative**: For more control over body size validation, use streaming:

```typescript
import { Post, Req, PayloadTooLargeException } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';

@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  let totalSize = 0;
  const chunks: Buffer[] = [];
  
  for await (const chunk of req) {
    totalSize += chunk.length;
    
    if (totalSize > maxSize) {
      throw new PayloadTooLargeException('Request body exceeds 5MB');
    }
    
    chunks.push(chunk);
  }
  
  const body = Buffer.concat(chunks);
  // Process body
  return { received: body.length };
}
```

Note: uWestJS automatically rejects oversized requests at the platform level. When the body size exceeds the configured limit, the connection is closed and an error is thrown before reaching your handler. This error handling is typically only needed for custom validation logic.

### Different Limits for Different Routes

```typescript
// Small limit for API endpoints
@Post('api/data')
handleData(@Body() data: any) {
  // Uses global limit
}

// Large limit for file uploads
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  // Use multipart with custom limits
  await req.multipart(
    {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    },
    async (field) => {
      // Handle field
    }
  );
}
```

## Error Handling

### JSON Parse Errors

```typescript
@Post('data')
handleData(@Body() data: any) {
  // If JSON is invalid, NestJS will throw BadRequestException
  return data;
}
```

### Custom Error Handling

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common';

@Catch(BadRequestException)
export class BodyParseExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const message = exception.message;
    const exceptionResponse = exception.getResponse();
    
    // Check for specific error types using more robust detection
    // Option 1: Check exception response structure (if available)
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const errorObj = exceptionResponse as any;
      
      // Check for validation errors from class-validator
      if (Array.isArray(errorObj.message)) {
        return response.status(400).json({
          error: 'Validation Failed',
          details: errorObj.message,
        });
      }
    }
    
    // Option 2: Check error message patterns (more specific than includes())
    // Use regex for more precise matching
    // 
    // IMPORTANT: Error message-based detection is fragile and may break when
    // library versions change. Consider these best practices:
    // - Custom exception classes (shown below) are more reliable
    // - Test message patterns when upgrading dependencies
    // - Log unmatched errors during development to catch new error formats
    if (/^(Unexpected token|JSON\.parse|Invalid JSON)/i.test(message)) {
      return response.status(400).json({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON',
        hint: 'Check for trailing commas, unquoted keys, or malformed syntax',
      });
    }
    
    if (/^Body size (limit )?exceeded/i.test(message)) {
      return response.status(413).json({
        error: 'Payload Too Large',
        message: 'Request body exceeds size limit',
        maxSize: '1MB', // Adjust based on your configuration
      });
    }
    
    if (/^Connection aborted/i.test(message)) {
      return response.status(400).json({
        error: 'Connection Aborted',
        message: 'Client disconnected before request completed',
      });
    }

    // Default error response
    return response.status(400).json({
      error: 'Bad Request',
      message: exception.message,
    });
  }
}

// Recommended: Register via DI in your app module
// app.module.ts
import { Module } from '@nestjs/core';
import { APP_FILTER } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: BodyParseExceptionFilter,
    },
  ],
})
export class AppModule {}

// Alternative: Apply globally in main.ts (bypasses DI)
// Use this only if you don't need constructor dependencies
app.useGlobalFilters(new BodyParseExceptionFilter());
```

For more robust and maintainable error handling, use custom exception classes instead of message pattern matching. This approach is type-safe and won't break when library error messages change:

```typescript
// Custom exception classes for better type safety
export class InvalidJsonException extends BadRequestException {
  constructor() {
    super('Invalid JSON in request body');
  }
}

export class PayloadTooLargeException extends BadRequestException {
  constructor(maxSize: number) {
    super(`Request body exceeds size limit of ${maxSize} bytes`);
    this.name = 'PayloadTooLargeException';
  }
}

// Then in your filter, check exception type
@Catch(BadRequestException)
export class BodyParseExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    // Type-safe error detection
    if (exception instanceof PayloadTooLargeException) {
      return response.status(413).json({
        error: 'Payload Too Large',
        message: exception.message,
      });
    }
    
    if (exception instanceof InvalidJsonException) {
      return response.status(400).json({
        error: 'Invalid JSON',
        message: exception.message,
      });
    }
    
    // Default handling
    return response.status(400).json({
      error: 'Bad Request',
      message: exception.message,
    });
  }
}
```

### Validation Errors

```typescript
import { ValidationPipe, BadRequestException } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      const messages = errors.map(error => ({
        field: error.property,
        errors: Object.values(error.constraints || {}),
      }));
      
      return new BadRequestException({
        error: 'Validation Failed',
        details: messages,
      });
    },
  })
);
```

Note: For better testability and DI integration, you can use the provider-based approach instead:

```typescript
// app.module.ts
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
```

This approach integrates with NestJS's DI container and is easier to test. However, if your configuration depends on environment variables or needs to be set before module initialization, using `app.useGlobalPipes()` in `main.ts` is acceptable.

## Best Practices

### 1. Always Validate Input

```typescript
// Good - validated DTO with DI
@Post('users')
@UsePipes(ValidationPipe)
createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}

// Bad - no validation
@Post('users')
createUser(@Body() data: any) {
  return this.userService.create(data);
}
```

### 2. Set Appropriate Size Limits

```typescript
// Good - reasonable limits
new UwsPlatformAdapter({
  maxBodySize: 10 * 1024 * 1024, // 10MB
})

// Bad - no limit (DoS risk)
new UwsPlatformAdapter({
  maxBodySize: Infinity,
})
```

### 3. Use DTOs with Type Safety

```typescript
// Good - type-safe DTO
class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;
}

// Bad - any type
@Post('products')
createProduct(@Body() data: any) {
  // No type safety
}
```

### 4. Handle Parse Errors Gracefully

```typescript
// Good - custom error handling
@UseFilters(BodyParseExceptionFilter)
@Post('data')
handleData(@Body() data: any) {
  return data;
}
```

### 5. Sanitize Input

```typescript
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

class CreatePostDto {
  @IsString()
  @Transform(({ value }) => sanitizeHtml(value))
  content: string;
}
```

### 6. Use Streaming for Large Payloads

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

// Good - streaming for large files
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  const uploadPath = path.join(__dirname, 'uploads', 'file.bin');
  
  await req.multipart(async (field) => {
    if (field.file) {
      // Stream to disk, don't buffer
      field.file.stream.pipe(fs.createWriteStream(uploadPath));
    }
  });
}

// Bad - buffering large files
@Post('upload')
async handleUpload(@Body() data: Buffer) {
  // Entire file in memory!
}
```

## See Also

- [Request](./Request.md) - HTTP Request object documentation
- [Multipart](./Multipart.md) - File upload documentation
- [Validation](https://docs.nestjs.com/techniques/validation) - NestJS validation guide
