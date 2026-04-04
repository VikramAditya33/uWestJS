/**
 * Base WebSocket execution context
 * Shared structure for guards, filters, and other middleware
 *
 * @template TInstance - Type of the gateway instance (default: object)
 * @template TClient - Type of the WebSocket client (default: unknown)
 * @template TData - Type of the message data (default: unknown)
 *
 * @example
 * ```typescript
 * // Generic usage (backward compatible)
 * const ctx: WsContext = { instance, methodName, client, data };
 *
 * // Specific usage with type parameters
 * interface MyGateway {
 *   handleMessage(data: string): void;
 * }
 * type MyContext = WsContext<MyGateway, WebSocket, MessagePayload>;
 * ```
 */
export interface WsContext<TInstance = object, TClient = unknown, TData = unknown> {
  /**
   * The gateway instance
   */
  instance: TInstance;

  /**
   * The method name being executed
   */
  methodName: string;

  /**
   * The WebSocket client
   */
  client: TClient;

  /**
   * The message data
   */
  data: TData;
}
