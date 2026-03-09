import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiResponseDto, ErrorResponseDto } from '../dto/api-response.dto';

/**
 * Decorator for successful response with data
 */
export const ApiSuccessResponse = <TModel extends Type<any>>(
  model: TModel,
  statusCode = 200,
  description = 'Successful',
) => {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status: statusCode,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              success: { example: true },
              statusCode: { example: statusCode },
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Decorator for successful response with array data
 */
export const ApiSuccessArrayResponse = <TModel extends Type<any>>(
  model: TModel,
  statusCode = 200,
  description = 'Successful',
) => {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status: statusCode,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              success: { example: true },
              statusCode: { example: statusCode },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Decorator for paginated response
 */
export const ApiPaginatedResponse = <TModel extends Type<any>>(
  model: TModel,
  description = 'Paginated response',
) => {
  return applyDecorators(
    ApiExtraModels(ApiResponseDto, model),
    ApiResponse({
      status: 200,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseDto) },
          {
            properties: {
              success: { example: true },
              statusCode: { example: 200 },
              data: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      total: { type: 'number', example: 100 },
                      page: { type: 'number', example: 1 },
                      limit: { type: 'number', example: 10 },
                      totalPages: { type: 'number', example: 10 },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Common error responses
 */
export const ApiBadRequestResponse = (description = 'Bad Request') => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: 400,
      description,
      schema: {
        $ref: getSchemaPath(ErrorResponseDto),
      },
    }),
  );
};

export const ApiUnauthorizedResponse = (description = 'Unauthorized') => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: 401,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponseDto) },
          {
            properties: {
              statusCode: { example: 401 },
              message: { example: 'Unauthorized' },
            },
          },
        ],
      },
    }),
  );
};

export const ApiForbiddenResponse = (description = 'Forbidden') => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: 403,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponseDto) },
          {
            properties: {
              statusCode: { example: 403 },
              message: { example: 'Forbidden resource' },
            },
          },
        ],
      },
    }),
  );
};

export const ApiNotFoundResponse = (description = 'Not Found') => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: 404,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponseDto) },
          {
            properties: {
              statusCode: { example: 404 },
              message: { example: 'Record not found' },
            },
          },
        ],
      },
    }),
  );
};

export const ApiConflictResponse = (description = 'Conflict') => {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ApiResponse({
      status: 409,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ErrorResponseDto) },
          {
            properties: {
              statusCode: { example: 409 },
              message: { example: 'A record with this value already exists' },
            },
          },
        ],
      },
    }),
  );
};
