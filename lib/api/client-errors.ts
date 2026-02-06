import { ApiClientError } from '@/lib/api/client';

export function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (isViewOnlyAccessError(error)) {
      return 'You have view-only access for this vehicle.';
    }
    return error.message;
  }

  if (error instanceof Error) {
    if (error.message === 'Not found') {
      return 'You have view-only access for this vehicle.';
    }
    return error.message;
  }

  return fallback;
}

function isViewOnlyAccessError(error: ApiClientError): boolean {
  return (
    error.code === 'FORBIDDEN' ||
    error.code === 'NOT_FOUND' ||
    error.status === 403 ||
    error.status === 404
  );
}
