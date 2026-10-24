/**
 * RESQNET Localized Strings (English with Hindi localization ready).
 * Plain calm language, steady wording, zero sensationalism.
 */

export const STRINGS = {
  en: {
    appTitle: "RESQNET",
    appSubtitle: "Resilient Offline Emergency Response Mesh",
    simulationBadge: "Simulation",
    footerNotice: "Hackathon prototype. Not connected to emergency services. In immediate danger call your local emergency number.",
    
    // Modes
    modeEveryday: "Everyday",
    modeDisaster: "Disaster",
    
    // Roles
    roleCitizen: "Citizen",
    roleDispatcher: "Dispatcher",
    roleDroneOperator: "Drone Operator",
    roleResponder: "Responder",
    roleAdmin: "Admin",

    // Network states
    netNormal: "Normal",
    netOutage: "Internet Outage",
    netRelay: "Relay-Only",
    netTotalLoss: "Total Loss",
    
    // Everyday categories (max 5)
    everydayCategories: [
      { id: "Medical", label: "Medical", desc: "Illness, injury, or urgent health need" },
      { id: "Accident", label: "Accident", desc: "Traffic collision or sudden hazard" },
      { id: "Fire or smoke", label: "Fire or smoke", desc: "Active flames, smoke, or gas smell" },
      { id: "Personal safety", label: "Personal safety", desc: "Threat to physical security" },
      { id: "Something else", label: "Something else", desc: "Other urgent assistance" },
    ],

    // Disaster categories (max 5)
    disasterCategories: [
      { id: "Trapped or stranded", label: "Trapped or stranded", desc: "Cut off by water, debris, or damage" },
      { id: "Medical help", label: "Medical help", desc: "Urgent medical attention needed" },
      { id: "Evacuate", label: "Evacuate", desc: "Assistance needed to reach a shelter" },
      { id: "Food/water/supplies", label: "Food/water/supplies", desc: "Critical survival supplies needed" },
      { id: "Missing person", label: "Missing person", desc: "Separated family member or missing individual" },
    ],

    // Citizen Wizard
    step1Title: "What kind of help do you need?",
    step2Title: "Where are you located?",
    useMyLocation: "Use my location (Simulated GPS)",
    orTypeLandmark: "Or enter a nearby landmark or sector:",
    landmarkPlaceholder: "e.g., Near Sector B4 Community School",
    step3Title: "How many people need assistance?",
    peopleChoices: ["1", "2–5", "6 or more", "Not sure"],
    step4Title: "Review and Send",
    notesLabel: "Additional details (optional):",
    notesPlaceholder: "e.g., Any injuries, specific obstacles, or needs",
    sendButton: "Send Request",
    backButton: "Back",
    nextButton: "Continue",

    // Citizen Status
    savedLocally: "Saved on this device — not yet sent",
    savedLocallyDesc: "Your request is saved locally. It will automatically transmit when network connectivity is available.",
    relayReceived: "Received by relay — not yet at the response system",
    relayReceivedDesc: "A local mesh relay picked up your packet. It will forward to dispatch as soon as the uplink clears.",
    deliveredToSystem: "Delivered to response system — awaiting a dispatcher",
    deliveredToSystemDesc: "Your report has reached the central response desk and is queued for verification.",
    underReview: "Under review by dispatch",
    assignedToTeam: "Assigned to a team — awaiting acceptance",
    responderAccepted: "A responder has accepted this request",
    inProgress: "Response team active",
    resolved: "Request resolved",
    cancelled: "Request cancelled",
    yourRequests: "Your Requests",
    noRequests: "No active requests on this device.",

    // Operator Overview
    kpiOpen: "Open Incidents",
    kpiCritical: "Critical Urgency",
    kpiUndelivered: "Waiting for Sync",
    kpiTeams: "Active Teams",
    prioritizedListTitle: "Prioritized Incident Queue",

    // Operator Queue
    queueTab: "Incident Queue",
    mapTab: "Sector Map",
    dronesTab: "Drone & Mesh Network",
    detectionsTab: "Detection Review",
    auditTab: "Audit Trail",
    logCallButton: "Log Call",
    filterButton: "Filters",

    // Detection Review
    detectionUnreviewedLabel: "Possible person detected, no request linked, pending verification",
    detectionSensorOrigin: "Detected by sensor, not reported by a person",
    detectionLimitations: "Sensors may trigger on animals, residual hot surfaces, debris, or thermal obstruction.",
    noFusionClaim: "Corroborating observation linked for visual alignment. No sensor fusion claim.",
    confidenceUncalibrated: "Uncalibrated Confidence:",
    uncertaintyMeters: "Location Uncertainty:",
    lockedEvidence: "Sensor Evidence: Locked until operator initiates review.",
    startReview: "Start Review",
    markFalsePositive: "Mark False Positive",
    requestRescan: "Request Re-scan",
    corroborateConfirm: "Confirm Possible Person",
    createIncidentAction: "Create Incident",

    // Drone & Mesh
    droneSurveyButton: "Run Drone Survey (Simulated)",
    meshStatusTitle: "Relay Mesh Connectivity",

    // AI Helper
    aiSuggestBadge: "AI-suggested — dispatcher must review",
    aiDisclaimerNotice: "Nothing saves until confirmed by dispatcher.",
  },
  
  hi: {
    appTitle: "रेसक्यूनेट (RESQNET)",
    appSubtitle: "ऑफलाइन आपातकालीन प्रतिक्रिया प्रणाली",
    simulationBadge: "सिमुलेशन",
    footerNotice: "हैकथॉन प्रोटोटाइप। आपातकालीन सेवाओं से जुड़ा नहीं है। तत्काल खतरे में स्थानीय आपातकालीन नंबर पर कॉल करें।",
    // Hindi fallback ready
  }
};

export const t = (key, lang = "en") => {
  return STRINGS[lang]?.[key] || STRINGS.en[key] || key;
};
