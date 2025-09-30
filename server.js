// api/myorders/details.js (Vercel Serverless Function)

// Reemplazamos 'express' por el handler de Vercel y usamos el fetch nativo de Node.js (Vercel)
// Si tu runtime es muy antiguo, puedes usar 'const fetch = require('node-fetch');' 
// y asegurar que 'node-fetch' está en tu package.json.
// Usaremos la versión nativa (global) de fetch que Vercel garantiza. 

module.exports = async (req, res) => {
    // 1. Configuración de CORS
    // Vercel maneja CORS, pero incluimos los headers para replicar la lógica original
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar la petición OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).send();
    }
    
    // Tu frontend hace una petición GET a este proxy, por eso verificamos GET.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    
    const apiUrl = 'https://www.att.com/msapi/orderstatus/v1/getOrderDetail';

    // En Vercel, req.query es la forma correcta de acceder a los parámetros
    const { orderid, zip, lastName } = req.query;

    // 2. Validación de parámetros
    if (!orderid || !zip || !lastName) {
        console.error('ERROR: Faltan parámetros en la petición del cliente.');
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
    
    // 3. Petición al API de AT&T
    try {
        // Usamos el fetch global disponible en el runtime de Vercel
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

        // 4. Leer la respuesta
        const data = await response.json();

        // 5. Devolver la respuesta al cliente
        // Esto reenvía el status original de AT&T (ej. 200, 400, 500)
        res.status(response.status).json(data);

    } catch (error) {
        // 🔴 Manejo del error de red/conexión (lo que causó el fallo 500 anterior)
        console.error('Error al hacer fetch a la API de AT&T:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch from the target API.',
            details: error.message
        });
    }
};

// Se elimina: 
// const express = require('express');
// const app = express();
// app.listen(PORT, () => { ... }); 
// Ya que Vercel maneja la ejecución.
