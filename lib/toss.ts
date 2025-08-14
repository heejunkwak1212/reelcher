export function getTossClientKey() {
  return process.env.TOSS_CLIENT_KEY || ''
}

export async function requestPayment(body: any): Promise<void> {
  // Placeholder: client should use Toss Payments SDK. This module hosts shared helpers if needed later.
}


