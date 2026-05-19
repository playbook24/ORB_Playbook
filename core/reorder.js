/**
 * core/reorder.js
 * Utilitaire global pour réorganiser les éléments avec persistance locale
 */
const ORBReorder = {
    modal: null,
    currentType: null,
    currentItems: [],
    onSaveCallback: null,

    init() {
        if (!document.getElementById('orb-reorder-modal')) {
            const html = `
            <div id="orb-reorder-modal" class="modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); z-index: 4000; display: flex; justify-content: center; align-items: center;">
                <div style="background: var(--color-container); border-radius: 12px; width: 400px; max-width: 90vw; padding: 25px; box-shadow: var(--shadow-lifted); border: 1px solid var(--color-border); display: flex; flex-direction: column; max-height: 80vh;">
                    <h2 id="orb-reorder-title" style="margin-top: 0; color: var(--color-primary); font-family: var(--font-title);">Réorganiser</h2>
                    <div id="orb-reorder-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex-grow: 1; margin-bottom: 20px; padding-right: 5px;"></div>
                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button id="btn-reorder-cancel" class="btn-secondary" style="padding: 10px 20px; border-radius: 8px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text); cursor: pointer;">Annuler</button>
                        <button id="btn-reorder-save" class="btn-primary">Enregistrer l'ordre</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);

            this.modal = document.getElementById('orb-reorder-modal');
            document.getElementById('btn-reorder-cancel').onclick = () => this.modal.classList.add('hidden');
            document.getElementById('btn-reorder-save').onclick = () => this.save();
        } else {
            this.modal = document.getElementById('orb-reorder-modal');
        }
    },

    open(title, type, items, onSaveCallback) {
        this.init();
        document.getElementById('orb-reorder-title').textContent = title;
        this.currentType = type;
        
        // Sort items first by existing order
        this.currentItems = this.sort([...items], type);
        this.onSaveCallback = onSaveCallback;
        
        this.renderList();
        this.modal.classList.remove('hidden');
    },

    renderList() {
        const listContainer = document.getElementById('orb-reorder-list');
        listContainer.innerHTML = '';
        if (this.currentItems.length === 0) {
            listContainer.innerHTML = '<p style="text-align:center; opacity:0.6;">Rien à réorganiser.</p>';
            return;
        }

        this.currentItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 15px; background:var(--color-background); border:1px solid var(--color-border); border-radius:8px;';
            div.innerHTML = `
                <span style="font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width: 250px;">${item.name || item.title || 'Sans nom'}</span>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon reorder-up" data-index="${index}" style="${index === 0 ? 'opacity:0.3;cursor:default;' : 'color:var(--color-text);'}" ${index === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"/></svg></button>
                    <button class="btn-icon reorder-down" data-index="${index}" style="${index === this.currentItems.length - 1 ? 'opacity:0.3;cursor:default;' : 'color:var(--color-text);'}" ${index === this.currentItems.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:currentColor;"><path d="M7.41,8.59L12,13.17L16.59,8.59L18,10L12,16L6,10L7.41,8.59Z"/></svg></button>
                </div>
            `;
            listContainer.appendChild(div);
        });

        listContainer.querySelectorAll('.reorder-up').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                if (idx > 0) this.swap(idx, idx - 1);
            };
        });
        listContainer.querySelectorAll('.reorder-down').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                if (idx < this.currentItems.length - 1) this.swap(idx, idx + 1);
            };
        });
    },

    swap(i, j) {
        const temp = this.currentItems[i];
        this.currentItems[i] = this.currentItems[j];
        this.currentItems[j] = temp;
        this.renderList();
    },

    save() {
        const orderIds = this.currentItems.map(item => item.id);
        localStorage.setItem(`orb_order_${this.currentType}`, JSON.stringify(orderIds));
        this.modal.classList.add('hidden');
        if (this.onSaveCallback) this.onSaveCallback();
    },

    sort(items, type) {
        const orderStr = localStorage.getItem(`orb_order_${type}`);
        if (!orderStr) return items;
        try {
            const orderArr = JSON.parse(orderStr);
            return items.sort((a, b) => {
                let ia = orderArr.indexOf(a.id);
                let ib = orderArr.indexOf(b.id);
                if (ia === -1) ia = 999999;
                if (ib === -1) ib = 999999;
                return ia - ib;
            });
        } catch(e) { return items; }
    }
};
window.ORBReorder = ORBReorder;
