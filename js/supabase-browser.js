/**
 * Browser Supabase client (Auth). Loaded after the CDN UMD build.
 * Requires window.supabase from @supabase/supabase-js UMD.
 */
(function () {
  let configPromise = null;
  let clientPromise = null;

  async function loadConfig() {
    if (!configPromise) {
      configPromise = fetch('/api/public-config')
        .then(res => res.json())
        .then(data => {
          if (!data?.supabaseUrl || !data?.supabaseAnonKey) {
            throw new Error('Supabase Auth is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel.');
          }
          return data;
        });
    }
    return configPromise;
  }

  async function getClient() {
    if (!window.supabase?.createClient) {
      throw new Error('Supabase library failed to load. Check your network connection.');
    }
    if (!clientPromise) {
      clientPromise = loadConfig().then(cfg =>
        window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        })
      );
    }
    return clientPromise;
  }

  async function getAccessToken() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  async function getSession() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session || null;
  }

  async function signInWithPassword(email, password) {
    const client = await getClient();
    return client.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password
    });
  }

  async function signOut() {
    const client = await getClient();
    return client.auth.signOut();
  }

  async function resetPasswordForEmail(email) {
    const client = await getClient();
    const cfg = await loadConfig();
    const redirectTo = `${(cfg.siteUrl || window.location.origin).replace(/\/$/, '')}/set-password.html`;
    return client.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo });
  }

  async function updatePassword(password) {
    const client = await getClient();
    return client.auth.updateUser({ password });
  }

  window.GaaAuth = {
    loadConfig,
    getClient,
    getAccessToken,
    getSession,
    signInWithPassword,
    signOut,
    resetPasswordForEmail,
    updatePassword
  };
})();
