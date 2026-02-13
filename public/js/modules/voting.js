import { API } from './api.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

let pollingInterval = null;
let documentoVotante = '';
let nombreVotante = '';
let votoPersonero = '';
let votoContralor = '';

export const Voting = {
    // --- LÓGICA DEL JURADO ---
    habilitarVotante: async () => {
        const docInput = document.getElementById('inputDocumento');
        const doc = docInput.value.trim();
        const jurado = Auth.getUser();

        if (!doc) return Swal.fire('Atención', 'Ingrese documento', 'warning');

        try {
            const res = await API.post('/votos/habilitar', { 
                documento: doc, 
                usuario: jurado.usuario 
            });

            if (res.success) {
                docInput.value = '';
                Swal.fire({
                    icon: 'success',
                    title: 'Urna Habilitada',
                    text: `Estudiante: ${res.nombre}. La urna digital ha sido desbloqueada.`,
                    timer: 3000
                });
            } else {
                Swal.fire('Error', res.error, 'error');
            }
        } catch (e) {
            Swal.fire('Atención', e.message || 'Error de conexión', 'error');
        }
    },

    // --- LÓGICA DE LA URNA (POLLING) ---
    iniciarModoUrna: () => {
        const mesa = Auth.getUser().nummesa;
        UI.showSection('view-urna-espera');
        document.getElementById('lblMesaEspera').textContent = mesa;
        
        // Iniciar chequeo constante
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(async () => {
            try {
                const status = await API.get(`/votos/estado/${mesa}`);
                
                // Si estado es 1 (VOTANDO), mostramos tarjetón
                if (status.estado === 1) {
                    clearInterval(pollingInterval);
                    documentoVotante = status.documento_actual;
                    nombreVotante = status.nombre_estudiante;
                    document.getElementById('lblEstudianteVotando').textContent = nombreVotante;
                    Voting.mostrarTarjeton('Personero');
                }

                if (status.cerrada) {
                    clearInterval(pollingInterval);
                    await Swal.fire('Votaciones cerradas', status.motivo || 'Las votaciones no están habilitadas.', 'info');
                }
            } catch (e) { console.error('Error polling', e); }
        }, 2000);
    },

    mostrarTarjeton: async (cargo) => {
        UI.showSection('view-tarjeton');
        document.getElementById('tituloCargo').textContent = `Elección de ${cargo}`;
        const container = document.getElementById('contenedorCandidatos');
        container.innerHTML = '<div class="loader"></div>';

        try {
            const candidatos = await API.get('/admin/candidatos');
            const filtrados = candidatos.filter(c => c.cargo.toLowerCase() === cargo.toLowerCase());
            
            container.innerHTML = '';
            
            // Función auxiliar para crear tarjetas
            const createCard = (nombre, img, esBlanco = false) => {
                const col = document.createElement('div');
                col.className = 'column is-4';
                col.innerHTML = `
                    <div class="card p-4 card-action h-100">
                        <figure class="image is-square">
                            <img src="${img}" class="candidate-img">
                        </figure>
                        <p class="title is-5 mt-2 has-text-centered">${nombre}</p>
                        <button class="button ${esBlanco ? 'is-grey' : 'is-info'} is-small is-fullwidth mt-2">Votar</button>
                    </div>`;
                col.onclick = () => Voting.confirmarVoto(nombre, cargo);
                return col;
            };

            filtrados.forEach(c => container.appendChild(createCard(c.nombre, c.imagen)));
            container.appendChild(createCard('Voto en Blanco', 'img/vb.png', true));

        } catch (e) { container.innerHTML = '<p class="has-text-danger">Error cargando candidatos</p>'; }
    },

    confirmarVoto: (nombre, cargo) => {
        Swal.fire({
            title: `¿Votar por ${nombre}?`,
            text: cargo,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí'
        }).then((result) => {
            if (result.isConfirmed) {
                if (cargo === 'Personero') {
                    votoPersonero = nombre;
                    Voting.mostrarTarjeton('Contralor');
                } else {
                    votoContralor = nombre;
                    Voting.enviarVotoFinal();
                }
            }
        });
    },

    enviarVotoFinal: async () => {
        const mesa = Auth.getUser().nummesa;
        try {
            const res = await API.post('/votos/registrar', {
                documento: documentoVotante,
                candidatoPersonero: votoPersonero,
                candidatoContralor: votoContralor,
                numMesa: mesa
            });

            if (res.success) {
                await Swal.fire({ icon: 'success', title: '¡Voto Registrado!', timer: 2000, showConfirmButton: false });
                // Volver a modo espera y reiniciar polling
                Voting.iniciarModoUrna();
            } else {
                Swal.fire('Error', res.error, 'error');
                Voting.iniciarModoUrna();
            }
        } catch (e) {
            Swal.fire('Atención', e.message || 'No se pudo registrar', 'error');
            Voting.iniciarModoUrna();
        }
    },

    detenerPolling: () => {
        if (pollingInterval) clearInterval(pollingInterval);
    }
};