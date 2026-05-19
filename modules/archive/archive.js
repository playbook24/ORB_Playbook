/**
 * modules/archive/archive.js
 */
const ArchiveModule = {
    currentTeamId: null,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open(); 
        await this.loadArchivedTeams();
    },

    cacheDOM() {
        this.mainView = document.getElementById('main-view');
        this.detailView = document.getElementById('detail-view');
        this.archiveList = document.getElementById('archive-list');
        this.rosterList = document.getElementById('roster-list');
        this.detailTitle = document.getElementById('detail-title');
        this.archiveFilterContainer = document.getElementById('archive-filter-container');
        
        this.archiveTagsModal = document.getElementById('archive-tags-modal');
        this.archiveTagsList = document.getElementById('archive-tags-list');
        this.newArchiveTagInput = document.getElementById('new-archive-tag-input');
        
        this.assignTagsModal = document.getElementById('assign-tags-modal');
        this.assignTagsList = document.getElementById('assign-tags-list');
    },

    bindEvents() {
        document.getElementById('btn-back-archive').onclick = () => {
            this.currentTeamId = null;
            this.detailView.classList.add('hidden');
            this.mainView.classList.remove('hidden');
            this.loadArchivedTeams();
        };

        document.getElementById('btn-unarchive-team').onclick = () => this.unarchiveTeam();
        
        // Modal Gestion Tags Globaux
        document.getElementById('btn-manage-archive-tags').onclick = () => this.openManageTagsModal();
        document.getElementById('btn-close-archive-tags-modal').onclick = () => this.archiveTagsModal.classList.add('hidden');
        document.getElementById('btn-add-archive-tag').onclick = () => this.addGlobalTag();

        document.getElementById('btn-reorder-archive-tags').onclick = async () => {
            const tags = await orbDB.getAllArchiveTags();
            if(!tags || tags.length === 0) return alert("Aucun tag à réorganiser.");
            ORBReorder.open("Ordre des Tags", "archiveTags", tags, () => { this.loadArchivedTeams(); });
        };

        // Modal Assigner Tags
        document.getElementById('btn-assign-tags').onclick = () => this.openAssignTagsModal();
        document.getElementById('btn-close-assign-tags').onclick = () => this.assignTagsModal.classList.add('hidden');
        document.getElementById('btn-save-assign-tags').onclick = () => this.saveAssignedTags();
    },

    async loadArchivedTeams(filterTag = null) {
        let [teams, globalTags] = await Promise.all([
            orbDB.getAllTeams(),
            orbDB.getAllArchiveTags()
        ]);
        globalTags = ORBReorder.sort(globalTags || [], 'archiveTags');
        let archivedTeams = teams.filter(t => t.archived === true);
        
        this.archiveFilterContainer.innerHTML = '';
        const allTags = globalTags ? globalTags.map(t => t.name) : [];
        
        const createFilterBtn = (tagText, isSelected) => {
            const btn = document.createElement('button');
            btn.className = isSelected ? 'btn-primary' : 'btn-secondary';
            btn.style.cssText = `padding: 4px 10px; font-size: 0.8em; border-radius: 4px; border: 1px solid var(--color-primary); cursor: pointer; ${isSelected ? '' : 'background: transparent; color: var(--color-primary);'}`;
            btn.textContent = tagText;
            btn.onclick = () => this.loadArchivedTeams(isSelected ? null : tagText);
            return btn;
        };

        if (allTags.length > 0) {
            this.archiveFilterContainer.appendChild(createFilterBtn('Tous', !filterTag));
            allTags.forEach(tag => {
                this.archiveFilterContainer.appendChild(createFilterBtn(tag, filterTag === tag));
            });
        }

        if (filterTag) {
            archivedTeams = archivedTeams.filter(t => t.tags && t.tags.includes(filterTag));
        }

        this.archiveList.innerHTML = '';
        
        if (archivedTeams.length === 0) {
            this.archiveList.innerHTML = '<p style="text-align:center; opacity:0.7; grid-column: 1 / -1;">Aucune équipe correspondante.</p>';
            return;
        }

        const players = await orbDB.getAllPlayers();

        archivedTeams.forEach(team => {
            const teamPlayersCount = players.filter(p => p.teamId === team.id).length;
            const card = document.createElement('div');
            card.className = 'archive-card';
            
            const tagsHtml = team.tags && team.tags.length > 0 
                ? `<div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;">${team.tags.map(t => `<span style="background:var(--color-primary); color:var(--color-background); font-size:0.7em; padding:2px 6px; border-radius:4px;">${t}</span>`).join('')}</div>`
                : '';

            card.innerHTML = `
                ${tagsHtml}
                <svg viewBox="0 0 24 24" style="width:40px; height:40px; fill:var(--color-primary); margin-bottom:15px;">
                    <path d="M20,21H4V10H6V19H18V10H20V21M3,3H21V9H3V3M5,5V7H19V5H5Z"/>
                </svg>
                <h3 style="margin: 0 0 10px 0; color: var(--color-primary);">${team.name}</h3>
                <span style="opacity: 0.7;">${teamPlayersCount} Joueur(s)</span>
            `;
            
            card.onclick = () => this.openTeamDetail(team.id, team.name);
            this.archiveList.appendChild(card);
        });
    },

    async openTeamDetail(teamId, teamName) {
        this.currentTeamId = teamId;
        this.detailTitle.textContent = teamName;
        
        this.mainView.classList.add('hidden');
        this.detailView.classList.remove('hidden');
        await this.loadTeamRoster(teamId);
    },

    // --- LOGIQUE TAGS GLOBAUX ---
    async openManageTagsModal() {
        this.archiveTagsModal.classList.remove('hidden');
        await this.renderManageTagsList();
    },

    async renderManageTagsList() {
        this.archiveTagsList.innerHTML = 'Chargement...';
        let tags = await orbDB.getAllArchiveTags() || [];
        tags = ORBReorder.sort(tags, 'archiveTags');
        this.archiveTagsList.innerHTML = '';
        
        if (tags.length === 0) {
            this.archiveTagsList.innerHTML = '<p style="opacity:0.6; text-align:center;">Aucun tag créé.</p>';
            return;
        }

        tags.forEach(tag => {
            const div = document.createElement('div');
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--color-background); border:1px solid var(--color-border); border-radius:6px;';
            div.innerHTML = `
                <span>${tag.name}</span>
                <button class="btn-icon" style="color:#ff4444;" title="Supprimer">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2 2 0 0,0 8,21H16A2 2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
            `;
            div.querySelector('button').onclick = () => this.deleteGlobalTag(tag.id, tag.name);
            this.archiveTagsList.appendChild(div);
        });
    },

    async addGlobalTag() {
        const val = this.newArchiveTagInput.value.trim();
        if (!val) return;
        const tags = await orbDB.getAllArchiveTags() || [];
        if (tags.find(t => t.name.toLowerCase() === val.toLowerCase())) {
            alert("Ce tag existe déjà.");
            return;
        }
        await orbDB.saveArchiveTag({ name: val });
        this.newArchiveTagInput.value = '';
        await this.renderManageTagsList();
        await this.loadArchivedTeams();
    },

    async deleteGlobalTag(id, name) {
        if (confirm(`Supprimer le tag "${name}" de partout ?`)) {
            await orbDB.deleteArchiveTag(id);
            const teams = await orbDB.getAllTeams();
            for (let team of teams) {
                if (team.archived && team.tags && team.tags.includes(name)) {
                    team.tags = team.tags.filter(t => t !== name);
                    await orbDB.saveTeam(team);
                }
            }
            await this.renderManageTagsList();
            await this.loadArchivedTeams();
        }
    },

    // --- ASSIGNATION TAGS ---
    async openAssignTagsModal() {
        if (!this.currentTeamId) return;
        this.assignTagsModal.classList.remove('hidden');
        
        let [globalTags, teams] = await Promise.all([
            orbDB.getAllArchiveTags(),
            orbDB.getAllTeams()
        ]);
        globalTags = ORBReorder.sort(globalTags || [], 'archiveTags');
        const currentTeam = teams.find(t => t.id === this.currentTeamId);
        const teamTags = currentTeam.tags || [];

        this.assignTagsList.innerHTML = '';
        if (!globalTags || globalTags.length === 0) {
            this.assignTagsList.innerHTML = '<p style="opacity:0.6; text-align:center;">Aucun tag disponible. Allez dans "Gérer les Tags" pour en créer.</p>';
            return;
        }

        globalTags.forEach(tag => {
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px; background:var(--color-background); border:1px solid var(--color-border); border-radius:6px; cursor:pointer;';
            lbl.innerHTML = `
                <input type="checkbox" value="${tag.name}" ${teamTags.includes(tag.name) ? 'checked' : ''} style="width:18px;height:18px;cursor:pointer;">
                <span>${tag.name}</span>
            `;
            this.assignTagsList.appendChild(lbl);
        });
    },

    async saveAssignedTags() {
        const checkboxes = this.assignTagsList.querySelectorAll('input[type="checkbox"]:checked');
        const selectedTags = Array.from(checkboxes).map(cb => cb.value);
        
        const teams = await orbDB.getAllTeams();
        const current = teams.find(t => t.id === this.currentTeamId);
        if (current) {
            current.tags = selectedTags;
            await orbDB.saveTeam(current);
            this.assignTagsModal.classList.add('hidden');
            await this.loadArchivedTeams(); // Update the main view in background
        }
    },

    async unarchiveTeam() {
        if (!this.currentTeamId) return;
        if (confirm("Voulez-vous restaurer cette équipe ? Elle réapparaîtra dans la section Effectif et le Calendrier.")) {
            try {
                const teams = await orbDB.getAllTeams();
                const current = teams.find(t => t.id === this.currentTeamId);
                if (current) {
                    current.archived = false;
                    await orbDB.saveTeam(current);
                    // Retourner à la liste
                    document.getElementById('btn-back-archive').click();
                }
            } catch (error) {
                alert("Erreur lors de la restauration de l'équipe.");
            }
        }
    },

    async loadTeamRoster(teamId) {
        this.rosterList.innerHTML = '<p>Chargement...</p>';
        const [players, events] = await Promise.all([
            orbDB.getAllPlayers(),
            orbDB.getAllCalendarEvents()
        ]);

        const teamPlayers = players.filter(p => p.teamId === teamId);
        this.rosterList.innerHTML = '';

        if (teamPlayers.length === 0) {
            this.rosterList.innerHTML = '<p style="text-align:center; opacity:0.7;">Aucun joueur dans cette équipe.</p>';
            return;
        }

        const teamEvents = events.filter(e => 
            e.attendance && 
            Object.keys(e.attendance).length > 0 && 
            (e.teamId === teamId || (e.teamIds && e.teamIds.includes(teamId)))
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
            card.style.cssText = 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; opacity: 0.8;';
            
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
            `;
            // Pas de bouton supprimer ici, lecture seule
            this.rosterList.appendChild(card);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => ArchiveModule.init());
