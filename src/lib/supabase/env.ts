// Reads the public Supabase env vars defensively. Vercel/paste mishaps (a
// dropped https:// scheme, surrounding quotes, or trailing whitespace/newline)
// otherwise make the Supabase client throw "Invalid URL" inside middleware and
// 500 every route. Normalizing here turns those into a valid URL so the app
// still boots.

function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^['"]+|['"]+$/g, "");
}

export function supabaseUrl(): string {
  let url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export function supabaseAnonKey(): string {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
