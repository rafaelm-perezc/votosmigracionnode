const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const upload = multer({ dest: 'uploads/' });

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const normalize = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalize(value).toUpperCase();

const GRADE_NUMBER_MAP = {
    '0': 'TRANSICIÓN',
    '1': 'PRIMERO',
    '2': 'SEGUNDO',
    '3': 'TERCERO',
    '4': 'CUARTO',
    '5': 'QUINTO',
    '6': 'SEXTO',
    '7': 'SÉPTIMO',
    '8': 'OCTAVO',
    '9': 'NOVENO',
    '10': 'DÉCIMO',
    '11': 'UNDÉCIMO'
};

const normalizeGrade = (value) => {
    const raw = normalizeUpper(value);
    return Object.prototype.hasOwnProperty.call(GRADE_NUMBER_MAP, raw) ? GRADE_NUMBER_MAP[raw] : raw;
};

router.get('/plantilla', (req, res) => {
    const filePath = path.join(__dirname, '../plantillas/plantillaCargaMasiva.xlsx');
    res.download(filePath, 'plantillaCargaMasiva.xlsx');
});

router.post('/preanalizar', upload.single('archivoEstudiantes'), async (req, res) => {
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ error: 'Archivo requerido.' });
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const rows = data.slice(1);
        const sedes = {};
        rows.forEach((row) => {
            if (!row[0]) return;
            const sede = normalizeUpper(row[6]);
            if (!sede) return;
            sedes[sede] = (sedes[sede] || 0) + 1;
        });
        res.json({ sedes });
    } catch (error) {
        res.status(400).json({ error: error.message });
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

router.post('/cargar', upload.single('archivoEstudiantes'), async (req, res) => {
    const filePath = req.file ? req.file.path : null;

    if (!filePath) {
        return res.status(400).json({ error: 'Debe adjuntar el archivo de estudiantes.' });
    }

    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const rows = data.slice(1);

        const sedes = await dbAll('SELECT id, nombre FROM sedes');

        const grados = await dbAll(`
            SELECT g.nombre, s.nombre AS sede
            FROM grados g
            JOIN sedes s ON s.id = g.sede_id
        `);

        const sedeMap = new Map(sedes.map(s => [normalize(s.nombre).toLowerCase(), s]));
        const gradoMap = new Set(grados.map(g => `${normalize(g.sede).toLowerCase()}::${normalize(g.nombre).toLowerCase()}`));

        const registros = [];
        const conteoPorSede = {};

        for (const row of rows) {
            if (!row[0]) continue;
            const documento = normalize(row[0]);
            const sede = normalizeUpper(row[6]);
            const grado = normalizeGrade(row[5]);

            if (!documento || !sede || !grado) continue;

            if (!sedeMap.has(sede.toLowerCase())) {
                const insertSede = await dbRun('INSERT INTO sedes (nombre) VALUES (?)', [sede]);
                sedeMap.set(sede.toLowerCase(), { id: insertSede.lastID, nombre: sede });
            }

            if (!gradoMap.has(`${sede.toLowerCase()}::${grado.toLowerCase()}`)) {
                const sedeData = sedeMap.get(sede.toLowerCase());
                await dbRun('INSERT OR IGNORE INTO grados (nombre, sede_id) VALUES (?, ?)', [grado, sedeData.id]);
                gradoMap.add(`${sede.toLowerCase()}::${grado.toLowerCase()}`);
            }

            conteoPorSede[sede] = (conteoPorSede[sede] || 0) + 1;
            registros.push({
                documento,
                primer_apellido: normalizeUpper(row[1]),
                segundo_apellido: normalizeUpper(row[2]),
                primer_nombre: normalizeUpper(row[3]),
                segundo_nombre: normalizeUpper(row[4]),
                grado,
                sede
            });
        }

        const mesasPorSede = req.body.mesas_por_sede ? JSON.parse(req.body.mesas_por_sede) : {};
        const asignacionMesas = {};

        Object.entries(conteoPorSede).forEach(([sede, cantidad]) => {
            if (cantidad <= 50) {
                asignacionMesas[sede] = 1;
                return;
            }
            const mesas = Number(mesasPorSede[sede]);
            if (!mesas || mesas < 1) {
                throw new Error(`Debe indicar cuántas mesas habilitar en la sede ${sede}.`);
            }
            asignacionMesas[sede] = mesas;
        });

        await dbRun('BEGIN TRANSACTION');
        await dbRun("DELETE FROM usuarios WHERE rol = 'MVOTACION'");
        await dbRun('DELETE FROM control_mesas');

        const sedeOffsets = {};
        let mesaGlobal = 1;
        Object.entries(asignacionMesas).forEach(([sede, cant]) => {
            sedeOffsets[sede] = { inicio: mesaGlobal, cantidad: cant };
            mesaGlobal += cant;
        });

        for (let i = 1; i < mesaGlobal; i++) {
            const userMesa = `mesa.${i}`;
            await dbRun(
                'INSERT INTO usuarios (nombre, usuario, pass, rol, nummesa) VALUES (?, ?, ?, ?, ?)',
                [`MESA ${i}`, userMesa, userMesa, 'MVOTACION', i]
            );
            await dbRun('INSERT INTO control_mesas (num_mesa, estado) VALUES (?, 0)', [i]);
        }

        const asignadosPdf = [];
        let cargados = 0;
        let omitidos = 0;

        for (const r of registros) {
            const existente = await dbGet('SELECT documento FROM estudiantes WHERE documento = ?', [r.documento]);
            if (existente) {
                omitidos++;
                continue;
            }

            const mesaSede = sedeOffsets[r.sede];
            let mesaLocal = mesaSede.cantidad === 1 ? 1 : Math.floor(Math.random() * mesaSede.cantidad) + 1;
            if (r.grado === 'TRANSICIÓN') mesaLocal = 1;
            if (r.grado === 'PRIMERO' && mesaSede.cantidad > 1) mesaLocal = 2;
            const mesa = mesaSede.inicio + (mesaLocal - 1);

            await dbRun(
                `INSERT INTO estudiantes (documento, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, grado, sede_educativa, mesa)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.documento, r.primer_apellido, r.segundo_apellido, r.primer_nombre, r.segundo_nombre, r.grado, r.sede, mesa]
            );

            asignadosPdf.push({ documento: r.documento, sede: r.sede, mesa });
            cargados++;
        }

        await dbRun('COMMIT');

        res.json({
            success: true,
            message: `Carga masiva completada. Cargados: ${cargados}. Omitidos por documento repetido: ${omitidos}.`,
            resumen: conteoPorSede,
            mesas: asignacionMesas,
            asignados_pdf: asignadosPdf
        });
    } catch (error) {
        await dbRun('ROLLBACK').catch(() => {});
        res.status(400).json({ error: error.message });
    } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
});

router.get('/resumen', async (req, res) => {
    try {
        const porSede = await dbAll('SELECT sede_educativa as sede, COUNT(*) as estudiantes FROM estudiantes GROUP BY sede_educativa');
        const total = await dbGet('SELECT COUNT(*) as total FROM estudiantes');
        res.json({ total: total.total, porSede });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;