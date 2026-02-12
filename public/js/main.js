let documentoGlobal = '';
let candidatoPersonero = '';
let candidatoContralor = '';
let rolUsuario = '';
// Guardamos el usuario logueado para enviarlo en las peticiones
let usuarioLogueado = ''; 

// ==========================================
// GESTIÓN DE SESIÓN
// ==========================================
async function login() {
    const usuario = document.getElementById('usuario').value.trim();
    const pass = document.getElementById('pass').value.trim();

    if (!usuario || !pass) {
        Swal.fire({ icon: 'warning', title: 'Advertencia', text: 'Por favor, ingrese usuario y contraseña.' });
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, pass })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            rolUsuario = data.data.rol;
            usuarioLogueado = data.data.usuario; // Importante: Guardamos el username

            document.getElementById('login').style.display = 'none';
            document.getElementById('logoutButton').style.display = 'block';

            if (rolUsuario === 'ADMINISTRADOR') {
                document.getElementById('admon').style.display = 'block';
                document.getElementById('viewFunction').style.display = 'block';
            } else {
                // Asumimos que es Jurado/Mesa
                document.getElementById('validacion').style.display = 'block';
                document.getElementById('admon').style.display = 'none';
                
                // Mostrar mesa asignada si viene en la data
                if(data.data.nummesa) {
                   Swal.fire({
                        icon: 'info',
                        title: 'Sesión Iniciada',
                        text: `Bienvenido. Usted está asignado a la Mesa #${data.data.nummesa}`,
                        timer: 2000
                   });
                }
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error || 'Credenciales incorrectas' });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Error de conexión', text: 'No se pudo conectar con el servidor.' });
    }
}

function logout() {
    rolUsuario = '';
    usuarioLogueado = '';
    documentoGlobal = '';
    candidatoPersonero = '';
    candidatoContralor = '';
    
    // Resetear UI
    document.getElementById('login').style.display = 'block';
    document.getElementById('logoutButton').style.display = 'none';
    document.getElementById('validacion').style.display = 'none';
    document.getElementById('personero').style.display = 'none';
    document.getElementById('contralor').style.display = 'none';
    document.getElementById('admon').style.display = 'none';
    document.getElementById('cargas').style.display = 'none';
    document.getElementById('viewFunction').style.display = 'none';
    
    // Limpiar campos
    document.getElementById('usuario').value = '';
    document.getElementById('pass').value = '';
    document.getElementById('documento').value = '';
}

// ==========================================
// FLUJO DE VOTACIÓN
// ==========================================
async function validarDocumento() {
    const documento = document.getElementById('documento').value.trim();
    
    if (!documento) {
        Swal.fire({ icon: 'warning', title: 'Advertencia', text: 'Ingrese el número de documento.' });
        return;
    }

    // Enviamos solo documento y usuario para VALIDAR (sin candidatos)
    try {
        const response = await fetch('/api/votos/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                documento: documento, 
                usuario: usuarioLogueado 
            }) 
        });
        const data = await response.json();

        if (data.valid) {
            documentoGlobal = documento;
            // Mostramos el nombre del estudiante devuelto por el servidor
            Swal.fire({
                icon: 'success',
                title: 'Habilitado',
                text: `Estudiante: ${data.nombre}`,
                timer: 1500,
                showConfirmButton: false
            });

            document.getElementById('validacion').style.display = 'none';
            document.getElementById('personero').style.display = 'block';
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error });
        }
    } catch (error) {
        console.error(error);
        Swal.fire({ icon: 'error', title: 'Error', text: 'Error de comunicación con el servidor.' });
    }
}

function votar(candidato, tipo) {
    Swal.fire({
        title: `¿Confirma su voto por: ${candidato}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Votar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            if (tipo === 'personero') {
                candidatoPersonero = candidato;
                document.getElementById('personero').style.display = 'none';
                document.getElementById('contralor').style.display = 'block';
            } else if (tipo === 'contralor') {
                candidatoContralor = candidato;
                enviarVotoFinal();
            }
        }
    });
}

async function enviarVotoFinal() {
    try {
        const response = await fetch('/api/votos/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                documento: documentoGlobal,
                candidatoPersonero: candidatoPersonero,
                candidatoContralor: candidatoContralor,
                usuario: usuarioLogueado
            })
        });
        const data = await response.json();

        if (data.success) {
            Swal.fire({ icon: 'success', title: 'Voto Registrado', text: 'Gracias por participar.' });
            resetVotacion();
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error });
            resetVotacion(); // Resetear para evitar bloqueos
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo registrar el voto.' });
    }
}

function resetVotacion() {
    documentoGlobal = '';
    candidatoPersonero = '';
    candidatoContralor = '';
    document.getElementById('validacion').style.display = 'block';
    document.getElementById('personero').style.display = 'none';
    document.getElementById('contralor').style.display = 'none';
    document.getElementById('documento').value = '';
}

// ==========================================
// ADMINISTRACIÓN Y CARGAS
// ==========================================
function viewFunction(){
    document.getElementById('admon').style.display = 'block';
    document.getElementById('cargas').style.display = 'none';
}

function mostrarCargaEstudiantes() {
    document.getElementById('cargas').style.display = 'block';
    document.getElementById('cargarEstudiantes').style.display = 'block';
    document.getElementById('cargarVotos').style.display = 'none';
    document.getElementById('admon').style.display = 'none';
}

function mostrarCargaVotos() {
    document.getElementById('cargas').style.display = 'block';
    document.getElementById('cargarVotos').style.display = 'block';
    document.getElementById('cargarEstudiantes').style.display = 'none';
    document.getElementById('admon').style.display = 'none';
}

// Helpers para inputs de archivo
document.getElementById('archivoEstudiantes').onchange = function() {
    if(this.files[0]) Swal.fire('Archivo seleccionado', this.files[0].name, 'info');
};
document.getElementById('archivoVotos').onchange = function() {
    if(this.files[0]) Swal.fire('Archivo seleccionado', this.files[0].name, 'info');
};

function confirmarCargaEstudiantes() {
    const archivo = document.getElementById('archivoEstudiantes').files[0];
    const numMesas = document.getElementById('numMesas').value;

    if (archivo && numMesas > 0) {
        enviarArchivo('/api/estudiantes/cargar', 'archivoEstudiantes', archivo, { num_mesas: numMesas });
    } else {
        Swal.fire({ icon: 'warning', text: 'Seleccione archivo y número de mesas válido.' });
    }
}

function confirmarCargaVotos() {
    const archivo = document.getElementById('archivoVotos').files[0];
    if (archivo) {
        enviarArchivo('/api/votos/cargar-historico', 'archivoVotos', archivo);
    } else {
        Swal.fire({ icon: 'warning', text: 'Seleccione un archivo de votos.' });
    }
}

async function enviarArchivo(url, campoArchivo, archivo, extraData = {}) {
    const formData = new FormData();
    formData.append(campoArchivo, archivo);
    
    // Agregar datos extra (como num_mesas)
    for (const key in extraData) {
        formData.append(key, extraData[key]);
    }

    // Mostrar loading
    Swal.fire({ title: 'Procesando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();

        if (data.success) {
            Swal.fire({ icon: 'success', title: 'Éxito', text: data.message });
            // Limpiar inputs
            document.getElementById(campoArchivo).value = '';
            if(extraData.num_mesas) document.getElementById('numMesas').value = '';
        } else {
            Swal.fire({ icon: 'error', title: 'Error', text: data.error });
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Fallo en la subida del archivo.' });
    }
}

function exportarExcel() {
    // Redirige directamente para iniciar la descarga
    window.location.href = '/api/votos/exportar';
}

function exportarEstudiantes() {
    Swal.fire({ icon: 'info', text: 'Funcionalidad de exportación de estudiantes en construcción.' });
    // TODO: Implementar endpoint /api/estudiantes/exportar si es necesario
}