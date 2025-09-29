const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  next();
});

// Este endpoint recibe la petición GET de tu sitio web
app.get('/myorders/details', async (req, res) => {
  const apiUrl = 'https://www.att.com/msapi/orderstatus/v1/getOrderDetail';

  const { orderid, zip, lastName } = req.query;

  // VERIFICAR los parámetros que llegaron
  console.log(`[PROXY] Recibida petición con orderId: ${orderid}, zip: ${zip}, lastName: ${lastName}`);

  if (!orderid || !zip || !lastName) {
    console.error('[PROXY] ERROR: Faltan parámetros en la petición del cliente.');
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  const requestBody = {
    "orderId": orderid,
    "zipCode": zip,
    "isAuth": false,
    "fromDeepLink": true,
    "appId": "omhub",
    "lastName": lastName,
    "emailAddress": ""
  };

  // VERIFICAR el JSON que se va a enviar a la API de AT&T
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

    // VERIFICAR la respuesta que llega de la API de AT&T
    console.log(`[PROXY] Respuesta de la API de AT&T (Status: ${response.status}):`, JSON.stringify(data, null, 2));

    res.status(response.status).json(data);

  } catch (error) {
    console.error('[PROXY] Error al hacer fetch a la API de AT&T:', error);
    res.status(500).json({ error: 'Failed to fetch from the target API.' });
  }
});

app.listen(PORT, () => {
  console.log(`[PROXY] Servidor proxy escuchando en el puerto ${PORT}`);
});
