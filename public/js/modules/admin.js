import { API } from './api.js';

const GRADOS_BASE = ['TRANSICIÓN', 'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'UNDÉCIMO'];

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
                title: `SEDE ${sede}`,
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
            Admin.generarPDFMesas(data.asignados_pdf || []);
        } catch (error) {
            Swal.fire('Error', error.message || 'No fue posible cargar estudiantes', 'error');
        }
    },

    generarPDFMesas: (asignados) => {
        if (!asignados.length || typeof html2pdf === 'undefined') return;

        const ordenados = [...asignados].sort((a, b) => {
            const porSede = String(a.sede).localeCompare(String(b.sede), 'es');
            if (porSede !== 0) return porSede;
            const porMesa = Number(a.mesa) - Number(b.mesa);
            if (porMesa !== 0) return porMesa;
            return Number(a.documento) - Number(b.documento);
        });

        const porSede = ordenados.reduce((acc, row) => {
            if (!acc[row.sede]) acc[row.sede] = [];
            acc[row.sede].push(row);
            return acc;
        }, {});

        const wrapper = document.createElement('div');
        wrapper.style.fontFamily = 'Arial, sans-serif';

        wrapper.innerHTML = Object.entries(porSede).map(([sede, rows], index) => `
            <section style="${index > 0 ? 'page-break-before:always;' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                    <img src="img/escudo.png" style="height:80px;" alt="Escudo institución">
                    <div style="text-align:center;">
                        <h2 style="margin:0;">INSTITUCIÓN EDUCATIVA PROMOCIÓN SOCIAL</h2>
                        <p style="margin:0.25rem 0 0 0;"><strong>SEDE:</strong> ${sede}</p>
                        <p style="margin:0.25rem 0 0 0;">ASIGNACIÓN DE MESAS</p>
                    </div>
                    <img src="img/huila.png" style="height:80px;" alt="Escudo departamento">
                </div>
                <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
                    <thead><tr><th>DOCUMENTO</th><th>SEDE</th><th>MESA</th></tr></thead>
                    <tbody>
                        ${rows.map((a) => `<tr><td>${a.documento}</td><td>${a.sede}</td><td>${a.mesa}</td></tr>`).join('')}
                    </tbody>
                </table>
            </section>
        `).join('');

        html2pdf().set({
            margin: [3, 3, 3, 3],
            filename: 'asignacion_mesas.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'cm', format: 'legal', orientation: 'portrait' }
        }).from(wrapper).save();
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

    descargarPlantillaVotos: () => {
        window.open('/api/admin/votos/plantilla', '_blank');
    },

    descargarConsolidadoGeneral: () => {
        window.open('/api/admin/votos/exportar-general', '_blank');
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
                const element = form.elements[key];
                if (!element || element.type === 'file') return;
                element.value = config[key];
            });
            if (document.getElementById('firmaRectorActual')) {
                document.getElementById('firmaRectorActual').src = config.firma_rector ? `/${config.firma_rector}` : '';
                document.getElementById('firmaLiderActual').src = config.firma_lider ? `/${config.firma_lider}` : '';
            }
        } catch (e) { console.error(e); }
    },

    guardarConfiguracion: async (formElement) => {
        const formData = new FormData(formElement);
        try {
            const res = await API.post('/admin/config', formData);
            if (res.success) {
                Swal.fire('Guardado', 'Configuración actualizada', 'success');
                formElement.querySelector('#fileFirmaRector').value = '';
                formElement.querySelector('#fileFirmaLider').value = '';
                await Admin.cargarConfiguracion();
            }
        } catch (e) { Swal.fire('Error', e.message || 'No se pudo guardar', 'error'); }
    },

    cerrarMesas: async () => {
        await API.post('/admin/mesas/cerrar', {});
        Swal.fire('Mesas cerradas', 'La votación se detuvo manualmente.', 'success');
    },

    abrirMesas: async () => {
        await API.post('/admin/mesas/abrir', {});
        Swal.fire('Mesas abiertas', 'La votación quedó habilitada.', 'success');
    },

    generarCarnets: async () => {
        if (typeof html2pdf === 'undefined') return;
        const data = await API.get('/admin/carnets');
        const estudiantes = data.estudiantes || [];
        if (!estudiantes.length) {
            return Swal.fire('Atención', 'No hay estudiantes cargados para generar carnés.', 'warning');
        }

        const wrapper = document.createElement('div');
        wrapper.style.fontFamily = 'Arial, sans-serif';
        wrapper.style.display = 'grid';
        wrapper.style.gridTemplateColumns = 'repeat(2, 1fr)';
        wrapper.style.gap = '0.8rem';

        wrapper.innerHTML = estudiantes.map((e) => {
            const apellidos = `${e.primer_apellido || ''} ${e.segundo_apellido || ''}`.trim();
            const nombres = `${e.primer_nombre || ''} ${e.segundo_nombre || ''}`.trim();
            return `
                <div style="border:1px solid #222;border-radius:10px;padding:0.7rem;min-height:170px;display:flex;flex-direction:column;justify-content:space-between;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <img src="img/escudo.png" style="height:42px;" alt="Escudo institución">
                        <div style="text-align:center;flex:1;padding:0 0.4rem;">
                            <div style="font-size:11px;font-weight:700;">${data.institucion}</div>
                            <div style="font-size:10px;">SEDE: ${e.sede_educativa || data.sedeDefault || 'N/A'}</div>
                        </div>
                        <img src="img/huila.png" style="height:42px;" alt="Escudo departamento">
                    </div>
                    <div style="text-align:center;margin-top:0.4rem;">
                        <div style="font-size:12px;font-weight:700;">DOC. ${e.documento}</div>
                        <div style="font-size:13px;font-weight:700;margin-top:0.4rem;">${apellidos}</div>
                        <div style="font-size:13px;margin-top:0.2rem;">${nombres}</div>
                    </div>
                </div>
            `;
        }).join('');

        html2pdf().set({
            margin: 0.7,
            filename: 'carnets_estudiantes.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'cm', format: 'letter', orientation: 'portrait' }
        }).from(wrapper).save();
    },

    limpiarSistema: async () => {
        const decision = await Swal.fire({
            title: '¿Reiniciar sistema completo?',
            text: 'Se borrarán estudiantes, votos, candidatos, firmas y archivos temporales.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, reiniciar'
        });
        if (!decision.isConfirmed) return;
        const res = await API.post('/admin/reset-sistema', {});
        Swal.fire('Proceso completado', res.message, 'success');
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
            const nombre = String(formData.get('nombre') || '').toUpperCase().trim();
            formData.set('nombre', nombre);
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
        const sedeSelected = select?.value;
        if (select) {
            select.innerHTML = sedes.map((s) => `<option value="${s.id}">${s.nombre}</option>`).join('');
            if (sedeSelected) select.value = sedeSelected;
        }
        const cards = sedes.map((s) => {
            const gs = grados.filter((g) => g.sede_id === s.id).map((g) => `<span class="tag is-light">${g.nombre}<button class="delete is-small ml-1 btn-del-grado" data-id="${g.id}"></button></span>`).join(' ') || 'Sin grados';
            return `<li class="mb-2"><strong>${s.nombre}</strong> <button class="button is-small is-warning is-light btn-editar-sede" data-id="${s.id}" data-nombre="${s.nombre}">Editar</button><br>${gs}</li>`;
        }).join('');
        if (lista) lista.innerHTML = cards;
        document.querySelectorAll('.btn-editar-sede').forEach((btn) => btn.addEventListener('click', () => Admin.editarSede(btn.dataset.id, btn.dataset.nombre)));
        document.querySelectorAll('.btn-del-grado').forEach((btn) => btn.addEventListener('click', () => Admin.eliminarGrado(btn.dataset.id)));
        Admin.renderAsignacionMasiva(sedes);
    },

    renderAsignacionMasiva: (sedes) => {
        const box = document.getElementById('boxAsignacionMasiva');
        if (!box) return;
        box.innerHTML = `
            <h4 class="title is-6">Asignación rápida de grados</h4>
            <p class="mb-2">Seleccione sedes y grados para asignar en lote.</p>
            <div class="mb-2">${sedes.map((s) => `<label class="checkbox mr-3"><input type="checkbox" class="chk-sede" value="${s.id}"> ${s.nombre}</label>`).join('')}</div>
            <div class="mb-2">${GRADOS_BASE.map((g) => `<label class="checkbox mr-3"><input type="checkbox" class="chk-grado" value="${g}"> ${g}</label>`).join('')}</div>
            <button id="btnAsignarMasivo" class="button is-small is-success">Asignar seleccionados</button>
        `;
        document.getElementById('btnAsignarMasivo')?.addEventListener('click', Admin.asignarGradosMasivo);
    },

    asignarGradosMasivo: async () => {
        const sede_ids = [...document.querySelectorAll('.chk-sede:checked')].map((c) => Number(c.value));
        const grados = [...document.querySelectorAll('.chk-grado:checked')].map((c) => c.value);
        if (!sede_ids.length || !grados.length) return Swal.fire('Atención', 'Seleccione sedes y grados.', 'warning');
        await API.post('/admin/grados/asignar', { sede_ids, grados });
        await Admin.cargarSedesYGrados();
    },

    editarSede: async (id, nombreActual) => {
        const { value, isConfirmed } = await Swal.fire({
            title: 'Actualizar sede', input: 'text', inputValue: nombreActual, showCancelButton: true
        });
        if (!isConfirmed) return;
        await API.put(`/admin/sedes/${id}`, { nombre: value });
        await Admin.cargarSedesYGrados();
    },

    crearSede: async (nombre) => {
        await API.post('/admin/sedes', { nombre: String(nombre || '').toUpperCase().trim() });
        await Admin.cargarSedesYGrados();
    },

    crearGrado: async (sede_id, nombre) => {
        await API.post('/admin/grados', { sede_id, nombre: String(nombre || '').toUpperCase().trim() });
        await Admin.cargarSedesYGrados();
    },

    eliminarGrado: async (id) => {
        await API.delete(`/admin/grados/${id}`);
        await Admin.cargarSedesYGrados();
    },

    importarVotos: async () => {
        const file = document.getElementById('fileVotos').files[0];
        if (!file) return Swal.fire('Atención', 'Seleccione el archivo de votos.', 'warning');
        const fd = new FormData();
        fd.append('archivoVotos', file);
        const res = await API.post('/admin/votos/importar', fd);
        Swal.fire('Carga finalizada', `Cargados: ${res.cargados}. Omitidos: ${res.omitidos}`, 'success');
    }
};