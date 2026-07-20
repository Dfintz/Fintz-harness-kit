// Manual mock for axios
export const mockInterceptors = {
  request: { use: jest.fn() },
  response: { use: jest.fn() },
};

export const mockAxiosInstance = {
  interceptors: mockInterceptors,
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  request: jest.fn(),
  head: jest.fn(),
  options: jest.fn(),
};

export const mockAxios: any = jest.fn(() => mockAxiosInstance);
mockAxios.create = jest.fn(() => mockAxiosInstance);
mockAxios.interceptors = mockInterceptors;
mockAxios.get = jest.fn();
mockAxios.post = jest.fn();
mockAxios.put = jest.fn();
mockAxios.patch = jest.fn();
mockAxios.delete = jest.fn();
mockAxios.request = jest.fn();
mockAxios.head = jest.fn();
mockAxios.options = jest.fn();
