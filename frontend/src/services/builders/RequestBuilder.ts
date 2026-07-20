import type { AxiosRequestConfig } from 'axios';

/**
 * Extended Axios request config with retry flag
 * Note: This is compatible with the ExtendedAxiosRequestConfig in apiClient.ts
 * which also includes __retryCount. We only need __skipRetry here.
 */
interface ExtendedAxiosRequestConfig extends AxiosRequestConfig {
  __skipRetry?: boolean;
  __retryCount?: number;
}

/**
 * Request Builder Pattern for API Client
 * 
 * Provides a fluent interface for building API requests with type safety
 * and validation. Use this pattern for complex requests or when you need
 * to build requests incrementally.
 * 
 * @example
 * const request = new RequestBuilder()
 *   .setUrl('/fleets')
 *   .setMethod('GET')
 *   .addQueryParam('page', 1)
 *   .addQueryParam('limit', 20)
 *   .addHeader('X-Custom', 'value')
 *   .setTimeout(5000)
 *   .build();
 */
export class RequestBuilder {
  private url?: string;
  private method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET';
  private data?: unknown;
  private queryParams: Record<string, string | number | boolean> = {};
  private headers: Record<string, string> = {};
  private timeout?: number;
  private skipRetry = false;

  /**
   * Set the request URL
   */
  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  /**
   * Set the HTTP method
   */
  setMethod(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): this {
    this.method = method;
    return this;
  }

  /**
   * Set the request body data (for POST, PUT, PATCH)
   */
  setData(data: unknown): this {
    this.data = data;
    return this;
  }

  /**
   * Add a single query parameter
   */
  addQueryParam(key: string, value: string | number | boolean): this {
    this.queryParams[key] = value;
    return this;
  }

  /**
   * Add multiple query parameters at once
   */
  addQueryParams(params: Record<string, string | number | boolean>): this {
    Object.assign(this.queryParams, params);
    return this;
  }

  /**
   * Add a single header
   */
  addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  /**
   * Add multiple headers at once
   */
  addHeaders(headers: Record<string, string>): this {
    Object.assign(this.headers, headers);
    return this;
  }

  /**
   * Set request timeout in milliseconds
   */
  setTimeout(timeout: number): this {
    if (!Number.isFinite(timeout)) {
      throw new Error('Timeout must be a finite number (not NaN or Infinity)');
    }
    if (timeout <= 0) {
      throw new Error('Timeout must be greater than 0 milliseconds');
    }
    const MAX_TIMEOUT_MS = 300000; // 5 minutes
    if (timeout > MAX_TIMEOUT_MS) {
      throw new Error(`Timeout must not exceed ${MAX_TIMEOUT_MS} milliseconds (5 minutes)`);
    }
    this.timeout = timeout;
    return this;
  }

  /**
   * Disable automatic retry for this request
   */
  disableRetry(): this {
    this.skipRetry = true;
    return this;
  }

  /**
   * Build and return the Axios request configuration
   */
  build(): ExtendedAxiosRequestConfig & { url: string; method: string } {
    if (!this.url) {
      throw new Error('URL is required');
    }

    const config: ExtendedAxiosRequestConfig = {
      url: this.url,
      method: this.method,
      headers: Object.keys(this.headers).length > 0 ? this.headers : undefined,
      timeout: this.timeout,
    };

    // Add query params
    if (Object.keys(this.queryParams).length > 0) {
      config.params = this.queryParams;
    }

    // Add data for POST, PUT, PATCH requests (and DELETE if specified)
    // Note: While DELETE typically doesn't have a body, some APIs support it
    if (this.data && this.method !== 'GET') {
      config.data = this.data;
    }

    // Add skip retry flag
    if (this.skipRetry) {
      config.__skipRetry = true;
    }

    return config as ExtendedAxiosRequestConfig & { url: string; method: string };
  }

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.url = undefined;
    this.method = 'GET';
    this.data = undefined;
    this.queryParams = {};
    this.headers = {};
    this.timeout = undefined;
    this.skipRetry = false;
    return this;
  }
}

/**
 * Pagination Request Builder
 * 
 * Specialized builder for paginated requests
 * 
 * @example
 * const request = new PaginationRequestBuilder('/fleets')
 *   .setPage(2)
 *   .setLimit(50)
 *   .setSearch('alpha')
 *   .setSortBy('name')
 *   .setSortOrder('asc')
 *   .build();
 */
export class PaginationRequestBuilder extends RequestBuilder {
  constructor(url: string) {
    super();
    this.setUrl(url);
    this.setMethod('GET');
  }

  /**
   * Set page number (1-based)
   */
  setPage(page: number): this {
    if (page < 1) {
      throw new Error('Page must be >= 1');
    }
    this.addQueryParam('page', page);
    return this;
  }

  /**
   * Set items per page
   */
  setLimit(limit: number): this {
    if (limit < 1) {
      throw new Error('Limit must be >= 1');
    }
    if (limit > 100) {
      throw new Error('Limit must be <= 100');
    }
    this.addQueryParam('limit', limit);
    return this;
  }

  /**
   * Set search term
   */
  setSearch(search: string): this {
    if (search) {
      this.addQueryParam('search', search);
    }
    return this;
  }

  /**
   * Set sort field
   */
  setSortBy(field: string): this {
    if (field) {
      this.addQueryParam('sortBy', field);
    }
    return this;
  }

  /**
   * Set sort order
   */
  setSortOrder(order: 'asc' | 'desc'): this {
    this.addQueryParam('sortOrder', order);
    return this;
  }

  /**
   * Add a filter parameter
   */
  addFilter(key: string, value: string | number | boolean): this {
    this.addQueryParam(key, value);
    return this;
  }
}

/**
 * Create Request Builder
 * 
 * Specialized builder for POST/create requests
 * 
 * @example
 * const request = new CreateRequestBuilder<FleetCreateInput>('/fleets')
 *   .setData({ name: 'New Fleet', organizationId: 'org-123' })
 *   .addHeader('X-Idempotency-Key', 'unique-key')
 *   .build();
 */
export class CreateRequestBuilder<T = unknown> extends RequestBuilder {
  constructor(url: string) {
    super();
    this.setUrl(url);
    this.setMethod('POST');
  }

  /**
   * Set the request body data with type safety
   */
  override setData(data: T): this {
    return super.setData(data);
  }

  /**
   * Add idempotency key to prevent duplicate creates
   */
  setIdempotencyKey(key: string): this {
    this.addHeader('X-Idempotency-Key', key);
    return this;
  }
}

/**
 * Update Request Builder
 * 
 * Specialized builder for PUT/PATCH/update requests
 * 
 * @example
 * const request = new UpdateRequestBuilder<Partial<Fleet>>('/fleets/123')
 *   .setMethod('PATCH')
 *   .setData({ name: 'Updated Name' })
 *   .build();
 */
export class UpdateRequestBuilder<T = unknown> extends RequestBuilder {
  constructor(url: string) {
    super();
    this.setUrl(url);
    this.setMethod('PUT');
  }

  /**
   * Set the request body data with type safety
   */
  override setData(data: T): this {
    return super.setData(data);
  }

  /**
   * Set to PATCH method for partial updates
   */
  partial(): this {
    this.setMethod('PATCH');
    return this;
  }

  /**
   * Set to PUT method for full updates
   */
  full(): this {
    this.setMethod('PUT');
    return this;
  }

  /**
   * Add If-Match header for optimistic locking
   */
  setETag(etag: string): this {
    this.addHeader('If-Match', etag);
    return this;
  }
}

/**
 * Delete Request Builder
 * 
 * Specialized builder for DELETE requests
 * 
 * @example
 * const request = new DeleteRequestBuilder('/fleets/123')
 *   .setForce(true)
 *   .build();
 */
export class DeleteRequestBuilder extends RequestBuilder {
  constructor(url: string) {
    super();
    this.setUrl(url);
    this.setMethod('DELETE');
  }

  /**
   * Add force delete flag
   */
  setForce(force: boolean): this {
    if (force) {
      this.addQueryParam('force', true);
    }
    return this;
  }

  /**
   * Add soft delete flag
   */
  setSoft(soft: boolean): this {
    if (soft) {
      this.addQueryParam('soft', true);
    }
    return this;
  }
}
