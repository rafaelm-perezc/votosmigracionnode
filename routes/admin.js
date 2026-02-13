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
const normalizeUpper = (v) => String(v || '').trim().toUpperCase();

const clearDirectory = (dir) => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach((name) => {
        const target = path.join(dir, name);
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            clearDirectory(target);
            fs.rmdirSync(target);
        } else {
            fs.unlinkSync(target);
        }
    });
};

router.get('/candidatos', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM candidatos ORDER BY cargo, nombre');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/candidatos', uploadCandidato.single('foto'), async (req, res) => {
    const nombre = normalizeUpper(req.body.nombre);
    const cargo = String(req.body.cargo || '').trim();
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
        await dbRun('INSERT INTO sedes (nombre) VALUES (?)', [normalizeUpper(req.body.nombre)]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo crear la sede. Verifique que no esté repetida.' });
    }
});

router.put('/sedes/:id', async (req, res) => {
    try {
        await dbRun('UPDATE sedes SET nombre = ? WHERE id = ?', [normalizeUpper(req.body.nombre), Number(req.params.id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo actualizar la sede.' });
    }
});

router.post('/grados', async (req, res) => {
    const { sede_id, nombre } = req.body;
    try {
        await dbRun('INSERT INTO grados (nombre, sede_id) VALUES (?, ?)', [normalizeUpper(nombre), Number(sede_id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo crear el grado en la sede indicada.' });
    }
});

router.delete('/grados/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM grados WHERE id = ?', [Number(req.params.id)]);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: 'No se pudo eliminar el grado.' });
    }
});

router.post('/grados/asignar', async (req, res) => {
    const { sede_ids, grados } = req.body;
    if (!Array.isArray(sede_ids) || !Array.isArray(grados)) return res.status(400).json({ error: 'Datos inválidos.' });
    try {
        await dbRun('BEGIN TRANSACTION');
        for (const sedeId of sede_ids) {
            for (const g of grados) {
                await dbRun('INSERT OR IGNORE INTO grados (nombre, sede_id) VALUES (?, ?)', [normalizeUpper(g), Number(sedeId)]);
            }
        }
        await dbRun('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(400).json({ error: 'No se pudieron asignar los grados.' });
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
        const noUpper = new Set(['fecha', 'hora_inicio', 'hora_fin']);
        for (const [k, v] of updates) {
            const valor = noUpper.has(k) ? String(v || '').trim() : normalizeUpper(v);
            await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', [valor, k]);
        }

        if (req.files?.firma_rector?.[0]) {
            const prev = await dbGet('SELECT valor FROM configuracion WHERE clave = ?', ['firma_rector']);
            if (prev?.valor) {
                const prevPath = path.join(__dirname, '../public', prev.valor);
                if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
            }
            await dbRun('UPDATE configuracion SET valor = ? WHERE clave = ?', [`img/firmas/${req.files.firma_rector[0].filename}`, 'firma_rector']);
        }
        if (req.files?.firma_lider?.[0]) {
            const prev = await dbGet('SELECT valor FROM configuracion WHERE clave = ?', ['firma_lider']);
            if (prev?.valor) {
                const prevPath = path.join(__dirname, '../public', prev.valor);
                if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
            }
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
        const personero = await dbAll(`
            SELECT v.candidatoPersonero as candidato, COUNT(*) as votos, COALESCE(c.imagen, 'img/default.png') as imagen
            FROM votos v LEFT JOIN candidatos c ON c.nombre = v.candidatoPersonero
            GROUP BY v.candidatoPersonero
            ORDER BY votos DESC
        `);
        const contralor = await dbAll(`
            SELECT v.candidatoContralor as candidato, COUNT(*) as votos, COALESCE(c.imagen, 'img/default.png') as imagen
            FROM votos v LEFT JOIN candidatos c ON c.nombre = v.candidatoContralor
            GROUP BY v.candidatoContralor
            ORDER BY votos DESC
        `);
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

router.get('/votos/exportar-general', async (req, res) => {
    try {
        const rows = await dbAll(`
            SELECT e.documento,
                   TRIM(COALESCE(e.primer_apellido,'') || ' ' || COALESCE(e.segundo_apellido,'' ) || ' ' || COALESCE(e.primer_nombre,'') || ' ' || COALESCE(e.segundo_nombre,'')) AS nombre_completo,
                   e.sede_educativa AS sede,
                   e.grado,
                   e.mesa,
                   COALESCE(v.candidatoPersonero, '') AS voto_personero,
                   COALESCE(v.candidatoContralor, '') AS voto_contralor,
                   COALESCE(v.fecha_voto, '') AS fecha_voto
            FROM estudiantes e
            LEFT JOIN votos v ON v.documento = e.documento
            ORDER BY e.sede_educativa, e.grado, e.primer_apellido, e.primer_nombre
        `);
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(rows);
        xlsx.utils.book_append_sheet(wb, ws, 'consolidado');
        const filename = 'consolidado_general_votacion.xlsx';
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

router.get('/votos/plantilla', async (req, res) => {
    try {
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet([
            { documento: '12345678', candidatoPersonero: 'NOMBRE CANDIDATO', candidatoContralor: 'NOMBRE CANDIDATO', fecha_voto: '2026-01-01T10:00:00' }
        ]);
        xlsx.utils.book_append_sheet(wb, ws, 'votos');
        const filename = 'plantilla_carga_votos.xlsx';
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


router.get('/carnets', async (req, res) => {
    try {
        const configRows = await dbAll('SELECT clave, valor FROM configuracion');
        const config = {};
        configRows.forEach((r) => { config[r.clave] = r.valor; });

        const estudiantes = await dbAll(`
            SELECT documento,
                   primer_apellido,
                   segundo_apellido,
                   primer_nombre,
                   segundo_nombre,
                   sede_educativa
            FROM estudiantes
            ORDER BY sede_educativa, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre
        `);

        res.json({
            institucion: 'INSTITUCIÓN EDUCATIVA PROMOCIÓN SOCIAL',
            sedeDefault: config.lugar || '',
            estudiantes
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/reset-sistema', async (req, res) => {
    try {
        const candidatosDir = path.join(__dirname, '../public/img/candidatos');
        const firmasDir = path.join(__dirname, '../public/img/firmas');
        const uploadsDir = path.join(__dirname, '../uploads');

        clearDirectory(candidatosDir);
        clearDirectory(firmasDir);
        clearDirectory(uploadsDir);

        await db.resetDatabase();

        res.json({ success: true, message: 'Sistema reiniciado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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