// Vercel Serverless Function - Processamento de Leads Netvork (Uroprostan)

const NETVORK_TOKEN = 'ed48d1510bf96ccdd2a080314dd3f0ac';
const ENDPOINTS = [
  'https://api.netvork.net/v1/new-lead',
  'https://api2.netvork.net/v1/new-lead'
];
const STAGE_ENDPOINTS = [
  'https://api.stage.netvork.net/v1/new-lead',
  'https://api2.stage.netvork.net/v1/new-lead'
];

const DEFAULT_OFFER_ID = '1465';
const DEFAULT_COUNTRY = 'IT';
const DEFAULT_LANG = 'it';
const THANK_YOU_URL = '/uroprostan/uroprostansuccess.html';

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

async function sendToNetvork(endpoints, payloadData) {
  const bodyString = new URLSearchParams(payloadData).toString();

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/plain, */*'
        },
        body: bodyString
      });

      if (response.ok) {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          if (json && (json.status || json.success || json.id)) {
            return { success: true, data: json };
          }
        } catch (_) {
          return { success: true, raw: text };
        }
      }
    } catch (err) {
      console.warn(`Tentativa de envio para ${endpoint} falhou:`, err.message);
    }
  }
  return { success: false };
}

async function handler(req, res) {
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
    const lang = (data.lang || DEFAULT_LANG).toLowerCase();
    const pageUrl = data.url || req.headers['referer'] || '';

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nome e telefone sono obbligatori.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();

    const netvorkPayload = {
      token: NETVORK_TOKEN,
      offer_id: offerId,
      name,
      phone,
      country,
      lang,
      ip: clientIp,
      url: pageUrl,
      utm_source: data.utm_source || '',
      utm_medium: data.utm_medium || '',
      utm_campaign: data.utm_campaign || '',
      utm_content: data.utm_content || '',
      utm_term: data.utm_term || '',
      session_guid: data.guid || data.session_guid || '',
      session_first_guid: data.first_guid || data.session_first_guid || ''
    };

    const isStage = pageUrl.includes('.stage.netvork.net');
    const targetEndpoints = isStage ? STAGE_ENDPOINTS : ENDPOINTS;

    const netvorkResult = await sendToNetvork(targetEndpoints, netvorkPayload);

    // Mantém a query string caso exista na URL original
    const queryString = pageUrl.includes('?') ? pageUrl.substring(pageUrl.indexOf('?')) : '';
    const redirectUrl = `${THANK_YOU_URL}${queryString}`;

    const acceptsJson = req.headers['accept']?.includes('application/json');
    if (acceptsJson) {
      return res.status(200).json({
        success: true,
        redirect: redirectUrl,
        netvork: netvorkResult
      });
    }

    res.writeHead(303, { Location: redirectUrl });
    return res.end();
  } catch (error) {
    console.error('Errore durante invio lead Netvork:', error);
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

