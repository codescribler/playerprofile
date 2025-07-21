class PlayerSearch {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
        this.searchResults = [];
        this.postcodeCoordinates = null;
        this.init();
    }

    init() {
        // Check authentication
        if (!this.token || !this.user) {
            window.location.href = '/app';
            return;
        }

        // Check if user has permission to search (scouts, coaches, agents, admins)
        const allowedRoles = ['scout', 'coach', 'agent', 'admin'];
        if (!allowedRoles.includes(this.user.role)) {
            alert('You do not have permission to access this page');
            window.location.href = '/app';
            return;
        }

        this.setupEventListeners();
        this.loadInitialResults();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '/app';
        });

        // Search form
        document.getElementById('search-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.performSearch();
        });

        // Clear postcode
        document.getElementById('clear-postcode').addEventListener('click', () => {
            document.getElementById('postcode').value = '';
            this.postcodeCoordinates = null;
        });

        // Advanced filters toggle
        document.getElementById('toggle-advanced').addEventListener('click', () => {
            const advanced = document.getElementById('advanced-filters');
            const toggle = document.getElementById('toggle-advanced');
            if (advanced.style.display === 'none') {
                advanced.style.display = 'block';
                toggle.innerHTML = `Hide Advanced Filters
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 0.5rem;">
                        <polyline points="18 15 12 9 6 15"></polyline>
                    </svg>`;
            } else {
                advanced.style.display = 'none';
                toggle.innerHTML = `Show Advanced Filters
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 0.5rem;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>`;
            }
        });

        // Sort by
        document.getElementById('sort-by').addEventListener('change', () => {
            this.sortResults();
        });

        // Postcode validation
        document.getElementById('postcode').addEventListener('blur', async (e) => {
            const postcode = e.target.value.trim();
            if (postcode) {
                await this.validateAndGeocodePostcode(postcode);
            }
        });
    }

    async validateAndGeocodePostcode(postcode) {
        // Basic UK postcode validation
        const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
        if (!postcodeRegex.test(postcode)) {
            this.showPostcodeError('Invalid UK postcode format');
            return false;
        }

        try {
            // For now, we'll use a free postcode API
            // In production, you might want to use Google Maps API or similar
            const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 200 && data.result) {
                    this.postcodeCoordinates = {
                        latitude: data.result.latitude,
                        longitude: data.result.longitude,
                        postcode: data.result.postcode,
                        city: data.result.admin_district,
                        county: data.result.admin_county,
                        country: data.result.country
                    };
                    this.clearPostcodeError();
                    return true;
                }
            }
            
            this.showPostcodeError('Postcode not found');
            return false;
        } catch (error) {
            console.error('Error geocoding postcode:', error);
            this.showPostcodeError('Error validating postcode');
            return false;
        }
    }

    showPostcodeError(message) {
        const postcodeInput = document.getElementById('postcode');
        postcodeInput.classList.add('error');
        // You could add an error message element here
    }

    clearPostcodeError() {
        const postcodeInput = document.getElementById('postcode');
        postcodeInput.classList.remove('error');
    }

    async loadInitialResults() {
        // Load some initial results to show
        this.showLoading();
        try {
            const response = await fetch('/api/players/search?limit=12', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const players = await response.json();
                this.displayResults(players);
            }
        } catch (error) {
            console.error('Error loading initial results:', error);
            this.showNoResults();
        }
    }

    async performSearch() {
        this.showLoading();

        const searchParams = this.collectSearchParams();
        
        try {
            const queryString = new URLSearchParams(searchParams).toString();
            const response = await fetch(`/api/players/search?${queryString}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const players = await response.json();
                this.searchResults = players;
                this.displayResults(players);
            } else {
                throw new Error('Search failed');
            }
        } catch (error) {
            console.error('Error performing search:', error);
            this.showError('Failed to search players. Please try again.');
        }
    }

    collectSearchParams() {
        const params = {};

        // Location search
        const postcode = document.getElementById('postcode').value.trim();
        if (postcode && this.postcodeCoordinates) {
            params.latitude = this.postcodeCoordinates.latitude;
            params.longitude = this.postcodeCoordinates.longitude;
            params.radius = document.getElementById('radius').value;
        }

        // Age range
        const ageMin = document.getElementById('age-min').value;
        const ageMax = document.getElementById('age-max').value;
        if (ageMin) params.ageMin = ageMin;
        if (ageMax) params.ageMax = ageMax;

        // Positions
        const positions = [];
        if (document.getElementById('pos-gk').checked) positions.push('GK');
        if (document.getElementById('pos-def').checked) positions.push('DEF');
        if (document.getElementById('pos-mid').checked) positions.push('MID');
        if (document.getElementById('pos-att').checked) positions.push('ATT');
        if (positions.length > 0) params.positions = positions.join(',');

        // Preferred foot
        const preferredFoot = document.getElementById('preferred-foot').value;
        if (preferredFoot) params.preferredFoot = preferredFoot;

        // Availability
        const availability = [];
        if (document.getElementById('actively-looking').checked) availability.push('actively_looking');
        if (document.getElementById('open-to-offers').checked) availability.push('open_to_offers');
        if (availability.length > 0) params.availability = availability.join(',');

        if (document.getElementById('willing-relocate').checked) {
            params.willingToRelocate = 'true';
        }

        return params;
    }

    displayResults(players) {
        const container = document.getElementById('results-container');
        const countElement = document.getElementById('results-count');

        if (!players || players.length === 0) {
            this.showNoResults();
            return;
        }

        countElement.textContent = `Found ${players.length} player${players.length !== 1 ? 's' : ''}`;

        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'results-grid';

        players.forEach(player => {
            const card = this.createPlayerResultCard(player);
            resultsGrid.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(resultsGrid);
    }

    createPlayerResultCard(player) {
        const card = document.createElement('div');
        card.className = 'player-result-card';
        card.onclick = () => window.open(`/profile-view.html?id=${player.id}`, '_blank');

        // Get display name
        const firstName = player.personalInfo?.firstName || '';
        const lastName = player.personalInfo?.lastName || '';
        const displayName = `${firstName} ${lastName}`.trim() || player.personalInfo?.fullName || 'Unknown';

        // Get location
        const location = player.location?.city || 'Location not specified';
        const distance = player.distance ? `${Math.round(player.distance)} miles away` : '';

        // Get primary position
        const primaryPosition = this.getPrimaryPosition(player.playingInfo);

        // Get age
        const age = this.calculateAge(player.personalInfo?.dateOfBirth);

        // Get photo or initials
        let photoHtml = '';
        if (player.media?.profilePhoto) {
            photoHtml = `<img src="${player.media.profilePhoto}" alt="${displayName}" class="player-result-photo">`;
        } else {
            const initials = this.getInitials(firstName, lastName);
            photoHtml = `<div class="player-result-photo profile-photo-placeholder">${initials}</div>`;
        }

        // Get availability status
        const availabilityBadge = this.getAvailabilityBadge(player.availability?.status);

        card.innerHTML = `
            <div class="player-result-header">
                ${photoHtml}
                <div class="player-result-info">
                    <h3 class="player-result-name">${displayName}</h3>
                    <div class="player-result-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        ${location} ${distance ? `• ${distance}` : ''}
                    </div>
                </div>
            </div>
            
            <div class="player-result-stats">
                <div class="player-result-stat">
                    <span class="stat-label">Position:</span>
                    <span class="stat-value">${primaryPosition}</span>
                </div>
                <div class="player-result-stat">
                    <span class="stat-label">Age:</span>
                    <span class="stat-value">${age}</span>
                </div>
                <div class="player-result-stat">
                    <span class="stat-label">Foot:</span>
                    <span class="stat-value">${player.personalInfo?.preferredFoot || 'N/A'}</span>
                </div>
                <div class="player-result-stat">
                    <span class="stat-label">Experience:</span>
                    <span class="stat-value">${player.experience?.level || 'Not specified'}</span>
                </div>
            </div>
            
            <div class="player-result-badges">
                ${availabilityBadge}
                ${player.availability?.willingToRelocate ? '<span class="result-badge">Willing to Relocate</span>' : ''}
            </div>
        `;

        return card;
    }

    getAvailabilityBadge(status) {
        switch (status) {
            case 'actively_looking':
                return '<span class="result-badge primary">Actively Looking</span>';
            case 'open_to_offers':
                return '<span class="result-badge">Open to Offers</span>';
            default:
                return '';
        }
    }

    getPrimaryPosition(playingInfo) {
        if (playingInfo?.positions && playingInfo.positions.length > 0) {
            const primary = playingInfo.positions.find(p => p.isPrimary);
            return primary ? primary.position : playingInfo.positions[0].position;
        }
        return 'Not specified';
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

    getInitials(firstName, lastName) {
        const firstInitial = firstName ? firstName[0].toUpperCase() : 'P';
        const lastInitial = lastName ? lastName[0].toUpperCase() : 'P';
        return firstInitial + lastInitial;
    }

    sortResults() {
        const sortBy = document.getElementById('sort-by').value;
        
        // Sort the current results
        const sorted = [...this.searchResults];
        
        switch (sortBy) {
            case 'distance':
                sorted.sort((a, b) => (a.distance || 999) - (b.distance || 999));
                break;
            case 'age-asc':
                sorted.sort((a, b) => {
                    const ageA = this.calculateAge(a.personalInfo?.dateOfBirth);
                    const ageB = this.calculateAge(b.personalInfo?.dateOfBirth);
                    return ageA - ageB;
                });
                break;
            case 'age-desc':
                sorted.sort((a, b) => {
                    const ageA = this.calculateAge(a.personalInfo?.dateOfBirth);
                    const ageB = this.calculateAge(b.personalInfo?.dateOfBirth);
                    return ageB - ageA;
                });
                break;
            // Add more sort options as needed
        }
        
        this.displayResults(sorted);
    }

    showLoading() {
        document.getElementById('results-container').innerHTML = `
            <div class="search-loading">
                <div class="loading-spinner"></div>
            </div>
        `;
        document.getElementById('results-count').textContent = 'Searching...';
    }

    showNoResults() {
        document.getElementById('results-container').innerHTML = `
            <div class="no-results">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <h3>No Players Found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        document.getElementById('results-count').textContent = 'No results';
    }

    showError(message) {
        document.getElementById('results-container').innerHTML = `
            <div class="no-results">
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
        document.getElementById('results-count').textContent = 'Error';
    }
}

// Initialize search when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PlayerSearch();
});