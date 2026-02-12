const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const db = require('../database/db');

// Configuración de Multer
const upload = multer({ dest: 'uploads/' });

// Helpers para Promesas
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); });
});

router.post('/cargar', upload.single('archivoEstudiantes'), async (req, res) => {
    const filePath = req.file ? req.file.path : null;
    const numMesas = parseInt(req.body.num_mesas);

    if (!filePath || !numMesas || isNaN(numMesas) || numMesas < 1) {
        if(filePath) fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Archivo o número de mesas inválido." });
    }

    try {
        // 1. Leer Excel
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const rows = data.slice(1); // Omitir encabezados

        await dbRun("BEGIN TRANSACTION");

        // 2. Limpiar sistema (Usuarios de mesa y Estudiantes anteriores)
        // Borramos jurados anteriores para crear los nuevos según la cantidad de mesas
        await dbRun("DELETE FROM usuarios WHERE rol = 'MVOTACION'");
        
        // IMPORTANTE: Borrar estudiantes anteriores para evitar mezcla de datos o registros con mesa 0
        await dbRun("DELETE FROM estudiantes");
        
        // 3. Crear los Usuarios de las Mesas (mesa.1, mesa.2...)
        const stmtUser = await new Promise(resolve => resolve(db.prepare("INSERT INTO usuarios (nombre, usuario, pass, rol, nummesa) VALUES (?, ?, ?, ?, ?)")));
        
        for (let i = 1; i <= numMesas; i++) {
            const userMesa = `mesa.${i}`;
            // Ejemplo: Nombre="MESA 1", Usuario="mesa.1", Pass="mesa.1"
            stmtUser.run([`MESA ${i}`, userMesa, userMesa, 'MVOTACION', i]);
        }
        stmtUser.finalize();

        // 4. Insertar Estudiantes asignando MESA ALEATORIA inmediatamente
        const stmtInsert = await new Promise(resolve => resolve(db.prepare("INSERT INTO estudiantes (documento, primer_apellido, segundo_apellido, primer_nombre, segundo_nombre, grado, sede_educativa, mesa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")));

        let count = 0;
        for (const row of rows) {
            // Validar que la fila tenga al menos el documento
            if (row[0]) {
                const doc = String(row[0]).trim();
                
                // LÓGICA CORREGIDA: Asignar mesa aquí mismo en JS
                // Genera un número entre 1 y numMesas
                const mesaAsignada = Math.floor(Math.random() * numMesas) + 1;

                stmtInsert.run([
                    doc, 
                    row[1] || '', // Primer Apellido
                    row[2] || '', // Segundo Apellido
                    row[3] || '', // Primer Nombre
                    row[4] || '', // Segundo Nombre
                    row[5] || '', // Grado
                    row[6] || '', // Sede
                    mesaAsignada  // <--- Mesa asignada correctamente
                ]);
                count++;
            }
        }
        stmtInsert.finalize();

        // 5. Confirmar transacción
        await dbRun("COMMIT");
        fs.unlinkSync(filePath);

        res.json({
            success: true,
            message: `Carga exitosa y mesas asignadas.`,
            detalles: `Se crearon ${numMesas} mesas y se distribuyeron ${count} estudiantes aleatoriamente.`
        });

    } catch (error) {
        await dbRun("ROLLBACK");
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error("Error carga:", error);
        res.status(500).json({ error: "Error interno: " + error.message });
    }
});

module.exports = router;