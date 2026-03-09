export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  timestamp: string;
  path: string;
}

export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error?: string;
  errors?: any[];
  timestamp: string;
  path: string;
}
