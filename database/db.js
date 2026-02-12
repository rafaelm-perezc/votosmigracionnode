const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crea el archivo de base de datos localmente
const dbPath = path.resolve(__dirname, 'votaciones.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con la base de datos:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
        initDb();
    }
});

// Función para inicializar tablas (Reemplaza tu votaciones.sql)
function initDb() {
    const usuariosTable = `
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario TEXT NOT NULL UNIQUE,
            pass TEXT NOT NULL,
            rol TEXT NOT NULL,
            nummesa INTEGER NULL
        );
    `;

    const estudiantesTable = `
        CREATE TABLE IF NOT EXISTS estudiantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documento TEXT NOT NULL UNIQUE,
            primer_apellido TEXT NOT NULL,
            segundo_apellido TEXT NOT NULL,
            primer_nombre TEXT NOT NULL,
            segundo_nombre TEXT NOT NULL,
            grado TEXT NOT NULL,
            sede_educativa TEXT NOT NULL,
            mesa INTEGER DEFAULT 0
        );
    `;

    const votosTable = `
        CREATE TABLE IF NOT EXISTS votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documento TEXT NOT NULL,
            candidatoPersonero TEXT NOT NULL,
            candidatoContralor TEXT NOT NULL,
            fecha_voto DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    db.serialize(() => {
        db.run(usuariosTable);
        db.run(estudiantesTable);
        db.run(votosTable);

        // Insertar usuario administrador por defecto si no existe
        // Reemplaza el INSERT INTO usuarios del .sql
        const sqlCheckAdmin = "SELECT id FROM usuarios WHERE usuario = ?";
        db.get(sqlCheckAdmin, ['rafael.perez'], (err, row) => {
            if (!row) {
                const insertAdmin = `
                    INSERT INTO usuarios (nombre, usuario, pass, rol) 
                    VALUES ('RAFAEL MAURICIO PEREZ CAMPOS', 'rafael.perez', '1079174205', 'ADMINISTRADOR')
                `;
                db.run(insertAdmin, (err) => {
                    if (err) console.error("Error creando admin:", err);
                    else console.log("👤 Usuario Administrador creado por defecto.");
                });
                
                // Crear mesas por defecto (Ejemplo basado en tu SQL)
                for(let i=1; i<=6; i++){
                     db.run(`INSERT INTO usuarios (nombre, usuario, pass, rol, nummesa) VALUES ('MESA ${i}', 'mesa.${i}', 'mesa.${i}', 'MVOTACION', ${i})`);
                }
                console.log("🗳️ Usuarios de Mesas creados.");
            }
        });
    });
}

module.exports = db;