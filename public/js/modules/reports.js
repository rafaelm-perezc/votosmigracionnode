import { API } from './api.js';

let liveInterval = null;

export const Reports = {
    renderActa: async (containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '<p class="has-text-centered">Cargando resultados...</p>';

        try {
            const data = await API.get('/admin/acta');
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

                    <br><br>
                    <div class="columns has-text-centered mt-6 is-mobile">
                        <div class="column">
                            ${data.config.firma_rector ? `<img src="${data.config.firma_rector}" style="max-height:80px">` : ''}
                            <div style="border-top: 1px solid #000; margin: 0 20px;"></div>
                            <p><strong>${data.config.rector || 'RECTOR'}</strong><br>Rector(a)</p>
                        </div>
                        <div class="column">
                            ${data.config.firma_lider ? `<img src="${data.config.firma_lider}" style="max-height:80px">` : ''}
                            <div style="border-top: 1px solid #000; margin: 0 20px;"></div>
                            <p><strong>${data.config.lider || 'LÍDER'}</strong><br>Líder Proyecto</p>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        } catch {
            container.innerHTML = '<p class="has-text-danger">Error cargando el acta.</p>';
        }
    },

    buildTable: (titulo, datos) => {
        const rows = datos.map((d) => `
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
            margin: 1,
            filename: 'Acta_Escrutinio.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    },

    iniciarResultadosVivo: () => {
        Reports.detenerResultadosVivo();
        const render = async () => {
            const data = await API.get('/admin/resultados-vivo');
            Reports.renderSimpleBars('chartPersonero', data.personero);
            Reports.renderSimpleBars('chartContralor', data.contralor);
        };
        render();
        liveInterval = setInterval(render, 500);
    },

    detenerResultadosVivo: () => {
        if (liveInterval) clearInterval(liveInterval);
    },

    renderSimpleBars: (id, rows) => {
        const container = document.getElementById(id);
        if (!container) return;
        const max = Math.max(...rows.map((r) => r.votos), 1);
        container.innerHTML = rows.map((r) => `
            <div style="margin-bottom:8px;">
                <div style="font-size:12px">${r.candidato} (${r.votos})</div>
                <div style="background:#eaeaea;height:20px;border-radius:6px;overflow:hidden;">
                    <div style="width:${(r.votos * 100) / max}%;background:#209cee;height:100%"></div>
                </div>
            </div>
        `).join('');
    }
};