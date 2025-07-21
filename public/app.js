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

        // Position system handlers
        this.setupPositionHandlers();

        const closeButtons = document.querySelectorAll('.close');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.fm-modal') || e.target.closest('.modal');
                this.hideModal(modal.id);
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('fm-modal') || e.target.classList.contains('modal')) {
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

    }

    setupPositionHandlers() {
        // Handle position checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.dataset.position) {
                const positionItem = e.target.closest('.position-item');
                if (e.target.checked) {
                    positionItem.classList.add('selected');
                } else {
                    positionItem.classList.remove('selected');
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

        // Setup drag and drop functionality for position reordering
        this.setupPositionDragAndDrop();
    }

    setupPositionDragAndDrop() {
        let draggedElement = null;

        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('position-drag-handle')) {
                const positionItem = e.target.closest('.position-item');
                if (positionItem.classList.contains('selected')) {
                    draggedElement = positionItem;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/html', positionItem.outerHTML);
                    positionItem.style.opacity = '0.4';
                }
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const positionItem = e.target.closest('.position-item');
            if (positionItem && positionItem.classList.contains('selected') && positionItem !== draggedElement) {
                e.dataTransfer.dropEffect = 'move';
                positionItem.style.borderTop = '3px solid var(--fm-accent)';
            }
        });

        document.addEventListener('dragleave', (e) => {
            const positionItem = e.target.closest('.position-item');
            if (positionItem) {
                positionItem.style.borderTop = '';
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.position-item');
            if (targetItem && targetItem.classList.contains('selected') && draggedElement && targetItem !== draggedElement) {
                const container = targetItem.parentNode;
                container.insertBefore(draggedElement, targetItem);
                targetItem.style.borderTop = '';
            }
        });

        document.addEventListener('dragend', (e) => {
            if (draggedElement) {
                draggedElement.style.opacity = '1';
                draggedElement = null;
            }
            // Clean up any remaining border styles
            document.querySelectorAll('.position-item').forEach(item => {
                item.style.borderTop = '';
            });
        });

        // Make position items draggable when selected
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.dataset.position) {
                const positionItem = e.target.closest('.position-item');
                const dragHandle = positionItem.querySelector('.position-drag-handle');
                if (e.target.checked) {
                    dragHandle.setAttribute('draggable', 'true');
                    dragHandle.style.cursor = 'grab';
                } else {
                    dragHandle.removeAttribute('draggable');
                    dragHandle.style.cursor = 'default';
                }
            }
        });
    }

    collectPositionData() {
        const positions = [];
        const selectedItems = document.querySelectorAll('.position-item.selected');
        
        selectedItems.forEach((item, index) => {
            const position = item.dataset.position;
            const checkbox = item.querySelector(`input[type="checkbox"][data-position="${position}"]`);
            const suitabilityRange = item.querySelector(`input[type="range"][data-position="${position}"]`);
            const notesTextarea = item.querySelector(`textarea[data-position="${position}"]`);
            
            if (checkbox && checkbox.checked) {
                positions.push({
                    position: position,
                    suitability: parseInt(suitabilityRange.value) || 75,
                    notes: notesTextarea.value.trim() || '',
                    order: index + 1
                });
            }
        });

        return positions.sort((a, b) => a.order - b.order);
    }

    populatePositionData(positions) {
        // Reset all position checkboxes
        document.querySelectorAll('.position-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            const positionItem = checkbox.closest('.position-item');
            positionItem.classList.remove('selected');
            
            // Reset drag handle
            const dragHandle = positionItem.querySelector('.position-drag-handle');
            dragHandle.removeAttribute('draggable');
            dragHandle.style.cursor = 'default';
        });

        if (!positions || !Array.isArray(positions)) return;

        // Sort positions by order and populate form
        const sortedPositions = positions.sort((a, b) => a.order - b.order);
        
        sortedPositions.forEach(pos => {
            // Find the corresponding position item
            const positionItem = document.querySelector(`.position-item[data-position="${pos.position}"]`);
            if (positionItem) {
                // Check the checkbox
                const checkbox = positionItem.querySelector('input[type="checkbox"]');
                const suitabilityRange = positionItem.querySelector('input[type="range"]');
                const notesTextarea = positionItem.querySelector('textarea');
                
                if (checkbox) {
                    checkbox.checked = true;
                    positionItem.classList.add('selected');
                    
                    // Enable dragging
                    const dragHandle = positionItem.querySelector('.position-drag-handle');
                    dragHandle.setAttribute('draggable', 'true');
                    dragHandle.style.cursor = 'grab';
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

        // Reorder position items in the DOM to match the order
        this.reorderPositionItems(sortedPositions);
    }

    reorderPositionItems(sortedPositions) {
        const container = document.getElementById('positions-container');
        if (!container) return;

        // Create a map of position to order for selected positions
        const positionOrder = {};
        sortedPositions.forEach((pos, index) => {
            positionOrder[pos.position] = index;
        });

        // Get all position groups
        const positionGroups = container.querySelectorAll('.position-group');
        
        positionGroups.forEach(group => {
            const positionItems = Array.from(group.querySelectorAll('.position-item'));
            const selectedItems = positionItems.filter(item => 
                item.classList.contains('selected')
            );
            const unselectedItems = positionItems.filter(item => 
                !item.classList.contains('selected')
            );

            // Sort selected items by their order
            selectedItems.sort((a, b) => {
                const aPosition = a.dataset.position;
                const bPosition = b.dataset.position;
                const aOrder = positionOrder[aPosition] !== undefined ? positionOrder[aPosition] : 999;
                const bOrder = positionOrder[bPosition] !== undefined ? positionOrder[bPosition] : 999;
                return aOrder - bOrder;
            });

            // Clear the group content and rebuild with sorted items
            const groupTitle = group.querySelector('.position-group-title');
            group.innerHTML = '';
            group.appendChild(groupTitle);
            
            // Add selected items first (in order), then unselected items
            [...selectedItems, ...unselectedItems].forEach(item => {
                group.appendChild(item);
            });
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
        
        // Show/hide buttons based on user role
        const allowedSearchRoles = ['scout', 'coach', 'agent', 'admin'];
        const searchBtn = document.getElementById('advanced-search-btn');
        const createBtn = document.getElementById('create-player-btn');
        
        if (allowedSearchRoles.includes(this.user.role)) {
            searchBtn.style.display = 'inline-flex';
            searchBtn.addEventListener('click', () => {
                window.location.href = '/search.html';
            });
        }
        
        // Hide create button for non-players
        if (this.user.role !== 'player' && this.user.role !== 'admin') {
            createBtn.style.display = 'none';
        }
        
        // Add admin tools if admin
        if (this.user.role === 'admin') {
            this.addAdminTools();
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal.classList.contains('fm-modal')) {
            modal.style.display = 'flex';
        } else {
            modal.style.display = 'block';
        }
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
        // Navigate to the dedicated form page
        if (player) {
            // Store player data in sessionStorage for editing
            const playerDataWithId = {
                ...player,
                playerId: player.playerId || player.id,
                id: player.playerId || player.id
            };
            sessionStorage.setItem('editPlayerData', JSON.stringify(playerDataWithId));
            window.location.href = `player-form.html?mode=edit&id=${player.playerId || player.id}`;
        } else {
            // Clear any existing draft and go to create mode
            sessionStorage.removeItem('editPlayerData');
            window.location.href = 'player-form.html?mode=create';
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
        
        // Handle position data population
        this.populatePositionData(player.playingInfo?.positions);
        
        document.getElementById('yearsPlaying').value = player.playingInfo?.yearsPlaying || '';
        document.getElementById('currentTeam').value = player.playingInfo?.currentTeam?.clubName || 
            (typeof player.playingInfo?.currentTeam === 'string' ? player.playingInfo.currentTeam : '') || '';
        document.getElementById('league').value = player.playingInfo?.currentTeam?.league || player.playingInfo?.league || '';
        
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
        
        // Clear position selections
        document.querySelectorAll('.position-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
            const positionItem = checkbox.closest('.position-item');
            positionItem.classList.remove('selected');
            
            // Reset drag handle
            const dragHandle = positionItem.querySelector('.position-drag-handle');
            dragHandle.removeAttribute('draggable');
            dragHandle.style.cursor = 'default';
        });
        
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
                
                // Check if compressed image is still too large (200KB limit for Base64)
                const maxBase64Size = 200 * 1024; // 200KB
                let finalBase64 = base64;
                
                if (base64.length > maxBase64Size) {
                    console.log('Image too large, trying lower quality. Current size:', base64.length);
                    // Try with lower quality
                    finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    
                    if (finalBase64.length > maxBase64Size) {
                        console.log('Still too large, trying even lower quality. Current size:', finalBase64.length);
                        // Try with even lower quality
                        finalBase64 = canvas.toDataURL('image/jpeg', 0.4);
                        
                        if (finalBase64.length > maxBase64Size) {
                            console.log('Still too large, trying lowest quality. Current size:', finalBase64.length);
                            // Try with lowest quality
                            finalBase64 = canvas.toDataURL('image/jpeg', 0.2);
                            
                            if (finalBase64.length > maxBase64Size) {
                                console.log('Still too large, resizing further. Current size:', finalBase64.length);
                                // Resize to smaller dimensions
                                canvas.width = width * 0.7;
                                canvas.height = height * 0.7;
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                finalBase64 = canvas.toDataURL('image/jpeg', 0.4);
                            }
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
                positions: this.collectPositionData(),
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
            
            // Load both players and unread message counts
            const [playersResponse, unreadCountsResponse] = await Promise.all([
                fetch('/api/players', {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                }),
                fetch('/api/players/unread-counts', {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                })
            ]);

            console.log('Load players response:', playersResponse.status);
            if (playersResponse.ok) {
                const players = await playersResponse.json();
                let unreadCounts = {};
                
                if (unreadCountsResponse.ok) {
                    unreadCounts = await unreadCountsResponse.json();
                }
                
                this.displayPlayers(players, unreadCounts);
            } else {
                if (playersResponse.status === 403) {
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

    displayPlayers(players, unreadCounts = {}) {
        const container = document.getElementById('players-list');
        container.innerHTML = '';

        players.forEach(player => {
            const card = this.createPlayerCard(player, unreadCounts[player.playerId] || 0);
            container.appendChild(card);
        });
    }

    createPlayerCard(player, unreadCount = 0) {
        const card = document.createElement('div');
        card.className = 'fm-card';
        
        const age = this.calculateAge(player.personalInfo?.dateOfBirth);
        
        // Remove debug logs - issues have been resolved
        
        // Handle height - check multiple possible data structures
        let heightValue = player.personalInfo?.height?.centimeters;
        // Fallback to direct properties if nested structure doesn't exist
        if (!heightValue && player.personalInfo?.heightCm !== undefined) {
            heightValue = player.personalInfo.heightCm;
        }
        const height = (heightValue !== undefined && heightValue !== null && heightValue !== '' && !isNaN(parseFloat(heightValue))) 
            ? `${parseFloat(heightValue)} cm` 
            : 'N/A';
        
        // Handle weight - check multiple possible data structures
        let weightValue = player.personalInfo?.weight?.kilograms;
        // Fallback to direct properties if nested structure doesn't exist
        if (!weightValue && player.personalInfo?.weightKg !== undefined) {
            weightValue = player.personalInfo.weightKg;
        }
        const weight = (weightValue !== undefined && weightValue !== null && weightValue !== '' && !isNaN(parseFloat(weightValue))) 
            ? `${parseFloat(weightValue)} kg` 
            : 'N/A';
        
        // Handle profile photo - check both media.profilePhoto and potential upload path
        let profilePhotoHtml = '';
        const photoUrl = player.media?.profilePhoto || player.profilePhotoUrl;
        
        
        if (photoUrl) {
            // Check if it's a base64 image or a file path
            if (photoUrl.startsWith('data:')) {
                // It's a base64 image, use as-is
                const firstName = player.personalInfo?.firstName || '';
                const lastName = player.personalInfo?.lastName || '';
                const displayName = `${firstName} ${lastName}`.trim() || 'Player';
                profilePhotoHtml = `<img src="${photoUrl}" alt="${displayName}" class="profile-photo">`;
            } else if (photoUrl.startsWith('/uploads/')) {
                // It's an old file path - show placeholder since files don't exist on Railway
                const firstInitial = player.personalInfo?.firstName ? player.personalInfo.firstName[0].toUpperCase() : 'P';
                const lastInitial = player.personalInfo?.lastName ? player.personalInfo.lastName[0].toUpperCase() : 'P';
                const initials = firstInitial + lastInitial;
                profilePhotoHtml = `<div class="profile-photo-placeholder" title="Photo no longer available - please upload a new one">${initials}</div>`;
            } else {
                // Unknown format, try to use it
                const firstName = player.personalInfo?.firstName || '';
                const lastName = player.personalInfo?.lastName || '';
                const displayName = `${firstName} ${lastName}`.trim() || 'Player';
                profilePhotoHtml = `<img src="${photoUrl}" alt="${displayName}" class="profile-photo">`;
            }
        } else {
            // Default placeholder with initials
            const firstInitial = player.personalInfo?.firstName ? player.personalInfo.firstName[0].toUpperCase() : 'P';
            const lastInitial = player.personalInfo?.lastName ? player.personalInfo.lastName[0].toUpperCase() : 'P';
            const initials = firstInitial + lastInitial;
            profilePhotoHtml = `<div class="profile-photo-placeholder">${initials}</div>`;
        }
        
        // Format positions display - show only primary position on dashboard cards
        let positionsDisplay = '';
        if (player.playingInfo?.positions?.length > 0) {
            // Sort by order and get primary position (order 1)
            const sortedPositions = player.playingInfo.positions.sort((a, b) => a.order - b.order);
            const primaryPosition = sortedPositions[0];
            positionsDisplay = this.formatPositionName(primaryPosition.position);
        } else if (player.playingInfo?.primaryPosition) {
            // Fallback for legacy data
            if (typeof player.playingInfo.primaryPosition === 'string') {
                positionsDisplay = player.playingInfo.primaryPosition;
            } else {
                positionsDisplay = player.playingInfo.primaryPosition.position;
            }
        } else {
            positionsDisplay = 'N/A';
        }
        
        // Add location if available
        const location = player.playingInfo?.basedLocation ? 
            `<div class="fm-stat" style="margin-top: 8px; font-size: 0.85rem;">
                <span style="color: var(--fm-text-muted);">📍 ${player.playingInfo.basedLocation}</span>
            </div>` : '';
        
        // Create published URL section if published
        const publishedUrlSection = player.metadata?.published ? 
            `<div class="published-url">
                <label>Published Profile URL:</label>
                <input type="text" readonly value="${window.location.origin}/profile-view.html?id=${player.playerId}" id="url-${player.playerId}">
                <button class="copy-url-btn" onclick="app.copyUrl('url-${player.playerId}')">Copy URL</button>
            </div>` : '';
        
        // Message badge HTML
        const messageBadgeHtml = unreadCount > 0 ? `<div class="message-badge">${unreadCount}</div>` : '';
        
        card.innerHTML = `
            ${messageBadgeHtml}
            <div class="fm-card-body fm-text-center">
                ${profilePhotoHtml}
                <h3 class="fm-card-title fm-mb-md">${this.getPlayerDisplayName(player)}</h3>
                
                <div class="fm-stats-grid fm-mb-lg">
                    <div class="fm-stat">
                        <span class="fm-stat-label">Position</span>
                        <span class="fm-stat-value">${positionsDisplay}</span>
                    </div>
                    <div class="fm-stat">
                        <span class="fm-stat-label">Age</span>
                        <span class="fm-stat-value">${age}</span>
                    </div>
                    <div class="fm-stat">
                        <span class="fm-stat-label">Height</span>
                        <span class="fm-stat-value">${height}</span>
                    </div>
                    <div class="fm-stat">
                        <span class="fm-stat-label">Weight</span>
                        <span class="fm-stat-value">${weight}</span>
                    </div>
                    <div class="fm-stat">
                        <span class="fm-stat-label">Foot</span>
                        <span class="fm-stat-value">${player.personalInfo?.preferredFoot ? player.personalInfo.preferredFoot.charAt(0).toUpperCase() + player.personalInfo.preferredFoot.slice(1) : 'N/A'}</span>
                    </div>
                    <div class="fm-stat">
                        <span class="fm-stat-label">Team</span>
                        <span class="fm-stat-value">${this.getPrimaryTeam(player.playingInfo)}</span>
                    </div>
                    ${location}
                </div>
                
                ${publishedUrlSection}
                
                <div class="fm-card-actions">
                    <button class="fm-btn fm-btn-primary fm-btn-sm" onclick="app.printProfile('${player.playerId}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
                        </svg>
                        Print
                    </button>
                    <button class="fm-btn fm-btn-secondary fm-btn-sm" onclick="app.showPlayerForm(${JSON.stringify(player).replace(/"/g, '&quot;')})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                    </button>
                    ${player.metadata?.published ? 
                        `<button class="fm-btn fm-btn-warning fm-btn-sm" onclick="app.withdrawProfile('${player.playerId}')">Withdraw</button>
                         <button class="fm-btn fm-btn-accent fm-btn-sm" onclick="app.viewPublicProfile('${player.playerId}')">View Public</button>` : 
                        `<button class="fm-btn fm-btn-success fm-btn-sm" onclick="app.publishProfile('${player.playerId}')">Publish</button>`}
                    <button class="fm-btn fm-btn-info fm-btn-sm" onclick="app.showMessages('${player.playerId}')">Messages</button>
                    <button class="fm-btn fm-btn-danger fm-btn-sm" onclick="app.deletePlayer('${player.playerId}')">Delete</button>
                </div>
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

    getPlayerDisplayName(player) {
        const firstName = player.personalInfo?.firstName || '';
        const lastName = player.personalInfo?.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim();
        
        // Fallback to fullName if firstName/lastName not available (for backward compatibility)
        if (!displayName && player.personalInfo?.fullName) {
            return player.personalInfo.fullName;
        }
        
        return displayName || 'Unknown';
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
        window.open(publicUrl, '_blank', 'width=1200,height=800,scrollbars=yes');
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
        // Open profile in new window with print parameter and trigger print immediately
        const profileUrl = `/profile-view.html?id=${playerId}&print=true`;
        const printWindow = window.open(profileUrl, '_blank', 'width=1200,height=800,scrollbars=yes');
        
        // Auto-trigger print after page loads
        if (printWindow) {
            printWindow.onload = function() {
                setTimeout(() => {
                    printWindow.print();
                }, 500); // Small delay to ensure everything is rendered
            };
        }
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

    addAdminTools() {
        // Add admin tools section after the search bar
        const searchContainer = document.querySelector('#main-content .fm-card .fm-card-body > div');
        
        const adminTools = document.createElement('div');
        adminTools.className = 'fm-mt-lg';
        adminTools.style.borderTop = '1px solid var(--fm-border)';
        adminTools.style.paddingTop = 'var(--spacing-lg)';
        adminTools.innerHTML = `
            <h3 class="fm-mb-md" style="color: var(--fm-text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">Admin Tools</h3>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="fm-btn fm-btn-secondary" onclick="window.location.href='/admin-migrations.html'">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 0.5rem;">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    Database Migrations
                </button>
            </div>
        `;
        
        searchContainer.parentNode.appendChild(adminTools);
    }

    formatPositionName(position) {
        // Convert kebab-case position names to readable format
        const positionMap = {
            'goalkeeper': 'Goalkeeper',
            'centre-back': 'Centre Back',
            'right-back': 'Right Back',
            'left-back': 'Left Back',
            'right-wing-back': 'Right Wing Back',
            'left-wing-back': 'Left Wing Back',
            'defensive-midfielder': 'Defensive Midfielder',
            'central-midfielder': 'Central Midfielder',
            'attacking-midfielder': 'Attacking Midfielder',
            'right-midfielder': 'Right Midfielder',
            'left-midfielder': 'Left Midfielder',
            'right-winger': 'Right Winger',
            'left-winger': 'Left Winger',
            'striker': 'Striker',
            'centre-forward': 'Centre Forward',
            'false-nine': 'False Nine'
        };
        
        return positionMap[position] || position.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    getPrimaryTeam(playingInfo) {
        // Check for new teams array format
        if (playingInfo?.teams && Array.isArray(playingInfo.teams)) {
            const primaryTeam = playingInfo.teams.find(t => t.isPrimary);
            if (primaryTeam) {
                return primaryTeam.clubName || 'N/A';
            }
            // If no primary team marked, use the first team
            if (playingInfo.teams.length > 0) {
                return playingInfo.teams[0].clubName || 'N/A';
            }
        }
        
        // Fallback to legacy currentTeam format
        if (playingInfo?.currentTeam) {
            return playingInfo.currentTeam.clubName || 
                   (typeof playingInfo.currentTeam === 'string' ? playingInfo.currentTeam : 'N/A');
        }
        
        return 'N/A';
    }
}

const app = new PlayerProfileApp();