const express = require('express');
const router = express.Router();
const db = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar Multer para guardar imágenes de candidatos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/img/candidatos';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'candidato-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- GESTIÓN DE CANDIDATOS ---

// Obtener todos los candidatos
router.get('/candidatos', (req, res) => {
    db.all("SELECT * FROM candidatos ORDER BY cargo, nombre", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Crear candidato (con foto)
router.post('/candidatos', upload.single('foto'), (req, res) => {
    const { nombre, cargo } = req.body;
    const imagen = req.file ? `img/candidatos/${req.file.filename}` : 'img/default.png';

    if (!nombre || !cargo) return res.status(400).json({ error: "Datos incompletos" });

    db.run("INSERT INTO candidatos (nombre, cargo, imagen) VALUES (?, ?, ?)", [nombre, cargo, imagen], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID, imagen });
    });
});

// Eliminar candidato
router.delete('/candidatos/:id', (req, res) => {
    const id = req.params.id;
    // Primero obtener la imagen para borrarla
    db.get("SELECT imagen FROM candidatos WHERE id = ?", [id], (err, row) => {
        if (row && row.imagen !== 'img/default.png') {
            const pathImg = path.join(__dirname, '../public', row.imagen);
            if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
        }
        db.run("DELETE FROM candidatos WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// --- CONFIGURACIÓN DEL SISTEMA ---

// Obtener configuración
router.get('/config', (req, res) => {
    db.all("SELECT clave, valor FROM configuracion", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const config = {};
        rows.forEach(r => config[r.clave] = r.valor);
        res.json(config);
    });
});

// Guardar configuración
router.post('/config', (req, res) => {
    const data = req.body;
    db.serialize(() => {
        const stmt = db.prepare("UPDATE configuracion SET valor = ? WHERE clave = ?");
        Object.keys(data).forEach(key => {
            stmt.run(data[key], key);
        });
        stmt.finalize();
        res.json({ success: true });
    });
});

// --- DATOS PARA EL ACTA ---
router.get('/acta', async (req, res) => {
    try {
        // 1. Configuración
        const configRows = await new Promise((resolve, reject) => 
            db.all("SELECT clave, valor FROM configuracion", (err, rows) => err ? reject(err) : resolve(rows))
        );
        const config = {};
        configRows.forEach(r => config[r.clave] = r.valor);

        // 2. Resultados Personero
        const personero = await new Promise((resolve, reject) => 
            db.all("SELECT candidatoPersonero AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoPersonero ORDER BY votos DESC", (err, rows) => err ? reject(err) : resolve(rows))
        );

        // 3. Resultados Contralor
        const contralor = await new Promise((resolve, reject) => 
            db.all("SELECT candidatoContralor AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoContralor ORDER BY votos DESC", (err, rows) => err ? reject(err) : resolve(rows))
        );

        // 4. Total Votos
        const total = await new Promise((resolve, reject) => 
            db.get("SELECT COUNT(*) as c FROM votos", (err, row) => err ? reject(err) : resolve(row.c))
        );

        res.json({ config, personero, contralor, total });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;