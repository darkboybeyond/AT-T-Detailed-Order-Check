const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio'); 

const app = express();
// 🔥 CORRECCIÓN CRÍTICA PARA RAILWAY: Usar process.env.PORT.
// Si no se usa, Railway no puede conectarse a tu app y da 502.
const PORT = process.env.PORT || 3001; 

// Configuración de CORS
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
  const targetUrl = 'https://www.att.com/myorders/details';
  const apiEndpoint = 'https://www.att.com/msapi/orderstatus/v1/getOrderDetail';

  // Extraer todos los parámetros necesarios
  const { orderid, zip, lastName, appid } = req.query;

  if (!orderid || !zip || !lastName || !appid) {
    return res.status(400).json({ 
        error: 'Missing required parameters. Make sure to provide orderid, zip, lastName, and appid.' 
    });
  }

  // --- FASE 1: Obtener Token y Cookies de la página (Scraping) ---
  let csrfToken = null;
  let cookies = '';
  
  try {
    const htmlResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Referer': 'https://www.att.com/',
      }
    });

    // 1. Capturar Cookies
    const setCookieHeader = htmlResponse.headers.get('set-cookie');
    if (setCookieHeader) {
        const cookieArray = setCookieHeader.split(/, (?=\w+=)/).map(c => c.split(';')[0]);
        cookies = cookieArray.join('; ');
    }
    
    // 2. Capturar X-CSRF-Token (Buscar en headers o HTML)
    csrfToken = htmlResponse.headers.get('x-csrf-token');

    if (!csrfToken) {
        const htmlText = await htmlResponse.text();
        const $ = cheerio.load(htmlText);
        csrfToken = $('meta[name="csrf-token"]').attr('content') || null;
    }

    if (!csrfToken) {
         console.error('[FASE 1] No se pudo encontrar el X-CSRF-Token.');
    }

  } catch (error) {
    console.error('[FASE 1] Error en la petición GET (Scraping):', error);
    return res.status(503).json({ error: 'Token retrieval failed. AT&T might be blocking the initial request.' }); 
  }

  if (!csrfToken) {
    console.error('[PROXY] No se pudo obtener el token, abortando.');
    return res.status(500).json({ error: 'Token (X-CSRF-Token) could not be retrieved.' });
  }

  // --- FASE 2: Petición POST a la API con Tokens y Cookies ---
  const requestBody = {
    "orderId": orderid,
    "zipCode": zip,
    "isAuth": false,
    "fromDeepLink": true,
    "appId": appid, // Usamos 'appid' dinámicamente
    "lastName": lastName,
    "emailAddress": ""
  };

  try {
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*', 
        'Referer': targetUrl, 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Origin': 'https://www.att.com',
        // ENCABEZADOS DINÁMICOS OBTENIDOS DEL PASO 1
        'X-CSRF-Token': csrfToken, 
        'Cookie': cookies 
      },
      body: JSON.stringify(requestBody)
    });

    const data = await apiResponse.json();
    res.status(apiResponse.status).json(data);

  } catch (error) {
    console.error('[FASE 2] Error al hacer POST a la API de AT&T:', error);
    res.status(500).json({ error: 'Failed to fetch from the target API (Phase 2).' }); 
  }
});

// 🔥 CORRECCIÓN CRÍTICA: Asegurarse de que se usa la variable PORT
app.listen(PORT, () => {
  console.log(`[PROXY] Servidor proxy escuchando en el puerto ${PORT}`);
});
