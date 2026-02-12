const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

// Configuración de Multer para subida temporal
const upload = multer({ dest: 'uploads/' });

// Función auxiliar para envolver db.run en Promesa (para usar await)
const dbRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
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

// Ruta: POST /api/estudiantes/cargar
// Recibe: archivoEstudiantes (file) y num_mesas (body)
router.post('/cargar', upload.single('archivoEstudiantes'), async (req, res) => {
    const filePath = req.file ? req.file.path : null;
    const numMesas = parseInt(req.body.num_mesas);

    if (!filePath) {
        return res.status(400).json({ error: "No se ha subido ningún archivo." });
    }

    if (!numMesas || isNaN(numMesas) || numMesas < 1) {
        // Limpiar archivo si hay error
        fs.unlinkSync(filePath); 
        return res.status(400).json({ error: "Número de mesas inválido." });
    }

    try {
        // 1. Leer el archivo Excel
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON (array de arrays para manejar filas sin encabezados estrictos)
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // Omitir la primera fila (encabezados)
        const rows = data.slice(1); 
        let nuevosRegistros = 0;

        // 2. Iniciar Transacción en Base de Datos
        await dbRun("BEGIN TRANSACTION");

        // Preparar sentencias (Prepared Statements son más rápidos)
        // INSERT OR IGNORE evita errores si el documento ya existe
        const stmtInsert = await new Promise(resolve => resolve(db.prepare("INSERT OR IGNORE INTO estudiantes (documento, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, grado, sede_educativa) VALUES (?, ?, ?, ?, ?, ?, ?)")));

        for (const row of rows) {
            // Asegurar que la fila tenga datos y no esté vacía
            if (row[0]) { 
                const doc = String(row[0]).trim();
                // Mapeo según el orden de columnas del Excel original
                stmtInsert.run([
                    doc,                  // Documento
                    row[1] || '',         // Primer Apellido
                    row[2] || '',         // Segundo Apellido
                    row[3] || '',         // Primer Nombre
                    row[4] || '',         // Segundo Nombre
                    row[5] || '',         // Grado
                    row[6] || ''          // Sede
                ]);
                nuevosRegistros++;
            }
        }
        stmtInsert.finalize();

        // 3. Lógica de Asignación de Mesas (Reemplaza al Stored Procedure)
        // Obtenemos todos los IDs de estudiantes
        const estudiantes = await dbAll("SELECT id FROM estudiantes");
        
        let mesaActual = 1;
        const stmtUpdate = await new Promise(resolve => resolve(db.prepare("UPDATE estudiantes SET mesa = ? WHERE id = ?")));

        for (const est of estudiantes) {
            stmtUpdate.run([mesaActual, est.id]);
            
            mesaActual++;
            if (mesaActual > numMesas) {
                mesaActual = 1;
            }
        }
        stmtUpdate.finalize();

        // 4. Confirmar cambios
        await dbRun("COMMIT");

        // Eliminar archivo temporal
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: `Proceso completado con éxito.`,
            detalles: `Se procesaron registros y se asignaron mesas a ${estudiantes.length} estudiantes distribuidos en ${numMesas} mesas.`
        });

    } catch (error) {
        // Si hay error, revertir cambios
        await dbRun("ROLLBACK");
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        
        console.error("Error en carga masiva:", error);
        res.status(500).json({ error: "Error al procesar el archivo: " + error.message });
    }
});

module.exports = router;