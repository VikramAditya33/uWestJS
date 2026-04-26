# Multipart Form Data

The Multipart handler provides efficient parsing of `multipart/form-data` requests, supporting both regular form fields and file uploads with streaming.

## Table of Contents

- [Overview](#overview)
- [Security Considerations](#security-considerations)
- [Basic Usage](#basic-usage)
- [MultipartField Interface](#multipartfield-interface)
- [Configuration Options](#configuration-options)
- [File Uploads](#file-uploads)
- [Error Handling](#error-handling)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

The `MultipartFormHandler` uses [busboy](https://github.com/mscdex/busboy) under the hood to parse multipart/form-data requests efficiently. It provides:

- **Streaming file uploads** - Files are streamed, not buffered in memory
- **Backpressure handling** - Automatic pause/resume based on processing speed
- **Size limits** - Configurable limits for parts, files, and fields
- **Async handler support** - Handlers can be async functions
- **Error handling** - Comprehensive error handling with specific error types

## Security Considerations

### Filename Sanitization

By default, busboy (the underlying parser) strips directory paths from uploaded filenames to prevent path traversal attacks. This means filenames like `../../etc/passwd` are automatically converted to just `passwd`.

However, for defense-in-depth and to handle edge cases, we recommend explicitly sanitizing filenames in production code:

```typescript
import * as path from 'path';
import { randomUUID } from 'crypto';

// Option 1: Use path.basename() for explicit sanitization
const safeFilename = path.basename(field.file.filename);
const filepath = path.join('./uploads', `${Date.now()}-${safeFilename}`);

// Option 2: Generate server-side filenames (most secure)
const serverFilename = `${randomUUID()}-${path.basename(field.file.filename)}`;
const filepath = path.join('./uploads', serverFilename);
```

### Why Additional Sanitization?

1. **Explicit is better than implicit** - Makes security measures visible in code
2. **Defense-in-depth** - Protects against configuration changes (e.g., if `preservePath: true` is set)
3. **Additional threats** - Protects against null bytes, special characters, and extremely long filenames
4. **Best practice** - Industry standard to never trust user-supplied input directly

### Recommended Practices

- Always validate file types using MIME type checking
- Enforce file size limits
- Use server-generated filenames when possible
- Store uploaded files outside the web root
- Implement virus scanning for production systems
- Log all file upload attempts for security auditing

## Basic Usage

### In Controllers (Streaming to Disk)

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

@Controller('upload')
export class UploadController {
  @Post()
  async handleUpload(@Req() req: UwsRequest) {
    const files: Array<{ name: string; filename: string; size: number }> = [];
    const fields: Record<string, string> = {};

    await req.multipart(
      {
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB per file
          files: 5,
        },
      },
      async (field) => {
        if (field.file) {
          // Sanitize filename for security (defense-in-depth)
          const safeFilename = path.basename(field.file.filename);
          const filepath = path.join('./uploads', `${Date.now()}-${safeFilename}`);
          const writeStream = fs.createWriteStream(filepath);
          
          field.file.stream.pipe(writeStream);
          
          await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', (err) => {
              fs.unlink(filepath, () => {}); // Clean up partial file
              reject(err);
            });
          });
          
          const stats = await fs.promises.stat(filepath);
          files.push({
            name: field.name,
            filename: field.file.filename,
            size: stats.size,
          });
        } else {
          // Handle regular field
          fields[field.name] = field.value || '';
        }
      }
    );

    return {
      message: 'Upload successful',
      files,
      fields,
    };
  }
}
```

Note: uWestJS automatically handles file stream errors internally. You only need to handle write stream errors and clean up partial files.

### Accessing Non-File Fields

For simple forms with just text fields (no files), you can access parsed fields directly from `req.body`:

```typescript
@Post('submit-form')
async submitForm(@Body() body: any) {
  // For multipart requests with only text fields, NestJS automatically
  // parses them and makes them available in req.body
  const { name, email, message } = body;
  
  return {
    message: 'Form submitted',
    data: { name, email, message },
  };
}
```

For mixed forms (files + text fields), use the multipart handler and collect fields:

```typescript
@Post('upload-with-metadata')
async uploadWithMetadata(@Req() req: UwsRequest) {
  const files: string[] = [];
  const fields: Record<string, string> = {};

  await req.multipart(async (field) => {
    if (field.file) {
      // Handle file upload
      const filepath = `./uploads/${field.file.filename}`;
      const writeStream = fs.createWriteStream(filepath);
      field.file.stream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      files.push(field.file.filename);
    } else {
      // Collect non-file fields
      fields[field.name] = field.value || '';
    }
  });

  return {
    message: 'Upload successful',
    files,
    metadata: fields, // { title: '...', description: '...', etc }
  };
}
```

### With Options

```typescript
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  await req.multipart(
    {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 5,                    // Max 5 files
        fields: 10,                  // Max 10 fields
        parts: 15,                   // Max 15 parts total
      },
    },
    async (field) => {
      // Handle field
    }
  );
}
```

## MultipartField Interface

Each field passed to your handler has the following structure:

```typescript
import { Readable } from 'stream';

interface MultipartField {
  /**
   * Field name from the form
   */
  name: string;

  /**
   * Field encoding (e.g., '7bit', '8bit', 'binary')
   */
  encoding: string;

  /**
   * MIME type (e.g., 'text/plain', 'image/jpeg')
   */
  mimeType: string;

  /**
   * Field value (for non-file fields)
   */
  value?: string;

  /**
   * Truncation information (for non-file fields)
   */
  truncated?: {
    /**
     * Whether the field name was truncated
     */
    name: boolean;

    /**
     * Whether the field value was truncated
     */
    value: boolean;
  };

  /**
   * File information (for file fields)
   */
  file?: {
    /**
     * Original filename from the client
     */
    filename: string;

    /**
     * Readable stream of file data
     *
     * Note: Check stream.truncated after consuming to determine
     * if the file was truncated due to size limits.
     */
    stream: Readable;
  };
}
```

## Configuration Options

The multipart handler accepts [busboy configuration options](https://github.com/mscdex/busboy#api):

```typescript
interface BusboyConfig {
  /**
   * Size limits
   */
  limits?: {
    /**
     * Max field name size (in bytes)
     * Default: 100
     */
    fieldNameSize?: number;

    /**
     * Max field value size (in bytes)
     * Default: 1MB
     */
    fieldSize?: number;

    /**
     * Max number of non-file fields
     * Default: Infinity
     */
    fields?: number;

    /**
     * Max file size (in bytes)
     * Default: Infinity
     */
    fileSize?: number;

    /**
     * Max number of file fields
     * Default: Infinity
     */
    files?: number;

    /**
     * Max number of parts (fields + files)
     * Default: Infinity
     */
    parts?: number;

    /**
     * Max number of header key-value pairs
     * Default: 2000
     */
    headerPairs?: number;
  };

  /**
   * Preserve path information in filenames
   * Default: false
   */
  preservePath?: boolean;
}
```

### Common Configurations

#### Strict Limits (Recommended for Production)

```typescript
await req.multipart(
  {
    limits: {
      fieldNameSize: 100,              // 100 bytes
      fieldSize: 1024 * 1024,          // 1MB
      fields: 20,                      // 20 fields max
      fileSize: 50 * 1024 * 1024,      // 50MB per file
      files: 10,                       // 10 files max
      parts: 30,                       // 30 parts total
    },
  },
  handler
);
```

#### Generous Limits (Development)

```typescript
await req.multipart(
  {
    limits: {
      fileSize: 100 * 1024 * 1024,     // 100MB per file
      files: 50,                       // 50 files max
    },
  },
  handler
);
```

#### Single File Upload

```typescript
await req.multipart(
  {
    limits: {
      files: 1,                        // Only 1 file allowed
      fileSize: 10 * 1024 * 1024,      // 10MB max
    },
  },
  handler
);
```

## File Uploads

### Streaming to Disk

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

@Post('upload')
async uploadFile(@Req() req: UwsRequest) {
  const uploadedFiles: string[] = [];

  await req.multipart(async (field) => {
    if (field.file) {
      const filename = `${Date.now()}-${field.file.filename}`;
      const filepath = path.join('./uploads', filename);
      
      // Create write stream
      const writeStream = fs.createWriteStream(filepath);
      
      // Pipe file stream to disk
      field.file.stream.pipe(writeStream);
      
      // Wait for completion
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', (err) => {
          fs.unlink(filepath, () => {}); // Clean up partial file
          reject(err);
        });
      });
      
      uploadedFiles.push(filename);
    }
  });

  return { files: uploadedFiles };
}
```

### Streaming to Cloud Storage

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

@Post('upload')
async uploadToS3(@Req() req: UwsRequest) {
  const s3Client = new S3Client({ region: 'us-east-1' });
  const uploads: string[] = [];

  await req.multipart(async (field) => {
    if (field.file) {
      const key = `uploads/${Date.now()}-${field.file.filename}`;
      
      // Stream directly to S3 using AWS SDK v3
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: 'my-bucket',
          Key: key,
          Body: field.file.stream,
          ContentType: field.mimeType,
        },
      });
      
      await upload.done();
      
      uploads.push(key);
    }
  });

  return { uploads };
}
```

### Buffering in Memory (Small Files Only)

Warning: Only use this approach for small files (< 5MB). For larger files, always stream to disk or cloud storage to avoid out-of-memory errors.

```typescript
import { Controller, Post, Req, BadRequestException } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';

@Post('upload')
async uploadSmallFile(@Req() req: UwsRequest) {
  let fileBuffer: Buffer | null = null;
  let filename: string | null = null;

  await req.multipart(
    {
      limits: {
        fileSize: 1024 * 1024, // 1MB max - enforce small file size
        files: 1,
      },
    },
    async (field) => {
      if (field.file) {
        const chunks: Buffer[] = [];
        
        for await (const chunk of field.file.stream) {
          chunks.push(chunk);
        }
        
        fileBuffer = Buffer.concat(chunks);
        filename = field.file.filename;
      }
    }
  );

  if (!fileBuffer) {
    throw new BadRequestException('No file uploaded');
  }

  // Process buffer (e.g., image manipulation, virus scanning)
  return {
    filename,
    size: fileBuffer.length,
  };
}
```

### Image Processing

```typescript
import * as sharp from 'sharp';

@Post('upload/image')
async uploadImage(@Req() req: UwsRequest) {
  let processedImage: Buffer | null = null;

  await req.multipart(
    {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
      },
    },
    async (field) => {
      if (field.file && field.mimeType.startsWith('image/')) {
        // Process image with sharp
        processedImage = await sharp(field.file.stream)
          .resize(800, 600, { fit: 'inside' })
          .jpeg({ quality: 80 })
          .toBuffer();
      }
    }
  );

  if (!processedImage) {
    throw new BadRequestException('No valid image uploaded');
  }

  // Save processed image
  return { size: processedImage.length };
}
```

## Error Handling

### Limit Errors

The multipart handler rejects with specific error strings when limits are exceeded:

```typescript
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  try {
    await req.multipart(
      {
        limits: {
          files: 5,
          fileSize: 10 * 1024 * 1024,
        },
      },
      async (field) => {
        // Handle field
      }
    );
  } catch (error) {
    if (error === 'FILES_LIMIT_REACHED') {
      throw new BadRequestException('Too many files (max 5)');
    }
    if (error === 'FIELDS_LIMIT_REACHED') {
      throw new BadRequestException('Too many fields');
    }
    if (error === 'PARTS_LIMIT_REACHED') {
      throw new BadRequestException('Too many parts');
    }
    throw error;
  }
}
```

### File Size Validation

Choose one approach - don't mix both:

**Option 1: Use busboy's built-in limit (recommended)**

```typescript
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  await req.multipart(
    {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB - busboy enforces this
      },
    },
    async (field) => {
      if (field.file) {
        // Process chunks
        for await (const chunk of field.file.stream) {
          // Process chunk (e.g., write to disk, upload to S3)
        }
        
        // Check if file was truncated by busboy's limit
        if ((field.file.stream as any).truncated) {
          throw new BadRequestException('File exceeds 10MB limit');
        }
      }
    }
  );
}
```

**Option 2: Manual validation with early rejection**

```typescript
@Post('upload')
async handleUpload(@Req() req: UwsRequest) {
  await req.multipart(async (field) => {
    if (field.file) {
      let size = 0;
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      for await (const chunk of field.file.stream) {
        size += chunk.length;
        
        if (size > maxSize) {
          // Drain remaining stream to prevent backpressure
          field.file.stream.resume();
          throw new BadRequestException(`File too large: ${size} bytes`);
        }
        
        // Process chunk (e.g., write to disk, upload to S3)
      }
    }
  });
}
```

Note: Option 1 is simpler but checks after processing all chunks. Option 2 provides early rejection but requires manual tracking.

### MIME Type Validation

```typescript
@Post('upload/image')
async uploadImage(@Req() req: UwsRequest) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  await req.multipart(async (field) => {
    if (field.file) {
      if (!allowedTypes.includes(field.mimeType)) {
        // Drain stream
        field.file.stream.resume();
        throw new BadRequestException(
          `Invalid file type. Allowed: ${allowedTypes.join(', ')}`
        );
      }
      
      // Process valid image
    }
  });
}
```

## Examples

### Multiple File Upload with Metadata

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';
import * as fs from 'fs';
import * as path from 'path';

@Post('upload/gallery')
async uploadGallery(@Req() req: UwsRequest) {
  // Store files temporarily without captions
  const filesTemp: Array<{
    fieldName: string;
    filename: string;
    path: string;
    size: number;
  }> = [];
  
  const captions: Record<string, string> = {};

  await req.multipart(async (field) => {
    if (field.file) {
      // Save file
      const filename = `${Date.now()}-${field.file.filename}`;
      const filepath = path.join('./uploads', filename);
      const writeStream = fs.createWriteStream(filepath);
      
      let size = 0;
      field.file.stream.on('data', (chunk) => {
        size += chunk.length;
      });
      
      field.file.stream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
      });
      
      // Store file info with field name for later caption matching
      filesTemp.push({
        fieldName: field.name,
        filename: field.file.filename,
        path: filepath,
        size,
      });
    } else {
      // Store caption
      captions[field.name] = field.value || '';
    }
  });

  // Match captions with files after all fields are processed
  // This handles any field ordering from the client
  const images = filesTemp.map(file => ({
    filename: file.filename,
    path: file.path,
    size: file.size,
    caption: captions[file.fieldName] || undefined,
  }));

  return { images };
}
```

Note: This example collects all files and captions first, then matches them after parsing completes. This approach works regardless of the order in which the client sends fields (captions before files, files before captions, or interleaved).

### Form with Mixed Fields

```typescript
@Post('profile')
async updateProfile(@Req() req: UwsRequest) {
  const profile: {
    name?: string;
    email?: string;
    bio?: string;
    avatar?: string;
  } = {};

  await req.multipart(async (field) => {
    if (field.file && field.name === 'avatar') {
      // Save avatar
      const ext = path.extname(field.file.filename);
      const filename = `avatar-${Date.now()}${ext}`;
      const filepath = path.join('./uploads/avatars', filename);
      const writeStream = fs.createWriteStream(filepath);
      
      field.file.stream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      profile.avatar = filename;
    } else {
      // Regular field
      switch (field.name) {
        case 'name':
          profile.name = field.value;
          break;
        case 'email':
          profile.email = field.value;
          break;
        case 'bio':
          profile.bio = field.value;
          break;
      }
    }
  });

  return profile;
}
```

### Progress Tracking

```typescript
import { Controller, Post, Req, Res } from '@nestjs/common';
import { UwsRequest, UwsResponse } from 'uwestjs';
import * as fs from 'fs';

@Post('upload/large')
async uploadLarge(@Req() req: UwsRequest) {
  let totalBytes = 0;
  let processedBytes = 0;

  // Get content-length for progress calculation
  const contentLength = parseInt(req.get('content-length') || '0', 10);

  await req.multipart(async (field) => {
    if (field.file) {
      const filepath = `./uploads/${field.file.filename}`;
      const writeStream = fs.createWriteStream(filepath);
      
      field.file.stream.on('data', (chunk: Buffer) => {
        processedBytes += chunk.length;
        const progress = contentLength > 0 
          ? Math.round((processedBytes / contentLength) * 100)
          : 0;
        
        console.log(`Upload progress: ${progress}%`);
      });
      
      field.file.stream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', (err) => {
          fs.unlink(filepath, () => {}); // Clean up partial file
          reject(err);
        });
      });
    }
  });

  return { message: 'Upload complete' };
}
```

## Best Practices

### 1. Sanitize Filenames

Always sanitize user-provided filenames to prevent path traversal and other security issues:

```typescript
import * as path from 'path';
import { randomUUID } from 'crypto';

// Good - explicit sanitization (defense-in-depth)
if (field.file) {
  const safeFilename = path.basename(field.file.filename);
  const filepath = path.join('./uploads', `${Date.now()}-${safeFilename}`);
}

// Better - server-generated filenames (most secure)
if (field.file) {
  const serverFilename = `${randomUUID()}${path.extname(field.file.filename)}`;
  const filepath = path.join('./uploads', serverFilename);
  // Store original filename in database if needed
}

// Bad - using filename directly (relies on implicit protection)
if (field.file) {
  const filepath = `./uploads/${field.file.filename}`; // Don't do this
}
```

Note: While busboy strips directory paths by default, explicit sanitization is recommended for defense-in-depth and to handle edge cases.

### 2. Always Set Limits

```typescript
// Good - explicit limits
await req.multipart(
  {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 5,
      fields: 20,
    },
  },
  handler
);

// Bad - no limits (vulnerable to DoS)
await req.multipart(handler);
```

### 3. Validate MIME Types

```typescript
// Good - validate before processing
if (field.file) {
  if (!allowedTypes.includes(field.mimeType)) {
    field.file.stream.resume(); // Drain stream
    throw new BadRequestException('Invalid file type');
  }
}
```

### 4. Handle Stream Errors

Note: uWestJS automatically handles file stream errors internally (see `multipart-handler.ts` line 201). You only need to handle write stream errors and clean up partial files.

```typescript
// Good - proper error handling with cleanup
if (field.file) {
  const filepath = `./uploads/${field.file.filename}`;
  const writeStream = fs.createWriteStream(filepath);
  
  // Handle write stream errors
  writeStream.on('error', (err) => {
    console.error('Write stream error:', err);
    writeStream.destroy();
    fs.unlink(filepath, () => {}); // Clean up partial file
  });
  
  field.file.stream.pipe(writeStream);
  
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', (err) => {
      fs.unlink(filepath, () => {}); // Clean up partial file
      reject(err);
    });
    // File stream errors are handled internally by uWestJS
    // and will cause the multipart handler to reject
  });
}
```

### 5. Don't Buffer Large Files

```typescript
// Good - stream to disk
field.file.stream.pipe(fs.createWriteStream(filepath));

// Bad - buffer in memory (OOM risk)
const chunks = [];
for await (const chunk of field.file.stream) {
  chunks.push(chunk);
}
const buffer = Buffer.concat(chunks); // Dangerous for large files
```

### 6. Clean Up on Errors

```typescript
// Good - cleanup on error
try {
  await req.multipart(async (field) => {
    if (field.file) {
      const filepath = `./uploads/${field.file.filename}`;
      const writeStream = fs.createWriteStream(filepath);
      
      field.file.stream.pipe(writeStream);
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', (err) => {
          // Clean up partial file
          fs.unlink(filepath, () => {});
          reject(err);
        });
      });
    }
  });
} catch (error) {
  // Handle error
}
```

### 7. Use Async Handlers

```typescript
// Good - async handler with awaited operations (proper backpressure)
await req.multipart(async (field) => {
  if (field.file) {
    await saveFile(field.file.stream);
  }
});

// Bad - async operation not awaited (no backpressure control)
await req.multipart(async (field) => {
  if (field.file) {
    saveFile(field.file.stream); // Not awaited! Backpressure won't work
  }
});

// Also bad - non-async handler (can't await operations)
await req.multipart((field) => {  // Not async!
  if (field.file) {
    saveFile(field.file.stream); // Can't await in non-async function
  }
});
```

## See Also

- [Request](./Request.md) - HTTP Request object documentation
- [Body Parsing](./Body-Parsing.md) - Other body parsing methods
- [Busboy Documentation](https://github.com/mscdex/busboy) - Underlying parser library
