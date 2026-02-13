const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Helpers
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));

const estaEnHorario = async () => {
    const rows = await new Promise((resolve, reject) => db.all('SELECT clave, valor FROM configuracion', (err, r) => err ? reject(err) : resolve(r)));
    const cfg = {};
    rows.forEach((r) => { cfg[r.clave] = r.valor; });
    if (cfg.votacion_habilitada === '0') return { ok: false, motivo: 'Las mesas fueron cerradas por administración.' };

    const now = new Date();
    const hoy = now.toISOString().slice(0, 10);
    if (cfg.fecha && cfg.fecha !== hoy) return { ok: false, motivo: 'La votación solo está habilitada en la fecha configurada.' };

    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (cfg.hora_inicio && hhmm < cfg.hora_inicio) return { ok: false, motivo: 'La jornada aún no inicia.' };
    if (cfg.hora_fin && hhmm > cfg.hora_fin) return { ok: false, motivo: 'La jornada de votación ya cerró.' };

    return { ok: true };
};

// 1. JURADO: HABILITAR ESTUDIANTE (Bloquea la mesa para que vote)
router.post('/habilitar', async (req, res) => {
    const { documento, usuario } = req.body;

    try {
        const horario = await estaEnHorario();
        if (!horario.ok) return res.status(403).json({ error: horario.motivo });

        // Obtener mesa del jurado
        const jurado = await dbGet("SELECT nummesa FROM usuarios WHERE usuario = ?", [usuario]);
        if (!jurado || !jurado.nummesa) return res.status(403).json({ error: "Usuario no autorizado." });
        const mesa = jurado.nummesa;

        // Validar estudiante
        const est = await dbGet("SELECT * FROM estudiantes WHERE documento = ?", [documento]);
        if (!est) return res.status(404).json({ error: "Estudiante no encontrado." });
        if (est.mesa !== mesa) return res.status(403).json({ error: `Estudiante pertenece a la mesa ${est.mesa}` });

        // Validar si ya votó
        const voto = await dbGet("SELECT id FROM votos WHERE documento = ?", [documento]);
        if (voto) return res.status(409).json({ error: "El estudiante YA VOTÓ." });

        // ACTIVAR LA MESA (Estado 1 = Votando)
        // Usamos INSERT OR REPLACE para asegurar que la mesa exista en la tabla de control
        const nombreCompleto = `${est.primer_nombre} ${est.primer_apellido}`;
        await dbRun(`INSERT OR REPLACE INTO control_mesas (num_mesa, estado, documento_actual, nombre_estudiante) VALUES (?, 1, ?, ?)`, [mesa, documento, nombreCompleto]);

        res.json({ success: true, nombre: nombreCompleto, mensaje: "Urna desbloqueada. El estudiante puede votar." });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 2. URNA: CONSULTAR ESTADO (Polling constante)
router.get('/estado/:numMesa', async (req, res) => {
    try {
        const row = await dbGet("SELECT * FROM control_mesas WHERE num_mesa = ?", [req.params.numMesa]);
        if (!row) return res.json({ estado: 0 }); // Mesa no inicializada o inactiva
        res.json(row);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// 3. URNA: REGISTRAR VOTO (Y liberar la mesa)
router.post('/registrar', async (req, res) => {
    const { documento, candidatoPersonero, candidatoContralor, numMesa } = req.body;

    try {
        const horario = await estaEnHorario();
        if (!horario.ok) return res.status(403).json({ error: horario.motivo });

        // Verificar duplicado
        const yaVoto = await dbGet("SELECT id FROM votos WHERE documento = ?", [documento]);
        if (yaVoto) return res.status(409).json({ error: "Voto duplicado." });

        // Guardar Voto
        await dbRun("INSERT INTO votos (documento, candidatoPersonero, candidatoContralor) VALUES (?, ?, ?)", [documento, candidatoPersonero, candidatoContralor]);

        // LIBERAR LA MESA (Estado 0 = Esperando)
        await dbRun("UPDATE control_mesas SET estado = 0, documento_actual = NULL, nombre_estudiante = NULL WHERE num_mesa = ?", [numMesa]);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Otras rutas (Exportar excel, etc) se mantienen igual ---
// Agrega aquí tu código de exportar excel si lo necesitas

module.exports = router;