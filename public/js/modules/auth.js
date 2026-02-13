import { API } from './api.js';
import { UI } from './ui.js';

// Intentar recuperar usuario guardado al cargar
let currentUser = JSON.parse(localStorage.getItem('voto_user')) || null;

export const Auth = {
    checkSession: () => {
        if (currentUser) {
            Auth.handleLoginSuccess();
        } else {
            UI.showSection('view-login');
        }
    },

    login: async (usuario, pass) => {
        const data = await API.post('/auth/login', { usuario, pass });
        
        if (data.success) {
            currentUser = data.data;
            localStorage.setItem('voto_user', JSON.stringify(currentUser));
            Auth.handleLoginSuccess();
        } else {
            Swal.fire('Error', data.error || 'Credenciales inválidas', 'error');
        }
    },

    handleLoginSuccess: () => {
        if (!currentUser) return;

        UI.toggleLogout(true);
        const loginSection = document.getElementById('view-login');
        if (loginSection) loginSection.classList.add('is-hidden');

        if (currentUser.rol === 'ADMINISTRADOR') {
            UI.toggleAdminMenu(true);
            UI.showSection('view-admin');
        } else {
            // JURADO / URNA
            UI.toggleAdminMenu(false);
            // ENVIAR A SELECCIÓN DE MODO (NUEVO)
            UI.showSection('view-mode');
        }
    },

    logout: () => {
        currentUser = null;
        localStorage.removeItem('voto_user');
        
        UI.toggleAdminMenu(false);
        UI.toggleLogout(false);
        UI.showSection('view-login');
        document.getElementById('formLogin').reset();
    },

    getUser: () => {
        if (!currentUser) {
            currentUser = JSON.parse(localStorage.getItem('voto_user'));
        }
        return currentUser;
    }
};