import { ApiResponse } from '../interfaces/api-response.interface';

export class ApiResponseDto<T = any> implements ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;
  path: string;

  constructor(
    statusCode: number,
    message: string,
    data?: T,
    path?: string,
  ) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
    this.path = path || '';
  }

  static success<T>(
    message: string,
    data?: T,
    statusCode: number = 200,
  ): ApiResponseDto<T> {
    return new ApiResponseDto(statusCode, message, data);
  }

  static error(
    message: string,
    statusCode: number = 500,
    error?: any,
  ): ApiResponseDto {
    const response = new ApiResponseDto(statusCode, message);
    if (error) {
      response.data = { error };
    }
    return response;
  }
}
