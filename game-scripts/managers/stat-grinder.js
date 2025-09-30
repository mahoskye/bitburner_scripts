/** @param {NS} ns */
export async function main(ns) {
    const CONFIG = {
        // Faction milestone targets
        FACTION_MILESTONES: {
            // Early game factions
            EARLY: {
                hacking: 50,
                combat: 100, // str/def/dex/agi average
                charisma: 25,
                factions: ["CyberSec", "Tian Di Hui", "Netburners"]
            },
            // Mid-early factions
            MID_EARLY: {
                hacking: 100,
                combat: 150,
                charisma: 50,
                factions: ["NiteSec", "The Black Hand", "Sector-12"]
            },
            // Mid game factions
            MID: {
                hacking: 200,
                combat: 225,
                charisma: 75,
                factions: ["BitRunners", "ECorp", "MegaCorp", "Four Sigma"]
            },
            // Late game preparation
            LATE: {
                hacking: 400,
                combat: 300,
                charisma: 150,
                factions: ["OmniTek", "NWO", "Fulcrum", "Daedalus"]
            }
        },

        // Company job requirements
        JOB_REQUIREMENTS: {
            "Software Engineer": { hacking: 225, charisma: 0 },
            "Senior Software Engineer": { hacking: 400, charisma: 0 },
            "Lead Software Developer": { hacking: 800, charisma: 0 },
            "Software Consultant": { hacking: 300, charisma: 100 },
            "Senior Software Consultant": { hacking: 525, charisma: 200 },
            "IT Manager": { hacking: 150, charisma: 100 },
            "Systems Administrator": { hacking: 250, charisma: 75 }
        },

        // Training locations and their efficiency
        TRAINING: {
            universities: {
                "Rothman University": {
                    city: "Sector-12",
                    courses: {
                        "Study Computer Science": { stat: "hacking", mult: 0.5 },
                        "Data Structures": { stat: "hacking", mult: 1.0 },
                        "Networks": { stat: "hacking", mult: 2.0 },
                        "Algorithms": { stat: "hacking", mult: 4.0 },
                        "Management": { stat: "charisma", mult: 2.0 },
                        "Leadership": { stat: "charisma", mult: 4.0 }
                    }
                }
            },
            gyms: {
                "Powerhouse Gym": {
                    city: "Sector-12",
                    workouts: {
                        "Train Strength": { stat: "strength" },
                        "Train Defense": { stat: "defense" },
                        "Train Dexterity": { stat: "dexterity" },
                        "Train Agility": { stat: "agility" }
                    }
                }
            }
        },

        // Progress tracking settings
        PROGRESS_CHECK_INTERVAL: 60000, // 1 minute
        SLOW_PROGRESS_THRESHOLD: 0.1, // Less than 0.1 stat gain per minute
        SWITCH_COOLDOWN: 300000, // 5 minutes before switching again

        // When to run stat grinding
        MIN_MONEY_BUFFER: 1000000, // Only grind if we have > 1M
        IDLE_DETECTION_TIME: 10000 // Consider player idle after 10 seconds
    };

    ns.disableLog("sleep");
    ns.disableLog("getPlayer");

    // Check if Singularity API is available for training functions
    let SINGULARITY_AVAILABLE = false;
    try {
        // Test the actual functions we need, not just their existence
        if (ns.singularity &&
            typeof ns.singularity.gymWorkout === 'function' &&
            typeof ns.singularity.universityCourse === 'function') {

            // Try a test call to see if Source-File 4 is actually available
            ns.singularity.isBusy(); // This will throw if Source-File 4 not available
            SINGULARITY_AVAILABLE = true;
            ns.print("Singularity API available - automated stat grinding enabled");
        } else {
            ns.print("Singularity API functions not found - guidance mode only");
        }
    } catch (error) {
        ns.print(`Singularity API not available - guidance mode only (${error.message})`);
        SINGULARITY_AVAILABLE = false;
    }

    if (!SINGULARITY_AVAILABLE) {
        ns.tprint("Stat Grinder requires Singularity API (Source-File 4)");
        ns.tprint("Currently running in guidance mode - check HUD for stat recommendations");
        await createStatGuidance();
        return;
    }

    let lastSwitchTime = 0;
    let progressHistory = [];
    let currentTarget = null;

    while (true) {
        const player = ns.getPlayer();

        // Only run if player is not busy and has sufficient money
        if (shouldRunStatGrinder(player)) {
            // Determine current milestone and target stats
            const currentMilestone = getCurrentMilestone(player);
            const targetStats = getTargetStats(player, currentMilestone);

            // Check if we should switch training focus
            if (shouldSwitchFocus(player, targetStats)) {
                const newTarget = selectBestTrainingTarget(player, targetStats);
                if (newTarget && newTarget !== currentTarget) {
                    await switchToTarget(newTarget);
                    currentTarget = newTarget;
                    lastSwitchTime = Date.now();
                    progressHistory = []; // Reset progress tracking
                }
            }

            // Track progress
            trackProgress(player);

            // Update HUD with current training info
            updateHUD(player, currentMilestone, targetStats, currentTarget);
        } else {
            // Player is busy or low on money, just update HUD
            updateHUD(player, null, null, null);
        }

        await ns.sleep(CONFIG.PROGRESS_CHECK_INTERVAL);
    }

    function shouldRunStatGrinder(player) {
        const hasEnoughMoney = ns.getServerMoneyAvailable("home") > CONFIG.MIN_MONEY_BUFFER;

        // Check if player is idle (without Singularity API)
        let isIdle = true;
        try {
            // Try Singularity API if available
            if (ns.singularity && typeof ns.singularity.isBusy === 'function') {
                isIdle = !ns.singularity.isBusy();
            } else {
                // Fallback: assume idle if no work info available
                // In practice, we'll check if our training commands succeed
                isIdle = true;
            }
        } catch (error) {
            // Singularity API not available, assume idle
            isIdle = true;
        }

        return hasEnoughMoney && isIdle;
    }

    function getCurrentMilestone(player) {
        const stats = player.skills;
        const avgCombat = (stats.strength + stats.defense + stats.dexterity + stats.agility) / 4;

        // Check milestones from highest to lowest
        for (const [level, milestone] of Object.entries(CONFIG.FACTION_MILESTONES).reverse()) {
            if (stats.hacking >= milestone.hacking * 0.8 ||
                avgCombat >= milestone.combat * 0.8 ||
                stats.charisma >= milestone.charisma * 0.8) {
                return { level, ...milestone };
            }
        }

        return { level: "EARLY", ...CONFIG.FACTION_MILESTONES.EARLY };
    }

    function getTargetStats(player, milestone) {
        const stats = player.skills;
        const avgCombat = (stats.strength + stats.defense + stats.dexterity + stats.agility) / 4;

        return {
            hacking: Math.max(0, milestone.hacking - stats.hacking),
            combat: Math.max(0, milestone.combat - avgCombat),
            charisma: Math.max(0, milestone.charisma - stats.charisma),
            strength: Math.max(0, milestone.combat - stats.strength),
            defense: Math.max(0, milestone.combat - stats.defense),
            dexterity: Math.max(0, milestone.combat - stats.dexterity),
            agility: Math.max(0, milestone.combat - stats.agility)
        };
    }

    function shouldSwitchFocus(player, targetStats) {
        const currentTime = Date.now();

        // Don't switch too frequently
        if (currentTime - lastSwitchTime < CONFIG.SWITCH_COOLDOWN) {
            return false;
        }

        // Switch if no current target
        if (!currentTarget) {
            return true;
        }

        // Check if progress has been slow
        if (progressHistory.length >= 3) {
            const recentProgress = progressHistory.slice(-3);
            const avgProgress = recentProgress.reduce((sum, p) => sum + p.gain, 0) / recentProgress.length;

            if (avgProgress < CONFIG.SLOW_PROGRESS_THRESHOLD) {
                ns.print(`Slow progress detected (${avgProgress.toFixed(2)}/min), considering switch`);
                return true;
            }
        }

        return false;
    }

    function selectBestTrainingTarget(player, targetStats) {
        const stats = player.skills;
        const priorities = [];

        // Priority 1: Hacking (most important for progression)
        if (targetStats.hacking > 0) {
            priorities.push({
                type: "hacking",
                need: targetStats.hacking,
                current: stats.hacking,
                priority: 100
            });
        }

        // Priority 2: Charisma (needed for jobs)
        if (targetStats.charisma > 0) {
            priorities.push({
                type: "charisma",
                need: targetStats.charisma,
                current: stats.charisma,
                priority: 80
            });
        }

        // Priority 3: Combat stats (needed for some factions)
        if (targetStats.strength > 0) {
            priorities.push({
                type: "strength",
                need: targetStats.strength,
                current: stats.strength,
                priority: 60
            });
        }

        if (targetStats.defense > 0) {
            priorities.push({
                type: "defense",
                need: targetStats.defense,
                current: stats.defense,
                priority: 55
            });
        }

        if (targetStats.dexterity > 0) {
            priorities.push({
                type: "dexterity",
                need: targetStats.dexterity,
                current: stats.dexterity,
                priority: 50
            });
        }

        if (targetStats.agility > 0) {
            priorities.push({
                type: "agility",
                need: targetStats.agility,
                current: stats.agility,
                priority: 45
            });
        }

        // Sort by priority and need
        priorities.sort((a, b) => {
            const priorityDiff = b.priority - a.priority;
            if (priorityDiff !== 0) return priorityDiff;
            return b.need - a.need;
        });

        return priorities.length > 0 ? priorities[0] : null;
    }

    async function switchToTarget(target) {
        ns.print(`Switching training focus to: ${target.type}`);

        // Stop current activity if possible
        try {
            if (ns.singularity && typeof ns.singularity.stopAction === 'function') {
                ns.singularity.stopAction();
            }
        } catch (error) {
            ns.print("Cannot stop current action - Singularity API not available");
        }
        await ns.sleep(1000);

        if (target.type === "hacking") {
            // Choose best available hacking course
            const courses = ["Algorithms", "Networks", "Data Structures", "Study Computer Science"];
            for (const course of courses) {
                if (ns.universityCourse("Rothman University", course)) {
                    ns.print(`Started university course: ${course}`);
                    return;
                }
            }
        } else if (target.type === "charisma") {
            // Choose best available charisma course
            const courses = ["Leadership", "Management"];
            for (const course of courses) {
                if (ns.universityCourse("Rothman University", course)) {
                    ns.print(`Started university course: ${course}`);
                    return;
                }
            }
        } else {
            // Combat stat - go to gym
            const workoutMap = {
                "strength": "Train Strength",
                "defense": "Train Defense",
                "dexterity": "Train Dexterity",
                "agility": "Train Agility"
            };

            const workout = workoutMap[target.type];
            if (workout && ns.gymWorkout("Powerhouse Gym", workout)) {
                ns.print(`Started gym workout: ${workout}`);
                return;
            }
        }

        ns.print(`Failed to start training for ${target.type}`);
    }

    function trackProgress(player) {
        const currentTime = Date.now();

        if (progressHistory.length > 0) {
            const lastRecord = progressHistory[progressHistory.length - 1];
            const timeDiff = (currentTime - lastRecord.time) / 60000; // minutes

            if (currentTarget && timeDiff >= 1.0) { // Track every minute
                let currentStat;
                switch (currentTarget.type) {
                    case "hacking": currentStat = player.skills.hacking; break;
                    case "charisma": currentStat = player.skills.charisma; break;
                    case "strength": currentStat = player.skills.strength; break;
                    case "defense": currentStat = player.skills.defense; break;
                    case "dexterity": currentStat = player.skills.dexterity; break;
                    case "agility": currentStat = player.skills.agility; break;
                    default: currentStat = 0;
                }

                const gain = currentStat - lastRecord.stat;
                progressHistory.push({
                    time: currentTime,
                    stat: currentStat,
                    gain: gain / timeDiff
                });

                // Keep only recent history
                if (progressHistory.length > 10) {
                    progressHistory = progressHistory.slice(-10);
                }
            }
        } else if (currentTarget) {
            // Initialize tracking
            let currentStat;
            switch (currentTarget.type) {
                case "hacking": currentStat = player.skills.hacking; break;
                case "charisma": currentStat = player.skills.charisma; break;
                case "strength": currentStat = player.skills.strength; break;
                case "defense": currentStat = player.skills.defense; break;
                case "dexterity": currentStat = player.skills.dexterity; break;
                case "agility": currentStat = player.skills.agility; break;
                default: currentStat = 0;
            }

            progressHistory.push({
                time: currentTime,
                stat: currentStat,
                gain: 0
            });
        }
    }

    function updateHUD(player, milestone, targetStats, currentTarget) {
        try {
            const hudData = {
                isActive: !!currentTarget,
                currentTarget: currentTarget ? {
                    type: currentTarget.type,
                    current: currentTarget.current,
                    need: currentTarget.need
                } : null,
                milestone: milestone ? {
                    level: milestone.level,
                    factions: milestone.factions.slice(0, 2)
                } : null,
                stats: {
                    hacking: player.skills.hacking,
                    charisma: player.skills.charisma,
                    combat: Math.floor((player.skills.strength + player.skills.defense +
                                     player.skills.dexterity + player.skills.agility) / 4)
                },
                progress: progressHistory.length > 0 ? progressHistory[progressHistory.length - 1].gain : 0,
                lastUpdate: Date.now()
            };

            ns.clearPort(4);
            ns.writePort(4, JSON.stringify(hudData));
        } catch (error) {
            ns.print(`Could not update HUD: ${error.message}`);
        }
    }

    async function createStatGuidance() {
        // Guidance mode - show recommendations without automation
        while (true) {
            const player = ns.getPlayer();
            const currentMilestone = getCurrentMilestone(player);
            const targetStats = getTargetStats(player, currentMilestone);
            const recommendation = getTrainingRecommendation(player, targetStats);

            updateGuidanceHUD(player, currentMilestone, targetStats, recommendation);

            await ns.sleep(30000); // Update every 30 seconds
        }
    }

    function getTrainingRecommendation(player, targetStats) {
        const stats = player.skills;

        // Priority: Hacking > Charisma > Combat
        if (targetStats.hacking > 0) {
            return {
                type: "hacking",
                current: stats.hacking,
                target: stats.hacking + targetStats.hacking,
                location: "Rothman University",
                activity: "Study Algorithms or Networks",
                priority: "HIGH"
            };
        }

        if (targetStats.charisma > 0) {
            return {
                type: "charisma",
                current: stats.charisma,
                target: stats.charisma + targetStats.charisma,
                location: "Rothman University",
                activity: "Leadership or Management",
                priority: "MEDIUM"
            };
        }

        // Find most needed combat stat
        const combatStats = [
            { name: "strength", current: stats.strength, need: targetStats.strength },
            { name: "defense", current: stats.defense, need: targetStats.defense },
            { name: "dexterity", current: stats.dexterity, need: targetStats.dexterity },
            { name: "agility", current: stats.agility, need: targetStats.agility }
        ].filter(s => s.need > 0).sort((a, b) => b.need - a.need);

        if (combatStats.length > 0) {
            const stat = combatStats[0];
            return {
                type: stat.name,
                current: stat.current,
                target: stat.current + stat.need,
                location: "Powerhouse Gym",
                activity: `Train ${stat.name.charAt(0).toUpperCase() + stat.name.slice(1)}`,
                priority: "LOW"
            };
        }

        return null; // All targets met
    }

    function updateGuidanceHUD(player, milestone, targetStats, recommendation) {
        try {
            const hudData = {
                isActive: false,
                guidanceMode: true,
                recommendation: recommendation,
                milestone: milestone ? {
                    level: milestone.level,
                    factions: milestone.factions.slice(0, 2)
                } : null,
                stats: {
                    hacking: player.skills.hacking,
                    charisma: player.skills.charisma,
                    combat: Math.floor((player.skills.strength + player.skills.defense +
                                     player.skills.dexterity + player.skills.agility) / 4)
                },
                lastUpdate: Date.now()
            };

            ns.clearPort(4);
            ns.writePort(4, JSON.stringify(hudData));
        } catch (error) {
            ns.print(`Could not update guidance HUD: ${error.message}`);
        }
    }
}