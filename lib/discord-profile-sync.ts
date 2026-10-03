import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function getEncryptionKey() {
  const secret = process.env.DISCORD_TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('Discord token encryption is not configured')
  return createHash('sha256').update(secret).digest()
}

export function encryptDiscordRefreshToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptDiscordRefreshToken(value: string) {
  const [encodedIv, encodedTag, encodedData] = value.split('.')
  if (!encodedIv || !encodedTag || !encodedData) throw new Error('Invalid encrypted Discord token')
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(encodedIv, 'base64url'))
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function discordProfileFromUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  const displayName = (user.global_name || user.username || '').trim().slice(0, 24)
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
    : null
  return { displayName, avatarUrl }
}

export async function getDiscordUser(accessToken: string) {
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Discord profile request failed (${response.status})`)
  return response.json() as Promise<{ id: string; username: string; global_name?: string | null; avatar?: string | null }>
}

export async function refreshDiscordAccessToken(refreshToken: string) {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Discord OAuth is not configured')

  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Discord token refresh failed (${response.status})`)
  return response.json() as Promise<{ access_token: string; refresh_token?: string }>
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin')
  return origin === new URL(request.url).origin
}

export function isDiscordRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
}

export function syncProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  const { displayName, avatarUrl } = discordProfileFromUser(user)
  return {
    ...(displayName.length >= 2 ? { display_name: displayName } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }
}

export function isDiscordUser(value: unknown): value is { id: string; username: string; global_name?: string | null; avatar?: string | null } {
  if (!value || typeof value !== 'object') return false
  const user = value as Record<string, unknown>
  return typeof user.id === 'string' && typeof user.username === 'string'
}

export function encryptedTokenRecord(userId: string, refreshToken: string) {
  return {
    user_id: userId,
    encrypted_refresh_token: encryptDiscordRefreshToken(refreshToken),
    enabled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function discordErrorResponseMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Discord sync failed'
}

export function parseDiscordRefreshResult(value: unknown): value is { access_token: string; refresh_token?: string } {
  if (!value || typeof value !== 'object') return false
  const tokenResult = value as Record<string, unknown>
  return typeof tokenResult.access_token === 'string'
}

export function safeDiscordProfilePatch(value: unknown) {
  return isDiscordUser(value) ? syncProfilePatch(value) : null
}

export function getDiscordAvatarUrl(user: { id: string; avatar?: string | null }) {
  return discordProfileFromUser({ ...user, username: '' }).avatarUrl
}

export function tokenWasRevoked(error: unknown) {
  return error instanceof Error && /401|403|invalid_grant/i.test(error.message)
}

export function toEncryptedRefreshToken(refreshToken: string) {
  return encryptDiscordRefreshToken(refreshToken)
}

export function fromEncryptedRefreshToken(encrypted: string) {
  return decryptDiscordRefreshToken(encrypted)
}

export function makeDiscordOauthRedirect(state: string) {
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify')
  return url.toString()
}

export function discordSyncEnabledAt() {
  return new Date().toISOString()
}

export function getDiscordProfileLabel(user: { username: string; global_name?: string | null }) {
  return (user.global_name || user.username).trim().slice(0, 24)
}

export function discordProfileFields(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return syncProfilePatch(user)
}

export function makeDiscordProfileUrl(userId: string) {
  return `https://discord.com/users/${encodeURIComponent(userId)}`
}

export function hasDiscordOAuthConfiguration() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
}

export function getDiscordOAuthClientCredentials() {
  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Discord OAuth is not configured')
  return { clientId, clientSecret }
}

export function hasDiscordTokenEncryption() {
  return Boolean(process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function hasCronAuthorization() {
  return Boolean(process.env.CRON_SECRET)
}

export function normalizeDiscordName(value: string) {
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 24)
}

export function getDiscordAvatarExtension(avatar: string) {
  return avatar.startsWith('a_') ? 'gif' : 'png'
}

export function getDiscordApiAvatarUrl(user: { id: string; avatar?: string | null }) {
  if (!user.avatar) return null
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.${getDiscordAvatarExtension(user.avatar)}?size=256`
}

export function getDiscordProfileUpdate(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  const displayName = normalizeDiscordName(user.global_name || user.username)
  const avatarUrl = getDiscordApiAvatarUrl(user)
  return {
    ...(displayName.length >= 2 ? { display_name: displayName } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }
}

export function getDiscordTokenEncryptionKey() {
  return getEncryptionKey()
}

export function encryptToken(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function decryptToken(value: string) {
  return decryptDiscordRefreshToken(value)
}

export function isSameOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function createDiscordSyncRecord(userId: string, refreshToken: string) {
  return encryptedTokenRecord(userId, refreshToken)
}

export function makeDiscordAvatarUrl(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function getDiscordProfileUpdateValues(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function createDiscordOauthUrl(redirectUri: string) {
  return makeDiscordOauthRedirect(redirectUri)
}

export function discordProviderError(error: unknown) {
  return discordErrorResponseMessage(error)
}

export function normalizeDiscordProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return {
    display_name: normalizeDiscordName(user.global_name || user.username),
    avatar_url: getDiscordApiAvatarUrl(user),
  }
}

export function isValidDiscordProfile(value: unknown) {
  return isDiscordUser(value)
}

export function canSyncDiscordProfile() {
  return hasDiscordOAuthConfiguration() && hasDiscordTokenEncryption()
}

export function getDiscordOAuthEnvironment() {
  return {
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    encryptionKey: process.env.DISCORD_TOKEN_ENCRYPTION_KEY,
  }
}

export function getDiscordProfileIconUrl(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function isValidDiscordRefreshToken(value: unknown): value is string {
  return isDiscordRefreshToken(value)
}

export function getDiscordUsername(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function makeDiscordRefreshUrl() {
  return 'https://discord.com/api/v10/oauth2/token'
}

export function makeDiscordCurrentUserUrl() {
  return 'https://discord.com/api/v10/users/@me'
}

export function makeDiscordAuthHeader(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export function makeDiscordRefreshRequest(refreshToken: string) {
  const { clientId, clientSecret } = getDiscordOAuthClientCredentials()
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
  } as const
}

export function getDiscordRefreshToken(value: unknown) {
  return parseDiscordRefreshResult(value) ? value.refresh_token : undefined
}

export function getDiscordAccessToken(value: unknown) {
  return parseDiscordRefreshResult(value) ? value.access_token : undefined
}

export function getDiscordNameFromProfile(user: { username: string; global_name?: string | null }) {
  return getDiscordProfileLabel(user)
}

export function discordIdentityMatches(user: { id: string }, identityId: string) {
  return user.id === identityId
}

export function getEncryptedTokenFromRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.encrypted_refresh_token === 'string' ? record.encrypted_refresh_token : null
}

export function getUserIdFromRecord(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.user_id === 'string' ? record.user_id : null
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function safeDiscordError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 200) : 'Discord sync failed'
}

export function getDiscordTokenFromSession(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function discordSyncStatusEnabled(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

export function makeDiscordIdentityRedirect(origin: string) {
  return `${origin}/auth/callback?${new URLSearchParams({ next: '/account', link_provider: 'discord', enable_discord_sync: '1' })}`
}

export function discordSyncRecordUpdatedAt() {
  return new Date().toISOString()
}

export function safeDiscordAvatarUrl(value: unknown) {
  return typeof value === 'string' && value.startsWith('https://cdn.discordapp.com/avatars/') ? value : null
}

export function getDiscordOAuthScopes() {
  return 'identify'
}

export function getDiscordContentType() {
  return 'application/x-www-form-urlencoded'
}

export function isValidDiscordName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2 && value.trim().length <= 24
}

export function getDiscordUserIdentity(user: { username: string; global_name?: string | null; id: string; avatar?: string | null }) {
  return { id: user.id, display_name: getDiscordProfileLabel(user), avatar_url: getDiscordApiAvatarUrl(user) }
}

export function encodeDiscordToken(iv: Buffer, tag: Buffer, encrypted: Buffer) {
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decodeDiscordToken(value: string) {
  const [iv, tag, encrypted] = value.split('.')
  return { iv: Buffer.from(iv ?? '', 'base64url'), tag: Buffer.from(tag ?? '', 'base64url'), encrypted: Buffer.from(encrypted ?? '', 'base64url') }
}

export function isValidOauthCode(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
}

export function discordProfileFieldsFromIdentity(identityData: Record<string, unknown>) {
  const name = identityData.global_name ?? identityData.full_name ?? identityData.name ?? identityData.username
  const avatar = identityData.avatar_url ?? identityData.picture
  return {
    ...(typeof name === 'string' && name.trim().length >= 2 ? { display_name: name.trim().slice(0, 24) } : {}),
    ...(typeof avatar === 'string' && avatar.startsWith('https://') ? { avatar_url: avatar } : {}),
  }
}

export function discordTokenRecord(userId: string, refreshToken: string) {
  return {
    user_id: userId,
    encrypted_refresh_token: encryptDiscordRefreshToken(refreshToken),
    enabled_at: discordSyncEnabledAt(),
    updated_at: discordSyncRecordUpdatedAt(),
  }
}

export function profileUpdatesAreEmpty(update: Record<string, unknown>) {
  return Object.keys(update).length === 0
}

export function isValidDiscordTokenResponse(value: unknown): value is { access_token: string; refresh_token?: string } {
  return parseDiscordRefreshResult(value)
}

export function getDiscordTokenRefreshValue(value: unknown) {
  return getDiscordRefreshToken(value)
}

export function extractDiscordAccessToken(value: unknown) {
  return getDiscordAccessToken(value)
}

export function isDiscordTokenExpired(error: unknown) {
  return tokenWasRevoked(error)
}

export function getDiscordSyncCronSecret() {
  return process.env.CRON_SECRET
}

export function createDiscordSyncTokenRecord(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function discordProfileName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function makeDiscordOauthRedirectToAccount(origin: string) {
  return makeDiscordIdentityRedirect(origin)
}

export function getDiscordProfileAvatar(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function refreshTokenFromProviderSession(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function isDiscordLinkEnabled(identities: Array<{ provider?: string }> | null | undefined) {
  return Boolean(identities?.some((identity) => identity.provider === 'discord'))
}

export function sameOriginRequest(request: Request) {
  return isSameOriginRequest(request)
}

export function makeDiscordUserApiUrl() {
  return 'https://discord.com/api/v10/users/@me'
}

export function serializeDiscordRefreshToken(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function deserializeDiscordRefreshToken(value: string) {
  return decryptDiscordRefreshToken(value)
}

export function isDiscordSyncReady() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function isValidDiscordIdentityData(value: unknown) {
  return isDiscordUser(value)
}

export function getDiscordProfileSyncColumns(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function isAllowedDiscordAvatarUrl(value: string | null) {
  return !value || value.startsWith('https://cdn.discordapp.com/avatars/')
}

export function refreshDiscordToken(refreshToken: string) {
  return refreshDiscordAccessToken(refreshToken)
}

export function getDiscordUserProfile(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function getProfileUpdateFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function setDiscordTokenEncryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest()
}

export function discordProfileSyncEnabled(recordExists: boolean) {
  return recordExists
}

export function safeDiscordAvatar(value: string | null | undefined) {
  return value && value.startsWith('https://cdn.discordapp.com/avatars/') ? value : null
}

export function isDiscordOauthConfigured() {
  return hasDiscordOAuthConfiguration()
}

export function isDiscordEncryptionConfigured() {
  return hasDiscordTokenEncryption()
}

export function getDiscordRefreshBody(refreshToken: string) {
  return makeDiscordRefreshRequest(refreshToken).body
}

export function makeDiscordBearerHeader(accessToken: string) {
  return makeDiscordAuthHeader(accessToken)
}

export function isDiscordSyncOriginAllowed(request: Request) {
  return isSameOriginRequest(request)
}

export function cleanDiscordDisplayName(name: string) {
  return normalizeDiscordName(name)
}

export function discordProfileUpdateFromApi(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function isDiscordUserResponse(value: unknown) {
  return isDiscordUser(value)
}

export function currentDiscordRefreshToken(value: unknown) {
  return isDiscordRefreshToken(value) ? value : null
}

export function discordSyncConfigured() {
  return canSyncDiscordProfile()
}

export function makeDiscordSyncOauthUrl(redirectUri: string) {
  return createDiscordOauthUrl(redirectUri)
}

export function safelyGetDiscordRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return getDiscordTokenFromSession(session)
}

export function discordProfileTablePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function getDiscordAvatarForUser(user: { id: string; avatar?: string | null }) {
  return getDiscordAvatarUrl(user)
}

export function discordTokensAreConfigured() {
  return hasDiscordOAuthConfiguration() && hasDiscordTokenEncryption()
}

export function getDiscordIdentityLabel(user: { username: string; global_name?: string | null }) {
  return getDiscordProfileLabel(user)
}

export function getDiscordTokenEncryptionSecret() {
  return process.env.DISCORD_TOKEN_ENCRYPTION_KEY
}

export function getDiscordOAuthCredentials() {
  return getDiscordOAuthClientCredentials()
}

export function hasDiscordAppCredentials() {
  return hasDiscordOAuthConfiguration()
}

export function parseDiscordUser(value: unknown) {
  return isDiscordUser(value) ? value : null
}

export function formatDiscordAvatarUrl(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function makeDiscordRefreshRequestBody(refreshToken: string) {
  return makeDiscordRefreshRequest(refreshToken).body
}

export function makeDiscordProfileRequestHeaders(accessToken: string) {
  return makeDiscordAuthHeader(accessToken)
}

export function discordTokenIsValid(value: unknown): value is string {
  return isDiscordRefreshToken(value)
}

export function getDiscordProfileLabelFromIdentity(identity: { identity_data?: Record<string, unknown> | null }) {
  const data = identity.identity_data ?? {}
  const name = data.global_name ?? data.full_name ?? data.name ?? data.username
  return typeof name === 'string' ? normalizeDiscordName(name) : ''
}

export function getDiscordAvatarFromIdentity(identity: { identity_data?: Record<string, unknown> | null }) {
  const data = identity.identity_data ?? {}
  const avatar = data.avatar_url ?? data.picture
  return typeof avatar === 'string' && avatar.startsWith('https://') ? avatar : null
}

export function discordOauthCredentialsAvailable() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET)
}

export function discordEncryptionSecretAvailable() {
  return Boolean(process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function discordCronSecretAvailable() {
  return Boolean(process.env.CRON_SECRET)
}

export function verifyDiscordCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

export function discordProfileUpdatePayload(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function discordSyncTokenRow(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function makeDiscordProfileFetch(accessToken: string) {
  return fetch('https://discord.com/api/v10/users/@me', {
    headers: makeDiscordAuthHeader(accessToken),
    cache: 'no-store',
  })
}

export function discordSyncOAuthRefresh(refreshToken: string) {
  return fetch('https://discord.com/api/v10/oauth2/token', {
    ...makeDiscordRefreshRequest(refreshToken),
    cache: 'no-store',
  })
}

export function discordSyncAvatar(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function isProviderIdentityLinked(user: { identities?: Array<{ provider?: string }> | null }) {
  return isDiscordLinkEnabled(user.identities)
}

export function makeDiscordSyncCallbackUrl(origin: string) {
  return makeDiscordIdentityRedirect(origin)
}

export function enabledDiscordSyncRecord(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function nowIso() {
  return new Date().toISOString()
}

export function getDiscordRefreshTokenFromSession(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function validDiscordRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeDiscordAvatarUrl(user: { id: string; avatar?: string | null }) {
  return getDiscordApiAvatarUrl(user)
}

export function makeDiscordUserProfileUrl() {
  return 'https://discord.com/api/v10/users/@me'
}

export function makeDiscordTokenUrl() {
  return 'https://discord.com/api/v10/oauth2/token'
}

export function discordProfileMetadata(user: { username: string; global_name?: string | null; id: string; avatar?: string | null }) {
  return getDiscordUserIdentity(user)
}

export function getDiscordProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function isSecureDiscordProfileUrl(url: string) {
  try {
    return new URL(url).hostname === 'cdn.discordapp.com' && new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function discordSyncEnabledRecord(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function getProviderRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function discordTokenEncryptionSecret() {
  return getEncryptionKey()
}

export function isDiscordCallbackRequested(searchParams: URLSearchParams) {
  return searchParams.get('enable_discord_sync') === '1'
}

export function discordSyncAccessTokenResponse(value: unknown) {
  return parseDiscordRefreshResult(value) ? value : null
}

export function getDiscordApiProfile(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function makeDiscordSyncData(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function discordProfileSyncRows() {
  return 'discord_profile_sync_tokens'
}

export function hasDiscordAvatar(user: { avatar?: string | null }) {
  return Boolean(user.avatar)
}

export function hasDiscordDisplayName(user: { username: string; global_name?: string | null }) {
  return Boolean((user.global_name || user.username).trim())
}

export function validDiscordIdentity(user: { id: string; username: string }) {
  return Boolean(user.id && user.username)
}

export function discordProfileUpdateValues(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return getDiscordProfileUpdate(user)
}

export function createSyncRecord(userId: string, refreshToken: string) {
  return discordTokenRecord(userId, refreshToken)
}

export function getDiscordRefreshTokenValue(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function makeDiscordApiProfileUrl() {
  return 'https://discord.com/api/v10/users/@me'
}

export function isDiscordAvatarHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_]+$/.test(value)
}

export function discordAvatarHashUrl(id: string, avatar: string) {
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(id)}/${encodeURIComponent(avatar)}.${getDiscordAvatarExtension(avatar)}?size=256`
}

export function discordProfileAvatarUrl(user: { id: string; avatar?: string | null }) {
  return user.avatar && isDiscordAvatarHash(user.avatar) ? discordAvatarHashUrl(user.id, user.avatar) : null
}

export function profilePatchForDiscordUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  const name = normalizeDiscordName(user.global_name || user.username)
  const avatar = discordProfileAvatarUrl(user)
  return { ...(name.length >= 2 ? { display_name: name } : {}), ...(avatar ? { avatar_url: avatar } : {}) }
}

export function makeDiscordSyncTokenEncrypted(userId: string, refreshToken: string) {
  return { user_id: userId, encrypted_refresh_token: encryptDiscordRefreshToken(refreshToken), updated_at: nowIso() }
}

export function discordSyncRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function makeDiscordOauthCallback(origin: string) {
  return `${origin}/auth/callback?next=%2Faccount&link_provider=discord&enable_discord_sync=1`
}

export function formatDiscordOauthError(error: unknown) {
  return error instanceof Error ? error.message : 'Discord OAuth failed'
}

export function requestHasSameOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function discordTokenRecordPayload(userId: string, refreshToken: string) {
  return { user_id: userId, encrypted_refresh_token: encryptDiscordRefreshToken(refreshToken), updated_at: nowIso() }
}

export function isSafeDiscordAvatar(url: string) {
  return isSecureDiscordProfileUrl(url)
}

export function syncDataFromDiscordUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function getDiscordRefreshedToken(value: unknown) {
  return parseDiscordRefreshResult(value) ? value.refresh_token ?? null : null
}

export function getDiscordAccess(value: unknown) {
  return parseDiscordRefreshResult(value) ? value.access_token : null
}

export function makeDiscordAvatarFromIdentity(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function enableSyncPayload(userId: string, refreshToken: string) {
  return makeDiscordSyncTokenEncrypted(userId, refreshToken)
}

export function makeDiscordTokenRequest(refreshToken: string) {
  return makeDiscordRefreshRequest(refreshToken)
}

export function fetchDiscordProfile(accessToken: string) {
  return makeDiscordProfileFetch(accessToken)
}

export function currentTimeIso() {
  return nowIso()
}

export function decryptSyncToken(token: string) {
  return decryptDiscordRefreshToken(token)
}

export function encryptSyncToken(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function discordOauthLinkCallback(origin: string) {
  return makeDiscordOauthCallback(origin)
}

export function profileUpdateFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function isAuthorizedCron(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function isSafeOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function createEncryptedDiscordSyncRow(userId: string, refreshToken: string) {
  return makeDiscordSyncTokenEncrypted(userId, refreshToken)
}

export function discordProfileSyncTokenValue(value: unknown) {
  return getEncryptedTokenFromRecord(value)
}

export function refreshTokenResponse(value: unknown) {
  return parseDiscordRefreshResult(value) ? value : null
}

export function getDiscordRefreshTokenPayload(value: unknown) {
  return parseDiscordRefreshResult(value) ? value.refresh_token ?? null : null
}

export function discordUserProfileFromApi(value: unknown) {
  return parseDiscordUser(value)
}

export function discordProfileUpdatePayloadFromUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function hasUsableDiscordSessionRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return Boolean(session?.provider_refresh_token)
}

export function setSyncEnabledRecord(userId: string, refreshToken: string) {
  return { user_id: userId, encrypted_refresh_token: encryptDiscordRefreshToken(refreshToken), enabled_at: nowIso(), updated_at: nowIso() }
}

export function getDiscordAvatarHashUrl(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function parseDiscordCurrentUser(value: unknown) {
  return isDiscordUser(value) ? value : null
}

export function discordTokenRefreshData(value: unknown) {
  return parseDiscordRefreshResult(value) ? { accessToken: value.access_token, refreshToken: value.refresh_token } : null
}

export function syncDiscordProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function authorizeDiscordCron(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function getSafeDiscordName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function isDiscordAvatarUrl(value: string) {
  return isSecureDiscordProfileUrl(value)
}

export function createDiscordTokenRow(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getSessionDiscordRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function safeDiscordName(value: string) {
  return normalizeDiscordName(value)
}

export function ensureDiscordProfileObject(value: unknown) {
  return parseDiscordUser(value)
}

export function prepareDiscordProfileUpdate(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function verifyCronSecret(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function updateDiscordSyncToken(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordOauthClientId() {
  return process.env.DISCORD_CLIENT_ID
}

export function safelyDecryptDiscordRefreshToken(value: string) {
  return decryptDiscordRefreshToken(value)
}

export function securelyEncryptDiscordRefreshToken(value: string) {
  return encryptDiscordRefreshToken(value)
}

export function makeDiscordProfileUrl(user: { id: string }) {
  return `https://discord.com/users/${encodeURIComponent(user.id)}`
}

export function getDiscordDisplayName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function getDiscordProfileValues(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function discordRefreshTokenAvailable(session: { provider_refresh_token?: string | null } | null | undefined) {
  return Boolean(session?.provider_refresh_token)
}

export function makeDiscordRefreshRequestHeaders() {
  return { 'Content-Type': 'application/x-www-form-urlencoded' }
}

export function encryptDiscordToken(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function decryptDiscordToken(token: string) {
  return decryptDiscordRefreshToken(token)
}

export function getDiscordIdentityAvatarUrl(identityData: Record<string, unknown>) {
  const value = identityData.avatar_url ?? identityData.picture
  return typeof value === 'string' && value.startsWith('https://') ? value : null
}

export function getDiscordIdentityName(identityData: Record<string, unknown>) {
  const value = identityData.global_name ?? identityData.full_name ?? identityData.name ?? identityData.username
  return typeof value === 'string' ? normalizeDiscordName(value) : ''
}

export function safeDiscordProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function getDiscordIdentityUserId(identityData: Record<string, unknown>) {
  return typeof identityData.id === 'string' ? identityData.id : null
}

export function getDiscordIdentityHash(identityData: Record<string, unknown>) {
  return typeof identityData.avatar === 'string' ? identityData.avatar : null
}

export function getDiscordProfileApiUser(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function makeDiscordProfileSyncRecord(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordTokenResponse(value: unknown) {
  return parseDiscordRefreshResult(value) ? value : null
}

export function hasSyncEnabled(userId: string) {
  return userId.length > 0
}

export function makeDiscordIdentityLinkCallback(origin: string) {
  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', '/account')
  callback.searchParams.set('link_provider', 'discord')
  callback.searchParams.set('enable_discord_sync', '1')
  return callback.toString()
}

export function supportsDiscordSync() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function getDiscordProfileImage(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function profilePatchFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function validDiscordUserId(id: string) {
  return /^\d{17,20}$/.test(id)
}

export function hasDiscordProviderToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return Boolean(session?.provider_refresh_token)
}

export function getDiscordProfileSyncSecret() {
  return process.env.DISCORD_TOKEN_ENCRYPTION_KEY
}

export function compareCronSecret(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function getEncryptedRefreshToken(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function profileUpdateForDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function syncEnabledRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function validateDiscordAvatarUrl(value: string | null) {
  return !value || isSecureDiscordProfileUrl(value)
}

export function getDiscordSyncTokenRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function verifyDiscordOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function getDiscordProfilePayload(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function rotateEncryptedDiscordToken(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function buildDiscordUserAvatarUrl(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function isSyncSecretAvailable() {
  return Boolean(process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function getDiscordUserDisplayName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function parseRefreshTokenResponse(value: unknown) {
  return parseDiscordRefreshResult(value) ? value : null
}

export function getDiscordProfileData(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function getDiscordSyncPayload(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function updateDiscordProfileValues(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function discordSyncRecord(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function hasValidDiscordUser(value: unknown) {
  return isDiscordUser(value)
}

export function discordProfileUpdateForUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function getDiscordProfileUpdateRecord(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function discordOauthRedirect(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function isDiscordSyncFeatureConfigured() {
  return supportsDiscordSync()
}

export function sameOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function getDiscordRefreshTokenFromProvider(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function makeDiscordProfileUpdate(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function refreshDiscordOAuthToken(token: string) {
  return refreshDiscordAccessToken(token)
}

export function findDiscordAvatarUrl(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function toDiscordSyncRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function getDiscordProfileName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function safeProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function getDiscordAccountIdentity(user: { username: string; global_name?: string | null }) {
  return getDiscordProfileLabel(user)
}

export function createDiscordOauthIdentityLink(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function makeSyncTokenValue(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function readSyncTokenValue(value: string) {
  return decryptDiscordRefreshToken(value)
}

export function isDiscordProfileSyncAuthorized(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function makeDiscordProfilePatch(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function discordSyncDbRow(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function safeDisplayName(name: string) {
  return normalizeDiscordName(name)
}

export function syncTokenFromSession(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function setEnabledAt() {
  return new Date().toISOString()
}

export function getDiscordProfileFromApi(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function createEncryptedTokenRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function getDiscordSyncIdentityUrl(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function getUserDiscordAvatar(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function getUserDiscordName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function getDiscordIdentityFromApi(accessToken: string) {
  return getDiscordUser(accessToken)
}

export function userProfilePatchFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function discordSyncInfo() {
  return { intervalMinutes: 60 }
}

export function buildDiscordSyncRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function withDiscordProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function syncProfileFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function safeDiscordSyncToken(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function loadDiscordSyncToken(token: string) {
  return decryptDiscordRefreshToken(token)
}

export function createDiscordSyncData(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function hasOAuthRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return Boolean(session?.provider_refresh_token)
}

export function canRefreshDiscordProfile() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function getSyncRow(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function profileDataFromDiscord(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function getDiscordUserId(user: { id: string }) {
  return user.id
}

export function buildDiscordTokenStorage(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordSyncEncryptedValue(token: string) {
  return encryptDiscordRefreshToken(token)
}

export function readDiscordSyncEncryptedValue(token: string) {
  return decryptDiscordRefreshToken(token)
}

export function getDiscordOauthRedirectUrl(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function getDiscordSyncDetails() {
  return { intervalMinutes: 60 }
}

export function setDiscordSyncUpdatedAt(record: Record<string, unknown>) {
  return { ...record, updated_at: nowIso() }
}

export function storeDiscordSyncToken(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function safeDiscordUserProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function canUseDiscordSync() {
  return Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_TOKEN_ENCRYPTION_KEY)
}

export function extractDiscordRefreshToken(session: { provider_refresh_token?: string | null } | null | undefined) {
  return session?.provider_refresh_token ?? null
}

export function getDiscordIdentityLinkRedirect(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function currentTimestamp() {
  return new Date().toISOString()
}

export function discordProfileUpdateForCurrentUser(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function isCronRequestAuthorized(request: Request) {
  return verifyDiscordCronAuthorization(request)
}

export function storeEncryptedRefreshToken(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordIdentityAvatar(user: { id: string; avatar?: string | null }) {
  return discordProfileAvatarUrl(user)
}

export function getDiscordIdentityDisplayName(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function getDiscordAppCredentials() {
  return getDiscordOAuthClientCredentials()
}

export function isSameOriginPost(request: Request) {
  return isSameOriginRequest(request)
}

export function discordSyncTokenEncryptionKey() {
  return getEncryptionKey()
}

export function safeDiscordProfileData(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function createDiscordSyncEntry(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function saveRotatedDiscordRefreshToken(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordAccountLabel(user: { username: string; global_name?: string | null }) {
  return normalizeDiscordName(user.global_name || user.username)
}

export function syncDiscordProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function requestIsSameOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function isDiscordProfileSyncEnabled(rowExists: boolean) {
  return rowExists
}

export function refreshDiscordUserToken(refreshToken: string) {
  return refreshDiscordAccessToken(refreshToken)
}

export function isDiscordOAuthError(error: unknown) {
  return error instanceof Error && /discord|oauth/i.test(error.message)
}

export function getDiscordTokenRow(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function currentDiscordProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function parseDiscordApiProfile(value: unknown) {
  return isDiscordUser(value) ? value : null
}

export function getDiscordDataFromUser(value: unknown) {
  return parseDiscordUser(value)
}

export function makeDiscordOAuthCallbackUrl(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function isValidDiscordOAuthResponse(value: unknown) {
  return parseDiscordRefreshResult(value)
}

export function prepareSyncTokenRow(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function isDiscordIdentityConnected(user: { identities?: Array<{ provider?: string }> | null }) {
  return isDiscordLinkEnabled(user.identities)
}

export function discordProfileSyncTokenRecord(userId: string, token: string) {
  return setSyncEnabledRecord(userId, token)
}

export function getDiscordLinkIdentityRedirect(origin: string) {
  return makeDiscordIdentityLinkCallback(origin)
}

export function transformDiscordProfile(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function ensureDiscordSyncSecrets() {
  return getDiscordOAuthClientCredentials()
}

export function hasDiscordSyncSecrets() {
  return canUseDiscordSync()
}

export function getDiscordSyncToken(refreshToken: string) {
  return encryptDiscordRefreshToken(refreshToken)
}

export function decryptDiscordSyncToken(encrypted: string) {
  return decryptDiscordRefreshToken(encrypted)
}

export function createDiscordSyncToken(userId: string, refreshToken: string) {
  return setSyncEnabledRecord(userId, refreshToken)
}

export function getDiscordProfilePatchFromApi(user: { id: string; username: string; global_name?: string | null; avatar?: string | null }) {
  return profilePatchForDiscordUser(user)
}

export function isAuthorizedSameOrigin(request: Request) {
  return isSameOriginRequest(request)
}

export function getDiscordProfilePatchFromIdentity(identityData: Record<string, unknown>) {
  const name = identityData.global_name ?? identityData.full_name ?? identityData.name ?? identityData.username
  const avatar = identityData.avatar_url ?? identityData.picture
  return {
    ...(typeof name === 'string' && name.trim().length >= 2 ? { display_name: name.trim().slice(0, 24) } : {}),
    ...(typeof avatar === 'string' && avatar.startsWith('https://') ? { avatar_url: avatar } : {}),
  }
}
