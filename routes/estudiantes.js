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
            const sede = normalize(row[6]);
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
        if (!sedes.length) {
            return res.status(400).json({ error: 'Debe registrar las sedes antes de cargar estudiantes.' });
        }

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
            const sede = normalize(row[6]);
            const grado = normalize(row[5]);

            if (!sedeMap.has(sede.toLowerCase())) {
                throw new Error(`La sede "${sede}" no existe en configuración.`);
            }

            if (!gradoMap.has(`${sede.toLowerCase()}::${grado.toLowerCase()}`)) {
                throw new Error(`El grado "${grado}" no está registrado para la sede "${sede}".`);
            }

            conteoPorSede[sede] = (conteoPorSede[sede] || 0) + 1;
            registros.push({
                documento,
                primer_apellido: normalize(row[1]),
                segundo_apellido: normalize(row[2]),
                primer_nombre: normalize(row[3]),
                segundo_nombre: normalize(row[4]),
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
        await dbRun('DELETE FROM estudiantes');
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

        for (const r of registros) {
            const mesaSede = sedeOffsets[r.sede];
            const mesaLocal = mesaSede.cantidad === 1 ? 1 : Math.floor(Math.random() * mesaSede.cantidad) + 1;
            const mesa = mesaSede.inicio + (mesaLocal - 1);

            await dbRun(
                `INSERT INTO estudiantes (documento, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, grado, sede_educativa, mesa)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [r.documento, r.primer_apellido, r.segundo_apellido, r.primer_nombre, r.segundo_nombre, r.grado, r.sede, mesa]
            );
        }

        await dbRun('COMMIT');

        res.json({
            success: true,
            message: 'Carga masiva completada por sedes.',
            resumen: conteoPorSede,
            mesas: asignacionMesas
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