/** Installed provider defaults for configuration surfaces. */

import type { Provider } from '@earendil-works/pi-ai'
import type { LlmConfigurableProvider } from '@deepseek-ai/dsh-llm'
import { OLLAMA_CLOUD_API_KEY_ENV, OLLAMA_CLOUD_BASE_URL, OLLAMA_CLOUD_ID } from './catalog.ts'
import { PROVIDER_DATA } from './provider-data.generated.ts'

type OverlayData = Pick<LlmConfigurableProvider, 'defaultBaseURL' | 'baseURLEnv'> & { env: readonly string[] }

/**
 * Hand-written display metadata for providers upstream pi-ai does not ship.
 * The generated file stays a pure projection of the installed catalog, so an
 * overlay route is declared here and merged at read time instead.
 */
const OVERLAY_DATA: Readonly<Partial<Record<string, OverlayData>>> = {
  [OLLAMA_CLOUD_ID]: { env: [OLLAMA_CLOUD_API_KEY_ENV], defaultBaseURL: OLLAMA_CLOUD_BASE_URL },
}

/**
 * Return generated display metadata without executing authentication. Overlay
 * routes resolve from the hand-written entry; every other provider resolves
 * from the generated catalog projection.
 * @param provider - Installed catalog provider, possibly from a newer consumer dependency.
 * @returns Known metadata, or only a fixed public endpoint for an unrecorded provider.
 */
export function providerDefaultsOf(provider: Provider): Pick<LlmConfigurableProvider, 'nativeAuth' | 'defaultBaseURL' | 'baseURLEnv'> {
  const data = OVERLAY_DATA[provider.id] ?? PROVIDER_DATA[provider.id]
  // A consumer can install a newer pi-ai within the dependency range. An
  // unrecorded provider remains configurable without guessed auth metadata.
  if (data === undefined) return provider.baseUrl && !provider.baseUrl.includes('{') ? { defaultBaseURL: provider.baseUrl } : {}
  const { env, ...endpoint } = data
  return { ...endpoint, nativeAuth: { env, oauth: provider.auth.oauth !== undefined } }
}
