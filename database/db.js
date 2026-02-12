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
        // Tablas existentes...
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, usuario TEXT UNIQUE, pass TEXT, rol TEXT, nummesa INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS estudiantes (id INTEGER PRIMARY KEY AUTOINCREMENT, documento TEXT UNIQUE, primer_apellido TEXT, segundo_apellido TEXT, primer_nombre TEXT, segundo_nombre TEXT, grado TEXT, sede_educativa TEXT, mesa INTEGER)`);
        db.run(`CREATE TABLE IF NOT EXISTS votos (id INTEGER PRIMARY KEY AUTOINCREMENT, documento TEXT, candidatoPersonero TEXT, candidatoContralor TEXT, fecha_voto DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS candidatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, cargo TEXT, imagen TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS configuracion (id INTEGER PRIMARY KEY AUTOINCREMENT, clave TEXT UNIQUE, valor TEXT)`);

        // --- NUEVA TABLA: CONTROL DE MESAS ---
        // Estado: 0 (Esperando), 1 (Votando)
        db.run(`CREATE TABLE IF NOT EXISTS control_mesas (
            num_mesa INTEGER PRIMARY KEY,
            estado INTEGER DEFAULT 0,
            documento_actual TEXT DEFAULT NULL,
            nombre_estudiante TEXT DEFAULT NULL
        )`);

        // Insertar Admin por defecto
        const sqlCheckAdmin = "SELECT id FROM usuarios WHERE usuario = ?";
        db.get(sqlCheckAdmin, ['rafael.perez'], (err, row) => {
            if (!row) db.run(`INSERT INTO usuarios (nombre, usuario, pass, rol) VALUES ('ADMINISTRADOR', 'rafael.perez', '1079174205', 'ADMINISTRADOR')`);
        });

        // Configuración por defecto
        const configs = [['fecha', '2026-03-01'], ['hora_inicio', '08:00 A.M.'], ['hora_fin', '02:00 P.M.'], ['lugar', 'Sede Principal'], ['rector', 'NOMBRE RECTOR'], ['lider', 'NOMBRE LIDER']];
        const stmtConfig = db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
        configs.forEach(c => stmtConfig.run(c));
        stmtConfig.finalize();
    });
}

module.exports = db;