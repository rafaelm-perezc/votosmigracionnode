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

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        err ? reject(err) : resolve(this);
    });
});

function createSchema() {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, usuario TEXT UNIQUE, pass TEXT, rol TEXT, nummesa INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS estudiantes (id INTEGER PRIMARY KEY AUTOINCREMENT, documento TEXT UNIQUE, primer_apellido TEXT, segundo_apellido TEXT, primer_nombre TEXT, segundo_nombre TEXT, grado TEXT, sede_educativa TEXT, mesa INTEGER)`);
    db.run(`CREATE TABLE IF NOT EXISTS votos (id INTEGER PRIMARY KEY AUTOINCREMENT, documento TEXT, candidatoPersonero TEXT, candidatoContralor TEXT, fecha_voto DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS candidatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, cargo TEXT, imagen TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS configuracion (id INTEGER PRIMARY KEY AUTOINCREMENT, clave TEXT UNIQUE, valor TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS sedes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE NOT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS grados (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, sede_id INTEGER NOT NULL, UNIQUE(nombre, sede_id), FOREIGN KEY(sede_id) REFERENCES sedes(id) ON DELETE CASCADE)`);
    db.run(`CREATE TABLE IF NOT EXISTS control_mesas (
        num_mesa INTEGER PRIMARY KEY,
        estado INTEGER DEFAULT 0,
        documento_actual TEXT DEFAULT NULL,
        nombre_estudiante TEXT DEFAULT NULL
    )`);

    const sqlCheckAdmin = 'SELECT id FROM usuarios WHERE usuario = ?';
    db.get(sqlCheckAdmin, ['admin'], (err, row) => {
        if (!row) db.run(`INSERT INTO usuarios (nombre, usuario, pass, rol) VALUES ('ADMINISTRADOR', 'admin', 'admin', 'ADMINISTRADOR')`);
    });

    const configs = [
        ['fecha', '2026-03-01'],
        ['hora_inicio', '08:00'],
        ['hora_fin', '14:00'],
        ['lugar', 'SEDE CRISTOBAL COLÓN'],
        ['rector', 'NOMBRE RECTOR'],
        ['lider', 'NOMBRE LIDER'],
        ['firma_rector', ''],
        ['firma_lider', ''],
        ['votacion_habilitada', '1']
    ];
    const stmtConfig = db.prepare('INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)');
    configs.forEach((c) => stmtConfig.run(c));
    stmtConfig.finalize();
}

function initDb() {
    db.serialize(() => {
        createSchema();
    });
}

async function resetDatabase() {
    const tablas = ['control_mesas', 'votos', 'estudiantes', 'candidatos', 'grados', 'sedes', 'configuracion', 'usuarios'];
    await dbRun('PRAGMA foreign_keys = OFF');
    for (const tabla of tablas) {
        await dbRun(`DROP TABLE IF EXISTS ${tabla}`);
    }
    await dbRun('PRAGMA foreign_keys = ON');
    await new Promise((resolve) => {
        db.serialize(() => {
            createSchema();
            resolve();
        });
    });
}

module.exports = db;
module.exports.resetDatabase = resetDatabase;