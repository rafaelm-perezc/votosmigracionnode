import { API } from './api.js';

export const Admin = {
    // --- GESTIÓN DE ESTUDIANTES ---
    cargarEstudiantes: async () => {
        const fileInput = document.getElementById('fileEstudiantes');
        const numMesas = document.getElementById('numMesas').value;

        if (!fileInput.files[0] || !numMesas) {
            return Swal.fire('Atención', 'Seleccione un archivo y defina el número de mesas.', 'warning');
        }

        const formData = new FormData();
        formData.append('archivoEstudiantes', fileInput.files[0]);
        formData.append('num_mesas', numMesas);

        Swal.showLoading();
        try {
            const data = await API.post('/estudiantes/cargar', formData);
            Swal.fire(data.success ? 'Éxito' : 'Error', data.message || data.error, data.success ? 'success' : 'error');
            if(data.success) {
                fileInput.value = '';
                document.getElementById('numMesas').value = '';
            }
        } catch (error) {
            Swal.fire('Error', 'Fallo en la carga del archivo', 'error');
        }
    },

    // --- CONFIGURACIÓN ---
    cargarConfiguracion: async () => {
        try {
            const config = await API.get('/admin/config');
            const form = document.getElementById('formConfig');
            // Llenar inputs automáticamente si el name coincide con la clave del JSON
            Object.keys(config).forEach(key => {
                if(form.elements[key]) form.elements[key].value = config[key];
            });
        } catch (e) { console.error(e); }
    },

    guardarConfiguracion: async (formData) => {
        const data = Object.fromEntries(formData.entries());
        try {
            const res = await API.post('/admin/config', data);
            if(res.success) Swal.fire('Guardado', 'Configuración actualizada', 'success');
        } catch (e) { Swal.fire('Error', 'No se pudo guardar', 'error'); }
    },

    // --- GESTIÓN DE CANDIDATOS ---
    cargarCandidatosTabla: async () => {
        try {
            const candidatos = await API.get('/admin/candidatos');
            const tbody = document.getElementById('tablaCandidatos');
            tbody.innerHTML = '';
            
            candidatos.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td><img src="${c.imagen}" style="height: 40px; border-radius: 4px;"></td>
                        <td>${c.nombre}</td>
                        <td><span class="tag is-light">${c.cargo}</span></td>
                        <td>
                            <button class="button is-small is-danger is-outlined btn-borrar-candidato" data-id="${c.id}">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            });

            // Asignar eventos de borrado dinámicamente
            document.querySelectorAll('.btn-borrar-candidato').forEach(btn => {
                btn.addEventListener('click', () => Admin.borrarCandidato(btn.dataset.id));
            });

        } catch (e) { console.error(e); }
    },

    crearCandidato: async (formData) => {
        try {
            const res = await API.post('/admin/candidatos', formData);
            if(res.success) {
                Swal.fire({ icon: 'success', title: 'Candidato agregado', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                document.getElementById('formCandidato').reset();
                Admin.cargarCandidatosTabla();
            } else {
                Swal.fire('Error', res.error, 'error');
            }
        } catch (e) { Swal.fire('Error', 'No se pudo crear el candidato', 'error'); }
    },

    borrarCandidato: async (id) => {
        const result = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar' });
        if(result.isConfirmed) {
            try {
                await API.delete(`/admin/candidatos/${id}`);
                Admin.cargarCandidatosTabla();
            } catch (e) { Swal.fire('Error', 'No se pudo eliminar', 'error'); }
        }
    }
};