// Proxy for Google Apps Script photo upload.
// Browser can't POST directly to GAS — the 302 redirect strips the body and CORS blocks it.
// This function runs server-side: no CORS, redirect followed manually with body preserved.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const GAS_URL = process.env.VITE_SHEETS_API_URL
  if (!GAS_URL) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'VITE_SHEETS_API_URL is not set in Netlify environment variables' }),
    }
  }

  try {
    // Step 1: POST to GAS with redirect:manual so we can re-POST to the redirect URL.
    // fetch (and browsers) normally convert POST→GET on 302 — server-side we can avoid this.
    let res = await fetch(GAS_URL, {
      method:   'POST',
      body:     event.body,
      headers:  { 'Content-Type': 'text/plain' },
      redirect: 'manual',
    })

    // Step 2: If GAS redirected (302), follow it manually keeping POST + body
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (location) {
        res = await fetch(location, {
          method:  'POST',
          body:    event.body,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
    }

    const text = await res.text()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Proxy error: ${err.message}` }),
    }
  }
}
