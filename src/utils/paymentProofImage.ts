import { apiService } from '@/services/api';

export function isPaymentProofApiUrl(url: string): boolean {
  return /\/payment-submissions\/\d+\/screenshot(?:\?|$)/.test(url);
}

export async function resolvePaymentProofImageUrl(screenshotUrl: string): Promise<string> {
  if (!screenshotUrl) return '';
  if (screenshotUrl.startsWith('data:') || screenshotUrl.startsWith('blob:')) {
    return screenshotUrl;
  }
  if (screenshotUrl.startsWith('http') && !isPaymentProofApiUrl(screenshotUrl)) {
    return screenshotUrl;
  }

  const endpoint = screenshotUrl.includes('/api/')
    ? screenshotUrl.slice(screenshotUrl.indexOf('/api/') + 4)
    : screenshotUrl.startsWith('/payment-submissions/')
      ? screenshotUrl
      : screenshotUrl;

  const blob = await apiService.getBlob(endpoint);
  return URL.createObjectURL(blob);
}
