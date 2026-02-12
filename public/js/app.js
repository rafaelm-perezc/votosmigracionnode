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
        btnLogout.addEventListener('click', () => {
            Voting.detenerPolling();
            Auth.logout();
        });
    }

    // --- APAGAR SERVIDOR ---
    const btnApagar = document.getElementById('btnApagar');
    if(btnApagar) {
        btnApagar.addEventListener('click', async () => {
            if(confirm('¿Seguro que desea APAGAR el servidor? Nadie podrá votar.')) {
                await API.post('/admin/shutdown', {});
                alert('Sistema apagado.');
                window.close();
            }
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
            }
        });
    });

    // Botones "Volver" en admin
    document.querySelectorAll('.btn-back-admin').forEach(btn => {
        btn.addEventListener('click', () => UI.showSection('view-admin'));
    });
    
    // --- FORMULARIOS ADMIN ---
    const btnCargar = document.getElementById('btnCargarEstudiantes');
    if(btnCargar) btnCargar.addEventListener('click', Admin.cargarEstudiantes);

    const formConfig = document.getElementById('formConfig');
    if(formConfig) {
        formConfig.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            await Admin.guardarConfiguracion(new FormData(e.target)); 
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
});