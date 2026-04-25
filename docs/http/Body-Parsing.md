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

class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNumber()
  age: number;
}

@Post('users')
@UsePipes(new ValidationPipe())
createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

### Nested Objects

```typescript
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
@Post('text')
handleText(@Body() text: string) {
  console.log('Received text:', text);
  return { length: text.length };
}
```

### CSV Upload

```typescript
@Post('import/csv')
async importCSV(@Body() csvText: string) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');
  
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index];
      return obj;
    }, {} as Record<string, string>);
  });
  
  await this.dataService.importMany(data);
  return { imported: data.length };
}
```

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

### Per-Route Configuration

You can disable body parsing for specific routes:

```typescript
@Post('no-parse')
handleNoParse(@Req() req: UwsRequest) {
  // Body is not automatically parsed
  // Access raw stream via req
}
```

## Size Limits

### Global Limit

Set a global body size limit:

```typescript
new UwsPlatformAdapter({
  maxBodySize: 5 * 1024 * 1024, // 5MB
})
```

### Handling Size Limit Errors

```typescript
@Post('upload')
async handleUpload(@Body() data: any) {
  try {
    // Process data
  } catch (error) {
    if (error.message.includes('Body size limit exceeded')) {
      throw new PayloadTooLargeException('Request body too large');
    }
    throw error;
  }
}
```

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
    
    if (message.includes('JSON')) {
      return response.status(400).json({
        error: 'Invalid JSON',
        message: 'Request body must be valid JSON',
      });
    }
    
    if (message.includes('Body size')) {
      return response.status(413).json({
        error: 'Payload Too Large',
        message: 'Request body exceeds size limit',
      });
    }

    return response.status(400).json({
      error: 'Bad Request',
      message: exception.message,
    });
  }
}

// Apply globally
app.useGlobalFilters(new BodyParseExceptionFilter());
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

## Best Practices

### 1. Always Validate Input

```typescript
// Good - validated DTO
@Post('users')
@UsePipes(new ValidationPipe())
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
import * as sanitizeHtml from 'sanitize-html';

class CreatePostDto {
  @IsString()
  @Transform(({ value }) => sanitizeHtml(value))
  content: string;
}
```

### 6. Use Streaming for Large Payloads

```typescript
// Good - streaming for large files
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  await req.multipart(async (field) => {
    if (field.file) {
      // Stream to disk, don't buffer
      field.file.stream.pipe(fs.createWriteStream(path));
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
