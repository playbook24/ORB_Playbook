/**
 * core/db.js
 * Gère la persistance des données via IndexedDB.
 */
class ORBDatabase {
    constructor(dbName = 'ORB_Playbook_Reset_v4') {
        this.dbName = dbName;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);
            const request = indexedDB.open(this.dbName, 5); 

            request.onerror = (event) => reject("Erreur d'ouverture BDD.");
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('playbooks')) db.createObjectStore('playbooks', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('trainingPlans')) db.createObjectStore('trainingPlans', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('tags')) db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('calendarEvents')) db.createObjectStore('calendarEvents', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('players')) db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('teams')) db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
            };
        });
    }

    // --- Méthodes génériques (Exemple pour les Playbooks) ---
    async getAllPlaybooks() {
        if (!this.db) await this.open();
        return new Promise((resolve) => {
            const tx = this.db.transaction(['playbooks'], 'readonly');
            tx.objectStore('playbooks').getAll().onsuccess = (e) => resolve(e.target.result);
        });
    }

    async savePlaybook(data, preview, id = null) {
        if (!this.db) await this.open();
        const store = this.db.transaction(['playbooks'], 'readwrite').objectStore('playbooks');
        const record = { ...data, preview, updatedAt: new Date() };
        if (id) record.id = id;
        return new Promise((resolve) => {
            const req = id ? store.put(record) : store.add(record);
            req.onsuccess = (e) => resolve(e.target.result);
        });
    }

    // (Ajoute ici les autres méthodes save/get/delete pour chaque store comme dans ton db.js d'origine)
}

const orbDB = new ORBDatabase();