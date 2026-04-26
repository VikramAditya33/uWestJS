# Request

The `UwsRequest` component provides an Express-compatible HTTP request object with enhanced performance through uWebSockets.js.

* See [ExpressJS](https://expressjs.com/en/4x/api.html#req) for more information on Express compatibility methods and properties.
* See [Node.js IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage) for more information on Node.js HTTP request properties.

## Table of Contents

- [Properties](#properties)
- [Methods](#methods)
- [Body Parsing](#body-parsing)
- [Headers](#headers)
- [Cookies](#cookies)
- [Query Parameters](#query-parameters)
- [URL Information](#url-information)
- [Examples](#examples)

## Properties

### raw

```typescript
readonly raw: uWS.HttpRequest
```

The underlying raw uWebSockets.js HTTP request instance.

**Warning:** Direct manipulation of the raw request is unsafe and may cause unexpected behavior.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const rawRequest = req.raw;
  // Use with caution
}
```

### method

```typescript
readonly method: string
```

HTTP request method in uppercase (GET, POST, PUT, DELETE, etc.).

**Example:**

```typescript
@All('*')
handler(@Req() req: UwsRequest) {
  console.log(`Method: ${req.method}`); // GET, POST, etc.
}
```

### url

```typescript
readonly url: string
```

Request path without query string (same as `path`).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.url); // /api/users
}
```

### path

```typescript
readonly path: string
```

Request path without query string.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.path); // /api/users
}
```

### query

```typescript
readonly query: string
```

Raw query string from the URL (without the leading `?`). Use `queryParams` to access parsed query parameters.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // URL: /api/users?page=1&limit=10&tags=a&tags=b
  console.log(req.query); // 'page=1&limit=10&tags=a&tags=b'
  
  // Use queryParams for parsed values
  console.log(req.queryParams.page);  // '1'
  console.log(req.queryParams.limit); // '10'
  console.log(req.queryParams.tags);  // ['a', 'b']
}
```

### queryParams

```typescript
readonly queryParams: Record<string, string | string[]>
```

Parsed query parameters from the URL. This is the parsed version of the `query` string.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // URL: /api/users?page=1&limit=10&tags=a&tags=b
  console.log(req.queryParams.page);  // '1'
  console.log(req.queryParams.limit); // '10'
  console.log(req.queryParams.tags);  // ['a', 'b']
}
```

### originalUrl

```typescript
readonly originalUrl: string
```

Full request URL including query string. This is the complete URL as received.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.originalUrl); // /api/users?page=1&limit=10
  console.log(req.url);         // /api/users (path only)
  console.log(req.query);       // page=1&limit=10 (raw query string)
}
```

### params

```typescript
params: Record<string, string>
```

Route parameters extracted from the URL path.

**Example:**

```typescript
@Get(':id')
handler(@Req() req: UwsRequest, @Param('id') id: string) {
  console.log(req.params.id); // Same as id parameter
}

@Get('users/:userId/posts/:postId')
handler(@Req() req: UwsRequest) {
  console.log(req.params.userId);  // '123'
  console.log(req.params.postId);  // '456'
}
```

### headers

```typescript
readonly headers: Record<string, string | string[]>
```

Request headers (lowercase keys).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.headers['content-type']);
  console.log(req.headers['authorization']);
  console.log(req.headers['user-agent']);
}
```

### cookies

```typescript
readonly cookies: Record<string, string>
```

Parsed cookies from the Cookie header.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.cookies.sessionId);
  console.log(req.cookies.userId);
}
```

### signedCookies

```typescript
readonly signedCookies: Record<string, string>
```

Parsed signed cookies (requires cookie secret configuration).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Signed cookies are automatically verified
  console.log(req.signedCookies.session);
}
```

### ip

```typescript
readonly ip: string
```

Remote client IP address. Respects `X-Forwarded-For` header when `trustProxy` is enabled.

See [trustProxy configuration](./Server.md#trustproxy) for security considerations.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(`Request from: ${req.ip}`);
}
```

### ips

```typescript
readonly ips: string[]
```

Array of IP addresses from `X-Forwarded-For` header (when `trustProxy` is enabled).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log('IP chain:', req.ips); // ['client-ip', 'proxy1-ip', 'proxy2-ip']
}
```

### protocol

```typescript
readonly protocol: string
```

Request protocol: 'http' or 'https'. Respects `X-Forwarded-Proto` when `trustProxy` is enabled.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.protocol); // 'https'
}
```

### secure

```typescript
readonly secure: boolean
```

True if the request is over HTTPS.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  if (!req.secure) {
    throw new ForbiddenException('HTTPS required');
  }
}
```

### hostname

```typescript
readonly hostname: string
```

Hostname from the Host header. Respects `X-Forwarded-Host` when `trustProxy` is enabled.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.hostname); // 'example.com'
}
```

### body

```typescript
body: any
```

Parsed request body. The type depends on the Content-Type header and enabled body parsers:

- **JSON** (`application/json`): Parsed object (default enabled)
- **URL-encoded** (`application/x-www-form-urlencoded`): Parsed object (default enabled)
- **Raw** (`application/octet-stream`): Buffer (requires raw parser configuration)
- **Text** (`text/plain`): String (requires text parser configuration)

See [Body Parsing](./Body-Parsing.md) for configuration details.

**Example:**

```typescript
@Post()
handler(@Req() req: UwsRequest, @Body() body: any) {
  console.log(req.body); // Same as body parameter
}
```

## Methods

### get()

```typescript
get(name: string): string | string[] | undefined
```

Get a request header value (case-insensitive).

**Parameters:**
- `name` - Header name

**Returns:** Header value or undefined

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const contentType = req.get('Content-Type');
  const auth = req.get('Authorization');
  const customHeader = req.get('X-Custom-Header');
}
```

### header()

```typescript
header(name: string): string | string[] | undefined
```

Alias for `get()`. Get a request header value.

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const userAgent = req.header('User-Agent');
}
```

### accepts()

```typescript
accepts(...types: string[]): string | false
```

Check if the request accepts the given content type(s) based on the Accept header.

**Parameters:**
- `types` - Content types to check

**Returns:** Best matching type or false

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest, @Res() res: UwsResponse) {
  const accept = req.accepts('json', 'html');
  
  if (accept === 'json') {
    res.json({ data: 'JSON response' });
  } else if (accept === 'html') {
    res.send('<h1>HTML response</h1>');
  } else {
    res.status(406).send('Not Acceptable');
  }
}
```

### acceptsCharsets()

```typescript
acceptsCharsets(...charsets: string[]): string | false
```

Check if the request accepts the given charset(s).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const charset = req.acceptsCharsets('utf-8', 'iso-8859-1');
  console.log(`Accepted charset: ${charset}`);
}
```

### acceptsEncodings()

```typescript
acceptsEncodings(...encodings: string[]): string | false
```

Check if the request accepts the given encoding(s).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const encoding = req.acceptsEncodings('gzip', 'deflate');
  if (encoding) {
    // Use compression
  }
}
```

### acceptsLanguages()

```typescript
acceptsLanguages(...languages: string[]): string | false
```

Check if the request accepts the given language(s).

**Example:**

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const lang = req.acceptsLanguages('en', 'es', 'fr');
  console.log(`Preferred language: ${lang}`);
}
```

### is()

```typescript
is(...types: string[]): string | false | null
```

Check if the incoming request's Content-Type matches the given type(s).

**Parameters:**
- `types` - Content types to check

**Returns:** Matching type, false if no match, or null if no body

**Example:**

```typescript
@Post()
handler(@Req() req: UwsRequest) {
  if (req.is('json')) {
    // Handle JSON body
  } else if (req.is('urlencoded')) {
    // Handle form data
  } else if (req.is('multipart')) {
    // Handle multipart/form-data
  }
}
```

### range()

```typescript
range(size: number, options?: any): Ranges | -1 | -2
```

Parse the Range header.

**Parameters:**
- `size` - Total size of the resource
- `options` - Optional range parsing options

**Returns:**
- Array of ranges if valid
- -1 if malformed
- -2 if unsatisfiable

**Example:**

```typescript
@Get('video')
handler(@Req() req: UwsRequest, @Res() res: UwsResponse) {
  const fileSize = 1000000;
  const ranges = req.range(fileSize);
  
  if (ranges === -1) {
    res.status(400).send('Malformed Range header');
  } else if (ranges === -2) {
    res.status(416).send('Range Not Satisfiable');
  } else if (Array.isArray(ranges)) {
    // Handle range request
    const { start, end } = ranges[0];
    // Stream partial content
  }
}
```

## Body Parsing

The request body is automatically parsed based on the Content-Type header when body parsing is enabled.

### JSON Body

```typescript
@Post()
async createUser(@Req() req: UwsRequest, @Body() dto: CreateUserDto) {
  // Content-Type: application/json
  console.log(req.body); // Parsed JSON object
}
```

### URL-Encoded Body

```typescript
@Post()
async submitForm(@Req() req: UwsRequest) {
  // Content-Type: application/x-www-form-urlencoded
  console.log(req.body); // Parsed form data
}
```

### Multipart Form Data

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(@Req() req: UwsRequest) {
  // Content-Type: multipart/form-data
  // Use NestJS file upload interceptors
}
```

### Raw Body

```typescript
@Post('webhook')
async handleWebhook(@Req() req: UwsRequest) {
  // Access raw body buffer
  // Requires raw body parser to be enabled in platform configuration
  // See Body Parsing documentation for configuration details
  const rawBody = req.body; // Buffer (when Content-Type is application/octet-stream or raw parser is enabled)
}
```

### Text Body

```typescript
@Post('text')
async handleText(@Req() req: UwsRequest) {
  // Content-Type: text/plain
  // Requires text body parser to be enabled in platform configuration
  // See Body Parsing documentation for configuration details
  console.log(req.body); // String (when Content-Type is text/plain and text parser is enabled)
}
```

## Headers

### Getting Headers

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Case-insensitive
  const contentType = req.get('Content-Type');
  const auth = req.get('authorization');
  
  // Direct access (lowercase keys)
  const userAgent = req.headers['user-agent'];
}
```

### Common Headers

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Content negotiation
  const accept = req.get('Accept');
  const acceptLang = req.get('Accept-Language');
  const acceptEnc = req.get('Accept-Encoding');
  
  // Authentication
  const auth = req.get('Authorization');
  const apiKey = req.get('X-API-Key');
  
  // Client info
  const userAgent = req.get('User-Agent');
  const referer = req.get('Referer');
  
  // Caching
  const ifNoneMatch = req.get('If-None-Match');
  const ifModifiedSince = req.get('If-Modified-Since');
}
```

## Cookies

### Reading Cookies

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Regular cookies
  const sessionId = req.cookies.sessionId;
  const userId = req.cookies.userId;
  
  // Signed cookies (automatically verified)
  const secureSession = req.signedCookies.session;
}
```

### Cookie Security

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Check for signed cookie
  if (req.signedCookies.auth) {
    // Cookie signature is valid
    const authToken = req.signedCookies.auth;
  } else if (req.cookies.auth) {
    // Cookie exists but signature is invalid
    throw new UnauthorizedException('Invalid cookie signature');
  }
}
```

## Query Parameters

### Simple Parameters

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // URL: /api/users?page=1&limit=10
  const page = req.queryParams.page;   // '1'
  const limit = req.queryParams.limit; // '10'
  
  // Raw query string
  console.log(req.query); // 'page=1&limit=10'
}
```

### Array Parameters

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // URL: /api/search?tags=javascript&tags=typescript&tags=nodejs
  const tags = req.queryParams.tags; // ['javascript', 'typescript', 'nodejs']
}
```

### Type Conversion

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  // Query parameters are always strings
  const page = parseInt(req.queryParams.page as string, 10) || 1;
  const limit = parseInt(req.queryParams.limit as string, 10) || 10;
  const active = req.queryParams.active === 'true';
}
```

## URL Information

### Full URL Components

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  console.log(req.protocol);    // 'https'
  console.log(req.hostname);    // 'example.com'
  console.log(req.path);        // '/api/users'
  console.log(req.url);         // '/api/users' (same as path)
  console.log(req.query);       // 'page=1&limit=10' (raw query string)
  console.log(req.queryParams); // { page: '1', limit: '10' } (parsed)
  console.log(req.originalUrl); // '/api/users?page=1&limit=10' (full URL)
}
```

### Constructing Full URL

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  const fullUrl = `${req.protocol}://${req.hostname}${req.originalUrl}`;
  console.log(fullUrl); // 'https://example.com/api/users?page=1&limit=10'
}
```

## Examples

### Authentication Check

```typescript
@Get('profile')
async getProfile(@Req() req: UwsRequest) {
  const token = req.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    throw new UnauthorizedException('No token provided');
  }
  
  const user = await this.authService.verifyToken(token);
  return user;
}
```

### Content Negotiation

```typescript
@Get('data')
async getData(@Req() req: UwsRequest, @Res() res: UwsResponse) {
  const data = await this.dataService.getData();
  
  const accept = req.accepts('json', 'xml', 'csv');
  
  switch (accept) {
    case 'json':
      return res.json(data);
    case 'xml':
      return res.type('xml').send(this.toXML(data));
    case 'csv':
      return res.type('csv').send(this.toCSV(data));
    default:
      return res.status(406).send('Not Acceptable');
  }
}
```

### IP-based Rate Limiting

```typescript
@Get()
async handler(@Req() req: UwsRequest) {
  const clientIp = req.ip;
  
  const isRateLimited = await this.rateLimiter.check(clientIp);
  
  if (isRateLimited) {
    throw new TooManyRequestsException('Rate limit exceeded');
  }
  
  return { message: 'Success' };
}
```

### Conditional Requests

```typescript
@Get('resource')
async getResource(@Req() req: UwsRequest, @Res() res: UwsResponse) {
  const resource = await this.resourceService.get();
  const etag = this.generateETag(resource);
  
  const ifNoneMatch = req.get('If-None-Match');
  
  if (ifNoneMatch === etag) {
    return res.status(304).send();
  }
  
  return res.setHeader('ETag', etag).json(resource);
}
```

### Language Detection

```typescript
@Get('content')
async getContent(@Req() req: UwsRequest) {
  const lang = req.acceptsLanguages('en', 'es', 'fr', 'de') || 'en';
  
  const content = await this.contentService.getByLanguage(lang);
  return content;
}
```

### Proxy Detection

```typescript
@Get()
handler(@Req() req: UwsRequest) {
  if (req.ips.length > 0) {
    console.log('Request came through proxies:', req.ips);
    console.log('Original client IP:', req.ips[0]);
  } else {
    console.log('Direct connection from:', req.ip);
  }
}
```

## See Also

- [Response](./Response.md) - HTTP Response object documentation
- [Server](./Server.md) - Server configuration and setup
- [Body Parsing](./Body-Parsing.md) - Detailed body parsing documentation
