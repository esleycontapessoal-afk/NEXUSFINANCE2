import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type Action = 'login' | 'presence' | 'dashboard' | 'logout'

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization') ?? ''
  return authorization.match(/^Bearer\s+(.+)$/i)?.[1] ?? ''
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function constantTimeEqual(left: string, right: string) {
  const [leftHash, rightHash] = await Promise.all([digest(left), digest(right)])
  let difference = 0
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index)
  }
  return difference === 0
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Método não permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!supabaseUrl || !serviceRoleKey) {
    return response({ error: 'A função administrativa ainda não está configurada.' }, 503)
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response({ error: 'Requisição inválida.' }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return response({ error: 'Requisição inválida.' }, 400)
  }

  const action = body.action as Action
  if (!['login', 'presence', 'dashboard', 'logout'].includes(action)) {
    return response({ error: 'Ação inválida.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    if (action === 'presence') {
      if (!anonKey) return response({ error: 'A função de presença não está configurada.' }, 503)
      const accessToken = bearerToken(request)
      const event = body.event
      if (!accessToken || (event !== 'login' && event !== 'heartbeat')) {
        return response({ error: 'Sessão de usuário ou evento inválido.' }, 401)
      }
      const auth = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: { user }, error: authError } = await auth.auth.getUser(accessToken)
      if (authError || !user) return response({ error: 'Sessão de usuário inválida.' }, 401)

      const { error } = await admin.rpc('record_site_presence', {
        p_user_id: user.id,
        p_event: event,
      })
      if (error) throw new Error(`Não foi possível registrar a presença: ${error.message}`)
      return response({ recorded: true })
    }

    if (action === 'login') {
      const usernameSecret = Deno.env.get('ADMIN_USERNAME') ?? ''
      const passwordSecret = Deno.env.get('ADMIN_PASSWORD') ?? ''
      if (!usernameSecret || passwordSecret.length < 12) {
        return response({ error: 'Configure ADMIN_USERNAME e uma ADMIN_PASSWORD com pelo menos 12 caracteres nos secrets da função.' }, 503)
      }

      const clientIp = request.headers.get('cf-connecting-ip')
        ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? 'unknown'
      const ipHash = await digest(clientIp)
      const { error: cleanupError } = await admin.from('admin_login_attempts')
        .delete()
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      if (cleanupError) throw new Error(`Não foi possível limpar tentativas antigas: ${cleanupError.message}`)
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count, error: countError } = await admin
        .from('admin_login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', windowStart)
      if (countError) throw new Error(`Não foi possível validar tentativas administrativas: ${countError.message}`)
      if ((count ?? 0) >= 5) return response({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }, 429)

      const providedUsername = typeof body.username === 'string' && body.username.length <= 100 ? body.username : ''
      const providedPassword = typeof body.password === 'string' && body.password.length <= 256 ? body.password : ''
      const validCredentials = await constantTimeEqual(providedUsername, usernameSecret)
        && await constantTimeEqual(providedPassword, passwordSecret)
      if (!validCredentials) {
        const { error } = await admin.from('admin_login_attempts').insert({ ip_hash: ipHash })
        if (error) throw new Error(`Não foi possível registrar a tentativa administrativa: ${error.message}`)
        return response({ error: 'Usuário ou senha inválidos.' }, 401)
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
      const token = randomToken()
      const [{ error: cleanSessionsError }, { error: clearAttemptsError }] = await Promise.all([
        admin.from('admin_access_sessions').delete().lt('expires_at', now.toISOString()),
        admin.from('admin_login_attempts').delete().eq('ip_hash', ipHash),
      ])
      if (cleanSessionsError) throw new Error(`Não foi possível limpar sessões expiradas: ${cleanSessionsError.message}`)
      if (clearAttemptsError) throw new Error(`Não foi possível limpar tentativas anteriores: ${clearAttemptsError.message}`)
      const { error: sessionError } = await admin.from('admin_access_sessions').insert({
        token_hash: await digest(token),
        expires_at: expiresAt,
      })
      if (sessionError) throw new Error(`Não foi possível iniciar a sessão administrativa: ${sessionError.message}`)
      return response({ token, expiresAt })
    }

    const token = bearerToken(request)
    if (!token) return response({ error: 'Sessão administrativa necessária.' }, 401)
    const tokenHash = await digest(token)
    const { data: session, error: sessionError } = await admin
      .from('admin_access_sessions')
      .select('token_hash')
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (sessionError) throw new Error(`Não foi possível validar a sessão administrativa: ${sessionError.message}`)
    if (!session) return response({ error: 'A sessão administrativa expirou. Entre novamente.' }, 401)

    if (action === 'logout') {
      const { error } = await admin.from('admin_access_sessions').delete().eq('token_hash', tokenHash)
      if (error) throw new Error(`Não foi possível encerrar a sessão administrativa: ${error.message}`)
      return response({ loggedOut: true })
    }

    const { data: presenceRows, error } = await admin.rpc('admin_list_site_presence')
    if (error) throw new Error(`Não foi possível carregar os acessos: ${error.message}`)
    const now = Date.now()
    const users = (presenceRows ?? []).map((row: {
      user_id: string
      email: string | null
      last_login_at: string | null
      last_seen_at: string
    }) => ({
      userId: row.user_id,
      email: row.email ?? 'E-mail indisponível',
      lastLoginAt: row.last_login_at,
      lastSeenAt: row.last_seen_at,
      online: now - Date.parse(row.last_seen_at) <= 2 * 60 * 1000,
    }))
    return response({
      users,
      onlineCount: users.filter((user) => user.online).length,
      trackedCount: users.length,
      generatedAt: new Date(now).toISOString(),
    })
  } catch (error) {
    console.error('admin-monitoring failed:', error instanceof Error ? error.message : 'Unknown server error')
    return response({ error: 'O serviço administrativo não conseguiu concluir a solicitação.' }, 500)
  }
})
