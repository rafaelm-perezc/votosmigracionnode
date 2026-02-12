const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'votaciones.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ Error DB:', err.message);
    else {
        console.log('✅ Base de datos conectada.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Tabla Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            pass TEXT NOT NULL,
            rol TEXT NOT NULL,
            nummesa INTEGER NULL
        )`);

        // Tabla Estudiantes
        db.run(`CREATE TABLE IF NOT EXISTS estudiantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documento TEXT NOT NULL UNIQUE,
            primer_apellido TEXT NOT NULL,
            segundo_apellido TEXT NOT NULL,
            primer_nombre TEXT NOT NULL,
            segundo_nombre TEXT NOT NULL,
            grado TEXT NOT NULL,
            sede_educativa TEXT NOT NULL,
            mesa INTEGER DEFAULT 0
        )`);

        // Tabla Votos
        db.run(`CREATE TABLE IF NOT EXISTS votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documento TEXT NOT NULL,
            candidatoPersonero TEXT NOT NULL,
            candidatoContralor TEXT NOT NULL,
            fecha_voto DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // NUEVA: Tabla Candidatos
        db.run(`CREATE TABLE IF NOT EXISTS candidatos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            cargo TEXT NOT NULL,
            imagen TEXT NOT NULL
        )`);

        // NUEVA: Tabla Configuración
        db.run(`CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT NOT NULL UNIQUE,
            valor TEXT NOT NULL
        )`);

        // Insertar Admin y Configuración por defecto
        const sqlCheckAdmin = "SELECT id FROM usuarios WHERE usuario = ?";
        db.get(sqlCheckAdmin, ['rafael.perez'], (err, row) => {
            if (!row) {
                db.run(`INSERT INTO usuarios (nombre, usuario, pass, rol) VALUES ('ADMINISTRADOR', 'rafael.perez', '1079174205', 'ADMINISTRADOR')`);
                // Crear mesas
                for(let i=1; i<=6; i++) db.run(`INSERT INTO usuarios (nombre, usuario, pass, rol, nummesa) VALUES ('MESA ${i}', 'mesa.${i}', 'mesa.${i}', 'MVOTACION', ${i})`);
            }
        });

        // Valores por defecto Configuración
        const configs = [
            ['fecha', '2026-03-01'], ['hora_inicio', '08:00 A.M.'], ['hora_fin', '02:00 P.M.'],
            ['lugar', 'Sede Principal'], ['rector', 'NOMBRE DEL RECTOR'], ['lider', 'NOMBRE DEL LÍDER']
        ];
        const stmtConfig = db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
        configs.forEach(c => stmtConfig.run(c));
        stmtConfig.finalize();
    });
}

module.exports = db;