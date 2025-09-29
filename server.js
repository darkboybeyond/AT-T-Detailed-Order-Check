const express = require('express');
const fetch = require('node-fetch');
// Necesitarás instalar cheerio en tu proyecto de Railway: npm install cheerio
const cheerio = require('cheerio'); 

const app = express();
const PORT = process.env.PORT || 3001; // Usar process.env.PORT es mejor en Railway

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

  const { orderid, zip, lastName } = req.query;

  if (!orderid || !zip || !lastName) {
    return res.status(400).json({ error: 'Missing required parameters.' });
  }

  // --- FASE 1: Obtener Token y Cookies de la página ---
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
        // Simple parsing: unir las cookies con '; '
        const cookieArray = setCookieHeader.split(/, (?=\w+=)/).map(c => c.split(';')[0]);
        cookies = cookieArray.join('; ');
        //console.log('[FASE 1] Cookies capturadas:', cookies); 
    }
    
    // 2. Capturar X-CSRF-Token (viene en un header de respuesta si la página lo envía en el primero)
    // El token puede venir en el header o en el HTML. Revisamos el header primero.
    const csrfFromHeader = htmlResponse.headers.get('x-csrf-token');
    if (csrfFromHeader) {
        csrfToken = csrfFromHeader;
        //console.log('[FASE 1] CSRF Token capturado del Header:', csrfToken); 
    }

    // Si el token no viene en el header, lo buscamos en el HTML (método más seguro)
    if (!csrfToken) {
        const htmlText = await htmlResponse.text();
        const $ = cheerio.load(htmlText);
        // Buscar en las etiquetas meta o scripts que contengan el token
        // Esto depende de cómo AT&T lo inyecte. Asumiremos que está en una meta tag.
        // Si no funciona, esta línea debe ser ajustada buscando el lugar real del token en el HTML.
        csrfToken = $('meta[name="csrf-token"]').attr('content') || null;

        // Si tampoco está en meta, probamos a buscarlo en los headers de la respuesta del GET
        if (!csrfToken && htmlResponse.headers.get('x-csrf-token')) {
            csrfToken = htmlResponse.headers.get('x-csrf-token');
        }

        if (!csrfToken) {
             console.error('[FASE 1] No se pudo encontrar el X-CSRF-Token en el HTML.');
        }
    }


  } catch (error) {
    console.error('[FASE 1] Error en la petición GET (Scraping):', error);
    return res.status(500).json({ error: 'Failed to complete Phase 1: Token retrieval.' }); 
  }

  if (!csrfToken) {
    console.error('[FASE 1] No se pudo obtener el token, abortando.');
    return res.status(500).json({ error: 'Token (X-CSRF-Token) could not be retrieved from AT&T page.' });
  }

  // --- FASE 2: Petición POST a la API con Tokens y Cookies ---
  const requestBody = {
    "orderId": orderid,
    "zipCode": zip,
    "isAuth": false,
    "fromDeepLink": true,
    "appId": "omhub",
    "lastName": lastName,
    "emailAddress": ""
  };

  try {
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*', 
        'Referer': targetUrl, // La página de donde se obtuvo el token
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        'Origin': 'https://www.att.com',
        // ENCABEZADOS DINÁMICOS OBTENIDOS DEL PASO 1
        'X-CSRF-Token': csrfToken, 
        'Cookie': cookies 
      },
      body: JSON.stringify(requestBody)
    });

    const data = await apiResponse.json();

    // Reenviar la respuesta a tu frontend
    res.status(apiResponse.status).json(data);

  } catch (error) {
    console.error('[FASE 2] Error al hacer POST a la API de AT&T:', error);
    res.status(500).json({ error: 'Failed to fetch from the target API (Phase 2).' }); 
  }
});

app.listen(PORT, () => {
  console.log(`[PROXY] Servidor proxy escuchando en el puerto ${PORT}`);
});
