export class ConflictError extends Error {
  details: any;
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ConflictError';
    this.details = details;
  }
}

export default ConflictError;
