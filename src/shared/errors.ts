export class AppError extends Error {
  constructor(public code: string, message: string, public status: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message = '未登录或登录已过期') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = '无权操作') {
    super('FORBIDDEN', message, 403);
  }
}

export class BusinessError extends AppError {
  constructor(message: string, code = 'BUSINESS_ERROR') {
    super(code, message, 400);
  }
}
