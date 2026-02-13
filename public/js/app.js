import { UI } from './modules/ui.js';
import { Auth } from './modules/auth.js';
import { Admin } from './modules/admin.js';
import { Voting } from './modules/voting.js';
import { Reports } from './modules/reports.js';
import { API } from './modules/api.js';

document.addEventListener('DOMContentLoaded', () => {
    
    // Verificar sesión al cargar
    Auth.checkSession();

    // --- LOGIN ---
    const formLogin = document.getElementById('formLogin');
    if(formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            await Auth.login(fd.get('usuario'), fd.get('pass'));
        });
    }

    // --- LOGOUT ---
    const btnLogout = document.getElementById('btnLogout');
    if(btnLogout) {
        btnLogout.addEventListener('click', async () => {
            Voting.detenerPolling();
            const user = Auth.getUser();
            if (user?.rol === 'ADMINISTRADOR') {
                const result = await Swal.fire({
                    title: 'Cerrar sesión de administrador',
                    text: 'También puede cerrar sesión y apagar el servidor.',
                    icon: 'question',
                    showCancelButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'Solo cerrar sesión',
                    denyButtonText: 'Cerrar sesión y apagar'
                });

                if (result.isDenied) {
                    await API.post('/admin/shutdown', {});
                    Auth.logout();
                    return;
                }
                if (!result.isConfirmed) return;
            }
            Auth.logout();
        });
    }

    // --- SELECCIÓN DE MODO (JURADO / URNA) ---
    const btnModeJurado = document.getElementById('btnModeJurado');
    if(btnModeJurado) {
        btnModeJurado.addEventListener('click', () => {
            UI.showSection('view-jurado');
            const user = Auth.getUser();
            const infoMesa = document.getElementById('infoMesa');
            if(infoMesa) {
                infoMesa.textContent = `JURADO - MESA ${user.nummesa}`;
                infoMesa.classList.remove('is-hidden');
            }
        });
    }

    const btnModeUrna = document.getElementById('btnModeUrna');
    if(btnModeUrna) {
        btnModeUrna.addEventListener('click', () => {
            Voting.iniciarModoUrna();
            const user = Auth.getUser();
            const infoMesa = document.getElementById('infoMesa');
            if(infoMesa) {
                infoMesa.textContent = `URNA - MESA ${user.nummesa}`;
                infoMesa.classList.remove('is-hidden');
            }
        });
    }

    // --- ACCIONES GENERALES ---
    const btnValidar = document.getElementById('btnValidar');
    if(btnValidar) btnValidar.addEventListener('click', Voting.habilitarVotante);

    const btnAdmin = document.getElementById('btnAdmin');
    if(btnAdmin) btnAdmin.addEventListener('click', () => UI.showSection('view-admin'));
    
    // --- NAVEGACIÓN DASHBOARD ADMIN ---
    document.querySelectorAll('.card-action').forEach(card => {
        card.addEventListener('click', () => {
            const target = card.dataset.target;
            if(target) {
                UI.showSection(target);
                // Cargar datos según la vista
                if (target === 'view-config') Admin.cargarConfiguracion();
                if (target === 'view-candidatos') Admin.cargarCandidatosTabla();
                if (target === 'view-acta') Reports.renderActa('contenidoActa');
                if (target === 'view-sedes') Admin.cargarSedesYGrados();
                if (target === 'view-cargas') Admin.cargarResumenEstudiantes();
                if (target === 'view-resultados') Reports.iniciarResultadosVivo();
            }
        });
    });

    // Botones "Volver" en admin
    document.querySelectorAll('.btn-back-admin').forEach(btn => {
        btn.addEventListener('click', () => {
            Reports.detenerResultadosVivo();
            UI.showSection('view-admin');
        });
    });
    
    // --- FORMULARIOS ADMIN ---
    const btnCargar = document.getElementById('btnCargarEstudiantes');
    if(btnCargar) btnCargar.addEventListener('click', Admin.cargarEstudiantes);

    const formConfig = document.getElementById('formConfig');
    if(formConfig) {
        formConfig.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            await Admin.guardarConfiguracion(e.target); 
        });
    }

    const formCandidato = document.getElementById('formCandidato');
    if(formCandidato) {
        formCandidato.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            await Admin.crearCandidato(new FormData(e.target)); 
        });
    }

    const btnPDF = document.getElementById('btnDescargarPDF');
    if(btnPDF) btnPDF.addEventListener('click', Reports.downloadPDF);

    const btnPlantilla = document.getElementById('btnDescargarPlantilla');
    if (btnPlantilla) btnPlantilla.addEventListener('click', Admin.descargarPlantilla);

    const btnCerrar = document.getElementById('btnCerrarMesas');
    if (btnCerrar) btnCerrar.addEventListener('click', Admin.cerrarMesas);

    const btnAbrir = document.getElementById('btnAbrirMesas');
    if (btnAbrir) btnAbrir.addEventListener('click', Admin.abrirMesas);

    const formSede = document.getElementById('formSede');
    if (formSede) formSede.addEventListener('submit', async (e) => {
        e.preventDefault();
        await Admin.crearSede(e.target.nombreSede.value);
        e.target.reset();
    });

    const formGrado = document.getElementById('formGrado');
    if (formGrado) formGrado.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sedeSeleccionada = e.target.sede_id.value;
        await Admin.crearGrado(sedeSeleccionada, e.target.nombreGrado.value);
        e.target.nombreGrado.value = '';
        e.target.sede_id.value = sedeSeleccionada;
    });

    const btnImportar = document.getElementById('btnImportarVotos');
    if (btnImportar) btnImportar.addEventListener('click', Admin.importarVotos);

    const btnConsolidado = document.getElementById('btnExportarConsolidado');
    if (btnConsolidado) btnConsolidado.addEventListener('click', Admin.descargarConsolidadoGeneral);

    const btnPlantillaVotos = document.getElementById('btnPlantillaVotos');
    if (btnPlantillaVotos) btnPlantillaVotos.addEventListener('click', Admin.descargarPlantillaVotos);

    const btnCarnets = document.getElementById('btnGenerarCarnets');
    if (btnCarnets) btnCarnets.addEventListener('click', Admin.generarCarnets);

    const btnResetSistema = document.getElementById('btnResetSistema');
    if (btnResetSistema) btnResetSistema.addEventListener('click', Admin.limpiarSistema);
});