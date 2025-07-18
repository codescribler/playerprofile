class PlayerForm {
    constructor() {
        this.token = localStorage.getItem('token');
        this.currentPlayer = null;
        this.init();
    }

    init() {
        // Check authentication
        if (!this.token) {
            window.location.href = 'index.html';
            return;
        }

        // Initialize form functionality
        this.initializeFormHandlers();
        this.initializeRangeSliders();
        this.loadPlayerDataIfEditing();
    }

    initializeFormHandlers() {
        // Form submission
        document.getElementById('player-form-content').addEventListener('submit', (e) => this.handlePlayerForm(e));
        
        // Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                window.history.back();
            }
        });

        // Secondary positions
        document.getElementById('addSecondaryPosition').addEventListener('click', () => this.addSecondaryPosition());

        // Photo upload
        document.getElementById('profilePhoto').addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        // Photo removal
        document.getElementById('remove-photo-btn').addEventListener('click', () => this.removePhoto());
    }

    initializeRangeSliders() {
        // Initialize all range sliders
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(input => {
            const valueDisplay = input.nextElementSibling;
            if (valueDisplay && valueDisplay.classList.contains('range-value')) {
                input.addEventListener('input', () => {
                    valueDisplay.textContent = input.value;
                });
            }
        });
    }

    loadPlayerDataIfEditing() {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        const playerId = urlParams.get('id');

        if (mode === 'edit' && playerId) {
            // Load from sessionStorage or fetch from API
            const savedData = sessionStorage.getItem('editPlayerData');
            if (savedData) {
                const player = JSON.parse(savedData);
                this.populateForm(player);
            } else {
                // Fetch from API if not in sessionStorage
                this.fetchPlayerData(playerId);
            }
        }
    }

    async fetchPlayerData(playerId) {
        try {
            const response = await fetch(`/api/players/${playerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const player = await response.json();
                this.populateForm(player);
            } else {
                alert('Failed to load player data');
                window.history.back();
            }
        } catch (error) {
            console.error('Error fetching player data:', error);
            alert('Error loading player data');
            window.history.back();
        }
    }

    populateForm(player) {
        this.currentPlayer = player;
        
        // Personal Information
        document.getElementById('fullName').value = player.personalInfo?.fullName || '';
        document.getElementById('dateOfBirth').value = player.personalInfo?.dateOfBirth || '';
        document.getElementById('heightCm').value = player.personalInfo?.heightCm || '';
        document.getElementById('weightKg').value = player.personalInfo?.weightKg || '';
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
        document.getElementById('primaryPosition').value = player.playingInfo?.primaryPosition || '';
        document.getElementById('primaryPositionSuitability').value = player.playingInfo?.primaryPositionSuitability || 100;
        document.getElementById('primaryPositionNotes').value = player.playingInfo?.primaryPositionNotes || '';
        document.getElementById('yearsPlaying').value = player.playingInfo?.yearsPlaying || '';
        document.getElementById('currentTeam').value = player.playingInfo?.currentTeam?.clubName || player.playingInfo?.currentTeam || '';
        document.getElementById('league').value = player.playingInfo?.currentTeam?.league || player.playingInfo?.league || '';

        // Academic Information
        document.getElementById('currentSchool').value = player.academicInfo?.currentSchool || '';
        document.getElementById('gradeYear').value = player.academicInfo?.gradeYear || '';

        // Abilities
        if (player.abilities) {
            Object.keys(player.abilities).forEach(category => {
                Object.keys(player.abilities[category]).forEach(ability => {
                    const element = document.getElementById(this.camelCase(ability));
                    if (element) {
                        element.value = player.abilities[category][ability];
                        const valueDisplay = element.nextElementSibling;
                        if (valueDisplay && valueDisplay.classList.contains('range-value')) {
                            valueDisplay.textContent = element.value;
                        }
                    }
                });
            });
        }

        // Player Showcase
        document.getElementById('playerShowcase').value = player.showcase?.description || '';
        document.getElementById('playingStyleSummary').value = player.showcase?.playingStyle || '';
        document.getElementById('strengths').value = player.showcase?.strengths ? player.showcase.strengths.join('\n') : '';
        document.getElementById('weaknesses').value = player.showcase?.weaknesses ? player.showcase.weaknesses.join('\n') : '';

        // Profile Photo
        if (player.media?.profilePhoto) {
            document.getElementById('current-photo').src = player.media.profilePhoto;
            document.getElementById('current-photo-preview').style.display = 'block';
        }

        // Secondary Positions
        if (player.playingInfo?.secondaryPositions) {
            player.playingInfo.secondaryPositions.forEach(pos => {
                this.addSecondaryPosition(pos.position, pos.suitability, pos.notes);
            });
        }
    }

    camelCase(str) {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
    }

    addSecondaryPosition(position = '', suitability = 75, notes = '') {
        const container = document.getElementById('secondaryPositionsContainer');
        const addButton = document.getElementById('addSecondaryPosition');
        
        const positionDiv = document.createElement('div');
        positionDiv.className = 'secondary-position';
        positionDiv.innerHTML = `
            <div class="form-group">
                <input type="text" class="secondary-position-name" placeholder="Position name" value="${position}">
                <input type="range" class="secondary-position-suitability" min="0" max="100" value="${suitability}">
                <span class="range-value">${suitability}</span>
                <span>%</span>
                <button type="button" class="remove-position-btn">Remove</button>
            </div>
            <div class="form-group">
                <textarea class="secondary-position-notes" placeholder="Notes about this position">${notes}</textarea>
            </div>
        `;
        
        container.insertBefore(positionDiv, addButton);
        
        // Add event listeners
        const rangeInput = positionDiv.querySelector('.secondary-position-suitability');
        const valueDisplay = positionDiv.querySelector('.range-value');
        rangeInput.addEventListener('input', () => {
            valueDisplay.textContent = rangeInput.value;
        });
        
        positionDiv.querySelector('.remove-position-btn').addEventListener('click', () => {
            positionDiv.remove();
        });
    }

    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const compressedImage = await this.compressAndConvertImage(file);
            document.getElementById('current-photo').src = compressedImage;
            document.getElementById('current-photo-preview').style.display = 'block';
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again.');
        }
    }

    async compressAndConvertImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                const maxSize = 800;
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxSize) {
                        height *= maxSize / width;
                        width = maxSize;
                    }
                } else {
                    if (height > maxSize) {
                        width *= maxSize / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                const maxBase64Size = 200 * 1024; // 200KB
                let quality = 0.8;
                let base64;
                
                do {
                    base64 = canvas.toDataURL('image/jpeg', quality);
                    quality -= 0.1;
                } while (base64.length > maxBase64Size && quality > 0.1);
                
                resolve(base64);
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    removePhoto() {
        document.getElementById('current-photo').src = '';
        document.getElementById('current-photo-preview').style.display = 'none';
        document.getElementById('profilePhoto').value = '';
    }

    async handlePlayerForm(e) {
        e.preventDefault();
        
        const formData = this.collectFormData();
        
        try {
            // Get player ID from current player data or URL params
            const urlParams = new URLSearchParams(window.location.search);
            const urlPlayerId = urlParams.get('id');
            const playerId = this.currentPlayer ? (this.currentPlayer.playerId || this.currentPlayer.id) : null;
            const finalPlayerId = playerId || urlPlayerId;
            
            console.log('Player form debug:', {
                currentPlayer: this.currentPlayer,
                playerId: playerId,
                urlPlayerId: urlPlayerId,
                finalPlayerId: finalPlayerId
            });
            
            const url = this.currentPlayer ? `/api/players/${finalPlayerId}` : '/api/players';
            const method = this.currentPlayer ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // Clear any saved draft
                localStorage.removeItem('playerFormDraft');
                sessionStorage.removeItem('editPlayerData');
                
                alert(this.currentPlayer ? 'Player profile updated successfully!' : 'Player profile created successfully!');
                window.location.href = 'index.html';
            } else {
                const error = await response.json();
                alert(`Error: ${error.error || 'Failed to save player profile'}`);
            }
        } catch (error) {
            console.error('Error saving player:', error);
            alert('Error saving player profile. Please try again.');
        }
    }

    collectFormData() {
        // Collect all form data
        const formData = {
            personalInfo: {
                fullName: document.getElementById('fullName').value,
                dateOfBirth: document.getElementById('dateOfBirth').value,
                heightCm: parseFloat(document.getElementById('heightCm').value) || null,
                weightKg: parseFloat(document.getElementById('weightKg').value) || null,
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
                primaryPosition: document.getElementById('primaryPosition').value,
                primaryPositionSuitability: parseInt(document.getElementById('primaryPositionSuitability').value),
                primaryPositionNotes: document.getElementById('primaryPositionNotes').value,
                secondaryPositions: this.collectSecondaryPositions(),
                yearsPlaying: parseInt(document.getElementById('yearsPlaying').value) || null,
                currentTeam: document.getElementById('currentTeam').value,
                league: document.getElementById('league').value
            },
            academicInfo: {
                currentSchool: document.getElementById('currentSchool').value,
                gradeYear: document.getElementById('gradeYear').value
            },
            abilities: {
                technical: {
                    ballControl: parseInt(document.getElementById('ballControl').value),
                    passing: parseInt(document.getElementById('passing').value),
                    shooting: parseInt(document.getElementById('shooting').value),
                    dribbling: parseInt(document.getElementById('dribbling').value),
                    firstTouch: parseInt(document.getElementById('firstTouch').value),
                    crossing: parseInt(document.getElementById('crossing').value),
                    tackling: parseInt(document.getElementById('tackling').value),
                    heading: parseInt(document.getElementById('heading').value)
                },
                physical: {
                    pace: parseInt(document.getElementById('pace').value),
                    strength: parseInt(document.getElementById('strength').value),
                    stamina: parseInt(document.getElementById('stamina').value),
                    agility: parseInt(document.getElementById('agility').value),
                    balance: parseInt(document.getElementById('balance').value),
                    jumping: parseInt(document.getElementById('jumping').value)
                },
                mental: {
                    decisionMaking: parseInt(document.getElementById('decisionMaking').value),
                    positioning: parseInt(document.getElementById('positioning').value),
                    concentration: parseInt(document.getElementById('concentration').value),
                    leadership: parseInt(document.getElementById('leadership').value),
                    communication: parseInt(document.getElementById('communication').value)
                }
            },
            showcase: {
                description: document.getElementById('playerShowcase').value,
                playingStyle: document.getElementById('playingStyleSummary').value,
                strengths: document.getElementById('strengths').value.split('\n').filter(s => s.trim()),
                weaknesses: document.getElementById('weaknesses').value.split('\n').filter(s => s.trim())
            },
            media: {
                profilePhoto: document.getElementById('current-photo').src
            }
        };

        return formData;
    }

    collectSecondaryPositions() {
        const positions = [];
        const positionElements = document.querySelectorAll('.secondary-position');
        
        positionElements.forEach(element => {
            const position = element.querySelector('.secondary-position-name').value;
            const suitability = parseInt(element.querySelector('.secondary-position-suitability').value);
            const notes = element.querySelector('.secondary-position-notes').value;
            
            if (position) {
                positions.push({ position, suitability, notes });
            }
        });
        
        return positions;
    }
}

// Initialize the form when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PlayerForm();
});