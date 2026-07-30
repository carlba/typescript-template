/**
 * This class represents an API error that should be used when throwing from services. It should then be converted to a proper response based on the
 * consumer. The statuscode is loosly based on HTTP status codes since that is a known standard.
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, options: ErrorOptions & { statusCode: number }) {
    const { statusCode, ...errorOptions } = options;
    super(message, errorOptions);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}
