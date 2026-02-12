const express = require('express');
const router = express.Router();
const db = require('../database/db');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');

// Configuración de subida temporal
const upload = multer({ dest: 'uploads/' });

// --- Funciones Auxiliares (Promesas para SQLite) ---
const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// ==========================================
// 1. REGISTRAR VOTO O VALIDAR ESTUDIANTE
// ==========================================
// Reemplaza: votar.php
router.post('/registrar', async (req, res) => {
    const { documento, candidatoPersonero, candidatoContralor, usuario } = req.body;

    if (!usuario) {
        return res.status(400).json({ error: "Usuario (Jurado) no especificado." });
    }

    try {
        // 1. Verificar Jurado y obtener su mesa
        const rowUsuario = await dbGet("SELECT nummesa FROM usuarios WHERE usuario = ?", [usuario]);
        
        if (!rowUsuario) {
            return res.status(404).json({ error: "Usuario jurado no encontrado." });
        }
        const mesaJurado = rowUsuario.nummesa;

        // 2. Verificar si el estudiante existe
        const rowEstudiante = await dbGet("SELECT * FROM estudiantes WHERE documento = ?", [documento]);

        if (!rowEstudiante) {
            return res.status(404).json({ error: "El número de documento no está registrado en la base de datos." });
        }

        // 3. Verificar asignación de mesa
        // Nota: Convertimos a String/Int explícitamente para evitar errores de comparación
        if (rowEstudiante.mesa != mesaJurado) {
            const nombreCompleto = `${rowEstudiante.primer_nombre} ${rowEstudiante.primer_apellido}`;
            return res.status(403).json({ 
                error: `El estudiante ${nombreCompleto} pertenece a la MESA ${rowEstudiante.mesa}, no a esta mesa (${mesaJurado}).` 
            });
        }

        // 4. Verificar si ya votó
        const rowVoto = await dbGet("SELECT id FROM votos WHERE documento = ?", [documento]);
        
        if (rowVoto) {
            return res.status(409).json({ error: "⛔ ESTE ESTUDIANTE YA VOTÓ. El fraude es un delito." });
        }

        // 5. Acción: ¿Solo validar o Registrar Voto?
        // Si vienen los candidatos, guardamos el voto. Si no, solo devolvemos que es válido.
        if (candidatoPersonero && candidatoContralor) {
            await dbRun(
                "INSERT INTO votos (documento, candidatoPersonero, candidatoContralor) VALUES (?, ?, ?)", 
                [documento, candidatoPersonero, candidatoContralor]
            );
            return res.json({ success: "✅ Voto registrado con éxito." });
        } else {
            // Solo validación exitosa (para habilitar la interfaz de tarjetones)
            const nombreEstudiante = `${rowEstudiante.primer_nombre} ${rowEstudiante.primer_apellido}`;
            return res.json({ 
                valid: "Documento validado", 
                nombre: nombreEstudiante 
            });
        }

    } catch (error) {
        console.error("Error en votación:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// ==========================================
// 2. CARGA MASIVA DE VOTOS (HISTÓRICO)
// ==========================================
// Reemplaza: cargar_votos.php
router.post('/cargar-historico', upload.single('archivoVotos'), async (req, res) => {
    const filePath = req.file ? req.file.path : null;

    if (!filePath) {
        return res.status(400).json({ error: "No se subió ningún archivo." });
    }

    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const rows = data.slice(1); // Omitir encabezados

        let nuevosRegistros = 0;

        await dbRun("BEGIN TRANSACTION");

        const stmtCheck = await new Promise(resolve => resolve(db.prepare("SELECT id FROM votos WHERE documento = ?")));
        const stmtInsert = await new Promise(resolve => resolve(db.prepare("INSERT INTO votos (documento, candidatoPersonero, candidatoContralor) VALUES (?, ?, ?)")));

        for (const row of rows) {
            const doc = row[0];
            const candP = row[1];
            const candC = row[2];

            if (doc && candP && candC) {
                // Verificar duplicado manualmente dentro de la transacción
                const existe = await new Promise((resolve, reject) => {
                    stmtCheck.get([doc], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });

                if (!existe) {
                    stmtInsert.run([doc, candP, candC]);
                    nuevosRegistros++;
                }
            }
        }

        stmtCheck.finalize();
        stmtInsert.finalize();
        await dbRun("COMMIT");

        fs.unlinkSync(filePath); // Limpiar archivo

        res.json({ 
            success: true, 
            message: `Carga completada. Se agregaron ${nuevosRegistros} votos históricos.` 
        });

    } catch (error) {
        await dbRun("ROLLBACK");
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error("Error carga votos:", error);
        res.status(500).json({ error: "Error al procesar archivo: " + error.message });
    }
});

// ==========================================
// 3. EXPORTAR RESULTADOS (EXCEL)
// ==========================================
// Reemplaza: exportar_excel.php
router.get('/exportar', async (req, res) => {
    try {
        // Consultas de conteo
        const votosPersonero = await dbAll("SELECT candidatoPersonero AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoPersonero ORDER BY votos DESC");
        const votosContralor = await dbAll("SELECT candidatoContralor AS candidato, COUNT(*) AS votos FROM votos GROUP BY candidatoContralor ORDER BY votos DESC");

        // Crear Libro de Excel
        const wb = xlsx.utils.book_new();

        // Hoja Personero
        const wsPersonero = xlsx.utils.json_to_sheet(votosPersonero);
        xlsx.utils.book_append_sheet(wb, wsPersonero, "Personero");

        // Hoja Contralor
        const wsContralor = xlsx.utils.json_to_sheet(votosContralor);
        xlsx.utils.book_append_sheet(wb, wsContralor, "Contralor");

        // Generar Buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Enviar al cliente
        res.setHeader('Content-Disposition', 'attachment; filename="Resultados_Votaciones.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error("Error exportando:", error);
        res.status(500).send("Error generando el reporte.");
    }
});

module.exports = router;