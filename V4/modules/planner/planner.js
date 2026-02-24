/**
 * modules/planner/planner.js
 * V4 - Planificateur avec Miniatures, Drag & Drop et Export PDF
 */
const PlannerModule = {
    currentPlan: { id: null, name: '', notes: '', playbookIds: [] },
    allPlaybooks: [],

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        this.loadGrid();
    },

    cacheDOM() {
        this.grid = document.getElementById('planner-grid');
        this.modal = document.getElementById('plan-editor-modal');
        this.selectorList = document.getElementById('plan-selector-list');
        this.planList = document.getElementById('plan-playbooks-list');
    },

    bindEvents() {
        document.getElementById('plan-editor-close-btn').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('plan-editor-cancel-btn').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('plan-editor-save-btn').onclick = () => this.savePlan();
        
        document.getElementById('plan-selector-search').oninput = (e) => this.renderSelector(e.target.value);
    },

    async loadGrid() {
        const plans = await orbDB.getAllPlans();
        this.grid.innerHTML = '<div class="card-new-plan" id="btn-new-plan">+ Nouvelle Séance</div>';
        
        plans.reverse().forEach(plan => {
            const card = document.createElement('div');
            card.className = 'plan-card';
            card.innerHTML = `
                <h3 style="margin-top:0; color:var(--color-primary);">${plan.name || 'Séance sans nom'}</h3>
                <p style="opacity:0.7; font-size:0.9em;">${plan.playbookIds.length} exercices inclus</p>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn-primary" style="flex:1; padding:8px;" onclick="PlannerModule.editPlan(${plan.id})">Ouvrir</button>
                    <button class="btn-primary" style="flex:1; padding:8px; background:var(--color-container); border:1px solid var(--color-primary); color:var(--color-primary);" onclick="PlannerModule.exportPDF(${plan.id})">PDF</button>
                    <button class="danger" style="padding:8px;" onclick="PlannerModule.deletePlan(${plan.id})">X</button>
                </div>
            `;
            this.grid.appendChild(card);
        });

        document.getElementById('btn-new-plan').onclick = () => this.openEditor();
    },

    async openEditor(plan = null) {
        this.allPlaybooks = await orbDB.getAllPlaybooks();
        this.currentPlan = plan ? { ...plan } : { id: null, name: '', notes: '', playbookIds: [] };
        
        document.getElementById('plan-editor-name').value = this.currentPlan.name;
        document.getElementById('plan-editor-notes').value = this.currentPlan.notes;
        
        this.renderSelector();
        this.renderPlanExos();
        this.modal.classList.remove('hidden');
    },

    renderSelector(filterText = '') {
        this.selectorList.innerHTML = '';
        this.allPlaybooks
            .filter(pb => (pb.name || '').toLowerCase().includes(filterText.toLowerCase()))
            .forEach(pb => {
                const item = document.createElement('div');
                item.className = 'selector-item';
                
                let previewUrl = '';
                if (pb.preview instanceof Blob) {
                    try { previewUrl = URL.createObjectURL(pb.preview); } catch(e){}
                }

                item.innerHTML = `
                    ${previewUrl ? `<img src="${previewUrl}" alt="Aperçu">` : `<div style="width:70px; height:45px; background:var(--color-background); border:1px solid var(--color-border); border-radius:4px;"></div>`}
                    <span style="font-weight:bold;">${pb.name || 'Sans nom'}</span>
                `;
                item.onclick = () => {
                    this.currentPlan.playbookIds.push(pb.id);
                    this.renderPlanExos();
                };
                this.selectorList.appendChild(item);
        });
    },

    renderPlanExos() {
        this.planList.innerHTML = '';
        if (this.currentPlan.playbookIds.length === 0) {
            this.planList.innerHTML = '<li style="opacity: 0.5; font-style: italic;">Piochez des exercices dans la bibliothèque.</li>';
            return;
        }

        this.currentPlan.playbookIds.forEach((id, index) => {
            const pb = this.allPlaybooks.find(p => p.id === id);
            if (!pb) return;
            
            const li = document.createElement('li');
            li.className = 'plan-playbook-item';
            li.draggable = true; // Activer le Drag & Drop
            
            let previewUrl = '';
            if (pb.preview instanceof Blob) {
                try { previewUrl = URL.createObjectURL(pb.preview); } catch(e){}
            }

            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="cursor:grab; font-size:1.5em; opacity:0.5;">⣿</span>
                    ${previewUrl ? `<img src="${previewUrl}" style="width:60px; height:35px; object-fit:cover; border-radius:4px; border:1px solid var(--color-border);">` : `<div style="width:60px; height:35px; background:var(--color-background); border-radius:4px;"></div>`}
                    <span style="font-weight:bold;">${pb.name || 'Sans nom'}</span>
                </div>
                <button class="danger" onclick="PlannerModule.removeExo(${index})">X</button>
            `;

            // --- Logique Drag & Drop ---
            li.ondragstart = (e) => { e.dataTransfer.setData('text/plain', index); li.style.opacity = '0.4'; };
            li.ondragend = () => { li.style.opacity = '1'; };
            li.ondragover = (e) => { e.preventDefault(); };
            li.ondrop = (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    const item = this.currentPlan.playbookIds.splice(fromIndex, 1)[0];
                    this.currentPlan.playbookIds.splice(toIndex, 0, item);
                    this.renderPlanExos(); // Rafraîchit l'ordre
                }
            };

            this.planList.appendChild(li);
        });
    },

    removeExo(index) {
        this.currentPlan.playbookIds.splice(index, 1);
        this.renderPlanExos();
    },

    async savePlan() {
        this.currentPlan.name = document.getElementById('plan-editor-name').value || "Séance " + new Date().toLocaleDateString();
        this.currentPlan.notes = document.getElementById('plan-editor-notes').value;
        await orbDB.savePlan(this.currentPlan, this.currentPlan.id);
        this.modal.classList.add('hidden');
        this.loadGrid();
    },

    async editPlan(id) {
        const plan = await orbDB.getPlan(id);
        this.openEditor(plan);
    },

    async deletePlan(id) {
        if(confirm("Supprimer définitivement cette séance ?")) {
            await orbDB.deletePlan(id);
            this.loadGrid();
        }
    },

    // --- NOUVEAU : EXPORT PDF (Comme dans la V3) ---
    async exportPDF(id) {
        if (typeof window.jspdf === 'undefined') return alert("Erreur: jsPDF non chargé.");
        
        const plan = await orbDB.getPlan(id);
        if (!plan) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Titre
        doc.setFillColor('#BFA98D'); // Or ORB
        doc.rect(0, 0, 210, 25, 'F');
        doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor('#000000');
        doc.text((plan.name || 'Séance').toUpperCase(), 105, 16, { align: 'center' });

        // Notes / Objectifs
        doc.setFontSize(11); doc.setTextColor('#333333');
        if (plan.notes) {
            doc.text("OBJECTIFS :", 20, 35);
            doc.setFont("helvetica", "normal");
            doc.text(doc.splitTextToSize(plan.notes, 170), 20, 42);
        }

        let yPos = plan.notes ? 60 : 35;
        
        // Boucle sur les exercices
        for (let i = 0; i < plan.playbookIds.length; i++) {
            const pbId = plan.playbookIds[i];
            const pb = await orbDB.getPlaybook(pbId);
            if (!pb) continue;

            if (yPos > 240) { doc.addPage(); yPos = 20; } // Nouvelle page si on dépasse

            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor('#000000');
            doc.text(`${i + 1}. ${pb.name || 'Exercice'}`, 20, yPos);
            yPos += 8;

            if (pb.preview instanceof Blob) {
                // Conversion du Blob en DataURL pour le PDF
                const base64Img = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(pb.preview);
                });
                // Image (Ratio Terrain)
                doc.addImage(base64Img, 'JPEG', 20, yPos, 100, 53); 
                yPos += 65;
            } else {
                yPos += 10;
            }
        }

        doc.save(`${plan.name || 'Plan_ORB'}.pdf`);
    }
};

document.addEventListener('DOMContentLoaded', () => PlannerModule.init());