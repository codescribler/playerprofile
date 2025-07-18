// Modern Profile View JavaScript
class ModernProfileView {
    constructor() {
        const urlParams = new URLSearchParams(window.location.search);
        this.playerId = urlParams.get('id');
        this.shouldPrint = urlParams.get('print') === 'true';
        this.isOwner = false; // Will be determined after loading player data
        
        if (!this.playerId) {
            this.showError('No player ID provided');
            return;
        }
        this.init();
    }

    async init() {
        await this.checkOwnership();
        await this.loadPlayerData();
        this.setupEventListeners();
        
        // Generate QR code after a small delay to ensure library is loaded
        setTimeout(() => {
            this.generateQRCode();
        }, 100);
        
        // Auto-trigger print if print parameter is set
        if (this.shouldPrint) {
            setTimeout(() => {
                window.print();
            }, 1000); // Increased delay to ensure QR code is generated
        }
    }
    
    async checkOwnership() {
        // Check if user is logged in and owns this profile
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`/api/players/${this.playerId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    this.isOwner = true;
                }
            } catch (error) {
                // Not owner or not logged in
                this.isOwner = false;
            }
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.fm-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Contact form
        document.getElementById('contact-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContactForm();
        });
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.fm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show/hide tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`${tabName}-tab`).style.display = 'block';
    }

    async loadPlayerData() {
        try {
            const response = await fetch(`/api/public/players/${this.playerId}`);
            if (!response.ok) {
                throw new Error('Failed to load player data');
            }
            
            const player = await response.json();
            this.displayPlayerData(player);
        } catch (error) {
            console.error('Error loading player data:', error);
            this.showError('Failed to load player profile');
        }
    }

    displayPlayerData(player) {
        // Set page title
        document.title = `${player.personalInfo?.fullName || 'Player'} - Profile`;

        // Header information
        this.displayHeader(player);

        // Overview tab
        this.displayOverview(player);

        // Attributes tab
        this.displayAttributes(player);

        // Positions tab
        this.displayPositions(player);

        // History tab
        this.displayHistory(player);
    }

    displayHeader(player) {
        // Profile photo
        const photoWrapper = document.getElementById('profile-photo-wrapper');
        if (player.media?.profilePhoto) {
            photoWrapper.innerHTML = `<img src="${player.media.profilePhoto}" alt="${player.personalInfo?.fullName}" class="profile-photo">`;
        } else {
            const initials = this.getInitials(player.personalInfo?.fullName);
            photoWrapper.innerHTML = `<div class="profile-photo-placeholder">${initials}</div>`;
        }

        // Basic info
        document.getElementById('player-name').textContent = player.personalInfo?.fullName || 'Unknown Player';
        document.getElementById('player-age').textContent = this.calculateAge(player.personalInfo?.dateOfBirth);
        document.getElementById('player-nationality').textContent = player.personalInfo?.nationality || 'Unknown';
        document.getElementById('player-position').textContent = this.getPositionDisplay(player.playingInfo);
        document.getElementById('player-height').textContent = this.getHeight(player.personalInfo);
        document.getElementById('player-weight').textContent = this.getWeight(player.personalInfo);
        document.getElementById('player-foot').textContent = player.personalInfo?.preferredFoot || 'Unknown';

        // Calculate and display top attribute
        const topAttribute = this.getTopAttribute(player.abilities);
        document.getElementById('overall-rating').textContent = topAttribute;
    }

    displayOverview(player) {
        // Player information
        document.getElementById('current-team').textContent = 
            player.playingInfo?.currentTeam?.clubName || player.playingInfo?.currentTeam || 'Free Agent';
        document.getElementById('current-league').textContent = 
            player.playingInfo?.currentTeam?.league || player.playingInfo?.league || '--';
        document.getElementById('years-playing').textContent = 
            player.playingInfo?.yearsPlaying || '--';
        document.getElementById('current-school').textContent = 
            player.academicInfo?.currentSchool || '--';
        document.getElementById('grade-year').textContent = 
            player.academicInfo?.gradeYear || '--';

        // Key attributes
        this.displayKeyAttributes(player.abilities);

        // Player showcase
        if (player.showcase?.description) {
            document.getElementById('player-showcase').textContent = player.showcase.description;
        }

        // Strengths and weaknesses
        this.displayList('player-strengths', player.playingStyle?.strengths);
        this.displayList('player-weaknesses', player.playingStyle?.weaknesses);
        
        // Add location and representative teams info
        this.displayAdditionalInfo(player);
        
        // Add contact info for print version if owner
        if (this.isOwner) {
            this.displayContactInfoForPrint(player);
        }
    }

    displayKeyAttributes(abilities) {
        const keyAttributesContainer = document.getElementById('key-attributes');
        const keyAttributes = this.getTopAttributes(abilities, 6);
        
        keyAttributesContainer.innerHTML = keyAttributes.map(attr => `
            <div class="fm-stat">
                <span class="fm-stat-label">${this.formatAttributeName(attr.name)}</span>
                <div class="fm-stat-value">
                    <span class="attribute-rating rating-${attr.rating}">${attr.rating}</span>
                    <div class="attribute-bar">
                        <div class="attribute-bar-fill" style="width: ${attr.rating * 5}%; background: ${this.getRatingColor(attr.rating)}"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    displayAttributes(player) {
        const abilities = player.abilities || {};
        
        // Technical attributes
        this.displayAttributeCategory('technical-attributes', abilities.technical);
        
        // Physical attributes
        this.displayAttributeCategory('physical-attributes', abilities.physical);
        
        // Mental attributes
        this.displayAttributeCategory('mental-attributes', abilities.mental);
    }

    displayAttributeCategory(containerId, attributes) {
        const container = document.getElementById(containerId);
        if (!attributes) {
            container.innerHTML = '<p>No attributes available</p>';
            return;
        }

        container.innerHTML = Object.entries(attributes).map(([key, value]) => {
            // Handle both new format (value.rating) and legacy format (value as number)
            const rating = value.rating || value || 5;
            return `
            <div class="attribute-item">
                <span class="attribute-label">${this.formatAttributeName(key)}</span>
                <div class="attribute-value">
                    <span class="attribute-rating rating-${rating}">${rating}</span>
                    <div class="attribute-bar">
                        <div class="attribute-bar-fill" style="width: ${rating * 5}%; background: ${this.getRatingColor(rating)}"></div>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    displayPositions(player) {
        const positionMap = document.getElementById('position-map');
        const positionDetails = document.getElementById('position-details');
        
        // Clear existing content
        positionMap.innerHTML = '';
        positionDetails.innerHTML = '';

        // Handle new positions array format
        if (player.playingInfo?.positions?.length > 0) {
            const sortedPositions = player.playingInfo.positions.sort((a, b) => a.order - b.order);
            
            sortedPositions.forEach((pos, index) => {
                const position = this.formatPositionName(pos.position);
                const coords = this.getPositionCoordinates(position);
                
                if (coords) {
                    const isPrimary = index === 0;
                    positionMap.innerHTML += `
                        <div class="position-marker ${isPrimary ? '' : 'secondary'}" style="left: ${coords.x}%; top: ${coords.y}%;" title="${position} (${pos.suitability}%)">
                            ${this.getPositionAbbreviation(position)}
                        </div>
                    `;
                }

                positionDetails.innerHTML += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">${index === 0 ? 'Primary Position' : 'Secondary Position'}</span>
                        <span class="fm-stat-value">${position} (${pos.suitability}%)</span>
                    </div>
                    ${pos.notes ? `<div class="fm-stat"><span class="fm-stat-label">Notes</span><span class="fm-stat-value">${pos.notes}</span></div>` : ''}
                `;
            });
        }
        // Fallback for legacy data (handled by migration in server)
        else if (player.playingInfo?.primaryPosition) {
            const primary = player.playingInfo.primaryPosition;
            const primaryPos = typeof primary === 'string' ? primary : primary.position;
            const primaryCoords = this.getPositionCoordinates(primaryPos);
            
            if (primaryCoords) {
                positionMap.innerHTML += `
                    <div class="position-marker" style="left: ${primaryCoords.x}%; top: ${primaryCoords.y}%;" title="${primaryPos}">
                        ${this.getPositionAbbreviation(primaryPos)}
                    </div>
                `;
            }

            positionDetails.innerHTML += `
                <div class="fm-stat">
                    <span class="fm-stat-label">Primary Position</span>
                    <span class="fm-stat-value">${primaryPos} ${typeof primary === 'object' && primary.suitability ? `(${primary.suitability}%)` : ''}</span>
                </div>
            `;

            // Handle legacy secondary positions
            if (player.playingInfo?.secondaryPositions?.length > 0) {
                player.playingInfo.secondaryPositions.forEach(pos => {
                    const position = typeof pos === 'string' ? pos : pos.position;
                    const coords = this.getPositionCoordinates(position);
                    
                    if (coords) {
                        positionMap.innerHTML += `
                            <div class="position-marker secondary" style="left: ${coords.x}%; top: ${coords.y}%;" title="${position}">
                                ${this.getPositionAbbreviation(position)}
                            </div>
                        `;
                    }

                    positionDetails.innerHTML += `
                        <div class="fm-stat">
                            <span class="fm-stat-label">Secondary Position</span>
                            <span class="fm-stat-value">${position} ${typeof pos === 'object' && pos.suitability ? `(${pos.suitability}%)` : ''}</span>
                        </div>
                    `;
                });
            }
        }
    }

    displayHistory(player) {
        // This could be expanded to show previous teams, achievements, etc.
        const historyContainer = document.getElementById('playing-history');
        const yearsPlaying = player.playingInfo?.yearsPlaying || 0;
        const currentTeam = player.playingInfo?.currentTeam?.clubName || player.playingInfo?.currentTeam || 'No team';
        
        historyContainer.innerHTML = `
            <p>Has been playing football for ${yearsPlaying} years.</p>
            <p>Currently playing for ${currentTeam}.</p>
        `;
    }

    displayList(elementId, items) {
        const element = document.getElementById(elementId);
        if (items && items.length > 0) {
            element.innerHTML = items.map(item => `<li>${item}</li>`).join('');
        } else {
            element.innerHTML = '<li>None listed</li>';
        }
    }

    async handleContactForm() {
        const formData = {
            sender_name: document.getElementById('sender-name').value,
            sender_email: document.getElementById('sender-email').value,
            sender_phone: document.getElementById('sender-phone').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch(`/api/public/players/${this.playerId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                this.showMessage('Message sent successfully!', 'success');
                document.getElementById('contact-form').reset();
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.showMessage('Failed to send message. Please try again.', 'error');
        }
    }

    // Utility functions
    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return '--';
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    getInitials(fullName) {
        if (!fullName) return 'PP';
        return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    getPositionDisplay(playingInfo) {
        // Handle new positions array format
        if (playingInfo?.positions?.length > 0) {
            const sortedPositions = playingInfo.positions.sort((a, b) => a.order - b.order);
            const primaryPosition = this.formatPositionName(sortedPositions[0].position);
            
            if (sortedPositions.length === 1) {
                return primaryPosition;
            } else {
                const secondaryPositions = sortedPositions.slice(1, 3).map(pos => 
                    this.formatPositionName(pos.position)
                ).join(', ');
                return `${primaryPosition} / ${secondaryPositions}`;
            }
        }
        
        // Fallback for legacy data
        if (!playingInfo?.primaryPosition) return 'Unknown';
        
        const primary = playingInfo.primaryPosition;
        const primaryPos = typeof primary === 'string' ? primary : primary.position;
        
        let display = primaryPos;
        
        if (playingInfo.secondaryPositions?.length > 0) {
            const secondaryPositions = playingInfo.secondaryPositions.map(pos => 
                typeof pos === 'string' ? pos : pos.position
            ).slice(0, 2).join(', ');
            display += ` / ${secondaryPositions}`;
        }
        
        return display;
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

    getHeight(personalInfo) {
        if (personalInfo?.height?.centimeters) {
            return personalInfo.height.centimeters;
        }
        if (personalInfo?.heightCm) {
            return personalInfo.heightCm;
        }
        return '--';
    }

    getWeight(personalInfo) {
        if (personalInfo?.weight?.kilograms) {
            return personalInfo.weight.kilograms;
        }
        if (personalInfo?.weightKg) {
            return personalInfo.weightKg;
        }
        return '--';
    }

    getTopAttribute(abilities) {
        if (!abilities) return 'PLAYER';
        
        let topAttribute = null;
        let topRating = 0;
        
        ['technical', 'physical', 'mental'].forEach(category => {
            if (abilities[category]) {
                Object.entries(abilities[category]).forEach(([key, value]) => {
                    // Handle both new format (value.rating) and legacy format (value as number)
                    let rating = value.rating || value;
                    if (typeof rating === 'number' && rating > topRating) {
                        topRating = rating;
                        topAttribute = key;
                    }
                });
            }
        });
        
        return topAttribute ? this.formatAttributeForBadge(topAttribute) : 'PLAYER';
    }

    formatAttributeForBadge(attributeName) {
        const attributeMap = {
            'ballControl': 'TECHNICAL',
            'passing': 'PASSING', 
            'shooting': 'SHOOTING',
            'dribbling': 'DRIBBLING',
            'firstTouch': 'TOUCH',
            'crossing': 'CROSSING',
            'tackling': 'TACKLING',
            'heading': 'HEADING',
            'pace': 'PACE',
            'strength': 'STRENGTH',
            'stamina': 'STAMINA',
            'agility': 'AGILITY',
            'balance': 'BALANCE',
            'jumping': 'JUMPING',
            'decisionMaking': 'VISION',
            'positioning': 'POSITIONING',
            'concentration': 'FOCUS',
            'leadership': 'LEADER',
            'communication': 'VOCAL'
        };
        
        return attributeMap[attributeName] || attributeName.toUpperCase();
    }

    getTopAttributes(abilities, count = 6) {
        const allAttributes = [];
        
        ['technical', 'physical', 'mental'].forEach(category => {
            if (abilities?.[category]) {
                Object.entries(abilities[category]).forEach(([key, value]) => {
                    // Handle both new format (value.rating) and legacy format (value as number)
                    let rating = value.rating || value;
                    if (typeof rating === 'number' && rating > 0) {
                        allAttributes.push({
                            name: key,
                            rating: rating,
                            category: category
                        });
                    }
                });
            }
        });
        
        return allAttributes
            .sort((a, b) => b.rating - a.rating)
            .slice(0, count);
    }

    formatAttributeName(name) {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    getRatingColor(rating) {
        if (rating >= 16) return '#22c55e';
        if (rating >= 11) return '#3b82f6';
        if (rating >= 6) return '#f59e0b';
        return '#ef4444';
    }

    getPositionCoordinates(position) {
        const positions = {
            'Goalkeeper': { x: 50, y: 90 },
            'Right Back': { x: 80, y: 75 },
            'Center Back': { x: 50, y: 75 },
            'Centre Back': { x: 50, y: 75 },
            'Left Back': { x: 20, y: 75 },
            'Right Wing Back': { x: 85, y: 60 },
            'Left Wing Back': { x: 15, y: 60 },
            'Defensive Midfielder': { x: 50, y: 60 },
            'Central Midfielder': { x: 50, y: 50 },
            'Right Midfielder': { x: 75, y: 50 },
            'Left Midfielder': { x: 25, y: 50 },
            'Attacking Midfielder': { x: 50, y: 35 },
            'Right Winger': { x: 85, y: 30 },
            'Left Winger': { x: 15, y: 30 },
            'Right Wing': { x: 85, y: 30 },
            'Left Wing': { x: 15, y: 30 },
            'Striker': { x: 50, y: 20 },
            'Center Forward': { x: 50, y: 20 },
            'Centre Forward': { x: 50, y: 20 },
            'False Nine': { x: 50, y: 25 }
        };
        
        return positions[position] || null;
    }

    getPositionAbbreviation(position) {
        const abbreviations = {
            'Goalkeeper': 'GK',
            'Right Back': 'RB',
            'Center Back': 'CB',
            'Centre Back': 'CB',
            'Left Back': 'LB',
            'Right Wing Back': 'RWB',
            'Left Wing Back': 'LWB',
            'Defensive Midfielder': 'DM',
            'Central Midfielder': 'CM',
            'Right Midfielder': 'RM',
            'Left Midfielder': 'LM',
            'Attacking Midfielder': 'AM',
            'Right Winger': 'RW',
            'Left Winger': 'LW',
            'Right Wing': 'RW',
            'Left Wing': 'LW',
            'Striker': 'ST',
            'Center Forward': 'CF',
            'Centre Forward': 'CF',
            'False Nine': 'F9'
        };
        
        return abbreviations[position] || position.slice(0, 3).toUpperCase();
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
            background: ${type === 'success' ? 'var(--fm-success)' : 'var(--fm-danger)'};
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

    showError(message) {
        document.querySelector('.fm-container').innerHTML = `
            <div class="fm-card fm-mt-xl">
                <div class="fm-card-body fm-text-center">
                    <h2>Error</h2>
                    <p>${message}</p>
                    <a href="/" class="fm-btn fm-btn-primary fm-mt-md">Go to Home</a>
                </div>
            </div>
        `;
    }

    displayAdditionalInfo(player) {
        // Check if we need to add the additional info card
        const hasLocation = player.playingInfo?.basedLocation;
        const hasRepTeams = player.playingInfo?.representativeTeams;
        const hasAwards = player.playingInfo?.trophiesAwards?.length > 0;
        
        if (!hasLocation && !hasRepTeams && !hasAwards) {
            return;
        }
        
        // Find or create the additional info card
        let additionalCard = document.getElementById('additional-info-card');
        if (!additionalCard) {
            // Create the card after the overview cards
            const overviewTab = document.getElementById('overview-tab');
            const cardHtml = `
                <div id="additional-info-card" class="fm-card fm-mt-lg">
                    <div class="fm-card-header">
                        <h3 class="fm-card-title">Additional Information</h3>
                    </div>
                    <div class="fm-card-body" id="additional-info-content">
                    </div>
                </div>
            `;
            overviewTab.insertAdjacentHTML('beforeend', cardHtml);
            additionalCard = document.getElementById('additional-info-card');
        }
        
        const content = document.getElementById('additional-info-content');
        let html = '';
        
        // Location - always show if available (public info)
        if (hasLocation) {
            html += `
                <div class="fm-stat">
                    <span class="fm-stat-label">Based In</span>
                    <span class="fm-stat-value">${player.playingInfo.basedLocation}</span>
                </div>
            `;
        }
        
        // Representative Teams
        if (hasRepTeams) {
            const district = player.playingInfo.representativeTeams?.district;
            const county = player.playingInfo.representativeTeams?.county;
            
            if (district?.selected && district.selected !== '') {
                const districtText = this.getRepTeamText(district.selected, district.season);
                html += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">District Team</span>
                        <span class="fm-stat-value">${districtText}</span>
                    </div>
                `;
            }
            
            if (county?.selected && county.selected !== '') {
                const countyText = this.getRepTeamText(county.selected, county.season);
                html += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">County Team</span>
                        <span class="fm-stat-value">${countyText}</span>
                    </div>
                `;
            }
        }
        
        // Trophies and Awards
        if (hasAwards) {
            const awardsHtml = player.playingInfo.trophiesAwards.map(award => {
                const season = award.season ? ` (${award.season})` : '';
                return `<li>${award.title}${season}</li>`;
            }).join('');
            
            html += `
                <div class="fm-stat" style="align-items: flex-start;">
                    <span class="fm-stat-label" style="min-width: 120px;">Trophies & Awards</span>
                    <ul class="fm-list" style="margin: 0; padding-left: 20px;">
                        ${awardsHtml}
                    </ul>
                </div>
            `;
        }
        
        content.innerHTML = html;
    }
    
    getRepTeamText(selected, season) {
        let text = '';
        switch (selected) {
            case 'yes':
                text = '✓ Selected';
                break;
            case 'no':
                text = '✗ Not Selected';
                break;
            case 'trials':
                text = '• Trials Attended';
                break;
            default:
                return '--';
        }
        
        if (season && (selected === 'yes' || selected === 'trials')) {
            text += ` (${season})`;
        }
        
        return text;
    }

    displayContactInfoForPrint(player) {
        // Check if any contact info exists
        const hasPlayerContact = player.contactInfo?.player?.phone || player.contactInfo?.player?.email;
        const hasGuardianContact = player.contactInfo?.guardian?.name || 
                                  player.contactInfo?.guardian?.phone || 
                                  player.contactInfo?.guardian?.email;
        
        // Only show if we have some contact data
        if (!hasPlayerContact && !hasGuardianContact) {
            return;
        }
        
        // Only show contact info in print version for profile owner
        const contactCard = document.createElement('div');
        contactCard.className = 'fm-card fm-mt-lg print-only-contact';
        contactCard.style.cssText = 'display: none;'; // Hidden on screen, shown in print
        
        let contactHtml = `
            <div class="fm-card-header">
                <h3 class="fm-card-title">Contact Information (Private - Owner View)</h3>
            </div>
            <div class="fm-card-body">
                <div class="fm-grid fm-grid-2">
        `;
        
        // Player contact section
        if (hasPlayerContact) {
            contactHtml += `
                <div>
                    <h4 style="margin-bottom: var(--spacing-md);">Player Contact</h4>
            `;
            if (player.contactInfo?.player?.phone) {
                contactHtml += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">Phone</span>
                        <span class="fm-stat-value">${player.contactInfo.player.phone}</span>
                    </div>
                `;
            }
            if (player.contactInfo?.player?.email) {
                contactHtml += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">Email</span>
                        <span class="fm-stat-value">${player.contactInfo.player.email}</span>
                    </div>
                `;
            }
            contactHtml += `</div>`;
        }
        
        // Guardian contact section
        if (hasGuardianContact) {
            contactHtml += `
                <div>
                    <h4 style="margin-bottom: var(--spacing-md);">Guardian Contact</h4>
            `;
            if (player.contactInfo?.guardian?.name) {
                contactHtml += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">Name</span>
                        <span class="fm-stat-value">${player.contactInfo.guardian.name}</span>
                    </div>
                `;
            }
            if (player.contactInfo?.guardian?.phone) {
                contactHtml += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">Phone</span>
                        <span class="fm-stat-value">${player.contactInfo.guardian.phone}</span>
                    </div>
                `;
            }
            if (player.contactInfo?.guardian?.email) {
                contactHtml += `
                    <div class="fm-stat">
                        <span class="fm-stat-label">Email</span>
                        <span class="fm-stat-value">${player.contactInfo.guardian.email}</span>
                    </div>
                `;
            }
            contactHtml += `</div>`;
        }
        
        contactHtml += `
                </div>
            </div>
        `;
        
        contactCard.innerHTML = contactHtml;
        
        // Add to overview tab
        document.getElementById('overview-tab').appendChild(contactCard);
    }

    generateQRCode() {
        // Generate QR code for the current public profile URL
        const publicProfileUrl = `${window.location.origin}/profile-view.html?id=${this.playerId}`;
        const canvas = document.getElementById('qr-code-canvas');
        
        if (!canvas) {
            console.error('QR code canvas element not found');
            return;
        }
        
        // Use a different approach - inline QR code generation using QRCode library
        if (typeof QRCode !== 'undefined') {
            try {
                // Clear any existing content
                canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
                
                // Generate QR code
                QRCode.toCanvas(canvas, publicProfileUrl, {
                    width: 100,
                    height: 100,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    },
                    margin: 1,
                    scale: 4
                }, function (error) {
                    if (error) {
                        console.error('QR Code generation error:', error);
                        // Use alternative QR generation method
                        ModernProfileView.prototype.createFallbackQR(canvas, publicProfileUrl);
                    } else {
                        console.log('QR Code generated successfully');
                    }
                });
            } catch (e) {
                console.error('QR Code library error:', e);
                this.createFallbackQR(canvas, publicProfileUrl);
            }
        } else {
            console.warn('QRCode library not loaded, using fallback');
            this.createFallbackQR(canvas, publicProfileUrl);
        }
    }
    
    createFallbackQR(canvas, url) {
        // Create a simple QR code using a free API service as fallback
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`;
        
        // Create an image element
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, 100, 100);
        };
        img.onerror = function() {
            // Final fallback - just show text
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 100, 100);
            ctx.fillStyle = 'black';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Scan for', 50, 40);
            ctx.fillText('Online Profile', 50, 55);
        };
        img.src = qrApiUrl;
    }
}

// Initialize the profile view when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ModernProfileView();
});