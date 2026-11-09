// Raised for bad client input; the HTTP layer turns it into a 400 response.
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

module.exports = { ValidationError };
