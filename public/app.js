class PlayerProfileApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        this.currentPlayer = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.showModal('login-form'));
        document.getElementById('register-btn').addEventListener('click', () => this.showModal('register-form'));
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
        document.getElementById('create-player-btn').addEventListener('click', () => this.showPlayerForm());
        document.getElementById('search-btn').addEventListener('click', () => this.searchPlayers());

        document.getElementById('login-form-content').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form-content').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('player-form-content').addEventListener('submit', (e) => this.handlePlayerForm(e));
        document.getElementById('cancel-btn').addEventListener('click', () => this.hideModal('player-form'));

        // Add secondary position button
        document.getElementById('addSecondaryPosition').addEventListener('click', () => this.addSecondaryPosition());
        
        // Remove photo button
        document.getElementById('remove-photo-btn').addEventListener('click', () => this.removeProfilePhoto());

        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });

        // Handle all range inputs including dynamically added ones
        document.addEventListener('input', (e) => {
            if (e.target.type === 'range') {
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    valueSpan.textContent = e.target.value;
                }
            }
        });

        // Handle remove position button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-position')) {
                e.target.closest('.secondary-position-item').remove();
            }
        });
    }

    checkAuth() {
        console.log('Checking auth - Token:', this.token ? 'Present' : 'Missing', 'User:', this.user ? 'Present' : 'Missing');
        if (this.token && this.user) {
            this.showMainContent();
            this.loadPlayers();
            this.checkForEditRequest();
        } else {
            console.log('No valid auth, showing auth buttons');
            this.showAuthButtons();
        }
    }

    checkForEditRequest() {
        const urlParams = new URLSearchParams(window.location.search);
        const editPlayerId = urlParams.get('edit');
        
        if (editPlayerId) {
            // Clear the URL parameter
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Load the player and show edit form
            this.loadPlayerForEdit(editPlayerId);
        }
    }

    async loadPlayerForEdit(playerId) {
        try {
            const response = await fetch(`/api/players/${playerId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const player = await response.json();
                this.showPlayerForm(player);
            } else {
                this.showMessage('Failed to load player for editing', 'error');
            }
        } catch (error) {
            console.error('Error loading player for edit:', error);
            this.showMessage('Failed to load player for editing', 'error');
        }
    }

    showAuthButtons() {
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('register-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';
        document.getElementById('main-content').style.display = 'none';
    }

    showMainContent() {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('register-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.getElementById('main-content').style.display = 'block';
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        console.log('Attempting login for username:', username);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            console.log('Login response status:', response.status);
            const data = await response.json();
            console.log('Login response data:', data);

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('token', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                this.hideModal('login-form');
                this.showMainContent();
                this.loadPlayers();
                this.showMessage('Login successful!', 'success');
            } else {
                this.showMessage(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;

        console.log('Registration data:', { username, email, password: password ? '***' : 'undefined', role });

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, role }),
            });

            const data = await response.json();
            console.log('Registration response:', response.status, data);

            if (response.ok) {
                this.hideModal('register-form');
                this.showMessage('Registration successful! Please login.', 'success');
            } else {
                this.showMessage(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.showAuthButtons();
    }

    showPlayerForm(player = null) {
        this.currentPlayer = player;
        const title = document.getElementById('form-title');
        title.textContent = player ? 'Edit Player Profile' : 'Create Player Profile';
        
        if (player) {
            this.populateForm(player);
        } else {
            this.clearForm();
        }
        
        this.showModal('player-form');
    }

    addSecondaryPosition(position = '', suitability = 75, notes = '') {
        const container = document.getElementById('secondaryPositionsContainer');
        const addButton = document.getElementById('addSecondaryPosition');
        
        const positionDiv = document.createElement('div');
        positionDiv.className = 'secondary-position-item';
        positionDiv.innerHTML = `
            <div class="position-header">
                <input type="text" class="secondary-position-name" placeholder="e.g., Right Wing, Center Back" value="${position}">
                <button type="button" class="remove-position">Remove</button>
            </div>
            <div class="position-suitability">
                <label>Suitability:</label>
                <input type="range" class="secondary-position-suitability" min="0" max="100" value="${suitability}">
                <span class="range-value">${suitability}</span>
                <span>%</span>
            </div>
            <div class="position-notes">
                <textarea class="secondary-position-notes" placeholder="Notes about player's ability in this position">${notes}</textarea>
            </div>
        `;
        
        container.insertBefore(positionDiv, addButton);
    }

    removeProfilePhoto() {
        if (this.currentPlayer && this.currentPlayer.media) {
            delete this.currentPlayer.media.profilePhoto;
            this.photoRemoved = true;
            document.getElementById('current-photo-preview').style.display = 'none';
            this.showMessage('Photo will be removed when you save', 'info');
        }
    }

    populateForm(player) {
        document.getElementById('fullName').value = player.personalInfo?.fullName || '';
        document.getElementById('dateOfBirth').value = player.personalInfo?.dateOfBirth || '';
        document.getElementById('heightCm').value = player.personalInfo?.height?.centimeters || '';
        document.getElementById('weightKg').value = player.personalInfo?.weight?.kilograms || '';
        document.getElementById('preferredFoot').value = player.personalInfo?.preferredFoot || '';
        document.getElementById('weakFootStrength').value = player.personalInfo?.weakFootStrength || 50;
        document.getElementById('nationality').value = player.personalInfo?.nationality || '';
        
        document.getElementById('playerPhone').value = player.contactInfo?.player?.phone || '';
        document.getElementById('playerEmail').value = player.contactInfo?.player?.email || '';
        document.getElementById('guardianName').value = player.contactInfo?.guardian?.name || '';
        document.getElementById('guardianPhone').value = player.contactInfo?.guardian?.phone || '';
        document.getElementById('guardianEmail').value = player.contactInfo?.guardian?.email || '';
        
        document.getElementById('primaryPosition').value = player.playingInfo?.primaryPosition?.position || player.playingInfo?.primaryPosition || '';
        document.getElementById('primaryPositionSuitability').value = player.playingInfo?.primaryPosition?.suitability || 100;
        document.getElementById('primaryPositionNotes').value = player.playingInfo?.primaryPosition?.notes || '';
        
        // Clear existing secondary positions
        const container = document.getElementById('secondaryPositionsContainer');
        const existingPositions = container.querySelectorAll('.secondary-position-item');
        existingPositions.forEach(item => item.remove());
        
        // Add secondary positions
        if (player.playingInfo?.secondaryPositions && Array.isArray(player.playingInfo.secondaryPositions)) {
            if (typeof player.playingInfo.secondaryPositions[0] === 'string') {
                // Old format - convert to new format
                player.playingInfo.secondaryPositions.forEach(pos => {
                    this.addSecondaryPosition(pos, 75, '');
                });
            } else {
                // New format with suitability and notes
                player.playingInfo.secondaryPositions.forEach(pos => {
                    this.addSecondaryPosition(pos.position, pos.suitability || 75, pos.notes || '');
                });
            }
        }
        
        document.getElementById('yearsPlaying').value = player.playingInfo?.yearsPlaying || '';
        document.getElementById('currentTeam').value = player.playingInfo?.currentTeam?.clubName || '';
        document.getElementById('league').value = player.playingInfo?.currentTeam?.league || '';
        
        document.getElementById('currentSchool').value = player.academicInfo?.currentSchool || '';
        document.getElementById('gradeYear').value = player.academicInfo?.gradeYear || '';
        
        document.getElementById('playerShowcase').value = player.showcase?.description || '';
        
        // Technical Skills
        this.setFormValue('ballControl', player.abilities?.technical?.ballControl?.rating || 5);
        this.setFormValue('passing', player.abilities?.technical?.passing?.rating || 5);
        this.setFormValue('shooting', player.abilities?.technical?.shooting?.rating || 5);
        this.setFormValue('dribbling', player.abilities?.technical?.dribbling?.rating || 5);
        this.setFormValue('firstTouch', player.abilities?.technical?.firstTouch?.rating || 5);
        this.setFormValue('crossing', player.abilities?.technical?.crossing?.rating || 5);
        this.setFormValue('tackling', player.abilities?.technical?.tackling?.rating || 5);
        this.setFormValue('heading', player.abilities?.technical?.heading?.rating || 5);
        
        // Physical Skills
        this.setFormValue('pace', player.abilities?.physical?.pace?.rating || 5);
        this.setFormValue('strength', player.abilities?.physical?.strength?.rating || 5);
        this.setFormValue('stamina', player.abilities?.physical?.stamina?.rating || 5);
        this.setFormValue('agility', player.abilities?.physical?.agility?.rating || 5);
        this.setFormValue('balance', player.abilities?.physical?.balance?.rating || 5);
        this.setFormValue('jumping', player.abilities?.physical?.jumping?.rating || 5);
        
        // Mental Skills
        this.setFormValue('decisionMaking', player.abilities?.mental?.decisionMaking?.rating || 5);
        this.setFormValue('positioning', player.abilities?.mental?.positioning?.rating || 5);
        this.setFormValue('concentration', player.abilities?.mental?.concentration?.rating || 5);
        this.setFormValue('leadership', player.abilities?.mental?.leadership?.rating || 5);
        this.setFormValue('communication', player.abilities?.mental?.communication?.rating || 5);

        // Ensure all new range inputs have their display values updated
        this.updateAllRangeDisplays();
        
        document.getElementById('playingStyleSummary').value = player.playingStyle?.summary || '';
        document.getElementById('strengths').value = player.playingStyle?.strengths?.join('\n') || '';
        document.getElementById('weaknesses').value = player.playingStyle?.weaknesses?.join('\n') || '';

        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(range => {
            const valueSpan = range.nextElementSibling;
            valueSpan.textContent = range.value;
        });
        
        // Show current photo if exists
        if (player.media?.profilePhoto) {
            const photoUrl = player.media.profilePhoto;
            // Only show if it's a base64 image (new format)
            if (photoUrl.startsWith('data:')) {
                document.getElementById('current-photo').src = photoUrl;
                document.getElementById('current-photo-preview').style.display = 'flex';
            } else {
                // Old file path format - hide preview since file doesn't exist
                document.getElementById('current-photo-preview').style.display = 'none';
            }
        } else {
            document.getElementById('current-photo-preview').style.display = 'none';
        }
        
        // Reset photo removed flag
        this.photoRemoved = false;
    }

    updateAllRangeDisplays() {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(range => {
            const valueSpan = range.nextElementSibling;
            if (valueSpan && valueSpan.classList.contains('range-value')) {
                valueSpan.textContent = range.value;
            }
        });
    }

    setFormValue(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.value = value;
        } else {
            console.warn(`Form element with ID '${elementId}' not found`);
        }
    }

    clearForm() {
        document.getElementById('player-form-content').reset();
        
        // Clear secondary positions
        const container = document.getElementById('secondaryPositionsContainer');
        const existingPositions = container.querySelectorAll('.secondary-position-item');
        existingPositions.forEach(item => item.remove());
        
        // Reset range inputs
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        rangeInputs.forEach(range => {
            if (range.id === 'weakFootStrength') {
                range.value = 50;
            } else {
                range.value = 5;
            }
            const valueSpan = range.nextElementSibling;
            if (valueSpan && valueSpan.classList.contains('range-value')) {
                valueSpan.textContent = range.value;
            }
        });
        
        // Hide photo preview
        document.getElementById('current-photo-preview').style.display = 'none';
        this.photoRemoved = false;
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
                
                this.hideModal('player-form');
                this.loadPlayers();
                this.showMessage(`Player profile ${this.currentPlayer ? 'updated' : 'created'} successfully!`, 'success');
            } else {
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
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
            console.error('Failed to upload photo:', error);
            this.showMessage('Failed to upload photo. Please try again.', 'error');
        }
    }
    
    async compressAndConvertImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions (max 800x800 for profile photos)
                const maxSize = 800;
                let { width, height } = img;
                
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
                
                // Draw and compress the image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 with compression (0.8 quality for JPEG)
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                
                // Check if compressed image is still too large (500KB limit for Base64)
                const maxBase64Size = 500 * 1024; // 500KB
                if (base64.length > maxBase64Size) {
                    // Try with lower quality
                    const base64Lower = canvas.toDataURL('image/jpeg', 0.6);
                    if (base64Lower.length > maxBase64Size) {
                        // Try with even lower quality
                        const base64Lowest = canvas.toDataURL('image/jpeg', 0.4);
                        resolve(base64Lowest);
                    } else {
                        resolve(base64Lower);
                    }
                } else {
                    resolve(base64);
                }
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }
    
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
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
                
                // Save the updated player data
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
                    this.showMessage('Photo uploaded successfully!', 'success');
                } else {
                    const errorData = await updateResponse.json();
                    console.error('Update failed:', errorData.error);
                    this.showMessage(`Failed to save photo: ${errorData.error}`, 'error');
                }
            }
        } catch (error) {
            console.error('Failed to update player photo URL:', error);
            this.showMessage('Failed to update player photo. Please try again.', 'error');
        }
    }

    collectSecondaryPositions() {
        const positions = [];
        const container = document.getElementById('secondaryPositionsContainer');
        const positionItems = container.querySelectorAll('.secondary-position-item');
        
        positionItems.forEach(item => {
            const position = item.querySelector('.secondary-position-name').value.trim();
            if (position) {
                positions.push({
                    position: position,
                    suitability: parseInt(item.querySelector('.secondary-position-suitability').value) || 75,
                    notes: item.querySelector('.secondary-position-notes').value.trim()
                });
            }
        });
        
        return positions;
    }

    collectFormData() {
        const formData = {
            personalInfo: {
                fullName: document.getElementById('fullName').value,
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
                primaryPosition: {
                    position: document.getElementById('primaryPosition').value,
                    suitability: parseInt(document.getElementById('primaryPositionSuitability').value) || 100,
                    notes: document.getElementById('primaryPositionNotes').value.trim()
                },
                secondaryPositions: this.collectSecondaryPositions(),
                yearsPlaying: parseInt(document.getElementById('yearsPlaying').value) || 0,
                currentTeam: {
                    clubName: document.getElementById('currentTeam').value,
                    league: document.getElementById('league').value
                }
            },
            academicInfo: {
                currentSchool: document.getElementById('currentSchool').value,
                gradeYear: document.getElementById('gradeYear').value
            },
            abilities: {
                technical: {
                    ballControl: {
                        rating: parseInt(document.getElementById('ballControl').value),
                        description: ''
                    },
                    passing: {
                        rating: parseInt(document.getElementById('passing').value),
                        description: ''
                    },
                    shooting: {
                        rating: parseInt(document.getElementById('shooting').value),
                        description: ''
                    },
                    dribbling: {
                        rating: parseInt(document.getElementById('dribbling').value) || 5,
                        description: ''
                    },
                    firstTouch: {
                        rating: parseInt(document.getElementById('firstTouch').value) || 5,
                        description: ''
                    },
                    crossing: {
                        rating: parseInt(document.getElementById('crossing').value) || 5,
                        description: ''
                    },
                    tackling: {
                        rating: parseInt(document.getElementById('tackling').value) || 5,
                        description: ''
                    },
                    heading: {
                        rating: parseInt(document.getElementById('heading').value) || 5,
                        description: ''
                    }
                },
                physical: {
                    pace: {
                        rating: parseInt(document.getElementById('pace').value),
                        description: ''
                    },
                    strength: {
                        rating: parseInt(document.getElementById('strength').value),
                        description: ''
                    },
                    stamina: {
                        rating: parseInt(document.getElementById('stamina').value),
                        description: ''
                    },
                    agility: {
                        rating: parseInt(document.getElementById('agility').value) || 5,
                        description: ''
                    },
                    balance: {
                        rating: parseInt(document.getElementById('balance').value) || 5,
                        description: ''
                    },
                    jumping: {
                        rating: parseInt(document.getElementById('jumping').value) || 5,
                        description: ''
                    }
                },
                mental: {
                    decisionMaking: {
                        rating: parseInt(document.getElementById('decisionMaking').value) || 5,
                        description: ''
                    },
                    positioning: {
                        rating: parseInt(document.getElementById('positioning').value) || 5,
                        description: ''
                    },
                    concentration: {
                        rating: parseInt(document.getElementById('concentration').value) || 5,
                        description: ''
                    },
                    leadership: {
                        rating: parseInt(document.getElementById('leadership').value) || 5,
                        description: ''
                    },
                    communication: {
                        rating: parseInt(document.getElementById('communication').value) || 5,
                        description: ''
                    }
                }
            },
            showcase: {
                description: document.getElementById('playerShowcase').value
            },
            playingStyle: {
                summary: document.getElementById('playingStyleSummary').value,
                strengths: document.getElementById('strengths').value.split('\n').filter(s => s.trim()),
                weaknesses: document.getElementById('weaknesses').value.split('\n').filter(s => s.trim())
            },
            metadata: {
                visibility: 'public',
                status: 'active'
            }
        };

        if (this.currentPlayer) {
            formData.playerId = this.currentPlayer.playerId;
            
            // Handle media data
            if (this.photoRemoved) {
                // Photo was removed, don't include media
                formData.media = {};
            } else if (this.currentPlayer.media && !document.getElementById('profilePhoto').files.length) {
                // No new photo uploaded and photo not removed, preserve existing media
                formData.media = this.currentPlayer.media;
            }
            
            // Preserve other metadata
            if (this.currentPlayer.metadata) {
                formData.metadata = {
                    ...this.currentPlayer.metadata,
                    ...formData.metadata
                };
            }
        }

        return formData;
    }

    convertHeightToCm(feet, inches) {
        return Math.round(((feet * 30.48) + (inches * 2.54)) * 10) / 10;
    }

    async loadPlayers() {
        try {
            console.log('Loading players with token:', this.token ? 'Token present' : 'No token');
            const response = await fetch('/api/players', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('Load players response:', response.status);
            if (response.ok) {
                const players = await response.json();
                this.displayPlayers(players);
            } else {
                if (response.status === 403) {
                    console.log('Token expired or invalid, logging out');
                    this.logout();
                    this.showMessage('Session expired. Please login again.', 'error');
                } else {
                    this.showMessage('Failed to load players', 'error');
                }
            }
        } catch (error) {
            console.error('Load players error:', error);
            this.showMessage('Failed to load players', 'error');
        }
    }

    displayPlayers(players) {
        const container = document.getElementById('players-list');
        container.innerHTML = '';

        players.forEach(player => {
            const card = this.createPlayerCard(player);
            container.appendChild(card);
        });
    }

    createPlayerCard(player) {
        const card = document.createElement('div');
        card.className = 'player-card';
        
        const age = this.calculateAge(player.personalInfo?.dateOfBirth);
        const height = player.personalInfo?.height?.centimeters ? `${player.personalInfo.height.centimeters} cm` : 'N/A';
        const weight = player.personalInfo?.weight?.kilograms ? `${player.personalInfo.weight.kilograms} kg` : 'N/A';
        
        // Handle profile photo - check both media.profilePhoto and potential upload path
        let profilePhotoHtml = '';
        const photoUrl = player.media?.profilePhoto || player.profilePhotoUrl;
        
        
        if (photoUrl) {
            // Check if it's a base64 image or a file path
            if (photoUrl.startsWith('data:')) {
                // It's a base64 image, use as-is
                profilePhotoHtml = `<img src="${photoUrl}" alt="${player.personalInfo?.fullName || 'Player'}" class="profile-photo">`;
            } else if (photoUrl.startsWith('/uploads/')) {
                // It's an old file path - show placeholder since files don't exist on Railway
                const initials = player.personalInfo?.fullName ? 
                    player.personalInfo.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'PP';
                profilePhotoHtml = `<div class="profile-photo-placeholder" title="Photo no longer available - please upload a new one">${initials}</div>`;
            } else {
                // Unknown format, try to use it
                profilePhotoHtml = `<img src="${photoUrl}" alt="${player.personalInfo?.fullName || 'Player'}" class="profile-photo">`;
            }
        } else {
            // Default placeholder with initials
            const initials = player.personalInfo?.fullName ? 
                player.personalInfo.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'PP';
            profilePhotoHtml = `<div class="profile-photo-placeholder">${initials}</div>`;
        }
        
        // Format positions display
        let positionsDisplay = '';
        if (player.playingInfo?.primaryPosition) {
            if (typeof player.playingInfo.primaryPosition === 'string') {
                positionsDisplay = player.playingInfo.primaryPosition;
            } else {
                positionsDisplay = `${player.playingInfo.primaryPosition.position} (${player.playingInfo.primaryPosition.suitability}%)`;
            }
        } else {
            positionsDisplay = 'N/A';
        }
        
        if (player.playingInfo?.secondaryPositions && player.playingInfo.secondaryPositions.length > 0) {
            const secondaryPositions = player.playingInfo.secondaryPositions.map(pos => {
                if (typeof pos === 'string') {
                    return pos;
                } else {
                    return `${pos.position} (${pos.suitability}%)`;
                }
            }).join(', ');
            positionsDisplay += ` | ${secondaryPositions}`;
        }
        
        // Create published URL section if published
        const publishedUrlSection = player.metadata?.published ? 
            `<div class="published-url">
                <label>Published Profile URL:</label>
                <input type="text" readonly value="${window.location.origin}/profile-view.html?id=${player.playerId}" id="url-${player.playerId}">
                <button class="copy-url-btn" onclick="app.copyUrl('url-${player.playerId}')">Copy URL</button>
            </div>` : '';
        
        card.innerHTML = `
            ${profilePhotoHtml}
            <h3>${player.personalInfo?.fullName || 'Unknown'}</h3>
            <p><strong>Positions:</strong> ${positionsDisplay}</p>
            <p><strong>Age:</strong> ${age}</p>
            <p><strong>Height:</strong> ${height}</p>
            <p><strong>Weight:</strong> ${weight}</p>
            <p><strong>Preferred Foot:</strong> ${this.formatFootPreference(player.personalInfo?.preferredFoot, player.personalInfo?.weakFootStrength)}</p>
            <p><strong>Team:</strong> ${player.playingInfo?.currentTeam?.clubName || 'N/A'}</p>
            <p><strong>School:</strong> ${player.academicInfo?.currentSchool || 'N/A'}</p>
            ${publishedUrlSection}
            <div class="actions">
                <button class="print-btn" onclick="app.printProfile('${player.playerId}')">Print</button>
                <button class="edit-btn" onclick="app.showPlayerForm(${JSON.stringify(player).replace(/"/g, '&quot;')})">Edit</button>
                ${player.metadata?.published ? 
                    `<button class="withdraw-btn" onclick="app.withdrawProfile('${player.playerId}')">Withdraw</button>
                     <button class="public-btn" onclick="app.viewPublicProfile('${player.playerId}')">View Public</button>` : 
                    `<button class="publish-btn" onclick="app.publishProfile('${player.playerId}')">Publish</button>`}
                <button class="messages-btn" onclick="app.showMessages('${player.playerId}')">Messages</button>
                <button class="delete-btn" onclick="app.deletePlayer('${player.playerId}')">Delete</button>
            </div>
        `;
        
        // Add click handler to navigate to player view page
        card.addEventListener('click', (e) => {
            // Don't navigate if clicking on buttons
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
                return;
            }
            this.viewPlayerProfile(player.playerId);
        });
        
        return card;
    }

    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return 'N/A';
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    formatFootPreference(preferredFoot, weakFootStrength) {
        if (!preferredFoot) return 'N/A';
        
        const preferred = preferredFoot.charAt(0).toUpperCase() + preferredFoot.slice(1);
        const weak = preferredFoot.toLowerCase() === 'left' ? 'Right' : 'Left';
        const strength = weakFootStrength || 50;
        
        return `${preferred} foot | ${weak} foot: ${strength}% strength`;
    }

    async deletePlayer(playerId) {
        if (!confirm('Are you sure you want to delete this player profile?')) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${playerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.loadPlayers();
                this.showMessage('Player profile deleted successfully!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Failed to delete player profile', 'error');
        }
    }

    async searchPlayers() {
        const query = document.getElementById('search-input').value;
        
        try {
            const response = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const players = await response.json();
                this.displayPlayers(players);
            } else {
                this.showMessage('Search failed', 'error');
            }
        } catch (error) {
            this.showMessage('Search failed', 'error');
        }
    }

    async publishProfile(playerId) {
        if (!confirm('Are you sure you want to publish this profile publicly? This will make it viewable by anyone with the link.')) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${playerId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ published: true })
            });

            if (response.ok) {
                this.loadPlayers();
                this.showMessage('Profile published successfully!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Failed to publish profile', 'error');
        }
    }

    async withdrawProfile(playerId) {
        if (!confirm('Are you sure you want to withdraw this profile from public view?')) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${playerId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ published: false })
            });

            if (response.ok) {
                this.loadPlayers();
                this.showMessage('Profile withdrawn successfully!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error, 'error');
            }
        } catch (error) {
            this.showMessage('Failed to withdraw profile', 'error');
        }
    }

    viewPublicProfile(playerId) {
        const publicUrl = `/profile-view.html?id=${playerId}`;
        window.open(publicUrl, '_blank', 'width=800,height=1000,scrollbars=yes');
    }

    showMessages(playerId) {
        const messagesUrl = `/messages.html?id=${playerId}`;
        window.open(messagesUrl, '_blank', 'width=800,height=600,scrollbars=yes');
    }

    copyUrl(inputId) {
        const input = document.getElementById(inputId);
        input.select();
        input.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            this.showMessage('URL copied to clipboard!', 'success');
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(input.value).then(() => {
                this.showMessage('URL copied to clipboard!', 'success');
            }).catch(() => {
                this.showMessage('Failed to copy URL', 'error');
            });
        }
    }

    printProfile(playerId) {
        const profileUrl = `/profile-view.html?id=${playerId}`;
        window.open(profileUrl, '_blank', 'width=800,height=1000,scrollbars=yes');
    }

    viewPlayerProfile(playerId) {
        const profileUrl = `/profile-view.html?id=${playerId}`;
        window.location.href = profileUrl;
    }

    showMessage(message, type) {
        const existing = document.querySelector('.message');
        if (existing) {
            existing.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        document.getElementById('main-content').insertBefore(messageDiv, document.getElementById('main-content').firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

const app = new PlayerProfileApp();