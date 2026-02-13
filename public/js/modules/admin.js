import { API } from './api.js';

export const Admin = {
    cargarEstudiantes: async () => {
        const fileInput = document.getElementById('fileEstudiantes');
        if (!fileInput.files[0]) {
            return Swal.fire('Atención', 'Seleccione el archivo de estudiantes.', 'warning');
        }

        const resumenSedes = await Admin.preanalizarArchivo(fileInput.files[0]);
        if (!resumenSedes) return;

        const mesasPorSede = {};
        for (const [sede, cantidad] of Object.entries(resumenSedes)) {
            if (cantidad <= 50) {
                mesasPorSede[sede] = 1;
                continue;
            }

            const { value, isConfirmed } = await Swal.fire({
                title: `Sede ${sede}`,
                text: `Tiene ${cantidad} estudiantes. ¿Cuántas mesas desea habilitar?`,
                input: 'number',
                inputValue: 2,
                inputAttributes: { min: 1 },
                showCancelButton: true,
                confirmButtonText: 'Continuar'
            });

            if (!isConfirmed) return;
            mesasPorSede[sede] = Number(value || 1);
        }

        const formData = new FormData();
        formData.append('archivoEstudiantes', fileInput.files[0]);
        formData.append('mesas_por_sede', JSON.stringify(mesasPorSede));

        Swal.showLoading();
        try {
            const data = await API.post('/estudiantes/cargar', formData);
            Swal.fire('Éxito', `${data.message}`, 'success');
            fileInput.value = '';
            Admin.cargarResumenEstudiantes();
        } catch (error) {
            Swal.fire('Error', error.message || 'No fue posible cargar estudiantes', 'error');
        }
    },

    preanalizarArchivo: async (file) => {
        try {
            const fd = new FormData();
            fd.append('archivoEstudiantes', file);
            const data = await API.post('/estudiantes/preanalizar', fd);
            return data.sedes || {};
        } catch (error) {
            Swal.fire('Error', 'No se pudo leer el Excel localmente.', 'error');
            return null;
        }
    },

    descargarPlantilla: () => {
        window.open('/api/estudiantes/plantilla', '_blank');
    },

    cargarResumenEstudiantes: async () => {
        const box = document.getElementById('resumenEstudiantes');
        if (!box) return;
        try {
            const data = await API.get('/estudiantes/resumen');
            const items = data.porSede.map((s) => `<li>${s.sede}: <strong>${s.estudiantes}</strong></li>`).join('');
            box.innerHTML = `<p><strong>Total:</strong> ${data.total}</p><ul>${items}</ul>`;
        } catch {
            box.textContent = 'No hay estudiantes cargados.';
        }
    },

    cargarConfiguracion: async () => {
        try {
            const config = await API.get('/admin/config');
            const form = document.getElementById('formConfig');
            Object.keys(config).forEach((key) => {
                if (form.elements[key]) form.elements[key].value = config[key];
            });
            if (document.getElementById('firmaRectorActual')) {
                document.getElementById('firmaRectorActual').src = config.firma_rector || '';
                document.getElementById('firmaLiderActual').src = config.firma_lider || '';
            }
        } catch (e) { console.error(e); }
    },

    guardarConfiguracion: async (formElement) => {
        const formData = new FormData(formElement);
        try {
            const res = await API.post('/admin/config', formData);
            if (res.success) Swal.fire('Guardado', 'Configuración actualizada', 'success');
        } catch (e) { Swal.fire('Error', 'No se pudo guardar', 'error'); }
    },

    cerrarMesas: async () => {
        await API.post('/admin/mesas/cerrar', {});
        Swal.fire('Mesas cerradas', 'La votación se detuvo manualmente.', 'success');
    },

    abrirMesas: async () => {
        await API.post('/admin/mesas/abrir', {});
        Swal.fire('Mesas abiertas', 'La votación quedó habilitada.', 'success');
    },

    cargarCandidatosTabla: async () => {
        try {
            const candidatos = await API.get('/admin/candidatos');
            const tbody = document.getElementById('tablaCandidatos');
            tbody.innerHTML = '';
            candidatos.forEach((c) => {
                tbody.innerHTML += `
                    <tr>
                        <td><img src="${c.imagen}" style="height: 40px; border-radius: 4px;"></td>
                        <td>${c.nombre}</td>
                        <td><span class="tag is-light">${c.cargo}</span></td>
                        <td><button class="button is-small is-danger is-outlined btn-borrar-candidato" data-id="${c.id}">🗑️</button></td>
                    </tr>
                `;
            });
            document.querySelectorAll('.btn-borrar-candidato').forEach((btn) => {
                btn.addEventListener('click', () => Admin.borrarCandidato(btn.dataset.id));
            });
        } catch (e) { console.error(e); }
    },

    crearCandidato: async (formData) => {
        try {
            const res = await API.post('/admin/candidatos', formData);
            if (res.success) {
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
        if (result.isConfirmed) {
            try {
                await API.delete(`/admin/candidatos/${id}`);
                Admin.cargarCandidatosTabla();
            } catch (e) { Swal.fire('Error', 'No se pudo eliminar', 'error'); }
        }
    },

    cargarSedesYGrados: async () => {
        const sedes = await API.get('/admin/sedes');
        const grados = await API.get('/admin/grados');
        const lista = document.getElementById('listaSedesGrados');
        const select = document.getElementById('sedeGrado');
        if (select) select.innerHTML = sedes.map((s) => `<option value="${s.id}">${s.nombre}</option>`).join('');
        const cards = sedes.map((s) => {
            const gs = grados.filter((g) => g.sede_id === s.id).map((g) => g.nombre).join(', ') || 'Sin grados';
            return `<li><strong>${s.nombre}</strong>: ${gs}</li>`;
        }).join('');
        if (lista) lista.innerHTML = cards;
    },

    crearSede: async (nombre) => {
        await API.post('/admin/sedes', { nombre });
        await Admin.cargarSedesYGrados();
    },

    crearGrado: async (sede_id, nombre) => {
        await API.post('/admin/grados', { sede_id, nombre });
        await Admin.cargarSedesYGrados();
    },

    exportarVotosSede: async () => {
        const sede = document.getElementById('sedeVotos').value;
        if (!sede) return;
        window.open(`/api/admin/votos/exportar/${encodeURIComponent(sede)}`, '_blank');
    },

    importarVotos: async () => {
        const file = document.getElementById('fileVotos').files[0];
        if (!file) return Swal.fire('Atención', 'Seleccione el archivo de votos.', 'warning');
        const fd = new FormData();
        fd.append('archivoVotos', file);
        const res = await API.post('/admin/votos/importar', fd);
        Swal.fire('Carga finalizada', `Cargados: ${res.cargados}. Omitidos: ${res.omitidos}`, 'success');
    },

    cargarSelectSedes: async () => {
        const sedes = await API.get('/admin/sedes');
        const select = document.getElementById('sedeVotos');
        if (select) select.innerHTML = sedes.map((s) => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    }
};