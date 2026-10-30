// Vercel Serverless Function - Processamento de Leads KMA (Diabexol Pro)

const KMA_LEAD_ENDPOINT = 'https://api.kma.biz/lead/add';
const KMA_ACCESS_TOKEN = 'LGetGr2KPOuL1kDHrXlm2Zb9msuMVq6Z';
const KMA_CHANNEL = 'orvCWj';
const DEFAULT_COUNTRY = 'IT';
const DEFAULT_OFFER_ID = '30162';
const THANK_YOU_URL = '/diabexol-pro/diabexolpro.html';

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
    const country = (data.country || DEFAULT_COUNTRY).toUpperCase();
    const offerId = data.offer_id || DEFAULT_OFFER_ID;
    const channel = data.channel || KMA_CHANNEL;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nome e telefone são obrigatórios.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();

    const payload = new URLSearchParams({
      channel: channel,
      name,
      phone,
      ip: clientIp,
      country,
      referer: req.headers['referer'] || '',
      offer: offerId,
      utm_source: data.utm_source || '',
      utm_medium: data.utm_medium || '',
      utm_campaign: data.utm_campaign || '',
      utm_content: data.utm_content || '',
      utm_term: data.utm_term || '',
    });

    const kmaResponse = await fetch(KMA_LEAD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Bearer ${KMA_ACCESS_TOKEN}`,
        'User-Agent': req.headers['user-agent'] || 'lead-form'
      },
      body: payload.toString()
    });

    const result = await kmaResponse.json().catch(() => ({}));

    const acceptsJson = req.headers['accept']?.includes('application/json');
    if (acceptsJson) {
      return res.status(200).json({
        success: true,
        redirect: THANK_YOU_URL,
        result
      });
    }

    res.writeHead(303, { Location: THANK_YOU_URL });
    return res.end();
  } catch (error) {
    console.error('Erro ao registrar lead KMA (Diabexol):', error);
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

