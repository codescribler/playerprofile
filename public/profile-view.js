class ProfileView {
    constructor() {
        this.playerId = this.getPlayerIdFromUrl();
        this.token = localStorage.getItem('token');
        this.playerData = null;
        this.init();
    }

    getPlayerIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    async init() {
        if (!this.playerId) {
            alert('No player ID provided');
            window.history.back();
            return;
        }

        try {
            await this.loadPlayerProfile();
            this.setGenerationDate();
            this.setupActionBar();
        } catch (error) {
            console.error('Error loading player profile:', error);
            alert('Error loading player profile');
        }
    }

    async loadPlayerProfile() {
        // Try to load as authenticated user first
        if (this.token) {
            try {
                const response = await fetch(`/api/players/${this.playerId}`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                if (response.ok) {
                    this.playerData = await response.json();
                    this.populateProfile(this.playerData);
                    return;
                }
            } catch (error) {
                console.log('Authenticated request failed, trying public access');
            }
        }

        // Try to load as public profile
        try {
            const response = await fetch(`/api/public/players/${this.playerId}`);

            if (response.ok) {
                this.playerData = await response.json();
                this.populateProfile(this.playerData);
                return;
            } else if (response.status === 404) {
                alert('Profile not found or not published');
                window.history.back();
                return;
            }
        } catch (error) {
            console.error('Public request failed:', error);
        }

        // If both attempts fail, redirect to login
        alert('Please login to view this profile');
        window.location.href = '/';
    }

    populateProfile(player) {
        console.log('Player data:', player);
        document.getElementById('player-name').textContent = player.personalInfo?.fullName || 'Unknown Player';
        
        // Handle primary position display in header
        const primaryPos = player.playingInfo?.primaryPosition;
        if (typeof primaryPos === 'string') {
            document.getElementById('position').textContent = primaryPos;
        } else if (primaryPos?.position) {
            document.getElementById('position').textContent = primaryPos.position;
        } else {
            document.getElementById('position').textContent = 'N/A';
        }
        document.getElementById('age').textContent = this.calculateAge(player.personalInfo?.dateOfBirth) || 'N/A';
        document.getElementById('height').textContent = this.formatHeight(player.personalInfo?.height) || 'N/A';
        document.getElementById('weight').textContent = this.formatWeight(player.personalInfo?.weight) || 'N/A';
        
        document.getElementById('dob').textContent = this.formatDate(player.personalInfo?.dateOfBirth) || 'N/A';
        document.getElementById('nationality').textContent = player.personalInfo?.nationality || 'N/A';
        
        // Format preferred foot with weak foot strength
        const preferredFoot = this.capitalizeFirst(player.personalInfo?.preferredFoot) || 'N/A';
        const weakFootStrength = player.personalInfo?.weakFootStrength || 50;
        
        if (preferredFoot === 'N/A') {
            document.getElementById('preferred-foot').textContent = 'N/A';
        } else {
            const weakFoot = preferredFoot === 'Left' ? 'Right' : 'Left';
            document.getElementById('preferred-foot').textContent = `Preferred: ${preferredFoot} foot | ${weakFoot} foot: ${weakFootStrength}% strength`;
        }
        
        document.getElementById('years-playing').textContent = player.playingInfo?.yearsPlaying || 'N/A';
        
        document.getElementById('player-email').textContent = player.contactInfo?.player?.email || 'N/A';
        document.getElementById('player-phone').textContent = player.contactInfo?.player?.phone || 'N/A';
        document.getElementById('guardian-name').textContent = player.contactInfo?.guardian?.name || 'N/A';
        document.getElementById('guardian-email').textContent = player.contactInfo?.guardian?.email || 'N/A';
        document.getElementById('guardian-phone').textContent = player.contactInfo?.guardian?.phone || 'N/A';
        
        document.getElementById('current-team').textContent = player.playingInfo?.currentTeam?.clubName || 'N/A';
        document.getElementById('league').textContent = player.playingInfo?.currentTeam?.league || 'N/A';
        document.getElementById('school').textContent = player.academicInfo?.currentSchool || 'N/A';
        document.getElementById('grade').textContent = player.academicInfo?.gradeYear || 'N/A';
        
        // Populate showcase description
        document.getElementById('player-showcase').textContent = player.showcase?.description || 'This talented player brings exceptional skills and dedication to the field. A promising prospect with strong potential for development at higher levels.';
        
        // Populate primary position with details
        this.populatePrimaryPosition(player.playingInfo?.primaryPosition);
        
        // Populate secondary positions with details
        this.populateSecondaryPositions(player.playingInfo?.secondaryPositions);
        
        this.populateAbilities(player.abilities);
        this.populatePlayingStyle(player.playingStyle);
        
        if (player.media?.profilePhoto) {
            const profilePhoto = document.getElementById('profile-photo');
            const photoUrl = player.media.profilePhoto;
            
            
            // Check if it's a base64 image or a file path
            if (photoUrl.startsWith('data:')) {
                // It's a base64 image, use as-is
                profilePhoto.src = photoUrl;
                profilePhoto.style.display = 'block';
            } else if (photoUrl.startsWith('/uploads/')) {
                // Old file path format - replace with placeholder
                const initials = player.personalInfo?.fullName ? 
                    player.personalInfo.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'PP';
                
                profilePhoto.style.display = 'none';
                const photoContainer = profilePhoto.parentElement;
                
                // Remove existing placeholder if any
                const existingPlaceholder = photoContainer.querySelector('.profile-photo-placeholder');
                if (existingPlaceholder) {
                    existingPlaceholder.remove();
                }
                
                // Create placeholder
                const placeholder = document.createElement('div');
                placeholder.className = 'profile-photo-placeholder';
                placeholder.textContent = initials;
                placeholder.title = 'Photo no longer available - please upload a new one';
                placeholder.style.cssText = `
                    width: 150px;
                    height: 150px;
                    border-radius: 50%;
                    background-color: #3498db;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    font-weight: bold;
                    margin: 0 auto 1rem;
                    border: 3px solid #f0f0f0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                `;
                
                photoContainer.appendChild(placeholder);
            } else {
                profilePhoto.style.display = 'none';
            }
        } else {
            document.getElementById('profile-photo').style.display = 'none';
        }
    }

    populateAbilities(abilities) {
        if (!abilities) return;

        const technicalSkills = abilities.technical || {};
        const physicalSkills = abilities.physical || {};
        const mentalSkills = abilities.mental || {};

        // Technical Skills
        this.setAbilityRating('ball-control', technicalSkills.ballControl?.rating || 5);
        this.setAbilityRating('passing', technicalSkills.passing?.rating || 5);
        this.setAbilityRating('shooting', technicalSkills.shooting?.rating || 5);
        this.setAbilityRating('dribbling', technicalSkills.dribbling?.rating || 5);
        this.setAbilityRating('first-touch', technicalSkills.firstTouch?.rating || 5);
        this.setAbilityRating('crossing', technicalSkills.crossing?.rating || 5);
        this.setAbilityRating('tackling', technicalSkills.tackling?.rating || 5);
        this.setAbilityRating('heading', technicalSkills.heading?.rating || 5);

        // Physical Skills
        this.setAbilityRating('pace', physicalSkills.pace?.rating || 5);
        this.setAbilityRating('strength', physicalSkills.strength?.rating || 5);
        this.setAbilityRating('stamina', physicalSkills.stamina?.rating || 5);
        this.setAbilityRating('agility', physicalSkills.agility?.rating || 5);
        this.setAbilityRating('balance', physicalSkills.balance?.rating || 5);
        this.setAbilityRating('jumping', physicalSkills.jumping?.rating || 5);

        // Mental Skills
        this.setAbilityRating('decision-making', mentalSkills.decisionMaking?.rating || 5);
        this.setAbilityRating('positioning', mentalSkills.positioning?.rating || 5);
        this.setAbilityRating('concentration', mentalSkills.concentration?.rating || 5);
        this.setAbilityRating('leadership', mentalSkills.leadership?.rating || 5);
        this.setAbilityRating('communication', mentalSkills.communication?.rating || 5);
    }

    setAbilityRating(abilityName, rating) {
        const percentage = (rating / 10) * 100;
        const ratingFill = document.getElementById(`${abilityName}-rating`);
        const ratingValue = document.getElementById(`${abilityName}-value`);
        
        if (ratingFill) {
            ratingFill.style.width = `${percentage}%`;
        }
        if (ratingValue) {
            ratingValue.textContent = rating;
        }
    }

    populatePrimaryPosition(primaryPosition) {
        const container = document.getElementById('primary-position-detail');
        container.innerHTML = '';
        
        if (!primaryPosition) {
            container.innerHTML = '<p>N/A</p>';
            return;
        }
        
        if (typeof primaryPosition === 'string') {
            // Old format - just a string
            container.innerHTML = `<p><strong>${primaryPosition}</strong></p>`;
        } else {
            // New format with suitability and notes
            const positionDiv = document.createElement('div');
            positionDiv.className = 'primary-position-item';
            positionDiv.innerHTML = `
                <p><strong>${primaryPosition.position}</strong> - Suitability: ${primaryPosition.suitability}%</p>
                ${primaryPosition.notes ? `<p class="position-notes">${primaryPosition.notes}</p>` : ''}
            `;
            container.appendChild(positionDiv);
        }
    }

    populateSecondaryPositions(positions) {
        const container = document.getElementById('secondary-positions-list');
        container.innerHTML = '';
        
        if (!positions || positions.length === 0) {
            container.innerHTML = '<p>No secondary positions listed</p>';
            return;
        }
        
        positions.forEach(pos => {
            const positionDiv = document.createElement('div');
            positionDiv.className = 'secondary-position-item';
            
            if (typeof pos === 'string') {
                // Old format
                positionDiv.innerHTML = `
                    <p><strong>${pos}</strong></p>
                `;
            } else {
                // New format with suitability and notes
                positionDiv.innerHTML = `
                    <p><strong>${pos.position}</strong> - Suitability: ${pos.suitability}%</p>
                    ${pos.notes ? `<p class="position-notes">${pos.notes}</p>` : ''}
                `;
            }
            
            container.appendChild(positionDiv);
        });
    }

    populatePlayingStyle(playingStyle) {
        if (!playingStyle) return;

        document.getElementById('playing-style-summary').textContent = playingStyle.summary || 'No summary available';
        
        const strengthsList = document.getElementById('strengths-list');
        strengthsList.innerHTML = '';
        if (playingStyle.strengths && playingStyle.strengths.length > 0) {
            playingStyle.strengths.forEach(strength => {
                const li = document.createElement('li');
                li.textContent = strength;
                strengthsList.appendChild(li);
            });
        } else {
            strengthsList.innerHTML = '<li>No strengths listed</li>';
        }
        
        const weaknessesList = document.getElementById('weaknesses-list');
        weaknessesList.innerHTML = '';
        if (playingStyle.weaknesses && playingStyle.weaknesses.length > 0) {
            playingStyle.weaknesses.forEach(weakness => {
                const li = document.createElement('li');
                li.textContent = weakness;
                weaknessesList.appendChild(li);
            });
        } else {
            weaknessesList.innerHTML = '<li>No areas for improvement listed</li>';
        }
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

    formatHeight(height) {
        if (!height) return 'N/A';
        
        if (height.centimeters) {
            return `${height.centimeters} cm`;
        } else if ((height.feet || height.feet === 0) && (height.inches || height.inches === 0)) {
            return `${height.feet}'${height.inches}"`;
        }
        
        return 'N/A';
    }

    formatWeight(weight) {
        if (!weight) return 'N/A';
        
        if (weight.kilograms) {
            return `${weight.kilograms} kg`;
        } else if (weight.pounds) {
            return `${weight.pounds} lbs`;
        }
        
        return 'N/A';
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    capitalizeFirst(str) {
        if (!str) return 'N/A';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    formatSecondaryPositions(positions) {
        if (!positions || !Array.isArray(positions) || positions.length === 0) {
            return 'N/A';
        }
        
        // Handle both old and new formats
        if (typeof positions[0] === 'string') {
            // Old format - just strings
            return positions.join(', ');
        } else {
            // New format - objects with position, suitability, and notes
            return positions.map(pos => `${pos.position} (${pos.suitability}%)`).join(', ');
        }
    }

    setGenerationDate() {
        const now = new Date();
        const dateString = now.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('generation-date').textContent = dateString;
    }

    setupActionBar() {
        if (!this.playerData) return;

        // Update profile title
        document.getElementById('profile-title').textContent = `${this.playerData.personalInfo?.fullName || 'Player'} Profile`;

        // Check if user is authenticated and owns this profile
        const isAuthenticated = !!this.token;
        const isPublished = this.playerData.metadata?.published;
        
        if (isAuthenticated) {
            // Authenticated user - show management buttons and all content
            if (isPublished) {
                document.getElementById('published-status').style.display = 'block';
                document.getElementById('withdraw-profile-btn').style.display = 'block';
                document.getElementById('publish-profile-btn').style.display = 'none';
            } else {
                document.getElementById('published-status').style.display = 'none';
                document.getElementById('withdraw-profile-btn').style.display = 'none';
                document.getElementById('publish-profile-btn').style.display = 'block';
            }

            // Show edit button for authenticated users
            document.getElementById('edit-profile-btn').style.display = 'block';

            // Show contact information and school info for authenticated users
            document.getElementById('contact-info-section').style.display = 'block';
            const schoolInfoElements = document.querySelectorAll('.school-info');
            schoolInfoElements.forEach(el => el.style.display = 'block');

            // Hide contact form for authenticated users
            document.getElementById('contact-form-section').style.display = 'none';

            // Setup button event handlers
            document.getElementById('edit-profile-btn').addEventListener('click', () => this.editProfile());
            document.getElementById('publish-profile-btn').addEventListener('click', () => this.publishProfile());
            document.getElementById('withdraw-profile-btn').addEventListener('click', () => this.withdrawProfile());
        } else {
            // Public viewer - hide management buttons and sensitive info
            document.getElementById('published-status').style.display = 'none';
            document.getElementById('withdraw-profile-btn').style.display = 'none';
            document.getElementById('publish-profile-btn').style.display = 'none';
            document.getElementById('edit-profile-btn').style.display = 'none';

            // Hide contact information and school info for public viewers
            document.getElementById('contact-info-section').style.display = 'none';
            const schoolInfoElements = document.querySelectorAll('.school-info');
            schoolInfoElements.forEach(el => el.style.display = 'none');

            // Show contact form for public viewers
            document.getElementById('contact-form-section').style.display = 'block';
            this.setupContactForm();
        }
    }

    editProfile() {
        // Navigate back to main page and open edit form
        window.location.href = `/?edit=${this.playerId}`;
    }

    async publishProfile() {
        if (!confirm('Are you sure you want to publish this profile publicly? This will make it viewable by anyone with the link.')) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${this.playerId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ published: true })
            });

            if (response.ok) {
                this.playerData.metadata.published = true;
                this.setupActionBar();
                this.showMessage('Profile published successfully!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error || 'Failed to publish profile', 'error');
            }
        } catch (error) {
            console.error('Error publishing profile:', error);
            this.showMessage('Failed to publish profile', 'error');
        }
    }

    async withdrawProfile() {
        if (!confirm('Are you sure you want to withdraw this profile from public view?')) {
            return;
        }

        try {
            const response = await fetch(`/api/players/${this.playerId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ published: false })
            });

            if (response.ok) {
                this.playerData.metadata.published = false;
                this.setupActionBar();
                this.showMessage('Profile withdrawn successfully!', 'success');
            } else {
                const data = await response.json();
                this.showMessage(data.error || 'Failed to withdraw profile', 'error');
            }
        } catch (error) {
            console.error('Error withdrawing profile:', error);
            this.showMessage('Failed to withdraw profile', 'error');
        }
    }

    setupContactForm() {
        const form = document.getElementById('contact-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                senderName: document.getElementById('sender-name').value,
                senderEmail: document.getElementById('sender-email').value,
                senderPhone: document.getElementById('sender-phone').value,
                message: document.getElementById('message').value
            };
            
            const submitBtn = form.querySelector('.submit-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            
            try {
                const response = await fetch(`/api/public/players/${this.playerId}/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    this.showContactMessage('Message sent successfully!', 'success');
                    form.reset();
                } else {
                    const data = await response.json();
                    this.showContactMessage(data.error || 'Failed to send message', 'error');
                }
            } catch (error) {
                this.showContactMessage('Failed to send message. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        });
    }

    showContactMessage(message, type) {
        const container = document.getElementById('message-container');
        if (container) {
            container.innerHTML = `<div class="message ${type}">${message}</div>`;
            
            setTimeout(() => {
                container.innerHTML = '';
            }, 5000);
        }
    }

    showMessage(message, type) {
        const existing = document.querySelector('.message');
        if (existing) {
            existing.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            border-radius: 4px;
            z-index: 1000;
            max-width: 300px;
            ${type === 'success' ? 'background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
              'background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}

const profileView = new ProfileView();