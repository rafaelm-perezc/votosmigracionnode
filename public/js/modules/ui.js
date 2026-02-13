// public/js/modules/ui.js
export const UI = {
    // Lista de todas las vistas
    sections: [
        'view-login', 'view-mode', 'view-jurado', 'view-urna-espera', 
        'view-tarjeton', 'view-admin', 'view-cargas', 'view-config',
        'view-candidatos', 'view-acta', 'view-sedes', 'view-votos', 'view-resultados'
    ],

    showSection: (sectionId) => {
        // 1. Ocultar todas
        UI.sections.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('is-hidden');
        });

        // 2. Mostrar la deseada
        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.remove('is-hidden');
        } else {
            console.warn(`UI: Sección ${sectionId} no encontrada en el HTML.`);
        }
    },

    toggleAdminMenu: (show) => {
        const btnAdmin = document.getElementById('btnAdmin');
        const btnLogout = document.getElementById('btnLogout');

        // Verificamos que los elementos existan antes de usar classList
        if (show) {
            if(btnAdmin) btnAdmin.classList.remove('is-hidden');
            if(btnLogout) btnLogout.classList.remove('is-hidden');
        } else {
            if(btnAdmin) btnAdmin.classList.add('is-hidden');
            // Logout se maneja aparte o se oculta aquí también
        }
    },
    
    toggleLogout: (show) => {
        const btn = document.getElementById('btnLogout');
        if(btn) {
            show ? btn.classList.remove('is-hidden') : btn.classList.add('is-hidden');
        }
    }
};