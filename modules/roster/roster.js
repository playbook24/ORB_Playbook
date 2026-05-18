/**
 * modules/roster/roster.js
 */
const RosterModule = {
    currentTeamId: null,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open(); 
        await this.loadTeams();
    },

    cacheDOM() {
        this.teamSelect = document.getElementById('roster-team-select');
        this.listContainer = document.getElementById('roster-list');
        this.inputLastName = document.getElementById('roster-lastname');
        this.inputFirstName = document.getElementById('roster-firstname');
        this.inputLicense = document.getElementById('roster-license');
        this.inputJersey = document.getElementById('roster-jersey');
        
        this.editModal = document.getElementById('edit-team-modal');
        this.editTeamName = document.getElementById('edit-team-name');
        this.editTeamColors = document.getElementById('edit-team-colors');
        this.editTeamPlayersList = document.getElementById('edit-team-players-list');
    },

    bindEvents() {
        this.teamSelect.addEventListener('change', (e) => {
            this.currentTeamId = parseInt(e.target.value, 10);
            this.loadTeams();
        });

        document.getElementById('btn-add-player').onclick = () => this.addPlayer();
        document.getElementById('btn-create-team').onclick = () => this.createTeam();
        
        document.getElementById('btn-edit-team').onclick = () => this.editTeam();
        document.getElementById('btn-archive-team').onclick = () => this.archiveTeam();
        document.getElementById('btn-delete-team').onclick = () => this.deleteTeam();

        document.getElementById('close-edit-team-modal').onclick = () => this.editModal.classList.add('hidden');
        document.getElementById('save-edit-team-modal').onclick = () => this.saveEditTeam();
    },

    async createTeam() {
        const name = prompt("Nom de la nouvelle équipe (ex: U15 Filles) :");
        if (name && name.trim() !== '') {
            try {
                const newId = await orbDB.saveTeam({ name: name.trim(), color: '#BFA98D' });
                this.currentTeamId = newId;
                await this.loadTeams();
            } catch (error) {
                console.error("Erreur lors de la création de l'équipe:", error);
                alert("Erreur lors de la création de l'équipe.");
            }
        }
    },

    // MODALE : Modifier l'équipe et ses joueurs
    async editTeam() {
        if (!this.currentTeamId) return alert("Aucune équipe sélectionnée.");
        const teams = await orbDB.getAllTeams();
        const current = teams.find(t => t.id === this.currentTeamId);
        if (!current) return;
        
        this.editTeamName.value = current.name || '';
        
        // Palette de couleurs prédéfinies (ORB et CRAB)
        const colors = ['#BFA98D', '#1a1a1a', '#72243D', '#F9AB00'];
        this.selectedColor = current.color || '#BFA98D';
        
        const renderColors = () => {
            this.editTeamColors.innerHTML = '';
            colors.forEach(c => {
                const div = document.createElement('div');
                div.style.cssText = `width:30px; height:30px; border-radius:50%; background:${c}; cursor:pointer; border:2px solid ${c === this.selectedColor ? 'var(--color-primary)' : 'transparent'};`;
                div.onclick = () => { this.selectedColor = c; renderColors(); };
                this.editTeamColors.appendChild(div);
            });
            const inputColor = document.createElement('input');
            inputColor.type = 'color';
            inputColor.value = this.selectedColor;
            inputColor.style.cssText = `width:30px; height:30px; border-radius:50%; padding:0; border:2px solid ${!colors.includes(this.selectedColor) ? 'var(--color-primary)' : 'transparent'}; cursor:pointer; background:transparent;`;
            inputColor.onchange = (e) => { this.selectedColor = e.target.value; renderColors(); };
            this.editTeamColors.appendChild(inputColor);
        };
        renderColors();

        // Liste des joueurs
        this.editTeamPlayersList.innerHTML = '';
        const players = await orbDB.getAllPlayers();
        this.editTeamPlayersData = players.filter(p => p.teamId === this.currentTeamId).map(p => ({...p})); // clone
        
        this.renderEditPlayers();
        this.editModal.classList.remove('hidden');
    },

    renderEditPlayers() {
        this.editTeamPlayersList.innerHTML = '';
        this.editTeamPlayersData.forEach((p, index) => {
            if (p._deleted) return; 
            
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px;';
            row.innerHTML = `
                <div style="display:flex; flex-wrap:wrap; gap:10px; flex:1;">
                    <input type="text" placeholder="Nom" value="${p.lastName}" onchange="RosterModule.updateEditPlayer(${index}, 'lastName', this.value)" style="flex:1 1 45%; padding:8px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-background); color:var(--color-text);">
                    <input type="text" placeholder="Prénom" value="${p.firstName}" onchange="RosterModule.updateEditPlayer(${index}, 'firstName', this.value)" style="flex:1 1 45%; padding:8px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-background); color:var(--color-text);">
                    <input type="text" placeholder="N° Licence" value="${p.license || ''}" onchange="RosterModule.updateEditPlayer(${index}, 'license', this.value)" style="flex:1 1 45%; padding:8px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-background); color:var(--color-text);">
                    <input type="number" placeholder="Maillot" value="${p.jersey || ''}" onchange="RosterModule.updateEditPlayer(${index}, 'jersey', this.value)" style="flex:1 1 45%; padding:8px; border:1px solid var(--color-border); border-radius:4px; background:var(--color-background); color:var(--color-text);">
                </div>
                <button title="Retirer ce joueur" onclick="RosterModule.markPlayerDeleted(${index})" class="danger" style="padding:8px; border-radius:4px;">X</button>
            `;
            this.editTeamPlayersList.appendChild(row);
        });
    },

    updateEditPlayer(index, field, value) {
        if (this.editTeamPlayersData[index]) {
            this.editTeamPlayersData[index][field] = value;
        }
    },

    markPlayerDeleted(index) {
        if (this.editTeamPlayersData[index]) {
            if (confirm("Confirmer la suppression de ce joueur ?")) {
                this.editTeamPlayersData[index]._deleted = true;
                this.renderEditPlayers();
            }
        }
    },

    async saveEditTeam() {
        const teams = await orbDB.getAllTeams();
        const current = teams.find(t => t.id === this.currentTeamId);
        if (!current) return;

        current.name = this.editTeamName.value.trim() || current.name;
        current.color = this.selectedColor;
        await orbDB.saveTeam(current);

        for (let p of this.editTeamPlayersData) {
            if (p._deleted) {
                await orbDB.deletePlayer(p.id);
            } else {
                p.lastName = p.lastName.trim();
                p.firstName = p.firstName.trim();
                if (p.license !== undefined) p.license = p.license.trim();
                if (p.jersey !== undefined) p.jersey = p.jersey.trim();
                await orbDB.savePlayer(p);
            }
        }

        this.editModal.classList.add('hidden');
        await this.loadTeams();
    },

    // NOUVELLE FONCTION : Archiver l'équipe
    async archiveTeam() {
        if (!this.currentTeamId) return alert("Aucune équipe sélectionnée.");
        if (confirm("Archiver cette équipe ? Elle n'apparaîtra plus ici ni dans le calendrier, mais restera accessible dans l'Archive.")) {
            try {
                const teams = await orbDB.getAllTeams();
                const current = teams.find(t => t.id === this.currentTeamId);
                if (current) {
                    current.archived = true;
                    await orbDB.saveTeam(current);
                    this.currentTeamId = null;
                    await this.loadTeams();
                }
            } catch (error) {
                alert("Erreur lors de l'archivage.");
            }
        }
    },

    // NOUVELLE FONCTION : Supprimer l'équipe
    async deleteTeam() {
        if (!this.currentTeamId) return alert("Aucune équipe sélectionnée.");
        if (confirm("Supprimer DÉFINITIVEMENT cette équipe ? (Ses joueurs ne seront plus affichés)")) {
            await orbDB.deleteTeam(this.currentTeamId);
            this.currentTeamId = null; // Réinitialise pour charger la suivante
            if (this.editModal) this.editModal.classList.add('hidden');
            await this.loadTeams();
        }
    },

    async loadTeams() {
        let teams = await orbDB.getAllTeams();
        teams = teams.filter(t => t.archived !== true); // Ne pas afficher les équipes archivées
        
        this.teamSelect.innerHTML = '';
        if (teams.length === 0) {
            const defaultId = await orbDB.saveTeam({ name: 'Équipe 1' });
            this.currentTeamId = defaultId;
            const opt = document.createElement('option');
            opt.value = defaultId;
            opt.textContent = 'Équipe 1';
            this.teamSelect.appendChild(opt);
        } else {
            if (!this.currentTeamId || !teams.find(t => t.id === this.currentTeamId)) {
                this.currentTeamId = teams[0].id;
            }
            const current = teams.find(t => t.id === this.currentTeamId);
            teams.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name;
                if(t.id === this.currentTeamId) opt.selected = true;
                this.teamSelect.appendChild(opt);
            });
        }
        this.loadRoster();
    },

    async loadRoster() {
        this.listContainer.innerHTML = '<p>Chargement...</p>';
        const [players, events] = await Promise.all([
            orbDB.getAllPlayers(),
            orbDB.getAllCalendarEvents()
        ]);

        const teamPlayers = players.filter(p => p.teamId === this.currentTeamId);
        this.listContainer.innerHTML = '';

        if (teamPlayers.length === 0) {
            this.listContainer.innerHTML = '<p>Aucun joueur dans cette équipe.</p>';
            return;
        }

        const teamEvents = events.filter(e => 
            e.attendance && 
            Object.keys(e.attendance).length > 0 && 
            (e.teamId === this.currentTeamId || (e.teamIds && e.teamIds.includes(this.currentTeamId)))
        );

        const matchEvents = teamEvents.filter(e => e.type === 'match');
        const trainingEvents = teamEvents.filter(e => !e.type || e.type === 'training');

        const computeAtt = (pId, evts) => {
            let present = 0;
            let active = 0;
            evts.forEach(e => {
                const stat = e.attendance[pId];
                if (stat === 'present') { present++; active++; }
                else if (stat === 'absent') { active++; }
            });
            return active > 0 ? { perc: Math.round((present / active) * 100), str: `(${present}/${active})` } : null;
        };

        teamPlayers.forEach(p => {
            const globalAtt = computeAtt(p.id, teamEvents);
            const trainAtt = computeAtt(p.id, trainingEvents);
            const matchAtt = computeAtt(p.id, matchEvents);

            const formatAtt = (attObj) => attObj 
                ? `<span style="color:var(--color-primary); font-weight:bold;">${attObj.perc}%</span> <span style="opacity:0.7; font-size:0.85em;">${attObj.str}</span>`
                : `<span style="opacity:0.5; font-size:0.85em;">-</span>`;

            const card = document.createElement('div');
            card.className = 'roster-card';
            card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;';
            
            card.innerHTML = `
                <div class="player-info" style="flex-grow: 1; min-width: 150px;">
                    <div class="player-name" style="font-weight: bold; font-size: 1.1em; color: var(--color-text);">${p.lastName.toUpperCase()} ${p.firstName}</div>
                    <div class="player-license" style="font-size: 0.9em; opacity: 0.7; margin-top: 5px;">Licence : ${p.license || '-'} | N°: ${p.jersey || '-'}</div>
                </div>
                
                <div style="display:flex; gap: 15px; flex-wrap: wrap; text-align: center;">
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--color-border); border-radius:6px; padding:8px 12px;">
                        <div style="font-size:0.7em; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:5px;">Entraînements</div>
                        <div>${formatAtt(trainAtt)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--color-border); border-radius:6px; padding:8px 12px;">
                        <div style="font-size:0.7em; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:5px;">Matchs</div>
                        <div>${formatAtt(matchAtt)}</div>
                    </div>
                    <div style="background:var(--color-container); border:1px dashed var(--color-primary); border-radius:6px; padding:8px 12px;">
                        <div style="font-size:0.7em; text-transform:uppercase; letter-spacing:1px; opacity:0.6; margin-bottom:5px;">Global</div>
                        <div>${formatAtt(globalAtt)}</div>
                    </div>
                </div>
                <div style="display:none;"></div>
            `;
            this.listContainer.appendChild(card);
        });
    },

    async addPlayer() {
        const lastName = this.inputLastName.value.trim();
        const firstName = this.inputFirstName.value.trim();
        if (!lastName || !firstName) return alert("Nom et prénom requis");

        await orbDB.savePlayer({
            lastName, firstName, 
            license: this.inputLicense.value,
            jersey: this.inputJersey.value,
            teamId: this.currentTeamId,
            createdAt: new Date()
        });
        
        this.inputLastName.value = '';
        this.inputFirstName.value = '';
        this.inputLicense.value = '';
        this.inputJersey.value = '';
        this.loadRoster();
    },



    async deletePlayer(id) {
        if(confirm("Supprimer définitivement ce joueur ?")) {
            await orbDB.deletePlayer(id);
            this.loadRoster();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => RosterModule.init());