// Football Player Profile Data Structure

const playerProfileSchema = {
  // Unique identifier
  playerId: "string", // Auto-generated UUID
  
  // Personal Information
  personalInfo: {
    fullName: "string",
    dateOfBirth: "date", // ISO 8601 format: YYYY-MM-DD
    age: "number", // Can be calculated from DOB
    height: {
      feet: "number",
      inches: "number",
      centimeters: "number" // Auto-converted
    },
    weight: {
      pounds: "number",
      kilograms: "number" // Auto-converted
    },
    preferredFoot: "enum", // ["right", "left", "both"]
    nationality: "string",
    eligibleToPlayFor: ["string"] // Array of countries
  },
  
  // Contact Information
  contactInfo: {
    player: {
      phone: "string",
      email: "string"
    },
    guardian: {
      name: "string",
      phone: "string",
      email: "string",
      relationship: "string" // e.g., "mother", "father", "guardian"
    },
    address: {
      street: "string",
      city: "string",
      state: "string",
      zipCode: "string",
      country: "string"
    }
  },
  
  // Playing Information
  playingInfo: {
    primaryPosition: "string",
    secondaryPositions: ["string"],
    yearsPlaying: "number",
    currentTeam: {
      clubName: "string",
      league: "string",
      division: "string",
      coach: {
        name: "string",
        phone: "string",
        email: "string"
      },
      startDate: "date"
    },
    previousTeams: [
      {
        clubName: "string",
        league: "string",
        startDate: "date",
        endDate: "date"
      }
    ]
  },
  
  // Physical Attributes
  physicalAttributes: {
    speed40YardDash: "number", // in seconds
    verticalJump: "number", // in inches
    staminaLevel: "enum", // ["excellent", "veryGood", "good", "average"]
    injuryHistory: [
      {
        date: "date",
        description: "string",
        recoveryTime: "string",
        currentStatus: "enum" // ["fullyRecovered", "ongoing", "chronic"]
      }
    ]
  },
  
  // Academic Information
  academicInfo: {
    currentSchool: "string",
    gradeYear: "string",
    academicInterests: ["string"]
  },
  
  // Achievements & Honors
  achievements: {
    individualAwards: [
      {
        title: "string",
        date: "date",
        organization: "string",
        description: "string"
      }
    ],
    teamAchievements: [
      {
        title: "string",
        date: "date",
        team: "string",
        description: "string"
      }
    ],
    representativeHonors: [
      {
        level: "enum", // ["state", "regional", "national", "international"]
        team: "string",
        year: "number",
        description: "string"
      }
    ]
  },
  
  // Statistics
  statistics: {
    currentSeason: {
      seasonYear: "string", // e.g., "2024-2025"
      appearances: "number",
      starts: "number",
      minutesPlayed: "number",
      goals: "number",
      assists: "number",
      cleanSheets: "number", // For GK/Defenders
      yellowCards: "number",
      redCards: "number",
      // Position-specific stats
      saves: "number", // Goalkeeper
      penaltiesSaved: "number", // Goalkeeper
      tackles: "number", // Defender/Midfielder
      interceptions: "number", // Defender/Midfielder
      passCompletion: "number", // Percentage
      shotsOnTarget: "number" // Forward/Midfielder
    },
    historicalStats: [
      {
        // Same structure as currentSeason
      }
    ]
  },
  
  // Player Abilities & Characteristics
  abilities: {
    technical: {
      ballControl: {
        rating: "number", // 1-10
        description: "string"
      },
      passing: {
        rating: "number",
        description: "string"
      },
      shooting: {
        rating: "number",
        description: "string"
      },
      dribbling: {
        rating: "number",
        description: "string"
      },
      firstTouch: {
        rating: "number",
        description: "string"
      }
    },
    physical: {
      pace: {
        rating: "number",
        description: "string"
      },
      strength: {
        rating: "number",
        description: "string"
      },
      agility: {
        rating: "number",
        description: "string"
      },
      stamina: {
        rating: "number",
        description: "string"
      }
    },
    mental: {
      gameIntelligence: {
        rating: "number",
        description: "string"
      },
      workRate: {
        rating: "number",
        description: "string"
      },
      leadership: {
        rating: "number",
        description: "string"
      },
      composure: {
        rating: "number",
        description: "string"
      }
    },
    positionSpecific: {
      skills: ["string"],
      description: "string"
    }
  },
  
  // Playing Style
  playingStyle: {
    summary: "string", // Brief one-liner
    detailedDescription: "string",
    strengths: ["string"],
    weaknesses: ["string"],
    comparablePlayer: "string" // Professional player comparison
  },
  
  // Development Areas
  development: {
    areasForImprovement: ["string"],
    trainingFocus: ["string"],
    progressNotes: [
      {
        date: "date",
        note: "string",
        author: "string"
      }
    ]
  },
  
  // References
  references: [
    {
      name: "string",
      title: "string", // e.g., "Head Coach", "Academy Director"
      organization: "string",
      phone: "string",
      email: "string",
      relationship: "string",
      yearsKnown: "number"
    }
  ],
  
  // Media
  media: {
    profilePhoto: "string", // URL or file path
    actionPhotos: ["string"],
    videos: [
      {
        title: "string",
        url: "string",
        type: "enum", // ["highlights", "fullMatch", "training", "interview"]
        date: "date",
        description: "string"
      }
    ]
  },
  
  // Additional Information
  additionalInfo: {
    notes: "string",
    specialCircumstances: "string",
    availability: "string", // e.g., "Immediately", "After graduation"
    willingToRelocate: "boolean",
    preferredLocations: ["string"]
  },
  
  // Metadata
  metadata: {
    createdDate: "date",
    lastUpdated: "date",
    updatedBy: "string",
    visibility: "enum", // ["public", "scoutsOnly", "private"]
    tags: ["string"], // For searchability
    status: "enum" // ["active", "inactive", "transferred", "graduated"]
  }
};

// Example validation rules for the app
const validationRules = {
  personalInfo: {
    fullName: { required: true, minLength: 2, maxLength: 100 },
    dateOfBirth: { required: true, minAge: 5, maxAge: 30 },
    height: { required: true, min: 100, max: 250 }, // cm
    weight: { required: true, min: 30, max: 150 }, // kg
    preferredFoot: { required: true, options: ["right", "left", "both"] }
  },
  contactInfo: {
    player: {
      email: { required: true, pattern: "email" }
    },
    guardian: {
      email: { required: true, pattern: "email" },
      phone: { required: true, pattern: "phone" }
    }
  },
  abilities: {
    ratings: { min: 1, max: 10, required: true }
  }
};

// Example API endpoints structure
const apiEndpoints = {
  // Player CRUD operations
  "POST /api/players": "Create new player profile",
  "GET /api/players/:id": "Get player profile by ID",
  "PUT /api/players/:id": "Update player profile",
  "DELETE /api/players/:id": "Delete player profile",
  
  // Search and filtering
  "GET /api/players": "List all players with filters",
  "GET /api/players/search": "Search players by name, position, etc.",
  
  // Statistics
  "GET /api/players/:id/stats": "Get player statistics",
  "POST /api/players/:id/stats": "Add season statistics",
  
  // Media
  "POST /api/players/:id/media/upload": "Upload photos/videos",
  "GET /api/players/:id/media": "Get player media",
  
  // Export
  "GET /api/players/:id/export/pdf": "Export as PDF",
  "GET /api/players/:id/export/json": "Export as JSON",
  
  // Sharing
  "POST /api/players/:id/share": "Generate shareable link",
  "GET /api/shared/:token": "Access shared profile"
};

// Example features for the app
const appFeatures = {
  core: [
    "Player profile creation and editing",
    "Photo and video upload",
    "Statistics tracking",
    "Search and filter players",
    "Export profiles as PDF"
  ],
  advanced: [
    "Scout access management",
    "Performance analytics and charts",
    "Comparison tool between players",
    "Team/academy management",
    "Automated highlight reel generation",
    "Match performance tracking",
    "Training log integration",
    "Injury tracking and recovery timeline",
    "Academic progress monitoring",
    "Communication portal with scouts"
  ],
  userRoles: [
    "player",
    "parent",
    "coach",
    "scout",
    "admin"
  ]
};