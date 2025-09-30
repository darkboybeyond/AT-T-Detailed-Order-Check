import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiUrl = 'https://www.att.com/msapi/orderstatus/v1/getOrderDetail';

  // Soporta tanto query (GET) como body (POST)
  const { orderid, zip, lastName } =
    req.method === 'GET' ? req.query : req.body;

  console.log(`[PROXY] Recibida petición con orderId: ${orderid}, zip: ${zip}, lastName: ${lastName}`);

  if (!orderid || !zip || !lastName) {
    console.error('[PROXY] ERROR: Faltan parámetros en la petición del cliente.');
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const requestBody = {
    orderId: orderid,
    zipCode: zip,
    isAuth: false,
    fromDeepLink: true,
    appId: 'omhub',
    lastName,
    emailAddress: ''
  };

  console.log('[PROXY] JSON a enviar a AT&T:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://www.att.com/myorders/details',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Origin': 'https://www.att.com'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    console.log(`[PROXY] Respuesta de la API de AT&T (Status: ${response.status}):`, JSON.stringify(data, null, 2));

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('[PROXY] Error al hacer fetch a la API de AT&T:', error);
    return res.status(500).json({ error: 'Failed to fetch from the target API.' });
  }
}
