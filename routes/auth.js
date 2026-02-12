const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Ruta: POST /api/auth/login
router.post('/login', (req, res) => {
    const { usuario, pass } = req.body;

    if (!usuario || !pass) {
        return res.status(400).json({ error: "Por favor ingrese usuario y contraseña." });
    }

    // Consulta segura usando placeholders (?)
    const sql = "SELECT id, nombre, usuario, rol, nummesa FROM usuarios WHERE usuario = ? AND pass = ?";

    db.get(sql, [usuario, pass], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "Error interno del servidor." });
        }

        if (row) {
            // Login exitoso
            res.json({
                success: true,
                message: "Bienvenido al sistema",
                data: {
                    id: row.id,
                    nombre: row.nombre,
                    rol: row.rol,
                    nummesa: row.nummesa // Útil para saber si es una mesa de votación
                }
            });
        } else {
            // Credenciales inválidas
            res.status(401).json({ error: "Usuario o contraseña incorrectos." });
        }
    });
});

module.exports = router;