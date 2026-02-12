const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json()); // Reemplaza a file_get_contents('php://input')
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (Frontend offline)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/estudiantes', require('./routes/estudiantes'));
app.use('/api/votos', require('./routes/votos'));
app.use('/api/admin', require('./routes/admin'));

// Ruta por defecto para SPA (Single Page Application) o index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para APAGAR SERVIDOR (Solo Admin)
app.post('/api/admin/shutdown', (req, res) => {
    res.json({ success: true, message: "Servidor apagándose..." });
    console.log("🔴 Servidor apagado por el administrador.");
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📂 Modo Offline activado.`);
});