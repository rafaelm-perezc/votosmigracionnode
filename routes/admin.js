const express = require('express');
const router = express.Router();
const db = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storageCandidatos = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/img/candidatos';
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, 'candidato-' + Date.now() + path.extname(file.originalname))
});

const storageFirmas = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/img/firmas';
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`)
});

const uploadCandidato = multer({ storage: storageCandidatos });
const uploadFirmas = multer({ storage: storageFirmas });
const uploadTemp = multer({ dest: 'uploads/' });

const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

router.get('/candidatos', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM candidatos ORDER BY cargo, nombre');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/candidatos', uploadCandidato.single('foto'), async (req, res) => {
    const { nombre, cargo } = req.body;
    const imagen = req.file ? `img/candidatos/${req.file.filename}` : 'img/default.png';
    if (!nombre || !cargo) return res.status(400).json({ error: 'Datos incompletos' });

    try {
        const r = await dbRun('INSERT INTO candidatos (nombre, cargo, imagen) VALUES (?, ?, ?)', [nombre, cargo, imagen]);
        res.json({ success: true, id: r.lastID, imagen });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/candidatos/:id', async (req, res) => {
    try {
        const row = await dbGet('SELECT imagen FROM candidatos WHERE id = ?', [req.params.id]);
        if (row && row.imagen !== 'img/default.png') {
            const pathImg = path.join(__dirname, '../public', row.imagen);
            if (fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
        }
        await dbRun('DELETE FROM candidatos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/sedes', async (req, res) => {
    try {
        const rows = await dbAll('SELECT id, nombre FROM sedes ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sedes', async (req, res) => {
    try {
        await dbRun('INSERT INTO sedes (nombre) VALUES (?)', [String(req.body.nombre || '').trim()]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo crear la sede. Verifique que no esté repetida.' });
    }
});

router.post('/grados', async (req, res) => {
    const { sede_id, nombre } = req.body;
    try {
        await dbRun('INSERT INTO grados (nombre, sede_id) VALUES (?, ?)', [String(nombre || '').trim(), Number(sede_id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo crear el grado en la sede indicada.' });
    }
});

router.get('/grados', async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT g.id, g.nombre, g.sede_id, s.nombre as sede
            FROM grados g
            JOIN sedes s ON s.id = g.sede_id
            ORDER BY s.nombre, g.nombre
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/config', async (req, res) => {
    try {
        const rows = await dbAll('SELECT clave, valor FROM configuracion');
        const config = {};
        rows.forEach((r) => { config[r.clave] = r.valor; });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/config', uploadFirmas.fields([{ name: 'firma_rector', maxCount: 1 }, { name: 'firma_lider', maxCount: 1 }]), async (req, res) => {
    const data = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        const updates = Object.entries(data);
        for (const [k, v] of updates) {
            await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', [v, k]);
        }

        if (req.files?.firma_rector?.[0]) {
            await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', [`img/firmas/${req.files.firma_rector[0].filename}`, 'firma_rector']);
        }
        if (req.files?.firma_lider?.[0]) {
            await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', [`img/firmas/${req.files.firma_lider[0].filename}`, 'firma_lider']);
        }
        await dbRun('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(500).json({ error: error.message });
    }
});

router.post('/mesas/cerrar', async (req, res) => {
    await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', ['0', 'votacion_habilitada']);
    res.json({ success: true, message: 'Mesas cerradas manualmente.' });
});

router.post('/mesas/abrir', async (req, res) => {
    await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', ['1', 'votacion_habilitada']);
    res.json({ success: true, message: 'Mesas habilitadas.' });
});

router.get('/resultados-vivo', async (req, res) => {
    try {
        const personero = await dbAll('SELECT candidatoPersonero as candidato, COUNT(*) as votos FROM votos GROUP BY candidatoPersonero ORDER BY votos DESC');
        const contralor = await dbAll('SELECT candidatoContralor as candidato, COUNT(*) as votos FROM votos GROUP BY candidatoContralor ORDER BY votos DESC');
        res.json({ personero, contralor });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/votos/exportar/:sede', async (req, res) => {
    const sede = req.params.sede;
    try {
        const rows = await dbAll(`
            SELECT v.documento, v.candidatoPersonero, v.candidatoContralor, v.fecha_voto, e.sede_educativa
            FROM votos v
            JOIN estudiantes e ON e.documento = v.documento
            WHERE e.sede_educativa = ?
        `, [sede]);

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(rows);
        xlsx.utils.book_append_sheet(wb, ws, 'votos');

        const filename = `votos${sede.replace(/\s+/g, '')}.xlsx`;
        const tempPath = path.join(__dirname, '../uploads', filename);
        ensureDir(path.dirname(tempPath));
        xlsx.writeFile(wb, tempPath);
        res.download(tempPath, filename, () => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/votos/importar', uploadTemp.single('archivoVotos'), async (req, res) => {
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ error: 'Debe cargar el archivo de votos.' });

    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet);

        let cargados = 0;
        let omitidos = 0;
        await dbRun('BEGIN TRANSACTION');
        for (const row of rows) {
            const doc = String(row.documento || '').trim();
            if (!doc) continue;
            const existe = await dbGet('SELECT documento FROM estudiantes WHERE documento = ?', [doc]);
            const ya = await dbGet('SELECT id FROM votos WHERE documento = ?', [doc]);
            if (!existe || ya) {
                omitidos++;
                continue;
            }
            await dbRun('INSERT INTO votos (documento, candidatoPersonero, candidatoContralor, fecha_voto) VALUES (?, ?, ?, ?)', [
                doc,
                row.candidatoPersonero || 'Voto en Blanco',
                row.candidatoContralor || 'Voto en Blanco',
                row.fecha_voto || new Date().toISOString()
            ]);
            cargados++;
        }
        await dbRun('COMMIT');
        res.json({ success: true, cargados, omitidos });
    } catch (error) {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(500).json({ error: error.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

router.get('/acta', async (req, res) => {
    try {
        const configRows = await dbAll('SELECT clave, valor FROM configuracion');
        const config = {};
        configRows.forEach((r) => { config[r.clave] = r.valor; });
        const personero = await dbAll('SELECT candidatoPersonero AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoPersonero ORDER BY votos DESC');
        const contralor = await dbAll('SELECT candidatoContralor AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoContralor ORDER BY votos DESC');
        const total = await dbGet('SELECT COUNT(*) as c FROM votos');
        res.json({ config, personero, contralor, total: total.c });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;