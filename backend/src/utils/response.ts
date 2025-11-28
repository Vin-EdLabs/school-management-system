export function success(data: any) {
  return { error: false, data };
}

export function failure(message: string, details?: any) {
  return { error: true, message, details };
}
