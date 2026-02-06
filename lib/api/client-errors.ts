import { ApiClientError } from '@/lib/api/client';

const VIEW_ONLY_MESSAGE = 'You have view-only access for this vehicle.';
const UNAUTHORIZED_MESSAGE = 'Please sign in to continue.';
const FORBIDDEN_MESSAGE = "You don't have permission to perform this action.";

export function getUiErrorMessage(error: unknown, fallback: string): string {
  const vehicleContext = isVehicleContext(fallback);

  if (error instanceof ApiClientError) {
    if (vehicleContext && isViewOnlyAccessError(error)) {
      return VIEW_ONLY_MESSAGE;
    }
    if (isUnauthorizedError(error)) {
      return UNAUTHORIZED_MESSAGE;
    }
    if (isForbiddenError(error)) {
      return FORBIDDEN_MESSAGE;
    }
    return error.message;
  }

  if (error instanceof Error) {
    if (vehicleContext && isNotFoundMessage(error.message)) {
      return VIEW_ONLY_MESSAGE;
    }
    if (isUnauthorizedMessage(error.message)) {
      return UNAUTHORIZED_MESSAGE;
    }
    if (isForbiddenMessage(error.message)) {
      return FORBIDDEN_MESSAGE;
    }
    return error.message;
  }

  return fallback;
}

export function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError && isViewOnlyAccessError(error)) {
    return VIEW_ONLY_MESSAGE;
  }
  if (error instanceof Error && isNotFoundMessage(error.message)) {
    return VIEW_ONLY_MESSAGE;
  }
  return getUiErrorMessage(error, fallback);
}

function isVehicleContext(fallback: string): boolean {
  return /vehicle|fill-up|expense|tire|odometer|inspection/i.test(fallback);
}

function isViewOnlyAccessError(error: ApiClientError): boolean {
  return (
    error.code === 'FORBIDDEN' ||
    error.code === 'NOT_FOUND' ||
    error.status === 403 ||
    error.status === 404
  );
}

function isUnauthorizedError(error: ApiClientError): boolean {
  return (
    error.code === 'UNAUTHORIZED' || error.status === 401 || isUnauthorizedMessage(error.message)
  );
}

function isForbiddenError(error: ApiClientError): boolean {
  return error.code === 'FORBIDDEN' || error.status === 403 || isForbiddenMessage(error.message);
}

function isNotFoundMessage(message?: string): boolean {
  return message?.trim().toLowerCase() === 'not found';
}

function isUnauthorizedMessage(message?: string): boolean {
  return message?.trim().toLowerCase() === 'unauthorized';
}

function isForbiddenMessage(message?: string): boolean {
  return message?.trim().toLowerCase() === 'forbidden';
}
