export function defaultCsp() {
  return {
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://js.tosspayments.com; style-src 'self' 'unsafe-inline'; connect-src *;",
  }
}


