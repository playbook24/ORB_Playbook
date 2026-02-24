/**
 * modules/calendar/calendar.js
 * V4 - Calendrier connecté au Planificateur et à l'Effectif (L'Appel)
 */
const CalendarModule = {
    currentDate: new Date(),
    selectedDateStr: null,
    currentEvent: null,

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await orbDB.open();
        this.render();
    },

    cacheDOM() {
        this.grid = document.getElementById('calendar-grid');
        this.monthDisplay = document.getElementById('cal-month-display');
        this.modal = document.getElementById('event-editor-modal');
        this.teamSelect = document.getElementById('event-team-select');
        
        // Éléments du lien Planificateur
        this.planPickerModal = document.getElementById('plan-picker-modal');
        this.planPickerList = document.getElementById('plan-picker-list');
        this.eventPlanEmpty = document.getElementById('event-plan-empty');
        this.eventPlanSelected = document.getElementById('event-plan-selected');
        
        // Éléments de l'Appel (Présence)
        this.attendanceModal = document.getElementById('attendance-modal');
        this.attendanceList = document.getElementById('attendance-list');
        this.attendanceSummary = document.getElementById('attendance-summary');
    },

    bindEvents() {
        // Navigation Mois
        document.getElementById('cal-prev-btn').onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.render(); };
        document.getElementById('cal-next-btn').onclick = () => { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.render(); };
        document.getElementById('cal-today-btn').onclick = () => { this.currentDate = new Date(); this.render(); };
        
        // Modale Principal
        document.getElementById('event-modal-close-btn').onclick = () => this.modal.classList.add('hidden');
        document.getElementById('btn-save-event').onclick = () => this.saveEvent();
        document.getElementById('btn-delete-event').onclick = () => this.deleteEvent();

        // Lien Planificateur
        document.getElementById('btn-open-plan-picker').onclick = () => this.openPlanPicker();
        document.getElementById('plan-picker-close-btn').onclick = () => this.planPickerModal.classList.add('hidden');
        document.getElementById('btn-remove-snapshot').onclick = () => {
            this.currentEvent.planId = null;
            this.updatePlanUI();
        };

        // Présences (L'Appel)
        document.getElementById('btn-manage-attendance').onclick = () => this.openAttendanceModal();
        document.getElementById('attendance-close-btn').onclick = () => this.attendanceModal.classList.add('hidden');
        document.getElementById('btn-save-attendance').onclick = () => this.saveAttendance();
    },

    async render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Format du mois avec Majuscule
        let monthStr = this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        this.monthDisplay.textContent = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
        
        this.grid.innerHTML = '';

        // En-têtes (L, M, M, J, V, S, D)
        const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        days.forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-header'; h.textContent = d;
            this.grid.appendChild(h);
        });

        // Décalage pour commencer au Lundi (getDay() de dimanche = 0)
        let emptyDays = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < emptyDays; i++) {
            this.grid.appendChild(document.createElement('div'));
        }

        const events = await orbDB.getAllCalendarEvents();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayCell = document.createElement('div');
            dayCell.className = 'calendar-day';
            
            // Surligner la date d'aujourd'hui
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            dayCell.innerHTML = `<div class="day-number" style="${isToday ? 'color:var(--color-primary); font-size:1.2em;' : ''}">${d}</div>`;
            
            // Afficher les événements de ce jour
            events.filter(e => e.date === dateStr).forEach(e => {
                const chip = document.createElement('div');
                chip.className = 'event-chip';
                chip.textContent = e.title || 'Séance';
                dayCell.appendChild(chip);
            });

            dayCell.onclick = () => this.openEditor(dateStr);
            this.grid.appendChild(dayCell);
        }
    },

    async openEditor(dateStr) {
        this.selectedDateStr = dateStr;
        const formattedDate = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        document.getElementById('event-date-display').textContent = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        
        // Charger les équipes dans la liste déroulante
        const teams = await orbDB.getAllTeams();
        this.teamSelect.innerHTML = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        
        // Vérifier si un événement existe déjà pour ce jour
        const events = await orbDB.getAllCalendarEvents();
        const existingEvent = events.find(e => e.date === dateStr);

        if (existingEvent) {
            this.currentEvent = { ...existingEvent };
            if(!this.currentEvent.attendance) this.currentEvent.attendance = {};
        } else {
            // Nouvel événement
            this.currentEvent = {
                id: null, date: dateStr, title: '', teamId: teams.length > 0 ? teams[0].id : null, notes: '', planId: null, attendance: {}
            };
        }

        // Remplir les champs
        document.getElementById('event-title').value = this.currentEvent.title;
        document.getElementById('event-notes').value = this.currentEvent.notes || '';
        if(this.currentEvent.teamId) this.teamSelect.value = this.currentEvent.teamId;

        // Mettre à jour l'interface
        await this.updatePlanUI();
        this.updateAttendanceSummary();

        this.modal.classList.remove('hidden');
    },

    // --- LOGIQUE PLANIFICATEUR ---
    async updatePlanUI() {
        if (this.currentEvent.planId) {
            const plan = await orbDB.getPlan(this.currentEvent.planId);
            if (plan) {
                document.getElementById('snapshot-plan-name').textContent = plan.name;
                this.eventPlanEmpty.classList.add('hidden');
                this.eventPlanSelected.classList.remove('hidden');
                return;
            }
        }
        // Si aucun plan ou plan supprimé
        this.eventPlanEmpty.classList.remove('hidden');
        this.eventPlanSelected.classList.add('hidden');
    },

    async openPlanPicker() {
        const plans = await orbDB.getAllPlans();
        this.planPickerList.innerHTML = '';
        if (plans.length === 0) {
            this.planPickerList.innerHTML = '<p style="text-align:center; opacity:0.6;">Aucun plan disponible. Créez-en un dans le Planificateur.</p>';
        } else {
            plans.reverse().forEach(plan => {
                const div = document.createElement('div');
                div.style.cssText = "padding: 15px; border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 10px; cursor: pointer; background: var(--color-background); transition: all 0.2s;";
                div.innerHTML = `<h4 style="margin:0; color:var(--color-primary);">${plan.name}</h4><p style="margin:5px 0 0 0; font-size:0.85em; opacity:0.7;">${plan.playbookIds.length} exercices</p>`;
                div.onmouseover = () => div.style.borderColor = "var(--color-primary)";
                div.onmouseout = () => div.style.borderColor = "var(--color-border)";
                div.onclick = () => {
                    this.currentEvent.planId = plan.id;
                    this.updatePlanUI();
                    this.planPickerModal.classList.add('hidden');
                };
                this.planPickerList.appendChild(div);
            });
        }
        this.planPickerModal.classList.remove('hidden');
    },

    // --- LOGIQUE ATTENDANCE (L'APPEL) ---
    async openAttendanceModal() {
        const teamId = parseInt(this.teamSelect.value, 10);
        if (isNaN(teamId)) return alert("Veuillez sélectionner une équipe d'abord.");
        
        // Met à jour l'équipe de l'événement si elle a changé dans le select
        this.currentEvent.teamId = teamId; 

        const players = await orbDB.getAllPlayers();
        const teamPlayers = players.filter(p => p.teamId === teamId);
        
        this.attendanceList.innerHTML = '';
        
        if(teamPlayers.length === 0) {
            this.attendanceList.innerHTML = '<p style="text-align:center; opacity:0.6;">Aucun joueur dans cette équipe. Ajoutez-en via le menu Effectif.</p>';
        } else {
            teamPlayers.forEach(p => {
                const status = this.currentEvent.attendance[p.id] || 'present'; // Présent par défaut
                
                const div = document.createElement('div');
                div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid var(--color-border);';
                div.innerHTML = `
                    <span style="font-weight: bold; font-size: 1.1em;">${p.lastName.toUpperCase()} ${p.firstName}</span>
                    <div style="display:flex; gap:15px; background:var(--color-background); padding:5px 10px; border-radius:6px;">
                        <label style="cursor:pointer; color:#4caf50;"><input type="radio" name="att_${p.id}" value="present" ${status==='present'?'checked':''}> Présent</label>
                        <label style="cursor:pointer; color:#f44336;"><input type="radio" name="att_${p.id}" value="absent" ${status==='absent'?'checked':''}> Absent</label>
                        <label style="cursor:pointer; color:#ff9800;"><input type="radio" name="att_${p.id}" value="injured" ${status==='injured'?'checked':''}> Blessé</label>
                    </div>
                `;
                this.attendanceList.appendChild(div);
            });
        }
        this.attendanceModal.classList.remove('hidden');
    },

    saveAttendance() {
        const playersDivs = Array.from(this.attendanceList.querySelectorAll('div[style*="justify-content: space-between"]'));
        const newAttendance = {};
        
        playersDivs.forEach(div => {
            const radios = div.querySelectorAll('input[type="radio"]');
            if(radios.length > 0) {
                const idStr = radios[0].name.split('_')[1];
                const checked = Array.from(radios).find(r => r.checked);
                if(checked) newAttendance[idStr] = checked.value;
            }
        });
        
        this.currentEvent.attendance = newAttendance;
        this.updateAttendanceSummary();
        this.attendanceModal.classList.add('hidden');
    },

    updateAttendanceSummary() {
        const att = this.currentEvent.attendance || {};
        const total = Object.keys(att).length;
        if(total === 0) {
            this.attendanceSummary.textContent = "Appel non effectué.";
            return;
        }
        const present = Object.values(att).filter(v => v === 'present').length;
        const absent = Object.values(att).filter(v => v === 'absent').length;
        const injured = Object.values(att).filter(v => v === 'injured').length;
        
        this.attendanceSummary.innerHTML = `<span style="color:#4caf50">${present} Présent(s)</span> | <span style="color:#f44336">${absent} Absent(s)</span> | <span style="color:#ff9800">${injured} Blessé(s)</span>`;
    },

    async saveEvent() {
        this.currentEvent.title = document.getElementById('event-title').value;
        this.currentEvent.teamId = parseInt(this.teamSelect.value, 10);
        this.currentEvent.notes = document.getElementById('event-notes').value;
        
        if (!this.currentEvent.title) return alert("Le titre est obligatoire.");

        await orbDB.saveCalendarEvent(this.currentEvent);
        this.modal.classList.add('hidden');
        this.render();
    },

    async deleteEvent() {
        if (this.currentEvent.id && confirm("Supprimer cet événement du calendrier ?")) {
            await orbDB.deleteCalendarEvent(this.currentEvent.id);
            this.modal.classList.add('hidden');
            this.render();
        } else if (!this.currentEvent.id) {
            this.modal.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => CalendarModule.init());