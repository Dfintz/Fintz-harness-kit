import {
  RequestBuilder,
  PaginationRequestBuilder,
  CreateRequestBuilder,
  UpdateRequestBuilder,
  DeleteRequestBuilder,
} from '@/services/builders/RequestBuilder';

describe('RequestBuilder', () => {
  describe('Basic RequestBuilder', () => {
    it('should build a basic GET request', () => {
      const builder = new RequestBuilder();
      const config = builder
        .setUrl('/fleets')
        .setMethod('GET')
        .build();

      expect(config.url).toBe('/fleets');
      expect(config.method).toBe('GET');
    });

    it('should add query parameters', () => {
      const builder = new RequestBuilder();
      const config = builder
        .setUrl('/fleets')
        .addQueryParam('page', 1)
        .addQueryParam('limit', 20)
        .build();

      expect(config.params).toEqual({ page: 1, limit: 20 });
    });

    it('should throw error if URL is not set', () => {
      const builder = new RequestBuilder();
      expect(() => builder.build()).toThrow('URL is required');
    });
  });

  describe('PaginationRequestBuilder', () => {
    it('should build a paginated request', () => {
      const builder = new PaginationRequestBuilder('/fleets');
      const config = builder
        .setPage(2)
        .setLimit(50)
        .build();

      expect(config.url).toBe('/fleets');
      expect(config.method).toBe('GET');
      expect(config.params).toEqual({ page: 2, limit: 50 });
    });

    it('should validate page number', () => {
      const builder = new PaginationRequestBuilder('/fleets');
      expect(() => builder.setPage(0).build()).toThrow('Page must be >= 1');
    });

    it('should validate limit upper bound', () => {
      const builder = new PaginationRequestBuilder('/fleets');
      expect(() => builder.setLimit(101).build()).toThrow('Limit must be <= 100');
    });
  });

  describe('CreateRequestBuilder', () => {
    it('should build a create request', () => {
      const builder = new CreateRequestBuilder('/fleets');
      const config = builder.setData({ name: 'Test' }).build();

      expect(config.url).toBe('/fleets');
      expect(config.method).toBe('POST');
      expect(config.data).toEqual({ name: 'Test' });
    });
  });

  describe('UpdateRequestBuilder', () => {
    it('should build a PUT request by default', () => {
      const builder = new UpdateRequestBuilder('/fleets/123');
      const config = builder.setData({ name: 'Updated' }).build();

      expect(config.method).toBe('PUT');
    });

    it('should switch to PATCH for partial updates', () => {
      const builder = new UpdateRequestBuilder('/fleets/123');
      const config = builder.partial().build();

      expect(config.method).toBe('PATCH');
    });
  });

  describe('DeleteRequestBuilder', () => {
    it('should build a DELETE request', () => {
      const builder = new DeleteRequestBuilder('/fleets/123');
      const config = builder.build();

      expect(config.url).toBe('/fleets/123');
      expect(config.method).toBe('DELETE');
    });
  });
});
