// Search Wizard JavaScript

class SearchWizard {
    constructor() {
        this.currentStep = 0;
        this.steps = ['type', 'basic', 'physical', 'playing', 'skills', 'preview'];
        this.searchType = null;
        this.criteria = new SearchCriteria();
        this.selectedPositions = new Set();
        
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        
        this.init();
    }
    
    init() {
        // Check authentication
        if (!this.token || !this.user) {
            window.location.href = '/app';
            return;
        }
        
        // Check permissions
        const allowedRoles = ['scout', 'coach', 'agent', 'admin'];
        if (!allowedRoles.includes(this.user.role)) {
            alert('You do not have permission to access this page');
            window.location.href = '/app';
            return;
        }
        
        this.setupEventListeners();
        this.setupSkillSliders();
        this.setupRangeSliders();
        this.loadSearchTemplates();
    }
    
    setupEventListeners() {
        // Navigation
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '/search.html';
        });
        
        document.getElementById('prev-btn').addEventListener('click', () => this.previousStep());
        document.getElementById('next-btn').addEventListener('click', () => this.nextStep());
        
        // Search type selection
        document.querySelectorAll('.search-type-card').forEach(card => {
            card.addEventListener('click', (e) => this.selectSearchType(e.currentTarget));
        });
        
        // Position selection
        document.querySelectorAll('.position-marker').forEach(marker => {
            marker.addEventListener('click', (e) => this.togglePosition(e.currentTarget));
        });
        
        // Template selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.template-card')) {
                this.loadTemplate(e.target.closest('.template-card').dataset.template);
            }
        });
        
        // Search actions
        document.getElementById('quick-search-btn').addEventListener('click', () => this.performQuickSearch());
        document.getElementById('search-now-btn').addEventListener('click', () => this.performAdvancedSearch());
        document.getElementById('save-and-search-btn').addEventListener('click', () => this.saveAndSearch());
        
        // Save/Load search
        document.getElementById('save-search-btn').addEventListener('click', () => this.showSaveDialog());
        document.getElementById('load-search-btn').addEventListener('click', () => this.showSavedSearches());
        
        // Modal close buttons
        document.getElementById('close-results').addEventListener('click', () => this.closeModal('search-results-modal'));
        document.getElementById('close-saved').addEventListener('click', () => this.closeModal('saved-searches-modal'));
        
        // Height unit toggle
        document.querySelectorAll('input[name="height-unit"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.toggleHeightUnit(e.target.value));
        });
        
        // Quick search enter key
        document.getElementById('quick-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performQuickSearch();
            }
        });
    }
    
    setupSkillSliders() {
        document.querySelectorAll('.skill-slider').forEach(slider => {
            const valueDisplay = slider.parentElement.querySelector('.skill-value');
            
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
            });
            
            // Initialize display
            valueDisplay.textContent = slider.value;
        });
    }
    
    setupRangeSliders() {
        // Age range
        const ageMinSlider = document.getElementById('age-min-slider');
        const ageMaxSlider = document.getElementById('age-max-slider');
        const ageMinDisplay = document.getElementById('age-min-display');
        const ageMaxDisplay = document.getElementById('age-max-display');
        
        this.setupDualRangeSlider(ageMinSlider, ageMaxSlider, ageMinDisplay, ageMaxDisplay);
        
        // Height range (cm)
        const heightMinCm = document.getElementById('height-min-cm');
        const heightMaxCm = document.getElementById('height-max-cm');
        const heightMinCmDisplay = document.getElementById('height-min-cm-display');
        const heightMaxCmDisplay = document.getElementById('height-max-cm-display');
        
        this.setupDualRangeSlider(heightMinCm, heightMaxCm, heightMinCmDisplay, heightMaxCmDisplay);
        
        // Weak foot strength
        const weakFootSlider = document.getElementById('weak-foot-min');
        const weakFootDisplay = document.getElementById('weak-foot-display');
        
        weakFootSlider.addEventListener('input', (e) => {
            weakFootDisplay.textContent = e.target.value;
        });
    }
    
    setupDualRangeSlider(minSlider, maxSlider, minDisplay, maxDisplay) {
        const updateSliders = () => {
            const min = parseInt(minSlider.value);
            const max = parseInt(maxSlider.value);
            
            if (min > max) {
                minSlider.value = max;
                minDisplay.textContent = max;
            } else {
                minDisplay.textContent = min;
            }
            
            if (max < min) {
                maxSlider.value = min;
                maxDisplay.textContent = min;
            } else {
                maxDisplay.textContent = max;
            }
        };
        
        minSlider.addEventListener('input', updateSliders);
        maxSlider.addEventListener('input', updateSliders);
    }
    
    selectSearchType(card) {
        // Remove previous selection
        document.querySelectorAll('.search-type-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        
        this.searchType = card.dataset.type;
        
        // Show/hide relevant panels
        document.getElementById('quick-search-panel').style.display = 'none';
        document.getElementById('templates-panel').style.display = 'none';
        
        switch (this.searchType) {
            case 'quick':
                document.getElementById('quick-search-panel').style.display = 'block';
                break;
            case 'template':
                document.getElementById('templates-panel').style.display = 'block';
                break;
            case 'wizard':
                // Continue to next step
                document.getElementById('next-btn').disabled = false;
                break;
        }
    }
    
    togglePosition(marker) {
        const position = marker.dataset.position;
        
        if (this.selectedPositions.has(position)) {
            this.selectedPositions.delete(position);
            marker.classList.remove('selected');
        } else {
            this.selectedPositions.add(position);
            marker.classList.add('selected');
        }
        
        this.updateSelectedPositions();
    }
    
    updateSelectedPositions() {
        const container = document.getElementById('selected-positions-list');
        container.innerHTML = '';
        
        this.selectedPositions.forEach(position => {
            const tag = document.createElement('div');
            tag.className = 'position-tag';
            tag.innerHTML = `
                ${position}
                <button onclick="searchWizard.removePosition('${position}')">&times;</button>
            `;
            container.appendChild(tag);
        });
    }
    
    removePosition(position) {
        this.selectedPositions.delete(position);
        document.querySelector(`.position-marker[data-position="${position}"]`).classList.remove('selected');
        this.updateSelectedPositions();
    }
    
    toggleHeightUnit(unit) {
        if (unit === 'cm') {
            document.getElementById('height-cm-container').style.display = 'block';
            document.getElementById('height-ft-container').style.display = 'none';
        } else {
            document.getElementById('height-cm-container').style.display = 'none';
            document.getElementById('height-ft-container').style.display = 'block';
        }
    }
    
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }
    
    nextStep() {
        if (this.currentStep === 0 && !this.searchType) {
            alert('Please select a search type');
            return;
        }
        
        if (this.searchType === 'wizard' && this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
            
            if (this.currentStep === this.steps.length - 1) {
                this.generatePreview();
            }
        }
    }
    
    showStep(index) {
        // Update step visibility
        document.querySelectorAll('.wizard-step').forEach(step => step.classList.remove('active'));
        document.getElementById(`step-${this.steps[index]}`).classList.add('active');
        
        // Update step indicator
        document.querySelectorAll('.step').forEach((step, i) => {
            step.classList.remove('active', 'completed');
            if (i < index) {
                step.classList.add('completed');
            } else if (i === index) {
                step.classList.add('active');
            }
        });
        
        // Update navigation buttons
        document.getElementById('prev-btn').disabled = index === 0;
        document.getElementById('next-btn').textContent = index === this.steps.length - 1 ? 'Finish' : 'Next';
    }
    
    collectCriteria() {
        // Basic Information
        this.criteria.basic = {
            name: document.getElementById('search-name').value,
            ageMin: parseInt(document.getElementById('age-min-slider').value) || null,
            ageMax: parseInt(document.getElementById('age-max-slider').value) || null,
            nationality: document.getElementById('search-nationality').value,
            postcode: document.getElementById('search-postcode').value,
            radius: parseInt(document.getElementById('search-radius').value),
            availability: {
                statuses: Array.from(document.querySelectorAll('#step-basic input[type="checkbox"]:checked'))
                    .filter(cb => cb.id.startsWith('status-'))
                    .map(cb => cb.value),
                willingToRelocate: document.getElementById('willing-relocate').checked
            }
        };
        
        // Physical Profile
        const heightUnit = document.querySelector('input[name="height-unit"]:checked').value;
        if (heightUnit === 'cm') {
            this.criteria.physical = {
                heightMin: parseInt(document.getElementById('height-min-cm').value),
                heightMax: parseInt(document.getElementById('height-max-cm').value),
                heightUnit: 'cm'
            };
        } else {
            const minFt = parseInt(document.getElementById('height-min-ft').value) || 0;
            const minIn = parseInt(document.getElementById('height-min-in').value) || 0;
            const maxFt = parseInt(document.getElementById('height-max-ft').value) || 7;
            const maxIn = parseInt(document.getElementById('height-max-in').value) || 11;
            
            this.criteria.physical = {
                heightMin: minFt * 30.48 + minIn * 2.54, // Convert to cm
                heightMax: maxFt * 30.48 + maxIn * 2.54,
                heightUnit: 'ft'
            };
        }
        
        this.criteria.physical.preferredFoot = document.getElementById('search-preferred-foot').value;
        this.criteria.physical.weakFootMin = parseInt(document.getElementById('weak-foot-min').value);
        this.criteria.physical.sprint10mMax = parseFloat(document.getElementById('sprint-10m-max').value) || null;
        this.criteria.physical.sprint30mMax = parseFloat(document.getElementById('sprint-30m-max').value) || null;
        
        // Playing Profile
        this.criteria.playing = {
            positions: Array.from(this.selectedPositions),
            yearsPlayingMin: parseInt(document.getElementById('years-playing-min').value) || null,
            league: document.getElementById('search-league').value,
            representativeExp: {
                district: document.getElementById('rep-district').checked,
                county: document.getElementById('rep-county').checked
            }
        };
        
        // Skills
        this.criteria.skills = {
            technical: {},
            physical: {},
            mental: {}
        };
        
        // Technical skills
        ['ball-control', 'passing', 'shooting', 'dribbling', 'first-touch', 'heading'].forEach(skill => {
            const value = parseInt(document.getElementById(`skill-${skill}`).value);
            if (value > 0) {
                this.criteria.skills.technical[skill.replace('-', '_')] = value;
            }
        });
        
        // Physical attributes
        ['pace', 'strength', 'stamina', 'agility'].forEach(skill => {
            const value = parseInt(document.getElementById(`skill-${skill}`).value);
            if (value > 0) {
                this.criteria.skills.physical[skill] = value;
            }
        });
        
        // Mental attributes
        ['decision-making', 'leadership', 'concentration', 'communication'].forEach(skill => {
            const value = parseInt(document.getElementById(`skill-${skill}`).value);
            if (value > 0) {
                this.criteria.skills.mental[skill.replace('-', '_')] = value;
            }
        });
        
        return this.criteria;
    }
    
    generatePreview() {
        const criteria = this.collectCriteria();
        const previewContainer = document.getElementById('preview-summary');
        let html = '';
        
        // Basic Information
        const basicItems = [];
        if (criteria.basic.name) basicItems.push(`Name contains "${criteria.basic.name}"`);
        if (criteria.basic.ageMin || criteria.basic.ageMax) {
            basicItems.push(`Age ${criteria.basic.ageMin || 16}-${criteria.basic.ageMax || 45}`);
        }
        if (criteria.basic.nationality) basicItems.push(criteria.basic.nationality);
        if (criteria.basic.postcode) basicItems.push(`Within ${criteria.basic.radius} miles of ${criteria.basic.postcode}`);
        if (criteria.basic.availability.statuses.length > 0) {
            basicItems.push(criteria.basic.availability.statuses.map(s => s.replace('_', ' ')).join(', '));
        }
        if (criteria.basic.availability.willingToRelocate) basicItems.push('Willing to relocate');
        
        if (basicItems.length > 0) {
            html += `
                <div class="preview-section">
                    <h4>Basic Information</h4>
                    <div class="preview-items">
                        ${basicItems.map(item => `<div class="preview-item">${item}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // Physical Profile
        const physicalItems = [];
        if (criteria.physical.heightMin || criteria.physical.heightMax) {
            if (criteria.physical.heightUnit === 'cm') {
                physicalItems.push(`Height ${criteria.physical.heightMin}-${criteria.physical.heightMax}cm`);
            } else {
                physicalItems.push(`Height ${Math.floor(criteria.physical.heightMin / 30.48)}'${Math.round((criteria.physical.heightMin % 30.48) / 2.54)}" - ${Math.floor(criteria.physical.heightMax / 30.48)}'${Math.round((criteria.physical.heightMax % 30.48) / 2.54)}"`);
            }
        }
        if (criteria.physical.preferredFoot) physicalItems.push(`${criteria.physical.preferredFoot} footed`);
        if (criteria.physical.weakFootMin > 0) physicalItems.push(`Weak foot ≥${criteria.physical.weakFootMin}%`);
        if (criteria.physical.sprint10mMax) physicalItems.push(`10m sprint ≤${criteria.physical.sprint10mMax}s`);
        if (criteria.physical.sprint30mMax) physicalItems.push(`30m sprint ≤${criteria.physical.sprint30mMax}s`);
        
        if (physicalItems.length > 0) {
            html += `
                <div class="preview-section">
                    <h4>Physical Profile</h4>
                    <div class="preview-items">
                        ${physicalItems.map(item => `<div class="preview-item">${item}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // Playing Profile
        const playingItems = [];
        if (criteria.playing.positions.length > 0) {
            playingItems.push(`Positions: ${criteria.playing.positions.join(', ')}`);
        }
        if (criteria.playing.yearsPlayingMin) playingItems.push(`≥${criteria.playing.yearsPlayingMin} years experience`);
        if (criteria.playing.league) playingItems.push(`League: ${criteria.playing.league}`);
        if (criteria.playing.representativeExp.district) playingItems.push('District level');
        if (criteria.playing.representativeExp.county) playingItems.push('County level');
        
        if (playingItems.length > 0) {
            html += `
                <div class="preview-section">
                    <h4>Playing Profile</h4>
                    <div class="preview-items">
                        ${playingItems.map(item => `<div class="preview-item">${item}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // Skills
        const skillItems = [];
        const allSkills = {
            ...criteria.skills.technical,
            ...criteria.skills.physical,
            ...criteria.skills.mental
        };
        
        Object.entries(allSkills).forEach(([skill, value]) => {
            const skillName = skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            skillItems.push(`${skillName} ≥${value}`);
        });
        
        if (skillItems.length > 0) {
            html += `
                <div class="preview-section">
                    <h4>Skills & Abilities</h4>
                    <div class="preview-items">
                        ${skillItems.map(item => `<div class="preview-item">${item}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        
        previewContainer.innerHTML = html || '<p>No search criteria selected</p>';
    }
    
    async performQuickSearch() {
        const query = document.getElementById('quick-search-input').value.trim();
        
        if (!query) {
            alert('Please enter a search query');
            return;
        }
        
        try {
            const response = await fetch(`/api/players/search/quick?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const players = await response.json();
                this.showResults(players);
            } else {
                throw new Error('Search failed');
            }
        } catch (error) {
            console.error('Quick search error:', error);
            alert('Failed to perform search. Please try again.');
        }
    }
    
    async performAdvancedSearch() {
        const criteria = this.collectCriteria();
        
        try {
            const response = await fetch('/api/players/search/advanced', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ criteria })
            });
            
            if (response.ok) {
                const players = await response.json();
                this.showResults(players);
            } else {
                throw new Error('Search failed');
            }
        } catch (error) {
            console.error('Advanced search error:', error);
            alert('Failed to perform search. Please try again.');
        }
    }
    
    async saveAndSearch() {
        const searchName = document.getElementById('search-name-save').value.trim();
        
        if (!searchName) {
            alert('Please enter a name for this search');
            return;
        }
        
        const criteria = this.collectCriteria();
        
        try {
            // Save the search
            const saveResponse = await fetch('/api/search/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: searchName, criteria })
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to save search');
            }
            
            // Perform the search
            await this.performAdvancedSearch();
        } catch (error) {
            console.error('Save and search error:', error);
            alert('Failed to save search. Please try again.');
        }
    }
    
    showResults(players) {
        const container = document.getElementById('results-container');
        
        if (players.length === 0) {
            container.innerHTML = '<p>No players found matching your criteria.</p>';
        } else {
            container.innerHTML = `
                <p>Found ${players.length} players</p>
                <div class="results-grid">
                    ${players.map(player => this.renderPlayerCard(player)).join('')}
                </div>
            `;
        }
        
        document.getElementById('search-results-modal').style.display = 'flex';
    }
    
    renderPlayerCard(player) {
        const name = `${player.personalInfo?.firstName || ''} ${player.personalInfo?.lastName || ''}`.trim();
        const age = this.calculateAge(player.personalInfo?.dateOfBirth);
        const position = player.playingInfo?.positions?.[0]?.position || 'Unknown';
        
        return `
            <div class="player-result-card" onclick="window.open('/profile-view.html?id=${player.id}', '_blank')">
                <h3>${name}</h3>
                <p>${position} • Age ${age}</p>
                <p>${player.location?.city || 'Unknown location'}</p>
            </div>
        `;
    }
    
    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return 'Unknown';
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }
    
    async loadSearchTemplates() {
        // Templates are defined here for now, but could be loaded from server
        this.templates = {
            'young-strikers': {
                basic: {
                    ageMax: 21,
                    availability: { statuses: ['actively_looking', 'open_to_offers'] }
                },
                playing: {
                    positions: ['ST', 'CF']
                },
                skills: {
                    technical: { shooting: 7, first_touch: 6 },
                    physical: { pace: 7 }
                }
            },
            'tall-defenders': {
                physical: {
                    heightMin: 183, // 6ft
                    heightUnit: 'cm'
                },
                playing: {
                    positions: ['CB']
                },
                skills: {
                    technical: { heading: 7 },
                    physical: { strength: 7 }
                }
            },
            'creative-midfielders': {
                playing: {
                    positions: ['AM', 'CM']
                },
                skills: {
                    technical: { passing: 8, ball_control: 7 },
                    mental: { decision_making: 7 }
                }
            },
            'athletic-wingers': {
                playing: {
                    positions: ['LW', 'RW']
                },
                skills: {
                    technical: { dribbling: 7 },
                    physical: { pace: 8, agility: 7 }
                }
            }
        };
    }
    
    loadTemplate(templateId) {
        const template = this.templates[templateId];
        if (!template) return;
        
        // Reset form
        this.resetForm();
        
        // Apply template values
        if (template.basic) {
            if (template.basic.ageMax) {
                document.getElementById('age-max-slider').value = template.basic.ageMax;
                document.getElementById('age-max-display').textContent = template.basic.ageMax;
            }
            if (template.basic.availability?.statuses) {
                template.basic.availability.statuses.forEach(status => {
                    const checkbox = document.querySelector(`#status-${status}`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
        
        if (template.physical) {
            if (template.physical.heightMin) {
                document.getElementById('height-min-cm').value = template.physical.heightMin;
                document.getElementById('height-min-cm-display').textContent = template.physical.heightMin;
            }
        }
        
        if (template.playing?.positions) {
            template.playing.positions.forEach(pos => {
                const marker = document.querySelector(`.position-marker[data-position="${pos}"]`);
                if (marker) {
                    this.selectedPositions.add(pos);
                    marker.classList.add('selected');
                }
            });
            this.updateSelectedPositions();
        }
        
        if (template.skills) {
            Object.entries(template.skills).forEach(([category, skills]) => {
                Object.entries(skills).forEach(([skill, value]) => {
                    const slider = document.getElementById(`skill-${skill.replace(/_/g, '-')}`);
                    if (slider) {
                        slider.value = value;
                        slider.parentElement.querySelector('.skill-value').textContent = value;
                    }
                });
            });
        }
        
        // Switch to wizard mode
        this.searchType = 'wizard';
        this.currentStep = 1;
        this.showStep(1);
    }
    
    resetForm() {
        // Reset all form inputs
        document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
            input.value = '';
        });
        
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        document.querySelectorAll('select').forEach(select => {
            select.selectedIndex = 0;
        });
        
        document.querySelectorAll('.skill-slider').forEach(slider => {
            slider.value = 0;
            slider.parentElement.querySelector('.skill-value').textContent = '0';
        });
        
        // Reset positions
        this.selectedPositions.clear();
        document.querySelectorAll('.position-marker').forEach(marker => {
            marker.classList.remove('selected');
        });
        this.updateSelectedPositions();
    }
    
    async showSavedSearches() {
        try {
            const response = await fetch('/api/search/saved', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const searches = await response.json();
                this.displaySavedSearches(searches);
            } else {
                throw new Error('Failed to load saved searches');
            }
        } catch (error) {
            console.error('Load saved searches error:', error);
            alert('Failed to load saved searches');
        }
    }
    
    displaySavedSearches(searches) {
        const container = document.getElementById('saved-searches-list');
        
        if (searches.length === 0) {
            container.innerHTML = '<p>No saved searches found.</p>';
        } else {
            container.innerHTML = searches.map(search => `
                <div class="saved-search-item">
                    <h4>${search.name}</h4>
                    <p>Created: ${new Date(search.created_at).toLocaleDateString()}</p>
                    <button class="fm-btn fm-btn-sm fm-btn-primary" onclick="searchWizard.loadSavedSearch('${search.id}')">
                        Load Search
                    </button>
                </div>
            `).join('');
        }
        
        document.getElementById('saved-searches-modal').style.display = 'flex';
    }
    
    async loadSavedSearch(searchId) {
        try {
            const response = await fetch(`/api/search/saved/${searchId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const search = await response.json();
                // Apply search criteria to form
                // Implementation depends on how saved searches are structured
                this.closeModal('saved-searches-modal');
                alert('Search loaded successfully');
            } else {
                throw new Error('Failed to load search');
            }
        } catch (error) {
            console.error('Load search error:', error);
            alert('Failed to load search');
        }
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    showSaveDialog() {
        const searchName = prompt('Enter a name for this search:');
        if (searchName) {
            // Save current criteria
            const criteria = this.collectCriteria();
            this.saveSearch(searchName, criteria);
        }
    }
    
    async saveSearch(name, criteria) {
        try {
            const response = await fetch('/api/search/save', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, criteria })
            });
            
            if (response.ok) {
                alert('Search saved successfully');
            } else {
                throw new Error('Failed to save search');
            }
        } catch (error) {
            console.error('Save search error:', error);
            alert('Failed to save search');
        }
    }
}

// Helper class for managing search criteria
class SearchCriteria {
    constructor() {
        this.basic = {};
        this.physical = {};
        this.playing = {};
        this.skills = {
            technical: {},
            physical: {},
            mental: {}
        };
        this.additional = {};
    }
    
    toQueryParams() {
        const params = {};
        
        // Basic
        if (this.basic.name) params.name = this.basic.name;
        if (this.basic.ageMin) params.ageMin = this.basic.ageMin;
        if (this.basic.ageMax) params.ageMax = this.basic.ageMax;
        if (this.basic.nationality) params.nationality = this.basic.nationality;
        if (this.basic.postcode) params.postcode = this.basic.postcode;
        if (this.basic.radius) params.radius = this.basic.radius;
        if (this.basic.availability?.statuses?.length > 0) {
            params.availability = this.basic.availability.statuses.join(',');
        }
        if (this.basic.availability?.willingToRelocate) {
            params.willingToRelocate = 'true';
        }
        
        // Physical
        if (this.physical.heightMin) params.heightMin = this.physical.heightMin;
        if (this.physical.heightMax) params.heightMax = this.physical.heightMax;
        if (this.physical.preferredFoot) params.preferredFoot = this.physical.preferredFoot;
        if (this.physical.weakFootMin) params.weakFootMin = this.physical.weakFootMin;
        
        // Playing
        if (this.playing.positions?.length > 0) {
            params.positions = this.playing.positions.join(',');
        }
        
        // Skills are handled differently in advanced search
        
        return params;
    }
}

// Initialize wizard when page loads
let searchWizard;
document.addEventListener('DOMContentLoaded', () => {
    searchWizard = new SearchWizard();
});