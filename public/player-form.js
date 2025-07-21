class PlayerForm {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentPlayer = null;
        this.init();
    }

    init() {
        // Check authentication
        if (!this.token) {
            window.location.href = '/app';
            return;
        }

        // Initialize form functionality
        this.initializeFormHandlers();
        this.setupPositionHandlers();
        this.initializeRangeSliders();
        this.loadPlayerDataIfEditing();
    }

    initializeFormHandlers() {
        // Form submission
        document.getElementById('player-form-content').addEventListener('submit', (e) => this.handlePlayerForm(e));
        
        // Navigation buttons
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '/app';
        });

        document.getElementById('quick-save-btn').addEventListener('click', () => {
            this.quickSave();
        });
        
        // Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                window.location.href = '/app';
            }
        });

        // Remove photo button
        const removePhotoBtn = document.getElementById('remove-photo-btn');
        if (removePhotoBtn) {
            removePhotoBtn.addEventListener('click', () => this.removeProfilePhoto());
        }

        // Postcode lookup button
        const lookupBtn = document.getElementById('lookup-postcode');
        if (lookupBtn) {
            lookupBtn.addEventListener('click', () => this.lookupPostcode());
        }
        
        // Representative team selects
        document.getElementById('districtTeam').addEventListener('change', (e) => {
            const seasonInput = document.getElementById('districtTeamSeason');
            if (e.target.value === 'yes' || e.target.value === 'trials') {
                seasonInput.style.display = 'block';
            } else {
                seasonInput.style.display = 'none';
                seasonInput.value = '';
            }
        });
        
        document.getElementById('countyTeam').addEventListener('change', (e) => {
            const seasonInput = document.getElementById('countyTeamSeason');
            if (e.target.value === 'yes' || e.target.value === 'trials') {
                seasonInput.style.display = 'block';
            } else {
                seasonInput.style.display = 'none';
                seasonInput.value = '';
            }
        });
        
        // Add award button
        document.getElementById('add-award-btn').addEventListener('click', () => {
            this.addAwardField();
        });
        
        // Add team button
        document.getElementById('add-team-btn').addEventListener('click', () => {
            this.addTeamField();
        });
        
        // Remove award handlers (delegation)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-award-btn')) {
                e.target.closest('.award-item').remove();
            }
            if (e.target.classList.contains('remove-team-btn')) {
                e.target.closest('.team-item').remove();
            }
        });
        
        // Handle primary team radio button changes
        document.addEventListener('change', (e) => {
            if (e.target.name === 'primary-team') {
                // Ensure at least one team is always primary
                const checkedRadios = document.querySelectorAll('input[name="primary-team"]:checked');
                if (checkedRadios.length === 0 && document.querySelectorAll('.team-item').length > 0) {
                    e.target.checked = true;
                }
            }
        });
    }

    setupPositionHandlers() {
        // Handle position checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.dataset.position && !e.target.classList.contains('primary-checkbox')) {
                const positionItem = e.target.closest('.position-item');
                if (e.target.checked) {
                    positionItem.classList.add('selected');
                } else {
                    positionItem.classList.remove('selected');
                    // If unchecking position, also uncheck primary
                    const primaryCheckbox = positionItem.querySelector('.primary-checkbox');
                    if (primaryCheckbox) {
                        primaryCheckbox.checked = false;
                    }
                }
            }
            
            // Handle primary position checkbox changes
            if (e.target.classList.contains('primary-checkbox')) {
                if (e.target.checked) {
                    // Uncheck all other primary checkboxes (only one primary allowed)
                    document.querySelectorAll('.primary-checkbox').forEach(checkbox => {
                        if (checkbox !== e.target) {
                            checkbox.checked = false;
                        }
                    });
                    
                    // Ensure the position itself is also checked
                    const positionCheckbox = e.target.closest('.position-item').querySelector('input[data-position]');
                    if (positionCheckbox && !positionCheckbox.checked) {
                        positionCheckbox.checked = true;
                        positionCheckbox.closest('.position-item').classList.add('selected');
                    }
                }
            }
        });

        // Handle range slider updates for position suitability
        document.addEventListener('input', (e) => {
            if (e.target.type === 'range' && e.target.dataset.position) {
                const rangeValue = e.target.nextElementSibling;
                if (rangeValue && rangeValue.classList.contains('range-value')) {
                    rangeValue.textContent = e.target.value + '%';
                }
            }
        });
    }


    initializeRangeSliders() {
        // Handle all range inputs including new ability sliders
        document.addEventListener('input', (e) => {
            if (e.target.type === 'range') {
                // Handle new ability sliders with separate value displays
                if (e.target.classList.contains('ability-slider')) {
                    const valueDisplay = document.getElementById(e.target.id + '-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                    return;
                }
                
                // Handle other range inputs
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    if (e.target.id === 'weakFootStrength') {
                        valueSpan.textContent = e.target.value + '%';
                    } else if (e.target.dataset.position) {
                        // Position suitability - handled above
                        return;
                    } else {
                        valueSpan.textContent = e.target.value;
                    }
                }
            }
            
            // Handle athletic performance inputs
            if (e.target.type === 'number' && ['sprint10m', 'sprint30m', 'run1km', 'bleepTest'].includes(e.target.id)) {
                const displayId = e.target.id + '-display';
                const displayElement = document.getElementById(displayId);
                if (displayElement) {
                    const value = e.target.value;
                    if (value) {
                        if (e.target.id === 'run1km') {
                            displayElement.textContent = value + ' min';
                        } else if (e.target.id === 'bleepTest') {
                            displayElement.textContent = 'Level ' + value;
                        } else {
                            displayElement.textContent = value + 's';
                        }
                    } else {
                        displayElement.textContent = '-';
                    }
                }
            }
        });
    }

    loadPlayerDataIfEditing() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const playerId = urlParams.get('id');

        if (mode === 'edit' && playerId) {
            document.getElementById('form-title').textContent = 'Edit Player Profile';
            this.currentPlayer = { playerId: playerId };
            this.loadPlayerData(playerId);
        } else {
            document.getElementById('form-title').textContent = 'Create Player Profile';
        }
    }

    async loadPlayerData(playerId) {
        try {
            const response = await fetch(`/api/players/${playerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const player = await response.json();
                // Store the full player object to preserve metadata
                this.currentPlayer = player;
                this.populateForm(player);
            } else {
                this.showMessage('Failed to load player data', 'error');
            }
        } catch (error) {
            console.error('Error loading player data:', error);
            this.showMessage('Failed to load player data', 'error');
        }
    }

    populateForm(player) {
        // Personal Information
        document.getElementById('firstName').value = player.personalInfo?.firstName || '';
        document.getElementById('lastName').value = player.personalInfo?.lastName || '';
        document.getElementById('dateOfBirth').value = player.personalInfo?.dateOfBirth || '';
        document.getElementById('heightCm').value = player.personalInfo?.height?.centimeters || '';
        document.getElementById('weightKg').value = player.personalInfo?.weight?.kilograms || '';
        document.getElementById('preferredFoot').value = player.personalInfo?.preferredFoot || '';
        document.getElementById('weakFootStrength').value = player.personalInfo?.weakFootStrength || 50;
        document.getElementById('nationality').value = player.personalInfo?.nationality || '';
        
        // Contact Information
        document.getElementById('playerPhone').value = player.contactInfo?.player?.phone || '';
        document.getElementById('playerEmail').value = player.contactInfo?.player?.email || '';
        document.getElementById('guardianName').value = player.contactInfo?.guardian?.name || '';
        document.getElementById('guardianPhone').value = player.contactInfo?.guardian?.phone || '';
        document.getElementById('guardianEmail').value = player.contactInfo?.guardian?.email || '';
        
        // Playing Information
        this.populatePositionData(player.playingInfo?.positions);
        document.getElementById('yearsPlaying').value = player.playingInfo?.yearsPlaying || '';
        
        // Handle teams - check for new format first, then fallback to legacy
        if (player.playingInfo?.teams && Array.isArray(player.playingInfo.teams)) {
            // New format with multiple teams
            player.playingInfo.teams.forEach(team => {
                this.addTeamField(team.clubName, team.league, team.isPrimary);
            });
        } else if (player.playingInfo?.currentTeam) {
            // Legacy format - single team
            const teamName = typeof player.playingInfo.currentTeam === 'string' 
                ? player.playingInfo.currentTeam 
                : player.playingInfo.currentTeam.clubName;
            const league = player.playingInfo?.currentTeam?.league || player.playingInfo?.league || '';
            this.addTeamField(teamName, league, true);
        }
        
        document.getElementById('basedLocation').value = player.playingInfo?.basedLocation || '';
        
        // Representative Teams
        if (player.playingInfo?.representativeTeams) {
            const districtTeam = player.playingInfo.representativeTeams.district;
            if (districtTeam) {
                document.getElementById('districtTeam').value = districtTeam.selected || '';
                document.getElementById('districtTeamSeason').value = districtTeam.season || '';
                if (districtTeam.selected === 'yes' || districtTeam.selected === 'trials') {
                    document.getElementById('districtTeamSeason').style.display = 'block';
                }
            }
            
            const countyTeam = player.playingInfo.representativeTeams.county;
            if (countyTeam) {
                document.getElementById('countyTeam').value = countyTeam.selected || '';
                document.getElementById('countyTeamSeason').value = countyTeam.season || '';
                if (countyTeam.selected === 'yes' || countyTeam.selected === 'trials') {
                    document.getElementById('countyTeamSeason').style.display = 'block';
                }
            }
        }
        
        // Trophies and Awards
        if (player.playingInfo?.trophiesAwards && Array.isArray(player.playingInfo.trophiesAwards)) {
            player.playingInfo.trophiesAwards.forEach(award => {
                this.addAwardField(award.title, award.season);
            });
        }
        
        // Academic Information
        document.getElementById('currentSchool').value = player.academicInfo?.currentSchool || '';
        document.getElementById('gradeYear').value = player.academicInfo?.gradeYear || '';
        
        // Player Showcase
        document.getElementById('playerShowcase').value = player.showcase?.description || '';
        document.getElementById('playingStyleSummary').value = player.playingStyle?.summary || '';
        document.getElementById('strengths').value = (player.playingStyle?.strengths || []).join('\n') || '';
        document.getElementById('weaknesses').value = (player.playingStyle?.weaknesses || []).join('\n') || '';
        
        // Location & Availability
        if (player.location) {
            document.getElementById('postcode').value = player.location.postcode || '';
            document.getElementById('city').value = player.location.city || '';
            document.getElementById('county').value = player.location.county || '';
            document.getElementById('country').value = player.location.country || 'England';
            
            // Store coordinates if available
            if (player.location.coordinates) {
                const postcodeInput = document.getElementById('postcode');
                postcodeInput.dataset.latitude = player.location.coordinates.latitude || '';
                postcodeInput.dataset.longitude = player.location.coordinates.longitude || '';
            }
        }
        
        if (player.availability) {
            document.getElementById('availability-status').value = player.availability.status || 'not_looking';
            document.getElementById('willing-to-relocate').checked = player.availability.willingToRelocate || false;
            document.getElementById('preferred-locations').value = (player.availability.preferredLocations || []).join(', ');
            document.getElementById('travel-radius').value = player.availability.travelRadius || 25;
        }
        
        // Abilities
        this.populateAbilities(player.abilities);
        
        // Profile Photo
        if (player.media?.profilePhoto) {
            document.getElementById('current-photo').src = player.media.profilePhoto;
            document.getElementById('current-photo-preview').style.display = 'block';
        }
        
        // Update all range displays
        this.updateAllRangeDisplays();
    }

    populatePositionData(positions) {
        // Reset all position checkboxes
        document.querySelectorAll('.position-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            const positionItem = checkbox.closest('.position-item');
            positionItem.classList.remove('selected');
        });

        if (!positions || !Array.isArray(positions)) return;

        // Sort positions by order and populate form
        const sortedPositions = positions.sort((a, b) => a.order - b.order);
        
        sortedPositions.forEach((pos, index) => {
            // Find the corresponding position item
            const positionItem = document.querySelector(`.position-item[data-position="${pos.position}"]`);
            if (positionItem) {
                // Check the position checkbox
                const checkbox = positionItem.querySelector('input[type="checkbox"][data-position]');
                const suitabilityRange = positionItem.querySelector('input[type="range"]');
                const notesTextarea = positionItem.querySelector('textarea');
                const primaryCheckbox = positionItem.querySelector('.primary-checkbox');
                
                if (checkbox) {
                    checkbox.checked = true;
                    positionItem.classList.add('selected');
                }
                
                // Mark as primary if it's the first position (order = 1)
                if (primaryCheckbox && index === 0) {
                    primaryCheckbox.checked = true;
                }
                
                if (suitabilityRange) {
                    suitabilityRange.value = pos.suitability || 75;
                    const rangeValue = suitabilityRange.nextElementSibling;
                    if (rangeValue && rangeValue.classList.contains('range-value')) {
                        rangeValue.textContent = (pos.suitability || 75) + '%';
                    }
                }
                
                if (notesTextarea) {
                    notesTextarea.value = pos.notes || '';
                }
            }
        });
    }

    populateAbilities(abilities) {
        // Technical abilities
        this.setAbilityValue('ballControl', abilities?.technical?.ballControl?.rating || 5);
        this.setAbilityValue('passing', abilities?.technical?.passing?.rating || 5);
        this.setAbilityValue('shooting', abilities?.technical?.shooting?.rating || 5);
        this.setAbilityValue('dribbling', abilities?.technical?.dribbling?.rating || 5);
        this.setAbilityValue('firstTouch', abilities?.technical?.firstTouch?.rating || 5);
        this.setAbilityValue('crossing', abilities?.technical?.crossing?.rating || 5);
        this.setAbilityValue('tackling', abilities?.technical?.tackling?.rating || 5);
        this.setAbilityValue('heading', abilities?.technical?.heading?.rating || 5);
        
        // Physical abilities
        this.setAbilityValue('pace', abilities?.physical?.pace?.rating || 5);
        this.setAbilityValue('strength', abilities?.physical?.strength?.rating || 5);
        this.setAbilityValue('stamina', abilities?.physical?.stamina?.rating || 5);
        this.setAbilityValue('agility', abilities?.physical?.agility?.rating || 5);
        this.setAbilityValue('balance', abilities?.physical?.balance?.rating || 5);
        this.setAbilityValue('jumping', abilities?.physical?.jumping?.rating || 5);
        
        // Mental abilities
        this.setAbilityValue('decisionMaking', abilities?.mental?.decisionMaking?.rating || 5);
        this.setAbilityValue('positioning', abilities?.mental?.positioning?.rating || 5);
        this.setAbilityValue('concentration', abilities?.mental?.concentration?.rating || 5);
        this.setAbilityValue('leadership', abilities?.mental?.leadership?.rating || 5);
        this.setAbilityValue('communication', abilities?.mental?.communication?.rating || 5);
        
        // Athletic performance
        if (abilities?.athletic) {
            if (abilities.athletic.sprint10m) {
                document.getElementById('sprint10m').value = abilities.athletic.sprint10m;
                document.getElementById('sprint10m-display').textContent = abilities.athletic.sprint10m + 's';
            }
            if (abilities.athletic.sprint30m) {
                document.getElementById('sprint30m').value = abilities.athletic.sprint30m;
                document.getElementById('sprint30m-display').textContent = abilities.athletic.sprint30m + 's';
            }
            if (abilities.athletic.run1km) {
                document.getElementById('run1km').value = abilities.athletic.run1km;
                document.getElementById('run1km-display').textContent = abilities.athletic.run1km + ' min';
            }
            if (abilities.athletic.bleepTest) {
                document.getElementById('bleepTest').value = abilities.athletic.bleepTest;
                document.getElementById('bleepTest-display').textContent = 'Level ' + abilities.athletic.bleepTest;
            }
        }
    }

    setAbilityValue(id, value) {
        // Set the slider value
        const slider = document.getElementById(id);
        if (slider) {
            slider.value = value;
        }
        
        // Set the display value
        const valueDisplay = document.getElementById(id + '-value');
        if (valueDisplay) {
            valueDisplay.textContent = value;
        }
    }

    setFormValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    updateAllRangeDisplays() {
        document.querySelectorAll('input[type="range"]').forEach(range => {
            // Handle new ability sliders
            if (range.classList.contains('ability-slider')) {
                const valueDisplay = document.getElementById(range.id + '-value');
                if (valueDisplay) {
                    valueDisplay.textContent = range.value;
                }
                return;
            }
            
            // Handle other range inputs
            const valueSpan = range.nextElementSibling;
            if (valueSpan && valueSpan.classList.contains('range-value')) {
                if (range.id === 'weakFootStrength') {
                    valueSpan.textContent = range.value + '%';
                } else if (range.dataset.position) {
                    valueSpan.textContent = range.value + '%';
                } else {
                    valueSpan.textContent = range.value;
                }
            }
        });
    }
    
    addAwardField(title = '', season = '') {
        const container = document.getElementById('awards-container');
        const awardItem = document.createElement('div');
        awardItem.className = 'award-item fm-card fm-mb-sm';
        awardItem.style.cssText = 'background: var(--fm-background); padding: var(--spacing-md); position: relative;';
        
        awardItem.innerHTML = `
            <button type="button" class="remove-award-btn fm-btn fm-btn-danger fm-btn-sm" style="position: absolute; top: 10px; right: 10px; padding: 4px 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="fm-grid fm-grid-2" style="gap: var(--spacing-md);">
                <div>
                    <input type="text" class="award-title fm-input" placeholder="Trophy/Award Title" value="${title}">
                </div>
                <div>
                    <input type="text" class="award-season fm-input" placeholder="Season/Year (e.g., 2024-25)" value="${season}">
                </div>
            </div>
        `;
        
        container.insertBefore(awardItem, container.querySelector('small'));
    }
    
    addTeamField(teamName = '', league = '', isPrimary = false) {
        const container = document.getElementById('teams-container');
        const teamItem = document.createElement('div');
        teamItem.className = 'team-item fm-card fm-mb-sm';
        teamItem.style.cssText = 'background: var(--fm-background); padding: var(--spacing-md); position: relative;';
        
        // Generate unique ID for radio button
        const teamId = Date.now() + Math.random();
        
        // Check if this is the first team being added
        const isFirstTeam = container.querySelectorAll('.team-item').length === 0;
        
        teamItem.innerHTML = `
            <button type="button" class="remove-team-btn fm-btn fm-btn-danger fm-btn-sm" style="position: absolute; top: 10px; right: 10px; padding: 4px 8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                <input type="radio" id="primary-${teamId}" name="primary-team" value="${teamId}" ${isPrimary || isFirstTeam ? 'checked' : ''}>
                <label for="primary-${teamId}" style="font-weight: 600; color: var(--fm-accent);">Primary Team</label>
            </div>
            <div class="fm-grid fm-grid-2" style="gap: var(--spacing-md);">
                <div>
                    <input type="text" class="team-name fm-input" placeholder="Team/Club Name" value="${teamName}">
                </div>
                <div>
                    <input type="text" class="team-league fm-input" placeholder="League/Division" value="${league}">
                </div>
            </div>
        `;
        
        container.insertBefore(teamItem, container.querySelector('small'));
        
        // If this is the first team, ensure it's selected as primary
        if (isFirstTeam) {
            const radioButton = teamItem.querySelector('input[type="radio"]');
            if (radioButton) radioButton.checked = true;
        }
    }

    collectPositionData() {
        const positions = [];
        const selectedItems = document.querySelectorAll('.position-item.selected');
        let primaryPosition = null;
        
        // First, find the primary position
        const primaryCheckbox = document.querySelector('.primary-checkbox:checked');
        if (primaryCheckbox) {
            primaryPosition = primaryCheckbox.dataset.position;
        }
        
        selectedItems.forEach((item) => {
            const position = item.dataset.position;
            const checkbox = item.querySelector(`input[type="checkbox"][data-position="${position}"]`);
            const suitabilityRange = item.querySelector(`input[type="range"][data-position="${position}"]`);
            const notesTextarea = item.querySelector(`textarea[data-position="${position}"]`);
            
            if (checkbox && checkbox.checked) {
                const positionData = {
                    position: position,
                    suitability: parseInt(suitabilityRange.value) || 75,
                    notes: notesTextarea.value.trim() || '',
                    order: position === primaryPosition ? 1 : 2 // Primary gets order 1, others get order 2
                };
                positions.push(positionData);
            }
        });

        // Sort so primary position comes first, then others
        return positions.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            // If same order (both secondary), sort alphabetically
            return a.position.localeCompare(b.position);
        });
    }

    collectFormData() {
        // Parse strengths and weaknesses from text areas
        const strengthsText = document.getElementById('strengths').value.trim();
        const weaknessesText = document.getElementById('weaknesses').value.trim();
        
        const strengths = strengthsText ? strengthsText.split('\n').map(s => s.replace(/^-\s*/, '').trim()).filter(s => s.length > 0) : [];
        const weaknesses = weaknessesText ? weaknessesText.split('\n').map(w => w.replace(/^-\s*/, '').trim()).filter(w => w.length > 0) : [];
        
        // Collect awards data
        const awards = [];
        document.querySelectorAll('.award-item').forEach(item => {
            const title = item.querySelector('.award-title').value.trim();
            const season = item.querySelector('.award-season').value.trim();
            if (title) {
                awards.push({ title, season });
            }
        });
        
        // Collect teams data
        const teams = [];
        document.querySelectorAll('.team-item').forEach(item => {
            const teamName = item.querySelector('.team-name').value.trim();
            const league = item.querySelector('.team-league').value.trim();
            const isPrimary = item.querySelector('input[type="radio"]').checked;
            if (teamName) {
                teams.push({ 
                    clubName: teamName, 
                    league: league,
                    isPrimary: isPrimary
                });
            }
        });

        const formData = {
            personalInfo: {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                dateOfBirth: document.getElementById('dateOfBirth').value,
                height: {
                    centimeters: Math.round((parseFloat(document.getElementById('heightCm').value) || 0) * 10) / 10,
                    feet: Math.floor((parseFloat(document.getElementById('heightCm').value) || 0) / 30.48),
                    inches: Math.round(((parseFloat(document.getElementById('heightCm').value) || 0) % 30.48) / 2.54)
                },
                weight: {
                    kilograms: Math.round((parseFloat(document.getElementById('weightKg').value) || 0) * 10) / 10,
                    pounds: Math.round((parseFloat(document.getElementById('weightKg').value) || 0) * 2.20462 * 10) / 10
                },
                preferredFoot: document.getElementById('preferredFoot').value,
                weakFootStrength: parseInt(document.getElementById('weakFootStrength').value) || 50,
                nationality: document.getElementById('nationality').value
            },
            contactInfo: {
                player: {
                    phone: document.getElementById('playerPhone').value,
                    email: document.getElementById('playerEmail').value
                },
                guardian: {
                    name: document.getElementById('guardianName').value,
                    phone: document.getElementById('guardianPhone').value,
                    email: document.getElementById('guardianEmail').value
                }
            },
            playingInfo: {
                positions: this.collectPositionData(),
                yearsPlaying: parseInt(document.getElementById('yearsPlaying').value) || 0,
                teams: teams,
                // Keep currentTeam for backward compatibility - use primary team
                currentTeam: teams.find(t => t.isPrimary) || teams[0] || { clubName: '', league: '' },
                basedLocation: document.getElementById('basedLocation').value,
                representativeTeams: {
                    district: {
                        selected: document.getElementById('districtTeam').value,
                        season: document.getElementById('districtTeamSeason').value
                    },
                    county: {
                        selected: document.getElementById('countyTeam').value,
                        season: document.getElementById('countyTeamSeason').value
                    }
                },
                trophiesAwards: awards
            },
            academicInfo: {
                currentSchool: document.getElementById('currentSchool').value,
                gradeYear: document.getElementById('gradeYear').value
            },
            abilities: {
                technical: {
                    ballControl: { rating: parseInt(document.getElementById('ballControl').value), description: '' },
                    passing: { rating: parseInt(document.getElementById('passing').value), description: '' },
                    shooting: { rating: parseInt(document.getElementById('shooting').value), description: '' },
                    dribbling: { rating: parseInt(document.getElementById('dribbling').value) || 5, description: '' },
                    firstTouch: { rating: parseInt(document.getElementById('firstTouch').value) || 5, description: '' },
                    crossing: { rating: parseInt(document.getElementById('crossing').value) || 5, description: '' },
                    tackling: { rating: parseInt(document.getElementById('tackling').value) || 5, description: '' },
                    heading: { rating: parseInt(document.getElementById('heading').value) || 5, description: '' }
                },
                physical: {
                    pace: { rating: parseInt(document.getElementById('pace').value), description: '' },
                    strength: { rating: parseInt(document.getElementById('strength').value), description: '' },
                    stamina: { rating: parseInt(document.getElementById('stamina').value), description: '' },
                    agility: { rating: parseInt(document.getElementById('agility').value) || 5, description: '' },
                    balance: { rating: parseInt(document.getElementById('balance').value) || 5, description: '' },
                    jumping: { rating: parseInt(document.getElementById('jumping').value) || 5, description: '' }
                },
                mental: {
                    decisionMaking: { rating: parseInt(document.getElementById('decisionMaking').value) || 5, description: '' },
                    positioning: { rating: parseInt(document.getElementById('positioning').value) || 5, description: '' },
                    concentration: { rating: parseInt(document.getElementById('concentration').value) || 5, description: '' },
                    leadership: { rating: parseInt(document.getElementById('leadership').value) || 5, description: '' },
                    communication: { rating: parseInt(document.getElementById('communication').value) || 5, description: '' }
                },
                athletic: {
                    sprint10m: parseFloat(document.getElementById('sprint10m').value) || null,
                    sprint30m: parseFloat(document.getElementById('sprint30m').value) || null,
                    run1km: parseFloat(document.getElementById('run1km').value) || null,
                    bleepTest: parseFloat(document.getElementById('bleepTest').value) || null
                }
            },
            showcase: {
                description: document.getElementById('playerShowcase').value
            },
            playingStyle: {
                summary: document.getElementById('playingStyleSummary').value,
                strengths: strengths,
                weaknesses: weaknesses
            },
            location: {
                postcode: document.getElementById('postcode').value,
                city: document.getElementById('city').value,
                county: document.getElementById('county').value,
                country: document.getElementById('country').value,
                coordinates: {
                    latitude: parseFloat(document.getElementById('postcode').dataset.latitude) || null,
                    longitude: parseFloat(document.getElementById('postcode').dataset.longitude) || null
                }
            },
            availability: {
                status: document.getElementById('availability-status').value,
                willingToRelocate: document.getElementById('willing-to-relocate').checked,
                preferredLocations: document.getElementById('preferred-locations').value.split(',').map(l => l.trim()).filter(l => l),
                travelRadius: parseInt(document.getElementById('travel-radius').value) || 25
            }
        };

        // Preserve metadata if editing existing player
        if (this.currentPlayer && this.currentPlayer.metadata) {
            formData.metadata = this.currentPlayer.metadata;
        }
        
        // Preserve media (profile photo) if not explicitly removed
        if (this.currentPlayer && this.currentPlayer.media && !this.photoRemoved) {
            formData.media = this.currentPlayer.media;
        }

        return formData;
    }

    async handlePlayerForm(e) {
        e.preventDefault();
        
        const playerData = this.collectFormData();
        
        try {
            const url = this.currentPlayer ? `/api/players/${this.currentPlayer.playerId}` : '/api/players';
            const method = this.currentPlayer ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(playerData),
            });

            const data = await response.json();

            if (response.ok) {
                // Handle photo upload if a file was selected
                const fileInput = document.getElementById('profilePhoto');
                if (fileInput.files.length > 0) {
                    const playerId = data.playerId || this.currentPlayer.playerId;
                    await this.uploadProfilePhoto(playerId, fileInput.files[0]);
                }
                
                this.showMessage(`Player profile ${this.currentPlayer ? 'updated' : 'created'} successfully!`, 'success');
                
                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    window.location.href = '/app';
                }, 1500);
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            console.error('Error saving player profile:', error);
            this.showMessage('Failed to save player profile. Please try again.', 'error');
        }
    }

    async uploadProfilePhoto(playerId, file) {
        // Check file size before upload (5MB limit for original file)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showMessage('Image too large. Please use an image smaller than 5MB.', 'error');
            return;
        }
        
        try {
            // Compress and convert file to base64
            const compressedBase64 = await this.compressAndConvertImage(file);
            
            console.log('Photo compressed and converted to base64, size:', compressedBase64.length);
            
            // Update the player's profile photo URL directly
            await this.updatePlayerPhotoUrl(playerId, compressedBase64);
        } catch (error) {
            console.error('Error uploading profile photo:', error);
            this.showMessage('Failed to upload profile photo. Please try again.', 'error');
        }
    }

    async compressAndConvertImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate new dimensions (max 400x400 for profile photos)
                let { width, height } = img;
                const maxSize = 400;
                
                if (width > height) {
                    if (width > maxSize) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                // Start with high quality and reduce if needed
                let quality = 0.8;
                let finalBase64 = canvas.toDataURL('image/jpeg', quality);
                
                // If still too large, reduce quality or dimensions
                const maxBase64Size = 1024 * 1024; // 1MB limit for base64
                if (finalBase64.length > maxBase64Size) {
                    quality = 0.6;
                    finalBase64 = canvas.toDataURL('image/jpeg', quality);
                    
                    if (finalBase64.length > maxBase64Size) {
                        quality = 0.4;
                        finalBase64 = canvas.toDataURL('image/jpeg', quality);
                        
                        if (finalBase64.length > maxBase64Size) {
                            // Further reduce dimensions
                            canvas.width = width * 0.8;
                            canvas.height = height * 0.8;
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            finalBase64 = canvas.toDataURL('image/jpeg', 0.4);
                        }
                    }
                }
                
                console.log('Final compressed image size:', finalBase64.length, 'bytes');
                resolve(finalBase64);
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    async updatePlayerPhotoUrl(playerId, photoUrl) {
        try {
            console.log('Updating player photo URL, length:', photoUrl.length);
            
            // Get the current player data
            const getResponse = await fetch(`/api/players/${playerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (getResponse.ok) {
                const playerData = await getResponse.json();
                
                // Update media.profilePhoto
                if (!playerData.media) {
                    playerData.media = {};
                }
                playerData.media.profilePhoto = photoUrl;
                
                console.log('About to update player with photo URL');
                
                // Update the player with the new photo
                const updateResponse = await fetch(`/api/players/${playerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify(playerData)
                });
                
                if (updateResponse.ok) {
                    console.log('Player photo updated successfully');
                    this.showMessage('Profile photo uploaded successfully!', 'success');
                } else {
                    throw new Error('Failed to update player photo');
                }
            } else {
                throw new Error('Failed to get current player data');
            }
        } catch (error) {
            console.error('Error updating player photo:', error);
            this.showMessage('Failed to update player photo. Please try again.', 'error');
        }
    }

    async lookupPostcode() {
        const postcodeInput = document.getElementById('postcode');
        const postcode = postcodeInput.value.trim();
        
        if (!postcode) {
            this.showMessage('Please enter a postcode', 'error');
            return;
        }
        
        const lookupBtn = document.getElementById('lookup-postcode');
        lookupBtn.disabled = true;
        lookupBtn.textContent = 'Looking up...';
        
        try {
            const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
            const data = await response.json();
            
            if (response.ok && data.status === 200) {
                const result = data.result;
                
                // Store coordinates as data attributes
                postcodeInput.dataset.latitude = result.latitude;
                postcodeInput.dataset.longitude = result.longitude;
                
                // Fill in the location fields
                document.getElementById('city').value = result.admin_district || result.parliamentary_constituency || '';
                document.getElementById('county').value = result.admin_county || result.region || '';
                document.getElementById('country').value = result.country;
                
                this.showMessage('Location found!', 'success');
            } else {
                this.showMessage('Postcode not found. Please check and try again.', 'error');
            }
        } catch (error) {
            console.error('Postcode lookup error:', error);
            this.showMessage('Error looking up postcode. Please try again.', 'error');
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.textContent = 'Lookup';
        }
    }

    removeProfilePhoto() {
        if (this.currentPlayer && this.currentPlayer.media) {
            delete this.currentPlayer.media.profilePhoto;
            this.photoRemoved = true;
            document.getElementById('current-photo-preview').style.display = 'none';
            this.showMessage('Photo will be removed when you save', 'info');
        }
    }

    async quickSave() {
        try {
            // Show a quick save message
            this.showMessage('Saving...', 'info');
            
            // Trigger the form submission
            const form = document.getElementById('player-form-content');
            if (form) {
                // Create a synthetic submit event
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
            }
        } catch (error) {
            console.error('Quick save error:', error);
            this.showMessage('Failed to save. Please try again.', 'error');
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/app';
    }

    showMessage(message, type) {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = `fm-toast fm-toast-${type} fm-fade-in`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? 'var(--fm-success)' : type === 'error' ? 'var(--fm-danger)' : 'var(--fm-warning)'};
            color: white;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            z-index: 3000;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Initialize the form when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PlayerForm();
});