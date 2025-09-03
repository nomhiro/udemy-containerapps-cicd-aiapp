import { SWRConfiguration } from 'swr'

export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  shouldRetryOnError: (err) => {
    // validation_error 等クライアント起因はリトライ不要
    return !(err?.detail?.type === 'validation_error')
  }
}
