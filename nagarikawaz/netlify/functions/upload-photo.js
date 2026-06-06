exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const GAS_URL = process.env.VITE_SHEETS_API_URL
  if (!GAS_URL) {
    return resp({ error: 'VITE_SHEETS_API_URL not set in Netlify environment variables' })
  }

  // Netlify may base64-encode large bodies — decode first
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : (event.body || '')

  if (!rawBody) {
    return resp({ error: 'Empty request body received by proxy' })
  }

  try {
    // Use redirect:follow — Node.js fetch follows redirects like a browser but without
    // CORS restrictions, so GAS responses are readable even after redirect
    const gasRes = await fetch(GAS_URL, {
      method:  'POST',
      body:    rawBody,
      headers: { 'Content-Type': 'text/plain' },
    })

    const text = await gasRes.text()

    // Validate JSON before returning — if GAS returned HTML/empty, surface real error
    try {
      JSON.parse(text)
    } catch {
      const preview = text.slice(0, 300).replace(/\s+/g, ' ')
      return resp({ error: `GAS returned non-JSON (HTTP ${gasRes.status}): ${preview}` })
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: text }
  } catch (err) {
    return resp({ error: `Proxy fetch failed: ${err.message}` })
  }
}

function resp(obj) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }
}
