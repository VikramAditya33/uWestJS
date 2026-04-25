# Multipart Form Data

The Multipart handler provides efficient parsing of `multipart/form-data` requests, supporting both regular form fields and file uploads with streaming.

## Table of Contents

- [Overview](#overview)
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

## Basic Usage

### In Controllers

```typescript
import { Controller, Post, Req } from '@nestjs/common';
import { UwsRequest } from 'uwestjs';

@Controller('upload')
export class UploadController {
  @Post()
  async handleUpload(@Req() req: UwsRequest) {
    const files: Array<{ name: string; filename: string; size: number }> = [];
    const fields: Record<string, string> = {};

    await req.multipart(async (field) => {
      if (field.file) {
        // Handle file upload
        const chunks: Buffer[] = [];
        
        for await (const chunk of field.file.stream) {
          chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        
        files.push({
          name: field.name,
          filename: field.file.filename,
          size: buffer.length,
        });
      } else {
        // Handle regular field
        fields[field.name] = field.value || '';
      }
    });

    return {
      message: 'Upload successful',
      files,
      fields,
    };
  }
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
        writeStream.on('error', reject);
        field.file!.stream.on('error', reject);
      });
      
      uploadedFiles.push(filename);
    }
  });

  return { files: uploadedFiles };
}
```

### Streaming to Cloud Storage

```typescript
import { S3 } from 'aws-sdk';

@Post('upload')
async uploadToS3(@Req() req: UwsRequest) {
  const s3 = new S3();
  const uploads: string[] = [];

  await req.multipart(async (field) => {
    if (field.file) {
      const key = `uploads/${Date.now()}-${field.file.filename}`;
      
      // Stream directly to S3
      await s3.upload({
        Bucket: 'my-bucket',
        Key: key,
        Body: field.file.stream,
        ContentType: field.mimeType,
      }).promise();
      
      uploads.push(key);
    }
  });

  return { uploads };
}
```

### Buffering in Memory (Small Files)

```typescript
@Post('upload')
async uploadSmallFile(@Req() req: UwsRequest) {
  let fileBuffer: Buffer | null = null;
  let filename: string | null = null;

  await req.multipart(
    {
      limits: {
        fileSize: 1024 * 1024, // 1MB max
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

  // Process buffer
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
          // Drain remaining stream
          field.file.stream.resume();
          throw new BadRequestException('File too large');
        }
        
        // Process chunk
      }
      
      // Check if file was truncated by busboy
      if ((field.file.stream as any).truncated) {
        throw new BadRequestException('File was truncated');
      }
    }
  });
}
```

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
@Post('upload/gallery')
async uploadGallery(@Req() req: UwsRequest) {
  const images: Array<{
    filename: string;
    path: string;
    size: number;
    caption?: string;
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
        writeStream.on('error', reject);
      });
      
      images.push({
        filename: field.file.filename,
        path: filepath,
        size,
        caption: captions[field.name],
      });
    } else {
      // Store caption for matching with file
      captions[field.name] = field.value || '';
    }
  });

  return { images };
}
```

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
      const filename = `avatar-${Date.now()}.jpg`;
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
@Post('upload/large')
async uploadLarge(@Req() req: UwsRequest, @Res() res: UwsResponse) {
  let totalBytes = 0;
  let processedBytes = 0;

  // Get content-length for progress calculation
  const contentLength = parseInt(req.get('content-length') || '0', 10);

  await req.multipart(async (field) => {
    if (field.file) {
      const writeStream = fs.createWriteStream(`./uploads/${field.file.filename}`);
      
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
        writeStream.on('error', reject);
      });
    }
  });

  return { message: 'Upload complete' };
}
```

## Best Practices

### 1. Always Set Limits

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

### 2. Validate MIME Types

```typescript
// Good - validate before processing
if (field.file) {
  if (!allowedTypes.includes(field.mimeType)) {
    field.file.stream.resume(); // Drain stream
    throw new BadRequestException('Invalid file type');
  }
}
```

### 3. Handle Stream Errors

```typescript
// Good - proper error handling
field.file.stream.on('error', (err) => {
  console.error('Stream error:', err);
  // Handle error
});
```

### 4. Don't Buffer Large Files

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

### 5. Clean Up on Errors

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

### 6. Use Async Handlers

```typescript
// Good - async handler (proper backpressure)
await req.multipart(async (field) => {
  if (field.file) {
    await saveFile(field.file.stream);
  }
});

// Bad - sync handler (no backpressure)
await req.multipart((field) => {
  if (field.file) {
    saveFile(field.file.stream); // Not awaited!
  }
});
```

## See Also

- [Request](./Request.md) - HTTP Request object documentation
- [Body Parsing](./Body-Parsing.md) - Other body parsing methods
- [Busboy Documentation](https://github.com/mscdex/busboy) - Underlying parser library
