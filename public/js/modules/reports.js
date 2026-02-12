// public/js/modules/reports.js
import { API } from './api.js';

export const Reports = {
    renderActa: async (containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '<p class="has-text-centered">Cargando resultados...</p>';
        
        try {
            const data = await API.get('/admin/acta');
            
            // Construir HTML del reporte
            const html = `
                <div class="content">
                    <div class="has-text-centered mb-5">
                        <h2 class="title is-4">ACTA DE ESCRUTINIO</h2>
                        <h3 class="subtitle is-6">Institución Educativa Promoción Social</h3>
                    </div>
                    
                    <div class="box">
                        <p><strong>Lugar:</strong> ${data.config.lugar || '---'}</p>
                        <p><strong>Fecha:</strong> ${data.config.fecha || '---'}</p>
                        <p><strong>Hora Cierre:</strong> ${data.config.hora_fin || '---'}</p>
                        <p><strong>Total Votos:</strong> ${data.total}</p>
                    </div>

                    ${Reports.buildTable('PERSONERÍA', data.personero)}
                    ${Reports.buildTable('CONTRALORÍA', data.contralor)}

                    <br><br><br>
                    <div class="columns has-text-centered mt-6 is-mobile">
                        <div class="column">
                            <div style="border-top: 1px solid #000; margin: 0 20px;"></div>
                            <p><strong>${data.config.rector || 'RECTOR'}</strong><br>Rector(a)</p>
                        </div>
                        <div class="column">
                            <div style="border-top: 1px solid #000; margin: 0 20px;"></div>
                            <p><strong>${data.config.lider || 'LÍDER'}</strong><br>Líder Proyecto</p>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = '<p class="has-text-danger">Error cargando el acta.</p>';
        }
    },

    buildTable: (titulo, datos) => {
        let rows = datos.map(d => `
            <tr>
                <td>${d.candidato}</td>
                <td class="has-text-right font-weight-bold">${d.votos}</td>
            </tr>
        `).join('');

        return `
            <h4 class="title is-5 mt-5 is-uppercase">${titulo}</h4>
            <table class="table is-bordered is-fullwidth is-striped">
                <thead class="has-background-light"><tr><th>Candidato</th><th class="has-text-right">Votos</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    },

    downloadPDF: () => {
        const element = document.getElementById('contenidoActa');
        const opt = {
            margin:       1,
            filename:     'Acta_Escrutinio.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        // Usamos la librería global html2pdf
        html2pdf().set(opt).from(element).save();
    }
};