// Variables globales
let usuarioLogueado = '';
let rolUsuario = '';
let documentoGlobal = '';
let votoPersonero = '';
let votoContralor = '';

// ==========================================
// INICIO Y SESIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Si estuviéramos guardando sesión en localStorage, aquí verificaríamos
});

async function login() {
    const usuario = document.getElementById('usuario').value.trim();
    const pass = document.getElementById('pass').value.trim();
    if (!usuario || !pass) return Swal.fire('Error', 'Ingrese usuario y contraseña', 'warning');

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, pass })
        });
        const data = await res.json();

        if (data.success) {
            usuarioLogueado = data.data.usuario;
            rolUsuario = data.data.rol;
            
            document.getElementById('login').classList.add('section-hidden');
            document.getElementById('logoutButton').classList.remove('section-hidden');

            if (rolUsuario === 'ADMINISTRADOR') {
                document.getElementById('admon').classList.remove('section-hidden');
                document.getElementById('viewFunction').classList.remove('section-hidden');
            } else {
                document.getElementById('validacion').classList.remove('section-hidden');
                if (data.data.nummesa) Swal.fire('Bienvenido', `Mesa #${data.data.nummesa}`, 'info');
                // Cargar candidatos al iniciar sesión para tenerlos listos
                cargarCandidatosVotacion();
            }
        } else {
            Swal.fire('Error', data.error, 'error');
        }
    } catch (e) { console.error(e); Swal.fire('Error', 'Error de conexión', 'error'); }
}

function logout() {
    location.reload(); // La forma más segura de limpiar todo
}

// ==========================================
// VOTACIÓN
// ==========================================
async function cargarCandidatosVotacion() {
    try {
        const res = await fetch('/api/admin/candidatos');
        const candidatos = await res.json();
        
        const renderCards = (lista, contenedorId, tipo) => {
            const container = document.getElementById(contenedorId);
            container.innerHTML = '';
            
            // Filtrar candidatos por tipo (personero/contralor)
            const filtrados = lista.filter(c => c.cargo.toLowerCase() === tipo);
            
            filtrados.forEach(c => {
                container.innerHTML += `
                    <div class="column is-4">
                        <div class="card p-4 card-action" onclick="seleccionarCandidato('${c.nombre}', '${tipo}')">
                            <figure class="image is-square">
                                <img src="${c.imagen}" class="candidate-img" alt="${c.nombre}">
                            </figure>
                            <p class="title is-5 mt-2 has-text-centered">${c.nombre}</p>
                            <button class="button is-info is-small is-fullwidth mt-2">Votar</button>
                        </div>
                    </div>`;
            });

            // Agregar Voto en Blanco siempre
            container.innerHTML += `
                <div class="column is-4">
                    <div class="card p-4 card-action" onclick="seleccionarCandidato('Voto en Blanco', '${tipo}')">
                        <figure class="image is-square">
                            <img src="img/vb.png" class="candidate-img" alt="Voto en Blanco">
                        </figure>
                        <p class="title is-5 mt-2 has-text-centered">Voto en Blanco</p>
                        <button class="button is-grey is-small is-fullwidth mt-2">Votar</button>
                    </div>
                </div>`;
        };

        renderCards(candidatos, 'contenedorPersoneros', 'personero');
        renderCards(candidatos, 'contenedorContralores', 'contralor');

    } catch (e) { console.error("Error cargando candidatos", e); }
}

async function validarDocumento() {
    const doc = document.getElementById('documento').value;
    if (!doc) return Swal.fire('Atención', 'Ingrese documento', 'warning');

    const res = await fetch('/api/votos/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento: doc, usuario: usuarioLogueado })
    });
    const data = await res.json();

    if (data.valid) {
        documentoGlobal = doc;
        Swal.fire({ icon: 'success', title: data.nombre, timer: 1000, showConfirmButton: false });
        document.getElementById('validacion').classList.add('section-hidden');
        document.getElementById('personero').classList.remove('section-hidden');
    } else {
        Swal.fire('Error', data.error, 'error');
    }
}

function seleccionarCandidato(nombre, tipo) {
    Swal.fire({
        title: `¿Votar por ${nombre}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, confirmar'
    }).then((result) => {
        if (result.isConfirmed) {
            if (tipo === 'personero') {
                votoPersonero = nombre;
                document.getElementById('personero').classList.add('section-hidden');
                document.getElementById('contralor').classList.remove('section-hidden');
            } else {
                votoContralor = nombre;
                enviarVoto();
            }
        }
    });
}

async function enviarVoto() {
    const res = await fetch('/api/votos/registrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            documento: documentoGlobal, 
            usuario: usuarioLogueado,
            candidatoPersonero: votoPersonero,
            candidatoContralor: votoContralor
        })
    });
    const data = await res.json();
    
    if (data.success) {
        Swal.fire('Éxito', 'Voto registrado', 'success');
        // Reset
        document.getElementById('contralor').classList.add('section-hidden');
        document.getElementById('validacion').classList.remove('section-hidden');
        document.getElementById('documento').value = '';
    } else {
        Swal.fire('Error', data.error, 'error');
    }
}

// ==========================================
// ADMINISTRACIÓN
// ==========================================
function switchPanel(panelId) {
    // Ocultar todos los paneles de admin
    document.querySelectorAll('.admin-panel').forEach(el => el.classList.add('section-hidden'));
    document.getElementById('admon').classList.add('section-hidden');
    
    if(panelId === 'admon') {
        document.getElementById('admon').classList.remove('section-hidden');
    } else {
        document.getElementById(panelId).classList.remove('section-hidden');
    }
}

// --- Carga Masiva Estudiantes ---
async function subirEstudiantes() {
    const fileInput = document.getElementById('archivoEstudiantes');
    const mesas = document.getElementById('numMesas').value;
    if (!fileInput.files[0] || !mesas) return Swal.fire('Error', 'Complete los campos', 'warning');

    const formData = new FormData();
    formData.append('archivoEstudiantes', fileInput.files[0]);
    formData.append('num_mesas', mesas);

    Swal.showLoading();
    const res = await fetch('/api/estudiantes/cargar', { method: 'POST', body: formData });
    const data = await res.json();
    Swal.fire(data.success ? 'Éxito' : 'Error', data.message || data.error, data.success ? 'success' : 'error');
}

// --- Configuración ---
async function cargarConfigUI() {
    switchPanel('panelConfig');
    const res = await fetch('/api/admin/config');
    const config = await res.json();
    
    document.getElementById('conf_rector').value = config.rector || '';
    document.getElementById('conf_lider').value = config.lider || '';
    document.getElementById('conf_lugar').value = config.lugar || '';
    document.getElementById('conf_fecha').value = config.fecha || '';
    document.getElementById('conf_inicio').value = config.hora_inicio || '';
    document.getElementById('conf_fin').value = config.hora_fin || '';
}

async function guardarConfig() {
    const data = {
        rector: document.getElementById('conf_rector').value,
        lider: document.getElementById('conf_lider').value,
        lugar: document.getElementById('conf_lugar').value,
        fecha: document.getElementById('conf_fecha').value,
        hora_inicio: document.getElementById('conf_inicio').value,
        hora_fin: document.getElementById('conf_fin').value
    };
    
    const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if(result.success) Swal.fire('Guardado', 'Configuración actualizada', 'success');
}

// --- Gestión Candidatos ---
async function cargarGestorCandidatos() {
    switchPanel('panelCandidatos');
    const res = await fetch('/api/admin/candidatos');
    const lista = await res.json();
    
    const tabla = document.getElementById('tablaCandidatos');
    tabla.innerHTML = '';
    
    lista.forEach(c => {
        tabla.innerHTML += `
            <tr>
                <td><img src="${c.imagen}" width="40"></td>
                <td>${c.nombre}</td>
                <td>${c.cargo}</td>
                <td>
                    <button class="button is-small is-danger" onclick="borrarCandidato(${c.id})">Borrar</button>
                </td>
            </tr>
        `;
    });
}

async function crearCandidato() {
    const nombre = document.getElementById('cand_nombre').value;
    const cargo = document.getElementById('cand_cargo').value;
    const foto = document.getElementById('cand_foto').files[0];

    if(!nombre || !foto) return Swal.fire('Error', 'Nombre y Foto obligatorios', 'warning');

    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('cargo', cargo);
    formData.append('foto', foto);

    const res = await fetch('/api/admin/candidatos', { method: 'POST', body: formData });
    const data = await res.json();
    
    if(data.success) {
        Swal.fire('Creado', 'Candidato agregado', 'success');
        cargarGestorCandidatos(); // Recargar tabla
        // Limpiar inputs
        document.getElementById('cand_nombre').value = '';
        document.getElementById('cand_foto').value = '';
    }
}

async function borrarCandidato(id) {
    if(!confirm('¿Eliminar candidato?')) return;
    await fetch(`/api/admin/candidatos/${id}`, { method: 'DELETE' });
    cargarGestorCandidatos();
}

// --- ACTA DE ESCRUTINIO ---
async function generarActa() {
    const res = await fetch('/api/admin/acta');
    const data = await res.json();
    
    // Generar HTML del acta dinámicamente
    let htmlResultados = '';
    
    const agregarTabla = (titulo, datos) => {
        let rows = '';
        datos.forEach(d => {
            rows += `<tr><td>${d.candidato}</td><td class="has-text-right">${d.votos}</td></tr>`;
        });
        return `
            <h4 class="title is-5 mt-4">${titulo}</h4>
            <table class="table is-bordered is-fullwidth">
                <thead><tr><th>Candidato</th><th>Votos</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    };

    htmlResultados += agregarTabla('Personería', data.personero);
    htmlResultados += agregarTabla('Contraloría', data.contralor);

    const contenido = `
        <div class="content">
            <h2 class="title has-text-centered">ACTA DE ESCRUTINIO</h2>
            <p>
                Siendo las <strong>${data.config.hora_fin}</strong> del día <strong>${data.config.fecha}</strong>, 
                en las instalaciones de <strong>${data.config.lugar}</strong>, se procedió al cierre de votaciones.
            </p>
            <p><strong>Total Votos Registrados:</strong> ${data.total}</p>
            ${htmlResultados}
            <br><br><br>
            <div class="columns has-text-centered mt-6">
                <div class="column">
                    <p>__________________________</p>
                    <p><strong>${data.config.rector}</strong><br>Rector(a)</p>
                </div>
                <div class="column">
                    <p>__________________________</p>
                    <p><strong>${data.config.lider}</strong><br>Líder del Proyecto</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('contenidoActa').innerHTML = contenido;
    switchPanel('panelActa');
}

function imprimirActa() {
    window.print();
}