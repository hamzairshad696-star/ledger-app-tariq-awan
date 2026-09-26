export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (msg, d) => new ApiError(400, msg, d);
export const notFound = (msg = 'Record not found.') => new ApiError(404, msg);
export const forbidden = (msg = 'You do not have permission to do that.') => new ApiError(403, msg);
export const unauthorized = (msg = 'Please sign in to continue.') => new ApiError(401, msg);
export const conflict = (msg) => new ApiError(409, msg);
