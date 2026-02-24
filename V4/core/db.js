/**
 * core/db.js
 * VERSION V4 (v8) - Fix de sécurité des stores
 */

class ORBDatabase {
    constructor() {
        this.dbName = 'ORB_Playbook_Reset_v4';
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            if (this.db) { resolve(this.db); return; }

            const request = indexedDB.open(this.dbName, 8); // Version 8 pour forcer la maj

            request.onerror = (e) => {
                console.error("Erreur d'ouverture BDD", e);
                reject("Erreur BDD");
            };
            
            request.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('playbooks')) db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('trainingPlans')) db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('calendarEvents')) db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('players')) db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('teams')) db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('sheets')) db.createObjectStore('sheets', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('sheetTags')) db.createObjectStore('sheetTags', { keyPath: 'id', autoIncrement: true });
            };
        });
    }

    async savePlaybook(data, preview, id = null) { if (!this.db) await this.open(); return new Promise((res) => { const s = this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks'); const r = { name: data.name || 'Sans nom', playbookData: data, preview: preview, createdAt: new Date().toISOString(), tagIds: data.tagIds || [] }; if (id) r.id = id; const req = id ? s.put(r) : s.add(r); req.onsuccess = e => res(e.target.result); }); }
    async getAllPlaybooks() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['playbooks'], 'readonly').objectStore('playbooks').getAll().onsuccess = e => res(e.target.result); }); }
    async getPlaybook(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['playbooks'], 'readonly').objectStore('playbooks').get(id).onsuccess = e => res(e.target.result); }); }
    async deletePlaybook(id) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks').delete(id).onsuccess = () => res(true); }); }
    
    async savePlan(data, id = null) { if (!this.db) await this.open(); return new Promise(res => { const s = this.db.transaction(['trainingPlans'], 'readwrite').objectStore('trainingPlans'); if(id) data.id = id; const req = id ? s.put(data) : s.add(data); req.onsuccess = e => res(e.target.result); }); }
    async getAllPlans() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['trainingPlans'], 'readonly').objectStore('trainingPlans').getAll().onsuccess = e => res(e.target.result); }); }
    
    async getAllTags() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['tags'], 'readonly').objectStore('tags').getAll().onsuccess = e => res(e.target.result); }); }
    
    async getAllSheetTags() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['sheetTags'], 'readonly').objectStore('sheetTags').getAll().onsuccess = e => res(e.target.result); }); }
    async addSheetTag(name) { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['sheetTags'], 'readwrite').objectStore('sheetTags').add({name}).onsuccess = e => res(e.target.result); }); }

    async saveSheet(data, id = null) { if (!this.db) await this.open(); return new Promise(res => { const s = this.db.transaction(['sheets'], 'readwrite').objectStore('sheets'); if (id) data.id = id; const req = id ? s.put(data) : s.add(data); req.onsuccess = e => res(e.target.result); }); }
    async getAllSheets() { if (!this.db) await this.open(); return new Promise(res => { this.db.transaction(['sheets'], 'readonly').objectStore('sheets').getAll().onsuccess = e => res(e.target.result); }); }
}
const orbDB = new ORBDatabase();