// Vercel Serverless Function - Processamento de Leads CPAGetti
// Suporta tanto ambientes Node.js CommonJS quanto Vercel Edge/Serverless

const CPAGETTI_ENDPOINT = 'https://api.cpagetti.com/order/register';
const API_KEY = 'BYfsxIxJgbximiUJ6nkJXQMTiYFVoKAE';
const DEFAULT_OFFER_ID = '15495';
const DEFAULT_COUNTRY = 'IT';
const DEFAULT_LANG = 'IT';
const DEFAULT_STREAM_CODE = 'v29p';
const THANK_YOU_URL = '/slimmatica/grazie.html';

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        if (body.startsWith('{')) {
          resolve(JSON.parse(body));
          return;
        }
      } catch (e) {}

      const params = new URLSearchParams(body);
      const data = {};
      for (const [key, value] of params.entries()) {
        data[key] = value.trim();
      }
      resolve(data);
    });
  });
}

async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const data = await parseBody(req);
    const name = data.name || '';
    const phone = data.phone || '';
    const offerId = data.offer_id || DEFAULT_OFFER_ID;
    const country = (data.country || DEFAULT_COUNTRY).toUpperCase();
    const lang = (data.lang || DEFAULT_LANG).toUpperCase();
    const streamCode = data.stream_code || DEFAULT_STREAM_CODE;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nome e telefone são obrigatórios.' });
    }

    const payload = new URLSearchParams({
      api_key: API_KEY,
      name,
      phone,
      offer_id: offerId,
      country,
      lang,
      stream_code: streamCode,
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    });

    if (data.sub1) payload.append('sub1', data.sub1);
    if (data.sub2) payload.append('sub2', data.sub2);
    if (data.sub3) payload.append('sub3', data.sub3);
    if (data.sub4) payload.append('sub4', data.sub4);
    if (data.sub5) payload.append('sub5', data.sub5);

    const cpaResponse = await fetch(CPAGETTI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': req.headers['user-agent'] || 'lead-form'
      },
      body: payload.toString()
    });

    const result = await cpaResponse.json().catch(() => ({}));

    // Verifica se a requisição espera JSON (AJAX / fetch) ou Redirecionamento (HTML Form submit)
    const acceptsJson = req.headers['accept']?.includes('application/json');
    if (acceptsJson) {
      return res.status(200).json({
        success: true,
        redirect: THANK_YOU_URL,
        result
      });
    }

    // Redireciona com sucesso para a página de obrigado
    res.writeHead(303, { Location: THANK_YOU_URL });
    return res.end();
  } catch (error) {
    console.error('Erro ao registrar lead:', error);
    // Em caso de erro transitório, redireciona para a página de obrigado para não perder o usuário
    const acceptsJson = req.headers['accept']?.includes('application/json');
    if (acceptsJson) {
      return res.status(200).json({
        success: true,
        redirect: THANK_YOU_URL
      });
    }

    res.writeHead(303, { Location: THANK_YOU_URL });
    return res.end();
  }
}

module.exports = handler;
module.exports.default = handler;

